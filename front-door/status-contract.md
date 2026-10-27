# Run-status contract

How a crew run reports itself so the crew board (`board.html`, in this
folder) can show who is doing what. This is the contract the board's
parser implements; the same contract is summarised in the Crew
Orchestrator skill (`crew-orchestrator/SKILL.md`).

**Contract version 3.** Version 3 adds the optional `blocked_by`
field and the claim rules in "Claims — who holds a task" below.
Version 2 renamed the optional `line` field to `say` and documented
the board's replay behaviour. Boards implementing v2 read `say`; a
v1 file's `line` values are not read — rename the field when reusing
a v1 file.

Every v3 addition is optional, so **v2 files remain valid v3
input**: a v2 file simply never carries `blocked_by`, and its claim
state is derived from its lines by the same rules. A v2 board
reading a v3 file ignores `blocked_by` (it copies only the fields
it knows) and does not flag claims — nothing breaks; the v3
information is just not shown.

## Format

- The run file is **JSONL**: one JSON object per line, UTF-8 text.
- Lines are **appended** to the run file as the run progresses. A writer
  never edits or deletes an earlier line; a newer line for the same
  agent supersedes that agent's older lines.
- The board reads the file top to bottom. For each agent, the **latest
  line wins**: the character and the panel show that agent's most
  recent entry at the replay position.
- Readers skip a line that is not valid JSON or that is missing a
  required field, and count it as skipped. Blank lines are ignored and
  are **not** counted as skipped.

## Fields

Required on every line: `agent`, `task`, `phase`, `status`, `artifact`.
Optional: `say`, `waiting_on`, `blocked_by`. Every value is a string.

| Field | Board shows it as |
|---|---|
| `agent` | heading |
| `task` | Now |
| `phase` | Phase |
| `status` | Status |
| `artifact` | Holding |
| `say` | Last said |
| `waiting_on` | Waiting on |
| `blocked_by` | Blocked by |

An absent optional field renders as "—" on the board. The board never
substitutes another field's value in its place.

- `agent` — the name of the agent the line reports on. The board's cast
  is the distinct `agent` values in the file, in first-appearance order.
- `task` — what the agent is working on now, in one short sentence.
- `phase` — the run phase the work sits in (see recommended values).
- `status` — the state of the work (see recommended values).
- `artifact` — the file or output the work is holding, as plain text
  (a path or a short name). It is a label, not a link.
- `say` *(optional)* — what the agent says at this point in the run: a
  short spoken line or progress note, in the agent's voice. On the
  board it appears as the character's speech bubble and as the panel's
  "Last said".
- `waiting_on` *(optional)* — what the agent is waiting on, when it is
  waiting on something or someone.
- `blocked_by` *(optional)* — what is blocking the agent, named for
  machine use: an agent (by its exact `agent` string), a task (by its
  exact `task` text), or a resource (a short label, e.g. `"Icon set"`).
  Write it only on a line where the block actually holds (a `blocked`
  or `waiting` line); a later line from the same agent without it
  clears it, like every other field. Where `waiting_on` is the human
  sentence about the same block, `blocked_by` is the authoritative
  referent — the two must never name different things.

## Who writes the lines — the writer model

Lines are **coordinator-reported observations, not
agent-self-attested**. The run's coordinator watches the work and
appends a line when an agent starts, blocks, hands off, speaks, or
finishes. An agent does not certify its own status, and a line is the
coordinator's record of an observed event — not a claim the board
independently verifies.

The coordinator also owns claim hygiene (next section): task text
is never reworded mid-task, a finished or yielded task gets its
release line before anyone else claims it, and `blocked_by` names
the blocker while it holds.

## Claims — who holds a task

A task is identified by its exact `task` text. (Detection is
exact-text only: rewording a task mid-run — even by one word —
makes it a different task, and no board can flag what it cannot
recognise. Absence of a flag is therefore never proof that no
conflict existed; it means no conflict was *detectable* in the
text.)

- **Claim.** An agent holds a live claim on a task from a line
  carrying that task with `status` `running` (or `working`).
  Status matching is case-insensitive and ignores surrounding
  whitespace; no other status words carry claim meaning, so claim
  and release lines must use these verbs.
- **Release.** A claim ends when the *same agent* writes a line
  with the same task and `status` `done` or `blocked`. A `done`
  line from a claimant means "my work on this task is over" —
  completed or yielded; say which in `say`. A terminal line from
  an agent who holds no claim on the task releases nothing, and
  a claim that was never made is unaffected.
- **A pause is not a release.** `waiting` or `queued` lines leave
  a claim exactly as it was. An agent who holds a task and stands
  down still holds it until they release it — and another agent
  claiming the task in the meantime is flagged, by design.
- **Moving on is not a release.** Writing lines about a different
  task does not end a claim on the earlier one. A claim that is
  never released stays live for the rest of the file, and the
  board will surface it if anyone else claims the task. That
  surfacing is intended: it makes the missing release visible
  instead of silent.
- **Handoff.** The clean sequence is: the holder releases
  (`done`), then the new agent claims (`running`) — and the new
  agent's `say` notes the handoff. The board flies the task card
  on a clean handoff.
- **Blocked ends a claim.** A claimant's `blocked` line releases
  their claim: a blocked agent has stopped and yielded the floor,
  so a second agent may pick the task up cleanly. If the blocked
  agent later writes `running` on the same task while someone
  else holds it, that is a double-claim like any other — a
  recovery is a re-assignment, and it is written as one.
- **Double-claim.** Two live claims on one task at once — a
  second claim with no intervening release — is a data error.
  The board flags it, naming every claimant, for exactly the
  stretch of the run where it is live; it never silently picks a
  winner, and the task card does not fly on a line that creates
  a double-claim. The flag shows the run's state at the replay
  position; the append-only file itself is the permanent record.

## Replay and motion

The board replays a run file line by line (play / pause / step /
scrub). The state on stage at any position is the fold of the lines up
to that position — the latest line per agent — so a character's pose,
bubble, and panel entry always trace to a specific line in the file.
Motion is driven by the line being applied, never scripted separately:

- a line with `status` "running" makes the character hop and keeps it
  bobbing while it works;
- a line with `status` "blocked" makes the character shake and pops a
  BLOCKED badge over it;
- a line whose `say` differs from the agent's previous `say` pops the
  speech bubble with the new text (the bubble then stays up while it
  is the agent's latest said line);
- a line whose `task` was another agent's current task a moment
  before flies the task card from that character to this one —
  unless the line creates a double-claim (see "Claims"), in which
  case the card does not fly;
- while a double-claim is live, every claimant's character
  carries a "⚠ claimed by two" marker ("⚠ claimed by N" for
  three or more), and the panel names the claimants and the task;
- claim state, like everything else on the board, is derived
  from the lines up to the replay position — scrubbing backwards
  past a release restores the flag, and scrubbing forwards past
  it clears it again.

Under `prefers-reduced-motion` the board renders the same states with
no motion: characters stand in static poses and bubbles and panels
remain fully readable.

## Recommended values (free text)

`status` and `phase` are free text: a board must render a value it has
never seen as a plain text chip, not fail on it. These values are
recommended so runs stay readable:

- `status`: `queued`, `running`, `blocked`, `waiting`, `done`
- `phase`: `BRIEF`, `DEBATE`, `DECIDE`, `DESIGN`, `BUILD`, `GATE`,
  `SHIP`, `RETRO`, `REPORT`

## Worked example

One line, as appended to a run file:

```json
{"agent": "Checker", "task": "Independently recompute the pack counts", "phase": "GATE", "status": "running", "artifact": "verification.md", "say": "Recomputing with a different method.", "waiting_on": "Counter counts"}
```

A v3 line — the same block, named for machines as well as humans:

```json
{"agent": "Builder", "task": "Build the widget header", "phase": "BUILD", "status": "blocked", "artifact": "sample/header.html", "say": "Blocked: the icon set has not arrived.", "waiting_on": "Icon set from Design", "blocked_by": "Icon set"}
```

## Notes

- **JSONL, deliberately.** The visual-council spec (§5) described the
  status file as "JSON". This contract supersedes that wording: one
  JSON object per line (JSONL) is what makes append-only writing and
  line-by-line skipping of malformed entries possible, and JSONL is
  what the board parses.
- **Bundled-run artifacts are not shipped.** The kit bundles two run
  files next to the board: `sample-run.jsonl` (fictional sample data)
  and `real-run.jsonl` (the record of a real run executed for this
  kit). The artifacts the real run's lines name were verified at record
  time, in the run's own workspace; they are not shipped in the kit,
  and the `artifact` values remain as the run recorded them.
- **Legacy files.** Files written before claim discipline existed
  (including the bundled `real-run.jsonl`, a v2 record) may hold
  claims that were never formally released. A v3 board derives
  their claim state by the same rules and shows it as it finds it;
  the record itself is never rewritten to tidy it.
