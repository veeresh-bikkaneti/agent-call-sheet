# Beginner's Guide to The Agent Call Sheet

**TL;DR:** A system for running AI agent crews with quality gates. Think of it as a **library of specialist skills** + a **coordinator** + a **live dashboard**.

---

## 30-Second Test (Zero Install)

```bash
# Just open this in your browser — no install needed
open front-door/board.html
```

You'll see a live dashboard with sample agent runs. Click around — it works offline.

---

## 5-Minute Quick Start (Minimal Install)

### 1. Clone the repo
```bash
git clone https://github.com/veeresh-bikkaneti/agent-call-sheet.git
cd agent-call-sheet
```

### 2. Install minimal (2 files only)
```bash
python3 bootstrap.py --minimal --dest ~/.claude/skills
```
This installs only:
- `crew-orchestrator` — turns your AI into a crew coordinator
- `starter-prompt.md` — 11 house rules for the crew

### 3. Test it works
```bash
# Paste starter-prompt.md into any AI assistant
# Then ask: "Run a crew to build a login page"
```

The orchestrator will:
1. **Confirm target** — clarify what you want
2. **Plan** — break into phases, assign specialists
3. **Build** — run agents with live dashboard
4. **Test** — independent Reality Checker gates every wave
5. **Report** — structured handoff

---

## Add Packs Incrementally

```bash
# Add specialist packs (17 Rigor skills, 33 SEO, 2 Legal, etc.)
python3 bootstrap.py --packs rigor,seo,legal --dest ~/.claude/skills

# Or use a pre-built crew template
python3 bootstrap.py --template review-crew --dest ~/.claude/skills
```

**Available packs:** `rigor`, `seo`, `legal`, `crew-personas`, `memory-comms`, `design-video-3d`

---

## Live Dashboard (See Your Crew Work)

### Option A: Quick test with sample data
```bash
python3 front-door/board_server.py --run-file front-door/sample-run.jsonl
# Open http://127.0.0.1:8765
```

### Option B: Watch a real crew run
```bash
# In one terminal: start the server
python3 front-door/board_server.py --run-file crew-run.jsonl

# In another: run your crew (the orchestrator writes to crew-run.jsonl)
# The dashboard updates live — nudge silent agents, intervene mid-run
```

**Intervention actions:** `pause`, `resume`, `redirect`, `reassign`, `stop_run`

---

## Paperclip Export (Portable Team Definitions)

```bash
python3 bootstrap.py --export-paperclip ~/my-team --template review-crew
```

Creates portable files:
- `TEAM.md` — agents with `includes[]`
- `PROJECT.md` — project with `owner`
- `COMPANY.md` — council rules, escalation paths, budget
- `TASK.md` — recurring tasks with `assignee`
- `AGENTS.md` — skills per agent

---

## Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Crew Orchestrator** | Your AI becomes a coordinator, not a solo worker |
| **Starter Prompt** | 11 house rules: remember user, think in graphs, evidence first, blocked=blocked, done=verified |
| **Reality Checker** | Independent gate — never self-certify |
| **Status Contract** | Structured JSONL lines: agent, task, phase, status, artifact (+ cost/cost_unit) |
| **Live Board** | SSE dashboard: see state, nudge, intervene |

---

## Common Questions

**Q: Do I need all 142 skills?**
A: No. Start with `--minimal` (2 files). Add packs as needed.

**Q: Does it work with Claude Web / Grok / other AIs?**
A: Yes. Use `--target claude-web|grok-build|prompt-only` to stage files for paste/upload.

**Q: What's the license?**
A: Apache-2.0 for original material. Third-party skills keep their licenses (MIT, etc.) — see `MANIFEST.md`.

**Q: Can I use this without the dashboard?**
A: Yes. The orchestrator works purely via the starter prompt. The dashboard is optional.

**Q: Is there authentication on the board server?**
A: Optional. Set `BOARD_AUTH=1 BOARD_AUTH_TOKEN=secret` for Bearer token auth. Default: no auth (trusted network only).

---

## Next Steps

1. **Read the starter prompt** — `front-door/starter-prompt.md` (11 house rules)
2. **Try a template** — `python3 bootstrap.py --template review-crew --list --explain`
3. **Watch the live board** — `python3 front-door/board_server.py --run-file front-door/sample-run.jsonl`
4. **Join the crew** — paste the starter prompt into your AI and start delegating

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `bootstrap.py` not found | Run from repo root: `cd agent-call-sheet` |
| Skills not appearing in Claude Code | Restart Claude Code; check `~/.claude/skills` |
| Board shows "disconnected" | Start `board_server.py` first |
| "No such file" on Windows | Use Git Bash or WSL; paths are POSIX-style |

---

**That's it. You're ready to run agent crews.** 🎯
