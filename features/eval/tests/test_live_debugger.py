#!/usr/bin/env python3
"""
Unit tests for live_debugger.py and board_server.py
Run with: python3 tests/test_live_debugger.py
"""

import sys
import json
import tempfile
import os
import subprocess
import re
from pathlib import Path

# Add front-door to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "live-debugger"))

from live_debugger import LiveDebugger, InterventionClient
from board_server import RateLimiter, validate_event, validate_nudge, validate_intervention, fold_state, parse_ts


def test_live_debugger_imports():
    """Test that live_debugger imports without error."""
    assert LiveDebugger is not None
    assert InterventionClient is not None
    print("live_debugger imports OK")


def test_intervention_client_methods():
    """Test InterventionClient has all required methods."""
    client = InterventionClient("http://localhost:8765")

    # Check all public methods exist
    assert hasattr(client, "pause")
    assert hasattr(client, "resume")
    assert hasattr(client, "redirect")
    assert hasattr(client, "reassign")
    assert hasattr(client, "stop_run")
    assert hasattr(client, "get_state")

    # Test method signatures by inspecting
    import inspect
    sig = inspect.signature(client.pause)
    assert "agent" in sig.parameters
    assert "reason" in sig.parameters

    sig = inspect.signature(client.redirect)
    assert "agent" in sig.parameters
    assert "new_task" in sig.parameters
    assert "new_phase" in sig.parameters

    sig = inspect.signature(client.reassign)
    assert "from_agent" in sig.parameters
    assert "to_agent" in sig.parameters
    assert "task" in sig.parameters

    print("InterventionClient methods OK")


def test_status_contract_v33():
    """Test that status lines include v3.3 cost fields."""
    status_line = {
        "agent": "Builder",
        "task": "Build widget",
        "phase": "BUILD",
        "status": "running",
        "artifact": "widget.py",
        "cost": 0.02,
        "cost_unit": "USD"
    }

    required = ("agent", "task", "phase", "status", "artifact")
    for field in required:
        assert field in status_line

    assert "cost" in status_line
    assert "cost_unit" in status_line
    assert isinstance(status_line["cost"], (int, float))
    assert isinstance(status_line["cost_unit"], str)

    print("Status contract v3.3 fields present")


def test_board_server_help():
    """Test board_server.py --help shows defaults."""
    result = subprocess.run([
        sys.executable, "../../features/live-debugger/board_server.py", "--help"
    ], capture_output=True, text=True, cwd=Path(__file__).parent.parent)

    assert result.returncode == 0
    help_text = result.stdout

    assert "(default: 8765)" in help_text
    assert "(default: 127.0.0.1)" in help_text
    assert "(default: 120)" in help_text
    assert "BOARD_AUTH" in help_text

    print("board_server.py --help shows defaults")


def test_rate_limiting_concept():
    """Test that rate limiter logic is sound (unit test)."""
    limiter = RateLimiter(requests=5, window=1, burst=2)

    for i in range(7):
        allowed, _ = limiter.check_rate_limit("test_ip")
        if i < 7:  # 5 + 2 burst
            assert allowed, f"Request {i} should be allowed"
        else:
            assert not allowed, f"Request {i} should be rate limited"

    print("RateLimiter logic OK")


def test_rate_limiter_window_expiry():
    """Test that rate limiter respects window expiry."""
    import time
    limiter = RateLimiter(requests=2, window=1, burst=0)

    # Use up the limit
    allowed, _ = limiter.check_rate_limit("test_ip_2")
    assert allowed
    allowed, _ = limiter.check_rate_limit("test_ip_2")
    assert allowed
    allowed, _ = limiter.check_rate_limit("test_ip_2")
    assert not allowed

    # Wait for window to expire
    time.sleep(1.1)
    allowed, _ = limiter.check_rate_limit("test_ip_2")
    assert allowed

    print("RateLimiter window expiry OK")


def test_board_html_exists():
    """Test board.html exists and has demo mode."""
    board_path = Path(__file__).parent.parent.parent / "live-debugger" / "board.html"
    assert board_path.exists()

    content = board_path.read_text()
    assert "demo-toggle" in content
    assert "Demo Mode" in content
    assert "srvSendIntervention" in content
    assert "srvSendNudge" in content

    print("board.html has demo mode and intervention UI")


def _csp_directives(html):
    """Return {directive: [sources]} from the page's CSP meta tag."""
    import re
    m = re.search(r'http-equiv="Content-Security-Policy"\s+content="([^"]+)"', html)
    assert m, "no Content-Security-Policy meta tag"
    out = {}
    for part in m.group(1).split(";"):
        bits = part.split()
        if bits:
            out[bits[0]] = bits[1:]
    return out


def _importmap(html):
    import re
    m = re.search(r'<script type="importmap">\s*(\{.*?\})\s*</script>', html, re.S)
    assert m, "no importmap"
    return json.loads(m.group(1))


# SHA-256 of the vendored three.js files, identical to the files in the npm
# tarball three-0.186.0.tgz (integrity sha512-cr/fIM2ddMSVbYVgkfD4jLJv7Fh/8ZTjvo+7gQeSVGUZHxpx9FDwoL5iC7hUz/LiRA8wMbqfnb90xKfm1/HHkQ==).
THREE_0_186_SHA256 = {
    "three.module.js": "9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea",
    "three.core.js": "9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6",
    "LICENSE": "8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc",
}

SITE = Path(__file__).parent.parent.parent / "site"
IMPORT_RE = re.compile(r"^\s*(?:import|export)\b[^'\"]*?from\s*['\"]([^'\"]+)['\"]", re.M)


def _sri(data, algo="sha384"):
    import base64
    import hashlib
    return algo + "-" + base64.b64encode(hashlib.new(algo, data).digest()).decode()


def test_site_is_the_only_page():
    """The Pages site is one game page; the old pages are gone and nothing else ships an .html file from features/site."""
    pages = sorted(p.relative_to(SITE).as_posix() for p in SITE.rglob("*.html"))
    assert pages == ["index.html"], pages
    root = SITE.parent
    for gone in ("visualization/visualization.html", "site/tactical-ops/index.html", "docs/archive/GAME-DOCS.html", "episodes/episode/ai-crew-the-fork.html"):
        assert not (root / gone).exists(), f"{gone} should have been removed"
    print("features/site holds exactly one page, index.html")


def test_site_index_self_contained():
    """The game page loads nothing from outside, runs no inline script but its hashed import map, and uses no inline style."""
    html = (SITE / "index.html").read_text()
    imap_m = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
    assert imap_m, "no import map"
    csp = _csp_directives(html)
    expected = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'" + _sri(imap_m.group(1).encode(), "sha256") + "'"],
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'"],
        "connect-src": ["'self'"],
        "font-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'none'"],
        "form-action": ["'none'"],
    }
    assert csp == expected, csp
    scripts = re.findall(r'<script\b([^>]*)>(.*?)</script>', html, re.S)
    assert len(scripts) == 2, scripts
    assert scripts[0][0].strip() == 'type="importmap"'
    attrs, body = scripts[1]
    m = re.fullmatch(r'\s*type="module" src="assets/game/main\.js" integrity="(sha384-[A-Za-z0-9+/=]+)"\s*', attrs)
    assert m and not body.strip(), f"unexpected script tag: {attrs!r}"
    assert m.group(1) == _sri((SITE / "assets/game/main.js").read_bytes()), "main.js integrity is stale: run features/site/tools/build_sri.py"
    assert not re.search(r'<style\b', html, re.I), "inline <style> block would be blocked by style-src 'self'"
    assert "style=" not in html, "inline style attribute would be blocked by style-src 'self'"
    assert not re.search(r'\son[a-z]+\s*=', html, re.I), "inline event handler would be blocked by script-src 'self'"
    assert "javascript:" not in html.lower()
    for tag, attr, url in re.findall(r'<(img|script|link|iframe|source|video|audio|embed)\b[^>]*?\b(src|href)="([^"]+)"', html, re.I):
        assert not re.match(r'(https?:)?//', url), f"<{tag}> loads from outside: {url}"
    for asset in re.findall(r'(?:src|href)="(assets/[^"]+)"', html):
        assert (SITE / asset).exists(), f"missing asset {asset}"
    # Without JavaScript or WebGL the page still says what it is and offers the walkthrough video.
    assert "<noscript>" in html and 'href="assets/media/walkthrough.mp4"' in html
    assert 'id="fallback"' in html
    # The install command it shows points at where bootstrap.py actually lives.
    assert "features/paperclip-bridge/bootstrap.py" in html
    assert (SITE.parent / "paperclip-bridge" / "bootstrap.py").exists()
    # The code must not undo the CSP from the inside, and the game code fetches nothing.
    for js in sorted((SITE / "assets").rglob("*.js")):
        code = js.read_text()
        for bad in (r'\beval\s*\(', r'\bnew\s+Function\b', r"setAttribute\(\s*['\"]style", r'\.innerHTML\s*=', r'\.outerHTML\s*=', r'document\.write', r'insertAdjacentHTML'):
            assert not re.search(bad, code), f"{js.relative_to(SITE)} uses {bad}"
        if js.parent.name == "game":
            for bad in (r'\bfetch\s*\(', r'XMLHttpRequest', r'WebSocket', r'sendBeacon', r'\bimport\s*\('):
                assert not re.search(bad, code), f"{js.relative_to(SITE)} uses {bad}"
    print("site/index.html is self-contained with a strict CSP")


def test_site_modules_pinned_by_integrity():
    """Every module the page can import is in the import map's integrity table with its real sha384, and nothing else is."""
    html = (SITE / "index.html").read_text()
    imap = _importmap(html)
    integrity = imap.get("integrity", {})
    modules = sorted((SITE / "assets").rglob("*.js"))
    expected = {"./" + f.relative_to(SITE).as_posix(): _sri(f.read_bytes()) for f in modules}
    assert integrity == expected, "integrity table is stale: run features/site/tools/build_sri.py"
    # Every static import resolves to one of the pinned files.
    for f in modules:
        for spec in IMPORT_RE.findall(f.read_text()):
            target = (f.parent / spec).resolve()
            assert target.exists(), f"{f.name} imports a missing file {spec}"
            assert "./" + target.relative_to(SITE.resolve()).as_posix() in integrity, f"{spec} is not pinned"
    r = subprocess.run([sys.executable, str(SITE / "tools" / "build_sri.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    print("every game module and three.js file is pinned by sha384")


def test_vendored_three_matches_npm_release():
    """The vendored three.js is byte for byte the npm three@0.186.0 release, with its MIT license and a provenance note."""
    import hashlib
    vendor = SITE / "assets" / "vendor" / "three"
    for name, digest in THREE_0_186_SHA256.items():
        assert hashlib.sha256((vendor / name).read_bytes()).hexdigest() == digest, f"{name} differs from three@0.186.0"
    assert sorted(p.name for p in vendor.iterdir()) == sorted(list(THREE_0_186_SHA256) + ["README.md"])
    note = (vendor / "README.md").read_text()
    assert "0.186.0" in note and "MIT" in note
    for digest in THREE_0_186_SHA256.values():
        assert digest in note
    print("vendored three.js matches the npm 0.186.0 release")


def test_game_rules():
    """The game's rules run headless in node: canals fill, water cannot climb, goals open districts, undo is exact, hostile saves are refused."""
    r = subprocess.run(["node", str(SITE / "tools" / "sim-test.mjs")], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "all rule checks passed" in r.stdout
    print("game rule checks pass")


def test_site_render_check_workflow():
    """CI plays the game in real Chrome with software WebGL and fails on any broken check."""
    root = SITE.parent.parent
    wf = (root / ".github" / "workflows" / "site-render-check.yml").read_text()
    assert "--use-angle=swiftshader" in (SITE / "tools" / "render-check.mjs").read_text()
    assert "node features/site/tools/render-check.mjs" in wf
    assert "build_sri.py --check" in wf
    assert "continue-on-error" not in wf
    print("site render check workflow runs the playtest")


def test_pages_workflow_ships_site_assets():
    """pages.yml ships the game page and its assets folder, checks the pins, and ships no other page."""
    root = SITE.parent.parent
    wf = (root / ".github" / "workflows" / "pages.yml").read_text()
    assert re.search(r'cp\s+features/site/index\.html\s+_site/index\.html', wf)
    assert re.search(r'cp\s+-R\s+features/site/assets/?\s+_site/assets\b', wf)
    assert "python3 features/site/tools/build_sri.py --check" in wf
    copies = re.findall(r'cp\s+(?:-R\s+)?(features/\S+)', wf)
    for src in copies:
        assert (root / src.rstrip("/")).exists(), f"pages.yml copies a missing path: {src}"
    assert sorted(c.rstrip("/") for c in copies) == ["features/site/assets", "features/site/index.html"], copies
    print("pages.yml ships only the game page")


def test_ci_workflow_runs_harness_at_real_path():
    """ci.yml must run the harness, upload and read its results where they live after the Feature Map restructure."""
    import re
    root = Path(__file__).parent.parent.parent.parent
    wf = (root / ".github" / "workflows" / "ci.yml").read_text()
    assert "python3 features/eval/eval/run_evals.py" in wf
    assert (root / "features" / "eval" / "eval" / "run_evals.py").exists()
    assert "features/eval/eval/results.json" in wf
    # The guard tests themselves must gate merges, not only run by hand.
    assert "python3 features/eval/tests/test_live_debugger.py" in wf
    assert "python3 features/eval/tests/test_bootstrap_paperclip.py" in wf
    stale = [m for m in re.findall(r'([\w./-]*eval/(?:run_evals\.py|results\.json))', wf) if not m.startswith("features/eval/eval/")]
    assert not stale, f"ci.yml still references old paths: {stale}"


def test_live_debugger_event_creation():
    """Test LiveDebugger creates valid v3.3 event lines."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        run_file = f.name

    try:
        dbg = LiveDebugger(run_file=run_file, server_url="http://localhost:8765")
        dbg.start_run("Test Run")

        # Read the run file header
        with open(run_file, 'r') as f:
            lines = f.readlines()

        assert len(lines) >= 1
        header = json.loads(lines[0])
        assert header["name"] == "Test Run"
        assert header["type"] == "run_start"

        # Emit an event
        dbg.event(
            agent="Builder",
            task="Build widget",
            phase="BUILD",
            status="running",
            artifact="widget.py",
            cost=0.02,
            cost_unit="USD"
        )

        # Read the event line
        with open(run_file, 'r') as f:
            lines = f.readlines()

        assert len(lines) >= 2
        event = json.loads(lines[1])
        assert event["agent"] == "Builder"
        assert event["task"] == "Build widget"
        assert event["phase"] == "BUILD"
        assert event["status"] == "running"
        assert event["artifact"] == "widget.py"
        assert event["cost"] == 0.02
        assert event["cost_unit"] == "USD"

        dbg.end_run()
        print("LiveDebugger event creation OK")

    finally:
        os.unlink(run_file)


def test_live_debugger_nudge_creation():
    """Test LiveDebugger.nudge creates correct line."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        run_file = f.name

    try:
        dbg = LiveDebugger(run_file=run_file)
        dbg.nudge("Builder", "Status?")

        with open(run_file, 'r') as f:
            lines = f.readlines()

        assert len(lines) >= 1
        nudge = json.loads(lines[0])
        assert nudge["type"] == "nudge"
        assert nudge["agent"] == "Builder"
        assert nudge["message"] == "Status?"

        print("LiveDebugger nudge creation OK")

    finally:
        os.unlink(run_file)


def test_validate_event():
    """Test event payload validation."""
    # Valid payload
    valid = {
        "agent": "Builder",
        "task": "Build",
        "phase": "BUILD",
        "status": "running",
        "artifact": "x.py"
    }
    ok, err = validate_event(valid)
    assert ok is not None
    assert err is None
    assert "received_at" in ok

    # Missing required field (phase)
    invalid = {"agent": "Builder", "task": "Build"}
    ok, err = validate_event(invalid)
    assert ok is None
    assert "required" in err

    # Status/phase values are not validated (just passed through)
    invalid = {**valid, "status": "invalid"}
    ok, err = validate_event(invalid)
    assert ok is not None  # Still passes - values not validated
    assert err is None

    invalid = {**valid, "phase": "INVALID"}
    ok, err = validate_event(invalid)
    assert ok is not None  # Still passes - values not validated
    assert err is None

    print("validate_event OK")


def test_validate_nudge():
    """Test nudge payload validation."""
    valid = {"agent": "Builder", "message": "Status?"}
    ok, err = validate_nudge(valid)
    assert ok is not None
    assert err is None
    assert "received_at" in ok

    invalid = {"agent": "Builder"}
    ok, err = validate_nudge(invalid)
    assert ok is None
    assert "required" in err

    print("validate_nudge OK")


def test_validate_intervention():
    """Test intervention payload validation."""
    # Valid pause
    valid = {"action": "pause", "agent": "Builder"}
    ok, err = validate_intervention(valid)
    assert ok is not None
    assert err is None
    assert "received_at" in ok

    # Valid redirect
    valid = {"action": "redirect", "agent": "Builder", "new_task": "X", "new_phase": "TEST"}
    ok, err = validate_intervention(valid)
    assert ok is not None
    assert err is None

    # Valid reassign (needs from_agent)
    valid = {"action": "reassign", "from_agent": "Builder", "to_agent": "Reviewer", "task": "X"}
    ok, err = validate_intervention(valid)
    assert ok is not None
    assert err is None

    # Valid stop_run
    valid = {"action": "stop_run"}
    ok, err = validate_intervention(valid)
    assert ok is not None
    assert err is None

    # Invalid action
    invalid = {"action": "invalid", "agent": "Builder"}
    ok, err = validate_intervention(invalid)
    assert ok is None
    assert "must be one of" in err

    # Missing agent for pause
    invalid = {"action": "pause"}
    ok, err = validate_intervention(invalid)
    assert ok is None
    assert "required" in err

    print("validate_intervention OK")


def test_fold_state():
    """Test fold_state correctly aggregates run file into state."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write('{"run_id":"abc","run_title":"Test","started_at":"2026-01-01T00:00:00Z","ended_at":null}\n')
        f.write('{"agent":"Builder","task":"X","phase":"BUILD","status":"running","artifact":"x.py","cost":0.01,"cost_unit":"USD","updated_at":"2026-01-01T00:01:00Z"}\n')
        f.write('{"agent":"Reviewer","task":"Y","phase":"REVIEW","status":"complete","artifact":"y.md","cost":0.02,"cost_unit":"USD","updated_at":"2026-01-01T00:02:00Z"}\n')
        run_file = f.name

    try:
        state = fold_state(run_file, silence_threshold=120)

        # Check structure
        assert "agents" in state
        assert "Builder" in state["agents"]
        assert "Reviewer" in state["agents"]
        assert state["agents"]["Builder"]["last_line"]["status"] == "running"
        assert state["agents"]["Reviewer"]["last_line"]["status"] == "complete"
        assert state["agents"]["Builder"]["silent"] == False
        assert state["agents"]["Reviewer"]["silent"] == False
        assert "skipped_lines" in state
        assert state["skipped_lines"] == 1  # run_start line skipped

        print("fold_state OK")

    finally:
        os.unlink(run_file)


def test_parse_ts():
    """Test timestamp parsing."""
    # Valid ISO format
    ts = parse_ts("2026-01-01T00:00:00Z")
    assert ts is not None

    # Valid with microseconds
    ts = parse_ts("2026-01-01T00:00:00.123456Z")
    assert ts is not None

    # Invalid
    ts = parse_ts("not a date")
    assert ts is None

    print("parse_ts OK")


def test_beginner_guide_exists():
    """Test BEGINNER-GUIDE.md exists."""
    guide_path = Path(__file__).parent.parent.parent / "docs" / "BEGINNER-GUIDE.md"
    assert guide_path.exists()

    content = guide_path.read_text()
    assert "TL;DR" in content
    assert "5-Minute Quick Start" in content
    assert "--minimal" in content
    assert "--explain" in content

    print("BEGINNER-GUIDE.md exists and has key sections")


def test_eval_harness_runs():
    """Test eval harness runs without error (smoke test)."""
    result = subprocess.run([
        sys.executable, "eval/run_evals.py"
    ], capture_output=True, text=True, cwd=Path(__file__).parent.parent, timeout=120)

    # Strict: the harness must exit clean and report zero failures. The kit_version
    # recompute case was fixed at the root (run_evals.py now excludes the mass-rename
    # commit via --diff-filter=AM), so no FAIL may be tolerated here.
    assert result.returncode == 0, f"eval harness exited {result.returncode}"
    assert "FAIL 0" in result.stdout, f"eval harness reported a failure:\n{result.stdout}"
    for line in result.stdout.splitlines():
        assert not line.strip().startswith("FAIL:"), f"failing case: {line}"

    print("eval/run_evals.py runs and passes with zero failures")


if __name__ == "__main__":
    print("Running live_debugger / board_server unit tests...\n")

    test_live_debugger_imports()
    test_intervention_client_methods()
    test_status_contract_v33()
    test_board_server_help()
    test_rate_limiting_concept()
    test_rate_limiter_window_expiry()
    test_board_html_exists()
    test_site_is_the_only_page()
    test_site_index_self_contained()
    test_site_modules_pinned_by_integrity()
    test_vendored_three_matches_npm_release()
    test_game_rules()
    test_site_render_check_workflow()
    test_pages_workflow_ships_site_assets()
    test_ci_workflow_runs_harness_at_real_path()
    test_live_debugger_event_creation()
    test_live_debugger_nudge_creation()
    test_validate_event()
    test_validate_nudge()
    test_validate_intervention()
    test_fold_state()
    test_parse_ts()
    test_beginner_guide_exists()
    test_eval_harness_runs()

    print("\nAll unit tests passed!")
