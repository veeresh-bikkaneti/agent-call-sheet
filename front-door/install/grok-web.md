# Install — Grok web (grok.com / iOS / Android)

## One-command setup (bootstrap)

There is no `--target grok-web`: Grok web skills are created inside Grok itself, so no script can install into it. The closest headline path is `python3 bootstrap.py --target prompt-only`, which stages the front door plus the Rigor core set (17 entries) as source text (see Staging below) for the in-Grok creation methods in the manual steps.

Treat the staged files as the source text for creating each skill in Grok; nothing about the in-Grok steps changes.

Staging: non-Claude targets stage into `./agent-call-sheet-<target>/` relative to your current working directory unless `--dest` is given; those surfaces cannot be installed into directly, so the files are staged for upload or paste. `--dest` always wins over target defaults; the Claude Code default is `~/.claude/skills`. Run from the repo root, `./agent-call-sheet-<target>/` and a bundle folder named `./bundles/` are the in-repo output locations the script allows (both gitignored, so `git status` stays clean); a `--dest` or bundle dir that resolves into the repo's tracked content is refused.

Verification, stated plainly: copy-fidelity checked against the repo source (sha256 of each copied file matches the source file); file counts checked against the manifest — the manifest carries no independent per-file hash.

Honesty note: some installed skills contain scripts that the host platform may run when a skill is used; "executes nothing" describes bootstrap.py only — bootstrap itself fetches nothing and executes nothing.

Bundles are generated on demand by `--bundle DIR` (scope is the selection scope: with no `--packs`, the default scope — front door plus the Rigor core set, 17 entries, 18 zips in all; with `--packs`, that selection's scope — one zip per included entry in that scope, plus `front-door.zip`); they are not shipped in this repo.

The manual steps below remain as a clearly labelled fallback if you cannot or do not want to run the script.

## What you are installing

The **core starter set** — the suggested first install — is:

1. This front door: the `crew-orchestrator` skill (`../crew-orchestrator/`) plus the starter prompt (`../starter-prompt.md`).
2. The Rigor pack from `../../packs/`.

On Grok web you do not drop skill folders into a directory the way you do in a CLI tool. Grok web skills are created inside Grok itself (see Steps).

## Where the library lives

- The full index is `../../MANIFEST.md`.
- The packs live in `../../packs/`.
- Some entries are **link-only**: the kit does not contain their code. Fetch those from their home repos — each pack lists them in `../../packs/<pack>/LINKS.md` — and respect each one's license.
- Use the kit files as the source text for the skills you create in Grok: `../crew-orchestrator/SKILL.md` and the Rigor pack's files in `../../packs/`.

## What is verified

- xAI's own Skills are **LIVE on Grok 4.3 across grok.com/iOS/Android** (official xAI post, 2026-05-18).
- Skills are **account-level and persist across conversations**.
- Per that official post, you create a skill in one of three ways: **describing it in conversation, uploading a file, or writing one from scratch**.

## Manual fallback — steps

1. Open Grok on grok.com, iOS, or Android, signed in to the account you want the skills on.
2. Start with the `crew-orchestrator` skill. Create it using one of the three verified methods:
   - describe it in conversation, using `../crew-orchestrator/SKILL.md` as the description of what it should do; or
   - upload the file (`../crew-orchestrator/SKILL.md`); or
   - write it from scratch, pasting in the skill's text.
3. Paste the starter prompt (`../starter-prompt.md`) into the conversation so the house rules are in force for that work.
4. Repeat step 2 for the Rigor pack skills you want, one at a time, from `../../packs/`.
5. For link-only entries, follow `../../packs/<pack>/LINKS.md` to the home repo first and use that source text.
6. In a new conversation on the same account, check the skill is still there — account-level persistence is the verified behaviour.

## Honesty notes — read these before you go looking for a menu

- **Exact menu/click path: UNVERIFIED from official sources.** The official xAI post describes the three creation methods above but does not give a click-by-click path, and no verified click path was found in the sources checked for this kit. This guide deliberately does not invent one. If the menus in your app differ from what you expected, that is why.
- **Paid-tier gating for custom skills: UNVERIFIED.** The official post says every Grok account ships with built-in skills, but whether creating your *own* custom skills is gated to a paid tier was not verified from official sources. Check your own plan in Grok rather than relying on a claim here.
- No cross-surface sync is claimed here: a skill created in Grok web is a Grok account skill. Installing the kit on other surfaces (Claude, Claude Code, Grok Build) is a separate install per surface — see the other guides in this folder.
