# The Agent Call Sheet

**Every agent on the call. Every role cast. Every task on a card.**

One builder's AI crew system, packaged as a library plus a front door — named for the film-crew call sheet: the one document that lists the whole cast, their roles, and who is called for what.

This is not a single chatbot prompt and it is not an installer. It is the set of skills, personas, and house rules one builder actually runs — a coordinator, specialist seats, and an independent reality checker who gates the work — organised so you can copy in the parts you want, on the platform you already use.

## What this is

The repo has two layers today, and a third that does not exist yet.

**Layer 1 — Library (`packs/` + the manifest)**
The toolbox. Skills and personas grouped into packs, plus a manifest that records for every entry where it came from, what license evidence was found, and whether its files are included here or linked only. See "The manifest" below.

**Layer 2 — Front door (`front-door/`)**
The way in. A starter prompt that sets the house rules, a Crew Orchestrator skill that turns the host agent into a crew coordinator, and per-surface install guides. If you install nothing else, install this layer.

**Layer 3 — Bootstrap (future phase P2 — does not exist yet)**
A bootstrap / installer that would set the system up for you is planned as a future phase (P2). It is **not in this repo** and does not exist yet. No installer ships in P1. In P1, installation is manual copy, following the guides in `front-door/install/`.

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
| Memory & Comms | 3 | `/i-have-adhd` output shaping, plus the memory and catch-up practices |
| Design / Video / 3D | 45 | Remotion, OpenFilm, Three.js skills, UI/UX and frontend design, page-mascot, motionmaxxing, plus reference libraries listed link-only |
| SEO | 33 | One leaf skill per job: canonical, sitemap, Core Web Vitals, schema, keywords, local, programmatic, and the rest |
| Legal | 2 | `legal-advisor`, `gdpr-privacy` |

Total across packs: **141 entries**. See the count note under "The manifest" — that number is the evidenced count, and it is the only count this repo claims for the manifest.

## See it work: The Fork

**Watch it: [`episode/ai-crew-the-fork.html`](episode/ai-crew-the-fork.html)** — open it in any browser; it is one self-contained file. **Trailer: [`episode/ai-crew-the-fork-trailer.mp4`](episode/ai-crew-the-fork-trailer.mp4)** (40 seconds, a real capture of the episode's Route 2).

*The Fork* is a playable, scripted episode of the crew running one mission end to end. It is labelled honestly as scripted: the council debates in named moves, the film freezes and you must pick a route, the reality checker bounces both routes once, and your pick decides the ending. A live crew board shows every subagent's task, phase, and status throughout.

The episode ships with the drawn cast on stage: click any character to see its current task, phase, and status; at the standup the blocked character shakes; when a task is assigned or sent back, its card visibly flies between the characters. It passed its independent Reality Checker gate (121/121) in this form.

## Quickstart

### Zero-install path (any platform)

1. Open `front-door/starter-prompt.md`.
2. Paste the prompt once into your assistant, or into its custom / standing instructions if your platform has them.
3. That sets the house rules the crew runs under. The packs are the toolbox it draws on; adopt skills and personas one at a time, vetted first.

This path needs no files installed and works with any agent that can follow instructions.

### With files installed

Suggested first install: **the front door + the Rigor pack**. That gives you the coordinator and the discipline stack before you add specialist seats.

Then follow the guide for your surface in `front-door/install/`:

| Surface | Guide |
|---|---|
| Claude Code | `front-door/install/` — Claude Code README |
| Claude web | `front-door/install/` — Claude web README |
| Grok web | `front-door/install/` — Grok web README |
| Grok Build | `front-door/install/` — Grok Build README |
| Prompt-only (no file install) | `front-door/install/` — prompt-only README |

Each install README gives the manual copy steps for that surface: what to copy, where it goes on that platform, and what is known or unverified about that surface (see "Honesty notes" below). There is no installer to run — P1 is manual copy only.

After the front door and Rigor, add packs by need: Crew Personas for specialist seats, Memory & Comms for the communication shape, then Design / Video / 3D, SEO, or Legal as your work requires.

## The manifest

`manifest.csv` is the machine-readable manifest. `MANIFEST.md` is the same manifest in human-readable form. Together they are the record for the library — if an entry is not in the manifest, this repo makes no claim about it.

Each entry records: name, pack, type, author, source, license, the license evidence relied on, distribution (`include` or `link-only`), local path where included, file count, frontmatter status, and notes.

### Counts, stated plainly

- **141 entries** in the manifest.
- **33 included** — files copied into this repo, byte-identical to the source install: **998 files**, every file sha256-verified against the source install.
- **106 link-only** — no code copied. The manifest entry points you to the author's home repo; you fetch it there, under its own license.
- **2 practice entries** — practices with no artifact to copy or link (ways of working, not files).

Reconciliation with the kit catalog: the catalog headline says "~180 skills and personas". Only **141 distinct entries** could be enumerated and evidenced on disk, so 141 is what the manifest lists. The ~180 figure appears to count sub-skills and rules inside bundles, and staged seats, individually. The manifest does not pad its count to match the headline, and this README does not present 180 as the manifest count anywhere.

### Include vs link-only, and why

Distribution was decided on license evidence, entry by entry. An entry was included only where one of these held:

- a permissive LICENSE file in the folder (MIT / Apache-2.0),
- MIT stated in the kit catalog (the pstack set, `i-have-adhd`),
- MIT declared in the skill's own frontmatter (`karpathy-guidelines`, `gdpr-privacy`), or
- the material is Liz's own.

Everything doubtful went link-only. Link-only is not a lesser status — it is the honest one where copying was not evidenced as permitted. For link-only entries, `packs/*/LINKS.md` and `MANIFEST.md` carry the pointer to the home repo.

### Frontmatter status

Frontmatter status is recorded per entry in the manifest. Across the installed entries:

- **84** already carry spec-compliant `name` + `description` frontmatter.
- **47** have none as installed — mostly the Agency personas. They work on file-based platforms as-is.

A normalisation pass to add spec-compliant frontmatter to the entries that lack it is future, per-pack work. It has not been done here, and the included files are byte-identical to the source install — normalising them in this repo would have broken that.

## Third-party attribution

Most of this library is other people's work, and it stays credited as theirs.

- Every third-party entry keeps its author / source / license line in `MANIFEST.md` (and the same fields in `manifest.csv`).
- Included third-party files were copied only on the license evidence listed above, and keep their own license files where they had them.
- Link-only entries are not redistributed here at all. Fetch them from their home repos and use them under their own licenses.

When in doubt about an entry, read its manifest row before using it — the row states the author, the source, and the basis on which it is here.

## Licensing

Read this section carefully; it is deliberately narrow.

- **Liz's own original material** in this repo — the starter prompt, the house rules, the Crew Orchestrator skill, `agents-orchestrator`, and `production-path-verification` — is licensed under the **Apache License, Version 2.0** (chosen by Liz on 2026-10-25; see the `LICENSE` file at the repo root and the scope note in `NOTICE`). The Apache-2.0 grant covers her material only.
- **Third-party material** stays under its own licenses, as recorded per entry in the manifest. Nothing in this repo relicenses anyone else's work.
- The kit catalog's sharing note ("the house rules and the starter prompt are mine; take those freely") described the catalog's intent before a formal license was chosen; the Apache-2.0 grant above is now the operative license for that material.

## Honesty notes

These limits come from the kit's own platform checks. Detail is in the install READMEs in `front-door/install/`; this section is the short version so nobody has to discover them by surprise.

- **Claude web:** custom-upload availability splits by plan. What you can upload, and where the front door goes, depends on the plan — check the Claude web install README before assuming the file path works for you.
- **Grok web:** the click-path and plan gating are **unverified**. The Grok web guide describes the expected route; it has not been confirmed click by click against a gated plan.
- **Grok Build:** compatibility is **attributed, not tested**. Claims about Grok Build support come from the platform's own material, not from a tested install by the kit's builder.
- **Other Muse users:** packaging this kit for other Muse users is **unverified**. The kit was built and run on one builder's setup; that it transfers cleanly to another Muse user's setup has not been proven.

None of these are hidden caveats — they are the current state. Where a surface is unverified, the install README for that surface says so in the same place as its steps.
