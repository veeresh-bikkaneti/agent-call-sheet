#!/usr/bin/env python3
"""Bootstrap for The Agent Call Sheet.

Copies the front door plus the Rigor core set (and any packs selected with
--packs) from this repository into a skills folder. Standard library only.
This script fetches nothing and executes nothing: it only reads the
manifest, copies files, checks sha256 copy fidelity, optionally writes
per-entry zip bundles, and writes an install receipt.

One disclosed exception to byte-identical copying: the SKILL.md files
listed in frontmatter-injections.json ship without frontmatter, so the
installed/bundled copy gains a drafted name + description block (the
repository copy is never modified). Every injection is printed as it
happens and recorded in the receipt / bundle disclosure member.

Note: some installed skills contain scripts that the host platform may
run when a skill is used. "Executes nothing" describes this script only.
"""

import argparse
import csv
import hashlib
import json
import os
import re
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
INJECTIONS_NAME = "frontmatter-injections.json"
INJECTION_NOTE_NAME = "FRONTMATTER-INJECTION.md"
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


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def frontmatter_block(folder_name, description):
    """The exact bytes prepended to an injected copy: a YAML frontmatter
    block carrying name + description only. The description is emitted
    as a double-quoted scalar (JSON string escaping is valid YAML
    double-quoted style) because the drafted descriptions contain
    ": " sequences a plain scalar cannot carry."""
    return ("---\nname: %s\ndescription: %s\n---\n"
            % (folder_name, json.dumps(description))).encode("utf-8")


def load_injections(root, rows):
    """Load frontmatter-injections.json and validate it against the
    manifest. Returns {entry name: record}. Validation is fail-closed
    and runs before anything is written: malformed data, a row set
    that does not exactly equal the manifest's eligible set, a row
    adding fields beyond name + description, a target that is not one
    of the entry's own SKILL.md files, or a vendored file that already
    carries frontmatter while the manifest records 'none' (an
    inconsistent half-re-sync) all abort the run."""
    path = root / INJECTIONS_NAME
    if path.is_symlink() or not path.is_file():
        raise BootstrapError(
            "%s missing or a symlink: %s" % (INJECTIONS_NAME, path))
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BootstrapError("cannot parse %s: %s" % (INJECTIONS_NAME, exc))
    if not isinstance(data, dict) \
            or not isinstance(data.get("injections"), list):
        raise BootstrapError(
            "%s: expected an object with an 'injections' list"
            % INJECTIONS_NAME)
    by_name = {row["name"]: row for row in rows}
    eligible = {row["name"] for row in rows
                if row["distribution"] == "include"
                and row.get("frontmatter_status") == "none"}
    active = {}
    seen = set()
    for item in data["injections"]:
        if not isinstance(item, dict):
            raise BootstrapError("%s: injection row is not an object"
                                 % INJECTIONS_NAME)
        for field in ("entry", "local_path", "file", "draft_name",
                      "description", "fields_added"):
            if field not in item:
                raise BootstrapError(
                    "%s: injection row missing %r" % (INJECTIONS_NAME, field))
        if item["fields_added"] != ["name", "description"]:
            raise BootstrapError(
                "%s: entry %r must add exactly name + description "
                "(behavioural flags are never injected)"
                % (INJECTIONS_NAME, item["entry"]))
        if item["entry"] in seen:
            raise BootstrapError(
                "%s: duplicate injection row for %r"
                % (INJECTIONS_NAME, item["entry"]))
        seen.add(item["entry"])
        row = by_name.get(item["entry"])
        if row is None or row["distribution"] != "include":
            raise BootstrapError(
                "%s: %r is not an included manifest entry"
                % (INJECTIONS_NAME, item["entry"]))
        if row["local_path"] != item["local_path"]:
            raise BootstrapError(
                "%s: local_path for %r does not match the manifest"
                % (INJECTIONS_NAME, item["entry"]))
        if row.get("frontmatter_status") != "none":
            raise BootstrapError(
                "%s: %r has an injection row but the manifest records "
                "frontmatter_status %r, not 'none'"
                % (INJECTIONS_NAME, item["entry"],
                   row.get("frontmatter_status")))
        desc = item["description"]
        if not isinstance(desc, str) or not desc.strip() \
                or "\n" in desc or "\r" in desc:
            raise BootstrapError(
                "%s: description for %r must be a non-empty "
                "single-line string" % (INJECTIONS_NAME, item["entry"]))
        rel = Path(item["file"])
        if rel.is_absolute() or ".." in rel.parts \
                or rel not in row["_files"] or rel.name != "SKILL.md":
            raise BootstrapError(
                "%s: %r is not a SKILL.md file of entry %r"
                % (INJECTIONS_NAME, item["file"], item["entry"]))
        source = row["_resolved"] / rel
        with open(source, "rb") as handle:
            head = handle.read(4)
        record = dict(item)
        record["_source"] = source
        record["_rel"] = rel
        written_name = item.get("name_override") or row["_resolved"].name
        if not re.fullmatch(r"[a-z0-9-]{1,64}", written_name):
            raise BootstrapError(
                "%s: written name %r for %r is not a valid skill name "
                "(lowercase letters, numbers, hyphens, max 64)"
                % (INJECTIONS_NAME, written_name, item["entry"]))
        record["_written_name"] = written_name
        if head.startswith(b"---"):
            # The vendored copy carries frontmatter while the manifest
            # still records none: an inconsistent half-re-sync. Fail
            # closed — a re-sync must update the file, the manifest
            # status, and this data file together.
            raise BootstrapError(
                "%s: %s already carries frontmatter but the manifest "
                "records frontmatter_status 'none' for %r; refusing to "
                "guess which record is current"
                % (INJECTIONS_NAME, item["file"], item["entry"]))
        record["_block"] = frontmatter_block(written_name,
                                              item["description"])
        active[item["entry"]] = record
    if seen != eligible:
        raise BootstrapError(
            "%s: injection rows do not match the manifest's eligible "
            "set (included entries with frontmatter_status 'none'): "
            "missing %s, unexpected %s"
            % (INJECTIONS_NAME, sorted(eligible - seen),
               sorted(seen - eligible)))
    return active


def build_transforms(included, injections):
    """{absolute source Path: installed bytes} for every active
    injection whose entry is in scope. The installed bytes are the
    drafted block prepended to the vendored bytes, which are never
    modified in the repository."""
    transforms = {}
    for row in included:
        record = injections.get(row["name"])
        if record is None:
            continue
        source = record["_source"]
        with open(source, "rb") as handle:
            raw = handle.read()
        if raw.startswith(b"---"):
            continue
        transforms[source] = record["_block"] + raw
    return transforms


def injection_note_text(row, record):
    """Deterministic disclosure member written into a bundle zip whose
    SKILL.md was injected (no timestamp, so bundle hashes stay stable
    across re-runs)."""
    lines = [
        "# Frontmatter injected at bundle time",
        "",
        "File: `%s/%s`" % (row["_resolved"].name, record["file"]),
        "",
        "This bundle's `SKILL.md` differs from the copy in the repository",
        "by exactly one mechanical transform: bootstrap.py prepended the",
        "YAML frontmatter block below, because the vendored `SKILL.md`",
        "ships without frontmatter and strict upload surfaces reject a",
        "skill that has none. The repository copy is unmodified and",
        "carries no frontmatter.",
        "Fields added: name, description.",
        "",
        "This frontmatter block was added by the Agent Call Sheet installer at install/bundle time; it is not present in the upstream source, whose repository copy remains byte-identical.",
        "",
    ]
    if record["_written_name"] != record["draft_name"]:
        lines += [
            "Catalog (draft) name: `%s`. Installed name: `%s` — the"
            % (record["draft_name"], record["_written_name"]),
            "installed name matches the installed folder (or, where a",
            "recorded name_override applies, the closest rule-valid",
            "form); see `frontmatter-injections.json` in the repository.",
            "",
        ]
    lines += [
        "```yaml",
        record["_block"].decode("utf-8").rstrip("\n"),
        "```",
        "",
        "The block text lives in `frontmatter-injections.json` in the",
        "repository (manifest layer), drafted from the file's own",
        "content; the installed name is the installed folder name.",
    ]
    for omitted in record.get("omitted_upstream_fields", []):
        lines += [
            "",
            "Deliberately NOT reproduced: the upstream field `%s`."
            % omitted["field"],
            "Injection adds name and description only, never behavioural",
            "flags; restoring upstream semantics is a separate re-sync",
            "decision.",
        ]
    if record.get("notes"):
        lines += ["", "Note: %s" % record["notes"]]
    return ("\n".join(lines) + "\n").encode("utf-8")


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
        # Even an otherwise-allowed staging shape is refused when it is
        # reached through a symlink: if any component of the path as
        # given is a symlink and the resolved path lands inside the
        # repo, the walk was not the documented plain path.
        absolute = Path(os.path.abspath(str(path)))
        current = Path(absolute.anchor)
        for part in absolute.parts[1:]:
            current = current / part
            if current.is_symlink():
                return ("%s reaches into the repository through a "
                        "symlink; refusing: %s" % (label, path))
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


def scan_entry(dest_root, pairs, transforms=None):
    """Classify one entry's destinations by hash: conflict / same / new.

    An existing file counts as "same" only when its sha256 matches the
    source; anything else (symlink, non-regular file, differing bytes)
    is a conflict for the whole entry. For a file with an install-time
    transform (frontmatter injection), two further states are not
    conflicts: the destination already holding the injected bytes is
    "same", and the destination holding the pristine source bytes (a
    copy installed by a pre-injection bootstrap) is an "upgrade" the
    copy loop rewrites with the injected bytes. Any other bytes remain
    a conflict — a file that already carries different frontmatter is
    never touched. Returns (status, conflicts, upgrades).
    """
    transforms = transforms or {}
    conflicts = check_dest_chain_symlinks(dest_root, pairs)
    upgrades = []
    if not conflicts:
        for source, target in pairs:
            if target.is_symlink():
                conflicts.append(str(target))
            elif target.exists() and not target.is_file():
                conflicts.append(str(target))
            elif target.exists():
                digest = sha256_file(target)
                if source in transforms:
                    if digest == sha256_bytes(transforms[source]):
                        continue
                    if digest == sha256_file(source):
                        upgrades.append(str(target))
                        continue
                    conflicts.append(str(target))
                elif digest != sha256_file(source):
                    conflicts.append(str(target))
    if conflicts:
        return "conflict", conflicts, upgrades
    if pairs and all(target.exists() for _s, target in pairs) \
            and not upgrades:
        return "same", [], []
    return "new", [], upgrades


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


def write_zip_atomic(zip_path, pairs, transforms=None, extra_members=None):
    """Write one bundle zip via a temp file in the same dir + os.replace,
    so an interrupted write never leaves a truncated zip behind. Files
    with an install-time transform are written from their transformed
    bytes; extra_members are (arcname, bytes) written verbatim."""
    transforms = transforms or {}
    tmp = _tmp_sibling(zip_path)
    if tmp.is_symlink() or tmp.exists():
        raise BootstrapError("temporary bundle path already exists: %s" % tmp)
    try:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as archive:
            for source, rel in pairs:
                if source in transforms:
                    archive.writestr(str(rel), transforms[source])
                else:
                    archive.write(source, str(rel))
            for arcname, data in (extra_members or []):
                archive.writestr(arcname, data)
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

    # Frontmatter injection: drafted blocks (data beside the manifest)
    # are prepended to the installed/bundled copies of the listed
    # SKILL.md files only. Repository sources are never modified.
    injections = load_injections(root, rows)
    transforms = build_transforms(included, injections)

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
            record = injections.get(row["name"])
            if record is not None and record["_source"] in transforms:
                print("    frontmatter: %s gains an injected block at "
                      "install (name + description only; the repository "
                      "copy is not modified)" % record["file"])
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
            extras = []
            record = injections.get(row["name"])
            if record is not None and record["_source"] in transforms:
                extras.append((
                    str(Path(row["_resolved"].name) / INJECTION_NOTE_NAME),
                    injection_note_text(row, record)))
            zip_plans.append((row["_resolved"].name + ".zip", pairs, extras))
        zip_plans.append(("front-door.zip", front_pairs, []))
        written = skipped = 0
        for zip_name, pairs, extras in zip_plans:
            zip_path = bundle_dir / zip_name
            if zip_path.is_symlink():
                print("warning: skipping bundle %s (symlink)" % zip_path)
                skipped += 1
                continue
            if zip_path.exists():
                # Never overwrite a foreign zip. A zip whose members all
                # hash-match the planned members (transformed bytes where
                # a transform applies) is our own earlier output: leave
                # it in place and count it as skipped-same.
                try:
                    with zipfile.ZipFile(zip_path) as archive:
                        members = {info.filename: archive.read(info.filename)
                                   for info in archive.infolist()
                                   if not info.is_dir()}
                    planned = {str(rel): src for src, rel in pairs}
                    for arcname, data in extras:
                        planned[arcname] = data

                    def planned_sha(name):
                        src = planned[name]
                        if isinstance(src, bytes):
                            return sha256_bytes(src)
                        if src in transforms:
                            return sha256_bytes(transforms[src])
                        return sha256_file(src)

                    same = set(members) == set(planned) and all(
                        hashlib.sha256(members[name]).hexdigest()
                        == planned_sha(name) for name in planned)
                except (zipfile.BadZipFile, OSError, KeyError):
                    same = False
                if same:
                    print("skipped-same: %s" % zip_path)
                else:
                    print("warning: not overwriting foreign zip: %s" % zip_path)
                skipped += 1
                continue
            write_zip_atomic(zip_path, pairs, transforms, extras)
            print("bundled: %s (%d files)" % (zip_path, len(pairs) + len(extras)))
            for arcname, _data in extras:
                print("  frontmatter injected into %s in this bundle "
                      "(disclosure: %s)"
                      % (arcname.replace(INJECTION_NOTE_NAME, "SKILL.md"),
                         arcname))
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
        scan_entry(dest, pairs, transforms)
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
        status, conflicts, _upgrades = scan_entry(dest, pairs, transforms)
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
            injected = transforms.get(source)
            if target.exists():
                if injected is not None \
                        and sha256_file(target) == sha256_file(source):
                    # Pristine copy left by a pre-injection bootstrap:
                    # upgrade it to the injected bytes. scan_entry has
                    # already classified exactly this state as an
                    # upgrade, never a conflict; any other bytes were a
                    # conflict and the whole entry was skipped above.
                    with open(target, "wb") as handle:
                        handle.write(injected)
                    shutil.copymode(source, target)
                    if sha256_file(target) != sha256_bytes(injected):
                        print("error: copy fidelity check failed: %s"
                              % target, file=sys.stderr)
                        return 1
                    copied += 1
                else:
                    # scan_entry just hash-verified this file as
                    # identical (pristine, or already injected).
                    same += 1
                continue
            os.makedirs(target.parent, exist_ok=True)
            if injected is not None:
                with open(target, "wb") as handle:
                    handle.write(injected)
            else:
                shutil.copyfile(source, target)
            # Preserve the source permission bits (an executable script
            # must land executable); bytes are verified by hash below.
            shutil.copymode(source, target)
            expected = sha256_bytes(injected) if injected is not None \
                else sha256_file(source)
            if sha256_file(target) != expected:
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
            record = injections.get(key)
            if record is not None and record["_source"] in transforms:
                target = dest / row["_resolved"].name / record["_rel"]
                if target.is_file() and sha256_file(target) \
                        == sha256_bytes(transforms[record["_source"]]):
                    entry["frontmatter_injected"] = {
                        "file": str(target.relative_to(dest)),
                        "fields_added": record["fields_added"],
                        "name_written": record["_written_name"],
                        "draft_name": record["draft_name"],
                        "source_modified": False,
                    }
                    if record.get("notes"):
                        entry["frontmatter_injected"]["note"] = \
                            record["notes"]
                    print("%s: frontmatter injected into %s (name + "
                          "description only; the repository copy is "
                          "unmodified — see receipt)"
                          % (key, target.relative_to(dest)))
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
        "injected_frontmatter": [
            dict({"name": r["name"], "pack": r.get("pack")},
                 **r["frontmatter_injected"])
            for r in results if r.get("frontmatter_injected")
        ],
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
