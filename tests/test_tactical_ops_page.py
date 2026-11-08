#!/usr/bin/env python3
"""Verification for site/tactical-ops/ — the Tactical Operations console.

These are not smoke tests. Each one asserts an invariant the page would be
wrong to break, and every failure prints the exact string or count that
disagreed:

  * no innerHTML / outerHTML / document.write / eval / new Function anywhere
  * the import map still pins three@0.158.0 and still carries an SRI digest for
    three plus every addon scene.js imports
  * three.js is only ever reached through a dynamic import, so the page fetches
    nothing third-party until the operator presses deploy
  * every element id ops.js reaches for exists in index.html
  * ops-data.js agrees, exactly, with gate-verdict.agent-readable.v1.json,
    eval/results.json and manifest.csv
  * build-ops-data.py regenerates byte-identical output (no drift, no clock)
  * every relative link the page offers resolves inside the assembled Pages
    artifact — derived by parsing .github/workflows/pages.yml, not by hand

Run:  python3 tests/test_tactical_ops_page.py
"""
from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MODULE_DIR = REPO / "site" / "tactical-ops"
INDEX = MODULE_DIR / "index.html"
OPS_JS = MODULE_DIR / "ops.js"
SCENE_JS = MODULE_DIR / "scene.js"
DATA_JS = MODULE_DIR / "ops-data.js"
GENERATOR = MODULE_DIR / "build-ops-data.py"
WORKFLOW = REPO / ".github" / "workflows" / "pages.yml"
GATE = REPO / "gate-verdict.agent-readable.v1.json"
EVAL = REPO / "eval" / "results.json"
MANIFEST = REPO / "manifest.csv"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def load_data() -> dict:
    """ops-data.js is a single `export const OPS = {…};` statement."""
    text = read(DATA_JS)
    marker = "export const OPS ="
    start = text.index(marker) + len(marker)
    end = text.rindex(";")
    return json.loads(text[start:end])


ARTIFACT_ROOT = "_site/"


def strip_root(path: str) -> str:
    """Deployed keys are relative to the uploaded artifact, not to the repo."""
    return path[len(ARTIFACT_ROOT):] if path.startswith(ARTIFACT_ROOT) else path


def deployed_paths() -> dict[str, str]:
    """Parse the Pages workflow's copy steps into {deployed: source} pairs.

    Keys are paths inside the uploaded artifact, without a leading slash, so that
    a relative href on the page can be compared with them directly.
    """
    out: dict[str, str] = {}
    for line in read(WORKFLOW).splitlines():
        line = line.strip()
        if not line.startswith("cp "):
            continue
        parts = line[3:].split()
        if len(parts) < 2:
            continue
        *sources, raw_dest = parts
        is_dir = raw_dest.endswith("/")
        dest = strip_root(raw_dest).strip("/")
        if is_dir:
            for src in sources:
                key = f"{dest}/{os.path.basename(src)}" if dest else os.path.basename(src)
                out[key] = src
        else:
            out[dest] = sources[-1]
    return out


class TestFiles(unittest.TestCase):
    def test_module_files_exist(self):
        for path in (INDEX, OPS_JS, SCENE_JS, DATA_JS, GENERATOR,
                     MODULE_DIR / "README.md"):
            with self.subTest(path=path.name):
                self.assertTrue(path.is_file(), f"missing {path}")

    def test_generator_is_runnable_and_has_no_clock(self):
        """"No clock, no dice" — the generator must be reproducible from the tree alone."""
        text = read(GENERATOR)
        for pattern, label in (
            (r"\bimport\s+random\b", "import random"),
            (r"\brandom\.\w+\s*\(", "random.*() call"),
            (r"\btime\.time\s*\(", "time.time()"),
            (r"\bdatetime\.now\s*\(", "datetime.now()"),
            (r"\buuid\.\w+\s*\(", "uuid call"),
        ):
            with self.subTest(pattern=label):
                self.assertFalse(re.search(pattern, text), f"generator uses {label}")


class TestSafety(unittest.TestCase):
    BANNED = [
        (r"\.innerHTML\s*=", "innerHTML assignment"),
        (r"\.outerHTML\s*=", "outerHTML assignment"),
        (r"insertAdjacentHTML", "insertAdjacentHTML"),
        (r"document\.write", "document.write"),
        (r"\beval\s*\(", "eval call"),
        (r"new\s+Function\s*\(", "new Function"),
    ]

    def test_no_html_injection_or_dynamic_code(self):
        for path in (INDEX, OPS_JS, SCENE_JS):
            text = read(path)
            for pattern, label in self.BANNED:
                with self.subTest(file=path.name, pattern=label):
                    hits = re.findall(pattern, text)
                    self.assertEqual(hits, [], f"{label} found in {path.name}")

    def test_three_is_only_imported_dynamically(self):
        text = read(OPS_JS)
        self.assertNotRegex(
            text, r"^\s*import\s+.*from\s+['\"]three",
            "ops.js must not statically import three — it is fetched on deploy only",
        )
        self.assertNotRegex(
            text, r"^\s*import\s+.*['\"]\./scene\.js['\"]",
            "scene.js must be reached with a dynamic import()",
        )
        self.assertIn("import('./scene.js')", text,
                      "ops.js must dynamic-import the scene module")

    def test_index_loads_exactly_one_script(self):
        scripts = re.findall(r"<script\b[^>]*\bsrc=\"([^\"]+)\"", read(INDEX))
        self.assertEqual(scripts, ["ops.js"], f"unexpected script tags: {scripts}")


class TestImportMap(unittest.TestCase):
    def setUp(self):
        self.text = read(INDEX)
        block = re.search(r'<script type="importmap">(.*?)</script>', self.text, re.S)
        assert block is not None, "index.html has no import map"
        self.mapping = json.loads(block.group(1))

    def test_version_is_pinned(self):
        self.assertEqual(
            self.mapping["imports"]["three"],
            "https://unpkg.com/three@0.158.0/build/three.module.js",
        )

    def test_every_imported_addon_has_an_sri_digest(self):
        imported = set(re.findall(r"from\s+'three/addons/([^']+)'", read(SCENE_JS)))
        self.assertTrue(imported, "scene.js imports no addons — check the regex")
        integrity = self.mapping.get("integrity", {})
        self.assertIn("three", integrity, "three itself has no integrity digest")
        for addon in sorted(imported):
            with self.subTest(addon=addon):
                self.assertIn(
                    f"three/addons/{addon}", integrity,
                    f"no SRI digest for three/addons/{addon}",
                )
                self.assertTrue(
                    integrity[f"three/addons/{addon}"].startswith("sha384-"),
                    "digests must be sha384",
                )

    def test_digests_match_the_upstream_bytes(self):
        """Re-hash every module the page can load and compare with the map.

        Skipped when the network is unavailable, so the suite still runs offline
        — but it never silently passes: the skip reason says so.
        """
        import base64
        import hashlib
        import urllib.request

        entries = [("three", self.mapping["imports"]["three"])]
        for key in self.mapping.get("integrity", {}):
            if key == "three":
                continue
            entries.append((key, "https://unpkg.com/three@0.158.0/examples/jsm/" + key.split("three/addons/")[1]))

        for key, url in entries:
            with self.subTest(module=key):
                try:
                    with urllib.request.urlopen(url, timeout=20) as resp:
                        body = resp.read()
                except Exception as exc:  # noqa: BLE001 - reported, not swallowed
                    self.skipTest(f"network unavailable for {key}: {exc}")
                digest = base64.b64encode(hashlib.sha384(body).digest()).decode()
                expected = self.mapping["integrity"][key].split("-", 1)[1]
                self.assertEqual(
                    digest, expected,
                    f"SRI digest for {key} does not match the bytes at {url}",
                )


class TestWiring(unittest.TestCase):
    def test_every_element_id_reached_for_exists(self):
        html = read(INDEX)
        present = set(re.findall(r'id="([^"]+)"', html))
        wanted: set[str] = set()
        for path in (OPS_JS,):
            text = read(path)
            wanted |= set(re.findall(r"\$\('([^']+)'\)", text))
            wanted |= set(re.findall(r"getElementById\('([^']+)'\)", text))
        missing = sorted(wanted - present)
        self.assertEqual(missing, [], f"ops.js reaches for ids that are not in index.html: {missing}")

    def test_deck_is_deployed_with_the_page(self):
        deployed = deployed_paths()
        for name in ("index.html", "ops.js", "scene.js", "ops-data.js"):
            with self.subTest(file=name):
                self.assertIn(
                    f"tactical-ops/{name}", deployed,
                    f"pages.yml does not copy site/tactical-ops/{name} into the artifact",
                )

    def test_relative_links_resolve_inside_the_artifact(self):
        deployed = deployed_paths()
        page_dir = "tactical-ops/"
        html = read(INDEX)
        hrefs = re.findall(r'href="(\./[^"]+)"', html)
        data = load_data()
        hrefs += [c["href"] for c in data["containers"] if c["href"].startswith("./")]
        self.assertGreaterEqual(len(hrefs), 8, "expected the yard and footer links to be relative")

        for href in hrefs:
            with self.subTest(href=href):
                target = os.path.normpath(os.path.join(page_dir, href)).replace("\\", "/")
                base = target.rstrip("/")
                candidates = [target, f"{base}/index.html"]
                if base in (".", ""):
                    candidates.append("index.html")
                self.assertTrue(
                    any(c in deployed for c in candidates),
                    f"{href} resolves to {target}, which pages.yml never copies "
                    f"(tried {candidates})",
                )


class TestDataFidelity(unittest.TestCase):
    def setUp(self):
        self.data = load_data()
        self.gate = json.loads(read(GATE))
        self.eval = json.loads(read(EVAL))

    def test_defects_match_the_gate_verdict_exactly(self):
        gate_defects = self.gate["defects"]
        self.assertEqual(
            [d["id"] for d in self.data["defects"]],
            [d["id"] for d in gate_defects],
        )
        self.assertEqual(
            [d["severity"] for d in self.data["defects"]],
            [d["severity"] for d in gate_defects],
        )
        self.assertEqual(
            [d["title"] for d in self.data["defects"]],
            [d["title"] for d in gate_defects],
        )

    def test_gate_verdict_is_quoted_not_invented(self):
        self.assertEqual(self.data["gate"]["verdict"], self.gate["verdict"])
        self.assertEqual(self.data["gate"]["date"], self.gate["date"])
        self.assertEqual(
            [p["criteria"] for p in self.data["boss"]["phases"]],
            self.gate["resubmission_criteria"],
        )

    def test_eval_counts_are_verbatim(self):
        self.assertEqual(self.data["eval"]["counts"], self.eval["counts"])
        self.assertEqual(self.data["eval"]["runAt"], self.eval["run_at"])
        self.assertEqual(self.data["eval"]["kitHead"], self.eval["kit_head"])

    def test_manifest_totals_are_recomputed(self):
        rows = list(csv.DictReader(read(MANIFEST).splitlines()))
        include = [r for r in rows if (r.get("distribution") or "").strip() == "include"]
        link = [r for r in rows if (r.get("distribution") or "").strip() == "link-only"]
        described = [r for r in rows if (r.get("distribution") or "").strip() not in ("include", "link-only")]

        def files(rs):
            total = 0
            for r in rs:
                try:
                    total += int(r.get("files") or 0)
                except ValueError:
                    pass
            return total

        m = self.data["manifest"]
        self.assertEqual(m["entries"], len(rows))
        self.assertEqual(m["packs"], len({(r.get("pack") or "").strip() for r in rows if (r.get("pack") or "").strip()}))
        self.assertEqual(m["include"]["rows"], len(include))
        self.assertEqual(m["include"]["files"], files(include))
        self.assertEqual(m["linkOnly"]["rows"], len(link))
        self.assertEqual(m["linkOnly"]["filesAtUpstream"], files(link))
        self.assertEqual(m["described"]["rows"], len(described))
        self.assertEqual(m["installedFiles"], files(include))

    def test_pack_counts_match_the_manifest(self):
        rows = list(csv.DictReader(read(MANIFEST).splitlines()))
        expected = {}
        for r in rows:
            pack = (r.get("pack") or "").strip()
            if pack:
                expected[pack] = expected.get(pack, 0) + 1
        got = {p["id"]: p["entries"] for p in self.data["packList"]}
        self.assertEqual(got, expected)

    def test_every_defect_has_a_status_and_a_probe_line(self):
        allowed = {"resolved", "partial", "open", "mooted"}
        for d in self.data["defects"]:
            with self.subTest(defect=d["id"]):
                self.assertIn(d["status"], allowed)
                self.assertTrue(d["evidence"], "a status with no probe output is a claim, not evidence")
                self.assertTrue(all(isinstance(e, str) and e.strip() for e in d["evidence"]))

    def test_defect_status_counts_add_up(self):
        counts = {}
        for d in self.data["defects"]:
            counts[d["status"]] = counts.get(d["status"], 0) + 1
        self.assertEqual(self.data["defectStatus"], counts)

    def test_loadouts_cover_every_defect_exactly_once(self):
        covered = [tid for lo in self.data["loadouts"] for tid in lo["targets"]]
        self.assertEqual(sorted(covered), sorted(d["id"] for d in self.data["defects"]))
        self.assertEqual(len(covered), len(set(covered)), "a defect is staffed by two loadouts")


class TestDeterminism(unittest.TestCase):
    def test_regeneration_is_byte_identical(self):
        """The checked-in ops-data.js must be exactly what the generator makes.

        This is the check that catches a hand-edited data file: if anyone tweaks
        a number in ops-data.js without touching the sources it is derived from,
        the next run of the generator disagrees with the committed bytes.
        """
        before = DATA_JS.read_bytes()
        result = subprocess.run(
            [sys.executable, str(GENERATOR)],
            capture_output=True, text=True, cwd=str(REPO),
        )
        self.assertEqual(result.returncode, 0, f"generator failed:\n{result.stderr}")
        after = DATA_JS.read_bytes()
        if before != after:
            self.fail(
                "ops-data.js is not byte-identical to a fresh generation — "
                "it was edited by hand or the generator drifted",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
