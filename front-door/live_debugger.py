#!/usr/bin/env python3
"""Live Collaboration Debugger — Coordinator Library.

A minimal standard-library-only library that the Crew Orchestrator (or any
coordinator) uses to emit run-status events to a run file and/or a board
server. Provides both file-append and HTTP-post modes.

Usage:
    from live_debugger import LiveDebugger

    dbg = LiveDebugger(run_file="crew-run.jsonl", server_url="http://127.0.0.1:8765")
    dbg.start_run("My Run")
    dbg.event(agent="Orchestrator", task="Plan the work", phase="BRIEF", status="running", artifact="plan.md")
    dbg.event(agent="Builder", task="Build the widget", phase="BUILD", status="running", artifact="widget.html")
    dbg.nudge(agent="Builder", message="Status?")
    dbg.event(agent="Builder", task="Build the widget", phase="BUILD", status="done", artifact="widget.html")
    dbg.end_run()
"""

import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from urllib import request, error

__all__ = ["LiveDebugger", "InterventionClient"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _append_line(run_file: str, line: Dict[str, Any]) -> None:
    """Append one JSONL line atomically (single write + fsync)."""
    line_text = json.dumps(line, ensure_ascii=False)
    with open(run_file, "a", encoding="utf-8", newline="\n") as handle:
        handle.write(line_text + "\n")
        handle.flush()
        os.fsync(handle.fileno())


class LiveDebugger:
    """Coordinator-side event emitter for live collaboration debugging.

    Supports dual output: local run file (JSONL) + optional board server (HTTP).
    """

    def __init__(
        self,
        run_file: str,
        server_url: Optional[str] = None,
        silence_threshold: int = 120,
        auto_heartbeat: bool = True,
        heartbeat_interval: int = 30,
    ):
        """
        Args:
            run_file: Path to the run-status JSONL file (will be created if missing).
            server_url: Optional board server base URL (e.g., "http://127.0.0.1:8765").
            silence_threshold: Seconds before an agent with an open claim is flagged silent.
            auto_heartbeat: If True, emit heartbeat for active agents periodically.
            heartbeat_interval: Seconds between auto heartbeats.
        """
        self.run_file = Path(run_file).resolve()
        self.server_url = server_url.rstrip("/") if server_url else None
        self.silence_threshold = silence_threshold
        self.auto_heartbeat = auto_heartbeat
        self.heartbeat_interval = heartbeat_interval

        # Track active agents for auto-heartbeat
        self._active_agents: Dict[str, float] = {}
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._stop_heartbeat = threading.Event()

        # Ensure run file exists
        self.run_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.run_file.exists():
            self.run_file.write_text("", encoding="utf-8")

    # ---------- Public API ----------

    def start_run(self, name: str, description: str = "") -> None:
        """Emit a run-start marker (custom event type)."""
        self._emit(
            {
                "type": "run_start",
                "name": name,
                "description": description,
                "ts": _now_iso(),
            }
        )

    def end_run(self, summary: str = "") -> None:
        """Emit a run-end marker and stop auto-heartbeat."""
        self._emit(
            {
                "type": "run_end",
                "summary": summary,
                "ts": _now_iso(),
            }
        )
        self.stop_auto_heartbeat()

    def event(
        self,
        agent: str,
        task: str,
        phase: str,
        status: str,
        artifact: str,
        say: Optional[str] = None,
        waiting_on: Optional[str] = None,
        blocked_by: Optional[str] = None,
        cost: Optional[float] = None,
        cost_unit: Optional[str] = None,
        ts: Optional[str] = None,
    ) -> None:
        """Emit a standard status line (contract v3.3)."""
        line = {
            "agent": agent,
            "task": task,
            "phase": phase,
            "status": status,
            "artifact": artifact,
        }
        if say:
            line["say"] = say
        if waiting_on:
            line["waiting_on"] = waiting_on
        if blocked_by:
            line["blocked_by"] = blocked_by
        if cost is not None:
            line["cost"] = cost
        if cost_unit:
            line["cost_unit"] = cost_unit
        if ts:
            line["ts"] = ts

        self._emit(line)

        # Track for auto-heartbeat
        if self.auto_heartbeat and status.lower() in ("running", "working"):
            self._active_agents[agent] = time.time()

    def heartbeat(self, agent: str, ts: Optional[str] = None) -> None:
        """Emit a heartbeat line (contract v3.2)."""
        line = {"type": "heartbeat", "agent": agent}
        if ts:
            line["ts"] = ts
        self._emit(line)
        if self.auto_heartbeat:
            self._active_agents[agent] = time.time()

    def nudge(self, agent: str, message: str, from_: str = "owner") -> None:
        """Emit a nudge line (contract v3.2) — asks an agent for status."""
        line = {
            "type": "nudge",
            "from": from_,
            "agent": agent,
            "message": message,
            "ts": _now_iso(),
        }
        self._emit(line)

    def intervention(
        self,
        action: str,
        agent: str,
        payload: Optional[Dict[str, Any]] = None,
        from_: str = "owner",
    ) -> None:
        """Emit an intervention line (custom type for debugger control).

        Actions: "pause", "resume", "redirect", "reassign", "stop"
        """
        line = {
            "type": "intervention",
            "action": action,
            "agent": agent,
            "from": from_,
            "ts": _now_iso(),
        }
        if payload:
            line["payload"] = payload
        self._emit(line)

    # ---------- Auto-heartbeat ----------

    def start_auto_heartbeat(self) -> None:
        """Start background thread emitting heartbeats for active agents."""
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            return
        self._stop_heartbeat.clear()
        self._heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def stop_auto_heartbeat(self) -> None:
        """Stop the auto-heartbeat thread."""
        self._stop_heartbeat.set()
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=2)
            self._heartbeat_thread = None

    def _heartbeat_loop(self) -> None:
        while not self._stop_heartbeat.is_set():
            time.sleep(self.heartbeat_interval)
            if self._stop_heartbeat.is_set():
                break
            now = time.time()
            for agent, last_seen in list(self._active_agents.items()):
                if now - last_seen <= self.heartbeat_interval * 2:
                    self.heartbeat(agent)

    # ---------- Internal ----------

    def _emit(self, line: Dict[str, Any]) -> None:
        """Write to run file and/or POST to server."""
        # Always write to local run file
        _append_line(str(self.run_file), line)

        # Also POST to server if configured
        if self.server_url:
            self._post_to_server(line)

    def _post_to_server(self, line: Dict[str, Any]) -> None:
        """POST a line to the board server /events endpoint."""
        if not self.server_url:
            return
        url = f"{self.server_url}/events"
        data = json.dumps(line).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=5) as resp:
                if resp.status != 201:
                    # Log but don't fail — local file is source of truth
                    pass
        except Exception:
            # Server may be down; local file persists
            pass


class InterventionClient:
    """Client for sending intervention commands to a running board server.

    Used by the developer (human) to pause, redirect, reassign, or stop agents
    during a live session. Calls POST /intervene on the board server.
    """

    def __init__(self, server_url: str):
        self.server_url = server_url.rstrip("/")

    def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.server_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def pause(self, agent: str, reason: str = "") -> Dict[str, Any]:
        """Pause an agent — it should stop work and acknowledge."""
        return self._post("/intervene", {"action": "pause", "agent": agent, "reason": reason})

    def resume(self, agent: str) -> Dict[str, Any]:
        """Resume a paused agent."""
        return self._post("/intervene", {"action": "resume", "agent": agent})

    def redirect(self, agent: str, new_task: str, new_phase: str = "BUILD") -> Dict[str, Any]:
        """Redirect an agent to a different task."""
        return self._post("/intervene", {"action": "redirect", "agent": agent, "new_task": new_task, "new_phase": new_phase})

    def reassign(self, from_agent: str, to_agent: str, task: str) -> Dict[str, Any]:
        """Reassign a task from one agent to another."""
        return self._post("/intervene", {"action": "reassign", "from_agent": from_agent, "to_agent": to_agent, "task": task})

    def stop_run(self, reason: str = "") -> Dict[str, Any]:
        """Stop the entire run."""
        return self._post("/intervene", {"action": "stop_run", "reason": reason})

    def get_state(self) -> Dict[str, Any]:
        """Fetch the folded state from the server (includes silent agents, open claims)."""
        url = f"{self.server_url}/state"
        with request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))


if __name__ == "__main__":
    # Demo: python3 live_debugger.py --run-file demo.jsonl --server http://127.0.0.1:8765
    import argparse

    parser = argparse.ArgumentParser(description="Live Debugger demo")
    parser.add_argument("--run-file", default="demo-run.jsonl")
    parser.add_argument("--server", default=None)
    args = parser.parse_args()

    dbg = LiveDebugger(args.run_file, args.server)
    dbg.start_run("Demo Run", "Demonstrating live debugger events")
    dbg.start_auto_heartbeat()

    dbg.event("Orchestrator", "Plan the sprint", "BRIEF", "running", "sprint-plan.md", say="Kicking off the sprint planning")
    time.sleep(0.5)
    dbg.event("Architect", "Design the widget API", "DESIGN", "running", "api-spec.md", say="Drafting the API contract")
    time.sleep(0.5)
    dbg.event("Builder", "Implement the widget", "BUILD", "running", "widget.py", say="Starting implementation")
    time.sleep(0.5)
    dbg.nudge("Builder", "How's the widget coming along?")
    time.sleep(0.5)
    dbg.event("Builder", "Implement the widget", "BUILD", "done", "widget.py", say="Widget implemented and tested")
    time.sleep(0.5)
    dbg.event("Checker", "Review the widget", "GATE", "running", "review.md", say="Reviewing the implementation")
    time.sleep(0.5)
    dbg.event("Checker", "Review the widget", "GATE", "done", "review.md", say="PASS — all checks green")
    time.sleep(0.5)
    dbg.event("Orchestrator", "Close the sprint", "REPORT", "done", "sprint-report.md", say="Sprint complete")

    dbg.end_run("Demo run completed successfully")
    print(f"Run written to {args.run_file}")