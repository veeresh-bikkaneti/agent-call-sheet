# Install — Grok Build (CLI)

## What you are installing

The **core starter set** — the suggested first install — is:

1. This front door: the `crew-orchestrator` skill (`../crew-orchestrator/`) plus the starter prompt (`../starter-prompt.md`).
2. The Rigor pack from `../../packs/`.

Add other packs later, one at a time, when real work calls for them.

## Where the library lives

- The full index is `../../MANIFEST.md`.
- The packs live in `../../packs/`.
- Some entries are **link-only**: the kit does not contain their code. Fetch those from their home repos — each pack lists them in `../../packs/<pack>/LINKS.md` — and respect each one's license.

## Steps

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
