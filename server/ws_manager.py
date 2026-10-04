from typing import Dict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[user_id] = websocket

    def disconnect(self, user_id: str) -> None:
        self.active.pop(user_id, None)

    async def send_to(self, user_id: str, data: dict) -> None:
        websocket = self.active.get(user_id)
        if websocket is None:
            return
        try:
            await websocket.send_json(data)
        except Exception:
            self.disconnect(user_id)

    async def broadcast(self, data: dict) -> None:
        failed = []
        for user_id, websocket in list(self.active.items()):
            try:
                await websocket.send_json(data)
            except Exception:
                failed.append(user_id)
        for user_id in failed:
            self.disconnect(user_id)


manager = ConnectionManager()
