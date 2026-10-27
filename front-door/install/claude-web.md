# Install — Claude web (claude.ai)

## One-command setup (bootstrap)

From the repo root, run: `python3 bootstrap.py --target claude-web` — that is the headline setup path. It stages the front door plus the Rigor core set (17 entries) for upload (see Staging below). For upload-ready zips, run `python3 bootstrap.py --target claude-web --bundle bundles` and upload each entry zip as the manual steps describe. One exception: `front-door.zip` is an archive of the whole front door, not a single skill — unzip it, zip and upload the `crew-orchestrator` folder from it, and paste `starter-prompt.md` into the conversation as text.

Claude web cannot be installed into directly from a script; bootstrap stages the files and you upload them in claude.ai.

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

1. Turn on **code execution / file creation** in claude.ai first. Custom skill uploads need it on.
2. Take one skill folder — start with `crew-orchestrator` (`../crew-orchestrator/`). The folder must contain its `SKILL.md` at the top of the folder.
3. **Zip the skill folder itself** — zip the folder, not just the files inside it, and not the whole kit.
4. In claude.ai, go to **Customize > Skills → Upload** and upload the zip.
   - The menu label has moved over time; on your account it may read **Settings** instead of Customize. Look for the Skills upload entry under either label.
5. Repeat steps 2–4 for each skill folder in the Rigor pack (`../../packs/`) — except the three whose `SKILL.md` has no frontmatter (`local-agents-orchestrator`, `local-archify`, `production_path_verification`): claude.ai cannot take those as uploads until they gain frontmatter; they work today in Claude Code, which loads a folder skill by its folder name. One zip per skill, and each upload must total under 30 MB — the design pack's `local-ui-ux-pro-max-skill` is a multi-skill folder tree for Claude Code, not a web upload.
6. For link-only entries, follow `../../packs/<pack>/LINKS.md` to the home repo, get the skill folder there, then zip and upload it the same way.
7. Paste the starter prompt (`../starter-prompt.md`) into a conversation once, or into custom instructions if your setup offers them.

## Frontmatter rules (checked on upload)

- `name`: **≤64 chars**, lowercase letters, numbers, and hyphens only, and it **cannot contain "anthropic" or "claude"**.
- `description`: **≤1024 chars**, and it must say both what the skill does and when to use it.

The kit's `crew-orchestrator` skill already follows these rules.

Those two rules are not the whole gate. Uploads and packaging also reject any frontmatter key outside the Agent Skills spec (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) with a hard error, and a `SKILL.md` with no frontmatter — or frontmatter that does not parse — cannot be uploaded as a skill at all. Measured on the current kit (2026-10-26): of the 119 bundle zips, 49 would fail the name/description/frontmatter rules and 57 would fail at least one documented upload rule — including 3 entries in the default set whose `SKILL.md` has no frontmatter (`local-agents-orchestrator`, `local-archify`, `production_path_verification`). The front door and most individual skills are clean; treat the persona packs as Claude Code-first until their frontmatter is normalised.

## Honesty notes — plans, stated exactly as a split

- **using Skills = all plans incl. Free (Claude Academy); uploading your own custom Skills = Pro, Max, Team, and Enterprise per current Anthropic platform docs — check your plan.**
- Do not read that as "custom uploads work on Free." The two halves above are different claims from different official sources, and the kit keeps them split on purpose.
- **No cross-surface sync.** Skills uploaded to claude.ai must be separately uploaded to the API, and Claude Code skills are filesystem-based and separate from both. Each surface is uploaded separately.
