# The Agent Call Sheet

**Every agent on the call. Every role cast. Every task on a card.**

One builder's AI crew system, packaged as a library plus a front door — named for the film-crew call sheet: the one document that lists the whole cast, their roles, and who is called for what.

This is not a single chatbot prompt, and setup is no longer manual-only: alongside the library it ships a one-command bootstrap (`bootstrap.py`, Layer 3 below). It is the set of skills, personas, and house rules one builder actually runs — a coordinator, specialist seats, and an independent reality checker who gates the work — organised so you can copy in the parts you want, on the platform you already use.

## What this is

The repo has three layers today.

**Layer 1 — Library (`packs/` + the manifest)**
The toolbox. Skills and personas grouped into packs, plus a manifest that records for every entry where it came from, what license evidence was found, and whether its files are included here or linked only. See "The manifest" below.

**Layer 2 — Front door (`front-door/`)**
The way in. A starter prompt that sets the house rules, a Crew Orchestrator skill that turns the host agent into a crew coordinator, and per-surface install guides. If you install nothing else, install this layer.

**Layer 3 — Bootstrap (`bootstrap.py`)**
A one-command bootstrap now ships at the repo root: `python3 bootstrap.py` (Python standard library only; it fetches nothing and executes nothing) copies the front door plus the Rigor core set into place. The manual copy steps in `front-door/install/` remain as a clearly labelled fallback.

### Layout

```text
packs/          Layer 1: the library, in six packs
front-door/     Layer 2: starter prompt, Crew Orchestrator skill, install guides
  starter-prompt.md
  crew-orchestrator/
  install/      one README per surface
manifest.csv    Layer 1: machine-readable manifest, one row per entry
MANIFEST.md     Layer 1: human-readable manifest, same entries
```

### The packs

| Pack | Entries | Contents |
|---|---|---|
| Crew Personas | 41 | Specialist seats: reality checker, architects, developers, reviewers, test and evidence seats, security, AI/RAG/prompt/MCP, design, product, research, plus the staged game-studio seats. (The crew orchestrator itself lives in the Rigor pack.) |
| Rigor | 17 | The discipline stack: ponytail, karpathy-guidelines, pstack picks, agents-orchestrator, Archify, Graphify, production-path verification |
| Memory & Comms | 4 | `/i-have-adhd` output shaping, plus the memory and catch-up practices |
| Design / Video / 3D | 45 | Remotion, OpenFilm, Three.js skills, UI/UX and frontend design, page-mascot, motionmaxxing, plus reference libraries listed link-only |
| SEO | 33 | One leaf skill per job: canonical, sitemap, Core Web Vitals, schema, keywords, local, programmatic, and the rest |
| Legal | 2 | `legal-advisor`, `gdpr-privacy` |

Total across packs: **142 entries**. See the count note under "The manifest" — that number is the evidenced count, and it is the only count this repo claims for the manifest.

## See it work: The Fork

**Watch it: [`episode/ai-crew-the-fork.html`](episode/ai-crew-the-fork.html)** — open it in any browser; it is one self-contained file. **Trailer: [`episode/ai-crew-the-fork-trailer.mp4`](episode/ai-crew-the-fork-trailer.mp4)** (40 seconds, a real capture of the episode's Route 2).

*The Fork* is a playable, scripted episode of the crew running one mission end to end. It is labelled honestly as scripted: the council debates in named moves, the film freezes and you must pick a route, the reality checker bounces both routes once, and your pick decides the ending. A live crew board shows every subagent's task, phase, and status throughout.

The episode ships with the drawn cast on stage: click any character to see its current task, phase, and status; at the standup the blocked character shakes; when a task is assigned or sent back, its card visibly flies between the characters. It passed its independent Reality Checker gate (121/121) in this form.

## New here? Start with the beginner docs

**[`docs/`](docs/index.html)** walks through the kit in plain words, in this order: animated diagrams of how the kit fits together and how a job flows through it ([`docs/architecture.html`](docs/architecture.html)), the crew events played out in 3D ([`docs/events-3d.html`](docs/events-3d.html)), a sample council review with a real fail-then-pass arc ([`docs/council.html`](docs/council.html)), and a video of a real setup-and-usage run ([`docs/index.html`](docs/index.html), with its narration script at [`docs/demo-narration.md`](docs/demo-narration.md)).


## Quickstart

### Zero-install path (any platform)

1. Open `front-door/starter-prompt.md`.
2. Paste the prompt once into your assistant, or into its custom / standing instructions if your platform has them.
3. That sets the house rules the crew runs under. The packs are the toolbox it draws on; adopt skills and personas one at a time, vetted first.

This path needs no files installed and works with any agent that can follow instructions.

One honest caveat: on a paste-only surface, that prompt sets the discipline for that conversation — but auto-triggering, persistent file memory, and scheduled loops need a surface that keeps files and standing instructions.

### With files installed — one command (headline setup path)

From the repo root:

```bash
python3 bootstrap.py
```

A bare run targets Claude Code and copies the front door plus the Rigor pack (the core set, 17 entries) into `~/.claude/skills`. That gives you the coordinator and the discipline stack before you add specialist seats. Useful variants: `--packs seo,legal` adds packs, `--list` previews the plan and writes nothing, `--target claude-web|grok-build|prompt-only` stages files for surfaces that cannot be installed into directly, and `--bundle DIR` writes one zip per included entry in scope plus `front-door.zip`, where scope is the selection scope: with no `--packs`, the default scope (front door plus the Rigor core set, 17 entries — 18 zips in all); with `--packs`, that selection's scope. Bundles are generated on demand by `--bundle`; they are not shipped in this repo.

**Crew templates:** `front-door/templates/` ships four named crews — `review-crew`, `build-crew`, `research-crew`, and `standing-crew`. In one line: `--template <name>` installs a crew, `--export-crew <file>` / `--export-paperclip <dir>` write the current selection out, and `--import-crew <file>` installs a crew file. See [`front-door/templates.md`](front-door/templates.md).

Staging: non-Claude targets stage into `./agent-call-sheet-<target>/` relative to your current working directory unless `--dest` is given; those surfaces cannot be installed into directly, so the files are staged for upload or paste. `--dest` always wins over target defaults; the Claude Code default is `~/.claude/skills`. Run from the repo root, the staging folder (`./agent-call-sheet-<target>/`) and a bundle folder named `./bundles/` are the two in-repo output locations the script allows — both are gitignored, so staging there leaves `git status` clean; an install `--dest` or bundle dir that resolves into the repo's tracked content (the repo root itself, `packs/`, `front-door/`, `episode/`, `site/`, `docs/`, or `.git/`) is refused.

Verification, stated plainly: copy-fidelity checked against the repo source (sha256 of each copied file matches the source file); file counts checked against the manifest — the manifest carries no independent per-file hash.

Honesty note: some installed skills contain scripts that the host platform may run when a skill is used; "executes nothing" describes bootstrap.py only — bootstrap itself fetches nothing and executes nothing.

Then follow the guide for your surface in `front-door/install/`:

| Surface | Guide |
|---|---|
| Claude Code | `front-door/install/` — Claude Code README |
| Claude web | `front-door/install/` — Claude web README |
| Grok web | `front-door/install/` — Grok web README |
| Grok Build | `front-door/install/` — Grok Build README |
| Prompt-only (no file install) | `front-door/install/` — prompt-only README |

Each install README leads with the same one-command bootstrap path for that surface and keeps the manual copy steps as a clearly labelled fallback: what to copy, where it goes on that platform, and what is known or unverified about that surface (see "Honesty notes" below).

After the front door and Rigor, add packs by need: Crew Personas for specialist seats, Memory & Comms for the communication shape, then Design / Video / 3D, SEO, or Legal as your work requires.

## The manifest

`manifest.csv` is the machine-readable manifest. `MANIFEST.md` is the same manifest in human-readable form. Together they are the record for the library — if an entry is not in the manifest, this repo makes no claim about it.

Each entry records: name, pack, type, author, source, license, the license evidence relied on, distribution (`include` or `link-only`), local path where included, file count, frontmatter status, and notes.

### Counts, stated plainly

- **141 entries** in the manifest.
- **118 included** — files copied into this repo: **1,251 files** in the tree. Two cohorts: the original 33 entries (998 files), byte-identical to the source install, every file sha256-verified against it; and 85 entries (253 files) added 2026-10-26 by a re-sync from upstream at pinned commits, content bytes identical to upstream at the pin and verified per file by git blob SHA (evidence rule (e) in `MANIFEST.md`). The re-sync is why the cast is in the box: all 40 Agency personas, all 33 SEO leaf skills, the 10 Three.js skills, page-mascot and ui-ux-pro-max now ship here.
- **21 link-only** — no files copied. The manifest entry points you to the author's home repo; you fetch it there, under its own license. Six of the 21 have verified licenses but stay link-only by recorded decision (reference libraries and a staged pack — see `MANIFEST.md`); the rest have no evidenced grant.
- **2 practice entries** — practices with no artifact to copy or link (ways of working, not files).

Reconciliation with the kit catalog: the catalog headline says "~180 skills and personas". Only **141 distinct entries** could be enumerated and evidenced on disk, so 141 is what the manifest lists. The ~180 figure appears to count sub-skills and rules inside bundles, and staged seats, individually. The manifest does not pad its count to match the headline, and this README does not present 180 as the manifest count anywhere.

### Include vs link-only, and why

Distribution was decided on license evidence, entry by entry. An entry was included only where one of these held:

- a permissive LICENSE file in the folder (MIT / Apache-2.0),
- MIT stated in the kit catalog (the pstack set, `i-have-adhd`),
- MIT declared in the skill's own frontmatter (`karpathy-guidelines`, `gdpr-privacy`),
- a permissive license at the upstream source repo's root, verified at a pinned commit with the safeguards recorded in `MANIFEST.md` (rule (e), added 2026-10-26), or
- the material is our own.

Everything doubtful went link-only. Link-only is not a lesser status — it is the honest one where copying was not evidenced as permitted. For link-only entries, `packs/*/LINKS.md` and `MANIFEST.md` carry the pointer to the home repo.

### Frontmatter status

Frontmatter status is recorded per entry in the manifest. Counted over the files actually in this repo (131 `SKILL.md` files under `packs/`):

- **125** carry spec-compliant `name` + `description` frontmatter — including all 85 entries added by the 2026-10-26 re-sync, whose pinned upstream files carry frontmatter.
- **6** have none. They work on file-based platforms as-is; `MANIFEST.md` names them.

(An earlier version of this section counted the source install on the maintainer's machine — 84 with, 47 without. That census has been corrected to count this repo.)

A normalisation pass to add spec-compliant frontmatter to the entries that lack it is future, per-pack work. It has not been done here: the included files match their sources byte for byte — the original inclusions against the source install, the re-synced entries against upstream at their pinned commits — and normalising them in this repo would break that.

## Third-party attribution

Most of this library is other people's work, and it stays credited as theirs.

- Every third-party entry keeps its author / source / license line in `MANIFEST.md` (and the same fields in `manifest.csv`).
- Included third-party files were copied only on the license evidence listed above, and keep their own license files where they had them. Entries added by the 2026-10-26 re-sync carry the source repo's root license text in an `UPSTREAM-LICENSE` file inside the entry folder.
- Link-only entries are not redistributed here at all. Fetch them from their home repos and use them under their own licenses.

When in doubt about an entry, read its manifest row before using it — the row states the author, the source, and the basis on which it is here.

## Licensing

Read this section carefully; it is deliberately narrow.

- **Our own original material** in this repo — the starter prompt, the house rules, the Crew Orchestrator skill, `agents-orchestrator`, and `production-path-verification` — is licensed under the **Apache License, Version 2.0** (see the `LICENSE` file at the repo root and the scope note in `NOTICE`). The Apache-2.0 grant covers our material only.
- **Third-party material** stays under its own licenses, as recorded per entry in the manifest. Nothing in this repo relicenses anyone else's work.
- The kit catalog's sharing note ("the house rules and the starter prompt are mine; take those freely") described the catalog's intent before a formal license was chosen; the Apache-2.0 grant above is now the operative license for that material.

## Honesty notes

These limits come from the kit's own platform checks. Detail is in the install READMEs in `front-door/install/`; this section is the short version so nobody has to discover them by surprise.

- **Claude web:** custom-upload availability splits by plan. What you can upload, and where the front door goes, depends on the plan — check the Claude web install README before assuming the file path works for you.
- **Grok web:** the click-path and plan gating are **unverified**. The Grok web guide describes the expected route; it has not been confirmed click by click against a gated plan.
- **Grok Build:** compatibility is **attributed, not tested**. Claims about Grok Build support come from the platform's own material, not from a tested install by the kit's builder.
- **Other Muse users:** packaging this kit for other Muse users is **unverified**. The kit was built and run on one builder's setup; that it transfers cleanly to another Muse user's setup has not been proven.

None of these are hidden caveats — they are the current state. Where a surface is unverified, the install README for that surface says so in the same place as its steps.
