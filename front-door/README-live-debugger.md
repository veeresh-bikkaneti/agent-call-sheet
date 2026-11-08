# Live Debugger Library

Python client library for the Agent Call Sheet board server. Use it to send status lines, nudges, and interventions from your agents.

## Install

```python
# Just copy live_debugger.py to your project, or:
from live_debugger import LiveDebugger, InterventionClient
```

Standard library only — no dependencies.

## Quick Start

```python
from live_debugger import LiveDebugger

# Connect to local board server
dbg = LiveDebugger(
    run_file="crew-run.jsonl",
    server_url="http://127.0.0.1:8765"
)

# Start a run (creates run file if needed)
dbg.start_run("My Crew Run")

# Emit status lines
dbg.event(
    agent="Builder",
    task="Build login page",
    phase="BUILD",
    status="running",
    artifact="login.py"
)

# Nudge a silent agent
dbg.nudge(agent="Builder", message="Status?")

# End the run
dbg.end_run()
```

## Classes

### LiveDebugger

High-level coordinator: writes to local JSONL **and** posts to board server.

```python
LiveDebugger(run_file: str, server_url: str = "http://127.0.0.1:8765")
```

**Methods:**

| Method | Description |
|--------|-------------|
| `start_run(run_id: str)` | Initialize run file, write header |
| `event(agent, task, phase, status, artifact, **kwargs)` | Emit status line (local + server) |
| `nudge(agent: str, message: str)` | Send nudge to silent agent |
| `intervene(action: str, **kwargs)` | Pause/redirect/reassign/stop_run |
| `end_run()` | Finalize run file |

**Event kwargs (optional):**
- `say`, `waiting_on`, `blocked_by` (strings)
- `cost` (number), `cost_unit` (string) — v3.3

### InterventionClient

Low-level HTTP client for direct server calls.

```python
InterventionClient(base_url: str = "http://127.0.0.1:8765", token: str = None)
```

**Methods:**

| Method | Description |
|--------|-------------|
| `post_event(line: dict)` | POST `/events` |
| `post_nudge(agent: str, message: str, from_: str = "owner")` | POST `/nudge` |
| `post_intervention(action: str, **kwargs)` | POST `/intervene` |

**Intervention actions:**
- `pause` — `agent` required
- `resume` — `agent` required
- `redirect` — `agent`, `new_task`, `new_phase?`
- `reassign` — `from_agent`, `to_agent`, `task`
- `stop_run` — `reason?`

## Authentication

If server has `BOARD_AUTH=1`, pass token:

```python
dbg = LiveDebugger(run_file="x", server_url="http://host:8765", token="mysecret")
# or
client = InterventionClient("http://host:8765", token="mysecret")
```

Adds `Authorization: Bearer mysecret` header.

## Rate Limiting

Server enforces **60 req/min + 10 burst**. Client does not retry — handle `429` yourself:

```python
try:
    dbg.event(...)
except Exception as e:
    if "429" in str(e):
        # back off and retry
```

## Error Handling

All methods raise on:
- Network errors
- HTTP 4xx/5xx (includes server error body)
- Invalid JSON responses

Wrap calls in try/except for production use.

## Integration Example

```python
# In your agent code
from live_debugger import LiveDebugger

class MyAgent:
    def __init__(self, name, run_file="crew-run.jsonl"):
        self.dbg = LiveDebugger(run_file=run_file)
        self.name = name
    
    def start_task(self, task, phase="BUILD"):
        self.dbg.event(
            agent=self.name,
            task=task,
            phase=phase,
            status="running",
            artifact=f"{task}.py"
        )
    
    def complete_task(self, task, output):
        self.dbg.event(
            agent=self.name,
            task=task,
            phase="BUILD",
            status="done",
            artifact=output,
            cost=0.02,
            cost_unit="USD"
        )
    
    def block(self, task, reason):
        self.dbg.event(
            agent=self.name,
            task=task,
            phase="BUILD",
            status="blocked",
            artifact="",
            waiting_on=reason
        )
```

## Security

- **No auth by default** — pass `token` if server requires it
- **Rate limited** — server returns 429, client does not auto-retry
- **Standard library only** — no supply chain risk

## Files

- `live_debugger.py` — this library
- `board_server.py` — server it talks to
- `board.html` — dashboard
- `README-board-server.md` — server docs
