from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import create_token, get_current_user, hash_pin, verify_pin
from ..database import get_db, new_id, now_iso
from ..models import AuthResponse, LoginRequest, RegisterRequest, UserInfo

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(request: RegisterRequest):
    """Create a new user with a 4-digit PIN."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM users WHERE name = ?", (request.name,)
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with that name already exists.",
            )

        user_id = new_id()
        pin_hash = hash_pin(request.pin)
        created_at = now_iso()

        await db.execute(
            "INSERT INTO users (id, name, pin_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, request.name, pin_hash, created_at),
        )
        await db.commit()

    token = create_token(user_id)
    return AuthResponse(user_id=user_id, name=request.name, token=token)


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Authenticate with user_id + PIN and return a fresh JWT."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, pin_hash FROM users WHERE name = ?",
            (request.name,),
        ) as cursor:
            user = await cursor.fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )

    if not verify_pin(request.pin, user["pin_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN."
        )

    token = create_token(user["id"])
    return AuthResponse(user_id=user["id"], name=user["name"], token=token)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user_id: str = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, created_at FROM users WHERE id = ?",
            (current_user_id,),
        ) as cursor:
            user = await cursor.fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )

    return UserInfo(id=user["id"], name=user["name"], created_at=user["created_at"])
