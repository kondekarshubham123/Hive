from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..database import get_db, new_id, now_iso
from ..models import BudgetSummary, Expense, ExpenseCreate

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/{user_id}")
async def list_expenses(
    user_id: str,
    month: str = Query(default=None, description="Month to query in YYYY-MM format"),
    _current_user: str = Depends(get_current_user),
):
    """Return all expenses for *user_id* in *month*, plus a BudgetSummary.

    *month* defaults to the current UTC month when absent.
    """
    if month is None:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    async with get_db() as db:
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

    budget_summary = BudgetSummary(total=total, by_category=by_category, month=month)

    return {"expenses": expenses, "budget_summary": budget_summary.model_dump()}


@router.post("", response_model=Expense, status_code=201)
async def create_expense(
    expense: ExpenseCreate,
    _current_user: str = Depends(get_current_user),
):
    """Insert a new expense directly and return the created Expense."""
    expense_id = new_id()
    created_at = now_iso()
    expense_date = (
        expense.date
        if expense.date
        else datetime.now(timezone.utc).date().isoformat()
    )

    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO expenses
                (id, user_id, amount, currency, category, description, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                expense_id,
                expense.user_id,
                expense.amount,
                "INR",
                expense.category,
                expense.description or "",
                expense_date,
                created_at,
            ),
        )
        await db.commit()

    return Expense(
        id=expense_id,
        user_id=expense.user_id,
        amount=expense.amount,
        currency="USD",
        category=expense.category,
        description=expense.description or "",
        date=expense_date,
        created_at=created_at,
    )
