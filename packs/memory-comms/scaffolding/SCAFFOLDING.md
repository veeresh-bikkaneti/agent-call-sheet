# Memory scaffolding — what ships here, and where it goes

The starter prompt (rules 1–2) promises a memory system: a living memory
file the agent maintains, and self-improvement loops that fold corrections
into standing rules. The manifest lists those two pieces — "Living memory
files" and "Self-improvement loops" — as practices. This folder is their
scaffolding: the starter files and the loop prompt, shipped as files so
adopting the practices means copying templates, not inventing them.

## The files

| File | Adopt it as | What it is |
|---|---|---|
| `MEMORY.md` | `MEMORY.md` (memory root) | The curated long-term memory: preferences, what the user cares about, decisions, facts, commitments. Kept tight; raw detail lives in the daily notes. |
| `USER.md` | `USER.md` (memory root) | Who the user is — name, what to call them, timezone, context. The stable identity facts behind rule 1's "who I am". |
| `people-index.md` | `memory/people/INDEX.md` | One line per person, closest first, each pointing at that person's page under `memory/people/`. |
| `daily-note.md` | `memory/<YYYY-MM-DD>.md` | The day's raw log: what happened, decisions, and the corrections that become standing rules the same day. What lasts is promoted to `MEMORY.md`. |
| `loop-card.md` | a scheduled job, or a pasted prompt | The self-improvement loop from rule 2 as a fill-in prompt: review the period, fold corrections into standing rules, promote and prune memory, improve from what worked, restate state. |

Each template's top comment says where it goes and which prompt rule it
implements. Copy the file, fill in the blanks, delete the comment.

## Where the files live, per surface

- **File-capable surfaces** (an agent that reads and writes files where
  it runs — Claude Code, Grok Build, a local agent): copy the templates
  to the memory root your setup reads, under the "Adopt it as" names.
  The daily note is created fresh each day from `daily-note.md`.
- **Paste-only surfaces** (a chat that takes custom instructions but
  keeps no files): the honest limitation — there are no persistent files,
  so there is nothing for a template to live in. Paste the filled-in
  `MEMORY.md` and `USER.md` content into the surface's standing
  instructions instead, and treat that text as the memory: it lasts only
  as long as the surface keeps it, corrections are folded in by editing
  that text, and the loop cannot be scheduled — paste `loop-card.md`
  yourself at the cadence. This is the same limitation the kit's install
  guides state for the starter prompt itself: auto-triggering,
  persistent file memory, and scheduled loops need a surface that keeps
  files and standing instructions.

## Getting it with the bootstrap

`bootstrap.py` installs by manifest, and this folder is a manifest entry
(pack `memory-comms`, distribution `include`). Installing the pack —

```sh
python3 bootstrap.py --packs memory-comms
```

— copies this `scaffolding/` folder with the rest of the pack. From the
installed copy, move the templates to the "Adopt it as" locations above;
the bootstrap installs the pack, it does not place your memory files
for you.
