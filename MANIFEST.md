# MANIFEST — every entry in the kit, and where it stands

This is the definition of "packaging done" for the AI Crew Starter Kit: every catalog
entry has a row here with its pack, author/source, license evidence, distribution call,
and frontmatter status. `manifest.csv` is the machine-readable twin of this file.

## Totals

- **Manifest rows: 141**
- **Included (files copied into `packs/`, byte-identical): 33** — 998 files, every one sha256-verified against the installed source (998 checks, 0 failures)
- **Link-only (no code copied; fetch from the author's home repo): 106** — stubs in each pack's `LINKS.md`
- **Practice entries (no artifact exists): 2**

## Reconciliation against the catalog's "~180"

The kit catalog's headline says "~180 specialist skills and personas". Enumerating every
entry that could be evidenced on disk gives **141 rows**, a delta of ~39. The headline
appears to count sub-skills and rule files inside bundles (e.g. the Remotion and UI/UX Pro Max
sets carry dozens of internal rule/data files) and the staged game-studio seats individually.
This manifest counts one row per distinct, evidenced entry and does not pad to reach 180.
One installed folder, `recovered-skill-notes`, is **not** a catalog entry (provenance notes,
awaiting review) and is deliberately excluded from both the manifest and the library.

A second reconciliation that does close: the catalog says 41 Agency personas were vetted and
installed. There are 40 persona folders on disk; the 41st is `local-agents-orchestrator`,
an Agency-origin persona Liz rebuilt into her own orchestrator skill (its references/ folder
keeps the original persona). 40 + 1 = 41. ✓

## Packs

- **crew-personas**: 41 entries (0 included, 41 link-only/n-a)
- **design-video-3d**: 45 entries (14 included, 31 link-only/n-a)
- **legal**: 2 entries (1 included, 1 link-only/n-a)
- **memory-comms**: 3 entries (1 included, 2 link-only/n-a)
- **rigor**: 17 entries (17 included, 0 link-only/n-a)
- **seo**: 33 entries (0 included, 33 link-only/n-a)

## How the include / link-only call was made

Conservative rule: a skill's files are redistributed here **only** where a permissive license
is evidenced — (a) a LICENSE file inside the installed folder (MIT or Apache-2.0), (b) MIT
stated for that family in the kit catalog (the pstack set, i-have-adhd), (c) `license: MIT`
declared in the skill's own SKILL.md frontmatter (karpathy-guidelines, gdpr-privacy), or
(d) Liz's own material. Anything doubtful went link-only and is flagged below.

License-evidence summary:
- LICENSE file in folder: 22 folders (MIT ×19, Apache-2.0 ×3)
- Kit catalog states MIT: 7 entries (6 pstack + i-have-adhd)
- SKILL.md frontmatter declares MIT: 2 entries
- Liz's own material: 2 entries (+ the front door, which is hers)
- Everything else: unverified → link-only

Notable conservative calls:
- **All 40 Agency personas → link-only.** No LICENSE file in the persona folders and the kit
  catalog states no license for the set. (One persona's content carries an MIT badge image;
  a badge inside content is not a license grant for the set, so it did not move the call.)
- **legal-advisor → link-only** while its sibling gdpr-privacy is included: gdpr-privacy's
  SKILL.md declares `license: MIT` in frontmatter; legal-advisor's only 'license' mentions are
  subject matter (it advises *about* licenses). No grant, no copy.
- **Remotion (12), threejs-skills (10), SEO leaves (33), page-mascot → link-only.** No license
  evidence in the folders or the catalog. Popularity is not a license.
- **local-ui-ux-pro-max → link-only; local-ui-ux-pro-max-skill → included.** Two variants of
  the same skill are installed; only the `-skill` folder carries the MIT LICENSE file.
- **local-ui-ux-pro-max-skill copy excludes its nested `.git/`** (29 files of VCS metadata
  from the source clone — not skill content). All 682 content files are byte-identical.

## Source URLs — an honest gap

The catalog names every author/source but prints **no URLs**, and none have been invented
here: the `source_url` column in manifest.csv is empty throughout. `packs/*/LINKS.md` tells
readers how to find each home repo from the author/source name and to verify it is the
author's own repo before downloading.

## Frontmatter status (installed entries, full census of SKILL.md files)

- Spec-compliant (name + description present): 84
- None (no YAML frontmatter as installed): 47 — mostly the Agency personas, plus
  archify, agents-orchestrator, i-have-adhd, motionmaxxing, page-mascot and others.
File-based platforms run these as-is. Web-upload surfaces with strict frontmatter rules
will reject the no-frontmatter entries until a per-pack normalisation pass (future work,
one pack at a time) — the install READMEs say this plainly.

## All entries

### crew-personas

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| Game studio seats (staged pack) | persona | Not named in the kit doc (staged per project) | unverified → link-only | link-only | n/a (not installed) |
| design ui designer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| design ui finish gate reviewer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| design ux architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering ai engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering api platform engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering backend architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering code reviewer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering data engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering devops automator | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering frontend developer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering git workflow master | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering minimal change engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering multi agent systems architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering prompt engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering rag pipeline engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering rapid prototyper | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering senior developer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering software architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering sre | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| engineering technical writer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| product dx engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| product manager | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| research synthesist | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security ai generated code auditor | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security appsec engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security cloud security architect | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security compliance auditor | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security penetration tester | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| security secrets credential engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| specialized codebase archaeologist | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| specialized mcp builder | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| specialized model qa | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing accessibility auditor | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing api tester | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing evidence collector | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing performance benchmarker | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing reality checker | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing test automation engineer | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |
| testing tool evaluator | persona | Michael Sitarzewski — Agency Agents catalog | unverified → link-only | link-only | none |

### design-video-3d

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| Anime.js | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| FFmpeg | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| GSAP | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| Motion Canvas | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| Rive | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| Satori | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| Three.js | library (reference clone, not a skill) | Not stated in the kit doc | unverified → link-only | link-only | n/a (not a skill) |
| frontend-design | skill | Agency set (grouped with UI/UX Pro Max in the kit doc) | Apache-2.0 | include | spec-compliant |
| motionmaxxing | skill | Tejashmakwana | Apache-2.0 | include | none |
| openfilm | skill | openfilm | MIT | include | spec-compliant |
| collage | skill | openfilm | MIT | include | spec-compliant |
| keynote | skill | openfilm | MIT | include | spec-compliant |
| long-to-short | skill | openfilm | MIT | include | spec-compliant |
| lyric-video | skill | openfilm | MIT | include | spec-compliant |
| motion-graphics | skill | openfilm | MIT | include | spec-compliant |
| presenter-pip | skill | openfilm | MIT | include | spec-compliant |
| replicate | skill | openfilm | MIT | include | spec-compliant |
| screen-demo | skill | openfilm | MIT | include | spec-compliant |
| vintage-film | skill | openfilm | MIT | include | spec-compliant |
| whiteboard | skill | openfilm | MIT | include | spec-compliant |
| page mascot | skill | Kamran Ahmed (nilbuild) | unverified → link-only | link-only | none |
| remotion-best-practices | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-captions | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-create | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-docs | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-interactivity | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-maps | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-markup | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-multimedia | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-render | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-saas | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-studio | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| remotion-upgrade | skill | remotion-dev | unverified → link-only | link-only | spec-compliant |
| threejs-animation | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-fundamentals | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-geometry | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-interaction | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-lighting | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-loaders | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-materials | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-postprocessing | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-shaders | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| threejs-textures | skill | CloudAI-X | unverified → link-only | link-only | spec-compliant |
| ui-ux-pro-max | skill | nextlevelbuilder | unverified → link-only | link-only | spec-compliant |
| ui ux pro max skill | skill | nextlevelbuilder | MIT | include | none |

### legal

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| gdpr-privacy | skill | zeroes-ones | MIT | include | spec-compliant |
| legal-advisor | skill | zeroes-ones | unverified → link-only | link-only | spec-compliant |

### memory-comms

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| Living memory files | practice (no artifact) | Liz (her practice) | Liz's own material — license TBD by Liz | n/a — described in the kit doc only | n/a (no artifact) |
| Self-improvement loops | practice (no artifact) | Liz (her practice) | Liz's own material — license TBD by Liz | n/a — described in the kit doc only | n/a (no artifact) |
| i have adhd | skill | Ayoub Ghriss | MIT | include | none |

### rigor

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| agents orchestrator | agent | Liz (original build; 8 pstack principles folded in) | Liz's own material — license TBD by Liz | include | none |
| archify | skill | tt-a1i | MIT | include | none |
| benchmark-checklist | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| blast-radius | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| correct | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| create-verification-skill | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| graphify | skill | Graphify-Labs | Apache-2.0 | include | spec-compliant |
| karpathy-guidelines | skill | multica-ai (from Andrej Karpathy's observations) | MIT | include | spec-compliant |
| maintain-verification-skill | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| ponytail | skill | DietrichGebert | MIT | include | spec-compliant |
| ponytail-audit | skill | DietrichGebert | MIT | include | spec-compliant |
| ponytail-debt | skill | DietrichGebert | MIT | include | spec-compliant |
| ponytail-gain | skill | DietrichGebert | MIT | include | spec-compliant |
| ponytail-help | skill | DietrichGebert | MIT | include | spec-compliant |
| ponytail-review | skill | DietrichGebert | MIT | include | spec-compliant |
| show-me-your-work | skill | Lauren Tan ("poteto") — pstack, via cursor/plugins | MIT | include | spec-compliant |
| production_path_verification | skill | Liz (own skill, from her skill-review loop) | Liz's own material — license TBD by Liz | include | none |

### seo

| Entry | Type | Author / source | License | Distribution | Frontmatter |
|---|---|---|---|---|---|
| backlink-analysis | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| canonical-tag | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| competitor-research | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| content-optimization | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| content-strategy | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| core-web-vitals | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| site-crawlability | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| meta-description | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| eeat-signals | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| entity-seo | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| featured-snippet | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| heading-structure | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| image-optimization | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| indexing | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| indexnow | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| internal-links | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| keyword-research | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| link-building | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| local-seo | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| page-metadata | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| mobile-friendly | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| open-graph | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| parasite-seo | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| programmatic-seo | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| rendering-strategies | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| robots-txt | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| schema-markup | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| serp-features | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| xml-sitemap | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| title-tag | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| twitter-cards | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| url-structure | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
| video-optimization | skill | kostja94 | unverified → link-only | link-only | spec-compliant |
