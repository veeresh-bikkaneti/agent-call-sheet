#!/usr/bin/env python3
"""Bootstrap for The Agent Call Sheet.

Copies the front door plus the Rigor core set (and any packs selected with
--packs) from this repository into a skills folder. Standard library only.
This script fetches nothing and executes nothing: it only reads the
manifest, copies files, checks sha256 copy fidelity, optionally writes
per-entry zip bundles, and writes an install receipt.

Note: some installed skills contain scripts that the host platform may
run when a skill is used. "Executes nothing" describes this script only.
"""

import argparse
import csv
import hashlib
import json
import os
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_DISTRIBUTIONS = (
    "include",
    "link-only",
    "n/a — described in the kit doc only",
)
LINK_ONLY_BANNER = (
    "NOT installed (link-only — get it yourself, under its own license):"
)
TARGETS = ("claude-code", "claude-web", "grok-build", "prompt-only")
CORE_PACK = "rigor"
RECEIPT_NAME = "INSTALL-RECEIPT.json"


class BootstrapError(Exception):
    """Malformed input or unsafe path: fail closed, install nothing."""


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_root():
    return Path(__file__).resolve().parent


def collect_source_files(entry_dir):
    """Recursive regular files under entry_dir, dotfiles included.

    Returns a sorted list of Paths relative to entry_dir. Raises
    BootstrapError if any symlink is found inside (never followed).
    """
    found = []
    for dirpath, dirnames, filenames in os.walk(entry_dir):
        dirnames.sort()
        for name in dirnames:
            candidate = Path(dirpath) / name
            if candidate.is_symlink():
                raise BootstrapError(
                    "symlink in source tree, refusing: %s" % candidate
                )
        for name in sorted(filenames):
            candidate = Path(dirpath) / name
            if candidate.is_symlink():
                raise BootstrapError(
                    "symlink in source tree, refusing: %s" % candidate
                )
            if candidate.is_file():
                found.append(candidate.relative_to(entry_dir))
    return sorted(found)


def load_manifest(root):
    manifest_path = root / "manifest.csv"
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise BootstrapError("manifest.csv missing or a symlink: %s" % manifest_path)
    try:
        with open(manifest_path, newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            required = {"name", "pack", "distribution", "local_path",
                        "files", "source_url"}
            if reader.fieldnames is None or not required.issubset(
                set(reader.fieldnames)
            ):
                raise BootstrapError(
                    "manifest.csv is missing required columns: %s"
                    % sorted(required)
                )
            rows = list(reader)
    except BootstrapError:
        raise
    except (OSError, csv.Error, UnicodeDecodeError) as exc:
        raise BootstrapError("cannot read manifest.csv: %s" % exc)
    if not rows:
        raise BootstrapError("manifest.csv has no rows")
    packs_root = (root / "packs").resolve()
    seen_dests = {}
    for row in rows:
        distribution = row["distribution"]
        if distribution not in ALLOWED_DISTRIBUTIONS:
            raise BootstrapError(
                "unknown distribution %r for entry %r: fail closed"
                % (distribution, row["name"])
            )
        if distribution != "include":
            continue
        local_path = (row["local_path"] or "").strip()
        if not local_path:
            raise BootstrapError(
                "included entry %r has no local_path" % row["name"]
            )
        source = root / local_path
        if source.is_symlink():
            raise BootstrapError("source is a symlink: %s" % source)
        resolved = source.resolve()
        if packs_root not in resolved.parents and resolved != packs_root:
            raise BootstrapError(
                "source path escapes packs/: %s" % local_path
            )
        if not resolved.is_dir():
            raise BootstrapError("source folder missing: %s" % local_path)
        try:
            expected = int(row["files"])
        except (TypeError, ValueError):
            raise BootstrapError(
                "bad files count for entry %r: %r" % (row["name"], row["files"])
            )
        files = collect_source_files(resolved)
        if len(files) != expected:
            raise BootstrapError(
                "file count mismatch for entry %r: manifest says %d, "
                "disk has %d" % (row["name"], expected, len(files))
            )
        dest_name = resolved.name
        if dest_name in seen_dests:
            raise BootstrapError(
                "duplicate destination %r for entries %r and %r"
                % (dest_name, seen_dests[dest_name], row["name"])
            )
        seen_dests[dest_name] = row["name"]
        row["_resolved"] = resolved
        row["_files"] = files
        row["_expected"] = expected
    return rows, sha256_file(manifest_path)


def front_door_files(root):
    """Explicit front-door file list (it has no manifest row or count).

    Returns [(absolute_source, dest_relative_path), ...].
    """
    front = (root / "front-door").resolve()
    pairs = []
    orchestrator = front / "crew-orchestrator"
    if orchestrator.is_symlink() or not orchestrator.is_dir():
        raise BootstrapError("front-door/crew-orchestrator missing")
    for rel in collect_source_files(orchestrator):
        pairs.append((orchestrator / rel, Path("crew-orchestrator") / rel))
    prompt = front / "starter-prompt.md"
    if prompt.is_symlink() or not prompt.is_file():
        raise BootstrapError("front-door/starter-prompt.md missing")
    pairs.append((prompt, Path("starter-prompt.md")))
    for source, _rel in pairs:
        if front not in source.resolve().parents:
            raise BootstrapError("front-door source escapes front-door/: %s" % source)
    return pairs


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="bootstrap.py",
        description=(
            "Copy the Agent Call Sheet front door + Rigor core set (and "
            "any --packs) into a skills folder. Fetches nothing, executes "
            "nothing. Non-Claude targets are staged into "
            "./agent-call-sheet-<target>/ relative to the current working "
            "directory (they cannot be installed into directly; the files "
            "are staged for upload or paste), unless --dest is given. "
            "--dest always wins over target defaults."
        ),
    )
    parser.add_argument("--target", default="claude-code", choices=TARGETS,
                        help="install surface (default: claude-code)")
    parser.add_argument("--dest", default=None,
                        help="destination folder (overrides target default)")
    parser.add_argument("--packs", default=None,
                        help="comma-separated extra packs, e.g. seo,legal")
    parser.add_argument("--list", action="store_true",
                        help="print the plan only; write nothing")
    parser.add_argument("--bundle", default=None, metavar="DIR",
                        help=("write one zip per included entry in scope "
                              "plus front-door.zip into DIR; generated on "
                              "demand, never shipped. With --bundle and no "
                              "explicit --dest, only bundles are written."))
    return parser.parse_args(argv)


def resolve_dest(args):
    if args.dest:
        return Path(args.dest).expanduser(), True
    if args.target == "claude-code":
        return Path.home() / ".claude" / "skills", False
    return Path.cwd() / ("agent-call-sheet-" + args.target), False


def plan_entry(row, dest_root):
    """Pair every source file of an included entry with its destination."""
    source_dir = row["_resolved"]
    dest_dir = dest_root / source_dir.name
    return [(source_dir / rel, dest_dir / rel) for rel in row["_files"]]


def check_dest_chain_symlinks(dest_root, pairs):
    """Entry-level symlink check over the real destination chain."""
    bad = []
    dest_root_resolved = dest_root
    for _source, dest in pairs:
        current = dest_root_resolved
        try:
            parts = dest.relative_to(dest_root_resolved).parts
        except ValueError:
            bad.append(str(dest))
            continue
        linked = False
        for part in parts:
            current = current / part
            if current.is_symlink():
                linked = True
                break
        if linked:
            bad.append(str(dest))
    return bad


def main(argv=None):
    args = parse_args(argv)
    root = repo_root()
    try:
        rows, manifest_sha = load_manifest(root)
        front_pairs = front_door_files(root)
    except BootstrapError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 1

    known_packs = sorted({row["pack"] for row in rows})
    selected_packs = []
    if args.packs:
        for name in args.packs.split(","):
            name = name.strip()
            if not name:
                print("error: empty pack name in --packs", file=sys.stderr)
                return 1
            if name not in known_packs:
                print("error: unknown pack %r (known: %s)"
                      % (name, ", ".join(known_packs)), file=sys.stderr)
                return 1
            if name not in selected_packs and name != CORE_PACK:
                selected_packs.append(name)

    dest, dest_explicit = resolve_dest(args)
    bundle_only = args.bundle is not None and not dest_explicit

    # Refuse a destination inside the repository source tree.
    if not args.list and not bundle_only:
        resolved_dest = Path(os.path.abspath(str(dest)))
        if resolved_dest == root or root in resolved_dest.parents:
            print("error: --dest must not be the repository or inside it: %s"
                  % resolved_dest, file=sys.stderr)
            return 1
        if dest.is_symlink():
            print("error: --dest is a symlink; refusing to follow it: %s"
                  % dest, file=sys.stderr)
            return 1

    # Scope: front door + Rigor core always; selected packs add entries.
    scope_packs = [CORE_PACK] + selected_packs
    included = [r for r in rows
                if r["distribution"] == "include" and r["pack"] in scope_packs]
    not_installed = [r for r in rows
                     if r["distribution"] == "link-only"
                     and r["pack"] in selected_packs]
    practice = [r for r in rows
                if r["distribution"] == ALLOWED_DISTRIBUTIONS[2]
                and r["pack"] in selected_packs]

    if args.list:
        print("Plan (writes nothing):")
        print("  target: %s" % args.target)
        print("  dest: %s" % dest)
        if args.target != "claude-code":
            print("  note: %s cannot be installed into directly; files "
                  "are staged for upload/paste." % args.target)
        print("  front door: %d files (crew-orchestrator + starter-prompt.md)"
              % len(front_pairs))
        for row in included:
            print("  include: %s (%s, %d files)"
                  % (row["name"], row["pack"], row["_expected"]))
        if args.bundle is not None:
            bundle_scope = included
            if not selected_packs:
                bundle_scope = [r for r in rows
                                if r["distribution"] == "include"]
            print("  bundle dir: %s (%d entry zips + front-door.zip)"
                  % (args.bundle, len(bundle_scope)))
        if not_installed:
            print(LINK_ONLY_BANNER)
            for row in not_installed:
                print("  %s — %s" % (row["name"], row["source_url"]))
        return 0

    if args.bundle is not None:
        bundle_dir = Path(args.bundle)
        if bundle_dir.is_symlink():
            print("error: --bundle dir is a symlink; refusing: %s"
                  % bundle_dir, file=sys.stderr)
            return 1
        resolved_bundle = Path(os.path.abspath(str(bundle_dir)))
        if resolved_bundle == root or root in resolved_bundle.parents:
            print("error: --bundle dir must not be inside the repository: %s"
                  % resolved_bundle, file=sys.stderr)
            return 1
        # --bundle scope defaults to all included entries (B7); with
        # --packs it respects the selected packs (plus the core set).
        bundle_scope = included
        if not selected_packs:
            bundle_scope = [r for r in rows if r["distribution"] == "include"]
        os.makedirs(bundle_dir, exist_ok=True)
        zip_plans = []
        for row in bundle_scope:
            pairs = [(row["_resolved"] / rel,
                      Path(row["_resolved"].name) / rel)
                     for rel in row["_files"]]
            zip_plans.append((row["_resolved"].name + ".zip", pairs))
        zip_plans.append(("front-door.zip", front_pairs))
        written = skipped = 0
        for zip_name, pairs in zip_plans:
            zip_path = bundle_dir / zip_name
            if zip_path.is_symlink():
                print("warning: skipping bundle %s (symlink)" % zip_path)
                skipped += 1
                continue
            if zip_path.exists():
                # Never overwrite a foreign zip. A zip whose members all
                # hash-match the planned sources is our own earlier output:
                # leave it in place and count it as skipped-same.
                try:
                    with zipfile.ZipFile(zip_path) as archive:
                        members = {info.filename: archive.read(info.filename)
                                   for info in archive.infolist()
                                   if not info.is_dir()}
                    planned = {str(rel): src for src, rel in pairs}
                    same = set(members) == set(planned) and all(
                        hashlib.sha256(members[name]).hexdigest()
                        == sha256_file(planned[name]) for name in planned)
                except (zipfile.BadZipFile, OSError, KeyError):
                    same = False
                if same:
                    print("skipped-same: %s" % zip_path)
                else:
                    print("warning: not overwriting foreign zip: %s" % zip_path)
                skipped += 1
                continue
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
                for source, rel in pairs:
                    archive.write(source, str(rel))
            print("bundled: %s (%d files)" % (zip_path, len(pairs)))
            written += 1
        print("Bundles: %d written, %d skipped in %s"
              % (written, skipped, bundle_dir))
        if bundle_only:
            if not_installed:
                print(LINK_ONLY_BANNER)
                for row in not_installed:
                    print("  %s — %s" % (row["name"], row["source_url"]))
                print("Done. Bundles written; link-only entries above were "
                      "not bundled or installed.")
            else:
                print("Done. Bundles written to %s" % bundle_dir)
            return 0

    # ---- Install path ----
    print("Target: %s" % args.target)
    print("Destination: %s" % dest)
    print("Plan: front door (%d files) + %d included entries from packs: %s"
          % (len(front_pairs), len(included), ", ".join(scope_packs)))
    if args.target != "claude-code":
        print("Note: %s cannot be installed into directly; files are "
              "staged here for upload/paste." % args.target)

    plans = {"front-door": [(src, dest / rel) for src, rel in front_pairs]}
    for row in included:
        plans[row["name"]] = plan_entry(row, dest)

    # Duplicate destinations = hard fail in pre-scan, before any copy.
    seen = {}
    for key, pairs in plans.items():
        for _source, target in pairs:
            marker = str(target)
            if marker in seen and seen[marker] != key:
                print("error: duplicate destination %s for %r and %r"
                      % (marker, seen[marker], key), file=sys.stderr)
                return 1
            seen[marker] = key

    # Pre-scan: every destination is checked before the first write.
    statuses = {}
    for key, pairs in plans.items():
        conflicts = check_dest_chain_symlinks(dest, pairs)
        if not conflicts:
            for source, target in pairs:
                if target.is_symlink():
                    conflicts.append(str(target))
                elif target.exists() and not target.is_file():
                    conflicts.append(str(target))
                elif target.exists() and sha256_file(target) != sha256_file(source):
                    conflicts.append(str(target))
        if conflicts:
            statuses[key] = ("conflict", conflicts)
        elif pairs and all(target.exists() for _s, target in pairs):
            statuses[key] = ("same", [])
        else:
            statuses[key] = ("new", [])

    os.makedirs(dest, exist_ok=True)
    results = []
    total_copied = total_same = total_conflicts = 0
    for key, pairs in plans.items():
        status, conflicts = statuses[key]
        if status == "conflict":
            for path in conflicts:
                print("warning: conflict, entry skipped not-at-all: %s (%s)"
                      % (key, path))
            total_conflicts += len(conflicts)
            results.append({
                "name": key, "status": "skipped-conflict",
                "files_expected": len(pairs), "files_copied": 0,
                "files_skipped_same": 0, "conflicts": conflicts,
                "files": [str(t.relative_to(dest)) for _s, t in pairs],
            })
            continue
        copied = same = 0
        for source, target in pairs:
            if target.exists():
                same += 1
                continue
            os.makedirs(target.parent, exist_ok=True)
            shutil.copyfile(source, target)
            if sha256_file(target) != sha256_file(source):
                print("error: copy fidelity check failed: %s" % target,
                      file=sys.stderr)
                return 1
            copied += 1
        total_copied += copied
        total_same += same
        entry = {
            "name": key,
            "status": "skipped-same" if copied == 0 else "installed",
            "files_expected": len(pairs), "files_copied": copied,
            "files_skipped_same": same, "conflicts": [],
            "files": [str(t.relative_to(dest)) for _s, t in pairs],
        }
        if key != "front-door":
            row = next(r for r in included if r["name"] == key)
            entry["pack"] = row["pack"]
            entry["local_path"] = row["local_path"]
            entry["manifest_files"] = row["_expected"]
        results.append(entry)
        print("%s: %s (%d copied, %d already identical)"
              % (key, entry["status"], copied, same))

    receipt = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "target": args.target,
        "dest": str(dest),
        "manifest_sha256": manifest_sha,
        "packs": scope_packs,
        "entries": results,
        "conflicts": total_conflicts,
        "totals": {"copied": total_copied, "skipped_same": total_same},
        "not_installed": [
            {"name": r["name"], "pack": r["pack"],
             "source_url": r["source_url"], "distribution": r["distribution"]}
            for r in not_installed
        ],
        "practice_not_installed": [
            {"name": r["name"], "pack": r["pack"],
             "distribution": r["distribution"]} for r in practice
        ],
    }
    receipt_path = dest / RECEIPT_NAME
    with open(receipt_path, "w", encoding="utf-8") as handle:
        json.dump(receipt, handle, indent=2)
        handle.write("\n")
    print("Receipt: %s" % receipt_path)
    if practice:
        print("Practices (described in the kit doc only, nothing to "
              "install): %s" % ", ".join(r["name"] for r in practice))
    if not_installed:
        print(LINK_ONLY_BANNER)
        for row in not_installed:
            print("  %s — %s" % (row["name"], row["source_url"]))
        print("Done: included entries installed; the link-only entries "
              "above were not installed.")
    else:
        print("Setup complete: %d files copied, %d already identical, "
              "%d conflicts." % (total_copied, total_same, total_conflicts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
