"""LangGraph orchestrator for the Hive assistant.

Graph flow:
  classify_intent (keyword, no LLM call)  →  [planner | expense | priority | sync | general]  →  END
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph

from .state import HiveState
from .tools import (
    check_conflicts,
    create_event,
    delete_event,
    get_all_users,
    get_budget_summary,
    get_events,
    get_expenses,
    get_open_tasks,
    log_expense,
    save_priorities,
    share_event,
)

# ---------------------------------------------------------------------------
# Shared LLM singleton
# ---------------------------------------------------------------------------

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "hive-fast")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

llm = ChatOllama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL, num_ctx=2048)

# ---------------------------------------------------------------------------
# Tool groups
# ---------------------------------------------------------------------------

PLANNER_TOOLS = [get_events, create_event, delete_event, check_conflicts]
EXPENSE_TOOLS = [log_expense, get_expenses, get_budget_summary]
PRIORITY_TOOLS = [get_open_tasks, save_priorities]
SYNC_TOOLS = [get_all_users, share_event]

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPTS: dict[str, str] = {
    "planner": (
        "You are a scheduling assistant. Use tools to manage events. "
        "Always check for conflicts before creating. Be concise."
    ),
    "expense": (
        "You are an expense tracker. Use tools to log and analyze spending. "
        "Infer category from description if not given. Be concise."
    ),
    "priority": (
        "You are a priority assistant. Fetch open tasks and rank them by urgency, "
        "deadline proximity, and importance. Return a clear ranked list."
    ),
    "sync": (
        "You are a sync assistant. Help users share events with others. "
        "Resolve names to user IDs using get_all_users tool."
    ),
    "general": "You are Hive, a helpful personal assistant. Be concise and friendly.",
}

# ---------------------------------------------------------------------------
# Helper: run LLM with tool-call loop
# ---------------------------------------------------------------------------


async def run_with_tools(
    messages: list,
    tools: list,
    system_prompt: str,
) -> tuple[str, list]:
    """Invoke the LLM with *tools* bound, handling tool-call rounds (max 5).

    Returns (final_text_response, list_of_tool_result_dicts).
    """
    tool_map = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    full_messages: list[Any] = [SystemMessage(content=system_prompt)] + list(messages)
    collected_tool_results: list[dict] = []

    for _ in range(5):
        response: AIMessage = await llm_with_tools.ainvoke(full_messages)
        full_messages.append(response)

        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            break

        for tc in tool_calls:
            tool_name: str = tc["name"]
            tool_args: dict = tc["args"]
            tool_id: str = tc.get("id", "")

            if tool_name in tool_map:
                try:
                    result = await tool_map[tool_name].ainvoke(tool_args)
                    collected_tool_results.append(
                        {"tool": tool_name, "args": tool_args, "result": result}
                    )
                    result_text = (
                        json.dumps(result, default=str)
                        if not isinstance(result, str)
                        else result
                    )
                    full_messages.append(
                        ToolMessage(content=result_text, tool_call_id=tool_id)
                    )
                except Exception as exc:
                    full_messages.append(
                        ToolMessage(
                            content=f"Tool error: {exc}", tool_call_id=tool_id
                        )
                    )
            else:
                full_messages.append(
                    ToolMessage(
                        content=f"Unknown tool: {tool_name}", tool_call_id=tool_id
                    )
                )

    # Extract final text from the last message
    last = full_messages[-1]
    content = getattr(last, "content", "") or ""
    if not content:
        content = "I've processed your request."
    return str(content), collected_tool_results


# ---------------------------------------------------------------------------
# Keyword intent classifier — zero latency, no LLM call
# ---------------------------------------------------------------------------

_INTENT_KEYWORDS: dict[str, list[str]] = {
    "expense": [
        "spent", "spend", "expense", "paid", "pay", "cost", "bought", "buy",
        "money", "budget", "₹", "rs ", "rupee", "bill", "fee", "price",
        "purchase", "receipt", "transaction", "cash", "debit", "credit",
    ],
    "schedule": [
        "schedule", "event", "meeting", "appointment", "remind", "calendar",
        "tomorrow", "today at", "book", "add to", "plan for", "cancel",
        "reschedule", "at am", "at pm", "session", "call at", "standup",
    ],
    "priority": [
        "priority", "priorities", "focus", "important", "urgent",
        "what should i", "what to do", "my day", "day look",
        "most critical", "rank", "top task",
    ],
    "share": [
        "share", "send to", "tell ", "notify", "invite",
    ],
}


def _keyword_classify(message: str) -> str:
    """Classify intent using keyword matching. Runs in microseconds."""
    msg = message.lower()
    for intent, keywords in _INTENT_KEYWORDS.items():
        if any(kw in msg for kw in keywords):
            return intent
    return "general"


# ---------------------------------------------------------------------------
# LangGraph nodes
# ---------------------------------------------------------------------------


async def classify_intent(state: HiveState) -> dict:
    """Classify user intent via keyword matching — no LLM call."""
    msgs = state.get("messages", [])
    last_content = msgs[-1].content if msgs else ""
    return {"intent": _keyword_classify(last_content)}


def _system(intent: str, user_id: str) -> str:
    """Build a system prompt that includes the caller's user_id and today's date
    so the LLM uses the correct values for tool calls without guessing."""
    today = datetime.now(timezone.utc).date().isoformat()
    return (
        SYSTEM_PROMPTS[intent]
        + f"\n\nCurrent user_id (use this exact value for every tool call): {user_id}"
        + f"\nToday's date (UTC): {today} — use this when the user says 'today', 'now', etc."
    )


async def planner_node(state: HiveState) -> dict:
    response, tool_results = await run_with_tools(
        state["messages"], PLANNER_TOOLS, _system("planner", state["user_id"])
    )
    return {"response": response, "tool_results": tool_results}


async def expense_node(state: HiveState) -> dict:
    response, tool_results = await run_with_tools(
        state["messages"], EXPENSE_TOOLS, _system("expense", state["user_id"])
    )
    return {"response": response, "tool_results": tool_results}


async def priority_node(state: HiveState) -> dict:
    response, tool_results = await run_with_tools(
        state["messages"], PRIORITY_TOOLS, _system("priority", state["user_id"])
    )
    return {"response": response, "tool_results": tool_results}


async def sync_node(state: HiveState) -> dict:
    response, tool_results = await run_with_tools(
        state["messages"], SYNC_TOOLS, _system("sync", state["user_id"])
    )
    return {"response": response, "tool_results": tool_results}


async def general_node(state: HiveState) -> dict:
    full_messages = [SystemMessage(content=SYSTEM_PROMPTS["general"])] + list(
        state["messages"]
    )
    response: AIMessage = await llm.ainvoke(full_messages)
    return {"response": response.content or "", "tool_results": []}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def route_intent(state: HiveState) -> str:
    mapping = {
        "schedule": "planner",
        "expense": "expense",
        "priority": "priority",
        "share": "sync",
        "general": "general",
    }
    return mapping.get(state.get("intent", "general"), "general")


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------


def build_graph():
    graph = StateGraph(HiveState)

    graph.add_node("classify", classify_intent)
    graph.add_node("planner", planner_node)
    graph.add_node("expense", expense_node)
    graph.add_node("priority", priority_node)
    graph.add_node("sync", sync_node)
    graph.add_node("general", general_node)

    graph.set_entry_point("classify")

    graph.add_conditional_edges(
        "classify",
        route_intent,
        {
            "planner": "planner",
            "expense": "expense",
            "priority": "priority",
            "sync": "sync",
            "general": "general",
        },
    )

    for node_name in ("planner", "expense", "priority", "sync", "general"):
        graph.add_edge(node_name, END)

    return graph.compile()


# Singleton compiled graph — built at import time (no I/O happens here)
hive_graph = build_graph()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def run_agent(
    message: str, user_id: str, history: list
) -> tuple[str, list]:
    """Run the Hive agent for a given *message* and return (response_text, tool_results).

    *history* is a list of dicts with keys 'role' ('user' | 'assistant') and 'content'.
    """
    lc_messages: list = []
    for h in history:
        if h.get("role") == "user":
            lc_messages.append(HumanMessage(content=h["content"]))
        elif h.get("role") == "assistant":
            lc_messages.append(AIMessage(content=h["content"]))

    lc_messages.append(HumanMessage(content=message))

    initial_state: dict = {
        "messages": lc_messages,
        "user_id": user_id,
        "intent": "",
        "tool_results": [],
        "response": "",
    }

    try:
        result = await hive_graph.ainvoke(initial_state)
        return result.get("response", ""), result.get("tool_results", [])
    except Exception as exc:
        return (
            f"I'm having trouble processing your request right now. ({exc})",
            [],
        )
