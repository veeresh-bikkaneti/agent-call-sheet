# Eval gate — skill versioning + saved-input harness

- **Date:** 2026-10-27
- **Evaluated commit:** `613928a4966f32989ca5809aece26790eba28b16`
  (branch `feat/skill-versioning-evals`, on base `main` @ `729013f0`)
- **Valid for this commit only.** The counts below describe the tree at
  the evaluated commit (plus this gate record and `eval/results.json`,
  which change no evaluated file). Any later change to a skill, the
  manifest, `front-door/`, or the harness invalidates them; re-run
  `python3 eval/run_evals.py` and re-issue this record.
- **Content stamps (from `eval/results.json`, the machine-readable twin):**
  - `manifest.csv` SHA-256: `c8c824c70defa81c3d1a5349484cca5b18a7a0b5b3542d3b1b53e0457307cde2`
  - `front-door/board.html` SHA-256: `ce64ecee9c53d22245be48a13a539bc2b552db35500911170eb6abeae79762c2`
  - extracted board fold code SHA-256: `474077135bd114d579d4a4e8198833677572eddb69eba0eb403edaa499e05f3c`
- **Run:** `python3 eval/run_evals.py` — exit code **0**, run not labelled
  INCOMPLETE (no core NOT RUN).

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
1–10, rule anchors in order); orchestrator ↔ status-contract field
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
