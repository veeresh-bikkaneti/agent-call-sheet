# Crew templates

Named crews we can install in one command, export, share as a file, and
bring back — plus a bridge that writes a crew as a Paperclip team
directory. A crew is a small JSON file: a name, the seats it casts
(each seat is a manifest entry with a role), and optional starter
routines. The crew schema is kit-local: we define it here, version it
with `crew_schema`, and no external standard is claimed for it.

Everything on this page runs through `bootstrap.py`, which fetches
nothing and executes nothing in any of these modes.

## The crew file schema

```json
{
  "crew_schema": 1,
  "name": "review-crew",
  "description": "A crew for checking finished work before it is accepted: a coordinator scopes the review, specialists inspect the code, the evidence, and the security surface, and an independent checker gates the verdict.",
  "when_to_use": "Use when a change, a pull request, or a claim needs an independent check before we call it ready.",
  "members": [
    {"entry": "agents orchestrator", "role": "Coordinator"},
    {"entry": "engineering code reviewer", "role": "Reviewer"},
    {"entry": "testing evidence collector", "role": "Evidence"},
    {"entry": "security ai generated code auditor", "role": "Security"},
    {"entry": "testing reality checker", "role": "Gate"}
  ],
  "routines": [
    {"name": "Pre-merge gate", "description": "Run the full review crew over a change and record a ready or needs-work verdict, with the evidence behind it, before merging."},
    {"name": "Claim check", "description": "Take one stated claim, find the evidence for or against it, and report only what that evidence supports."}
  ]
}
```

- `crew_schema` — must be `1`.
- `name` — the crew's name, at most 64 characters. A shipped template's
  name equals its file stem (`front-door/templates/review-crew.json`
  is the crew named `review-crew`).
- `description` / `when_to_use` — one or two plain sentences each.
- `members` — a non-empty list. `entry` is an exact manifest name;
  `role` is the seat's name in this crew, at most 64 characters
  (`"role"` may be omitted on import and defaults to `""`; exports
  always write it).
- `routines` — optional. Starter routines as `name` + one-line
  `description` pairs.

## Validation and failure behaviour

Crew files are validated before anything is written, and validation
fails closed — a bad file installs nothing and writes nothing:

- the file must exist and must not be a symlink;
- it must parse as a JSON object, with no unknown top-level or member
  keys (unknown keys are named in the error);
- `crew_schema` must be `1`;
- `members` must be a non-empty list of objects, each `entry` an exact
  manifest name (an unknown entry is named in the error), with no
  duplicate entries;
- the crew `name` and each member `role` are capped at 64 characters.

Members whose manifest distribution is link-only are never fetched:
they are reported under the usual "NOT installed (link-only …)" banner
and in the receipt's `not_installed` list, exactly as on the pack path.
Practice members are reported the same way as on the pack path. A crew
install replaces the pack selection — the front door always installs,
and the receipt always carries a `crew` key: an object
(`{"name": …, "origin": "template" | "file"}`) when a crew drove the
install, `null` otherwise. Crew scope feeds the same downstream path
as pack scope, so frontmatter injections, bundles, and the receipt
behave identically for both selections.

## The four shipped templates

### review-crew

A crew for checking finished work before it is accepted: a coordinator
scopes the review, specialists inspect the code, the evidence, and the
security surface, and an independent checker gates the verdict.

*When to use:* when a change, a pull request, or a claim needs an
independent check before we call it ready.

| Entry | Role |
|---|---|
| agents orchestrator | Coordinator |
| engineering code reviewer | Reviewer |
| testing evidence collector | Evidence |
| security ai generated code auditor | Security |
| testing reality checker | Gate |

Routines:

- **Pre-merge gate** — run the full review crew over a change and
  record a ready or needs-work verdict, with the evidence behind it,
  before merging.
- **Claim check** — take one stated claim, find the evidence for or
  against it, and report only what that evidence supports.

### build-crew

A crew for building a scoped change: a coordinator holds the scope, an
architect shapes the approach, builders implement it, tests are
covered by their own seat, and an independent checker gates the
result.

*When to use:* when we have an agreed change to implement and want the
build, the tests, and the final check kept as separate seats.

| Entry | Role |
|---|---|
| agents orchestrator | Coordinator |
| engineering software architect | Architect |
| engineering senior developer | Builder |
| engineering minimal change engineer | Minimal-change engineer |
| testing test automation engineer | Tests |
| testing reality checker | Gate |

Routines:

- **Scoped build loop** — plan one bounded change, implement it, run
  its checks, and repeat only while the evidence says the change is
  not yet right.
- **Minimal-diff pass** — re-read the finished diff and remove
  anything that does not serve the agreed change before the gate
  review.

### research-crew

A crew for surveys and adoption decisions: a coordinator frames the
question, researchers gather and synthesise sources and map the
codebase, a tool evaluator vets candidates, and an independent
checker gates the conclusions.

*When to use:* when we need the landscape mapped, a tool vetted, or an
existing codebase understood before deciding.

| Entry | Role |
|---|---|
| agents orchestrator | Coordinator |
| research synthesist | Lead researcher |
| specialized codebase archaeologist | Codebase archaeologist |
| testing tool evaluator | Tool evaluator |
| graphify | Graph |
| testing reality checker | Gate |

Routines:

- **Landscape survey** — map the options for a question in a
  comparison table with the parameters named, and keep any
  recommendation separate from the survey.
- **Vet before adopt** — inspect a candidate tool or skill first-hand
  for license, safety, and fit before recommending that we adopt it.

### standing-crew

The daily-driver crew behind the starter prompt: a coordinator, the
memory scaffolding practice, the house voice shape, an evidence
habit, and an independent checker.

*When to use:* as the standing setup for everyday sessions where we
want memory kept, output shaped for quick reading, and claims backed
by shown work.

| Entry | Role |
|---|---|
| agents orchestrator | Coordinator |
| Memory scaffolding | Memory |
| i have adhd | Voice |
| show-me-your-work | Evidence |
| testing reality checker | Gate |

Routines:

- **Session start** — load the memory scaffolding and the house rules,
  confirm the target of the session, and only then dispatch work.
- **Session close** — record what changed, what was verified, and what
  remains open, so the next session starts from the record rather than
  from memory.

## Commands

Install a shipped template (the front door installs too, as always):

```bash
python3 bootstrap.py --template review-crew
python3 bootstrap.py --template standing-crew --dest ~/somewhere/skills
```

`--template` cannot be combined with `--packs`. `--list` honours
crews: `python3 bootstrap.py --list --template review-crew` prints the
plan, including a crew-origin line (`crew: review-crew (origin:
template)`), and writes nothing. The install header prints the same
crew-origin line on a real install.

Export the current selection as a crew file, then exit without
installing:

```bash
python3 bootstrap.py --template review-crew --export-crew ~/crews/review.json
python3 bootstrap.py --packs seo,legal --export-crew ~/crews/seo-legal.json
python3 bootstrap.py --export-crew ~/crews/default.json
```

Export naming: a template or imported crew exports under its own name;
a `--packs a,b` selection exports as `custom-a-b`; the default
selection exports as `default-crew`. Members always carry a `role`
(`""` when the source selection has none), and routines are carried
when the source selection has them (template/import), otherwise
omitted. Export targets that are symlinks, or that resolve inside
this repository tree, are refused; an existing file is refused too,
unless `--force` is passed. The file is written atomically
(temp sibling + rename).

Import a crew file and install it:

```bash
python3 bootstrap.py --import-crew ~/crews/review.json
```

`--import-crew` cannot be combined with `--template` or `--packs`.
Export → import is a round trip: installing the exported file installs
the same file tree as installing the source selection directly.

Bundles follow the selection, as installs do: a bundle run with a crew
writes one zip per *included member* plus `front-door.zip` (the front
door never becomes an entry zip):

```bash
python3 bootstrap.py --template review-crew --bundle ~/bundles
# writes the 5 member zips + front-door.zip
```

## Crews on the board (cast mapping)

This section is documentation only — the board files are unchanged.

A crew's member entries are the seats; the board's status lines name
agents by the `agent` value in each JSONL line (see
`front-door/status-contract.md`). When a run follows a crew, we name
each seat by the role the crew assigns it, so the board cast is the
crew's cast. A worked mini-example for review-crew:

```json
{"agent": "Coordinator", "task": "Scope the review of the change", "phase": "review", "status": "running", "artifact": "crew plan"}
{"agent": "Reviewer", "task": "Read the diff for correctness", "phase": "review", "status": "running", "artifact": "diff notes"}
{"agent": "Gate", "task": "Gate the verdict on the evidence", "phase": "gate", "status": "waiting", "artifact": "verdict", "waiting_on": "Reviewer and Evidence"}
```

The `agent` values (`Coordinator`, `Reviewer`, `Gate`) are the
review-crew roles from the membership table above; the remaining seats
(`Evidence`, `Security`) appear the same way when they report.

## Paperclip bridge (`--export-paperclip`)

Paperclip (paperclipai/paperclip) organises a team as a directory of
markdown files with YAML frontmatter. We can write the current
selection in that shape:

```bash
python3 bootstrap.py --template review-crew --export-paperclip ~/paperclip-teams
# writes ~/paperclip-teams/review-crew/
```

The export refuses when `<dir>/<crew-slug>` already exists — it never
overwrites or merges an existing team directory. It also refuses a
selection with no crew description (the default and `--packs`
selections): Paperclip's catalog builder hard-requires a non-empty
`description` in `TEAM.md` frontmatter (verified first-hand in
`packages/teams-catalog/src/catalog-builder.ts` at
paperclipai/paperclip@e9e84bb8a16393543effd1d45f34a4aad535d394,
2026-10-27), and the export never invents one or ships the key empty.
It builds in a temp sibling directory and renames into place. It writes no
`.paperclip.yaml`: Paperclip's catalog manifest (`CatalogManifest`) is
generated by a Paperclip server, so this export produces the team
directory shape only and is labelled as such.

### Mapping

The manager rule: the member whose role is exactly `Coordinator` if
exactly one member has that role, else the first member.

| Crew concept | Paperclip shape |
|---|---|
| The crew | `<dir>/<crew-slug>/` with `TEAM.md` (frontmatter `schema: agentcompanies/v1`, `name`, `description` — the crew's own description, carried verbatim, `slug`, `manager` naming the manager's `AGENTS.md` path), plus `projects/<crew-slug>/PROJECT.md` |
| Member of manifest type persona or agent | `agents/<folder>/AGENTS.md` — frontmatter `name` / `slug` / `title` (the member's role) / `reportsTo` (the manager's slug; omitted on the manager itself), body = the member's `SKILL.md` with its own frontmatter stripped |
| Member of manifest type skill | `skills/<folder>/` — the whole entry copied as-is; skill-type members are also listed in the manager's `AGENTS.md` `skills:` frontmatter, by folder slug |
| Included member with no root `SKILL.md` (today: only Memory scaffolding) | `references/<folder>/` — all its files copied; named in the `TEAM.md` body as a reference member |
| Link-only member | Never exported as an agent; named in the `TEAM.md` body as an external pointer with its `source_url` |
| Routine | `tasks/<routine-slug>/TASK.md` — one per routine, frontmatter naming the routine and its project |

### Verified vs unverified

Verified first-hand against paperclipai/paperclip@master on
2026-10-27:

- the `TEAM.md` / `AGENTS.md` / `PROJECT.md` / `TASK.md` frontmatter
  shapes this export writes;
- the `skills/<slug>/` and `agents/<slug>/` directory shapes;
- the `CatalogTeamFileKind` vocabulary, which includes `reference`,
  `markdown`, and `other`.

Unverified:

- live import of an exported directory into a running Paperclip
  server (no server was available here);
- which file kind Paperclip's catalog code assigns to files under a
  `references/` path. `references/` is our convention for members with
  no root `SKILL.md`; the kind vocabulary includes
  reference/markdown/other (verified above), but the assignment is
  UNVERIFIED and no special Paperclip behaviour is claimed for it;
- catalog submission — submitting a team into Paperclip's catalog is
  a separate step that needs the maintainers' own word; it is not
  done here.
