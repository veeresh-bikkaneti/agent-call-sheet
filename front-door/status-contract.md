# Run-status contract

How a crew run reports itself so the crew board (`board.html`, in this
folder) can show who is doing what. This is the contract the board's
parser implements; the same contract is summarised in the Crew
Orchestrator skill (`crew-orchestrator/SKILL.md`).

**Contract version 2.** Version 2 renames the optional `line` field to
`say` and documents the board's replay behaviour. Boards implementing
v2 read `say`; a v1 file's `line` values are not read — rename the
field when reusing a v1 file.

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
Optional: `say`, `waiting_on`. Every value is a string.

| Field | Board shows it as |
|---|---|
| `agent` | heading |
| `task` | Now |
| `phase` | Phase |
| `status` | Status |
| `artifact` | Holding |
| `say` | Last said |
| `waiting_on` | Waiting on |

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

## Who writes the lines — the writer model

Lines are **coordinator-reported observations, not
agent-self-attested**. The run's coordinator watches the work and
appends a line when an agent starts, blocks, hands off, speaks, or
finishes. An agent does not certify its own status, and a line is the
coordinator's record of an observed event — not a claim the board
independently verifies.

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
  before flies the task card from that character to this one.

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
