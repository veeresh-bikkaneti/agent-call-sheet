# Task manifest: two-sided docs site (docs/two-sided-site)

Base: main @ 3122d25. Initial `git status --short`: clean.

- **Requested outcome:** Pages site = agent-call-sheet documentation. Professional side at root; game-style side at /game/ (Phase B).
- **Risk tier:** T2 (install/platform claims, coupled files). Becomes T1 if pack/license/distribution claims change; packs table only reads manifest.csv.
- **Authorized owner / authority source:** repository owner (sole owner), stated in session on 2026-11-10.
- **Chair:** engineering-software-architect persona seat (not the owner). Named by the owner in session.
- **Budget:** revised cap 600k tokens, approved by the owner. Phase A (professional docs + render check) 300k, then STOP and report spend. Phase B (game + council) 300k, starts only on the owner's go.
- **Models:** main session opusplan (plan/integrate/verify only); builders and seats on Sonnet/Haiku subagents.
- **Scope edits:** hero is static SVG only; no three.js; remove features/site/assets/vendor. Keep features/live-debugger/board.html and pack HTML untouched.
- **Verification convention:** each check reported PASS/FAIL/NOT RUN/UNVERIFIED with command + evidence; render check via site-render-check.yml or local headless browser; `git diff --check`.
- **Runtime instruction-loading status:** UNVERIFIED (subagents are given AGENTS.md constraints in their briefs).
- **Report-only (not fixing):** tracked __pycache__/*.pyc and stray features/eval/test-run*.jsonl.
