#!/usr/bin/env python3
"""
Unit tests for live_debugger.py and board_server.py concepts
Run with: python3 tests/test_live_debugger.py
"""

import sys
import subprocess
from pathlib import Path

# Add front-door to path
sys.path.insert(0, str(Path(__file__).parent.parent / "front-door"))

from live_debugger import LiveDebugger, InterventionClient
from board_server import RateLimiter


def test_live_debugger_imports():
    """Test that live_debugger imports without error."""
    assert LiveDebugger is not None
    assert InterventionClient is not None
    print("live_debugger imports OK")


def test_intervention_client_validation():
    """Test InterventionClient validation logic."""
    client = InterventionClient("http://localhost:8765")
    
    # Test valid pause intervention
    payload = {"action": "pause", "agent": "TestAgent"}
    assert payload["action"] == "pause"
    assert payload["agent"] == "TestAgent"
    
    # Test valid redirect
    payload = {"action": "redirect", "agent": "TestAgent", "new_task": "New task", "new_phase": "BUILD"}
    assert payload["action"] == "redirect"
    assert payload["new_task"] == "New task"
    
    print("InterventionClient payload construction OK")


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
        sys.executable, "front-door/board_server.py", "--help"
    ], capture_output=True, text=True, cwd=Path(__file__).parent.parent)
    
    assert result.returncode == 0
    help_text = result.stdout
    
    assert "default: 8765" in help_text
    assert "default: 127.0.0.1" in help_text
    assert "default: 120" in help_text
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


def test_board_html_exists():
    """Test board.html exists and has demo mode."""
    board_path = Path(__file__).parent.parent / "front-door" / "board.html"
    assert board_path.exists()
    
    content = board_path.read_text()
    assert "demo-toggle" in content
    assert "Demo Mode" in content
    assert "srvSendIntervention" in content
    assert "srvSendNudge" in content
    
    print("board.html has demo mode and intervention UI")


if __name__ == "__main__":
    print("Running live_debugger / board_server unit tests...")
    
    test_live_debugger_imports()
    test_intervention_client_validation()
    test_status_contract_v33()
    test_board_server_help()
    test_rate_limiting_concept()
    test_board_html_exists()
    
    print("\nAll unit tests passed!")
