# HANDOFF: two-sided docs site (branch `docs/two-sided-site`)

Written 2026-11-10. A new local agent with no context should be able to resume from this file alone. Read `AGENTS.md` too; it governs this work.

## Goal
Make the Pages site the agent-call-sheet DOCUMENTATION, in two sides, modelled on the owner's antigravity-local Pages site (`veeresh-bikkaneti.github.io/antigravity-local`):
1. **Professional docs side** at the Pages root.
2. **Game-style side at `/game/`**: an Oasis map where each docs section is a building, quest-card steps mirroring the install guide, keyboard and screen-reader usable, works on phone, "switch to professional docs" link on every screen.

The Saffron Spring three.js game (PR 49) was the wrong deliverable. It is retired. The desert/oasis look is a STYLE for the docs, not the product. Every page must teach the real repo.

## Decisions so far
- **Owner/approver:** the repo owner (sole owner). **Chair:** the engineering-software-architect persona seat (not the owner). Recorded in `features/site/TASK-MANIFEST.md`.
- **Budget:** 600k tokens total, two phases. Phase A (professional docs + render check) 300k, then STOP. Phase B (game side + council) 300k, starts ONLY on the owner's explicit go. The owner later granted +60k for the rest of Phase A (build review, render check on CI, fixes).
- **Hero:** static inline SVG only. No three.js, no canvas, no WebGL. The vendored three.js bundle is removed.
- **Walkthrough video:** removed until a real kit demo exists. The page carries a short "demo coming" note, no game footage.
- **README:** the Saffron Spring description is fixed in this PR to match the docs site.
- **Blender (blender.org):** only where it fits, likely Phase B game assets or a hero still render. Not needed for Phase A. If Blender is not installed, say so; do not work around it.
- Keep untouched: `features/live-debugger/board.html` (eval harness hashes it) and everything under `features/library/packs` (pinned in gate-verdict and provenance manifests).

## Done in Phase A (all pushed to `origin/docs/two-sided-site`)
| Commit | What |
|---|---|
| `5a71fdd` | `features/site/TASK-MANIFEST.md`, `features/site/content/verified-commands.md` (install commands checked against the repo) |
| `5661e07` | Professional side: `features/site/{index,install,architecture,packs,faq,walkthrough}`, `assets/site.css`, `assets/site.js`, `tools/build_packs.py`, `tools/check_site.py`, rewritten `tools/render-check.mjs`; reworked `.github/workflows/pages.yml` and `site-render-check.yml`; `.gitignore`; game files and three.js bundle removed; `features/eval/tests/test_live_debugger.py` rewritten |
| `14df9cb` | Walkthrough video and poster removed (page now says "demo coming"); README site description corrected |
| (next commit) | This `HANDOFF.md` |

Checks, with evidence level:
- `python features/site/tools/build_packs.py --check`: PASS (local, builder-reported and re-run by the README worker).
- `python -I features/site/tools/check_site.py`: PASS (local; 6 pages).
- CI `Site render check` run 42850281514 on `5661e07`: success (render and publish jobs). It has NOT been confirmed for `14df9cb` or the handoff commit.
- Local Chrome stand-in script (not `render-check.mjs`): PASS at 360/390/1280 px, JS off, reduced motion.
- Not verified: the clone command, the board opened in a browser, Grok surfaces, `--packs`, token auth. The install page labels these.

## Open items
1. **Eval gate is red locally, unchanged by this work:** tier 1 PASS 481 / FAIL 87 / NOT RUN 39; tier 2 PASS 5 / FAIL 4 / NOT RUN 0. `EVAL-GATE.md` records PASS. It has NOT been run on CI for this branch (`ci.yml` triggers only on pushes to `main` and on PRs, with no `workflow_dispatch`). Run it on CI (e.g. via the draft PR), and if CI is green and local red, check CRLF / `.gitattributes` (the old `packs/**` rule no longer matches `features/library/packs/`). Do NOT claim PASS anywhere until CI shows it.
2. **`features/eval/tests/test_live_debugger.py` was rewritten** (six game tests removed, two docs-site tests added). In the council packet tag it: **"tests were edited by the same agent that removed the code."**
3. `bootstrap.py --bundle` fails on a Windows CRLF checkout ("SKILL.md has no frontmatter block"). Plain install is fine.
4. Old docs point at paths that do not exist (root `bootstrap.py`, `front-door/board_server.py`). The new site uses the real paths (`features/paperclip-bridge/bootstrap.py`, `features/live-debugger/`). The old docs are not fixed.
5. `decision-log.md` and `gate-verdict.agent-readable.v1.json` still mention Three.js (the latter around line 76). Not edited. Check with the owner.
6. Leftovers kept in place on the author's machine: `.verify-tmp/` and `features/site/.screenshots/` (untracked or gitignored; never commit them). Tracked `__pycache__/*.pyc` and stray `features/eval/test-run*.jsonl` are pre-existing; report only.
7. `render-check.mjs` itself has never been run locally (no puppeteer/Playwright installed); CI is its only run.

## Next steps, in order
1. **Rest of Phase A, under a 60k cap:** build review (by a reviewer who did not write it), confirm the render check on CI for the latest commit, run the eval gate on CI (open the draft PR if needed), fix what fails. Stop and report spend at the cap.
2. **Phase B (game + council), only on the owner's go:** build `/game/` (Oasis map, quest cards, a11y, mobile, "switch to professional docs" link on every screen), sharing content with the docs side so they cannot drift. Then the council (Council Panel seating loop: one evidence pack, parallel clean-context seats on cheap models, an experiential seat that must attach screenshots/video, scoped re-votes, one tally file). Then a DRAFT PR with the tally and known gaps. Do not merge; the owner merges.

## Spend so far and remaining budget
- Subagent tokens reported: verifier 107k + professional-side builder 183k + video/README worker 64k = **about 354k**. Main-session share is not measurable; estimate 40-60k. **Total roughly 400-415k of the 600k cap.**
- Phase A allowance (300k + 60k = 360k) is **exceeded**. Remaining of the 600k cap: roughly **185-200k**, which is less than the 300k planned for Phase B. The owner must set a revised Phase B cap before it starts.
- Cost in dollars: not reported (the runtime gave no price counter).

## Rules
- Follow `AGENTS.md`: 15k default cap superseded by the owner-approved 600k plan above; tiers (this work is T2, T1 if pack/license/distribution claims change); no self-certification; no unapproved side effects.
- Main session on `/model opusplan` (plans, integrates, verifies only). Builders and council seats on Sonnet/Haiku subagents.
- Stop and ask before passing any cap.
- Draft PR only; the owner merges. One approval is one action: push, PR, merge each need explicit authorization.
- Stage named files only (never `git add -A`). Do not delete `.ai-context/` or memory files.
- Browser work: use `/browse`, not the Chrome MCP tools (owner's global rule).

## Resume
```
cd C:\Users\veere\source\repos\agent-call-sheet
git fetch origin && git checkout docs/two-sided-site && git pull
```
Read this file, summarise where things stand in 2-3 sentences, then ask the owner whether to continue.
