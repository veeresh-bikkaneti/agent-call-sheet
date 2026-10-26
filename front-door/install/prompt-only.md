# Install — Prompt-only (platforms with no skill support)

Use this path on any chatbot or agent platform that has no skill system at all. There is nothing to install in the technical sense — you paste text in, and the discipline in that text is what you get.

## What you are using

The **core starter set** in prompt-only form is:

1. The starter prompt: `../starter-prompt.md`.
2. Persona text from the packs in `../packs/` — used as paste-in text, one at a time (see Steps).

The full library index is `../MANIFEST.md`, and the packs live in `../packs/`. Some entries are **link-only**: fetch those from their home repos via `../packs/<pack>/LINKS.md` and respect each license — in prompt-only use, you would paste in their text the same way, after fetching it.

## Steps

1. Open `../starter-prompt.md` and copy the prompt text.
2. Paste it into your assistant once, at the start of a conversation — or into the platform's custom instructions, if it has them. That paste is the whole install.
3. When you need a specialist, open the persona you want in `../packs/` (start with the Rigor pack), copy its text, and paste it in, telling the assistant to take that seat for this task.
4. Use **personas as paste-in text one at a time**. Do not paste several personas in at once and expect separate reviewers — one pasted persona, one seat, one task. For an independent check, start a fresh conversation, paste the reality-checker persona, and give it the work and the evidence.
5. Keep your own copy of anything you want to survive the conversation (see Honesty notes).

## Honesty notes — what is lost on this path

State this plainly: prompt-only is the floor, not the full system.

- **Automatic skill triggering is lost.** Nothing loads on its own. A skill or persona only applies when you paste it in and ask for it by name.
- **File-based memory is lost.** The starter prompt tells the agent to keep a living memory file. On a chat-only platform with no files, that degrades to in-conversation memory — it lasts as long as the platform keeps the conversation, and no longer. Anything that matters, keep in your own files.
- **Loops and scheduling are lost.** Scheduled reviews, self-improvement loops, and background consolidation need a platform that can run on a schedule and keep files between sessions. Prompt-only cannot do them; you re-paste and re-brief by hand.
- What you *do* keep is the discipline the prompt carries: remember the user, learn from corrections, evidence first, blocked means blocked, done means verified, and the no-fluff reply shape.

## A note for Muse users

This packaging flow — skill folders as files in a workspace skills folder, with the starter prompt as standing instructions — is how the kit author's own Muse runs.

However: **a public doc-verified packaging flow for other Muse users is UNVERIFIED.** The author's setup is verified first-hand as her own practice; no public Muse documentation page confirming that another user's Muse accepts copied custom-skills folders in the same way was checked for this kit. If you are a Muse user, treat folder-copying as "this is the author's working pattern," try it, and verify in your own session that the skill is visible by name before relying on it.
