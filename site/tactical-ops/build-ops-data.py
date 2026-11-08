#!/usr/bin/env python3
"""Generate ops-data.js for the Tactical Operations console.

Every number and every status flag in the generated file is DERIVED by reading
repo truth (gate verdict, eval results, manifest, source files). Nothing is
typed in by hand except the curated loadout map, which is explicit below.

Deterministic: no timestamps, no randomness. Re-running on the same checkout
produces byte-identical output (tests/test_tactical_ops_page.py asserts this).

Usage:  python3 site/tactical-ops/build-ops-data.py
"""
from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

GATE = REPO / "gate-verdict.agent-readable.v1.json"
EVAL = REPO / "eval" / "results.json"
MANIFEST = REPO / "manifest.csv"
OUT = HERE / "ops-data.js"


# ---------------------------------------------------------------- helpers
def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def git_head() -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(REPO), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        return "unknown"


def exists(rel: str) -> bool:
    return (REPO / rel).is_file()


def count_files(rel_dir: str, suffix: str) -> list[str]:
    d = REPO / rel_dir
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.iterdir() if p.is_file() and p.name.endswith(suffix))


# ---------------------------------------------------------------- loadouts
# Curated: which remediation class owns which gate defect, and which pack the
# class is staffed from. Keys drive the 1-5 keyboard bindings.
LOADOUTS = [
    {
        "id": "supply-chain",
        "name": "Supply-Chain Loadout",
        "pack": "rigor",
        "doctrine": "Vet before you adopt — pin the version, verify the bytes.",
        "class": "supply-chain",
    },
    {
        "id": "boundary",
        "name": "Boundary Loadout",
        "pack": "rigor",
        "doctrine": "A trust boundary you did not write down is not a boundary.",
        "class": "boundary",
    },
    {
        "id": "evidence",
        "name": "Evidence Loadout",
        "pack": "crew-personas",
        "doctrine": "All tests pass only means something when you say what they cover.",
        "class": "evidence",
    },
    {
        "id": "docs",
        "name": "Field-Manual Loadout",
        "pack": "memory-comms",
        "doctrine": "If it needs archaeology, it is not documented.",
        "class": "docs",
    },
    {
        "id": "honesty",
        "name": "Honesty Loadout",
        "pack": "rigor",
        "doctrine": "Count the layers you shipped, not the layers you designed.",
        "class": "claim-vs-reality",
    },
]

DEFECT_LOADOUT = {
    "D1": "supply-chain",
    "D7": "supply-chain",
    "D2": "boundary",
    "D3": "evidence",
    "D5": "docs",
    "D6": "docs",
    "D8": "docs",
    "D4": "honesty",
}


# ---------------------------------------------------------------- status probes
# Each probe returns (status, evidence_list). status is one of:
#   resolved | partial | open | mooted
# Evidence strings are the literal thing that was read, so a reader can re-run it.
def probe_d1() -> tuple[str, list[str]]:
    ev, hit = [], []
    for rel in ("site/index.html", "visualization.html"):
        txt = read_text(REPO / rel) if exists(rel) else ""
        pinned = "three@0.158.0" in txt
        has_integrity = '"integrity"' in txt
        if has_integrity and pinned:
            hit.append(rel)
        ev.append(f'{rel}: importmap pinned={pinned} integrity_key={has_integrity}')
    if len(hit) == 2:
        return "resolved", ev
    if hit:
        return "partial", ev
    return "open", ev


def probe_d2() -> tuple[str, list[str]]:
    if not exists("front-door/board_server.py"):
        return "open", ["front-door/board_server.py: NOT FOUND"]
    txt = read_text(REPO / "front-door" / "board_server.py")
    limiter = "class RateLimiter" in txt
    kick429 = re.search(r'_error\(\s*429', txt) is not None
    retry = "Retry-After" in txt
    auth = "AUTH_ENABLED" in txt
    ev = [
        f"RateLimiter class present: {limiter}",
        f"429 + Retry-After on write endpoints: {kick429 and retry}",
        f"optional Bearer auth (BOARD_AUTH): {auth}",
    ]
    if limiter and kick429 and retry:
        return "resolved", ev
    return ("partial" if limiter else "open"), ev


def probe_d3() -> tuple[str, list[str]]:
    files = count_files("tests", ".py")
    ev = [f"tests/: {len(files)} test file(s) — {', '.join(files) or 'none'}"]
    # The gate measured coverage against six major components.
    return ("resolved" if len(files) >= 3 else "partial" if files else "open"), ev


def probe_d4() -> tuple[str, list[str]]:
    if not exists("site/index.html"):
        return "open", ["site/index.html: NOT FOUND"]
    txt = read_text(REPO / "site" / "index.html")
    has_video = "<video" in txt
    labels_layers = "Five Layers" in txt or "five layers" in txt.lower()
    labelled = "Coming in v2" in txt or "coming-in-v2" in txt
    ev = [
        f"<video> hero element still present: {has_video}",
        f"layer stack still advertised on the landing page: {labels_layers}",
        f"'Coming in v2' labels present: {labelled}",
    ]
    if not has_video:
        return "mooted", ev + [
            "The T1 redesign removed the hero video, so there is no hero claim left to back.",
        ]
    if labelled:
        return "resolved", ev
    return "open", ev


def probe_d5() -> tuple[str, list[str]]:
    here = exists("docs/live-debugger.md")
    wc = len(read_text(REPO / "docs" / "live-debugger.md").splitlines()) if here else 0
    ev = [f"docs/live-debugger.md exists: {here}" + (f" ({wc} lines)" if here else "")]
    return ("resolved" if here else "open"), ev


def probe_d6() -> tuple[str, list[str]]:
    a = exists("front-door/README-live-debugger.md")
    b = exists("front-door/README-board-server.md")
    ev = [f"front-door/README-live-debugger.md exists: {a}",
          f"front-door/README-board-server.md exists: {b}"]
    if a and b:
        return "resolved", ev
    return ("partial" if a or b else "open"), ev


def probe_d7() -> tuple[str, list[str]]:
    if not exists("visualization.html"):
        return "open", ["visualization.html: NOT FOUND"]
    txt = read_text(REPO / "visualization.html")
    ok = '"integrity"' in txt and "three@0.158.0" in txt
    return ("resolved" if ok else "open"), [f"visualization.html: integrity_key + pin present={ok}"]


def probe_d8() -> tuple[str, list[str]]:
    if not exists("front-door/board_server.py"):
        return "open", ["front-door/board_server.py: NOT FOUND"]
    txt = read_text(REPO / "front-door" / "board_server.py")
    mentions_default = re.search(r"help=[^)]*default", txt) is not None
    prog_present = "--port" in txt
    ev = [f"argparse help strings that state their default: {mentions_default}",
          f"--port flag documented: {prog_present}"]
    return ("resolved" if mentions_default else "partial"), ev


PROBES = {
    "D1": probe_d1, "D2": probe_d2, "D3": probe_d3, "D4": probe_d4,
    "D5": probe_d5, "D6": probe_d6, "D7": probe_d7, "D8": probe_d8,
}

PHASE_PROBES = {
    "supply-chain": probe_d1,
    "boundary": probe_d2,
    "evidence": probe_d3,
    "honesty": probe_d4,
    "docs-manual": probe_d5,
    "docs-readme": probe_d6,
    "docs-help": probe_d8,
}

PHASE_CLASS = {
    "R1": "supply-chain",
    "R2": "boundary",
    "R3": "evidence",
    "R4": "honesty",
    "R5": "docs-manual",
    "R6": "evidence",
}

PHASE_PROBE_KEY = {
    "R1": "supply-chain",
    "R2": "boundary",
    "R3": "evidence",
    "R4": "honesty",
    "R5": "docs-manual",
    "R6": None,  # R6 is "re-run the suite and attach raw output" — not a file probe
}


# ---------------------------------------------------------------- waves
# The six levels of the shipped walkthrough. Commands are copied from
# BEGINNER-GUIDE.md; evidence links point at files that exist in this repo.
WAVES = [
    {
        "n": 1,
        "key": "clone",
        "name": "Clone & Inspect",
        "brief": "Verify the tree before you trust it.",
        "commands": [
            "git clone https://github.com/veeresh-bikkaneti/agent-call-sheet.git",
            "cd agent-call-sheet && ls -la",
        ],
        "evidence": [{"label": "README.md", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/README.md"}],
    },
    {
        "n": 2,
        "key": "minimal",
        "name": "Minimal Install",
        "brief": "Two files: the coordinator and the house rules.",
        "commands": ["python3 bootstrap.py --minimal --dest ~/.claude/skills"],
        "evidence": [{"label": "BEGINNER-GUIDE.md", "href": "./../BEGINNER-GUIDE.md"}],
    },
    {
        "n": 3,
        "key": "first-run",
        "name": "First Crew Run",
        "brief": "Paste the starter prompt; the crew answers to 11 house rules.",
        "commands": ["# paste front-door/starter-prompt.md into any assistant"],
        "evidence": [{"label": "starter-prompt.md", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/front-door/starter-prompt.md"}],
    },
    {
        "n": 4,
        "key": "packs",
        "name": "Add Packs",
        "brief": "Add specialist packs incrementally; nothing is all-or-nothing.",
        "commands": [
            "python3 bootstrap.py --packs rigor,seo,legal --dest ~/.claude/skills",
            "python3 bootstrap.py --template review-crew --dest ~/.claude/skills",
        ],
        "evidence": [{"label": "MANIFEST.md", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/MANIFEST.md"}],
    },
    {
        "n": 5,
        "key": "board",
        "name": "Live Board",
        "brief": "Watch the crew work; nudge the silent, intervene mid-run.",
        "commands": ["python3 front-door/board_server.py --run-file front-door/sample-run.jsonl"],
        "evidence": [{"label": "Board (demo mode)", "href": "./../board/"}],
    },
    {
        "n": 6,
        "key": "paperclip",
        "name": "Paperclip Export",
        "brief": "Portable TEAM / PROJECT / COMPANY / TASK / AGENTS definitions.",
        "commands": ["python3 bootstrap.py --export-paperclip ~/my-team --template review-crew"],
        "evidence": [{"label": "bootstrap.py", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/bootstrap.py"}],
    },
]

# ---------------------------------------------------------------- containers
# Shipping containers on the yard = the surfaces this repo actually deploys.
# `href` is relative to https://<pages>/agent-call-sheet/tactical-ops/ and is
# checked against the assembled _site by tests/test_tactical_ops_page.py.
CONTAINERS = [
    {"id": "C-01", "label": "BEGINNER GUIDE", "href": "./../BEGINNER-GUIDE.md", "kind": "doc", "note": "5-minute quick start, zero-install test, troubleshooting table."},
    {"id": "C-02", "label": "MANIFEST", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/MANIFEST.md", "kind": "doc", "note": "Per-entry author, source, license evidence, distribution decision."},
    {"id": "C-03", "label": "MANIFEST CSV", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/manifest.csv", "kind": "doc", "note": "The machine-readable catalogue the manifest is generated from."},
    {"id": "C-04", "label": "LIVE BOARD", "href": "./../board/", "kind": "app", "note": "SSE dashboard with offline demo mode. Needs board_server.py for live runs."},
    {"id": "C-05", "label": "3D VISUALIZATION", "href": "./../visualization.html", "kind": "app", "note": "Kage-style five-layer architecture explorer (Three.js r158)."},
    {"id": "C-06", "label": "CALL SHEET", "href": "./../call-sheet/", "kind": "app", "note": "Scroll-synced mission briefing agenda."},
    {"id": "C-07", "label": "GAME DOCS (ARCHIVED)", "href": "./../archive/GAME-DOCS.html", "kind": "archive", "note": "The earlier game-style walkthrough, archived rather than deleted."},
    {"id": "C-08", "label": "THE FORK (EPISODE)", "href": "./../episode/ai-crew-the-fork.html", "kind": "media", "note": "Scripted demo episode plus its trailer. Silent; scripted, not live."},
    {"id": "C-09", "label": "EVAL HARNESS", "href": "https://github.com/veeresh-bikkaneti/agent-call-sheet/blob/main/eval/run_evals.py", "kind": "tool", "note": "Re-run it yourself: python3 eval/run_evals.py."},
]


# ---------------------------------------------------------------- build
def build() -> dict:
    gate = json.loads(read_text(GATE))
    ev = json.loads(read_text(EVAL))

    defects = []
    for d in gate["defects"]:
        did = d.get("id", "?")
        probe = PROBES.get(did)
        status, evidence = probe() if probe else ("open", ["no probe wired"])
        defects.append({
            "id": did,
            "severity": d.get("severity", "UNKNOWN"),
            "title": d.get("title", ""),
            "component": d.get("component", ""),
            "observed": d.get("observed", ""),
            "expected": d.get("expected", ""),
            "root_cause": d.get("root_cause", ""),
            "ruling": d.get("ruling") or "",
            "fix": d.get("fix") or "",
            "repro": d.get("repro") or [],
            "loadout": DEFECT_LOADOUT.get(did, "docs"),
            "status": status,
            "evidence": evidence,
        })

    status_counts = {}
    for d in defects:
        status_counts[d["status"]] = status_counts.get(d["status"], 0) + 1

    loadouts = []
    for lo in LOADOUTS:
        owned = [d["id"] for d in defects if d["loadout"] == lo["id"]]
        loadouts.append({**lo, "targets": owned})

    phases = []
    for i, crit in enumerate(gate.get("resubmission_criteria", []), start=1):
        rid = f"R{i}"
        key = PHASE_PROBE_KEY.get(rid)
        if key and key in PHASE_PROBES:
            st, evlist = PHASE_PROBES[key]()
        else:
            st, evlist = "open", ["requires a re-run of the suite with raw output attached; not a file probe"]
        phases.append({
            "id": rid,
            "criteria": crit,
            "class": PHASE_CLASS.get(rid, "docs"),
            "status": st,
            "evidence": evlist,
        })

    # manifest truth. The `files` column is populated on link-only rows too
    # (it counts files at the pinned upstream source, which are NOT vendored),
    # so installed-vs-upstream is reported separately rather than summed blindly.
    rows = list(csv.DictReader(read_text(MANIFEST).splitlines()))

    def files_of(rs) -> int:
        total = 0
        for r in rs:
            try:
                total += int(r.get("files") or 0)
            except ValueError:
                pass
        return total

    include_rows = [r for r in rows if (r.get("distribution") or "").strip() == "include"]
    link_rows = [r for r in rows if (r.get("distribution") or "").strip() == "link-only"]
    described_rows = [r for r in rows
                      if (r.get("distribution") or "").strip() not in ("include", "link-only")]

    packs: dict[str, dict] = {}
    for r in rows:
        p = (r.get("pack") or "").strip()
        if not p:
            continue
        e = packs.setdefault(p, {"id": p, "entries": 0, "files": 0, "include": 0, "link_only": 0})
        e["entries"] += 1
        try:
            e["files"] += int(r.get("files") or 0)
        except ValueError:
            pass
        dist = (r.get("distribution") or "").strip()
        if dist == "include":
            e["include"] += 1
        elif dist == "link-only":
            e["link_only"] += 1

    PACK_BLURB = {
        "crew-personas": "Specialist seats: reality checker, architects, developers, reviewers, test & evidence seats, security, AI/RAG/prompt/MCP, design, product, research, plus staged game-studio seats.",
        "rigor": "The discipline stack: ponytail, karpathy-guidelines, pstack picks, agents-orchestrator, Archify, Graphify, production-path verification.",
        "memory-comms": "/i-have-adhd output shaping, plus the memory and catch-up practices.",
        "design-video-3d": "Remotion, OpenFilm, Three.js skills, UI/UX and frontend design, page-mascot, motionmaxxing, plus reference libraries (link-only).",
        "seo": "One leaf skill per job: canonical, sitemap, Core Web Vitals, schema, keywords, local, programmatic, and the rest.",
        "legal": "legal-advisor, gdpr-privacy.",
    }
    pack_list = []
    for pid, e in packs.items():
        pack_list.append({**e, "blurb": PACK_BLURB.get(pid, "")})
    pack_list.sort(key=lambda e: (-e["entries"], e["id"]))

    return {
        "schema": "tactical-ops/v1",
        "generatedFromCommit": git_head(),
        "sources": {
            "gate": "gate-verdict.agent-readable.v1.json",
            "eval": "eval/results.json",
            "manifest": "manifest.csv",
        },
        "gate": {
            "verdict": gate.get("verdict"),
            "summary": gate.get("one_line_summary"),
            "date": gate.get("date"),
            "seat": gate.get("author_seat"),
            "underTest": gate.get("artifact_under_test", {}).get("commit"),
            "shame": gate.get("shame_index", {}),
            "finalNote": gate.get("final_note_to_builder"),
            "limitations": gate.get("limitations_not_tested_by_gate", []),
        },
        "eval": {
            "harness": ev.get("harness"),
            "runAt": ev.get("run_at"),
            "kitHead": ev.get("kit_head"),
            "incomplete": ev.get("incomplete"),
            "counts": ev.get("counts", {}),
            "standingNotRun": ev.get("standing_not_run", []),
            "nonClaims": ev.get("non_claims", []),
        },
        "manifest": {
            "entries": len(rows),
            "packs": len(pack_list),
            "include": {"rows": len(include_rows), "files": files_of(include_rows)},
            "linkOnly": {"rows": len(link_rows), "filesAtUpstream": files_of(link_rows)},
            "described": {"rows": len(described_rows)},
            "installedFiles": files_of(include_rows),
            "allFilesColumn": files_of(rows),
        },
        "defects": defects,
        "defectStatus": status_counts,
        "loadouts": loadouts,
        "boss": {
            "name": "PRODUCTION READINESS",
            "phases": phases,
            "verdict": gate.get("verdict"),
        },
        "waves": WAVES,
        "containers": CONTAINERS,
        "packList": pack_list,
    }


def main() -> int:
    data = build()
    body = json.dumps(data, indent=2, ensure_ascii=False)
    text = (
        "// GENERATED FILE — do not edit by hand.\n"
        "// Rebuild with: python3 site/tactical-ops/build-ops-data.py\n"
        "// Every count and status below is read out of gate-verdict.agent-readable.v1.json,\n"
        "// eval/results.json, manifest.csv and the source files it names.\n"
        f"export const OPS = {body};\n"
    )
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(REPO)}  ({len(text)} bytes)")
    print(f"  commit      : {data['generatedFromCommit']}")
    print(f"  gate verdict: {data['gate']['verdict']} ({data['gate']['underTest']})")
    print(f"  defects     : {len(data['defects'])}  {data['defectStatus']}")
    print(f"  manifest    : {data['manifest']}")
    print(f"  packs       : {[ (p['id'], p['entries']) for p in data['packList'] ]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
