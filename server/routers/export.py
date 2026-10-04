import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/json/{user_id}")
async def export_json(
    user_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Export all data for *user_id* as a JSON dict.

    Keys: user, events, expenses, priorities, messages.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, created_at FROM users WHERE id = ?", (user_id,)
        ) as cursor:
            user_row = await cursor.fetchone()
        user = dict(user_row) if user_row else {}

        async with db.execute(
            "SELECT * FROM events WHERE user_id = ? ORDER BY start_dt", (user_id,)
        ) as cursor:
            event_rows = await cursor.fetchall()
        events = [dict(r) for r in event_rows]

        async with db.execute(
            "SELECT * FROM expenses WHERE user_id = ? ORDER BY date", (user_id,)
        ) as cursor:
            expense_rows = await cursor.fetchall()
        expenses = [dict(r) for r in expense_rows]

        async with db.execute(
            "SELECT * FROM priorities WHERE user_id = ? ORDER BY score DESC", (user_id,)
        ) as cursor:
            priority_rows = await cursor.fetchall()
        priorities = [dict(r) for r in priority_rows]

        async with db.execute(
            "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at", (user_id,)
        ) as cursor:
            message_rows = await cursor.fetchall()
        messages = [dict(r) for r in message_rows]

    return {
        "user": user,
        "events": events,
        "expenses": expenses,
        "priorities": priorities,
        "messages": messages,
    }


@router.get("/csv/{user_id}")
async def export_csv(
    user_id: str,
    _current_user: str = Depends(get_current_user),
):
    """Export the user's expenses as a streaming CSV file.

    Columns: date, amount, category, description.
    """
    async with get_db() as db:
        async with db.execute(
            """
            SELECT date, amount, category, description
            FROM expenses
            WHERE user_id = ?
            ORDER BY date
            """,
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "amount", "category", "description"])
    for row in rows:
        writer.writerow(
            [row["date"], row["amount"], row["category"], row["description"] or ""]
        )
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="expenses_{user_id}.csv"'
        },
    )
