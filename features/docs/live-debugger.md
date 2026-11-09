# Live Collaboration Debugger

The **Live Collaboration Debugger** lets you watch agent crews run in real time, send nudges to silent agents, and intervene mid-run when things go off track.

---

## Quick Start

```bash
# Terminal 1: Start the board server
python3 front-door/board_server.py --run-file crew-run.jsonl --port 8765

# Terminal 2: Test the API
curl http://127.0.0.1:8765/state
```

Open `http://127.0.0.1:8765/` in your browser to see the live dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Agent Crew                          │
│  (writes JSONL status lines to crew-run.jsonl)             │
└─────────────────────────┬───────────────────────────────────┘
                          │ file watch (polling)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 board_server.py                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /state      │  │ /events     │  │ /stream (SSE)       │ │
│  │ full state  │  │ append line │  │ real-time updates   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /nudge      │  │ /intervene  │  │ Rate Limiter        │ │
│  │ wake agent  │  │ pause,      │  │ 60 req/min + 10     │ │
│  │             │  │ redirect,   │  │ burst, 429 on       │ │
│  │             │  │ reassign,   │  │ limit exceeded      │ │
│  │             │  │ stop_run    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ SSE broadcast
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      board.html                             │
│  • Live agent cards with status badges                      │
│  • Nudge button per agent                                   │
│  • Intervention panel (pause, redirect, reassign, stop)     │
│  • Demo Mode: works without server                          │
└─────────────────────────────────────────────────────────────┘
```

---

## API Reference

### `GET /state`

Returns the complete current state as JSON.

```bash
curl http://127.0.0.1:8765/state
```

**Response:**
```json
{
  "run_id": "abc123",
  "run_title": "My Crew Run",
  "started_at": "2026-11-08T12:00:00Z",
  "ended_at": null,
  "agents": {
    "Builder": {
      "task": "Build widget",
      "phase": "BUILD",
      "status": "running",
      "artifact": "widget.py",
      "cost": 0.02,
      "cost_unit": "USD",
      "updated_at": "2026-11-08T12:05:00Z"
    }
  },
  "summary": {
    "total_agents": 1,
    "running": 1,
    "complete": 0,
    "hold": 0
  }
}
```

---

### `POST /events`

Append a status line to the run file. Called by agents (or the `LiveDebugger` library).

```bash
curl -X POST http://127.0.0.1:8765/events \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "Builder",
    "task": "Build widget",
    "phase": "BUILD",
    "status": "running",
    "artifact": "widget.py",
    "cost": 0.02,
    "cost_unit": "USD"
  }'
```

**Required fields:** `agent`, `task`, `phase`, `status`, `artifact`
**Optional fields:** `cost` (number), `cost_unit` (string, default "USD")

**Response:** `200 OK` with `{"ok": true}`

---

### `GET /stream` (Server-Sent Events)

Real-time updates. The board.html connects here for live updates.

```bash
curl http://127.0.0.1:8765/stream
```

**Event types:**
- `state` — Full state snapshot (sent on connect)
- `event` — Single status line appended
- `nudge` — Agent was nudged
- `intervention` — Intervention executed
- `heartbeat` — Every 15 seconds

---

### `POST /nudge`

Send a message to a silent/stalled agent.

```bash
curl -X POST http://127.0.0.1:8765/nudge \
  -H "Content-Type: application/json" \
  -d '{"agent": "Builder", "message": "Status update?"}'
```

**Fields:** `agent` (string, required), `message` (string, required)

**Response:** `200 OK` with `{"ok": true, "nudged": "Builder"}`

---

### `POST /intervene`

Execute a mid-run intervention. Five actions available:

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `pause` | Pause an agent | `agent` |
| `resume` | Resume a paused agent | `agent` |
| `redirect` | Change agent's task/phase | `agent`, `new_task`, `new_phase` |
| `reassign` | Move task to different agent | `agent`, `new_agent` |
| `stop_run` | End the entire run | (none) |

```bash
# Pause an agent
curl -X POST http://127.0.0.1:8765/intervene \
  -H "Content-Type: application/json" \
  -d '{"action": "pause", "agent": "Builder"}'

# Redirect to new task
curl -X POST http://127.0.0.1:8765/intervene \
  -H "Content-Type: application/json" \
  -d '{"action": "redirect", "agent": "Builder", "new_task": "Fix tests", "new_phase": "TEST"}'

# Reassign to another agent
curl -X POST http://127.0.0.1:8765/intervene \
  -H "Content-Type: application/json" \
  -d '{"action": "reassign", "agent": "Builder", "new_agent": "Reviewer"}'

# Stop the entire run
curl -X POST http://127.0.0.1:8765/intervene \
  -H "Content-Type: application/json" \
  -d '{"action": "stop_run"}'
```

**Response:** `200 OK` with intervention result

---

## Python Library: `live_debugger.py`

Use the `LiveDebugger` class from your agent code to emit status lines and send nudges programmatically.

### Installation

```python
# The library is in front-door/live_debugger.py
# Just copy it to your project or add front-door to PYTHONPATH
import sys
sys.path.insert(0, "front-door")
from live_debugger import LiveDebugger, InterventionClient
```

### LiveDebugger Class

```python
from live_debugger import LiveDebugger

dbg = LiveDebugger(
    run_file="crew-run.jsonl",
    server_url="http://127.0.0.1:8765",
    run_title="My Crew Run"
)

# Start the run (creates run file with header)
dbg.start_run()

# Emit a status event (v3.3 contract)
dbg.event(
    agent="Builder",
    task="Build widget",
    phase="BUILD",
    status="running",
    artifact="widget.py",
    cost=0.02,
    cost_unit="USD"
)

# Nudge a silent agent
dbg.nudge(agent="Builder", message="Still alive?")

# End the run
dbg.end_run()
```

**Methods:**
- `start_run(title)` — Initialize run file
- `event(agent, task, phase, status, artifact, cost=0, cost_unit="USD")` — Emit status
- `nudge(agent, message)` — Send nudge via server
- `end_run()` — Finalize run file

### InterventionClient Class

```python
from live_debugger import InterventionClient

client = InterventionClient("http://127.0.0.1:8765")

# Pause an agent
client.intervene("pause", agent="Builder")

# Redirect
client.intervene("redirect", agent="Builder", new_task="Fix tests", new_phase="TEST")

# Reassign
client.intervene("reassign", agent="Builder", new_agent="Reviewer")

# Stop run
client.intervene("stop_run")
```

---

## Board UI: `board.html`

Open `http://127.0.0.1:8765/` in a browser for the live dashboard.

### Features
- **Agent cards** — Live status, phase, task, cost
- **Nudge button** — Per-agent, sends wake-up message
- **Intervention panel** — Dropdown for pause/redirect/reassign/stop
- **Demo Mode** — Toggle to test UI without server (button in header)

### Demo Mode
Click "Demo Mode" in the header to populate the board with sample data and test nudges/interventions without a running server.

---

## Authentication (Optional)

Enable Bearer token auth:

```bash
BOARD_AUTH=1 BOARD_AUTH_TOKEN=mysecret python3 front-door/board_server.py --port 8765
```

Then include the token in requests:

```bash
curl -H "Authorization: Bearer mysecret" http://127.0.0.1:8765/state
```

**Note:** Without auth, the server is open. Only run on trusted networks (VPN, tailnet, localhost).

---

## Rate Limiting

All write endpoints (`/events`, `/nudge`, `/intervene`) are rate limited:
- **60 requests/minute** per IP
- **10 request burst** allowance
- Returns `429 Too Many Requests` with `Retry-After` header when exceeded

---

## File Format: `crew-run.jsonl`

Each line is a JSON object (v3.3 status contract):

```jsonl
{"run_id":"abc123","run_title":"My Run","started_at":"2026-11-08T12:00:00Z","ended_at":null}
{"agent":"Builder","task":"Build widget","phase":"BUILD","status":"running","artifact":"widget.py","cost":0.02,"cost_unit":"USD","updated_at":"2026-11-08T12:05:00Z"}
{"agent":"Builder","task":"Build widget","phase":"BUILD","status":"complete","artifact":"widget.py","cost":0.05,"cost_unit":"USD","updated_at":"2026-11-08T12:10:00Z"}
{"agent":"Reviewer","task":"Review widget","phase":"REVIEW","status":"running","artifact":"review.md","updated_at":"2026-11-08T12:11:00Z"}
```

**First line:** Run metadata (created by `LiveDebugger.start_run()`)
**Subsequent lines:** Agent status events

---

## Integration Example

```python
# In your agent code
import sys
sys.path.insert(0, "front-door")
from live_debugger import LiveDebugger

dbg = LiveDebugger(run_file="my-crew.jsonl", server_url="http://localhost:8765")
dbg.start_run("Feature Build")

# Agent does work...
dbg.event(agent="Planner", task="Design API", phase="PLAN", status="running", artifact="api.md")
# ...work happens...
dbg.event(agent="Planner", task="Design API", phase="PLAN", status="complete", artifact="api.md", cost=0.03)

# If agent goes silent, orchestrator can nudge
dbg.nudge(agent="Builder", message="Status?")

# On critical issue, intervene
from live_debugger import InterventionClient
client = InterventionClient("http://localhost:8765")
client.intervene("pause", agent="Builder")

dbg.end_run()
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Board shows no data | Check `crew-run.jsonl` exists and has valid JSONL |
| SSE disconnects | Board auto-reconnects; check server logs |
| 401 Unauthorized | Set `BOARD_AUTH_TOKEN` env var and include `Authorization: Bearer` header |
| 429 Rate Limited | Wait for `Retry-After` seconds; reduce request rate |
| Demo Mode not working | Ensure `board.html` loads from same origin as server (or use Demo Mode toggle) |

---

## Files

| File | Description |
|------|-------------|
| `front-door/board_server.py` | HTTP + SSE server |
| `front-door/live_debugger.py` | Python client library |
| `front-door/board.html` | Live dashboard UI |
| `front-door/README-board-server.md` | Server usage guide |
| `front-door/README-live-debugger.md` | Library usage guide |

---

## Security Notes

- **No auth by default** — Only run on trusted networks
- **SRI hashes** — All Three.js CDN loads have integrity hashes
- **CSP** — `require-sri-for script` enforced on deployed pages
- **Rate limiting** — Prevents abuse of write endpoints
- **No eval/innerHTML** — Board UI uses safe DOM APIs only