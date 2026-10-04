# Hive

A local AI life assistant for friends. Runs on a Raspberry Pi. No cloud, no subscriptions.

**Features:** AI chat · Event planner · Expense tracker · Priority ranking · Voice input · Morning briefings · Real-time sync across phones

---

## Quick Start (Local Dev — Windows/Mac)

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.com) installed and running

### 1. Pull the model

```bash
ollama pull qwen2.5:3b
```

### 2. Start the backend

```bash
cd hive/server
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# From the hive/ parent directory:
cd ..
uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the frontend

```bash
cd hive/client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deploy to Raspberry Pi

```bash
# On the Pi (SSH in first)
git clone <your-repo> hive
cd hive
bash setup/install_pi.sh
```

The script installs Ollama, pulls the model, creates a Python venv, builds the React app, and registers a systemd service that starts on boot.

After setup, every device on the same WiFi can open `http://<pi-ip>:8000`.

---

## Project Structure

```
hive/
├── server/                   # FastAPI backend
│   ├── main.py               # App entry point, WebSocket endpoint
│   ├── database.py           # SQLite init + helpers
│   ├── models.py             # Pydantic schemas
│   ├── auth.py               # PIN hashing + JWT
│   ├── ws_manager.py         # WebSocket connection manager
│   ├── scheduler.py          # Morning briefing cron (APScheduler)
│   ├── agents/
│   │   ├── state.py          # LangGraph state definition
│   │   ├── tools.py          # All agent tools (DB reads/writes)
│   │   └── orchestrator.py   # LangGraph graph + run_agent()
│   └── routers/
│       ├── auth_router.py    # /auth/register, /auth/login, /auth/me
│       ├── chat.py           # POST /chat (SSE streaming)
│       ├── events.py         # CRUD /events
│       ├── expenses.py       # CRUD /expenses
│       ├── priorities.py     # GET + refresh /priorities
│       ├── voice.py          # POST /voice (Whisper transcription)
│       └── export.py         # GET /export/json|csv
│
├── client/                   # React 19 + Vite + Tailwind frontend
│   ├── src/
│   │   ├── config.js         # API_BASE, WS_BASE constants
│   │   ├── api.js            # All API calls in one place
│   │   ├── store/
│   │   │   └── authContext.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   ├── useVoice.js
│   │   │   └── useStreamingChat.js
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── MessageBubble.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Chat.jsx
│   │       ├── Planner.jsx
│   │       ├── Expenses.jsx
│   │       └── Priorities.jsx
│   └── public/manifest.json  # PWA manifest
│
├── setup/
│   └── install_pi.sh         # One-command Pi setup
├── .env.example              # Copy to .env before running
├── .gitignore
├── DESIGN.md                 # Full design document
└── IDEA.md                   # Original idea + evaluation
```

---

## Environment Variables

Copy `.env.example` to `.env` and update:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | (change this) | JWT signing secret |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model to use |
| `BRIEFING_HOUR` | `8` | Hour for morning briefing |
| `VITE_API_BASE` | `http://localhost:8000` | Backend URL (client) |
| `VITE_WS_BASE` | `ws://localhost:8000` | WebSocket URL (client) |

For phone access on local network, set `VITE_API_BASE` and `VITE_WS_BASE` to your Pi's IP address.

---

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create user with name + PIN |
| POST | `/auth/login` | Get JWT token |
| POST | `/chat` | AI chat (SSE streaming response) |
| POST | `/voice` | Transcribe audio → text |
| GET | `/events/{userId}` | List events |
| POST | `/events` | Create event |
| GET | `/expenses/{userId}` | List expenses + budget summary |
| POST | `/expenses` | Log expense |
| GET | `/priorities/{userId}` | Ranked task list |
| WS | `/ws/{userId}?token=` | Real-time sync |
| GET | `/export/json/{userId}` | Export all data |
| GET | `/export/csv/{userId}` | Export expenses as CSV |

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Ollama + qwen2.5:3b-instruct-q4_K_M |
| Agents | LangGraph 0.2 |
| Backend | FastAPI + aiosqlite + APScheduler |
| Auth | bcrypt + JWT (python-jose) |
| Voice | faster-whisper (base.en) |
| Frontend | React 19 + Vite + Tailwind CSS |
| Real-time | WebSocket (FastAPI native) |
| Database | SQLite |
| Remote access | Tailscale (optional) |

---

## Running on Raspberry Pi 4B (8GB)

The 8GB model has plenty of headroom:

| Component | RAM Usage |
|---|---|
| qwen2.5:3b-q4_K_M | ~2.0 GB |
| FastAPI + LangGraph | ~200 MB |
| faster-whisper base.en | ~150 MB |
| OS + headroom | ~1 GB |
| **Total** | **~3.4 GB** |

Expected response time: 4-7 seconds for typical queries. Tokens stream from second 2, so the UI feels responsive.

---

*Hacktoberfest 2026 — Build for a Friend*
