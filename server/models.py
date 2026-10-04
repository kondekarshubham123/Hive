from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    name: str
    pin: str


class LoginRequest(BaseModel):
    name: str
    pin: str


class AuthResponse(BaseModel):
    user_id: str
    name: str
    token: str


class ChatRequest(BaseModel):
    message: str
    user_id: str


class EventCreate(BaseModel):
    user_id: str
    title: str
    start_dt: str
    end_dt: str
    description: Optional[str] = ""


class Event(BaseModel):
    id: str
    user_id: str
    title: str
    start_dt: str
    end_dt: str
    description: Optional[str] = ""
    shared_with: List[str] = []
    priority: float = 0.0
    created_at: str


class ExpenseCreate(BaseModel):
    user_id: str
    amount: float
    category: str
    description: Optional[str] = ""
    date: Optional[str] = None


class Expense(BaseModel):
    id: str
    user_id: str
    amount: float
    currency: str = "USD"
    category: str
    description: Optional[str] = ""
    date: str
    created_at: str


class BudgetSummary(BaseModel):
    total: float
    by_category: Dict[str, float]
    month: str


class Priority(BaseModel):
    id: str
    user_id: str
    ref_id: str
    ref_type: str
    score: float
    reason: Optional[str] = ""
    updated_at: str


class UserInfo(BaseModel):
    id: str
    name: str
    created_at: str
