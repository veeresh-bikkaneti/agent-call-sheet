# Board Server

Live dashboard server for Agent Call Sheet crew runs. Serves `board.html` with real-time SSE updates, accepts status/nudge/intervention lines via POST.

## Quick Start

```bash
# With sample data (no crew running)
python3 front-door/board_server.py --run-file front-door/sample-run.jsonl

# With a real crew run file
python3 front-door/board_server.py --run-file crew-run.jsonl
```

Then open `http://127.0.0.1:8765/` in your browser.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--run-file` | *required* | JSONL file to serve and append to |
| `--port` | `8765` | Port to listen on |
| `--host` | `127.0.0.1` | Host to bind (use `0.0.0.0` to expose beyond localhost) |
| `--silence` | `120` | Seconds before agent holding claim counts as silent |
| `--extra-run` | *(repeatable)* | Additional run files under `/runs/<name>` |
| `--board-dir` | *script folder* | Folder holding `board.html` |

## Authentication

**Disabled by default** (trusted network only). Enable Bearer token:

```bash
BOARD_AUTH=1 BOARD_AUTH_TOKEN=mysecret python3 board_server.py --run-file crew-run.jsonl
```

Then include header: `Authorization: Bearer mysecret` on all POST requests.

## Rate Limiting

Token bucket: **60 requests/minute + 10 burst** on write endpoints (`/events`, `/nudge`, `/intervene`). Returns `429` with `Retry-After` header.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` or `/board.html` | Dashboard (injected with server config) |
| GET | `/state` | Folded run state (all agents, silence, claims) |
| GET | `/stream` | SSE stream of appended lines |
| GET | `/sample-run.jsonl` | Bundled sample run |
| GET | `/real-run.jsonl` | Bundled real run |
| GET | `/runs/<name>` | Extra run files via `--extra-run` |
| POST | `/events` | Append status/heartbeat line |
| POST | `/nudge` | Send nudge to silent agent |
| POST | `/intervene` | Pause/redirect/reassign/stop_run |

## Status Contract (v3.3)

Every status line requires:
```json
{
  "agent": "string",
  "task": "string",
  "phase": "BRIEF|DEBATE|DECIDE|DESIGN|BUILD|GATE|SHIP|RETRO|REPORT",
  "status": "running|done|blocked",
  "artifact": "string",
  "say": "string?",           // optional
  "waiting_on": "string?",     // optional
  "blocked_by": "string?",     // optional
  "cost": "number?",           // optional (v3.3)
  "cost_unit": "string?"       // optional (v3.3)
}
```

## Nudge

```json
{ "type": "nudge", "agent": "Builder", "message": "Status?" }
```

## Intervention

```json
{ "type": "intervention", "action": "pause", "agent": "Builder" }
{ "type": "intervention", "action": "redirect", "agent": "Builder", "new_task": "Fix bug", "new_phase": "BUILD" }
{ "type": "intervention", "action": "reassign", "from_agent": "A", "to_agent": "B", "task": "X" }
{ "type": "intervention", "action": "stop_run", "reason": "Budget exceeded" }
```

## Security Notes

- **No auth by default** — only run on trusted network/tailnet
- **Enable auth** (`BOARD_AUTH=1`) when exposing beyond localhost
- **Rate limited** — prevents accidental DoS
- **Host header validation** — blocks DNS rebinding on loopback
- **Origin/CSRF checks** — cross-origin writes rejected
- **Content-Type enforcement** — must be `application/json`
- **Body size limit** — 64KB max
- **JSON depth/key limits** — prevents parser attacks
- **CSP nosniff** — on all responses
- **SSE long-lived** — request timeout cleared for streams

## Demo Mode

Open `board.html` directly in browser (no server). Click **"Demo Mode"** button to try Nudge/Intervention panels with simulated server connection.

## Files

- `board_server.py` — this server
- `board.html` — dashboard (single file, no build)
- `sample-run.jsonl` / `real-run.jsonl` — bundled runs
- `live_debugger.py` — Python client library
