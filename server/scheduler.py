"""APScheduler integration for Hive.

The scheduler fires a morning briefing at 08:00 daily for every registered
user and pushes the result to any connected WebSocket client.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .database import get_db
from .ws_manager import manager

scheduler = AsyncIOScheduler()

OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:3b"


async def generate_briefing(user_id: str, user_name: str) -> str:
    """Call Ollama directly to produce a 2-sentence morning briefing."""
    today = datetime.now(timezone.utc).date().isoformat()
    today_end = f"{today}T23:59:59"
    month = today[:7]

    async with get_db() as db:
        async with db.execute(
            """
            SELECT title, start_dt, end_dt FROM events
            WHERE user_id = ? AND start_dt >= ? AND start_dt <= ?
            ORDER BY start_dt
            LIMIT 5
            """,
            (user_id, today, today_end),
        ) as cursor:
            event_rows = await cursor.fetchall()
        events = [dict(r) for r in event_rows]

        async with db.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date LIKE ?",
            (user_id, f"{month}%"),
        ) as cursor:
            budget_row = await cursor.fetchone()
    budget_total: float = float(budget_row["total"]) if budget_row else 0.0

    if events:
        events_text = ", ".join(
            f"'{e['title']}' at {e['start_dt']}" for e in events
        )
    else:
        events_text = "no scheduled events"

    prompt = (
        f"Write a friendly 2-sentence morning briefing for {user_name}. "
        f"Today's agenda: {events_text}. "
        f"Spending this month so far: ${budget_total:.2f}. "
        "Be warm, concise, and encouraging."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                OLLAMA_GENERATE_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip() or _fallback_briefing(
                user_name, events, budget_total
            )
    except Exception:
        return _fallback_briefing(user_name, events, budget_total)


def _fallback_briefing(user_name: str, events: list, budget_total: float) -> str:
    count = len(events)
    first = f"'{events[0]['title']}'" if events else "nothing"
    return (
        f"Good morning, {user_name}! You have {count} event(s) today"
        f" — first up is {first}. "
        f"You've spent ${budget_total:.2f} this month so far. Have a great day!"
    )


async def run_morning_briefings() -> None:
    """Iterate all registered users, generate briefings, push via WebSocket."""
    async with get_db() as db:
        async with db.execute("SELECT id, name FROM users ORDER BY name") as cursor:
            rows = await cursor.fetchall()
    users = [dict(r) for r in rows]

    for user in users:
        try:
            briefing = await generate_briefing(user["id"], user["name"])
            await manager.send_to(
                user["id"], {"type": "briefing", "content": briefing}
            )
        except Exception as exc:
            print(f"[scheduler] Failed to brief {user['name']}: {exc}")


def setup_scheduler(app) -> None:  # noqa: ANN001
    """Register the daily briefing job.  *app* is accepted for API symmetry but
    start/stop is handled by the lifespan in main.py."""
    scheduler.add_job(
        run_morning_briefings,
        trigger="cron",
        hour=8,
        minute=0,
        id="morning_briefing",
        replace_existing=True,
        misfire_grace_time=300,
    )
