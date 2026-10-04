import aiosqlite
import uuid
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hive.db")


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                name       TEXT UNIQUE NOT NULL,
                pin_hash   TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                token      TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                title       TEXT NOT NULL,
                start_dt    TEXT NOT NULL,
                end_dt      TEXT NOT NULL,
                description TEXT DEFAULT '',
                shared_with TEXT DEFAULT '[]',
                priority    REAL DEFAULT 0.0,
                created_at  TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                amount      REAL NOT NULL,
                currency    TEXT DEFAULT 'USD',
                category    TEXT NOT NULL,
                description TEXT DEFAULT '',
                date        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS priorities (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                ref_id     TEXT NOT NULL,
                ref_type   TEXT NOT NULL,
                score      REAL NOT NULL,
                reason     TEXT DEFAULT '',
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.commit()


@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
