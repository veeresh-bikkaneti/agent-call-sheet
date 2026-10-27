# Run-status contract

How a crew run reports itself so the crew board (`board.html`, in this
folder) can show who is doing what. This is the contract the board's
parser implements; the same contract is summarised in the Crew
Orchestrator skill (`crew-orchestrator/SKILL.md`).

**Contract version 3.2.** v3.2 adds server mode and the `nudge` and
`heartbeat` lines; all v3 and v3.1 rules are unchanged. A v3.1 board
reading a v3.2 file skips `nudge` and `heartbeat` lines exactly as
its skip rules say — they carry no status fields, so the reader
skips them and counts them as skipped — and shows the status lines
exactly as before; nothing breaks, the server-mode lines are just
not shown. Version 3 adds the optional `blocked_by`
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

## Watching a run live (v3.1)

A run can be watched while it is being written — no server involved:
the reader opens the run file in the board and the board follows it
as lines land.

- **Writers append complete lines.** A line lands when its newline
  lands: a writer appends the whole line, newline included, in one
  append, and never leaves a half-written line sitting in the file
  for the board to guess at. The board folds only complete lines
  (everything up to the last newline in the file); a trailing
  partial line is held, unfolded, until its newline arrives.

  ```sh
  echo '{"agent": "Builder", "task": "…", "phase": "BUILD", "status": "running", "artifact": "…", "say": "…"}' >> run.jsonl
  ```

- **The board's Watch control.** "Watch a run file" asks the reader
  to pick the run file (the File System Access API,
  `showOpenFilePicker`, in Chromium-class browsers). The board then
  polls the file once a second, and once more whenever the tab
  becomes visible again, folding each newly landed complete line
  into the same state the replay uses. While watching, the replay
  transport (play, step, scrub) is disabled and the stage stays at
  the live end.
- **The three watch labels.** The source line carries exactly one of
  these while a watch is running, and each claims only what the last
  completed poll established — the label always shows the last-line
  time and the last-check time beside it, so a stale tab shows a
  stale time instead of an unbounded claim:
  - **"● Live — watching \<name\>"** — the last completed poll added
    at least one new run line. Blank or malformed appends never earn
    this label: they are not run data.
  - **"Watching \<name\> — no new lines"** — the last completed poll
    added no new run line (nothing landed, or only blank/malformed
    lines did). The first read when a watch starts is a baseline and
    takes this label too — a watch is never labelled Live for lines
    that were already there when it started.
  - **"Watching \<name\> — file changed under the watch; re-read
    from the top"** — the file no longer continues the text the
    watch had already folded (it was rewritten, not appended to),
    so that poll rebuilt the stage from the top, complete lines
    only. The normal two labels resume on the next poll.
  "Last line" is the watched file's last-modified time at the poll
  that consumed the latest run line ("—" until one is consumed);
  "last check" is the local time the last poll completed.
- **Ending a watch.** Switching dataset (a bundled run, a loaded
  file) or pressing **Stop watching** ends the watch. Stop re-reads
  the file once, and the loaded state is that read — a held partial
  line counts there, exactly as it would on a fresh load. If the
  file can no longer be read mid-watch (permission lost, file
  moved), the watch stops on the last text the board could read and
  the stage says so.
- **Browsers without File System Access** never get a live claim:
  the Watch control routes to the ordinary file picker, and the
  loaded label gains a "— reload to refresh" suffix with a Reload
  control that re-reads the picked file by hand.
- A watched file is never labelled "Recorded real run" — that label
  belongs only to the kit's bundled record.

## Server mode (v3.2)

We also ship a small server in this folder, `board-server.py`
(Python standard library only). Server mode is optional — replay
and Watch (above) need no server at all — but when we want a board
that updates the moment a line lands, plus nudges and silence
flags, we run the server ourselves, on our own machine:

```sh
python3 front-door/board-server.py --run-file crew-run.jsonl
```

That serves the board at `http://127.0.0.1:8765/` against the named
run file. Useful flags: `--port`, `--host`, `--silence` (seconds,
default 120), `--extra-run` (another run file the board may open;
repeatable), and `--board-dir` (the folder holding `board.html`;
defaults to the script's own folder).

| Route | What it does |
|---|---|
| `GET /`, `GET /board.html` | Serves `board.html` with the server marker (below) injected just before `</body>`; the served bytes differ from the file on disk only by that injection. |
| `GET /sample-run.jsonl`, `GET /real-run.jsonl` | The bundled runs, as static files. |
| `GET /runs/<name>` | Serves a run file whose name exactly matches the `--run-file` or an `--extra-run` basename; every other name is a 404. |
| `GET /state` | The folded state of the run file as JSON (see below). |
| `GET /stream` | A live feed (server-sent events): every complete line already in the file, a `ready` event, then each new line as it is appended. |
| `POST /events` | Appends one status, `heartbeat`, or `nudge` line, validated first (below); a rejected line writes nothing. |
| `POST /nudge` | Appends one server-built `nudge` line. |

**The marker.** The server injects one line into the board it
serves, so the board knows it is in server mode and where to talk:

```html
<script>window.__BOARD_SERVER__ = {"stream":"/stream","state":"/state","nudge":"/nudge","events":"/events","silenceDefault":120}</script>
```

**`received_at`.** The server stamps every line it appends with
`received_at` — the moment the server took the line, as a UTC
ISO 8601 timestamp with a `Z` suffix — when the line does not
already carry one. It is the server's receipt time, not the
writer's claim, and it is the timestamp silence is measured from
whenever it is present.

**Two new lines.** Server mode adds two line shapes to the file.
They are not status lines: they carry no `task`, `phase`, `status`,
or `artifact`, and readers fold them only as this section says.

A `nudge` line — one named agent is asked for something, usually
its status. The server builds this line itself (from `POST /nudge`,
or a `POST /events` body with `"type": "nudge"`): `from` says who
sent it (default `"owner"`), `agent` names the agent it is for, and
`ts` and `received_at` are both the server's time:

```json
{"type": "nudge", "from": "owner", "agent": "Builder", "message": "Status, please — are you still on the header?", "ts": "2026-10-27T21:52:00Z", "received_at": "2026-10-27T21:52:00Z"}
```

A `heartbeat` line — an agent (or the coordinator, for it) says
"still here" without changing its status. Clients post these to
`POST /events`; beyond `type` and the required `agent`, a heartbeat
may carry further string fields, and the server stamps
`received_at` as usual:

```json
{"type": "heartbeat", "agent": "Builder", "received_at": "2026-10-27T21:52:30Z"}
```

**Validation on append.** `POST /events` takes a JSON object of at
most 65,536 bytes. A status line needs the usual required fields,
all strings, with `agent` and `status` non-empty; optional fields
must be strings when present. A `heartbeat` needs `agent`; a
`nudge` needs `agent` and `message`. Caps: `agent` and `from` at
most 200 characters, `message` at most 1,000, every other string
field at most 2,000. A line that fails is refused with a 400 naming
the field, and nothing is written. A good line is appended in one
write and answered with a 201 carrying the line as stored.

**Silence.** An agent is silent when it holds an open claim (see
"Claims — who holds a task": a `running` or `working` line not yet
released by that agent's `done` or `blocked` line on the same task)
and its own latest line is older than the silence threshold. Only
the agent's own lines count — its status lines and its heartbeats;
a nudge addressed to it does not, because being nudged is not a
sign of life. Age is measured from `last_seen`: the newest
`received_at` (falling back to `ts`) across the agent's own status
and heartbeat lines. The default threshold is 120 seconds: the
server's `--silence` value, which the board takes from the marker's
`silenceDefault`. `GET /state` exposes the fold behind the flag —
per agent: `last_seen`, `last_line`, `open_claims`, `silent`, and
`silent_for_s` (the age in seconds, or `null` when the agent has
no timestamped line of its own; an agent with no such line is
never silent) — plus the file's `skipped_lines` count, folded by
the same skip rules as the board.

**Who acts on a nudge.** The server never contacts agents itself.
It appends the nudge and streams it; acting on it is the
coordinator's job. The consumption pattern is: the orchestrator
tails `GET /stream` (or the run file itself), sees a `nudge` line,
and relays it to the named agent through whatever channel that
agent actually hears — the run file is the record, the relay is
ours.

**Security posture.** The server binds to localhost by default and
has no authentication — run only on a trusted network or tailnet.
Anyone who can reach the port can read the board and post lines,
so binding beyond localhost (`--host`) is a deliberate choice for a
network we already trust, and the server prints a warning when we
make it.
