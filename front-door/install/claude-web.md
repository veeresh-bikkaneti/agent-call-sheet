# Install — Claude web (claude.ai)

## One-command setup (bootstrap)

From the repo root, run: `python3 bootstrap.py --target claude-web` — that is the headline setup path. It stages the front door plus the Rigor core set (17 entries) for upload (see Staging below). For upload-ready zips, run `python3 bootstrap.py --target claude-web --bundle bundles` and upload each zip as the manual steps describe.

Claude web cannot be installed into directly from a script; bootstrap stages the files and you upload them in claude.ai.

Staging: non-Claude targets stage into `./agent-call-sheet-<target>/` relative to your current working directory unless `--dest` is given; those surfaces cannot be installed into directly, so the files are staged for upload or paste. `--dest` always wins over target defaults; the Claude Code default is `~/.claude/skills`.

Verification, stated plainly: copy-fidelity checked against the repo source (sha256 of each copied file matches the source file); file counts checked against the manifest — the manifest carries no independent per-file hash.

Honesty note: some installed skills contain scripts that the host platform may run when a skill is used; "executes nothing" describes bootstrap.py only — bootstrap itself fetches nothing and executes nothing.

Bundles are generated on demand by `--bundle DIR` (one zip per included entry in scope, plus `front-door.zip`); they are not shipped in this repo.

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
5. Repeat steps 2–4 for each skill folder in the Rigor pack (`../../packs/`).
6. For link-only entries, follow `../../packs/<pack>/LINKS.md` to the home repo, get the skill folder there, then zip and upload it the same way.
7. Paste the starter prompt (`../starter-prompt.md`) into a conversation once, or into custom instructions if your setup offers them.

## Frontmatter rules (checked on upload)

- `name`: **≤64 chars**, lowercase letters, numbers, and hyphens only, and it **cannot contain "anthropic" or "claude"**.
- `description`: **≤1024 chars**, and it must say both what the skill does and when to use it.

The kit's `crew-orchestrator` skill already follows these rules.

## Honesty notes — plans, stated exactly as a split

- **using Skills = all plans incl. Free (Claude Academy); uploading your own custom Skills = Pro, Max, Team, and Enterprise per current Anthropic platform docs — check your plan.**
- Do not read that as "custom uploads work on Free." The two halves above are different claims from different official sources, and the kit keeps them split on purpose.
- **No cross-surface sync.** Skills uploaded to claude.ai must be separately uploaded to the API, and Claude Code skills are filesystem-based and separate from both. Each surface is uploaded separately.
