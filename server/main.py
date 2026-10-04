"""Hive – local AI life assistant.

Start with:
    uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .auth import decode_token
from .database import DB_PATH, init_db
from .routers import auth_router, chat, events, expenses, export, priorities, voice
from .scheduler import scheduler, setup_scheduler
from .ws_manager import manager


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


logger = logging.getLogger("hive")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Hive starting — database: %s", DB_PATH)
    await init_db()
    logger.info("Database ready")
    setup_scheduler(app)
    if not scheduler.running:
        scheduler.start()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    if scheduler.running:
        scheduler.shutdown(wait=False)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Hive",
    description="Local AI life assistant running on Raspberry Pi.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for local development.
# In production tighten this to the actual client origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router.router)          # /auth/*
app.include_router(chat.router)                 # POST /chat  (no extra prefix)
app.include_router(events.router)               # /events/*
app.include_router(expenses.router)             # /expenses/*
app.include_router(priorities.router)           # /priorities/*
app.include_router(voice.router)                # /voice
app.include_router(export.router)               # /export/*


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(..., description="JWT obtained from /auth/login or /auth/register"),
):
    """Persistent WebSocket connection for a single user.

    The client authenticates by passing ?token=<jwt> in the URL.
    Once connected, incoming text messages are acknowledged; the server pushes
    morning briefings and any other server-initiated events.
    """
    # Validate token before accepting the socket
    try:
        decoded_user_id = decode_token(token)
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid or expired token.")
        return

    if decoded_user_id != user_id:
        await websocket.close(code=4003, reason="Token user_id mismatch.")
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection alive; handle any client-initiated messages.
            data = await websocket.receive_text()
            await manager.send_to(user_id, {"type": "ack", "content": data})
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)


# ---------------------------------------------------------------------------
# Static file serving — SPA catch-all for React Router
#
# StaticFiles(html=True) only returns index.html for "/" — refreshing on
# "/chat" or "/planner" returns 404. Instead we:
#   1. Mount /assets/* as a real static directory (JS/CSS bundles)
#   2. Add a catch-all GET route that serves the file if it exists on disk,
#      or falls through to index.html so React Router handles navigation.
# API routes registered above take priority because they were added first.
# ---------------------------------------------------------------------------

_CLIENT_DIST = os.path.join(os.path.dirname(__file__), "..", "client", "dist")

if os.path.isdir(_CLIENT_DIST):
    _assets_dir = os.path.join(_CLIENT_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = os.path.join(_CLIENT_DIST, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(_CLIENT_DIST, "index.html"))
