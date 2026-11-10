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


SITE = Path(__file__).parent.parent.parent / "site"


def test_site_pages_and_static_checks():
    """The Pages site is the docs pages; the retired game is gone and the static link/HTML checker passes."""
    pages = sorted(p.relative_to(SITE).as_posix() for p in SITE.rglob("*.html") if p.relative_to(SITE).parts[0] not in ("content", "tools", ".screenshots"))
    assert pages == ["architecture/index.html", "faq/index.html", "game/index.html", "index.html", "install/index.html", "packs/index.html", "walkthrough/index.html"], pages
    for gone in ("assets/game", "assets/vendor", "tools/sim-test.mjs", "tools/build_sri.py"):
        assert not (SITE / gone).exists(), f"{gone} should have been removed"
    assert (SITE / "assets" / "game.css").exists() and (SITE / "assets" / "game.js").exists()
    r = subprocess.run([sys.executable, "-I", str(SITE / "tools" / "check_site.py")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    r = subprocess.run([sys.executable, str(SITE / "tools" / "build_packs.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    print("site pages present, static checks and packs table pass")


def test_site_workflows():
    """pages.yml ships only the docs pages and assets and runs the checks; the render check is the no-WebGL one."""
    root = SITE.parent.parent
    pages = (root / ".github" / "workflows" / "pages.yml").read_text()
    assert "python3 features/site/tools/build_packs.py --check" in pages
    assert "build_sri" not in pages
    for src in re.findall(r"features/site/(?:index\.html|assets|install|architecture|packs|faq|walkthrough|game)", pages):
        assert (root / src).exists(), src
    for private in ("TASK-MANIFEST", "features/site/content", "features/site/tools"):
        assert not re.search(r"cp\s.*" + re.escape(private), pages), f"pages.yml must not copy {private}"
    wf = (root / ".github" / "workflows" / "site-render-check.yml").read_text()
    assert "node features/site/tools/render-check.mjs" in wf
    assert "swiftshader" not in (SITE / "tools" / "render-check.mjs").read_text().lower()
    assert "continue-on-error" not in wf
    print("site workflows ship the docs pages and run the no-WebGL render check")


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
    test_site_pages_and_static_checks()
    test_site_workflows()
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
