# Install — Claude Code

## One-command setup (bootstrap)

From the repo root, run: `python3 bootstrap.py` — that is the whole headline setup path. A bare run targets Claude Code, installs into `~/.claude/skills`, and copies the front door plus the Rigor core set (17 entries). Add packs with e.g. `--packs seo,legal`; preview with `--list` (writes nothing).

After it runs, start a new session and ask the agent to confirm it can see the `crew-orchestrator` skill by name, exactly as the manual steps below advise.

Staging: non-Claude targets stage into `./agent-call-sheet-<target>/` relative to your current working directory unless `--dest` is given; those surfaces cannot be installed into directly, so the files are staged for upload or paste. `--dest` always wins over target defaults; the Claude Code default is `~/.claude/skills`. Run from the repo root, `./agent-call-sheet-<target>/` and a bundle folder named `./bundles/` are the in-repo output locations the script allows (both gitignored, so `git status` stays clean); a `--dest` or bundle dir that resolves into the repo's tracked content is refused.

Verification, stated plainly: copy-fidelity checked against the repo source (sha256 of each copied file matches the source file); file counts checked against the manifest — the manifest carries no independent per-file hash.

Honesty note: some installed skills contain scripts that the host platform may run when a skill is used; "executes nothing" describes bootstrap.py only — bootstrap itself fetches nothing and executes nothing.

Bundles are generated on demand by `--bundle DIR` (scope is the selection scope: with no `--packs`, the default scope — front door plus the Rigor core set, 17 entries, 18 zips in all; with `--packs`, that selection's scope — one zip per included entry in that scope, plus `front-door.zip`); they are not shipped in this repo.

The manual steps below remain as a clearly labelled fallback if you cannot or do not want to run the script.

## What you are installing

The **core starter set** — the suggested first install — is:

1. This front door: the `crew-orchestrator` skill (`../crew-orchestrator/`) plus the starter prompt (`../starter-prompt.md`).
2. The Rigor pack from `../../packs/`.

Add other packs later, one at a time, when real work calls for them.

## Where the library lives

- The full index is `../../MANIFEST.md`.
- The packs live in `../../packs/`.
- Some entries are **link-only**: the kit does not contain their code. Fetch those from their home repos — each pack lists them in `../../packs/<pack>/LINKS.md` — and respect each one's license.

## Manual fallback — steps

1. Get the kit onto your machine (clone or download it, and unzip it if needed).
2. Open the kit's `front-door/crew-orchestrator/` folder. A skill in Claude Code is a **folder containing a `SKILL.md`** — the folder is the skill, not just the file inside it.
3. Copy the whole `crew-orchestrator` folder into your Claude Code skills folder.
4. Do the same for each skill folder in the Rigor pack (`../../packs/`) that you want: copy the whole folder, with its `SKILL.md` and any supporting files, into the same skills folder.
5. For link-only entries, follow `../../packs/<pack>/LINKS.md` to the home repo, get the skill there, and copy its folder in the same way.
6. Paste the starter prompt (`../starter-prompt.md`) into your assistant once, or into its standing instructions, so the house rules are in force.
7. Start a new session and ask the agent to confirm it can see the `crew-orchestrator` skill by name before you rely on it.

## Honesty notes

- **No cross-surface sync.** A skill installed in Claude Code does not appear anywhere else by itself. Each surface is uploaded or copied separately — claude.ai, Claude Code, and the API are separate installs. Installing here installs it here only.
- Folder layout was checked against Anthropic's published skill structure. Whether a given skill triggers correctly on your setup depends on its frontmatter and your session — verify it by name in step 7 rather than assuming it loaded.

Measured on the current kit (2026-10-26): 6 of the 132 shipped `SKILL.md` files have no frontmatter at all — including `local-agents-orchestrator`, `local-archify`, and `production_path_verification` in the default set. Per Anthropic's Claude Code docs, a folder skill still loads under its folder name when frontmatter is missing or unparseable, but its listing description falls back to the file's first line, so do not expect those skills to trigger automatically — invoke them by name.
