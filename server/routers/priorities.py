import json
import os

from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..agents.tools import get_open_tasks, save_priorities
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/priorities", tags=["priorities"])

_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "hive-fast")
_OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

# Local LLM instance — avoids importing from orchestrator (prevents circular deps)
_llm = ChatOllama(model=_OLLAMA_MODEL, base_url=_OLLAMA_BASE_URL, num_ctx=2048)


@router.get("/{user_id}")
async def list_priorities(
    user_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Return all priorities for *user_id* sorted by score descending."""
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM priorities WHERE user_id = ? ORDER BY score DESC",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("/refresh/{user_id}")
async def refresh_priorities(
    user_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Trigger LLM-based priority scoring and persist + return updated priorities."""
    # 1. Gather open tasks (events + expenses)
    tasks: list = await get_open_tasks.ainvoke({"user_id": user_id})

    if not tasks:
        return []

    # 2. Ask the LLM to score them
    tasks_json = json.dumps(tasks, default=str, indent=2)
    messages = [
        SystemMessage(
            content=(
                "You are a priority scoring assistant. "
                "Given a list of events and expenses, score each item 0.0–1.0 based on "
                "urgency, deadline proximity, and importance (1.0 = most urgent). "
                "Return ONLY a valid JSON array. Each element must be an object with keys: "
                "ref_id (string), ref_type ('event' or 'expense'), score (float 0.0-1.0), reason (string). "
                "No extra text, no markdown fences."
            )
        ),
        HumanMessage(content=f"Items to score:\n{tasks_json}"),
    ]

    response = await _llm.ainvoke(messages)
    raw_content = (response.content or "").strip()

    # Strip markdown fences if the model wraps output in ```json ... ```
    if raw_content.startswith("```"):
        lines = raw_content.splitlines()
        raw_content = "\n".join(
            line for line in lines if not line.startswith("```")
        ).strip()

    try:
        scored_items = json.loads(raw_content)
        if isinstance(scored_items, list) and scored_items:
            # Normalize: if model returned 0-10 scale, divide down to 0-1
            for item in scored_items:
                if isinstance(item.get("score"), (int, float)) and item["score"] > 1.0:
                    item["score"] = round(item["score"] / 10.0, 3)
            await save_priorities.ainvoke(
                {"user_id": user_id, "scored_items": scored_items}
            )
    except (json.JSONDecodeError, Exception):
        pass  # Scoring failed — return existing priorities unchanged

    # 3. Return updated priorities
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM priorities WHERE user_id = ? ORDER BY score DESC",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]
