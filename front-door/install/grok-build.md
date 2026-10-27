# Install — Grok Build (CLI)

## One-command setup (bootstrap)

From the repo root, run: `python3 bootstrap.py --target grok-build` — that is the headline setup path. It stages the front door plus the Rigor core set (17 entries) (see Staging below); copy the staged folders into your project's `.grok/skills/`, or re-run with `--dest .grok/skills` from your project root to copy them straight there.

Bootstrap staging is not itself a Grok Build install until the folders sit in `.grok/skills/` (or a `.claude` layout Grok Build reads); confirm discovery by name as the manual steps advise.

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

1. Get the kit onto your machine (clone or download it, and unzip it if needed).
2. In your project, create the skills directory if it does not exist: `.grok/skills/`
3. Copy the whole `crew-orchestrator` folder (`../crew-orchestrator/`) into `.grok/skills/`. A skill is a **folder containing a `SKILL.md`** — copy the folder, not just the file.
4. Copy each skill folder you want from the Rigor pack (`../../packs/`) into `.grok/skills/` the same way.
5. For link-only entries, follow `../../packs/<pack>/LINKS.md` to the home repo, get the skill there, and copy its folder in the same way.
6. Alternative layout: Grok Build also reads the `.claude` layout. If you already have skills under a `.claude/skills/`-style layout, Grok Build is documented as discovering them there — you do not need to duplicate them into `.grok/skills/` to try this.
7. Paste the starter prompt (`../starter-prompt.md`) into your session once, or into the project's standing instructions, so the house rules are in force.
8. Start Grok Build in the project and confirm it lists or invokes `crew-orchestrator` before you rely on it.

## Honesty notes — attribution matters here

- **Compatibility wording, attributed:** "xAI documents Grok Build as 'fully compatible with Claude Code with zero configuration needed'" — per secondary sources quoting xAI docs; the official docs page was not opened first-hand in our check and compatibility was NOT tested by us.
- **Plan/pricing is secondary-source only, UNVERIFIED.** Secondary sources describe running Grok Build as needing SuperGrok / X Premium+ / an API key. That was not verified first-hand for this kit. Check xAI's current terms for your own account rather than relying on those reports.
- No Grok Build install was run as part of preparing this kit. The steps above follow the documented `.grok/skills` folder layout; step 8 exists precisely because discovery on your machine still needs your own check.
- No cross-surface sync: copying folders into `.grok/skills/` installs them for Grok Build only. Other surfaces are separate installs.
