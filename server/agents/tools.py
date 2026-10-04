"""LangChain tools for the Hive agent system.

All tools access the SQLite database directly via aiosqlite so they work
inside LangGraph nodes without depending on request-scoped sessions.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import aiosqlite
from langchain_core.tools import tool

from ..database import DB_PATH, new_id, now_iso

# ---------------------------------------------------------------------------
# Internal helpers (not exposed as tools)
# ---------------------------------------------------------------------------


async def _check_conflicts_impl(user_id: str, start_dt: str, end_dt: str) -> list:
    """Return any events that overlap [start_dt, end_dt) for the user."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT * FROM events
            WHERE user_id = ?
              AND start_dt < ?
              AND end_dt   > ?
            ORDER BY start_dt
            """,
            (user_id, end_dt, start_dt),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def _budget_summary_impl(user_id: str, month: str) -> dict:
    """Aggregate expenses for month='YYYY-MM', return total + by_category."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM expenses WHERE user_id = ? AND date LIKE ? ORDER BY date",
            (user_id, f"{month}%"),
        ) as cursor:
            rows = await cursor.fetchall()
    expenses = [dict(r) for r in rows]
    total = sum(e["amount"] for e in expenses)
    by_category: dict[str, float] = {}
    for e in expenses:
        by_category[e["category"]] = by_category.get(e["category"], 0.0) + e["amount"]
    return {"total": total, "by_category": by_category, "month": month}


# ---------------------------------------------------------------------------
# PLANNER TOOLS
# ---------------------------------------------------------------------------


@tool
async def get_events(user_id: str, from_dt: str, to_dt: str) -> list:
    """Fetch all calendar events for *user_id* whose start_dt falls within [from_dt, to_dt]."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
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
    return [dict(r) for r in rows]


@tool
async def create_event(
    user_id: str,
    title: str,
    start_dt: str,
    end_dt: str,
    description: str = "",
) -> dict:
    """Create a new calendar event after checking for conflicts.

    Returns the created event dict. If any conflicts exist, a
    'conflict_warning' key is added describing them.
    """
    conflicts = await _check_conflicts_impl(user_id, start_dt, end_dt)
    event_id = new_id()
    created_at = now_iso()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO events
                (id, user_id, title, start_dt, end_dt, description, shared_with, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (event_id, user_id, title, start_dt, end_dt, description, "[]", 0.0, created_at),
        )
        await db.commit()

    result: dict = {
        "id": event_id,
        "user_id": user_id,
        "title": title,
        "start_dt": start_dt,
        "end_dt": end_dt,
        "description": description,
        "shared_with": [],
        "priority": 0.0,
        "created_at": created_at,
    }
    if conflicts:
        titles = ", ".join(c["title"] for c in conflicts)
        result["conflict_warning"] = (
            f"Overlaps with {len(conflicts)} existing event(s): {titles}"
        )
    return result


@tool
async def delete_event(event_id: str) -> dict:
    """Delete the calendar event identified by *event_id*."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id FROM events WHERE id = ?", (event_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return {"success": False, "error": f"Event {event_id!r} not found"}
        await db.execute("DELETE FROM events WHERE id = ?", (event_id,))
        await db.commit()
    return {"success": True, "event_id": event_id}


@tool
async def check_conflicts(user_id: str, start_dt: str, end_dt: str) -> list:
    """Return a list of events that overlap the given time window for *user_id*."""
    return await _check_conflicts_impl(user_id, start_dt, end_dt)


# ---------------------------------------------------------------------------
# EXPENSE TOOLS
# ---------------------------------------------------------------------------


@tool
async def log_expense(
    user_id: str,
    amount: float,
    category: str,
    description: str = "",
    date: str = "",
) -> dict:
    """Log a new expense and return the saved expense plus the month's budget summary.

    If *date* is omitted it defaults to today (UTC, ISO format YYYY-MM-DD).
    """
    expense_date = date if date else datetime.now(timezone.utc).date().isoformat()
    expense_id = new_id()
    created_at = now_iso()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO expenses
                (id, user_id, amount, currency, category, description, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (expense_id, user_id, amount, "INR", category, description, expense_date, created_at),
        )
        await db.commit()

    month = expense_date[:7]
    budget_summary = await _budget_summary_impl(user_id, month)

    return {
        "expense": {
            "id": expense_id,
            "user_id": user_id,
            "amount": amount,
            "currency": "USD",
            "category": category,
            "description": description,
            "date": expense_date,
            "created_at": created_at,
        },
        "budget_summary": budget_summary,
    }


@tool
async def get_expenses(user_id: str, month: str) -> dict:
    """Return all expenses for *user_id* in the given *month* ('YYYY-MM').

    Response keys: expenses (list), total (float), by_category (dict), month (str).
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM expenses WHERE user_id = ? AND date LIKE ? ORDER BY date",
            (user_id, f"{month}%"),
        ) as cursor:
            rows = await cursor.fetchall()
    expenses = [dict(r) for r in rows]
    total = sum(e["amount"] for e in expenses)
    by_category: dict[str, float] = {}
    for e in expenses:
        by_category[e["category"]] = by_category.get(e["category"], 0.0) + e["amount"]
    return {"expenses": expenses, "total": total, "by_category": by_category, "month": month}


@tool
async def get_budget_summary(user_id: str, month: str) -> dict:
    """Return a budget summary for *user_id* in the given *month* ('YYYY-MM').

    Response keys: total, by_category, month, avg_daily.
    """
    summary = await _budget_summary_impl(user_id, month)
    expenses_count = sum(1 for _ in summary["by_category"])  # rough proxy
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(DISTINCT date) as days FROM expenses WHERE user_id = ? AND date LIKE ?",
            (user_id, f"{month}%"),
        ) as cursor:
            row = await cursor.fetchone()
    active_days = row[0] if row and row[0] else 1
    summary["avg_daily"] = round(summary["total"] / active_days, 2)
    return summary


# ---------------------------------------------------------------------------
# PRIORITY TOOLS
# ---------------------------------------------------------------------------


@tool
async def get_open_tasks(user_id: str) -> list:
    """Return today's upcoming events + this month's recent expenses as a combined task list."""
    today = datetime.now(timezone.utc).date().isoformat()
    month = today[:7]

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute(
            """
            SELECT * FROM events
            WHERE user_id = ? AND start_dt >= ?
            ORDER BY start_dt
            LIMIT 20
            """,
            (user_id, today),
        ) as cursor:
            event_rows = await cursor.fetchall()

        async with db.execute(
            """
            SELECT * FROM expenses
            WHERE user_id = ? AND date LIKE ?
            ORDER BY date DESC
            LIMIT 20
            """,
            (user_id, f"{month}%"),
        ) as cursor:
            expense_rows = await cursor.fetchall()

    events = [{"type": "event", **dict(r)} for r in event_rows]
    expenses = [{"type": "expense", **dict(r)} for r in expense_rows]
    return events + expenses


@tool
async def save_priorities(user_id: str, scored_items: list) -> bool:
    """Upsert priority rows for the scored items.

    Each item in *scored_items* must have: ref_id, ref_type, score, reason (optional).
    """
    updated_at = now_iso()
    async with aiosqlite.connect(DB_PATH) as db:
        for item in scored_items:
            ref_id = str(item.get("ref_id", ""))
            ref_type = str(item.get("ref_type", "event"))
            score = float(item.get("score", 0.0))
            reason = str(item.get("reason", ""))

            async with db.execute(
                "SELECT id FROM priorities WHERE user_id = ? AND ref_id = ? AND ref_type = ?",
                (user_id, ref_id, ref_type),
            ) as cursor:
                existing = await cursor.fetchone()

            if existing:
                await db.execute(
                    """
                    UPDATE priorities
                    SET score = ?, reason = ?, updated_at = ?
                    WHERE user_id = ? AND ref_id = ? AND ref_type = ?
                    """,
                    (score, reason, updated_at, user_id, ref_id, ref_type),
                )
            else:
                await db.execute(
                    """
                    INSERT INTO priorities (id, user_id, ref_id, ref_type, score, reason, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (new_id(), user_id, ref_id, ref_type, score, reason, updated_at),
                )
        await db.commit()
    return True


# ---------------------------------------------------------------------------
# SYNC TOOLS
# ---------------------------------------------------------------------------


@tool
async def get_all_users() -> list:
    """Return all registered users as a list of {id, name} dicts."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, name FROM users ORDER BY name") as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@tool
async def share_event(event_id: str, target_user_ids: list) -> dict:
    """Share *event_id* with each user_id in *target_user_ids*.

    Merges the new IDs with any existing shared_with list (no duplicates).
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM events WHERE id = ?", (event_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if row is None:
            return {"success": False, "error": f"Event {event_id!r} not found"}

        event = dict(row)
        try:
            current_shared: list = json.loads(event.get("shared_with") or "[]")
        except (json.JSONDecodeError, TypeError):
            current_shared = []

        updated_shared = list(set(current_shared) | set(target_user_ids))

        await db.execute(
            "UPDATE events SET shared_with = ? WHERE id = ?",
            (json.dumps(updated_shared), event_id),
        )
        await db.commit()

    return {"success": True, "event_id": event_id, "shared_with": updated_shared}
