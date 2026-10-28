# Eval gate — skill versioning + saved-input harness

- **Date:** 2026-10-27
- **Evaluated commit:** `27093e181270e79687a965c778f3ade8b12a045f`
  (branch `feat/skill-versioning-evals`, transplanted onto `main` @
  `5c82373d` — the PR #31 merge — by merge commit
  `1697bd43a615d0b8c3821205b580ef429f54f58f`; original evaluation at
  `613928a4` on base `main` @ `729013f0`, see the transplant note below)
- **Valid for this commit only.** The counts below describe the tree at
  the evaluated commit (plus this gate record and `eval/results.json`,
  which change no evaluated file). Any later change to a skill, the
  manifest, `front-door/`, or the harness invalidates them; re-run
  `python3 eval/run_evals.py` and re-issue this record.
- **Content stamps (from `eval/results.json`, the machine-readable twin):**
  - `manifest.csv` SHA-256: `c8c824c70defa81c3d1a5349484cca5b18a7a0b5b3542d3b1b53e0457307cde2`
  - `front-door/board.html` SHA-256: `cf8ac1a702f9851cfabc68fec015db7b744a8b6bb7eb7de789abfee214730c6f`
  - extracted board fold code SHA-256: `474077135bd114d579d4a4e8198833677572eddb69eba0eb403edaa499e05f3c`
- **Run:** `python3 eval/run_evals.py` — exit code **0**, run not labelled
  INCOMPLETE (no core NOT RUN).

## Transplant re-issue (2026-10-27, per Reality Checker §8)

This record supersedes the `613928a4` gate record. Between that evaluation
and this one, `main` advanced past the PR base (`729013f0` →
`5c82373d`): D6 rewrote `front-door/starter-prompt.md` (house rules now
1–11 and the fence text revised), `front-door/crew-orchestrator/SKILL.md`
gained house rule 11, and PR #31 changed `front-door/board.html`
(+7/−4, comment + mobile CSS). The PR branch was transplanted by merging
current `main` in (merge commit `1697bd43`); the merge was clean — the
PR's 15 files and `main`'s changed files are disjoint, and `manifest.csv`
/ `MANIFEST.md` are byte-identical between the PR base and current `main`.

A harness run on the merged tree, before any refresh, failed exactly two
checks — `starter-prompt-byte-identity` and
`starter-prompt-rule-count-order` — proving the two starter-prompt
goldens stale and nothing else (board goldens and the orchestrator ↔
status-contract cross-reference still passed against current `main`).
PR #31's `board.html` change leaves the extracted fold code
byte-identical (stamp above, unchanged from the original evaluation)
and all four board goldens pass against it, so no board golden was
refreshed; only the whole-file `board.html` stamp moved. The evaluated
commit `27093e18` therefore refreshes only:

- `eval/cases/starter-prompt.fence.txt` — re-derived from current
  `main`'s `front-door/starter-prompt.md` with the harness's own fence
  extraction (the bytes between the ` ```text ` fence markers, never
  hand-typed).
- `eval/cases/starter-prompt.rules.json` — `rule_numbers` 1–11 derived
  from the current fence; anchors for rules 1–10 carried over (each
  verified present, in order, in the new fence) plus `DECLARE YOUR MODE`
  for rule 11, taken from that rule's heading in the fence.

The same commit also lands the Reality Checker's §7 placement
recommendation: the restore-point definition, adopted in the PR body,
now stands as a paragraph in `MANIFEST.md`'s version-columns section
(documentation only; no version line or manifest row changed, and the
manifest-twin check above still passes).

## Counts (per tier, reported separately)

| Tier | PASS | FAIL | NOT RUN |
|---|---|---|---|
| Tier 1 — integrity (119 included rows) | 563 | 0 | 39 |
| Tier 2 — saved-input (original material) | 8 | 0 | 0 |
| Negative controls | 6 | 0 | 0 |

Tier 1 breakdown: per-row local checks (exists, folder == path basename,
disk count == manifest, frontmatter vs recorded status) 475 PASS;
pin blob-SHA 86 PASS; manifest-twin agreement 1 PASS; `kit_version`
recompute from git log 1 PASS.

Tier 2 breakdown: board fold vs goldens 4 PASS (shipped `real-run` and
`sample-run` fixtures, one synthetic edge-case file, one trap line-set —
all folded by `board.html`'s own `parseRunText`/`fold`, extracted
byte-for-byte and executed under node, never reimplemented);
starter-prompt 3 PASS (fence byte-identity vs golden, rule count/order
1–11, rule anchors in order); orchestrator ↔ status-contract field
cross-reference 1 PASS (5 required + 3 optional fields agree).

## Negative controls (each on a scratch copy; the target check must FAIL)

| Control | Assertion that must fail | Result |
|---|---|---|
| Byte flip in a vendored copy (`local-title/SKILL.md`) | `pin-blob-sha` | PASS — check failed as required |
| Corrupted frontmatter (unclosed block) | `frontmatter-vs-recorded-status` | PASS — check failed as required |
| Board trap line-set + appended overwriting line | `board-fold-golden` | PASS — check failed as required |
| Tampered golden (sample-run Builder status) | `board-fold-golden` | PASS — check failed as required |
| One-char starter-prompt edit | `starter-prompt-byte-identity` | PASS — check failed as required |
| Renamed contract field (`waiting_on` → `waitingOn`) | `orchestrator-contract-fields` | PASS — check failed as required |

A negative control whose target check passes is a harness FAIL; none did.

## Named exceptions (NOT RUN, carried whole — never counted as PASS)

Standing NOT RUN list (39 Tier-1 items; full machine list in
`eval/results.json` → `standing_not_run`):

- **29 rows — `pin-unrecorded`:** vendored rows with no pin derivable from
  the Council-C lockfile or the row's evidence prose (openfilm ×11,
  ponytail ×6, pstack ×6, frontend-design, motionmaxxing, i-have-adhd,
  archify, graphify, karpathy-guidelines). Their `upstream_pin` is the
  literal `unrecorded`; the pin check does not run for them.
- **3 rows — `original-material-no-upstream`:** the kit's own material
  (memory scaffolding, agents orchestrator, production_path_verification)
  has no upstream to verify against; `upstream_pin` is blank by definition.
- **1 row — `upstream-path-unmapped`:** `local-ui-ux-pro-max-skill`
  (682 files, whole-clone copy) — its `source_url` names a subfolder of
  `nextlevelbuilder/ui-ux-pro-max-skill` (73 files at the pin), so a
  file-set mapping cannot be derived from the URL alone. Its sibling row
  `local-ui-ux-pro-max` (the subfolder itself) verifies PASS.
- **1 case — `vendored-name-is-upstream`:** the literal frontmatter
  `name == folder` reading does not hold for vendored copies — measured
  112/112 spec-compliant rows carry an upstream frontmatter name that
  differs from the kit folder (kit folders add `local-`/category
  prefixes; vendored bytes must not be edited, or the pin proof breaks).
  Tier 1 therefore checks frontmatter against the manifest's recorded
  status and `folder == basename(local_path)`; the literal reading is
  recorded NOT RUN here rather than reported as a false PASS or a
  false FAIL.
- **1 case — `not-a-skill`:** the memory-scaffolding row ships templates,
  not a SKILL.md; its frontmatter check does not run.
- **4 cases — `prior-harness-not-in-repo`:** the bundle validator,
  frontmatter harness, normalisation runner, and Playwright board
  harness from earlier workstreams are not runnable scripts in this
  repository, so they are NOT RUN and their past results are not
  re-claimed. (The board fold itself *is* re-run, in Tier 2.)

## Non-claims (explicit)

- Tier 1 proves the kit did not corrupt vendored files (byte-identity to
  upstream at the recorded pins, where pins are recorded and mappable).
- Tier 2 proves deterministic saved-input behaviour of the kit's own
  material (board fold, starter prompt structure, contract cross-reference).
- **Neither tier proves a persona works with a live model.** No model was
  run; no behavioural compliance of any persona or prompt is asserted.
- The pin check fetches upstream git trees from `api.github.com`
  (unauthenticated, public repos) at run time; offline runs report those
  rows NOT RUN (`upstream-unreachable`), never PASS.
