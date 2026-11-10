# Council tally: /game/ (Oasis) side

Votes below were NOT committed anywhere before this file; they are recorded from the owner's task prompt.

| Seat | Vote |
|---|---|
| Architect | APPROVE with small fixes |
| Experiential | APPROVE with small fixes |
| Accessibility | BLOCK (item 1) |
| Accessibility re-vote (clean-context Haiku, 6 items only, diff + CI screenshots) | APPROVE WITH SMALL FIXES |

## Findings and fixes (all in commit 2c47d6c)

| # | Finding | Evidence before | Fix |
|---|---|---|---|
| 1 | Pressed "Mark done" contrast (blocker) | white on #4f8a35 = 4.18:1 | #2f6a1c = 6.56:1 |
| 2 | Map labels clipped/overlapping, tiny on phones | 17px units, long labels | name-only labels, 26px units (about 14.6px at 360 px) |
| 3 | Footer "Switch to professional docs" weak | #f0c98f on #fff8ea = 1.48:1 (site.css `.site-footer a` overrode `.g-switch`) | #9a3c1a = 6.55:1; hover is white on #9a3c1a |
| 4 | Copy / Mark done shown with JS off | in static HTML | created by game.js; progress UI hidden without JS |
| 5 | Identical Copy names | all "Copy" | "Copy step N command [i of M]" |
| 6 | Map link names lack visible label (2.5.3) | "FAQ and limits..." vs "FAQ: the tea house" | each aria-label starts with the visible word |

## Re-vote notes and how they were resolved
- Seat could not see the g-switch hover state. Checked in game.css: hover background is terra-ink (#9a3c1a) with white text, 6.55:1. This is my reading of the CSS, not a render.
- Seat could not see the Home map link name. It is "Home, the spring. Open the professional home page." (unchanged, starts with "Home").
- Item 5 is verified from code only; no screenshot shows accessible names.
- Phone-width map labels are small (about 14px) but legible per the seat.

## Evidence level
- Local: `check_site.py` PASS (7 pages, 137 refs), `build_packs.py --check` PASS.
- CI on 2c47d6c: Site render check success (push and pull_request), CI Eval Harness success (pull_request). Screenshots reviewed by the re-vote seat only, not by me.
- The re-vote seat is a different agent from the fixer, but both ran on this branch with the same coordinator.

## Flags
- `features/eval/tests/test_live_debugger.py`: tests were edited by the same agent that removed the code.
- Known gap: the Architect and Experiential votes were not re-run on the fixes.
