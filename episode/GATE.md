# Episode gate evidence

The README says the episode *"passed its independent Reality Checker gate
(121/121) in this form."* This page is the evidence behind that line, so a
reader does not have to take it on trust.

## The file that was gated

- **File:** `episode/ai-crew-the-fork.html`
- **Size:** 992,547 bytes
- **SHA-256:** `747fcd5eb1435af7f3769ba09fb797dc24e2bbaf1f16d36ec5528819df336f49`

Those are the bytes the gate passed, and they are the bytes that ship in this
repository. If a downloaded copy hashes to anything else, it is not the gated
file.

## Who gated it, and the verdict

The gate was run by an independent Reality Checker — an agent that did not
build the episode and that defaults to NEEDS WORK. The checker treated the
builders' own verification totals as a claim, not evidence, and re-ran every
load-bearing check with its own harness, driving the real file in Chromium
over HTTP and from `file://`.

**Verdict: READY** — scoped to the episode file as a standalone artifact.
The verdict does not cover publication, and it does not cover the trailer.

## The count: 121/121

The checker's own totals were **121/121 checks passed**, broken down as:

| Session | Checks |
|---|---|
| Static checks | 11 |
| Route-1 session | 47 |
| Route-2 session | 30 |
| Rapid navigation | 4 |
| Reduced motion | 10 |
| Mobile / `file://` | 7 |
| Baseline / autoplay | 3 |
| Panel anti-drift sub-checks (counted within the sessions) | the remainder |

Source records (held in the project workspace):

- Gate record: `anime-wirein-reality-check.md`
- Checker harness: `rc_harness.py`, plus two focused probes

The builders' separate verification log (`anime-wirein-verification-log.md`)
reports 126/126. The two counts differ because the checklists differ; on
every point where they overlap, the checker's independent probes agree with
the builders' claims — including one item the builders' log forgot to claim
(the Route-2 fix flights), which the checker verified first-hand anyway.

An earlier gate in the chain — the Orchestrator + click-a-persona panel gate
(`orchestrator-panel-reality-check.md`, 89/89) — passed the pre-anime form of
the file. The 121/121 gate above re-ran a full regression against that
baseline before passing the current form.

## What the gate verified

- All 8 cast portraits are byte-identical to their drawn source files and sit
  in the correct slots; the file makes zero external requests and works from
  `file://` with zero page errors.
- The standup animation was observed live (blocked badge, speech bubble,
  shake, nod, hop), not inferred from code.
- Clicking a character or a board row opens the status panel for the correct
  character, and the panel's task and phase matched the board
  character-for-character at every beat checked.
- Every task-card flight was measured geometrically and travelled the full
  distance between the correct characters, in both directions (assignments
  and send-backs).
- Under `prefers-reduced-motion`, none of the new animation runs and the board
  still updates instantly.
- Full regression against the pre-anime baseline: board state and scene
  headings for all 19 beats × all 8 agents identical; the fork freeze, the
  gate arcs, and both endings intact.

## What was NOT tested

We keep this list standing, exactly as the gate record states it:

- A real screen-reader pass (NVDA/VoiceOver) — aria behaviour was verified as
  DOM and accessible-name state only.
- Non-Chromium browsers (Firefox/Safari).
- Clipboard behaviour under `file://` (verified over HTTP).
- The trailer against this build — the gate did not re-record or assess it.
- Publication readiness of the kit as a whole — outside this gate's target.

## How to re-verify

1. Download `episode/ai-crew-the-fork.html` from this repository.
2. Run `sha256sum` (or equivalent) on it and compare the size and hash with
   the values at the top of this page.
3. A match proves the file in hand is byte-for-byte the file the gate passed.
   The checks themselves are described in the gate record named above.
