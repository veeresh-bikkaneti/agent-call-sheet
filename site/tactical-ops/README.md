# Tactical Operations

A gate-defect triage console for The Agent Call Sheet, wearing a container
terminal. Deployed at `/agent-call-sheet/tactical-ops/`.

It is one static page. There is no build step at serve time, no server, no
network call, and no third-party script until you press **deploy**.

```
index.html        markup + all CSS + the pinned import map
ops.js            console state, roster, dossiers, waves, log, keyboard, sound
scene.js          the procedural Three.js container yard (only imported on deploy)
ops-data.js       GENERATED — every count and status the page shows
build-ops-data.py regenerates ops-data.js from the repo
```

## What the page is actually showing

The defect roster is not invented for the game. It is the eight findings of the
repository's own independent Reality Checker gate, read out of
`gate-verdict.agent-readable.v1.json` at build time. Each finding carries:

* what the gate observed, its ruling, and the fix it prescribed — quoted
  verbatim;
* a **status** that is a *probe result*, re-computed by `build-ops-data.py` on
  every rebuild (see the probe map in that file);
* the literal probe output behind that status, printed in the dossier.

The same discipline applies to everything else on the page: pack sizes come from
`manifest.csv`, the eval figures come from `eval/results.json`, and the boss
phases are the gate's own resubmission criteria. Nothing is typed in by hand
except prose, the loadout map, and the wave list.

**Triaging a finding is a reading gesture.** It marks the card as read. It never
claims a defect is fixed; the status shown is the probe's, not the reader's.

## What it deliberately does not do

* It does not run anything. No Python, no shell, no server, no fetch beyond the
  pinned Three.js modules you opt into by pressing deploy.
* It ships no recorded audio and no GLTF models. Every object in the yard is a
  Three.js primitive built at runtime; interface sounds are synthesised with
  WebAudio and are off by default.
* It is not live. `ops-data.js` is baked from a specific commit; the footer and
  the field notes both print that commit.
* Triaged state, the loadout, sound and mode are kept in `localStorage` only.

## Three.js details worth knowing

* Pinned to r158 through the import map, with sha384 digests for `three` and for
  every addon `scene.js` imports. The digests are checked against the upstream
  bytes by `tests/test_tactical_ops_page.py`.
* **`FilmPass` in r158 takes `(intensity, grayscale)`.** The four-argument call
  used elsewhere in this repository — `new FilmPass(0.15, 0.025, 648, false)` —
  is dead code: arguments 3 and 4 are ignored and argument 2 lands in the
  `grayscale` flag. This page uses the two-argument form.
* `PointsMaterial` has one size for the whole cloud; a per-point `size`
  attribute is not read, so the drizzle uses a single attenuated size.

## Accessibility

`prefers-reduced-motion` is honoured: the yard is not started automatically and,
if deployed by hand, it paints on interaction instead of running a 60 Hz loop.
The whole console works with the 3D terminal switched off — the roster, dossiers
and log are ordinary buttons and lists. There is a skip link, focus-visible
outlines, 44 px hit targets, and an `aria-live` combat log.

## Rebuilding

```bash
python3 site/tactical-ops/build-ops-data.py     # regenerate ops-data.js
python3 tests/test_tactical_ops_page.py         # verify page + data + workflow
```

The test suite fails the build if `ops-data.js` is not byte-identical to a fresh
generation, so editing that file by hand is caught rather than shipped.
