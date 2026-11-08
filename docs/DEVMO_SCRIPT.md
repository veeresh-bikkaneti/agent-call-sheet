# DevMo Video Script — Agent Call Sheet: Zero to Live Crew

**Style**: Antigravity-local — calm, technical, human tone. No hype. Show the work.
**Length**: ~2 minutes
**Format**: 1280×720, H.264, narrated
**Music**: Sascha Ende "Happy Beats / Business Moves Vol. 1" (CC BY 4.0)

---

## Shot List & Narration

### 1. Opening (0:00–0:10)
**Visual**: Three.js visualization page loads. Stack builds from bottom up as camera orbits slowly.
**Narration**: "The Agent Call Sheet. A library of AI-agent skills and personas, plus a front door to use them. Five layers — catalog, front door, bootstrap, live debugger, Paperclip bridge. All on your machine. No cloud account. No API key."

### 2. The Catalog (0:10–0:25)
**Visual**: Scroll to Layer 1. Cards fan out — 6 packs, 142 entries. Click "Rigor" card, it highlights.
**Narration**: "Layer one: the catalog. Six packs. Crew Personas — 41 specialist seats. Rigor — 17 discipline skills including pstack picks. Memory & Comms, Design/Video/3D, SEO, Legal. 120 included with license evidence, 20 link-only, 2 described. Every entry in manifest.csv: author, source, license, SHA-256."

### 3. Front Door (0:25–0:40)
**Visual**: Scroll to Layer 2. Starter Prompt + Crew Orchestrator cards. Show starter-prompt.md briefly.
**Narration**: "Layer two: the front door. A starter prompt that sets 11 house rules — remember the user, think in graphs, evidence first, blocked means blocked. And the Crew Orchestrator: a skill that turns your host agent into a crew coordinator. Confirm target, plan, build, test, independent gate, report. Never self-certifies."

### 4. Bootstrap (0:40–0:55)
**Visual**: Terminal recording — `git clone`, `python3 bootstrap.py --list`, `python3 bootstrap.py`. Show receipt.
**Narration**: "Layer three: bootstrap. One command. Python standard library only. Fetches nothing, executes nothing — just copies files. `python3 bootstrap.py` installs front door plus Rigor core into `~/.claude/skills`. `bootstrap.py --template review-crew` casts a named crew. `--export-paperclip` writes portable team definitions. Receipt at `~/.claude/skills/INSTALL-RECEIPT.json` — every file, SHA-256, what was not installed."

### 5. Live Collaboration Debugger (0:55–1:20)
**Visual**: Split screen — Terminal 1: `python3 front-door/board-server.py --run-file crew-run.jsonl`. Terminal 2: run a crew (or demo script). Browser opens `http://127.0.0.1:8765/` — board loads, agents appear live.
**Narration**: "Layer four: live collaboration debugger. The board server — Python stdlib only — serves the board and streams run-status lines via SSE. Agents appear in real time: task, phase, status, what they're holding, last said line. Silence detection flags idle agents amber. You click 'Intervene' — pause, resume, redirect, reassign, stop_run. The intervention goes to the run file, the coordinator relays it to the agent."

### 6. Intervention Demo (1:20–1:35)
**Visual**: Click "Intervene" on Builder → select "redirect" → new task "Fix the API" → phase "DESIGN" → Send. Board shows intervention line arriving via SSE. Builder's card updates.
**Narration**: "Five actions: pause, resume, redirect, reassign, stop_run. Human clicks in the board UI → POST /intervene → line appended to run file → coordinator relays to the agent. The run file is the single source of truth. The board just renders it."

### 7. Paperclip Bridge (1:35–1:50)
**Visual**: Terminal — `python3 bootstrap.py --template review-crew --export-paperclip ~/paperclip-teams`. File explorer opens output: TEAM.md (includes[]), PROJECT.md (owner), COMPANY.md (council rules), TASK.md (recurring+assignee), AGENTS.md (skills[]).
**Narration**: "Layer five: Paperclip bridge. `--export-paperclip` emits the agentcompanies/v1 schema. TEAM.md with includes[] for sub-teams. PROJECT.md with owner. COMPANY.md at root — council rules, escalation paths, budget. TASK.md with recurring:true and assignee for routines. AGENTS.md with skills[] per agent. Portable definitions you can hand to other tools."

### 8. Closing (1:50–2:00)
**Visual**: Camera pulls back to show full stack. GitHub repo link. "Built with Three.js. No framework."
**Narration**: "Five layers. One library. All on your machine. The Agent Call Sheet — every agent on the call, every role cast, every task on a card. github.com/veeresh-bikkaneti/agent-call-sheet"

---

## Recording Checklist

### Screen Recording (OBS Studio)
- [ ] 1280×720 canvas
- [ ] Capture: browser (visualization.html) + terminal (side-by-side or picture-in-picture)
- [ ] 30 fps, H.264, CBR 8-12 Mbps
- [ ] Hide bookmarks bar, address bar (F11 fullscreen)

### Narration (Record Separately)
- [ ] Phone mic or USB mic (Blue Yeti, etc.)
- [ ] Read script at ~150 wpm, conversational
- [ ] Leave 0.5s silence between sections for edit points
- [ ] Do 2 takes; pick best

### Edit (DaVinci Resolve / CapCut)
- [ ] Sync narration to screen recording
- [ ] Cut dead air, speed up terminal waits (2-3x)
- [ ] Add subtle zoom-ins on clicks
- [ ] Lower-third labels: "Layer 1: Catalog", "Layer 4: Live Debugger"
- [ ] Music: Sascha Ende "Happy Beats / Business Moves Vol. 1" (CC BY 4.0) — duck under narration
- [ ] Export: 1280×720, H.264, ~30 MB

### Hosting
- [ ] Save as `docs/media/devmo.mp4`
- [ ] Update `visualization.html` video poster + source
- [ ] Or upload to GitHub Releases, link from README

---

## Quick-Start Recording Commands

```bash
# Terminal 1 - Board Server
cd /c/Users/lab/repos/agent-call-sheet
python3 front-door/board-server.py --run-file crew-run.jsonl --port 8765

# Terminal 2 - Run a demo crew (or use live_debugger demo)
python3 front-door/live_debugger.py --run-file crew-run.jsonl --server http://127.0.0.1:8765

# Open browser to http://127.0.0.1:8765/
# Open visualization.html in another tab for the 3D view
```

---

## Pro Tips

1. **Record terminal at 2x speed** in post — keeps it honest but tight
2. **Show the run file** (`cat crew-run.jsonl`) — proves it's just JSONL
3. **Click "Intervene" live** — the amber flag appearing is the money shot
4. **Show the Paperclip output in VS Code** — syntax highlighting sells it
5. **End on the visualization page** — orbiting the full stack is the hero image