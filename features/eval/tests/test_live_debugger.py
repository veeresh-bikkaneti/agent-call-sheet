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


def test_tactical_ops_page_sri():
    """Test the Tactical Operations page exists, is self-hosted, and has SRI hashes."""
    page_path = Path(__file__).parent.parent.parent / "site" / "tactical-ops" / "index.html"
    assert page_path.exists()

    content = page_path.read_text()
    assert "importmap" in content
    assert "integrity" in content
    assert "sha384" in content
    # Check for at least 7 SRI hashes
    assert content.count("sha384-") >= 7
    # Fully self-hosted: no CDN references
    assert "unpkg.com" not in content
    assert "cdn.jsdelivr.net" not in content
    # Vendored three.module.js (pinned 0.158.0) must exist on disk
    vendor = Path(__file__).parent.parent.parent / "site" / "tactical-ops" / "assets" / "vendor" / "three.module.js"
    assert vendor.exists()

    print("tactical-ops/index.html is self-hosted with SRI hashes and vendored three.js")


def test_tactical_ops_csp():
    """Test tactical-ops/index.html has CSP meta tag with no external connect-src."""
    index_path = Path(__file__).parent.parent.parent / "site" / "tactical-ops" / "index.html"
    assert index_path.exists()

    content = index_path.read_text()
    assert "Content-Security-Policy" in content
    assert "require-sri-for" in content
    assert "connect-src 'self';" in content

    print("tactical-ops/index.html has CSP with require-sri-for and connect-src 'self'")


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


# sha384 of each file in the three@0.158.0 npm tarball (MIT). Recompute from the tarball if the version changes.
THREE_0_158_SRI = {
    "build/three.module.js": "sha384-iuC3I0bVuCDzGoJi9KmCkGzEwo7vYFG/gBa7C/1D7mp8ZTt1CgTJ8C57dTDqqpfM",
    "examples/jsm/controls/OrbitControls.js": "sha384-YCd69amYnvismjTAKpaaDl8o1DOtbncPQxyETzcs2YFi3v+QIDuhbQozC2wVuAjr",
    "examples/jsm/postprocessing/EffectComposer.js": "sha384-L+Ns9skCAqjab7aG8LH5VLknBCoENW7p37sOj39jnITwlWZFabWc29JwzgYf6ygy",
    "examples/jsm/postprocessing/RenderPass.js": "sha384-LwKrkOBAkmQ2KT4cv6P6q9Rb9L01GIFU34Zp16tGWZoBnrVuujfjpYZb7OxEMb0J",
    "examples/jsm/postprocessing/UnrealBloomPass.js": "sha384-R734/7SvtqjjeteDKG4qcQA0adDCZ1ZcKfYUZsbVr9qqHGlgSXH9eNN4b3NIgwuc",
    "examples/jsm/postprocessing/FilmPass.js": "sha384-UCDYapUwmB5sJEhDJhfct+N1C5oB/QbIa4QH3WYv9XSYqmkoQzs9Bo3xc8LZAHOp",
    "examples/jsm/postprocessing/ShaderPass.js": "sha384-zetU6HhR/vTtgSvnS9DE+GQPZhVT/ZOSLa/1+DSM6rkM9hvBgQWr9bCEosZt93ch",
    # modules the passes import themselves
    "examples/jsm/postprocessing/Pass.js": "sha384-gSqIFh8vMmp1veyOysIS3KPVUl/A5JPefYvW4b89OeYeW0bwkrjN7qcC1h0XJK/K",
    "examples/jsm/postprocessing/MaskPass.js": "sha384-SDM80tiGflO8UDV/QzR/mASjcc/+wF7KfRVFNHJUIPcTctwoPI8GoWVTlccZw7V4",
    "examples/jsm/shaders/CopyShader.js": "sha384-kzVlcj2amFaRNIWZ5zE0PmIN+QTNWWvrgKk31S8N/7w0nf7Qq3xqxHRLbD2UPPSl",
    "examples/jsm/shaders/LuminosityHighPassShader.js": "sha384-621kiA/kIdX8rtH6VU6+SwMVx+B8g7MQ6x0fei5dZVX3CQZSLkpOlglIk9sxE+/g",
    "examples/jsm/shaders/FilmShader.js": "sha384-GWbaFL+YETHIs8fQTiqlvgFHQhE5+pWoyDoRLDt4ttEcNt4zY2B0YD1tZRq0g4F4",
}


def test_visualization_html_sri_and_csp():
    """The deployed 3D explorer: every module it loads is pinned to the real three@0.158.0 hash and the CSP lets it load."""
    viz = Path(__file__).parent.parent.parent / "visualization" / "visualization.html"
    html = viz.read_text()
    imap = _importmap(html)
    integrity = imap.get("integrity", {})
    base = "https://unpkg.com/three@0.158.0/"
    # Integrity keys must be absolute URLs; bare specifiers like "three" are ignored by browsers.
    assert integrity and all(k.startswith("https://") for k in integrity), integrity.keys()
    expected = {base + path: sri for path, sri in THREE_0_158_SRI.items()}
    assert integrity == expected, "integrity map differs from the pinned three@0.158.0 hashes"
    for target in imap["imports"].values():
        if not target.endswith("/"):
            assert target in integrity, f"importmap target without integrity: {target}"
    csp = _csp_directives(html)
    script_src = csp.get("script-src", [])
    # require-sri-for is not a script-src source; it silently did nothing.
    assert "require-sri-for" not in script_src
    hosts = {t.split("/")[2] for t in imap["imports"].values()}
    for host in hosts:
        assert f"https://{host}" in script_src, f"CSP script-src blocks importmap host {host}"
    print("visualization.html: every module pinned to its three@0.158.0 hash, CSP allows its script host")


SITE_CSP = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:"],
    "media-src": ["'self'"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'none'"],
}


def test_site_index_self_contained():
    """The Pages landing page loads nothing from outside, runs no inline script or style, and keeps its written guide."""
    import re
    site = Path(__file__).parent.parent.parent / "site"
    html = (site / "index.html").read_text()
    assert _csp_directives(html) == SITE_CSP, _csp_directives(html)
    srcs = re.findall(r'<script\b([^>]*)>(.*?)</script>', html, re.S)
    assert srcs, "no script tag"
    for attrs, body in srcs:
        assert re.fullmatch(r'\s*src="assets/[\w.-]+\.js"(\s+defer)?\s*', attrs) and not body.strip(), f"inline or external script: {attrs!r}"
    assert not re.search(r'<style\b', html, re.I), "inline <style> block would be blocked by style-src 'self'"
    assert "style=" not in html, "inline style attribute would be blocked by style-src 'self'"
    assert not re.search(r'\son[a-z]+\s*=', html, re.I), "inline event handler would be blocked by script-src 'self'"
    assert "javascript:" not in html.lower()
    # Anything the page loads (not links people click) must be local.
    for tag, attr, url in re.findall(r'<(img|script|link|iframe|source|video|audio|embed)\b[^>]*?\b(src|href)="([^"]+)"', html, re.I):
        assert not re.match(r'(https?:)?//', url), f"<{tag}> loads from outside: {url}"
    for asset in re.findall(r'(?:src|href)="(assets/[^"]+)"', html):
        assert (site / asset).exists(), f"missing asset {asset}"
    # The game script must not undo the CSP from the inside.
    for js in (site / "assets").glob("*.js"):
        code = js.read_text()
        for bad in (r'\beval\s*\(', r'\bnew\s+Function\b', r"setAttribute\(\s*['\"]style", r'\.innerHTML\s*=', r'\.outerHTML\s*=', r'document\.write', r'insertAdjacentHTML'):
            assert not re.search(bad, code), f"{js.name} uses {bad}"
    # Every district the game shows has its written postcard in the page (works without JS).
    for pid in ("archive", "gate", "well", "tower", "bridge"):
        assert f'data-postcard="{pid}"' in html
    # Install commands must point at where bootstrap.py actually lives.
    assert "features/paperclip-bridge/bootstrap.py" in html
    assert (site.parent / "paperclip-bridge" / "bootstrap.py").exists()
    print("site/index.html is self-contained with a strict CSP")


def test_pages_workflow_ships_site_assets():
    """pages.yml must put the landing page's assets folder at _site/assets, next to index.html."""
    import re
    root = Path(__file__).parent.parent.parent.parent
    wf = (root / ".github" / "workflows" / "pages.yml").read_text()
    assert re.search(r'cp\s+features/site/index\.html\s+_site/index\.html', wf)
    assert re.search(r'cp\s+-R\s+features/site/assets/?\s+_site/assets\b', wf)
    assert re.search(r'cp\s+features/visualization/visualization\.html\s+_site/', wf)
    for src in re.findall(r'cp\s+(?:-R\s+)?(features/\S+)', wf):
        assert (root / src.rstrip("/")).exists(), f"pages.yml copies a missing path: {src}"


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
    test_tactical_ops_page_sri()
    test_tactical_ops_csp()
    test_visualization_html_sri_and_csp()
    test_site_index_self_contained()
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
