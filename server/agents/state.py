from __future__ import annotations

from typing import Annotated, TypedDict

from langgraph.graph.message import add_messages


class HiveState(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: str
    intent: str
    tool_results: list
    response: str
