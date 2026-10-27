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
RECEIPT_GENERATED_BY = "bootstrap.py (The Agent Call Sheet)"
TARGET_GUIDES = {
    "claude-web": "front-door/install/claude-web.md",
    "grok-build": "front-door/install/grok-build.md",
    "prompt-only": "front-door/install/prompt-only.md",
}


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
        with open(manifest_path, newline="", encoding="utf-8-sig") as handle:
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
    skill = orchestrator / "SKILL.md"
    if skill.is_symlink() or not skill.is_file():
        raise BootstrapError(
            "front-door/crew-orchestrator/SKILL.md missing: "
            "the front door is incomplete, refusing to install"
        )
    for rel in collect_source_files(orchestrator):
        pairs.append((orchestrator / rel, Path("crew-orchestrator") / rel))
    prompt = front / "starter-prompt.md"
    if prompt.is_symlink() or not prompt.is_file():
        raise BootstrapError("front-door/starter-prompt.md missing")
    pairs.append((prompt, Path("starter-prompt.md")))
    dest_rels = {rel for _src, rel in pairs}
    for required in (Path("crew-orchestrator") / "SKILL.md",
                     Path("starter-prompt.md")):
        if required not in dest_rels:
            raise BootstrapError(
                "front door is incomplete: %s is missing from the "
                "front-door sources, refusing to install" % required
            )
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
                              "plus front-door.zip into DIR; scope is the "
                              "selection scope (the default scope — front "
                              "door + Rigor core — with no --packs, or the "
                              "--packs selection). Generated on demand, "
                              "never shipped. With --bundle and no "
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
    for _source, dest in pairs:
        current = dest_root
        try:
            parts = dest.relative_to(dest_root).parts
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


def guard_output_path(path, kind, root):
    """Refuse an output path that lands in the repo's tracked content.

    Containment is judged on the fully resolved path (every ancestor
    component's symlinks resolved), so a symlinked parent cannot smuggle
    the destination into the tree. The only in-repo locations allowed are
    the script's documented staging shapes: repo-root
    ``agent-call-sheet-<target>/`` for an install destination and
    repo-root ``bundles/`` for a bundle dir (both gitignored, so staging
    there leaves ``git status`` clean). Returns an error string or None.
    """
    label = "--dest" if kind == "dest" else "--bundle dir"
    if path.is_symlink():
        return "%s is a symlink; refusing to follow it: %s" % (label, path)
    if path.exists() and not path.is_dir():
        return "%s exists and is not a folder: %s" % (label, path)
    resolved = path.resolve()
    if resolved == root:
        return "%s must not be the repository itself: %s" % (label, resolved)
    if root in resolved.parents:
        if (kind == "dest" and resolved.parent == root and resolved.name
                in {"agent-call-sheet-" + t for t in TARGETS}):
            return None
        if kind == "bundle" and resolved == root / "bundles":
            return None
        return ("%s must not be inside the repository (only the "
                "documented staging locations agent-call-sheet-<target>/ "
                "and bundles/ at the repo root are allowed): %s"
                % (label, resolved))
    return None


def compute_scope(rows, selected_packs):
    """The one scope computation shared by install, --list and --bundle.

    Scope is always the front door plus the Rigor core set, plus any
    packs named with --packs. Link-only and practice rows are taken from
    the whole scope (core included), not only from named packs.
    """
    scope_packs = [CORE_PACK] + list(selected_packs)
    included = [r for r in rows
                if r["distribution"] == "include"
                and r["pack"] in scope_packs]
    not_installed = [r for r in rows
                     if r["distribution"] == "link-only"
                     and r["pack"] in scope_packs]
    practice = [r for r in rows
                if r["distribution"] == ALLOWED_DISTRIBUTIONS[2]
                and r["pack"] in scope_packs]
    return scope_packs, included, not_installed, practice


def scan_entry(dest_root, pairs):
    """Classify one entry's destinations by hash: conflict / same / new.

    An existing file counts as "same" only when its sha256 matches the
    source; anything else (symlink, non-regular file, differing bytes)
    is a conflict for the whole entry.
    """
    conflicts = check_dest_chain_symlinks(dest_root, pairs)
    if not conflicts:
        for source, target in pairs:
            if target.is_symlink():
                conflicts.append(str(target))
            elif target.exists() and not target.is_file():
                conflicts.append(str(target))
            elif target.exists() and sha256_file(target) != sha256_file(source):
                conflicts.append(str(target))
    if conflicts:
        return "conflict", conflicts
    if pairs and all(target.exists() for _s, target in pairs):
        return "same", []
    return "new", []


def receipt_state(receipt_path):
    """Classify a pre-existing receipt: absent / own / foreign / symlink.

    "own" means a JSON object carrying this script's generated_by
    marker; anything else that already sits at the receipt path is
    foreign and must never be overwritten.
    """
    if receipt_path.is_symlink():
        return "symlink"
    if not receipt_path.exists():
        return "absent"
    if not receipt_path.is_file():
        return "foreign"
    try:
        with open(receipt_path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return "foreign"
    if isinstance(data, dict) and data.get("generated_by") == RECEIPT_GENERATED_BY:
        return "own"
    return "foreign"


def _tmp_sibling(path):
    return path.parent / (path.name + ".tmp-%d" % os.getpid())


def write_receipt_atomic(receipt_path, receipt):
    """Write the receipt via a temp file in the same dir + os.replace.

    The temp file is created exclusively (never through a symlink), so
    an interrupted write leaves at most a stray temp file, never a
    truncated receipt.
    """
    tmp = _tmp_sibling(receipt_path)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL
                 | getattr(os, "O_NOFOLLOW", 0), 0o644)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(receipt, handle, indent=2)
            handle.write("\n")
        os.replace(tmp, receipt_path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def write_zip_atomic(zip_path, pairs):
    """Write one bundle zip via a temp file in the same dir + os.replace,
    so an interrupted write never leaves a truncated zip behind."""
    tmp = _tmp_sibling(zip_path)
    if tmp.is_symlink() or tmp.exists():
        raise BootstrapError("temporary bundle path already exists: %s" % tmp)
    try:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as archive:
            for source, rel in pairs:
                archive.write(source, str(rel))
        os.replace(tmp, zip_path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def staging_note(target):
    guide = TARGET_GUIDES.get(target)
    if guide is None:
        return None
    return ("Note: %s cannot be installed into directly; files are staged "
            "here for upload/paste. The upload/paste steps live in %s, "
            "section \"Manual fallback — steps\"." % (target, guide))


def main(argv=None):
    args = parse_args(argv)
    # Empty-string option values are errors, never silent defaults:
    # a typo'd --dest "" must not install into the real default folder.
    for opt, value in (("--dest", args.dest), ("--packs", args.packs),
                       ("--bundle", args.bundle)):
        if value is not None and not value.strip():
            print("error: %s requires a non-empty value" % opt,
                  file=sys.stderr)
            return 1
    try:
        return _main(args)
    except BootstrapError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 1
    except OSError as exc:
        # No raw tracebacks: any I/O failure in the write phase (dest is
        # a file, disk full, permissions) lands here as a clean error.
        print("error: %s (the run may be partially complete; re-running "
              "is safe and resumes from what is already in place)" % exc,
              file=sys.stderr)
        return 1


def _main(args):
    root = repo_root()
    rows, manifest_sha = load_manifest(root)
    front_pairs = front_door_files(root)

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
    bundle_dir = Path(args.bundle) if args.bundle is not None else None

    # Refuse output paths that resolve into the repo's tracked content,
    # before anything is written. Containment is judged on the fully
    # resolved path; only the documented staging locations inside the
    # repo (agent-call-sheet-<target>/ and bundles/ at the repo root,
    # both gitignored) are allowed.
    if not args.list:
        if not bundle_only:
            problem = guard_output_path(dest, "dest", root)
            if problem is not None:
                print("error: %s" % problem, file=sys.stderr)
                return 1
        if bundle_dir is not None:
            problem = guard_output_path(bundle_dir, "bundle", root)
            if problem is not None:
                print("error: %s" % problem, file=sys.stderr)
                return 1

    # Scope: front door + Rigor core always; selected packs add entries.
    # This single computation drives install, --list and --bundle alike.
    scope_packs, included, not_installed, practice = compute_scope(
        rows, selected_packs)

    if args.list:
        print("Plan (writes nothing):")
        print("  target: %s" % args.target)
        print("  dest: %s" % dest)
        note = staging_note(args.target)
        if note is not None:
            print("  %s" % note)
        print("  front door: %d files (crew-orchestrator + starter-prompt.md)"
              % len(front_pairs))
        for row in included:
            print("  include: %s (%s, %d files)"
                  % (row["name"], row["pack"], row["_expected"]))
        if args.bundle is not None:
            print("  bundle dir: %s (%d entry zips + front-door.zip)"
                  % (args.bundle, len(included)))
        if not_installed:
            print(LINK_ONLY_BANNER)
            for row in not_installed:
                print("  %s — %s" % (row["name"], row["source_url"]))
        return 0

    if args.bundle is not None:
        # Bundle scope is the selection scope: a bare --bundle exports
        # the default scope (front door + Rigor core), --packs X exports
        # X's scope — exactly what an install with the same flags does.
        bundle_scope = included
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
            write_zip_atomic(zip_path, pairs)
            print("bundled: %s (%d files)" % (zip_path, len(pairs)))
            written += 1
        print("Bundles: %d written, %d skipped in %s"
              % (written, skipped, bundle_dir))
        if bundle_only:
            note = staging_note(args.target)
            if note is not None:
                print(note)
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
    note = staging_note(args.target)
    if note is not None:
        print(note)

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

    # Pre-scan: every destination is hash-checked before the first
    # write, and the receipt path is classified before anything is
    # written: a foreign or symlinked INSTALL-RECEIPT.json is a
    # conflict — it is reported and left untouched, never overwritten
    # and never written through.
    for pairs in plans.values():
        scan_entry(dest, pairs)
    receipt_path = dest / RECEIPT_NAME
    receipt_conflict = receipt_state(receipt_path) in ("foreign", "symlink")
    if receipt_conflict:
        print("warning: conflict, receipt will not be written: %s "
              "already exists and was not written by bootstrap.py "
              "(or is a symlink); it will be left untouched" % receipt_path)

    os.makedirs(dest, exist_ok=True)
    results = []
    total_copied = total_same = total_conflicts = 0
    for key, pairs in plans.items():
        # Re-scan at copy time, immediately before this entry is
        # copied: an existing file is counted skipped-same only after
        # this hash comparison, and a file that changed (or appeared)
        # since the pre-scan is a conflict skip for the whole entry,
        # never silently counted as identical and never overwritten.
        status, conflicts = scan_entry(dest, pairs)
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
                # scan_entry just hash-verified this file as identical.
                same += 1
                continue
            os.makedirs(target.parent, exist_ok=True)
            shutil.copyfile(source, target)
            # Preserve the source permission bits (an executable script
            # must land executable); bytes are verified by hash below.
            shutil.copymode(source, target)
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
        "generated_by": RECEIPT_GENERATED_BY,
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
    # Re-classify at write time: if a foreign or symlinked receipt has
    # appeared (or was already there), never overwrite it and never
    # write through a symlink — report it as a conflict instead. Our
    # own earlier receipt (generated_by marker) is replaced atomically.
    if receipt_state(receipt_path) in ("foreign", "symlink"):
        receipt_conflict = True
        print("warning: conflict, receipt not written: %s already "
              "exists and was not written by bootstrap.py (or is a "
              "symlink); it was left untouched" % receipt_path)
    else:
        write_receipt_atomic(receipt_path, receipt)
        print("Receipt: %s" % receipt_path)
    if practice:
        print("Practices (described in the kit doc only, nothing to "
              "install): %s" % ", ".join(r["name"] for r in practice))
    conflict_entries = [r for r in results
                        if r["status"] == "skipped-conflict"]
    conflict_clause = ""
    if conflict_entries:
        conflict_clause = (
            "; %d included %s skipped due to conflicts: %s"
            % (len(conflict_entries),
               "entry was" if len(conflict_entries) == 1 else "entries were",
               ", ".join(r["name"] for r in conflict_entries)))
    receipt_clause = ""
    if receipt_conflict:
        receipt_clause = ("; the receipt was not written because the "
                          "existing INSTALL-RECEIPT.json was not written "
                          "by bootstrap.py and was left untouched")
    if not_installed:
        print(LINK_ONLY_BANNER)
        for row in not_installed:
            print("  %s — %s" % (row["name"], row["source_url"]))
        print("Done: included entries installed%s; the link-only entries "
              "above were not installed%s."
              % (conflict_clause, receipt_clause))
    else:
        print("Setup complete: %d files copied, %d already identical, "
              "%d conflicts%s." % (total_copied, total_same,
                                   total_conflicts, receipt_clause))
    return 0


if __name__ == "__main__":
    sys.exit(main())
