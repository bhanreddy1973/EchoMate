# EchoMate

A personalized, real-time voice-powered Daily Life Companion and Memory Assistant built on LiveKit Agents.

---

## Overview

EchoMate is a modular, event-driven voice agent that:

- Hears you via **Deepgram** ASR and responds via **Cartesia** TTS
- Routes queries to the best **free LLM** (NVIDIA NIM / OpenRouter) based on complexity
- Remembers facts across sessions using **Chroma** vector DB + LlamaIndex RAG
- Integrates external tools via the **Model Context Protocol (MCP)**
- Tracks tasks, reminders, habits, and delivers morning briefings / evening reflections
- Exposes a React + LiveKit frontend for browser-based interaction

```
Architecture:

Browser (React + LiveKit SDK)
        │
        ▼
LiveKit Server ─────► EchoMate Agent (Python)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
          Deepgram ASR   Model Router    Cartesia TTS
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               NVIDIA NIM  OpenRouter  Memory
               (Nemotron)  (free tier) (Chroma/STM)
                                        │
                                    MCP Tools
                                 (weather/calendar/web)
```

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| Git | any |

### System dependencies

- On macOS: `brew install portaudio` (for audio I/O)
- On Ubuntu/Debian: `apt-get install portaudio19-dev`

---

## Quick Start

```bash
# 1. Clone and set up
git clone <repo-url> echomate && cd echomate
make setup

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys (see "API Keys" section below)

# 3. Start the agent
make dev

# 4. Start the frontend (Next.js spatial dashboard)
cd app && npm install && npm run dev
```

Visit `http://localhost:3000` in your browser.

> **Note:** The `frontend/` directory contains a legacy Vite prototype. The primary UI is `app/` (Next.js).

### Verify startup

The agent prints `EchoMate components initialised successfully` on successful startup. If any required API key is missing, a `ValidationError` is raised listing the missing fields before the agent starts.

---

## API Keys

EchoMate uses free-tier providers wherever possible:

| Variable | Provider | Where to get it |
|----------|----------|-----------------|
| `LIVEKIT_URL` | LiveKit | [LiveKit Cloud](https://cloud.livekit.io) |
| `LIVEKIT_API_KEY` | LiveKit | LiveKit Cloud dashboard |
| `LIVEKIT_API_SECRET` | LiveKit | LiveKit Cloud dashboard |
| `DEEPGRAM_API_KEY` | Deepgram | [Deepgram Console](https://console.deepgram.com) — free tier available |
| `CARTESIA_API_KEY` | Cartesia | [Cartesia](https://play.cartesia.ai) — free credits |
| `NVIDIA_NIM_API_KEY` | NVIDIA NIM | [build.nvidia.com](https://build.nvidia.com) — free tier |
| `OPENROUTER_API_KEY` | OpenRouter | [openrouter.ai](https://openrouter.ai/keys) — free models available |

At least one of `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` is required.

---

## Model Router

The router picks the cheapest/fastest model appropriate for each query:

```
Query → Classify complexity → Filter by tier → Sort by priority/health → LiteLLM call
                                                                               │
                                                                     Fallback chain (max 3)
                                                                     on error or 5s timeout
```

### Tiers

| Tier | Models | Used for |
|------|--------|----------|
| `fast` | `nvidia_nim/llama-3.1-nemotron-nano-8b-v1` | Greetings, confirmations, < 20 tokens |
| `reasoning` | `openrouter/meta-llama/llama-3.2-3b-instruct:free` | Multi-step, analysis, synthesis |

### Adding new endpoints

Edit the `_MODEL_REGISTRY` list in `echomate/model_router.py`:

```python
ModelEndpoint(
    name="my-model",
    provider="openrouter_free",        # or "nvidia_nim"
    model_id="openrouter/org/model",   # LiteLLM ID
    tier="fast",
    priority=5,                        # lower = tried first
)
```

---

## MCP Server Configuration

MCP servers are defined in `mcp_servers.json`. Each entry must have:

```json
{
  "servers": [
    {
      "name": "weather",
      "command": "uvx",
      "args": ["mcp-server-weather"],
      "env": {
        "WEATHER_API_KEY": "${WEATHER_API_KEY}"
      }
    }
  ]
}
```

Environment variable expansion (`${VAR}`) is supported in `env` fields.

To verify a server is connected, check startup logs for:
`MCP server 'weather' connected with N tools`.

---

## Memory System

| Layer | Backend | Scope |
|-------|---------|-------|
| Short-term | In-memory sliding window | Current session (4000 tokens) |
| Long-term | Chroma + LlamaIndex RAG | Persistent across sessions |

Long-term memory is stored in `./data/chroma/` (configurable via `CHROMA_PERSIST_DIR`). If Chroma is unavailable, the agent continues with short-term memory only.

---

## Skills Management

```bash
# Clone LiveKit agent skills
make setup

# Pull latest from all skill repos
make refresh-skills
```

Skills are tracked in `.agents/skills/skills-manifest.json`. To add a new skill repo:

```json
{
  "name": "my-skills",
  "url": "https://github.com/org/my-skills.git",
  "local_path": ".agents/skills/my-skills",
  "last_updated": null
}
```

---

## Development

```bash
make test           # Run Python tests
make test-frontend  # Run React component tests
make lint           # Ruff linting
make typecheck      # mypy type checking
```

---

## Deployment

EchoMate runs as a LiveKit worker:

```bash
# Production
python agent.py start

# Required environment variables (all from .env)
LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
DEEPGRAM_API_KEY, CARTESIA_API_KEY
NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY
```

Use a process manager (systemd, supervisord, PM2) to keep the worker running. The agent handles reconnection automatically.
