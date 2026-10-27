#!/usr/bin/env python3
"""Board server (run-status contract v3.2) — we serve the crew board live.

We run this ourselves, on our own machines:

    python3 board-server.py --run-file crew-run.jsonl

It serves board.html with a small marker injected, streams the run file
to the board as lines land, folds the file for GET /state, and accepts
status, heartbeat, and nudge lines over POST. Python standard library
only.

No authentication — run only on a trusted network or tailnet.
"""

import argparse
import json
import os
import queue
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

MAX_BODY = 65_536
STATIC_JSONL = ("sample-run.jsonl", "real-run.jsonl")
LOCAL_HOSTS = ("localhost", "127.0.0.1", "::1")
SUBSCRIBER_QUEUE_MAX = 100
PING_SECONDS = 15


def _request_timeout():
    # Hidden test override (kept out of --help; a code comment suffices):
    # BOARD_SERVER_TIMEOUT shortens the 30 s default so probes can watch
    # a trickling request die without waiting half a minute.
    try:
        return float(os.environ.get("BOARD_SERVER_TIMEOUT", "30"))
    except ValueError:
        return 30.0


REQUEST_TIMEOUT = _request_timeout()

# One lock serialises validate -> append -> broadcast for every POST,
# and gives /state and /stream a consistent snapshot of the run file.
append_lock = threading.Lock()
subscribers = set()
subscribers_lock = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_ts(value):
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        stamp = datetime.fromisoformat(text)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp


class Subscriber:
    def __init__(self):
        self.queue = queue.Queue(maxsize=SUBSCRIBER_QUEUE_MAX)
        self.alive = True


def broadcast(line_text):
    """Offer one stored line to every subscriber; drop slow/dead ones."""
    with subscribers_lock:
        current = list(subscribers)
    for sub in current:
        if not sub.alive:
            continue
        try:
            sub.queue.put_nowait(line_text)
        except queue.Full:
            sub.alive = False
            with subscribers_lock:
                subscribers.discard(sub)


def read_complete_lines(run_file):
    """The run file's complete lines (up to the last newline), as text."""
    try:
        data = Path(run_file).read_bytes()
    except OSError:
        return []
    if not data:
        return []
    segments = data.split(b"\n")[:-1]  # trailing segment is partial/empty
    return [seg.decode("utf-8", "replace") for seg in segments]


def fold_state(run_file, silence_threshold):
    """Fold the run file per the contract into the /state payload."""
    agents = {}
    order = []
    last_dt = {}
    skipped = 0

    def entry_for(name):
        if name not in agents:
            agents[name] = {
                "last_seen": None,
                "last_line": None,
                "open_claims": [],
                "silent": False,
                "silent_for_s": None,
            }
            order.append(name)
        return agents[name]

    def note_seen(name, obj):
        candidate = obj.get("received_at")
        if not isinstance(candidate, str):
            candidate = obj.get("ts")
        stamp = parse_ts(candidate)
        if stamp is None:
            return
        if name not in last_dt or stamp >= last_dt[name]:
            last_dt[name] = stamp
            agents[name]["last_seen"] = candidate

    for raw in read_complete_lines(run_file):
        if not raw.strip():
            continue  # blank lines are ignored, never counted as skipped
        try:
            obj = json.loads(raw)
        except (ValueError, RecursionError):
            skipped += 1
            continue
        if not isinstance(obj, dict):
            skipped += 1
            continue
        line_type = obj.get("type")
        if line_type == "nudge":
            continue  # a nudge is not a status line; it proves nobody saw it
        if line_type == "heartbeat":
            agent = obj.get("agent")
            if not isinstance(agent, str) or not agent.strip():
                skipped += 1
                continue
            entry_for(agent)
            note_seen(agent, obj)
            continue
        if "type" in obj:
            skipped += 1
            continue
        required = ("agent", "task", "phase", "status", "artifact")
        if any(not isinstance(obj.get(field), str) for field in required):
            skipped += 1
            continue
        agent = obj["agent"]
        entry = entry_for(agent)
        entry["last_line"] = obj
        note_seen(agent, obj)
        status = obj["status"].strip().lower()
        task = obj["task"]
        claims = entry["open_claims"]
        if status in ("running", "working"):
            if task not in claims:
                claims.append(task)
        elif status in ("done", "blocked"):
            if task in claims:
                claims.remove(task)

    moment = datetime.now(timezone.utc)
    for name in order:
        entry = agents[name]
        stamp = last_dt.get(name)
        if stamp is not None:
            entry["silent_for_s"] = int((moment - stamp).total_seconds())
        if entry["open_claims"] and stamp is not None:
            age = (moment - stamp).total_seconds()
            entry["silent"] = age > silence_threshold
    return {
        "server_time": now_iso(),
        "silence_threshold_s": silence_threshold,
        "agents": {name: agents[name] for name in order},
        "skipped_lines": skipped,
    }


def json_shape_error(obj):
    """Bounds on a parsed POST body, checked before projection (F2).

    Iterative, so deep input cannot recurse here: nesting depth over 8,
    more than 64 keys in total, or any string over 2,000 chars (the
    largest field cap) is a 400. Returns an error or None.
    """
    total_keys = 0
    stack = [(obj, 1)]
    while stack:
        node, depth = stack.pop()
        if isinstance(node, str):
            if len(node) > 2000:
                return "body: string exceeds 2000 characters"
            continue
        if not isinstance(node, (dict, list)):
            continue
        if depth > 8:
            return "body: JSON nested too deeply"
        if isinstance(node, dict):
            total_keys += len(node)
            if total_keys > 64:
                return "body: too many keys"
            for key, value in node.items():
                if isinstance(key, str) and len(key) > 2000:
                    return "body: string exceeds 2000 characters"
                stack.append((value, depth + 1))
        else:
            for value in node:
                stack.append((value, depth + 1))
    return None


def check_caps(obj):
    """Field caps shared by every posted line. Returns an error or None."""
    for field, value in obj.items():
        if not isinstance(value, str):
            continue
        if field in ("agent", "from"):
            limit = 200
        elif field == "message":
            limit = 1000
        else:
            limit = 2000
        if len(value) > limit:
            return f"{field}: exceeds {limit} characters"
    return None


def require_string(obj, field, non_empty=False):
    if field not in obj:
        return f"{field}: required"
    if not isinstance(obj[field], str):
        return f"{field}: must be a string"
    if non_empty and not obj[field].strip():
        return f"{field}: must not be empty"
    return None


def validate_event(obj):
    """Validate a POST /events body.

    Returns (stored_line, None) on success or (None, error) on failure.
    """
    line_type = obj.get("type")
    if "type" in obj and line_type not in ("nudge", "heartbeat"):
        return None, 'type: must be "nudge" or "heartbeat"'
    if line_type == "nudge":
        return validate_nudge(obj)
    if line_type == "heartbeat":
        # Allowlist projection (F2): unknown fields are dropped, never
        # stored; a client-sent received_at is dropped — we stamp ours.
        stored = {f: obj[f] for f in ("type", "agent", "ts") if f in obj}
        if "ts" in stored and not isinstance(stored["ts"], str):
            return None, "ts: must be a string"
        error = require_string(stored, "agent", non_empty=True)
        if error:
            return None, error
        error = check_caps(stored)
        if error:
            return None, error
        stored["received_at"] = now_iso()
        return stored, None
    # No type: a status line. Same allowlist projection as above.
    status_fields = ("agent", "task", "phase", "status", "artifact",
                     "say", "waiting_on", "blocked_by", "ts")
    stored = {f: obj[f] for f in status_fields if f in obj}
    for field in ("agent", "task", "phase", "status", "artifact"):
        error = require_string(
            stored, field, non_empty=field in ("agent", "status")
        )
        if error:
            return None, error
    for field in ("say", "waiting_on", "blocked_by", "ts"):
        if field in stored and not isinstance(stored[field], str):
            return None, f"{field}: must be a string"
    error = check_caps(stored)
    if error:
        return None, error
    stored["received_at"] = now_iso()
    return stored, None


def validate_nudge(obj):
    """Validate a nudge body and build the server-side nudge line."""
    if "type" in obj and obj.get("type") != "nudge":
        return None, 'type: must be "nudge" or "heartbeat"'
    error = require_string(obj, "agent", non_empty=True)
    if error:
        return None, error
    error = require_string(obj, "message", non_empty=True)
    if error:
        return None, error
    if "from" in obj and not isinstance(obj["from"], str):
        return None, "from: must be a string"
    error = check_caps(obj)
    if error:
        return None, error
    stamp = now_iso()
    stored = {
        "type": "nudge",
        "from": obj.get("from", "owner"),
        "agent": obj["agent"],
        "message": obj["message"],
        "ts": stamp,
        "received_at": stamp,
    }
    return stored, None


def append_line(run_file, stored):
    """Append exactly one line: one write under the lock, then broadcast."""
    line_text = json.dumps(stored, ensure_ascii=False)
    with open(run_file, "a", encoding="utf-8", newline="\n") as handle:
        handle.write(line_text + "\n")
        handle.flush()
        os.fsync(handle.fileno())  # 201 means recorded: durable first
    broadcast(line_text)
    return line_text


def host_name(host_header):
    """The hostname part of a Host header (brackets/port stripped)."""
    host = (host_header or "").strip().lower()
    if host.startswith("["):
        end = host.find("]")
        return host[1:end] if end != -1 else host
    return host.split(":", 1)[0]


class BoardHandler(BaseHTTPRequestHandler):
    server_version = "BoardServer"
    sys_version = ""  # no Python version disclosure (F6)

    def version_string(self):
        return self.server_version  # exactly "BoardServer", no trailing join

    # -- plumbing ------------------------------------------------------
    def log_message(self, *args):
        pass

    def setup(self):
        # F3: a trickling body must not pin this thread forever.
        # (self.request is the socket; self.connection exists only
        # after super().setup() assigns it.)
        self.request.settimeout(REQUEST_TIMEOUT)
        super().setup()

    def _request_guard(self, write):
        """B1 checks, shared by both POST handlers and every GET.

        Returns (status, error) to reject with, or None to proceed.
        Host: when bound to a loopback host, the Host hostname must be
        a loopback name (DNS-rebinding guard, reads included). When
        bound beyond loopback the operator opted in, so any Host is
        accepted — the write checks below still apply.
        Writes additionally: Content-Type must be application/json
        (a cross-origin simple request cannot send that without a
        preflight we never grant), a present Origin must name this
        exact Host, and Sec-Fetch-Site: cross-site is refused.
        """
        bound = str(self.cfg.get("host", "127.0.0.1")).strip().lower()
        if bound in LOCAL_HOSTS:
            if host_name(self.headers.get("Host")) not in LOCAL_HOSTS:
                return 403, "host: not a loopback host"
        if not write:
            return None
        media = (self.headers.get("Content-Type") or "")
        media = media.split(";", 1)[0].strip().lower()
        if media != "application/json":
            return 415, "content-type: must be application/json"
        origin = self.headers.get("Origin")
        if origin is not None:
            authority = urlparse(origin.strip()).netloc.lower()
            host = (self.headers.get("Host") or "").strip().lower()
            if authority != host:
                return 403, "origin: cross-origin writes are not allowed"
        fetch_site = self.headers.get("Sec-Fetch-Site")
        if fetch_site is not None and fetch_site.strip().lower() == "cross-site":
            return 403, "sec-fetch-site: cross-site writes are not allowed"
        return None

    @property
    def cfg(self):
        return self.server.cfg

    def _send(self, status, body, content_type, extra_headers=None):
        # F6: nosniff on every response. Deliberately no CSP: the board
        # is inline-by-design (inline script/style in board.html), so a
        # CSP would break it rather than protect it.
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_json(self, status, obj, extra_headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        headers = dict(extra_headers or {})
        if self.command == "POST":  # F6: POST responses are never cached
            headers.setdefault("Cache-Control", "no-store")
        self._send(status, body, "application/json", headers)

    def _error(self, status, message, extra_headers=None):
        self._send_json(status, {"error": message}, extra_headers)

    def _serve_file(self, path, content_type):
        try:
            data = Path(path).read_bytes()
        except OSError:
            self._error(404, "not found")
            return
        self._send(200, data, content_type)

    def _serve_board(self):
        board_path = Path(self.cfg["board_dir"]) / "board.html"
        try:
            data = board_path.read_bytes()
        except OSError:
            self._error(404, "not found")
            return
        marker = json.dumps(
            {
                "stream": "/stream",
                "state": "/state",
                "nudge": "/nudge",
                "events": "/events",
                "silenceDefault": self.cfg["silence"],
            },
            separators=(",", ":"),
        )
        injection = f"<script>window.__BOARD_SERVER__ = {marker}</script>"
        injection = injection.encode("utf-8")
        marker_at = data.find(b"</body>")
        if marker_at == -1:
            data = data + injection
        else:
            data = data[:marker_at] + injection + data[marker_at:]
        self._send(200, data, "text/html; charset=utf-8")

    # -- GET -----------------------------------------------------------
    def _handle_stream(self):
        # F3: SSE is long-lived by design — clear the request timeout
        # setup() set, or every stream would die at REQUEST_TIMEOUT.
        self.connection.settimeout(None)
        sub = Subscriber()
        with append_lock:
            with subscribers_lock:
                subscribers.add(sub)
            snapshot = [
                line for line in read_complete_lines(self.cfg["run_file"])
                if line.strip()
            ]
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            for line in snapshot:
                self.wfile.write(f"data: {line}\n\n".encode("utf-8"))
            self.wfile.write(b"event: ready\ndata: {}\n\n")
            self.wfile.flush()
            while sub.alive:
                try:
                    line = sub.queue.get(timeout=PING_SECONDS)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                self.wfile.write(f"data: {line}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            sub.alive = False
            with subscribers_lock:
                subscribers.discard(sub)
            self.close_connection = True

    def _do_get(self, path):
        cfg = self.cfg
        if path in ("/", "/board.html"):
            self._serve_board()
        elif path in ("/sample-run.jsonl", "/real-run.jsonl"):
            name = path.lstrip("/")
            if name not in STATIC_JSONL:
                self._error(404, "not found")
                return
            self._serve_file(
                Path(cfg["board_dir"]) / name,
                "application/x-ndjson; charset=utf-8",
            )
        elif path.startswith("/runs/"):
            name = unquote(path[len("/runs/"):])
            target = cfg["run_map"].get(name)
            if target is None:
                self._error(404, "not found")
                return
            self._serve_file(target, "application/x-ndjson; charset=utf-8")
        elif path == "/state":
            with append_lock:
                payload = fold_state(cfg["run_file"], cfg["silence"])
            self._send_json(200, payload, {"Cache-Control": "no-store"})
        elif path == "/stream":
            self._handle_stream()
        else:
            self._error(404, "not found")

    # -- POST ----------------------------------------------------------
    def _read_json_body(self):
        """Returns (obj, None) or (None, (status, error))."""
        raw_length = self.headers.get("Content-Length")
        try:
            length = int(raw_length) if raw_length is not None else 0
        except ValueError:
            return None, (400, "body: invalid Content-Length")
        if length > MAX_BODY:
            self.close_connection = True
            return None, (413, "body: exceeds 65536 bytes")
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            obj = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError, RecursionError):
            # F4: deep nesting raises RecursionError, not ValueError —
            # it must still be a 400, never an empty response.
            return None, (400, "body: invalid JSON")
        shape_error = json_shape_error(obj)
        if shape_error is not None:
            return None, (400, shape_error)
        if not isinstance(obj, dict):
            return None, (400, "body: must be a JSON object")
        return obj, None

    def _do_post(self, path):
        if path not in ("/events", "/nudge"):
            self._error(404, "not found")
            return
        obj, failure = self._read_json_body()
        if failure is not None:
            status, message = failure
            self._error(status, message)
            return
        with append_lock:
            if path == "/nudge":
                stored, error = validate_nudge(obj)
            else:
                stored, error = validate_event(obj)
            if error is not None:
                self._error(400, error)
                return
            try:
                append_line(self.cfg["run_file"], stored)
            except OSError:
                self._error(500, "run file: could not append")
                return
        self._send_json(201, stored)

    # -- dispatch ------------------------------------------------------
    def _dispatch(self, method):
        path = urlparse(self.path).path
        guard = self._request_guard(
            write=method == "POST" and path in ("/events", "/nudge")
        )
        if guard is not None:
            status, message = guard
            self._error(status, message)
            return
        known = (
            path in ("/", "/board.html", "/sample-run.jsonl",
                     "/real-run.jsonl", "/state", "/stream",
                     "/events", "/nudge")
            or path.startswith("/runs/")
        )
        if method == "GET":
            if path in ("/events", "/nudge"):
                self._error(405, "method not allowed", {"Allow": "POST"})
            else:
                self._do_get(path)
        elif method == "POST":
            if path in ("/events", "/nudge"):
                self._do_post(path)
            elif known:
                self._error(405, "method not allowed", {"Allow": "GET"})
            else:
                self._error(404, "not found")
        else:
            if known:
                allow = "POST" if path in ("/events", "/nudge") else "GET"
                self._error(405, "method not allowed", {"Allow": allow})
            else:
                self._error(404, "not found")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_PATCH(self):
        self._dispatch("PATCH")

    def do_HEAD(self):
        self._dispatch("HEAD")

    def do_OPTIONS(self):
        self._dispatch("OPTIONS")


class BoardServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass  # a dropped stream subscriber is not a server error


def main():
    parser = argparse.ArgumentParser(
        description="Serve the crew board live from a run file."
    )
    parser.add_argument("--run-file", required=True,
                        help="the run-status JSONL file to serve and append to")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--silence", type=int, default=120,
                        help="seconds before an agent holding a claim "
                             "counts as silent (default 120)")
    parser.add_argument("--extra-run", action="append", default=[],
                        help="another run file the board may open "
                             "under /runs/<name> (repeatable)")
    parser.add_argument("--board-dir", default=None,
                        help="folder holding board.html and the bundled "
                             "runs (default: this script's folder)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    board_dir = Path(args.board_dir) if args.board_dir else script_dir
    run_file = str(Path(args.run_file))
    run_map = {}
    for candidate in [args.run_file, *args.extra_run]:
        run_map.setdefault(Path(candidate).name, str(Path(candidate)))

    try:  # the run file exists from the start, even before line one
        with open(run_file, "a", encoding="utf-8"):
            pass
    except OSError:
        pass

    httpd = BoardServer((args.host, args.port), BoardHandler)
    httpd.cfg = {
        "run_file": run_file,
        "run_map": run_map,
        "board_dir": str(board_dir),
        "silence": args.silence,
        "host": args.host,
    }
    actual_port = httpd.server_address[1]
    print(f"Board: http://{args.host}:{actual_port}/", flush=True)
    print(f"Run file: {Path(run_file).resolve()}", flush=True)
    if args.host not in LOCAL_HOSTS:
        print(
            f"WARNING: binding beyond localhost ({args.host}) — anyone "
            "who can reach this port can read the board and post lines. "
            "Run only on a trusted network or tailnet.",
            flush=True,
        )
    print("No authentication — run only on a trusted network or tailnet.",
          flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
