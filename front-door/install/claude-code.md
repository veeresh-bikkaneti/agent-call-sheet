# Install — Claude Code

## What you are installing

The **core starter set** — the suggested first install — is:

1. This front door: the `crew-orchestrator` skill (`../crew-orchestrator/`) plus the starter prompt (`../starter-prompt.md`).
2. The Rigor pack from `../packs/`.

Add other packs later, one at a time, when real work calls for them.

## Where the library lives

- The full index is `../MANIFEST.md`.
- The packs live in `../packs/`.
- Some entries are **link-only**: the kit does not contain their code. Fetch those from their home repos — each pack lists them in `../packs/<pack>/LINKS.md` — and respect each one's license.

## Steps

1. Get the kit onto your machine (clone or download it, and unzip it if needed).
2. Open the kit's `front-door/crew-orchestrator/` folder. A skill in Claude Code is a **folder containing a `SKILL.md`** — the folder is the skill, not just the file inside it.
3. Copy the whole `crew-orchestrator` folder into your Claude Code skills folder.
4. Do the same for each skill folder in the Rigor pack (`../packs/`) that you want: copy the whole folder, with its `SKILL.md` and any supporting files, into the same skills folder.
5. For link-only entries, follow `../packs/<pack>/LINKS.md` to the home repo, get the skill there, and copy its folder in the same way.
6. Paste the starter prompt (`../starter-prompt.md`) into your assistant once, or into its standing instructions, so the house rules are in force.
7. Start a new session and ask the agent to confirm it can see the `crew-orchestrator` skill by name before you rely on it.

## Honesty notes

- **No cross-surface sync.** A skill installed in Claude Code does not appear anywhere else by itself. Each surface is uploaded or copied separately — claude.ai, Claude Code, and the API are separate installs. Installing here installs it here only.
- Folder layout was checked against Anthropic's published skill structure. Whether a given skill triggers correctly on your setup depends on its frontmatter and your session — verify it by name in step 7 rather than assuming it loaded.
