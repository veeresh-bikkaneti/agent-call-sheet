# Quick Start Guide — The Agent Call Sheet

*Get a working AI crew in 5 minutes. No jargon, no assumptions.*

---

## What Is This?

The Agent Call Sheet is a **toolkit for running AI agent crews** — think of it as a staging kit for a play where each actor is an AI agent with a specific role (Orchestrator, Reality Checker, Architect, etc.).

You get:
- **A visual dashboard** (`board.html`) — watch your crew work in real time
- **A one-command installer** (`bootstrap.py`) — sets up everything
- **Quality gates** — independent "reality checker" that catches hallucinations
- **Provenance tracking** — every file has a source, license, and SHA-256 hash

---

## Prerequisites

| Tool | Required? | Notes |
|------|-----------|-------|
| Python 3.11+ | **Yes** | Standard library only — no pip install needed |
| Git | **Yes** | For cloning the repo |
| A code editor | Recommended | VS Code, Cursor, or any editor |
| Access to an AI agent | **Yes** | Claude Code, Grok, or paste prompts manually |

---

## Step 1: Clone the Repo

```bash
git clone https://github.com/veeresh-bikkaneti/agent-call-sheet.git
cd agent-call-sheet
```

---

## Step 2: Minimal Install (Recommended for First Time)

Install **only the front door** — the crew orchestrator and starter prompt. This is 2 files instead of 151.

```bash
python3 bootstrap.py --minimal --dest ./my-skills
```

Output:
```
Target: claude-code
Destination: /home/you/my-skills
Plan: front door (2 files) + 0 included entries from packs:
front-door: installed (2 copied, 0 already identical)
Receipt: /home/you/my-skills/INSTALL-RECEIPT.json
Setup complete: 2 files copied, 0 already identical, 0 conflicts.
```

**What you got:**
```
my-skills/
├── crew-orchestrator/     # The conductor — coordinates multi-agent work
│   ├── SKILL.md
│   └── ...
└── starter-prompt.md      # The prompt to begin a crew session
```

---

## Step 3: Start Your First Crew

### Option A: Using Claude Code (Recommended)

1. Open the `my-skills` folder in VS Code with Claude Code extension
2. The `crew-orchestrator` skill auto-triggers when you mention "crew", "orchestrate", or "multi-agent"
3. Paste the content of `starter-prompt.md` into Claude Code
4. Follow the prompts — the orchestrator will ask for your target and spin up a crew

### Option B: Manual (Any AI Surface)

1. Open `starter-prompt.md` and copy its contents
2. Paste into your AI agent (Claude Web, Grok, etc.)
3. The prompt will guide you through:
   - Confirming your target
   - Selecting a crew template
   - Running the phases: Brief → Debate → Decide → Design → Build → Gate → Ship → Retro → Report

---

## Step 4: Watch the Crew on the Board

The **Crew Board** (`front-door/board.html`) shows your crew in action.

### Open the Board

```bash
# Just open it in your browser
open front-door/board.html
# or double-click the file
```

### Load a Run

1. Click **"Recorded real run"** or **"Sample data"** to see a demo
2. Or click **"Load a run-status file"** and pick a `.jsonl` file from a real run
3. Press **▶ Replay** to watch the crew work

### What You See

- **Characters** = agents (each has a color-coded tile)
- **Phases** = BRIEF, DESIGN, BUILD, GATE, etc. (colored chips)
- **Status** = running, waiting, blocked, done
- **Bubbles** = what the agent "said" in the run
- **Detail panel** (click any character) = task, artifact, waiting_on, blocked_by

---

## Step 5: Go Live (Real-Time Dashboard)

The board can stream **live** from a running crew via `board-server.py`.

### Start the Live Server

```bash
# In one terminal
python3 front-door/board-server.py --run-file crew-run.jsonl --port 8765
```

Output:
```
Board: http://127.0.0.1:8765/
Run file: /path/to/crew-run.jsonl
No authentication — run only on a trusted network or tailnet.
```

### Connect the Board

1. Open `http://127.0.0.1:8765/` in your browser
2. The board connects via SSE and shows **live updates**
3. **Connection status** (top bar) turns green: "Live server connected"

### Live Features (Only in Live Mode)

| Feature | What It Does |
|---------|--------------|
| **Nudge** | Send a message to a silent agent |
| **Intervene** | Pause, resume, redirect, reassign, or stop the run |
| **Silence detection** | Auto-flags agents that go quiet |

> **Note:** Live mode requires `board-server.py` running. The board.html auto-detects it via `window.__BOARD_SERVER__`.

---

## Step 6: Add More Capabilities (When Ready)

The minimal install gives you the conductor. Add packs for specialists:

```bash
# See what packs are available
python3 bootstrap.py --list

# Add the Rigor pack (17 verification skills)
python3 bootstrap.py --packs rigor --dest ./my-skills

# Or add specific packs
python3 bootstrap.py --packs seo,legal,design-video-3d --dest ./my-skills
```

### Pack Overview

| Pack | What It Adds | Best For |
|------|--------------|----------|
| `rigor` | 17 verification skills (ponytail, archify, graphify, etc.) | Quality gates, architecture diagrams, dependency analysis |
| `crew-personas` | 41 specialist roles | Full crew with Product Owner, Architect, Checker, etc. |
| `design-video-3d` | 45 design/motion/video skills | Launch videos, brand design, motion graphics |
| `seo` | 33 SEO skills | Technical SEO, content strategy |
| `legal` | 2 legal review skills | License compliance, policy review |
| `memory-comms` | 4 memory/communication skills | Session persistence, ADHD-friendly output |

---

## Step 7: Run a Real Review (The "Review Crew" Template)

The most battle-tested crew template:

```bash
# Export the review crew configuration
python3 bootstrap.py --export-crew review-crew.json --template review-crew

# Install it
python3 bootstrap.py --import-crew review-crew.json --dest ./my-skills
```

This gives you a crew with:
- **Orchestrator** — coordinates the review
- **Reality Checker** — independent gate (NEEDS WORK / READY)
- **Architect** — system design review
- **Checker** — code quality, security, tests
- **Scrum Master** — process adherence

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "bootstrap.py: command not found" | Use `python3 bootstrap.py` (not `./bootstrap.py`) |
| "manifest.csv missing" | Run from the repo root (`cd agent-call-sheet`) |
| "front-door/crew-orchestrator missing" | Re-clone the repo — file corruption |
| Board shows "Live server disconnected" | Start `board-server.py` first, then refresh board |
| Skills don't auto-trigger in Claude Code | Ensure `--dest` points to `~/.claude/skills` or your configured skills folder |
| Rate limited (429) on live server | Default is 60 req/min + 10 burst — wait or adjust in `board-server.py` |

---

## Next Steps

1. **Read `AGENTS.md`** — the constitution this repo operates under
2. **Try `bootstrap.py --list --explain`** — see one-line descriptions of every skill
3. **Watch "The Fork" episode** — `episode/ai-crew-the-fork.html` (scripted demo)
4. **Read `docs/architecture.html`** — animated diagrams of the system
5. **Join the community** — open issues, share crew templates

---

## Philosophy in One Sentence

> **Every agent on the call. Every role cast. Every task on a card. Independent verification. No self-certification.**

---

*This guide covers the minimal path. The full README has exhaustive detail — use it when you need it, not before.*