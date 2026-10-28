# MANIFEST — every entry in the kit, and where it stands

This is the definition of "packaging done" for The Agent Call Sheet: every catalog
entry has a row here with its pack, author/source, license evidence, distribution call,
and frontmatter status. `manifest.csv` is the machine-readable twin of this file; both
are generated from the same dataset, and every entry below carries the same fields
the CSV carries (name, folder, pack, type, author, source URL, license, license
evidence, distribution, local path, file count, frontmatter status, notes,
upstream pin, kit version).

## Totals

- **Manifest rows: 142**
- **Included (files copied into `packs/`): 119** — 1257 files in the tree (counted from the tree and reconciled against the CSV). Of these, 33 entries (998 files) are the original P1 inclusions, byte-identical to the source install; 85 entries (253 files) were added 2026-10-26 by the Council-C re-sync: content bytes identical to upstream at a pinned commit, verified per file by git blob SHA (see rule (e) below); and 1 entry (6 files) was added 2026-10-26 as the memory scaffolding — the maintainers' own templates and loop card for the two practice entries (see the memory-comms entries below).
- **Link-only (no files copied; fetch from the author's home repo): 21** — pointers in each pack's `LINKS.md` and in the entries below.
- **Practice entries (no artifact exists): 2**

## Version columns (added 2026-10-27)

Two columns ride on every row, in both twins (`manifest.csv` and this file):

- **`upstream_pin`** — for a vendored row, the exact upstream commit SHA the
  kit's copies were synced from, populated from the Council-C lockfile and the
  row's own license evidence (one verified home: this column; the prose stays
  as the evidence trail). It verifies by git blob-SHA recompute: every shipped
  file of the row is hashed as a git blob and compared with the upstream tree
  at the pin (the eval harness, Tier 1, re-runs this). A blank value means the
  row is the kit's own original material — there is no upstream to pin. The
  literal `unrecorded` means the row is vendored but no pin is derivable from
  the lockfile or the row's evidence prose; the harness reports those rows
  NOT RUN for the pin check, never PASS. Counts at this addition: 108 rows
  carry a pin (87 of the 119 included rows), 29 included rows are
  `unrecorded`, and 5 rows are original (3 included + the 2 practice rows).
- **`kit_version`** — for every row with shipped files, the short (7-char)
  SHA of the last commit on `main` that changed the row's `local_path`
  files, derived via `GET /commits?path=<local_path>&per_page=1`. It
  verifies against git history: `git log -1 --format=%h main -- <local_path>`
  recomputes it. File-less rows (link-only and practice) carry `n/a`.

No semver exists for this kit, and neither column is or implies one: the pin
is an upstream commit, the kit version is a commit in this repo's history,
and a kit release number will only ever come from a real tag.

Restore point = the recorded pre-sync git ref + pin/hash record; re-syncs land as isolated commits with the pre-sync SHA in the PR body; restoration is explicit revert only. No snapshot tooling, no rollback UI, no transactional promise.

## Reconciliation against the catalog's "~180"

The kit catalog's headline says "~180 specialist skills and personas". Enumerating every
entry that could be evidenced gives **142 rows** (the original 141-row enumeration, plus the 'Memory scaffolding' entry added 2026-10-26; current totals: 142 rows, 119 included entries, 1,257 included files — see Totals above), a delta of ~38. The headline
appears to count sub-skills and rule files inside bundles (e.g. the Remotion and UI/UX Pro Max
sets carry dozens of internal rule/data files) and the staged game-studio seats individually.
This manifest counts one row per distinct, evidenced entry and does not pad to reach 180.

A second reconciliation that does close: the catalog says 41 Agency personas were vetted and
installed. There are 40 persona entries in the crew-personas pack from the Agency catalog; the 41st
is `local-agents-orchestrator`, an Agency-origin persona we rebuilt into our own orchestrator skill
(in the rigor pack; its references/ folder keeps the original persona). 40 + 1 = 41. ✓

One catalog row has no manifest row of its own, by design: the **Catch-up contract
(ketchup, folded in)** row. It is not a separate artifact — the ketchup catch-up contract was
folded into the included `i-have-adhd` skill as its Rule 11 — so it is covered by that entry's
row (memory-comms) rather than listed separately.

## Packs

- **crew-personas**: 41 entries (40 included, 1 link-only/n-a)
- **design-video-3d**: 45 entries (26 included, 19 link-only/n-a)
- **legal**: 2 entries (1 included, 1 link-only/n-a)
- **memory-comms**: 4 entries (2 included, 2 link-only/n-a)
- **rigor**: 17 entries (17 included, 0 link-only/n-a)
- **seo**: 33 entries (33 included, 0 link-only/n-a)

## How the include / link-only call was made

Conservative rule: a skill's files are redistributed here **only** where a permissive license
is evidenced — (a) a LICENSE file inside the installed folder (MIT or Apache-2.0), (b) MIT
stated for that family in the kit catalog (the pstack set, i-have-adhd), (c) `license: MIT`
declared in the skill's own SKILL.md frontmatter (karpathy-guidelines, gdpr-privacy),
(d) our own material — or (e) **an upstream root license at a pinned commit** (added
2026-10-26 by the T1 council for the Council-C build, with safeguards: the source repo is
pinned to an exact commit; a recursive tree sweep finds no nested license file; a per-file
header scan finds no conflicting terms; every file's content is verified against the pin by
git blob SHA; the source repo's root LICENSE is shipped alongside each entry as
`UPSTREAM-LICENSE` for notice preservation; and each upgraded row records its old → new
status, evidence, pin, and drift delta). Anything doubtful stays link-only and is flagged below.

License-evidence summary (by row):
- (e) upstream root license at a pinned commit (2026-10-26 sweep, safeguards on the row): 91
- (a) LICENSE file in the installed folder: 22
- no grant evidenced → link-only (incl. the 2026-10-26 pinned re-checks): 15
- (b) MIT stated for the family in the kit catalog: 7
- (c) `license: MIT` declared in the skill's own SKILL.md frontmatter: 2
- practice entries — no artifact, no license question: 2
- (d) our own material: 3

Notable calls:
- **All 40 Agency personas → INCLUDED (reversed 2026-10-26).** The P1 call was link-only because
  no LICENSE file sat in the persona folders and the kit catalog stated no license for the set —
  the upstream repo root was never checked. It now has been: `msitarzewski/agency-agents` carries
  MIT at its root ("Copyright (c) 2025 AgentLand Contributors"), verified at pinned commit
  b37b5bb33b78. The personas were re-synced from upstream at that pin under rule (e); upstream has
  drifted since the catalogue (the files now carry frontmatter), and the rows describe the pinned
  reality. The same reversal applies to the threejs-skills (10), the SEO leaves (33), page-mascot,
  and ui-ux-pro-max — all MIT at their source roots at their pins.
- **legal-advisor → stays link-only** while its sibling gdpr-privacy is included. gdpr-privacy's
  SKILL.md declares `license: MIT` in frontmatter and was included under rule (c). legal-advisor's
  own SKILL.md frontmatter also declares `license: MIT` at the pinned commit — but the earlier
  vetted call at the same pin recorded its license mentions as subject matter ('it advises *about*
  licenses'), the source repo has no LICENSE file anywhere relevant, and the expert council's
  Step 4 set this row's bar at a licence file or written permission. The T1 council held the row
  link-only (two seats blocking) until the contradiction is resolved by stronger evidence.
- **Remotion (12), GSAP, FFmpeg → stay link-only, re-verified at pins 2026-10-26.**
  remotion-dev/skills carries no LICENSE file anywhere in the repo at its pin; GSAP has no LICENSE
  file at its root; FFmpeg's LICENSE.md is an overview over LGPL/GPL texts with no single grant.
- **Game-studio seats, Anime.js, Motion Canvas, Rive, Satori, Three.js → stay link-only BY
  RECORDED DECISION.** Their licenses are verified at their pinned source roots (MIT; MPL-2.0 for
  Satori), but they were catalogued as reference clones / a staged pack with no file set — the
  distribution unit was never the whole repository. For Satori, the MPL-2.0 condition is recorded
  on its row: if ever included, the license text and notices ship with the files and MPL-2.0's
  file-level duties are honoured per file.
- **local-ui-ux-pro-max → INCLUDED (reversed 2026-10-26); local-ui-ux-pro-max-skill → included (P1).**
  Two variants of the same skill; the `-skill` folder carried the MIT LICENSE file and was included
  in P1; the plain variant's source repo is MIT at its root at its pin and joins under rule (e).
- **local-ui-ux-pro-max-skill copy excludes its nested `.git/`** (29 files of VCS metadata
  from the source clone — not skill content). All 682 content files are byte-identical.
- **production_path_verification ships byte-identical, absolute paths and all.** Its
  `skill.yaml` contains machine-specific absolute paths (`/home/hatch/...`) copied unchanged
  from its source; they were left untouched to keep the copy byte-identical. Adopters must
  adjust those paths to their own setup before use.

## Source URLs

Every row's `source_url` in manifest.csv is filled, every entry below prints its source URL,
and each `packs/*/LINKS.md` carries the pointers for its link-only entries. Every URL was
verified against the author's own repository (the exact file or folder where the entry lives,
checked through the GitHub API) — none were invented or guessed. Our own material points at this
repository. One provenance correction rides along: frontend-design's source is
Anthropic's skills repo, per the first-hand vetting record, not the Agency set the
kit doc grouped it with.

## Frontmatter status (repo census — every SKILL.md file under `packs/`)

- SKILL.md files in the repo: 131
- Spec-compliant (name + description present): 125
- None (no YAML frontmatter): 6 — the entries at:
  - `packs/design-video-3d/local-motionmaxxing/`
  - `packs/design-video-3d/local-ui-ux-pro-max-skill/`
  - `packs/memory-comms/local-i-have-adhd/`
  - `packs/rigor/local-agents-orchestrator/`
  - `packs/rigor/local-archify/`
  - `packs/rigor/production_path_verification/`
This census counts the files actually in this repo (an earlier version counted the source
install on the maintainer's machine — 84/47 — and has been corrected). File-based platforms run
the no-frontmatter entries as-is. Web-upload surfaces with strict frontmatter rules
will reject them until a per-pack normalisation pass (future work,
one pack at a time) — the install READMEs say this plainly. All 85 entries added by the
Council-C re-sync carry spec-compliant frontmatter at their pinned sources.

## All entries

### crew-personas

#### Game studio seats (staged pack)
- Folder: `—` · Pack: crew-personas · Type: persona
- Source / author: Not named in the kit doc (staged per project) — https://github.com/pamirtuna/gamestudio-subagents
- License: MIT (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE (MIT) in pamirtuna/gamestudio-subagents at pinned commit 7ccf2a16237639c9c427dd3b251df3a7b6f579db (LICENSE blob 664ffd79b378d8da92225460cb4a8b2bad2335b6). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `7ccf2a16237639c9c427dd3b251df3a7b6f579db` · Kit version: `n/a`
- Frontmatter: n/a (not installed)
- Notes: Kit doc names the seats: Producer, game designers, game-feel, QA. Nothing to copy — staged per project. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: staged pack, catalogued with no file set (files=0) — 'staged per project'; the distribution unit was never the whole repo.

#### design ui designer
- Folder: `local-design-ui-designer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/design/design-ui-designer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-design-ui-designer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### design ui finish gate reviewer
- Folder: `local-design-ui-finish-gate-reviewer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/design/design-ui-finish-gate-reviewer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-design-ui-finish-gate-reviewer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### design ux architect
- Folder: `local-design-ux-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/design/design-ux-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-design-ux-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering ai engineer
- Folder: `local-engineering-ai-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-ai-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-ai-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering api platform engineer
- Folder: `local-engineering-api-platform-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-api-platform-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-api-platform-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering backend architect
- Folder: `local-engineering-backend-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-backend-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-backend-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering code reviewer
- Folder: `local-engineering-code-reviewer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-code-reviewer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-code-reviewer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering data engineer
- Folder: `local-engineering-data-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-data-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-data-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering devops automator
- Folder: `local-engineering-devops-automator` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-devops-automator.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-devops-automator` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering frontend developer
- Folder: `local-engineering-frontend-developer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-frontend-developer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-frontend-developer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering git workflow master
- Folder: `local-engineering-git-workflow-master` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-git-workflow-master.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-git-workflow-master` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering minimal change engineer
- Folder: `local-engineering-minimal-change-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-minimal-change-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-minimal-change-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering multi agent systems architect
- Folder: `local-engineering-multi-agent-systems-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-multi-agent-systems-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-multi-agent-systems-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering prompt engineer
- Folder: `local-engineering-prompt-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-prompt-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-prompt-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering rag pipeline engineer
- Folder: `local-engineering-rag-pipeline-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-rag-pipeline-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-rag-pipeline-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering rapid prototyper
- Folder: `local-engineering-rapid-prototyper` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-rapid-prototyper.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-rapid-prototyper` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering senior developer
- Folder: `local-engineering-senior-developer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-senior-developer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-senior-developer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering software architect
- Folder: `local-engineering-software-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-software-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-software-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering sre
- Folder: `local-engineering-sre` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-sre.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-sre` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### engineering technical writer
- Folder: `local-engineering-technical-writer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-technical-writer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-engineering-technical-writer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### product dx engineer
- Folder: `local-product-dx-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/product/product-dx-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-product-dx-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### product manager
- Folder: `local-product-manager` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/product/product-manager.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-product-manager` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### research synthesist
- Folder: `local-research-synthesist` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/research/research-synthesist.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-research-synthesist` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security ai generated code auditor
- Folder: `local-security-ai-generated-code-auditor` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-ai-generated-code-auditor.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-ai-generated-code-auditor` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security appsec engineer
- Folder: `local-security-appsec-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-appsec-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-appsec-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security architect
- Folder: `local-security-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security cloud security architect
- Folder: `local-security-cloud-security-architect` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-cloud-security-architect.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-cloud-security-architect` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security compliance auditor
- Folder: `local-security-compliance-auditor` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-compliance-auditor.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-compliance-auditor` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security penetration tester
- Folder: `local-security-penetration-tester` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-penetration-tester.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-penetration-tester` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### security secrets credential engineer
- Folder: `local-security-secrets-credential-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/security/security-secrets-credential-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-security-secrets-credential-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### specialized codebase archaeologist
- Folder: `local-specialized-codebase-archaeologist` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/specialized/specialized-codebase-archaeologist.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-specialized-codebase-archaeologist` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### specialized mcp builder
- Folder: `local-specialized-mcp-builder` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/specialized/specialized-mcp-builder.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-specialized-mcp-builder` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### specialized model qa
- Folder: `local-specialized-model-qa` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/specialized/specialized-model-qa.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-specialized-model-qa` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing accessibility auditor
- Folder: `local-testing-accessibility-auditor` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-accessibility-auditor.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-accessibility-auditor` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing api tester
- Folder: `local-testing-api-tester` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-api-tester.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-api-tester` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing evidence collector
- Folder: `local-testing-evidence-collector` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-evidence-collector.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-evidence-collector` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing performance benchmarker
- Folder: `local-testing-performance-benchmarker` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-performance-benchmarker.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-performance-benchmarker` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing reality checker
- Folder: `local-testing-reality-checker` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-reality-checker.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-reality-checker` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing test automation engineer
- Folder: `local-testing-test-automation-engineer` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-test-automation-engineer.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-test-automation-engineer` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### testing tool evaluator
- Folder: `local-testing-tool-evaluator` · Pack: crew-personas · Type: persona
- Source / author: Michael Sitarzewski — Agency Agents catalog — https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-tool-evaluator.md
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in msitarzewski/agency-agents at pinned commit b37b5bb33b78f2c1d6567d98e25ca818e3259219 (LICENSE blob 523078c01624b9b1b1c551e75054b9d3a9f953ab); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/crew-personas/local-testing-tool-evaluator` · Files: 2
- Upstream pin: `b37b5bb33b78f2c1d6567d98e25ca818e3259219` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from msitarzewski/agency-agents at pin b37b5bb33b78; catalogue recorded 3 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: single upstream file placed as SKILL.md for loader discovery. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

### design-video-3d

#### Anime.js
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/juliangarnier/anime
- License: MIT (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE.md (MIT) in juliangarnier/anime at pinned commit 01b81be1df6843ccfe0a71c0699a746bf740dd77 (LICENSE blob f999fa58ebdda6d8d0f3ae581ebdfe821f09603a). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `01b81be1df6843ccfe0a71c0699a746bf740dd77` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: reference library (reference clone), not a skill; the catalogue's distribution unit was never the whole repo.

#### FFmpeg
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/FFmpeg/FFmpeg
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit d31915e9dce4d33676fadc6c3e08965b4acc132b (FFmpeg/FFmpeg): source LICENSE.md is an overview over LGPL/GPL texts (API: NOASSERTION) — no single grant covers the material. No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `d31915e9dce4d33676fadc6c3e08965b4acc132b` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license re-checked first-hand at the pin; source LICENSE.md is an overview over LGPL/GPL texts (API: NOASSERTION) — no single grant covers the material. Stays link-only.

#### GSAP
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/greensock/GSAP
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 13e2b790546426a1a2e0e9b409f3f8dc6d6611f2 (greensock/GSAP): no LICENSE file at the source repo root at the pin (root listing + license endpoint checked). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file at the source repo root at the pin (root listing + license endpoint checked). Stays link-only.

#### Motion Canvas
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/motion-canvas/motion-canvas
- License: MIT (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE (MIT) in motion-canvas/motion-canvas at pinned commit 7b91435c301d530351dcf5ebb91dd139c002e405 (LICENSE blob b30f04e173f68773714b7d9e2652caecbeec53f9). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `7b91435c301d530351dcf5ebb91dd139c002e405` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: reference library (reference clone), not a skill; the catalogue's distribution unit was never the whole repo.

#### Rive
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/rive-app/rive-wasm
- License: MIT (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE (MIT) in rive-app/rive-wasm at pinned commit 951bfdea217a53ea8c103fcd0e3f33bb99b0fc27 (LICENSE blob 92a1c4bf6fe93178fba99689f4002fd37909c940). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `951bfdea217a53ea8c103fcd0e3f33bb99b0fc27` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: reference library (reference clone), not a skill; the catalogue's distribution unit was never the whole repo.

#### Satori
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/vercel/satori
- License: MPL-2.0 (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE (MPL-2.0) in vercel/satori at pinned commit 074f0b38ed0f5d8fa768f709c0bb072b2d6c99e1 (LICENSE blob a612ad9813b006ce81d1ee438dd784da99a54007). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `074f0b38ed0f5d8fa768f709c0bb072b2d6c99e1` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: reference library (reference clone), not a skill; the catalogue's distribution unit was never the whole repo. MPL-2.0 condition (Legal seat): if this material is ever included, the MPL-2.0 license text and notices must ship with the files and MPL-2.0's file-level duties must be honoured per file.

#### Three.js
- Folder: `—` · Pack: design-video-3d · Type: library (reference clone, not a skill)
- Source / author: Not stated in the kit doc — https://github.com/mrdoob/three.js
- License: MIT (verified at source root) — link-only by recorded decision — Evidence: Rule (e) sweep 2026-10-26: root LICENSE (MIT) in mrdoob/three.js at pinned commit fa57cf648fc36a9c5999f0076bfeea4960de50f6 (LICENSE blob 8ada2a5f982916b0ba4b7a0aa7de347587e745d7). License verified; distribution held at link-only by decision (see notes), not for lack of a license.
- Distribution: link-only · Local path: `—` · Files: 0
- Upstream pin: `fa57cf648fc36a9c5999f0076bfeea4960de50f6` · Kit version: `n/a`
- Frontmatter: n/a (not a skill)
- Notes: Vetted reference library per the kit doc; not redistributed here. Council-C build 2026-10-26: license verified at the pinned source root, but this row stays link-only BY RECORDED DECISION: reference library (reference clone), not a skill; the catalogue's distribution unit was never the whole repo.

#### frontend-design
- Folder: `local-frontend-design` · Pack: design-video-3d · Type: skill
- Source / author: Anthropic — anthropics/skills — https://github.com/anthropics/skills/tree/main/skills/frontend-design
- License: Apache-2.0 — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-frontend-design` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### motionmaxxing
- Folder: `local-motionmaxxing` · Pack: design-video-3d · Type: skill
- Source / author: Tejashmakwana — https://github.com/Tejashmakwana/motionmaxxing
- License: Apache-2.0 — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-motionmaxxing` · Files: 91
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: none
- Notes: 

#### openfilm
- Folder: `local-openfilm` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/skills/openfilm
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### collage
- Folder: `local-openfilm-collage` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/collage
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-collage` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### keynote
- Folder: `local-openfilm-keynote` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/keynote
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-keynote` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### long-to-short
- Folder: `local-openfilm-long-to-short` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/long-to-short
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-long-to-short` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### lyric-video
- Folder: `local-openfilm-lyric-video` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/lyric-video
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-lyric-video` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### motion-graphics
- Folder: `local-openfilm-motion-graphics` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/motion-graphics
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-motion-graphics` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### presenter-pip
- Folder: `local-openfilm-presenter-pip` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/presenter-pip
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-presenter-pip` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### replicate
- Folder: `local-openfilm-replicate` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/replicate
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-replicate` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### screen-demo
- Folder: `local-openfilm-screen-demo` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/screen-demo
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-screen-demo` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### vintage-film
- Folder: `local-openfilm-vintage-film` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/vintage-film
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-vintage-film` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### whiteboard
- Folder: `local-openfilm-whiteboard` · Pack: design-video-3d · Type: skill
- Source / author: openfilm — https://github.com/openfilm/openfilm/tree/main/packages/openfilm/skills/whiteboard
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-openfilm-whiteboard` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### page mascot
- Folder: `local-page-mascot` · Pack: design-video-3d · Type: skill
- Source / author: Kamran Ahmed (nilbuild) — https://github.com/nilbuild/page-mascot/tree/main/skills/page-mascot
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in nilbuild/page-mascot at pinned commit 76a44ed9180063bf4852b9dd724b656f4a828ac7 (LICENSE blob ffe07aa615bcef6f34d70f7ec2c112e8ee6d7059); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-page-mascot` · Files: 13
- Upstream pin: `76a44ed9180063bf4852b9dd724b656f4a828ac7` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from nilbuild/page-mascot at pin 76a44ed91800; catalogue recorded 13 file(s) for the installed copy; the pinned source carries 12 file(s); 13 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### remotion-best-practices
- Folder: `local-remotion-best-practices` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-best-practices
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 143
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-captions
- Folder: `local-remotion-captions` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-captions
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 6
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-create
- Folder: `local-remotion-create` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-create
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 5
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-docs
- Folder: `local-remotion-docs` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-docs
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 3
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-interactivity
- Folder: `local-remotion-interactivity` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-interactivity
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 5
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-maps
- Folder: `local-remotion-maps` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-maps
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 32
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-markup
- Folder: `local-remotion-markup` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-markup
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 67
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-multimedia
- Folder: `local-remotion-multimedia` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-multimedia
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 6
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-render
- Folder: `local-remotion-render` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-render
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 4
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-saas
- Folder: `local-remotion-saas` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-saas
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 6
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-studio
- Folder: `local-remotion-studio` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-studio
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 3
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### remotion-upgrade
- Folder: `local-remotion-upgrade` · Pack: design-video-3d · Type: skill
- Source / author: remotion-dev — https://github.com/remotion-dev/skills/tree/main/skills/remotion-upgrade
- License: unverified → link-only — Evidence: Sweep 2026-10-26 at pinned commit 30d4553ecd46fbc5212fd0ff006ae43af522158b (remotion-dev/skills): no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). No grant evidenced → link-only.
- Distribution: link-only · Local path: `—` · Files: 3
- Upstream pin: `30d4553ecd46fbc5212fd0ff006ae43af522158b` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: license re-checked first-hand at the pin; no LICENSE file anywhere in the source repo at the pin (recursive tree sweep, 430 paths, 0 license files). Stays link-only.

#### threejs-animation
- Folder: `local-threejs-animation` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-animation
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-animation` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-fundamentals
- Folder: `local-threejs-fundamentals` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-fundamentals
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-fundamentals` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-geometry
- Folder: `local-threejs-geometry` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-geometry
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-geometry` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-interaction
- Folder: `local-threejs-interaction` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-interaction
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-interaction` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-lighting
- Folder: `local-threejs-lighting` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-lighting
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-lighting` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-loaders
- Folder: `local-threejs-loaders` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-loaders
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-loaders` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-materials
- Folder: `local-threejs-materials` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-materials
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-materials` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-postprocessing
- Folder: `local-threejs-postprocessing` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-postprocessing
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-postprocessing` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-shaders
- Folder: `local-threejs-shaders` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-shaders
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-shaders` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### threejs-textures
- Folder: `local-threejs-textures` · Pack: design-video-3d · Type: skill
- Source / author: CloudAI-X — https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-textures
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in CloudAI-X/threejs-skills at pinned commit 0e181866f095b5f06d005133876e926515390d95 (LICENSE blob a8252c8e6798c6867144edbfb5bbd8df80743d00); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-threejs-textures` · Files: 2
- Upstream pin: `0e181866f095b5f06d005133876e926515390d95` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from CloudAI-X/threejs-skills at pin 0e181866f095; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### ui-ux-pro-max
- Folder: `local-ui-ux-pro-max` · Pack: design-video-3d · Type: skill
- Source / author: nextlevelbuilder — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in nextlevelbuilder/ui-ux-pro-max-skill at pinned commit 28b3b8dee8c976df4fa3e94aed4e092ad43fcb03 (LICENSE blob 1e71cbf26660f31903807d099fe902c098fc7e4c); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/design-video-3d/local-ui-ux-pro-max` · Files: 74
- Upstream pin: `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03` · Kit version: `c73e0f4`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from nextlevelbuilder/ui-ux-pro-max-skill at pin 28b3b8dee8c9; catalogue recorded 76 file(s) for the installed copy; the pinned source carries 73 file(s); 74 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### ui ux pro max skill
- Folder: `local-ui-ux-pro-max-skill` · Pack: design-video-3d · Type: skill
- Source / author: nextlevelbuilder — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/design-video-3d/local-ui-ux-pro-max-skill` · Files: 682
- Upstream pin: `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03` · Kit version: `e172ed8`
- Frontmatter: none
- Notes: Nested .git of the source clone excluded from the copy (29 files of VCS metadata, not skill content); content files copied byte-identical.

### legal

#### gdpr-privacy
- Folder: `local-gdpr-privacy` · Pack: legal · Type: skill
- Source / author: zeroes-ones — https://github.com/zeroes-ones/Skills/tree/main/skills/11-legal/gdpr-privacy
- License: MIT — Evidence: Declared in the skill's own SKILL.md frontmatter (`license: MIT`)
- Distribution: include · Local path: `packs/legal/local-gdpr-privacy` · Files: 28
- Upstream pin: `16b1447d820081e3ba7c5a019d2c7c6752298467` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### legal-advisor
- Folder: `local-legal-advisor` · Pack: legal · Type: skill
- Source / author: zeroes-ones — https://github.com/zeroes-ones/Skills/tree/main/skills/11-legal/legal-advisor
- License: unverified → link-only — Evidence: Sweep 2026-10-26: no LICENSE file at the root of zeroes-ones/Skills or in the entry folder at pinned commit 16b1447d820081e3ba7c5a019d2c7c6752298467. The entry's own SKILL.md frontmatter declares 'license: MIT' at that pin — recorded, but held insufficient under Council C Step 4 (no licence file or written permission; a prior vetted call at the same pin recorded the file's license mentions as subject matter, no grant). Stays link-only.
- Distribution: link-only · Local path: `—` · Files: 21
- Upstream pin: `16b1447d820081e3ba7c5a019d2c7c6752298467` · Kit version: `n/a`
- Frontmatter: spec-compliant
- Notes: Council-C build 2026-10-26: considered for upgrade under the gdpr-privacy rule-(c) precedent and HELD link-only by the T1 council (Seats C + D blocking): the frontmatter declaration and the prior same-pin finding contradict each other unreconciled; revisit only with a licence file or written permission.

### memory-comms

#### Living memory files
- Folder: `—` · Pack: memory-comms · Type: practice (no artifact)
- Source / author: The maintainers (our practice) — https://github.com/veeresh-bikkaneti/agent-call-sheet
- License: Our own material — license TBD by the maintainers — Evidence: Described in the kit doc as our practice. The practice itself ships no file; its scaffolding ships as files under the 'Memory scaffolding' entry in this pack (packs/memory-comms/scaffolding) — the memory templates this practice describes.
- Distribution: n/a — described in the kit doc only · Local path: `—` · Files: 0
- Upstream pin: — (original material — no upstream) · Kit version: `n/a`
- Frontmatter: n/a (no artifact)
- Notes: A practice to adopt; its scaffolding ships as files — see the 'Memory scaffolding' entry in this pack.

#### Self-improvement loops
- Folder: `—` · Pack: memory-comms · Type: practice (no artifact)
- Source / author: The maintainers (our practice) — https://github.com/veeresh-bikkaneti/agent-call-sheet
- License: Our own material — license TBD by the maintainers — Evidence: Described in the kit doc as our practice. The practice itself ships no file; its scaffolding ships as files under the 'Memory scaffolding' entry in this pack (packs/memory-comms/scaffolding) — the loop card this practice describes.
- Distribution: n/a — described in the kit doc only · Local path: `—` · Files: 0
- Upstream pin: — (original material — no upstream) · Kit version: `n/a`
- Frontmatter: n/a (no artifact)
- Notes: A practice to adopt; its scaffolding ships as files — see the 'Memory scaffolding' entry in this pack.

#### Memory scaffolding
- Folder: `scaffolding` · Pack: memory-comms · Type: practice (scaffolding)
- Source / author: The maintainers (our material) — https://github.com/veeresh-bikkaneti/agent-call-sheet
- License: Our own material — Apache License 2.0 (see NOTICE) — Evidence: Our own material, authored for this kit
- Distribution: include · Local path: `packs/memory-comms/scaffolding` · Files: 6
- Upstream pin: — (original material — no upstream) · Kit version: `7263a63`
- Frontmatter: n/a (not a skill)
- Notes: Added 2026-10-26 (Gap 20): scaffolding for the two practice entries in this pack — 'Living memory files' and 'Self-improvement loops' — the templates and loop card those practices describe, shipped as files.

#### i have adhd
- Folder: `local-i-have-adhd` · Pack: memory-comms · Type: skill
- Source / author: Ayoub Ghriss — https://github.com/ayghri/i-have-adhd/tree/main/skills/i-have-adhd
- License: MIT — Evidence: Stated in the kit doc (Memory & Comms table)
- Distribution: include · Local path: `packs/memory-comms/local-i-have-adhd` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: none
- Notes: 

### rigor

#### agents orchestrator
- Folder: `local-agents-orchestrator` · Pack: rigor · Type: agent
- Source / author: The maintainers (original build; 8 pstack principles folded in) — https://github.com/veeresh-bikkaneti/agent-call-sheet
- License: Our own material — Apache License 2.0 (see NOTICE) — Evidence: Kit doc: 'My build'
- Distribution: include · Local path: `packs/rigor/local-agents-orchestrator` · Files: 5
- Upstream pin: — (original material — no upstream) · Kit version: `e172ed8`
- Frontmatter: none
- Notes: 

#### archify
- Folder: `local-archify` · Pack: rigor · Type: skill
- Source / author: tt-a1i — https://github.com/tt-a1i/archify/tree/main/archify
- License: MIT — Evidence: LICENSE file in folder; kit doc also states MIT
- Distribution: include · Local path: `packs/rigor/local-archify` · Files: 107
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: none
- Notes: 

#### benchmark-checklist
- Folder: `local-benchmark-checklist` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/benchmark-checklist
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-benchmark-checklist` · Files: 1
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### blast-radius
- Folder: `local-blast-radius` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/blast-radius
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-blast-radius` · Files: 1
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### correct
- Folder: `local-correct` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/correct
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-correct` · Files: 1
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### create-verification-skill
- Folder: `local-create-verification-skill` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/create-verification-skill
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-create-verification-skill` · Files: 4
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### graphify
- Folder: `local-graphify` · Pack: rigor · Type: skill
- Source / author: Graphify-Labs — https://github.com/Graphify-Labs/graphify/tree/v8/skills/graphify
- License: Apache-2.0 — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-graphify` · Files: 10
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### karpathy-guidelines
- Folder: `local-karpathy-guidelines` · Pack: rigor · Type: skill
- Source / author: multica-ai (from Andrej Karpathy's observations) — https://github.com/multica-ai/andrej-karpathy-skills/tree/main/skills/karpathy-guidelines
- License: MIT — Evidence: Declared in the skill's own SKILL.md frontmatter (`license: MIT`)
- Distribution: include · Local path: `packs/rigor/local-karpathy-guidelines` · Files: 1
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### maintain-verification-skill
- Folder: `local-maintain-verification-skill` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/maintain-verification-skill
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-maintain-verification-skill` · Files: 1
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail
- Folder: `local-ponytail` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail-audit
- Folder: `local-ponytail-audit` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail-audit
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail-audit` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail-debt
- Folder: `local-ponytail-debt` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail-debt
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail-debt` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail-gain
- Folder: `local-ponytail-gain` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail-gain
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail-gain` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail-help
- Folder: `local-ponytail-help` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail-help
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail-help` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### ponytail-review
- Folder: `local-ponytail-review` · Pack: rigor · Type: skill
- Source / author: DietrichGebert — https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail-review
- License: MIT — Evidence: LICENSE file in folder
- Distribution: include · Local path: `packs/rigor/local-ponytail-review` · Files: 2
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### show-me-your-work
- Folder: `local-show-me-your-work` · Pack: rigor · Type: skill
- Source / author: Lauren Tan ("poteto") — pstack, via cursor/plugins — https://github.com/cursor/plugins/tree/main/pstack/skills/show-me-your-work
- License: MIT — Evidence: Stated in the kit doc (Rigor table: pstack — MIT)
- Distribution: include · Local path: `packs/rigor/local-show-me-your-work` · Files: 3
- Upstream pin: `unrecorded` · Kit version: `e172ed8`
- Frontmatter: spec-compliant
- Notes: 

#### production_path_verification
- Folder: `production_path_verification` · Pack: rigor · Type: skill
- Source / author: The maintainers (our skill, from our skill-review loop) — https://github.com/veeresh-bikkaneti/agent-call-sheet
- License: Our own material — Apache License 2.0 (see NOTICE) — Evidence: Our own skill (skill-review loop)
- Distribution: include · Local path: `packs/rigor/production_path_verification` · Files: 3
- Upstream pin: — (original material — no upstream) · Kit version: `e172ed8`
- Frontmatter: none
- Notes: Copied byte-identical from source; its skill.yaml contains machine-specific absolute paths (/home/hatch/...) from that source — adopters must adjust them to their own setup before use.

### seo

#### backlink-analysis
- Folder: `local-backlink-analysis` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/off-page/backlink-analysis
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-backlink-analysis` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### canonical-tag
- Folder: `local-canonical` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/canonical
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-canonical` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### competitor-research
- Folder: `local-competitor-research` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/content/competitor-research
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-competitor-research` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### content-optimization
- Folder: `local-content-optimization` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/content/content-optimization
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-content-optimization` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### content-strategy
- Folder: `local-content-strategy` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/content/content-strategy
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-content-strategy` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### core-web-vitals
- Folder: `local-core-web-vitals` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/core-web-vitals
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-core-web-vitals` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### site-crawlability
- Folder: `local-crawlability` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/crawlability
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-crawlability` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### meta-description
- Folder: `local-description` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/description
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-description` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### eeat-signals
- Folder: `local-eeat-signals` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/content/eeat-signals
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-eeat-signals` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### entity-seo
- Folder: `local-entity-seo` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/entity-seo
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-entity-seo` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### featured-snippet
- Folder: `local-featured-snippet` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/featured-snippet
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-featured-snippet` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### heading-structure
- Folder: `local-heading` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/heading
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-heading` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### image-optimization
- Folder: `local-image-optimization` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/image-optimization
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-image-optimization` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### indexing
- Folder: `local-indexing` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/indexing
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-indexing` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### indexnow
- Folder: `local-indexnow` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/indexnow
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-indexnow` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### internal-links
- Folder: `local-internal-links` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/internal-links
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-internal-links` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### keyword-research
- Folder: `local-keyword-research` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/content/keyword-research
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-keyword-research` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### link-building
- Folder: `local-link-building` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/off-page/link-building
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-link-building` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### local-seo
- Folder: `local-local` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/local
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-local` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### page-metadata
- Folder: `local-metadata` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/metadata
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-metadata` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### mobile-friendly
- Folder: `local-mobile-friendly` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/mobile-friendly
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-mobile-friendly` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### open-graph
- Folder: `local-open-graph` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/open-graph
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-open-graph` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### parasite-seo
- Folder: `local-parasite-seo` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/parasite-seo
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-parasite-seo` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### programmatic-seo
- Folder: `local-programmatic-seo` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/programmatic-seo
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-programmatic-seo` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### rendering-strategies
- Folder: `local-rendering-strategies` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/rendering-strategies
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-rendering-strategies` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### robots-txt
- Folder: `local-robots` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/robots
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-robots` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### schema-markup
- Folder: `local-schema` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/schema
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-schema` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### serp-features
- Folder: `local-serp-features` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/serp-features
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-serp-features` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### xml-sitemap
- Folder: `local-sitemap` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/technical/sitemap
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-sitemap` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### title-tag
- Folder: `local-title` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/title
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-title` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### twitter-cards
- Folder: `local-twitter-cards` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/twitter-cards
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-twitter-cards` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### url-structure
- Folder: `local-url-structure` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/url-structure
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-url-structure` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.

#### video-optimization
- Folder: `local-video-optimization` · Pack: seo · Type: skill
- Source / author: kostja94 — https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/video-optimization
- License: MIT — Evidence: Rule (e): root LICENSE (MIT, copyright per file) in kostja94/marketing-skills at pinned commit 45143a7d6d8f92fc9048aa4f3074a26272bd0d2a (LICENSE blob b9132b8a1a41a4612837f14fce7d10bfafc91251); recursive tree sweep found no nested license file; per-file header scan found no conflicting terms; content bytes verified against the pin by git blob SHA.
- Distribution: include · Local path: `packs/seo/local-video-optimization` · Files: 2
- Upstream pin: `45143a7d6d8f92fc9048aa4f3074a26272bd0d2a` · Kit version: `f1e0d81`
- Frontmatter: spec-compliant
- Notes: Upgraded link-only → include 2026-10-26 (Council-C build, evidence rule (e)): re-synced from kostja94/marketing-skills at pin 45143a7d6d8f; catalogue recorded 1 file(s) for the installed copy; the pinned source carries 1 file(s); 2 file(s) landed including 1 kit-added UPSTREAM-LICENSE (the source repo's root LICENSE bytes, added for MIT notice preservation). Shape: upstream folder copied as-is. Content bytes identical to upstream at the pin (blob-SHA verified); this is a re-sync, not the earlier installed copy.
