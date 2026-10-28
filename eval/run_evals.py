#!/usr/bin/env python3
"""Agent Call Sheet — integrity + saved-input eval harness.

Run:  python3 eval/run_evals.py        (from anywhere; paths self-locate)

Stdlib only. The one external runtime is `node`, used solely to execute
board.html's OWN fold code (extracted verbatim, never reimplemented).

Tier 1 — integrity (all 120 included manifest rows):
  exists at local_path; folder column == basename(local_path); on-disk file
  count == manifest `files`; frontmatter consistent with the manifest's
  recorded frontmatter_status (spec-compliant rows must parse with name +
  description; `none` rows must indeed carry none); blob-SHA == upstream at
  `upstream_pin` where a pin is recorded and the upstream path is derivable
  from the row's source_url. Rows with `unrecorded` pins, original rows,
  and rows whose upstream shape is not derivable report NOT RUN with a
  reason code — never PASS.
Tier 2 — saved-input (the kit's own original material only):
  board fold: front-door/board.html's parseRunText + fold, extracted
  byte-for-byte from the shipped file and run under node, over the saved
  fixtures in eval/cases/ vs their goldens; starter-prompt fence
  byte-identity + rule count/order/anchors vs goldens; crew-orchestrator
  SKILL.md status-field cross-reference vs front-door/status-contract.md.
Negative controls — each mutates a scratch copy and must FAIL with the
  named assertion; a control whose target check passes is a harness FAIL.

Claims: Tier 1 proves the kit did not corrupt vendored files. Tier 2
proves deterministic saved-input behaviour of the kit's own material.
NEITHER proves a persona works with a live model.

Every case ends PASS / FAIL / NOT RUN (reason code). Exit is non-zero on
any FAIL or any core NOT RUN; standing NOT RUN items (unrecorded pins,
original rows, the literal name==folder reading, prior out-of-repo
runners) are listed in the output and results.json, and do not by
themselves fail the run — they are named exceptions, carried whole.
"""
import csv, hashlib, io, json, os, re, shutil, subprocess, sys, tempfile
import urllib.request, urllib.error
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CASES = os.path.join(HERE, "cases")
RESULTS = []  # {tier, case, assertion, status, core, reason, detail}

def add(tier, case, assertion, status, core=True, reason="", detail=""):
    RESULTS.append({"tier": tier, "case": case, "assertion": assertion,
                    "status": status, "core": core, "reason": reason,
                    "detail": detail})

def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def sha256(b):
    return hashlib.sha256(b).hexdigest()

# ---------- manifest ----------
def load_rows(root=ROOT):
    raw = open(os.path.join(root, "manifest.csv"), "rb").read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))

# ---------- frontmatter ----------
def parse_frontmatter(text):
    """Return dict of top-level keys -> value (first line), or None if the
    file does not open with a complete --- block."""
    if not text.startswith("---"):
        return None
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    out, cur = {}, None
    for line in lines[1:]:
        if line.strip() in ("---", "..."):
            return out
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if m:
            cur = m.group(1)
            out[cur] = m.group(2).strip()
        elif cur and line.strip():
            if not out[cur]:
                out[cur] = line.strip()
    return None  # no closing fence

def check_frontmatter(skill_path, recorded):
    """(status, detail) for one row's root SKILL.md."""
    if recorded == "n/a (not a skill)":
        return "NOT RUN", "not-a-skill"
    if not os.path.isfile(skill_path):
        return "FAIL", "root SKILL.md missing"
    text = open(skill_path, encoding="utf-8", errors="replace").read()
    fm = parse_frontmatter(text)
    if recorded == "none":
        return ("PASS", "no frontmatter, as recorded") if fm is None else \
               ("FAIL", "frontmatter present but manifest records 'none'")
    if fm is None:
        return "FAIL", "frontmatter does not parse (no complete --- block)"
    name = (fm.get("name") or "").strip("\"'")
    desc = (fm.get("description") or "").strip("\"'")
    if not name or not desc:
        return "FAIL", "name/description missing in frontmatter"
    return "PASS", "name+description present"

# ---------- upstream pin (blob-SHA recompute) ----------
def fetch_tree(repo, pin):
    url = f"https://api.github.com/repos/{repo}/git/trees/{pin}?recursive=1"
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "agent-call-sheet-eval-harness"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    if d.get("truncated"):
        raise ValueError("tree truncated")
    return {t["path"]: t["sha"] for t in d["tree"] if t["type"] == "blob"}

def local_files(dirpath):
    out = []
    for base, dirs, files in os.walk(dirpath):
        dirs.sort()
        for f in sorted(files):
            out.append(os.path.relpath(os.path.join(base, f), dirpath).replace(os.sep, "/"))
    return out

def check_pin(row, dirpath, tree):
    """(status, reason, detail). tree: {path: blob_sha} for the upstream
    repo at the row's pin, or None when the fetch failed."""
    pin = row.get("upstream_pin", "")
    if pin == "":
        return "NOT RUN", "original-material-no-upstream", ""
    if pin == "unrecorded":
        return "NOT RUN", "pin-unrecorded", ""
    if tree is None:
        return "NOT RUN", "upstream-unreachable", ""
    url = row["source_url"]
    m = re.match(r"https://github\.com/([^/]+/[^/]+)(?:/(blob|tree)/[^/]+/(.+))?$", url)
    if not m or not m.group(2):
        return "NOT RUN", "upstream-path-unmapped", f"source_url shape: {url}"
    kind, upath = m.group(2), m.group(3)
    files = local_files(dirpath)
    mapping = {}  # local rel -> upstream path
    if kind == "blob":
        mapping["SKILL.md"] = upath
        extra = [f for f in files if f not in ("SKILL.md", "UPSTREAM-LICENSE")]
        if extra or "SKILL.md" not in files:
            return "NOT RUN", "upstream-path-unmapped", f"local shape differs: {extra[:3]}"
    else:  # tree: upstream folder copied as-is
        prefix = upath + "/"
        upstream_rels = {p[len(prefix):] for p in tree if p.startswith(prefix)}
        local_rels = {f for f in files if f != "UPSTREAM-LICENSE"}
        if local_rels != upstream_rels:
            return "NOT RUN", "upstream-path-unmapped", \
                   f"file sets differ (local {len(local_rels)} vs upstream {len(upstream_rels)})"
        mapping = {rel: prefix + rel for rel in local_rels}
    # kit-added root license copy, where shipped
    if "UPSTREAM-LICENSE" in files:
        lic = next((c for c in ("LICENSE", "LICENSE.md", "LICENSE.txt")
                    if c in tree), None)
        if lic is None:
            return "FAIL", "", "UPSTREAM-LICENSE shipped but no root license at pin"
        mapping["UPSTREAM-LICENSE"] = lic
    for rel, up in sorted(mapping.items()):
        want = tree.get(up)
        if want is None:
            return "FAIL", "", f"upstream file missing at pin: {up}"
        got = blob_sha(open(os.path.join(dirpath, rel), "rb").read())
        if got != want:
            return "FAIL", "", f"blob SHA mismatch: {rel} (local {got[:10]} != upstream {want[:10]})"
    return "PASS", "", f"{len(mapping)} file(s) blob-SHA verified at {pin[:10]}"

# ---------- board fold (board.html's own code, extracted verbatim) ----------
def extract_fold(board_text):
    parts = []
    m = re.search(r"^var REQUIRED = .*;$", board_text, re.M)
    parts.append(m.group(0))
    for fn in ("parseRunText", "normStatus", "fold"):
        i = board_text.index(f"function {fn}(")
        depth, k = 0, board_text.index("{", i)
        while True:
            c = board_text[k]
            if c == "{": depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0: break
            k += 1
        parts.append(board_text[i:k + 1])
    return "\n".join(parts)

DRIVER_TAIL = """
const fs = require('fs');
let ds = {events: [], skipped: 0};
const parsed = parseRunText(fs.readFileSync(process.argv[2], 'utf8'));
ds = {events: parsed.events, skipped: parsed.skipped};
process.stdout.write(JSON.stringify({events: parsed.events, order: parsed.order,
  skipped: parsed.skipped, folded: fold(parsed.events.length)}));
"""

def run_fold(board_text, input_path, tmp):
    node = shutil.which("node")
    if not node:
        return None, "js-runtime-missing"
    driver = os.path.join(tmp, "driver.js")
    with open(driver, "w", encoding="utf-8") as fh:
        fh.write(extract_fold(board_text) + DRIVER_TAIL)
    r = subprocess.run([node, driver, input_path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("board fold driver failed: " + r.stderr[:300])
    return json.loads(r.stdout), ""

def board_case(board_text, name, tmp, input_path=None, golden_path=None):
    input_path = input_path or os.path.join(CASES, name + ".jsonl")
    golden_path = golden_path or os.path.join(CASES, name + ".golden.json")
    got, why = run_fold(board_text, input_path, tmp)
    if got is None:
        return "NOT RUN", why, ""
    want = json.load(open(golden_path, encoding="utf-8"))
    return ("PASS", "", "") if got == want else ("FAIL", "", "folded state != golden")

# ---------- starter prompt ----------
def fence_of(md_text):
    m = re.search(r"```text\n(.*?)```", md_text, re.S)
    return m.group(1) if m else None

def check_prompt(fence, golden_fence, rules_golden):
    out = []
    out.append(("starter-prompt-byte-identity",
                "PASS" if fence is not None and fence.encode() == golden_fence else "FAIL"))
    rules = []
    if fence:
        for line in fence.splitlines():
            mm = re.match(r"^(\d+)\.\s", line)
            if mm: rules.append(int(mm.group(1)))
    out.append(("starter-prompt-rule-count-order",
                "PASS" if rules == rules_golden["rule_numbers"] else "FAIL"))
    anchors_ok = fence is not None and all(
        a in fence for a in rules_golden["anchors"]) and \
        [fence.index(a) for a in rules_golden["anchors"]] == \
        sorted(fence.index(a) for a in rules_golden["anchors"] if a in fence)
    out.append(("starter-prompt-anchors", "PASS" if anchors_ok else "FAIL"))
    return out

# ---------- orchestrator / contract cross-reference ----------
def contract_fields(contract_text):
    req = re.search(r"Required on every line:\s*(.+)\.", contract_text)
    opt = re.search(r"Optional:\s*(.+)\.", contract_text)
    grab = lambda s: re.findall(r"`([a-z_]+)`", s) if s else []
    return grab(req.group(1) if req else ""), grab(opt.group(1) if opt else "")

def check_xref(contract_text, orch_text):
    req, opt = contract_fields(contract_text)
    if not req or not opt:
        return "FAIL", "contract field lists not found"
    seg = orch_text.split("**Fields:**", 1)[1].split("Every value", 1)[0] \
        if "**Fields:**" in orch_text else ""
    orch_req = re.findall(r"`([a-z_]+)`", seg.split("; optional")[0]) if seg else []
    table = set(re.findall(r"^\| `([a-z_]+)` \|", orch_text, re.M))
    if set(orch_req) != set(req):
        return "FAIL", f"required mismatch: orchestrator {orch_req} vs contract {req}"
    if table != set(req) | set(opt):
        return "FAIL", f"field table mismatch: orchestrator {sorted(table)} vs contract {sorted(set(req) | set(opt))}"
    return "PASS", f"{len(req)} required + {len(opt)} optional fields agree"

# ---------- main ----------
def main():
    rows = load_rows()
    inc = [r for r in rows if r["distribution"] == "include"]
    board_text = open(os.path.join(ROOT, "front-door", "board.html"), encoding="utf-8").read()
    tmp = tempfile.mkdtemp(prefix="acs-eval-")

    # ----- Tier 1: local integrity -----
    for r in inc:
        case = r["folder"] or r["name"]
        lp, dirpath = r["local_path"], os.path.join(ROOT, r["local_path"])
        ok = os.path.isdir(dirpath)
        add("tier1", case, "exists-at-local-path", "PASS" if ok else "FAIL",
            detail=lp)
        add("tier1", case, "folder-eq-path-basename",
            "PASS" if r["folder"] == os.path.basename(lp) else "FAIL",
            detail=f"folder={r['folder']} path={lp}")
        if ok:
            n = len(local_files(dirpath))
            add("tier1", case, "disk-count-eq-manifest",
                "PASS" if n == int(r["files"]) else "FAIL",
                detail=f"disk {n} vs manifest {r['files']}")
            st, det = check_frontmatter(os.path.join(dirpath, "SKILL.md"),
                                         r["frontmatter_status"])
            add("tier1", case, "frontmatter-vs-recorded-status", st,
                core=(st != "NOT RUN"), reason=det if st == "NOT RUN" else "",
                detail=det)
        else:
            add("tier1", case, "disk-count-eq-manifest", "FAIL", detail="dir missing")
            add("tier1", case, "frontmatter-vs-recorded-status", "FAIL", detail="dir missing")

    # ----- Tier 1: pin blob-SHA (grouped by upstream repo) -----
    trees = {}
    for r in inc:
        pin = r.get("upstream_pin", "")
        if len(pin) != 40:
            continue
        repo = "/".join(r["source_url"].replace("https://github.com/", "").split("/")[:2])
        if repo not in trees:
            try:
                trees[repo] = fetch_tree(repo, pin)
            except Exception as e:
                trees[repo] = None
                print(f"note: upstream fetch failed for {repo}: {e}", file=sys.stderr)
    for r in inc:
        case = r["folder"] or r["name"]
        pin = r.get("upstream_pin", "")
        if len(pin) != 40:
            st, reason, det = check_pin(r, "", None)
            add("tier1", case, "pin-blob-sha", st, core=False, reason=reason, detail=det)
            continue
        repo = "/".join(r["source_url"].replace("https://github.com/", "").split("/")[:2])
        st, reason, det = check_pin(r, os.path.join(ROOT, r["local_path"]), trees[repo])
        add("tier1", case, "pin-blob-sha", st, core=(st == "PASS" or reason == ""),
            reason=reason, detail=det)

    # Literal name==folder: vendored frontmatter names are upstream's own
    # (kit folders add local-/category prefixes; vendored bytes must not be
    # edited). Measured here, reported NOT RUN — see EVAL-GATE.md.
    mismatch = 0; spec = 0
    for r in inc:
        if r["frontmatter_status"] != "spec-compliant":
            continue
        spec += 1
        fm = parse_frontmatter(open(os.path.join(ROOT, r["local_path"], "SKILL.md"),
                                     encoding="utf-8", errors="replace").read())
        if not fm or (fm.get("name") or "").strip("\"'") != r["folder"]:
            mismatch += 1
    add("tier1", "all-included", "frontmatter-name-eq-folder-literal", "NOT RUN",
        core=False, reason="vendored-name-is-upstream",
        detail=f"{mismatch}/{spec} spec-compliant rows carry an upstream "
               "frontmatter name that differs from the kit folder by design")

    # ----- Tier 1: manifest twins + kit_version recompute -----
    md = open(os.path.join(ROOT, "MANIFEST.md"), encoding="utf-8").read()
    # twin check: rebuild the expected MD version lines from the CSV, in order
    segs = re.findall(r"^- Upstream pin: (.*?)$", md, re.M)
    twin_ok = len(segs) == len(rows)
    if twin_ok:
        for row, seg in zip(rows, segs):
            pin = row.get("upstream_pin", "")
            want_pin = f"`{pin}`" if pin else "— (original material — no upstream)"
            if not seg.startswith(want_pin) or f"Kit version: `{row.get('kit_version','')}`" not in seg:
                twin_ok = False
                break
    add("tier1", "manifest-twins", "csv-md-version-columns-agree",
        "PASS" if twin_ok else "FAIL",
        detail=f"{len(segs)} MD version lines vs {len(rows)} CSV rows")
    git = shutil.which("git")
    if git and os.path.isdir(os.path.join(ROOT, ".git")):
        bad = []
        for r in inc:
            out = subprocess.run([git, "-C", ROOT, "log", "-1", "--format=%H",
                                  "--", r["local_path"]], capture_output=True, text=True)
            if out.stdout.strip()[:7] != r.get("kit_version", ""):
                bad.append(r["folder"])
        add("tier1", "kit-version", "kit-version-recompute-from-git-log",
            "PASS" if not bad else "FAIL",
            detail="all 120 recompute" if not bad else f"mismatch: {bad[:5]}")
    else:
        add("tier1", "kit-version", "kit-version-recompute-from-git-log",
            "NOT RUN", core=False, reason="git-unavailable",
            detail="column derivation recorded in EVAL-GATE.md")

    # Prior structural runners live outside the repo (goal workspace), as
    # runnable scripts they do not exist in this tree — never re-claimed.
    for name in ("bundle-validator", "frontmatter-harness", "normalisation-runner",
                 "board-playwright-harness"):
        add("tier1", name, "prior-runner-rerun", "NOT RUN", core=False,
            reason="prior-harness-not-in-repo",
            detail="prior result not re-claimed; board fold itself is re-run in Tier 2")

    # ----- Tier 2 -----
    for name in ("board-real-run", "board-sample-run", "board-edge", "board-trap", "board-cost"):
        st, reason, det = board_case(board_text, name, tmp)
        add("tier2", name, "board-fold-golden", st, reason=reason, detail=det)
    prompt_md = open(os.path.join(ROOT, "front-door", "starter-prompt.md"), encoding="utf-8").read()
    golden_fence = open(os.path.join(CASES, "starter-prompt.fence.txt"), "rb").read()
    rules_golden = json.load(open(os.path.join(CASES, "starter-prompt.rules.json")))
    for assertion, st in check_prompt(fence_of(prompt_md), golden_fence, rules_golden):
        add("tier2", "starter-prompt", assertion, st)
    contract = open(os.path.join(ROOT, "front-door", "status-contract.md"), encoding="utf-8").read()
    orch = open(os.path.join(ROOT, "front-door", "crew-orchestrator", "SKILL.md"), encoding="utf-8").read()
    st, det = check_xref(contract, orch)
    add("tier2", "orchestrator-contract", "orchestrator-contract-fields", st, detail=det)

    # ----- Negative controls (scratch copies; target check MUST fail) -----
    nc = os.path.join(tmp, "nc"); os.makedirs(nc)
    def control(name, assertion, got_status, got_assertion):
        ok = got_status == "FAIL" and got_assertion == assertion
        add("negative-controls", name, assertion, "PASS" if ok else "FAIL",
            detail=f"target check returned {got_status} ({got_assertion})"
                   if ok else "CONTROL PASSED ITS TARGET CHECK — harness meta-FAIL")
    # 1. byte flip in a vendored copy -> pin-blob-sha must FAIL
    row = next(r for r in inc if r["folder"] == "local-title")
    dst = os.path.join(nc, "local-title"); shutil.copytree(os.path.join(ROOT, row["local_path"]), dst)
    p = os.path.join(dst, "SKILL.md"); data = bytearray(open(p, "rb").read())
    data[len(data) // 2] ^= 0x01; open(p, "wb").write(bytes(data))
    repo = "kostja94/marketing-skills"
    st, _, det = check_pin(row, dst, trees.get(repo))
    control("byte-flip-vendored-copy", "pin-blob-sha", st, "pin-blob-sha")
    # 2. corrupted frontmatter -> frontmatter check must FAIL
    bad = os.path.join(nc, "bad-fm"); os.makedirs(bad)
    open(os.path.join(bad, "SKILL.md"), "w").write("---\nname: broken\ndescription: no closing fence\n")
    st, _ = check_frontmatter(os.path.join(bad, "SKILL.md"), "spec-compliant")
    control("corrupted-frontmatter", "frontmatter-vs-recorded-status", st,
            "frontmatter-vs-recorded-status")
    # 3. board trap mutation: append a valid overwriting line -> golden must FAIL
    trap_in = os.path.join(nc, "trap-mut.jsonl")
    shutil.copyfile(os.path.join(CASES, "board-trap.jsonl"), trap_in)
    with open(trap_in, "a", encoding="utf-8") as fh:
        fh.write('{"agent": "Ada", "task": "Write the doc", "phase": "REPORT", "status": "done", "artifact": "doc.md"}\n')
    st, _, _ = board_case(board_text, "board-trap", tmp, input_path=trap_in)
    control("board-trap-line-set", "board-fold-golden", st, "board-fold-golden")
    # 4. tampered golden -> comparison must FAIL
    tampered = os.path.join(nc, "tampered.golden.json")
    g = json.load(open(os.path.join(CASES, "board-sample-run.golden.json")))
    g["folded"]["latest"]["Builder"]["status"] = "tampered"
    json.dump(g, open(tampered, "w"))
    st, _, _ = board_case(board_text, "board-sample-run", tmp, golden_path=tampered)
    control("tampered-golden", "board-fold-golden", st, "board-fold-golden")
    # 5. one-char starter-prompt edit -> byte-identity must FAIL
    fence = fence_of(prompt_md)
    res = check_prompt(fence[:-2] + ("x" if fence[-2] != "x" else "y") + fence[-1],
                       golden_fence, rules_golden)
    st = dict(res)["starter-prompt-byte-identity"]
    control("one-char-prompt-edit", "starter-prompt-byte-identity", st,
            "starter-prompt-byte-identity")
    # 6. renamed contract field in orchestrator -> cross-reference must FAIL
    st, _ = check_xref(contract, orch.replace("`waiting_on`", "`waitingOn`"))
    control("renamed-contract-field", "orchestrator-contract-fields", st,
            "orchestrator-contract-fields")

    # ----- report -----
    tiers = {}
    for rec in RESULTS:
        tiers.setdefault(rec["tier"], {"PASS": 0, "FAIL": 0, "NOT RUN": 0})
        tiers[rec["tier"]][rec["status"]] += 1
    fails = [r for r in RESULTS if r["status"] == "FAIL"]
    core_notrun = [r for r in RESULTS if r["status"] == "NOT RUN" and r["core"]]
    standing = [r for r in RESULTS if r["status"] == "NOT RUN" and not r["core"]]
    for t, c in tiers.items():
        print(f"{t}: PASS {c['PASS']} / FAIL {c['FAIL']} / NOT RUN {c['NOT RUN']}")
    for r in fails + core_notrun:
        print(f"  {r['status']}: {r['tier']}/{r['case']}/{r['assertion']} "
              f"{r['reason']} {r['detail']}")
    print(f"standing NOT RUN (named exceptions): {len(standing)}")
    incomplete = bool(core_notrun)
    if incomplete:
        print("run labelled INCOMPLETE: core NOT RUN present")
    summary = {
        "harness": "eval/run_evals.py v1",
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "kit_head": (subprocess.run([git, "-C", ROOT, "rev-parse", "HEAD"],
                     capture_output=True, text=True).stdout.strip()
                     if git and os.path.isdir(os.path.join(ROOT, ".git")) else None),
        "manifest_csv_sha256": sha256(open(os.path.join(ROOT, "manifest.csv"), "rb").read()),
        "board_html_sha256": sha256(board_text.encode()),
        "extracted_fold_sha256": sha256(extract_fold(board_text).encode()),
        "counts": tiers, "incomplete": incomplete,
        "cases": RESULTS,
        "standing_not_run": [f"{r['tier']}/{r['case']}/{r['assertion']}: {r['reason']}"
                             for r in standing],
        "non_claims": [
            "Tier 1 proves the kit did not corrupt vendored files.",
            "Tier 2 proves deterministic saved-input behaviour of the kit's own material.",
            "Neither tier proves a persona works with a live model."],
    }
    json.dump(summary, open(os.path.join(HERE, "results.json"), "w"), indent=1)
    print(f"results -> {os.path.join(HERE, 'results.json')}")
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if (fails or core_notrun) else 0

if __name__ == "__main__":
    sys.exit(main())
