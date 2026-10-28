#!/usr/bin/env python3
"""Paperclip export checks for bootstrap.py (stdlib only, offline).

Paperclip's catalog builder silently drops a catalog team whose
TEAM.md frontmatter lacks a non-empty `description` (the drop rule
recorded in the research crew's production report:
`if (!name || !description || schema !== TEAM_SCHEMA) return null`).
These tests lock the export against that regression. For every
shipped crew template they assert:

  1. --export-paperclip TEAM.md frontmatter carries the required
     keys (schema, name, description, slug, manager), with
     `description` equal VERBATIM to the template's own description
     in front-door/templates/<name>.json -- never invented text.
  2. The keys survive an export -> import round trip: the crew is
     exported with --export-crew, re-imported with --import-crew,
     and re-exported; every frontmatter key is present and equal,
     and the re-exported crew JSON is byte-identical.
  3. A selection with no description is refused with a named error
     and writes nothing, rather than shipping an empty key.

Run from the repository root:

    python3 tests/test_bootstrap_paperclip.py
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOT = ROOT / "bootstrap.py"
TEMPLATES_DIR = ROOT / "front-door" / "templates"
REQUIRED_KEYS = ("schema", "name", "description", "slug", "manager")
TEMPLATE_NAMES = sorted(p.stem for p in TEMPLATES_DIR.glob("*.json"))


def run_bootstrap(args, cwd):
    return subprocess.run([sys.executable, str(BOOT)] + args,
                          cwd=str(cwd), capture_output=True, text=True)


def parse_frontmatter(text):
    """Read the flat scalar frontmatter bootstrap.py writes (plain or
    JSON double-quoted values)."""
    lines = text.splitlines()
    assert lines[0] == "---", lines[:1]
    out = {}
    for line in lines[1:]:
        if line == "---":
            return out
        key, _, value = line.partition(":")
        value = value.strip()
        if value.startswith('"'):
            value = json.loads(value)
        out[key.strip()] = value
    raise AssertionError("frontmatter never closed")


def export_paperclip(base, args, tag):
    workdir = base / tag
    workdir.mkdir(parents=True)
    out = workdir / "pc"
    proc = run_bootstrap(args + ["--export-paperclip", str(out)], workdir)
    assert proc.returncode == 0, proc.stderr + proc.stdout
    return out


class PaperclipExportTest(unittest.TestCase):
    def test_templates_present(self):
        self.assertTrue(TEMPLATE_NAMES, "no crew templates found")

    def test_required_keys_and_verbatim_description(self):
        for name in TEMPLATE_NAMES:
            with self.subTest(template=name):
                crew = json.loads(
                    (TEMPLATES_DIR / (name + ".json")).read_text(
                        encoding="utf-8"))
                with tempfile.TemporaryDirectory() as tmp:
                    out = export_paperclip(
                        Path(tmp), ["--template", name], "case")
                    team_dir = out / name
                    fm = parse_frontmatter(
                        (team_dir / "TEAM.md").read_text(encoding="utf-8"))
                    for key in REQUIRED_KEYS:
                        self.assertIn(key, fm)
                        self.assertTrue(fm[key], (name, key, fm))
                    self.assertEqual(fm["schema"], "agentcompanies/v1")
                    self.assertEqual(fm["name"], crew["name"])
                    # Verbatim from the shipped template data.
                    self.assertEqual(fm["description"], crew["description"])
                    self.assertTrue((team_dir / fm["manager"]).is_file())

    def test_round_trip_keys_survive(self):
        for name in TEMPLATE_NAMES:
            with self.subTest(template=name):
                crew = json.loads(
                    (TEMPLATES_DIR / (name + ".json")).read_text(
                        encoding="utf-8"))
                with tempfile.TemporaryDirectory() as tmp:
                    base = Path(tmp)
                    first = export_paperclip(
                        base, ["--template", name], "first")
                    fm_first = parse_frontmatter(
                        (first / name / "TEAM.md").read_text(
                            encoding="utf-8"))
                    workdir = base / "roundtrip"
                    workdir.mkdir()
                    exported = workdir / "exported.json"
                    proc = run_bootstrap(
                        ["--template", name, "--export-crew",
                         str(exported)], workdir)
                    self.assertEqual(proc.returncode, 0, proc.stderr)
                    reexported = workdir / "reexported.json"
                    proc = run_bootstrap(
                        ["--import-crew", str(exported), "--export-crew",
                         str(reexported)], workdir)
                    self.assertEqual(proc.returncode, 0, proc.stderr)
                    self.assertEqual(reexported.read_bytes(),
                                     exported.read_bytes())
                    second = export_paperclip(
                        base, ["--import-crew", str(exported)], "second")
                    fm = parse_frontmatter(
                        (second / name / "TEAM.md").read_text(
                            encoding="utf-8"))
                    for key in REQUIRED_KEYS:
                        self.assertEqual(fm.get(key), fm_first.get(key),
                                         (name, key, fm, fm_first))
                    self.assertEqual(fm["description"], crew["description"])

    def test_empty_description_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            out = workdir / "pc"
            proc = run_bootstrap(["--export-paperclip", str(out)], workdir)
            self.assertEqual(proc.returncode, 1, proc.stdout)
            self.assertIn("description", proc.stderr)
            self.assertFalse(out.exists(), "a team directory was written")


if __name__ == "__main__":
    unittest.main()
