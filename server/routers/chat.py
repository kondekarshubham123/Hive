import asyncio
import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from ..agents.orchestrator import run_agent
from ..auth import get_current_user
from ..database import get_db, new_id, now_iso
from ..models import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    request: ChatRequest,
    _current_user: str = Depends(get_current_user),
):
    """Stream an LLM response to the user's message via SSE.

    Emits ``{"type": "token", "content": "<char>"}`` per character, then
    ``{"type": "done", "tool_results": [...]}`` when complete.
    """
    # Fetch the last 10 messages for context
    async with get_db() as db:
        async with db.execute(
            """
            SELECT role, content FROM messages
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (request.user_id,),
        ) as cursor:
            rows = await cursor.fetchall()

    history = [
        {"role": row["role"], "content": row["content"]}
        for row in reversed(rows)
    ]

    # Run the agent (blocking but async-safe — Ollama is the bottleneck)
    response_text, tool_results = await run_agent(
        request.message, request.user_id, history
    )

    # Persist the conversation turn
    async with get_db() as db:
        await db.execute(
            "INSERT INTO messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (new_id(), request.user_id, "user", request.message, now_iso()),
        )
        await db.execute(
            "INSERT INTO messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (new_id(), request.user_id, "assistant", response_text, now_iso()),
        )
        await db.commit()

    async def event_generator():
        for char in response_text:
            yield {
                "data": json.dumps({"type": "token", "content": char})
            }
            await asyncio.sleep(0.01)

        yield {
            "data": json.dumps(
                {"type": "done", "tool_results": tool_results},
                default=str,
            )
        }

    return EventSourceResponse(event_generator())
