# Hive — A Local AI Life Assistant for My Family, Running on a Raspberry Pi

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

---

## What I Built

**Hive** is a private, multi-user AI life assistant that runs entirely on a Raspberry Pi 4B — no cloud, no subscriptions, no data leaving your home network.

I built it for my family. We needed a shared space to manage our week: upcoming events, daily expenses, and a clear picture of what actually matters each day. Every existing tool either costs money every month, sends your data somewhere, or needs a good internet connection. Hive does none of those things — it lives on a Pi on the shelf and is accessible from any phone on the home Wi-Fi.

**What it does:**
- 💬 **AI Chat** — talk naturally: "I spent ₹150 on paav bhaji" or "Schedule a gym session tomorrow at 7am" — Hive routes your message to the right agent and writes to the database
- 📅 **Event Planner** — add, view, and delete calendar events; the AI checks for conflicts automatically
- 💸 **Expense Tracker** — log spending by category with a monthly budget summary and INR formatting; export to JSON or CSV
- 🎯 **Priority Ranking** — AI scores your upcoming events and expenses by urgency so you always know what to focus on
- 🎙️ **Voice Input** — speak instead of type, transcribed locally by OpenAI Whisper (no audio leaves the Pi)
- 🌅 **Morning Briefings** — the Pi pushes a daily summary to all connected users via WebSocket at a scheduled time
- 📱 **Multi-user, multi-device** — family members register by name + PIN, each has their own data, accessible from any phone on the same Wi-Fi

---

## Demo

> The app runs on a Raspberry Pi 4B (8 GB) on the local network. Any device on the same Wi-Fi opens `http://<pi-ip>:8000` to get the full PWA.

<!-- Add a video link or screenshot here once deployed -->

---

## Code

<!-- GitHub repo embed -->

Key file structure:

```
hive/
├── server/
│   ├── main.py              # FastAPI app, WebSocket, SPA routing
│   ├── agents/
│   │   ├── orchestrator.py  # LangGraph StateGraph — keyword classify → route → tool-call loop
│   │   ├── tools.py         # LangChain tools: create_event, log_expense, get_open_tasks, ...
│   │   └── state.py         # HiveState TypedDict
│   ├── routers/
│   │   ├── auth_router.py   # Register / login by name+PIN, JWT issue
│   │   ├── chat.py          # POST /chat — SSE streaming, history fetch, message persist
│   │   ├── events.py        # CRUD /events
│   │   ├── expenses.py      # CRUD /expenses + budget summary
│   │   ├── priorities.py    # GET + POST /refresh — LLM priority scoring
│   │   └── voice.py         # POST /voice — Whisper transcription
│   └── database.py          # aiosqlite, 6-table schema, single DB_PATH
├── client/                  # React 19 + Vite + Tailwind CSS PWA
└── setup/
    ├── install_pi.sh        # One-shot Pi setup: apt, Ollama, venv, Node, systemd
    └── Modelfile            # hive-fast: gemma2:2b + tuned context/temperature/stop
```

---

## How I Built It

### Open-source AI stack

| Layer | Technology |
|-------|-----------|
| LLM runtime | [Ollama](https://ollama.com/) — runs `hive-fast`, a custom build of [Gemma 2 2B](https://ai.google.dev/gemma) (Google's open-weight model) |
| Agent framework | [LangGraph 0.2](https://github.com/langchain-ai/langgraph) — `StateGraph` with non-deterministic routing |
| LLM library | [LangChain / langchain-ollama](https://github.com/langchain-ai/langchain) |
| Voice transcription | [OpenAI Whisper](https://github.com/openai/whisper) `base.en` — runs locally, no API key |
| Backend | [FastAPI](https://fastapi.tiangolo.com/) with SSE streaming and WebSocket |
| Database | SQLite via [aiosqlite](https://github.com/omnilib/aiosqlite) |
| Frontend | React 19, Vite, Tailwind CSS |

### Agent architecture

The core insight is a **keyword intent classifier** in front of the LangGraph router. Instead of running a second LLM inference to classify intent (which added 4–7 s per request), a simple keyword scan routes messages in microseconds:

```python
_INTENT_KEYWORDS = {
    "expense": ["spent", "pay", "₹", "rs ", "cost", "bill", ...],
    "schedule": ["schedule", "meeting", "remind", "tomorrow", ...],
    "priority": ["priority", "focus", "what should i", ...],
    "share":    ["share", "send to", "notify", ...],
}

def _keyword_classify(message: str) -> str:
    msg = message.lower()
    for intent, keywords in _INTENT_KEYWORDS.items():
        if any(kw in msg for kw in keywords):
            return intent
    return "general"
```

Once classified, LangGraph routes to the matching node (`planner_node`, `expense_node`, etc.), which binds the appropriate tools and runs a tool-call loop (up to 5 rounds). The LLM's system prompt always includes the caller's `user_id` so every tool call writes to the right user's data.

### Performance on Pi

The `hive-fast` Modelfile tunes Gemma 2 2B with `num_ctx 2048`, `num_thread 4`, `temperature 0.2` — responses arrive in **2–4 s** on the Pi's ARM Cortex-A72 CPU. A keyword intent classifier (zero LLM call) routes messages before the model is ever invoked, cutting out the extra 4–7 s that a second "classify intent" LLM call would cost.

### Voice pipeline

Whisper's `base.en` model runs as a subprocess via `openai-whisper` (not `faster-whisper`, which has a C extension that fails to build on Python 3.13 + aarch64 + FFmpeg 6.x). Audio is uploaded as WebM, converted by ffmpeg, and transcribed in ~2 s.

---

## Why Does Open Innovation Matter?

A closed API version of this — GPT-4o + a hosted database — would cost money every month and would mean every family member's schedule, spending habits, and daily priorities live on someone else's server.

Open weights made it possible to run a capable model on a ₹7,000 single-board computer that sits on a shelf and consumes 5–8 W. The entire stack — model weights, inference runtime, agent framework, voice transcription — is open source. That means:

- **Privacy**: no data leaves the home network. Ever.
- **Cost**: the only ongoing cost is electricity (~₹20/month).
- **Longevity**: no API key to rotate, no service to deprecate, no pricing change to break the family's workflow.
- **Customizability**: the `Modelfile` lets us tune the model's personality, context size, and stop tokens without touching the inference server.

Open innovation didn't just make this cheaper — it made it possible to exist at all for a family that values its privacy.

---

## My Agent Session

*Built with [Claude Code](https://claude.com/claude-code) — iterative development over multiple sessions: architecture → scaffolding → Pi deployment → bug fixes → performance tuning.*

---

## Prize Categories

**Gemma — Best Use of Gemma**

Hive runs **Gemma 2 2B** as its core reasoning model — fully locally on a Raspberry Pi 4B, with no cloud calls, no API key, and no data leaving the home network.

The model is loaded via [Ollama](https://ollama.com/) and wrapped in a custom `Modelfile` (`hive-fast`) that tunes it for the Pi's constraints:

```
FROM gemma2:2b
PARAMETER num_ctx 2048     # fits chat history + tool responses
PARAMETER num_thread 4     # all 4 Pi CPU cores
PARAMETER temperature 0.2  # decisive, low-variance answers
PARAMETER repeat_penalty 1.1
PARAMETER stop "<end_of_turn>"
```

Gemma 2 2B handles all three AI tasks in Hive:
- **Agentic tool calls** — understands the user's natural-language request and calls the right tool (`log_expense`, `create_event`, `get_open_tasks`, …) with correct arguments
- **Priority scoring** — reads a JSON list of upcoming events and expenses, scores each 0–1 by urgency and deadline proximity
- **General conversation** — answers follow-up questions and summarises the day

The keyword classifier routes intent in 0 ms so Gemma only runs once per request. On Pi 4B (ARM Cortex-A72, 4 cores, 8 GB), first-token latency is **2–4 s** — fast enough for a family assistant that people actually use throughout the day.
