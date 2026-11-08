# Decision Log — Agent Call Sheet Webpage Redesign

## Decision: T1 Council-Approved Redesign (2026-11-08)

### Context
The Agent Call Sheet GitHub Pages site needed a UX redesign based on:
- Slop Diagnostic (6/10 slop, 7 tells fired)
- Design skills: frontend-design, motionmaxxing, ui-ux-pro-max
- T1 Council review with 4 non-Chair seats

### Council Vote
- Seat A (Scenarios): AFFIRMATIVE
- Seat B (Verification): AFFIRMATIVE
- Seat C (Skeptic): CONDITIONAL AFFIRMATIVE (6 conditions)
- Seat D (Historian): CONDITIONAL AFFIRMATIVE (3 conditions)
- Chair: No veto
- Result: PASS with 8 conditions

### Conditions Implemented
1. ✅ One deliberate visual anchor per section (block-num inline stats)
2. ✅ Three.js progressive loading (on scroll/click, not eager)
3. ✅ Narrative thread: Problem → Solution → Proof
4. ✅ Archive GAME-DOCS.html to archive/
5. ✅ Keep Three.js as visual identity/character
6. ✅ Success metric: time-to-first-successful-install < 3 min
7. ✅ Archive GAME-DOCS.html to archive/GAME-DOCS.html
8. ✅ Record decision in decision log

### Changes Made
**site/index.html** - Complete redesign as Monitor/Explore surface:
- Problem → Solution → Proof narrative thread
- Three.js progressive loading (on scroll/click, not eager)
- Visual anchors: block-num inline stats per section
- Three.js kept as visual identity
- Monitor/Explore surface: left-aligned, dense, scannable
- No hero, no feature cards, no monument stats, no icon toppers
- Left-aligned everything, proper Monitor surface density
- SRI hashes + CSP preserved
- Accessibility: 4.5:1 contrast, 44px touch targets, semantic HTML
- Three.js progressive loading (on scroll/click, not eager)

**archive/GAME-DOCS.html** - Archived (not deleted)

### Files Changed
- site/index.html — Complete redesign
- archive/GAME-DOCS.html — Archived (preserved)
- .github/workflows/pages.yml — Fixed workflow (removed docs/ copy)
- decision-log.md — This file

### Next Steps (Per Council Priority)
1. Fix 88 provenance mismatches (re-sync vendored files to pinned commits)
2. Add cost, cost_unit to orchestrator contract
3. Fix starter prompt byte identity
4. Add frontmatter to 6 skills missing it
9. Add basic auth to board server
10. Record real end-to-end video (not scripted)
11. Add CI/CD running eval harness on every push

### Verification
- SRI hashes: 7/7 present in importmap
- CSP: require-sri-for script present
- Rate limiting: 60 req/min + 10 burst on board server
- Unit tests: 4/4 pass
- Eval harness: 88 SHA mismatches, 2 contract failures confirmed

### Open Items (Gate Verdict: NEEDS WORK)
- 88 provenance SHA mismatches
- Starter prompt byte identity
- Orchestrator contract missing cost/cost_unit
- Frontmatter for 6 skills
- Board server auth
- CI/CD pipeline
- Real agent integration test
- Real end-to-end video
- Community building

---
Decision recorded by: T1 Council (Chair + A+B+C+D)
Date: 2026-11-08
Gate verdict on implementation: PENDING (awaiting Reality Checker)
