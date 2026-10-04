import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import get_current_user
from ..database import get_db, new_id, now_iso
from ..models import Event, EventCreate

router = APIRouter(prefix="/events", tags=["events"])


def _parse_shared_with(raw: str | None) -> list:
    try:
        return json.loads(raw or "[]")
    except (json.JSONDecodeError, TypeError):
        return []


@router.get("/{user_id}")
async def list_events(
    user_id: str,
    from_dt: str = Query(default=None, description="ISO datetime lower bound (inclusive)"),
    to_dt: str = Query(default=None, description="ISO datetime upper bound (inclusive)"),
    _current_user: str = Depends(get_current_user),
):
    """Return events for *user_id* within [from_dt, to_dt].

    Defaults to today → +7 days when query params are absent.
    """
    now = datetime.now(timezone.utc)
    if from_dt is None:
        from_dt = now.isoformat()
    if to_dt is None:
        to_dt = (now + timedelta(days=7)).isoformat()

    async with get_db() as db:
        async with db.execute(
            """
            SELECT * FROM events
            WHERE user_id  = ?
              AND start_dt >= ?
              AND start_dt <= ?
            ORDER BY start_dt
            """,
            (user_id, from_dt, to_dt),
        ) as cursor:
            rows = await cursor.fetchall()

    result = []
    for row in rows:
        d = dict(row)
        d["shared_with"] = _parse_shared_with(d.get("shared_with"))
        result.append(d)
    return result


@router.post("", response_model=Event, status_code=201)
async def create_event(
    event: EventCreate,
    _current_user: str = Depends(get_current_user),
):
    """Insert a new event directly (no LLM). Returns the created Event."""
    event_id = new_id()
    created_at = now_iso()

    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO events
                (id, user_id, title, start_dt, end_dt, description, shared_with, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                event.user_id,
                event.title,
                event.start_dt,
                event.end_dt,
                event.description or "",
                "[]",
                0.0,
                created_at,
            ),
        )
        await db.commit()

    return Event(
        id=event_id,
        user_id=event.user_id,
        title=event.title,
        start_dt=event.start_dt,
        end_dt=event.end_dt,
        description=event.description or "",
        shared_with=[],
        priority=0.0,
        created_at=created_at,
    )


@router.delete("/{event_id}", status_code=200)
async def delete_event(
    event_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Delete the event identified by *event_id*."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM events WHERE id = ?", (event_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id!r} not found.",
            )

        await db.execute("DELETE FROM events WHERE id = ?", (event_id,))
        await db.commit()

    return {"success": True, "event_id": event_id}
