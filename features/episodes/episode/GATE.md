# Episode gate evidence

The README says the episode *"passed its independent Reality Checker gate
(230/230) in this form."* This page is the evidence behind that line, so a
reader does not have to take it on trust.

## The files that were gated

- **Episode:** `episode/ai-crew-the-fork.html`
  - **Size:** 1,000,565 bytes
  - **SHA-256:** `20bc78132d43b1d602938eb803d404719c8e034bdddc6da6d3963b7dd7f418bd`
- **Trailer:** `episode/ai-crew-the-fork-trailer.mp4`
  - **Size:** 5,340,446 bytes
  - **SHA-256:** `3a9a938d028646774b2edc342c34dc53c1c36fc88fb4781b268999c9ec361b49`
- **Poster:** `episode/ai-crew-the-fork-poster.jpg`
  - **Size:** 206,900 bytes
  - **SHA-256:** `78118a9ca258e52aefda486436da424004b79f0e2914030ef42f63109b370246`

Those are the bytes the gate passed. The trailer and poster still ship in
this repository. The episode HTML was removed from the repository and the
published site when the site was replaced by a single game page, so its
hash above is a historical record; recover it from git history (the last
commit before that removal) to re-verify. If a downloaded copy hashes to anything else, it is not
the gated file.

## Who gated it, and the verdict

The gate was run by an independent Reality Checker — an agent that did not
build the episode and that defaults to NEEDS WORK. The checker treated the
builders' own verification totals as a claim, not evidence, published the
full check list and froze the expected total (230) in writing *before*
executing any check, then re-ran every load-bearing check with its own
harness, driving the real file in Chromium over HTTP and from `file://`.

**Verdict: READY** — scoped to the episode file as a standalone artifact.
The trailer and the poster carry their own verification blocks below,
which are part of this record; the verdict does not cover publication.

## The count: 230/230

The checker's executed totals were **230/230 checks passed**:

| Block | Checks | Passed |
|---|---|---|
| A — Static, identity, source, portraits | 22 | 22 |
| B — Byte-exact texts + clipboard | 10 | 10 |
| C — Route 1 session (13 beats) | 41 | 41 |
| D — Route 2 session (14 beats) | 42 | 42 |
| E — Click-panel anti-drift, every beat | 28 | 28 |
| F — Silence / nudge mechanics | 37 | 37 |
| G — Navigation, reduced motion, viewport, `file://`, autoplay | 22 | 22 |
| H — Trailer (own evidence) | 25 | 25 |
| I — Poster | 3 | 3 |

Source records (held in the project workspace):

- Gate record: `episode-update/RC-GATE.md` (frozen list, per-check labels,
  adjudications, and the checker's own summary)
- Checker harness: `rc_harness.py`, `rc_trailer.py`, plus the focused
  probe `rc_probe_handoff.py`

Two checks needed adjudication, stated plainly rather than smoothed over:

- The first freeze-window probe appeared to catch flight cards inside the
  new silent beats; a discriminating probe — full dwell on the previous
  beat until every card had terminated, then a MutationObserver on entry —
  recorded **zero** cards added after entering a silent beat, on both
  routes. The cards in the first probe were the previous beat's own
  self-terminating cards, as the audit anticipated. (The coordinator
  independently re-ran the discriminating probe on 2026-11-03 and got the
  same zero-card result on both routes.)
- The trailer's scene-boundary measurement picks, in each window, the
  qualifying scene-change spike closest to the planned boundary; the two
  boundaries it could have confused were confirmed by frame content.

## What changed since the previous gate (121/121)

The regression is described the way the checker measured it:

- The 19 pre-existing beats carry over. Scene headings are renumbered
  after two insertions; among existing beats, the only content changes
  are two corrections (a Route 1 claim whose status now matches the
  board, and a standup speech bubble that names the blocked/silent
  contrast), plus the enumerated downstream effects: the affected
  character's panel "Last said" line on beats after each insertion, and
  the beat-label totals, now 13 (Route 1) and 14 (Route 2). Every other
  difference between the old and new files maps to the approved change
  list — the checker diffed them hunk by hunk (22 hunks, all mapped).
- Two new beats, one per route, both headed *8 · The silence*: an agent
  holding an open claim goes quiet, the board flags it, and the viewer
  sends the nudge that brings it back. The episode now runs 21 beats.
- All 8 cast portraits are byte-identical to the previous gate's, slot by
  slot (SHA-256 compared per slot). The honesty bar and all three
  "steal this" artifacts are byte-exact against the previous gate, and
  the copy buttons were verified against the real clipboard over HTTP.

## What the gate verified

- **The silence, observed live:** with the silent agent's claim open, its
  board row and status panel show the amber silent state (static amber
  dot, "⚠ silent — no line since claim"); its stage figure freezes — the
  computed `animation-play-state` of the figure and its halo is `paused`
  while a control figure keeps running — and the ⚠ SILENT badge pops at
  about 0.9 s. No handoff card is spawned by entering the beat.
- **The nudge, clicked by the checker:** the nudge card flies from You to
  the silent agent; on landing the agent nods, its board task, phase, and
  status change to the recovery entries, the button relabels to
  *Continue ▸*, and Next enables. Navigating Back and Next re-renders the
  recovered state; leaving mid-flight and returning still reconciles; a
  rapid exit within a second leaves no SILENT badge behind on the next
  beat, and the freeze state never strands on later beats.
- **Everything the previous gate verified, re-run:** panel task/phase/
  status matching the board character-for-character at every beat
  (including both silent beats, before and after the nudge); the fork
  freeze (button, keyboard, and click bypass all held); both gate arcs
  and both endings; every task flight measured in both directions; the
  standup's blocked badge, bubble, shake, and nod observed live.
- **Reduced motion:** no flights, pops, or freezes; autoplay stays off;
  the silent beats show a static amber dot and the nudge transitions
  instantly on click — the board still tells the truth.
- **Everywhere:** zero page errors and zero page-initiated external
  requests in every session; no horizontal overflow at 375 px; the file
  renders from `file://` with all portraits decoded.

## Trailer verification (its own evidence)

- **Format (ffprobe, read back from the shipped file):** exactly one
  stream — H.264 video, zero audio. Duration exactly 40.000 s, 1280×900,
  25 fps, 1,000 frames.
- **Embedded metadata** matches the episode page's description of it: a
  screen capture of the episode's Route 2 only.
- **Timing:** all 12 shots of the frozen timing map conform within the
  ±0.2 s tolerance (brief 2.84 · casting 2.52 · debates 4.76 · fork 1.84 ·
  build 1.56 · silence 4.48 · standup 4.28 · replay 3.04 · gate 4.16 ·
  fix 3.16 · re-check 3.80 · ending 3.56, totalling 40.00 s). The
  re-check shot sits exactly at the +0.20 s tolerance edge — a pass at
  the inclusive bound, recorded here so the grade is not upgraded in
  retelling.
- **Silence internals, measured on the shipped frames:** the SILENT badge
  onset at 14.36 s (map: ≈14.4 s); the flag clears — the silent agent's
  row transitions to its recovery state — at 16.88 s (map: ≈17.05 s).
- **Frame content, viewed first-hand from the shipped file:** the badge
  peak (⚠ SILENT over the agent, amber evidence line, board row amber),
  the punch-in on the evidence block and the agent's row, the nudge card
  mid-flight with the flag still up, the cleared flag with the button
  relabelled, the standup's BLOCKED peak, and the ending card.

## Poster

The poster is the trailer's punch-in frame (t = 15.40 s) — the wide badge
frame does not survive phone width, so the legible crop ships instead. In
the checker's own 375 px render, the amber evidence line ("status:
⚠ SILENT — open claim, no sign of life") is legible, and the agent's
board row is readable at the limit — marginal, which is the criterion the
panel set and accepted. Recorded at that grade, not upgraded.

## What was NOT tested

We keep this list standing, exactly as the gate record states it:

- A real screen-reader pass (NVDA/VoiceOver) — aria behaviour was verified
  as DOM and accessible-name state only.
- Non-Chromium browsers (Firefox/Safari).
- Real-device testing beyond the 375 px viewport emulation.
- Clipboard behaviour under `file://` (verified over HTTP).
- Publication readiness of the kit as a whole — outside this gate's
  target.

## How to re-verify

1. Check out `episode/ai-crew-the-fork.html` from git history (it is no
   longer in the current tree), or download the trailer or poster.
2. Run `sha256sum` (or equivalent) on it and compare the size and hash
   with the values at the top of this page.
3. A match proves the file in hand is byte-for-byte the file the gate
   passed. The checks themselves are described in the gate record named
   above.
