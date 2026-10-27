#!/usr/bin/env python3
"""Bootstrap for The Agent Call Sheet.

Copies the front door plus the Rigor core set (and any packs selected with
--packs) from this repository into a skills folder. Standard library only.
This script fetches nothing and executes nothing: it only reads the
manifest, copies files, checks sha256 copy fidelity, optionally writes
per-entry zip bundles, and writes an install receipt.

Crew modes: --template <name> installs a named crew from
front-door/templates/ instead of the pack selection, --import-crew <file>
installs the crew a crew file describes, and --export-crew <file> /
--export-paperclip <dir> write the current selection (default, --packs,
--template, or --import-crew) as a crew file or as a Paperclip team
directory, then exit without installing. The crew modes also fetch
nothing and execute nothing.

One disclosed exception to byte-identical copying: the SKILL.md files
listed in frontmatter-injections.json ship without frontmatter, so the
installed/bundled copy gains a drafted name + description block (the
repository copy is never modified). Every injection is printed as it
happens and recorded in the receipt / bundle disclosure member.

A second disclosed exception, bundle exports only: the bundle copy of
an entry's root SKILL.md is normalised for strict upload surfaces
under bundle-normalisation.json (frontmatter keys outside the Agent
Skills spec are removed, display names that are not valid skill IDs
are replaced with valid IDs, and the listed unparseable descriptions
are double-quoted; the repository copy is never modified). Every
normalisation is printed as it happens, disclosed in the zip's
BUNDLE-NORMALISATION.md member, and, in a combined bundle + install
run, recorded in the receipt.

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
INJECTION_TOP_KEYS = {"version", "about", "naming_rule", "injections"}
INJECTION_ROW_KEYS = {
    "entry", "pack", "local_path", "file", "draft_name", "description",
    "fields_added", "name_override", "name_override_reason", "naming_note",
    "notes", "omitted_upstream_fields",
}
NORMALISATION_NAME = "bundle-normalisation.json"
NORMALISATION_NOTE_NAME = "BUNDLE-NORMALISATION.md"
NORMALISATION_TOP_KEYS = {"version", "about", "spec_keys",
                          "reserved_name_words", "name_overrides",
                          "yaml_repairs", "layout_exclusions"}
NORMALISATION_SPEC_KEYS = {"name", "description", "license",
                           "compatibility", "metadata", "allowed-tools"}
NORMALISATION_RESERVED = {"anthropic", "claude"}
NORMALISATION_OVERRIDE_ROW_KEYS = {"entry", "name", "reason"}
NORMALISATION_REPAIR_ROW_KEYS = {"entry", "file", "fix", "reason"}
NORMALISATION_EXCLUSION_ROW_KEYS = {"entry", "reason"}
TARGET_GUIDES = {
    "claude-web": "front-door/install/claude-web.md",
    "grok-build": "front-door/install/grok-build.md",
    "prompt-only": "front-door/install/prompt-only.md",
}
CREW_SCHEMA = 1
CREW_TOP_KEYS = {"crew_schema", "name", "description", "when_to_use",
                 "members", "routines"}
CREW_MEMBER_KEYS = {"entry", "role"}
CREW_ROUTINE_KEYS = {"name", "description"}
TEMPLATES_DIR = Path("front-door") / "templates"


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
    except (OSError, ValueError, RecursionError) as exc:
        raise BootstrapError("cannot parse %s: %s" % (INJECTIONS_NAME, exc))
    if not isinstance(data, dict) \
            or not isinstance(data.get("injections"), list):
        raise BootstrapError(
            "%s: expected an object with an 'injections' list"
            % INJECTIONS_NAME)
    unknown_top = sorted(set(data) - INJECTION_TOP_KEYS)
    if unknown_top:
        raise BootstrapError(
            "%s: unknown top-level key %r" % (INJECTIONS_NAME, unknown_top[0]))
    missing_top = sorted(INJECTION_TOP_KEYS - set(data))
    if missing_top:
        raise BootstrapError(
            "%s: missing top-level key %r" % (INJECTIONS_NAME, missing_top[0]))
    if not isinstance(data.get("version"), int) \
            or isinstance(data.get("version"), bool):
        raise BootstrapError(
            "%s: 'version' must be an integer" % INJECTIONS_NAME)
    if not isinstance(data.get("about"), str):
        raise BootstrapError(
            "%s: 'about' must be a string" % INJECTIONS_NAME)
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
        unknown_row = sorted(set(item) - INJECTION_ROW_KEYS)
        if unknown_row:
            raise BootstrapError(
                "%s: injection row for %r has unknown key %r"
                % (INJECTIONS_NAME, item.get("entry"), unknown_row[0]))
        for field in ("entry", "local_path", "file", "draft_name",
                      "description", "fields_added"):
            if field not in item:
                raise BootstrapError(
                    "%s: injection row missing %r" % (INJECTIONS_NAME, field))
        for field in ("entry", "file", "draft_name"):
            if not isinstance(item[field], str):
                raise BootstrapError(
                    "%s: entry %r: %r must be a string"
                    % (INJECTIONS_NAME, item["entry"], field))
        if "name_override" in item \
                and not isinstance(item["name_override"], str):
            raise BootstrapError(
                "%s: entry %r: 'name_override' must be a string"
                % (INJECTIONS_NAME, item["entry"]))
        if "omitted_upstream_fields" in item:
            omitted_list = item["omitted_upstream_fields"]
            if not isinstance(omitted_list, list):
                raise BootstrapError(
                    "%s: entry %r: 'omitted_upstream_fields' must be a list"
                    % (INJECTIONS_NAME, item["entry"]))
            for omitted in omitted_list:
                if not isinstance(omitted, dict) \
                        or not isinstance(omitted.get("field"), str):
                    raise BootstrapError(
                        "%s: entry %r: 'omitted_upstream_fields' entries "
                        "must be objects with a string 'field'"
                        % (INJECTIONS_NAME, item["entry"]))
                if "upstream_value" in omitted and not isinstance(
                        omitted["upstream_value"], (str, bool)):
                    raise BootstrapError(
                        "%s: entry %r: 'upstream_value' for omitted field "
                        "%r must be a string or boolean"
                        % (INJECTIONS_NAME, item["entry"], omitted["field"]))
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
    generic_tail = (
        "content; the installed name is the recorded name_override, "
        "not the installed folder name."
        if record.get("name_override") else
        "content; the installed name is the installed folder name.")
    lines += [
        "```yaml",
        record["_block"].decode("utf-8").rstrip("\n"),
        "```",
        "",
        "The block text lives in `frontmatter-injections.json` in the",
        "repository (manifest layer), drafted from the file's own",
        generic_tail,
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


def slugify(name):
    """Pinned slugifier: lowercase, replace each maximal run of
    characters outside [a-z0-9] with one hyphen, strip leading and
    trailing hyphens, truncate to 64 then strip trailing hyphen."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:64].rstrip("-")


def produced_name_ok(name):
    return bool(re.fullmatch(r"[a-z0-9-]{1,64}", name)) \
        and "anthropic" not in name and "claude" not in name


def load_bundle_normalisation(root, rows):
    """Load bundle-normalisation.json and validate it against the
    manifest. Returns {"spec_keys": set, "overrides": {entry: name},
    "repairs": {entry: record}, "exclusions": {entry: reason}}.
    Fail-closed, mirroring load_injections: a symlink, missing or
    unparseable file, unknown keys, duplicate rows, spec_keys or
    reserved words differing from the pinned documented values, or a
    row naming a non-included entry (or, for overrides/repairs, an
    entry with no root SKILL.md) all abort the run."""
    path = root / NORMALISATION_NAME
    if path.is_symlink() or not path.is_file():
        raise BootstrapError(
            "%s missing or a symlink: %s" % (NORMALISATION_NAME, path))
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError) as exc:
        raise BootstrapError("cannot parse %s: %s" % (NORMALISATION_NAME, exc))
    if not isinstance(data, dict):
        raise BootstrapError(
            "%s: expected an object" % NORMALISATION_NAME)
    unknown_top = sorted(set(data) - NORMALISATION_TOP_KEYS)
    if unknown_top:
        raise BootstrapError(
            "%s: unknown top-level key %r" % (NORMALISATION_NAME, unknown_top[0]))
    missing_top = sorted(NORMALISATION_TOP_KEYS - set(data))
    if missing_top:
        raise BootstrapError(
            "%s: missing top-level key %r" % (NORMALISATION_NAME, missing_top[0]))
    if not isinstance(data.get("version"), int) \
            or isinstance(data.get("version"), bool):
        raise BootstrapError(
            "%s: 'version' must be an integer" % NORMALISATION_NAME)
    if not isinstance(data.get("about"), str):
        raise BootstrapError(
            "%s: 'about' must be a string" % NORMALISATION_NAME)
    spec = data.get("spec_keys")
    if not isinstance(spec, list) \
            or not all(isinstance(x, str) for x in spec) \
            or set(spec) != NORMALISATION_SPEC_KEYS \
            or len(spec) != len(NORMALISATION_SPEC_KEYS):
        raise BootstrapError(
            "%s: spec_keys must equal the pinned documented values %s"
            % (NORMALISATION_NAME, sorted(NORMALISATION_SPEC_KEYS)))
    reserved = data.get("reserved_name_words")
    if not isinstance(reserved, list) \
            or not all(isinstance(x, str) for x in reserved) \
            or set(reserved) != NORMALISATION_RESERVED \
            or len(reserved) != len(NORMALISATION_RESERVED):
        raise BootstrapError(
            "%s: reserved_name_words must equal the pinned documented "
            "values %s" % (NORMALISATION_NAME, sorted(NORMALISATION_RESERVED)))
    for section in ("name_overrides", "yaml_repairs", "layout_exclusions"):
        if not isinstance(data.get(section), list):
            raise BootstrapError(
                "%s: %r must be a list" % (NORMALISATION_NAME, section))
    by_name = {row["name"]: row for row in rows}

    def included_row(entry, section):
        row = by_name.get(entry)
        if row is None or row["distribution"] != "include":
            raise BootstrapError(
                "%s: %s row %r is not an included manifest entry"
                % (NORMALISATION_NAME, section, entry))
        return row

    def check_rows(section, row_keys):
        seen = set()
        for item in data[section]:
            if not isinstance(item, dict):
                raise BootstrapError(
                    "%s: %s row is not an object" % (NORMALISATION_NAME, section))
            unknown_row = sorted(set(item) - row_keys)
            if unknown_row:
                raise BootstrapError(
                    "%s: %s row for %r has unknown key %r"
                    % (NORMALISATION_NAME, section, item.get("entry"),
                       unknown_row[0]))
            missing_row = sorted(row_keys - set(item))
            if missing_row:
                raise BootstrapError(
                    "%s: %s row missing %r"
                    % (NORMALISATION_NAME, section, missing_row[0]))
            for field in item:
                if not isinstance(item[field], str):
                    raise BootstrapError(
                        "%s: %s row for %r: %r must be a string"
                        % (NORMALISATION_NAME, section, item.get("entry"), field))
            if item["entry"] in seen:
                raise BootstrapError(
                    "%s: duplicate %s row for %r"
                    % (NORMALISATION_NAME, section, item["entry"]))
            seen.add(item["entry"])
            yield item

    overrides = {}
    for item in check_rows("name_overrides", NORMALISATION_OVERRIDE_ROW_KEYS):
        row = included_row(item["entry"], "name_overrides")
        if Path("SKILL.md") not in row["_files"]:
            raise BootstrapError(
                "%s: name_overrides row for %r has no root SKILL.md"
                % (NORMALISATION_NAME, item["entry"]))
        if not produced_name_ok(item["name"]):
            raise BootstrapError(
                "%s: name_override %r for %r is not a valid skill name"
                % (NORMALISATION_NAME, item["name"], item["entry"]))
        overrides[item["entry"]] = item["name"]
    repairs = {}
    for item in check_rows("yaml_repairs", NORMALISATION_REPAIR_ROW_KEYS):
        row = included_row(item["entry"], "yaml_repairs")
        if Path("SKILL.md") not in row["_files"]:
            raise BootstrapError(
                "%s: yaml_repairs row for %r has no root SKILL.md"
                % (NORMALISATION_NAME, item["entry"]))
        if item["fix"] != "quote-description":
            raise BootstrapError(
                "%s: yaml_repairs row for %r has unknown fix %r"
                % (NORMALISATION_NAME, item["entry"], item["fix"]))
        if item["file"] != "SKILL.md" or Path(item["file"]) not in row["_files"]:
            raise BootstrapError(
                "%s: yaml_repairs row for %r: file %r is not its root "
                "SKILL.md" % (NORMALISATION_NAME, item["entry"], item["file"]))
        repairs[item["entry"]] = dict(item)
    exclusions = {}
    for item in check_rows("layout_exclusions", NORMALISATION_EXCLUSION_ROW_KEYS):
        row = included_row(item["entry"], "layout_exclusions")
        if Path("SKILL.md") in row["_files"]:
            raise BootstrapError(
                "%s: layout_exclusions row for %r has a root SKILL.md; "
                "it is a skill, not a layout exclusion"
                % (NORMALISATION_NAME, item["entry"]))
        exclusions[item["entry"]] = item["reason"]
    for entry in exclusions:
        if entry in overrides or entry in repairs:
            raise BootstrapError(
                "%s: entry %r is in layout_exclusions and also in "
                "name_overrides/yaml_repairs" % (NORMALISATION_NAME, entry))
    return {"spec_keys": set(spec), "overrides": overrides,
            "repairs": repairs, "exclusions": exclusions}


_FM_KEY_RE = re.compile(r"^([A-Za-z0-9_-]+):")


def _fm_blocks(fm_lines):
    """Top-level key blocks of a frontmatter line list. A key line
    matches ^[A-Za-z0-9_-]+: at column 0; a block continues over
    following lines that start with space/tab, start with '- ', or
    are blank. Duplicate keys, or any other line shape, abort."""
    blocks = []
    seen = set()
    current = None
    for idx, line in enumerate(fm_lines):
        match = _FM_KEY_RE.match(line)
        if match:
            key = match.group(1)
            if key in seen:
                raise BootstrapError(
                    "duplicate top-level frontmatter key %r" % key)
            seen.add(key)
            current = {"key": key, "start": idx, "end": idx + 1}
            blocks.append(current)
        elif line.startswith((" ", "\t")) or line.startswith("- ") \
                or line == "":
            if current is None:
                if line.strip():
                    raise BootstrapError(
                        "non-blank line before the first frontmatter "
                        "key: %r" % line)
            else:
                current["end"] = idx + 1
        else:
            raise BootstrapError(
                "unrecognised line inside frontmatter: %r" % line)
    return blocks


def _split_frontmatter(text):
    """Split on '\\n' (lossless); require line[0] == '---' and a later
    line exactly '---'. Returns (fm_lines, blocks, body) where body is
    the exact remainder after the closing --- line."""
    lines = text.split("\n")
    if not lines or lines[0] != "---":
        raise BootstrapError("SKILL.md has no frontmatter block")
    closing = None
    for idx in range(1, len(lines)):
        if lines[idx] == "---":
            closing = idx
            break
    if closing is None:
        raise BootstrapError("SKILL.md frontmatter block is not closed")
    fm_lines = lines[1:closing]
    blocks = _fm_blocks(fm_lines)
    body = "\n".join(lines[closing + 1:])
    return fm_lines, blocks, body


def _fm_scalar(fm_lines, block):
    """Scalar value of a 1-line block. Double-quoted values are decoded
    with json.loads; single-quoted values by stripping the quotes and
    un-doubling ''. A block value (empty first-line value) aborts."""
    if block["end"] - block["start"] != 1:
        raise BootstrapError(
            "frontmatter key %r is not a single line" % block["key"])
    line = fm_lines[block["start"]]
    value = line[len(block["key"]) + 1:].strip()
    if value == "":
        raise BootstrapError(
            "frontmatter key %r has a block value, not a scalar"
            % block["key"])
    if value.startswith('"'):
        try:
            result = json.loads(value)
        except ValueError as exc:
            raise BootstrapError(
                "frontmatter key %r: cannot decode double-quoted "
                "scalar: %s" % (block["key"], exc))
        if not isinstance(result, str):
            raise BootstrapError(
                "frontmatter key %r: double-quoted scalar is not a "
                "string" % block["key"])
    elif value.startswith("'"):
        if len(value) < 2 or not value.endswith("'"):
            raise BootstrapError(
                "frontmatter key %r: malformed single-quoted scalar"
                % block["key"])
        result = value[1:-1].replace("''", "'")
    else:
        result = value
    if any(0xD800 <= ord(char) <= 0xDFFF for char in result):
        raise BootstrapError(
            "frontmatter key %r: scalar contains a lone surrogate, "
            "which is not valid text" % block["key"])
    return result


def _fm_name(text):
    """The name scalar of a frontmatter text, via the same helpers."""
    fm_lines, blocks, _body = _split_frontmatter(text)
    for block in blocks:
        if block["key"] == "name":
            return _fm_scalar(fm_lines, block)
    raise BootstrapError("SKILL.md frontmatter has no name key")


def normalise_bundle_skill(raw_bytes, row, norm):
    """Normalise the bundle copy of an entry's root SKILL.md.
    Returns (new_bytes, changes, final_name); when changes is empty
    the original bytes are returned unchanged. Changes are tuples:
    ("yaml_repair", reason), ("keys_removed", [key, ...]),
    ("name", old, new). Unmeasured shapes fail closed."""
    entry = row["name"]
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BootstrapError(
            "SKILL.md for %r is not valid UTF-8: %s" % (entry, exc))
    fm_lines, blocks, body = _split_frontmatter(text)
    work = list(fm_lines)
    changes = []
    if entry in norm["repairs"]:
        record = norm["repairs"][entry]
        desc = next((b for b in blocks if b["key"] == "description"), None)
        if desc is None:
            raise BootstrapError(
                "yaml repair for %r: no description key" % entry)
        if desc["end"] - desc["start"] != 1:
            raise BootstrapError(
                "yaml repair for %r: description is not a single line"
                % entry)
        line = work[desc["start"]]
        value = line[len("description") + 1:].strip()
        if not value or value[0] in "\"'>|" or value != value.strip() \
                or ": " not in value:
            raise BootstrapError(
                "yaml repair for %r: description is not a plain "
                "scalar containing ': ' (already quoted, a block "
                "scalar, or already valid); data/reality mismatch"
                % entry)
        work[desc["start"]] = "description: " + json.dumps(value)
        changes.append(("yaml_repair", record["reason"]))
        blocks = _fm_blocks(work)
    removed = [b["key"] for b in blocks if b["key"] not in norm["spec_keys"]]
    drop = set()
    for block in blocks:
        if block["key"] not in norm["spec_keys"]:
            drop.update(range(block["start"], block["end"]))
    if removed:
        changes.append(("keys_removed", removed))
    name_block = next((b for b in blocks if b["key"] == "name"), None)
    if name_block is None:
        raise BootstrapError("SKILL.md for %r has no name key" % entry)
    current = _fm_scalar(work, name_block)
    if not produced_name_ok(current):
        new_name = norm["overrides"].get(entry) or slugify(current)
        if not produced_name_ok(new_name):
            raise BootstrapError(
                "normalised name %r for %r is not a valid skill name"
                % (new_name, entry))
        work[name_block["start"]] = "name: " + new_name
        changes.append(("name", current, new_name))
        final_name = new_name
    else:
        final_name = current
    if not changes:
        return raw_bytes, [], final_name
    kept = [work[i] for i in range(len(work)) if i not in drop]
    new_text = "---\n" + "\n".join(kept) + "\n---\n" + body
    return new_text.encode("utf-8"), changes, final_name


def normalisation_note_text(row, changes):
    """Deterministic disclosure member written into a bundle zip whose
    SKILL.md was normalised (no timestamp, so bundle hashes stay
    stable across re-runs)."""
    folder = row["_resolved"].name
    lines = [
        "# Bundle normalisation disclosure",
        "",
        "File: `%s/SKILL.md`" % folder,
        "",
        "This bundle's `SKILL.md` differs from the copy in the repository:",
        "the bundle copy was normalised for strict upload surfaces, which",
        "reject skills whose frontmatter does not meet the documented",
        "upload rules. The repository copy is unmodified.",
        "",
        "Changes made to this bundle copy only:",
        "",
    ]
    for change in changes:
        if change[0] == "name":
            lines.append(
                "- name: %s -> `%s` (the original display name is "
                "preserved in this note; uploads require lowercase "
                "letters, numbers and hyphens)"
                % (json.dumps(change[1]), change[2]))
        elif change[0] == "keys_removed":
            lines.append(
                "- frontmatter keys removed: %s (present in the "
                "repository copy; packaging rejects keys outside the "
                "Agent Skills spec: name, description, license, "
                "compatibility, metadata, allowed-tools)"
                % ", ".join(change[1]))
        elif change[0] == "yaml_repair":
            lines.append(
                "- YAML repair: the description was a plain scalar "
                "containing ': ', which does not parse; in this copy "
                "it is double-quoted, its text unchanged (reason "
                "recorded in bundle-normalisation.json)")
    lines += [
        "",
        "The data driving this normalisation lives in "
        "`bundle-normalisation.json` in the repository.",
    ]
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
            "nothing. --template/--import-crew select a crew instead of "
            "the pack selection; --export-crew/--export-paperclip write "
            "the current selection and exit without installing. "
            "Non-Claude targets are staged into "
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
    parser.add_argument("--template", default=None, metavar="NAME",
                        help=("install the named crew template from "
                              "front-door/templates/ (e.g. review-crew) "
                              "instead of the pack selection; cannot be "
                              "combined with --packs"))
    parser.add_argument("--import-crew", default=None, metavar="FILE",
                        help=("install the crew described by a crew file "
                              "(the schema --export-crew writes); cannot "
                              "be combined with --template or --packs"))
    parser.add_argument("--export-crew", default=None, metavar="FILE",
                        help=("write the current selection (default, "
                              "--packs, --template, or --import-crew) as "
                              "a crew file, then exit without installing"))
    parser.add_argument("--export-paperclip", default=None, metavar="DIR",
                        help=("write the current selection as a Paperclip "
                              "team directory under DIR/<crew-slug>/, then "
                              "exit without installing; refuses if that "
                              "directory already exists"))
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


def load_crew(path, rows):
    """Load and validate a crew file (a shipped template or a file given
    to --import-crew / produced by --export-crew). Fail closed, before
    anything is written: the file must exist and not be a symlink, parse
    as a JSON object with no unknown keys, carry crew_schema 1, a name
    of at most 64 characters, and a non-empty members list whose entries
    exactly match manifest names, with no duplicates and roles of at
    most 64 characters. Returns the normalised crew dict."""
    label = "crew file %s" % path
    if path.is_symlink() or not path.is_file():
        raise BootstrapError("%s missing or a symlink: %s" % (label, path))
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BootstrapError("cannot parse %s: %s" % (label, exc))
    if not isinstance(data, dict):
        raise BootstrapError("%s: expected a JSON object" % label)
    unknown_top = sorted(set(data) - CREW_TOP_KEYS)
    if unknown_top:
        raise BootstrapError(
            "%s: unknown top-level key %r" % (label, unknown_top[0]))
    for field in ("crew_schema", "name", "members"):
        if field not in data:
            raise BootstrapError("%s: missing %r" % (label, field))
    if data["crew_schema"] != CREW_SCHEMA \
            or isinstance(data["crew_schema"], bool):
        raise BootstrapError(
            "%s: crew_schema must be %d, got %r"
            % (label, CREW_SCHEMA, data["crew_schema"]))
    name = data["name"]
    if not isinstance(name, str) or not name.strip():
        raise BootstrapError("%s: 'name' must be a non-empty string" % label)
    if len(name) > 64:
        raise BootstrapError(
            "%s: crew name %r is longer than 64 characters" % (label, name))
    crew = {"name": name, "description": "", "when_to_use": "",
            "members": [], "routines": []}
    for field in ("description", "when_to_use"):
        if field in data:
            if not isinstance(data[field], str):
                raise BootstrapError(
                    "%s: %r must be a string" % (label, field))
            crew[field] = data[field]
    if not isinstance(data["members"], list) or not data["members"]:
        raise BootstrapError("%s: 'members' must be a non-empty list" % label)
    by_name = {row["name"]: row for row in rows}
    seen = set()
    for item in data["members"]:
        if not isinstance(item, dict):
            raise BootstrapError("%s: member is not an object: %r"
                                 % (label, item))
        unknown_member = sorted(set(item) - CREW_MEMBER_KEYS)
        if unknown_member:
            raise BootstrapError(
                "%s: member %r has unknown key %r"
                % (label, item.get("entry"), unknown_member[0]))
        entry = item.get("entry")
        if not isinstance(entry, str) or not entry:
            raise BootstrapError(
                "%s: member 'entry' must be a non-empty string" % label)
        if entry not in by_name:
            raise BootstrapError(
                "%s: unknown entry %r (not a manifest name)" % (label, entry))
        if entry in seen:
            raise BootstrapError(
                "%s: duplicate member %r" % (label, entry))
        seen.add(entry)
        role = item.get("role", "")
        if not isinstance(role, str):
            raise BootstrapError(
                "%s: role for %r must be a string" % (label, entry))
        if len(role) > 64:
            raise BootstrapError(
                "%s: role for %r is longer than 64 characters"
                % (label, entry))
        crew["members"].append({"entry": entry, "role": role})
    if "routines" in data:
        if not isinstance(data["routines"], list):
            raise BootstrapError("%s: 'routines' must be a list" % label)
        for item in data["routines"]:
            if not isinstance(item, dict):
                raise BootstrapError(
                    "%s: routine is not an object: %r" % (label, item))
            unknown_routine = sorted(set(item) - CREW_ROUTINE_KEYS)
            if unknown_routine:
                raise BootstrapError(
                    "%s: routine %r has unknown key %r"
                    % (label, item.get("name"), unknown_routine[0]))
            for field in ("name", "description"):
                if not isinstance(item.get(field), str) \
                        or not item[field].strip():
                    raise BootstrapError(
                        "%s: routine %r must be a non-empty string"
                        % (label, field))
            crew["routines"].append({"name": item["name"],
                                     "description": item["description"]})
    return crew


def crew_scope(rows, crew):
    """The crew counterpart of compute_scope: the same
    (scope_packs, included, not_installed, practice) shape, driven by
    the crew's members in crew order, whatever pack each member is in.
    Link-only and practice members land in the same not_installed /
    practice lists the pack path fills, so banners and the receipt
    treat both selections alike, and included members feed the same
    injection, bundle, and install paths."""
    by_name = {row["name"]: row for row in rows}
    included, not_installed, practice, scope_packs = [], [], [], []
    for member in crew["members"]:
        row = by_name[member["entry"]]
        if row["pack"] not in scope_packs:
            scope_packs.append(row["pack"])
        if row["distribution"] == "include":
            included.append(row)
        elif row["distribution"] == "link-only":
            not_installed.append(row)
        else:
            practice.append(row)
    return scope_packs, included, not_installed, practice


def current_selection(rows, crew, scope_packs, selected_packs):
    """The selection as a crew-shaped dict: name, description,
    when_to_use, ordered members (each with its manifest row and role),
    and routines. A crew-driven selection keeps the crew's name, roles,
    and routines; a pack/default selection gets role "" members, no
    routines, and the export name from the plan ('custom-<packs>' or
    'default-crew')."""
    by_name = {row["name"]: row for row in rows}
    if crew is not None:
        return {
            "name": crew["name"],
            "description": crew["description"],
            "when_to_use": crew["when_to_use"],
            "members": [{"entry": m["entry"], "role": m["role"],
                         "row": by_name[m["entry"]]}
                        for m in crew["members"]],
            "routines": crew["routines"],
        }
    name = ("custom-" + "-".join(selected_packs)) if selected_packs \
        else "default-crew"
    return {
        "name": name,
        "description": "",
        "when_to_use": "",
        "members": [{"entry": row["name"], "role": "", "row": row}
                    for row in rows if row["pack"] in scope_packs],
        "routines": [],
    }


def selection_crew_dict(selection):
    """The crew-file dict for a selection (--export-crew output is the
    same schema --import-crew consumes). Members always carry a role;
    routines are present only when the selection has them."""
    data = {
        "crew_schema": CREW_SCHEMA,
        "name": selection["name"],
        "description": selection["description"],
        "when_to_use": selection["when_to_use"],
        "members": [{"entry": m["entry"], "role": m["role"]}
                    for m in selection["members"]],
    }
    if selection["routines"]:
        data["routines"] = selection["routines"]
    return data


def guard_export_path(path, root, label):
    """Refuse an export target that is a symlink or resolves inside the
    repository tree: exports are user files, not repo content, so the
    staging exceptions guard_output_path allows do not apply here.
    Returns an error string or None."""
    if path.is_symlink():
        return "%s is a symlink; refusing to follow it: %s" % (label, path)
    resolved = path.resolve()
    if resolved == root or root in resolved.parents:
        return ("%s must not be inside the repository: %s"
                % (label, resolved))
    return None


def slugify_name(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "crew"


def yaml_scalar(value):
    """A YAML scalar for a generated frontmatter value: plain when the
    value is plainly safe, a JSON double-quoted string otherwise (valid
    YAML double-quoted style, as in frontmatter_block)."""
    if value and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.'\-]*", value):
        return value
    return json.dumps(value)


def strip_frontmatter(text):
    """Remove a leading YAML frontmatter block (--- ... ---) from a
    member's SKILL.md text, returning the body. Text without a block is
    returned unchanged."""
    if not text.startswith("---"):
        return text
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return text
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return "".join(lines[idx + 1:]).lstrip("\n")
    return text


def paperclip_member_kind(row):
    """How a selection member maps into a Paperclip team directory:
    link-only and practice rows are not exported as files at all; an
    included member with no root SKILL.md is a reference; a skill-type
    member is a skill; anything else included is an agent."""
    if row["distribution"] == "link-only":
        return "link-only"
    if row["distribution"] != "include":
        return "practice"
    if Path("SKILL.md") not in row["_files"]:
        return "reference"
    if row["type"] == "skill":
        return "skill"
    return "agent"


def export_paperclip(root, base_dir, selection):
    """Write a Paperclip team directory for the selection into
    <base_dir>/<slug>/ and return the target path. The export builds in
    a temp sibling directory and renames it into place (A4); an
    existing target is refused, never overwritten or merged (C3). No
    .paperclip.yaml is written: the catalog manifest is generated by a
    Paperclip server, not by this export."""
    label = "--export-paperclip target"
    if base_dir.is_symlink():
        raise BootstrapError(
            "--export-paperclip dir is a symlink; refusing: %s" % base_dir)
    if base_dir.exists() and not base_dir.is_dir():
        raise BootstrapError(
            "--export-paperclip dir exists and is not a folder: %s"
            % base_dir)
    slug = slugify_name(selection["name"])
    target = base_dir / slug
    problem = guard_export_path(target, root, label)
    if problem is not None:
        raise BootstrapError(problem)
    if target.is_symlink() or target.exists():
        raise BootstrapError(
            "%s already exists, refusing to overwrite or merge: %s"
            % (label, target))

    members = []
    for member in selection["members"]:
        row = member["row"]
        kind = paperclip_member_kind(row)
        folder = row["_resolved"].name if kind in (
            "agent", "skill", "reference") else None
        members.append(dict(member, kind=kind, folder=folder))
    # Manager (A1): the member whose role is exactly "Coordinator" if
    # exactly one, else the first member.
    coordinators = [m for m in members if m["role"] == "Coordinator"]
    manager = coordinators[0] if len(coordinators) == 1 else members[0]
    manager_slug = manager["folder"] or slugify_name(manager["entry"])
    manager_rel = {
        "agent": "agents/%s/AGENTS.md" % manager["folder"],
        "skill": "skills/%s" % manager["folder"],
        "reference": "references/%s" % manager["folder"],
    }.get(manager["kind"], "TEAM.md")
    skill_slugs = [m["folder"] for m in members if m["kind"] == "skill"]

    os.makedirs(base_dir, exist_ok=True)
    staging = _tmp_sibling(target)
    if staging.is_symlink() or staging.exists():
        raise BootstrapError(
            "temporary Paperclip export path already exists: %s" % staging)
    os.makedirs(staging)

    def write_text(rel, text):
        dest = staging / rel
        os.makedirs(dest.parent, exist_ok=True)
        dest.write_text(text, encoding="utf-8")

    def copy_member(rel_dir, row):
        for rel in row["_files"]:
            dest = staging / rel_dir / rel
            os.makedirs(dest.parent, exist_ok=True)
            shutil.copyfile(row["_resolved"] / rel, dest)

    try:
        for member in members:
            row, kind, folder = member["row"], member["kind"], \
                member["folder"]
            if kind == "agent":
                body = strip_frontmatter(
                    (row["_resolved"] / "SKILL.md").read_text(
                        encoding="utf-8"))
                lines = ["---",
                         "name: %s" % yaml_scalar(member["entry"]),
                         "slug: %s" % yaml_scalar(folder),
                         "title: %s" % yaml_scalar(member["role"])]
                if member is not manager:
                    lines.append("reportsTo: %s" % yaml_scalar(manager_slug))
                elif skill_slugs:
                    lines.append("skills:")
                    lines += ["  - %s" % s for s in skill_slugs]
                lines.append("---")
                write_text(Path("agents") / folder / "AGENTS.md",
                           "\n".join(lines) + "\n\n" + body)
            elif kind == "skill":
                copy_member(Path("skills") / folder, row)
            elif kind == "reference":
                copy_member(Path("references") / folder, row)

        team_lines = [
            "---",
            "schema: agentcompanies/v1",
            "name: %s" % yaml_scalar(selection["name"]),
            "slug: %s" % yaml_scalar(slug),
            "manager: %s" % manager_rel,
            "---",
            "",
            "# %s" % selection["name"],
            "",
        ]
        if selection["description"]:
            team_lines += [selection["description"], ""]
        if selection["when_to_use"]:
            team_lines += ["## When to use", "", selection["when_to_use"],
                           ""]
        team_lines += ["## Members", ""]
        for member in members:
            role = member["role"] or "member"
            if member["kind"] == "agent":
                where = "`agents/%s/AGENTS.md`" % member["folder"]
            elif member["kind"] == "skill":
                where = "`skills/%s/`" % member["folder"]
            elif member["kind"] == "reference":
                where = ("reference member: `references/%s/`"
                         % member["folder"])
            elif member["kind"] == "link-only":
                where = ("external pointer (link-only, not exported): %s"
                         % member["row"]["source_url"])
            else:
                where = ("practice described in the kit doc only; "
                         "nothing to export")
            team_lines.append("- %s — %s — %s"
                              % (member["entry"], role, where))
        team_lines.append("")
        if selection["routines"]:
            team_lines += ["## Routines", ""]
            for routine in selection["routines"]:
                team_lines.append("- %s — %s"
                                  % (routine["name"],
                                     routine["description"]))
            team_lines.append("")
        write_text("TEAM.md", "\n".join(team_lines))

        project_lines = [
            "---",
            "schema: agentcompanies/v1",
            "name: %s" % yaml_scalar(selection["name"]),
            "slug: %s" % yaml_scalar(slug),
            "---",
            "",
            "# %s" % selection["name"],
            "",
        ]
        if selection["description"]:
            project_lines += [selection["description"], ""]
        if selection["when_to_use"]:
            project_lines += [selection["when_to_use"], ""]
        write_text(Path("projects") / slug / "PROJECT.md",
                   "\n".join(project_lines))

        for routine in selection["routines"]:
            routine_slug = slugify_name(routine["name"])
            task_lines = [
                "---",
                "schema: agentcompanies/v1",
                "name: %s" % yaml_scalar(routine["name"]),
                "slug: %s" % yaml_scalar(routine_slug),
                "project: %s" % yaml_scalar(slug),
                "status: todo",
                "---",
                "",
                "# %s" % routine["name"],
                "",
                routine["description"],
                "",
            ]
            write_text(Path("tasks") / routine_slug / "TASK.md",
                       "\n".join(task_lines))
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    if target.is_symlink() or target.exists():
        shutil.rmtree(staging, ignore_errors=True)
        raise BootstrapError(
            "%s already exists, refusing to overwrite or merge: %s"
            % (label, target))
    os.rename(staging, target)
    return target


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


def write_bytes_atomic(path, data):
    """Write bytes via a temp file in the same dir + os.replace, with the
    same exclusive-temp discipline as write_receipt_atomic."""
    tmp = _tmp_sibling(path)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL
                 | getattr(os, "O_NOFOLLOW", 0), 0o644)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(tmp, path)
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
                       ("--bundle", args.bundle),
                       ("--template", args.template),
                       ("--import-crew", args.import_crew),
                       ("--export-crew", args.export_crew),
                       ("--export-paperclip", args.export_paperclip)):
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

    if args.import_crew and (args.template or args.packs):
        print("error: --import-crew cannot be combined with --template "
              "or --packs", file=sys.stderr)
        return 1
    if args.template and args.packs:
        print("error: --template cannot be combined with --packs",
              file=sys.stderr)
        return 1

    crew = None
    crew_origin = None
    if args.template:
        if not re.fullmatch(r"[a-z0-9-]+", args.template):
            print("error: invalid template name %r (lowercase letters, "
                  "numbers, hyphens)" % args.template, file=sys.stderr)
            return 1
        crew = load_crew(root / TEMPLATES_DIR / (args.template + ".json"),
                         rows)
        if crew["name"] != args.template:
            raise BootstrapError(
                "template file for %r describes crew %r; refusing to "
                "install it under the wrong name"
                % (args.template, crew["name"]))
        crew_origin = "template"
    elif args.import_crew:
        crew = load_crew(Path(args.import_crew).expanduser(), rows)
        crew_origin = "file"

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
    exports_present = args.export_crew is not None \
        or args.export_paperclip is not None
    bundle_only = args.bundle is not None and not dest_explicit
    bundle_dir = Path(args.bundle) if args.bundle is not None else None

    # Refuse output paths that resolve into the repo's tracked content,
    # before anything is written. Containment is judged on the fully
    # resolved path; only the documented staging locations inside the
    # repo (agent-call-sheet-<target>/ and bundles/ at the repo root,
    # both gitignored) are allowed.
    if not args.list:
        if not bundle_only and not exports_present:
            problem = guard_output_path(dest, "dest", root)
            if problem is not None:
                print("error: %s" % problem, file=sys.stderr)
                return 1
        if bundle_dir is not None and not exports_present:
            problem = guard_output_path(bundle_dir, "bundle", root)
            if problem is not None:
                print("error: %s" % problem, file=sys.stderr)
                return 1

    # Scope: front door + Rigor core always; selected packs add entries.
    # A crew selection replaces the pack selection with the crew's
    # members. Either way this single computation drives install,
    # --list, --bundle, and the exports alike.
    if crew is not None:
        scope_packs, included, not_installed, practice = crew_scope(
            rows, crew)
    else:
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
        if crew is not None:
            print("  crew: %s (origin: %s)" % (crew["name"], crew_origin))
        if args.export_crew is not None:
            print("  export-crew: %s (not written in --list mode)"
                  % args.export_crew)
        if args.export_paperclip is not None:
            print("  export-paperclip: %s (not written in --list mode)"
                  % args.export_paperclip)
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


    if exports_present:
        # Exports write the current selection and exit without
        # installing, like bundle-only mode. Export targets are user
        # files: symlink targets and paths resolving inside the
        # repository tree are refused before anything is written.
        selection = current_selection(rows, crew, scope_packs,
                                      selected_packs)
        if args.export_crew is not None:
            out = Path(args.export_crew).expanduser()
            problem = guard_export_path(out, root, "--export-crew file")
            if problem is not None:
                print("error: %s" % problem, file=sys.stderr)
                return 1
            if out.exists() and not out.is_file():
                print("error: --export-crew file exists and is not a "
                      "file: %s" % out, file=sys.stderr)
                return 1
            os.makedirs(out.parent, exist_ok=True)
            data = selection_crew_dict(selection)
            write_bytes_atomic(
                out, (json.dumps(data, indent=2) + "\n").encode("utf-8"))
            print("Crew written: %s (%s, %d members)"
                  % (out, selection["name"], len(selection["members"])))
        if args.export_paperclip is not None:
            target = export_paperclip(
                root, Path(args.export_paperclip).expanduser(), selection)
            print("Paperclip team written: %s" % target)
        if not_installed:
            print(LINK_ONLY_BANNER)
            for row in not_installed:
                print("  %s — %s" % (row["name"], row["source_url"]))
        return 0


    bundle_records = []

    if args.bundle is not None:
        # Bundle scope is the selection scope: a bare --bundle exports
        # the default scope (front door + Rigor core), --packs X exports
        # X's scope — exactly what an install with the same flags does.
        bundle_scope = included

        if crew is not None:
            print("Crew: %s (origin: %s)" % (crew["name"], crew_origin))

        norm = load_bundle_normalisation(root, rows)

        os.makedirs(bundle_dir, exist_ok=True)
        bundle_tf = dict(transforms)
        final_names = {}
        produced = []
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
            folder = row["_resolved"].name
            zip_name = folder + ".zip"
            if row["name"] in norm["exclusions"]:
                print("note: %s is not an uploadable skill (%s); "
                      "bundled unchanged"
                      % (zip_name, norm["exclusions"][row["name"]]))
            else:
                root_src = next(
                    (src for src, rel in pairs
                     if rel == Path(folder) / "SKILL.md"), None)
                if root_src is None:
                    raise BootstrapError(
                        "included entry %r has no root SKILL.md and is "
                        "not a layout exclusion" % row["name"])
                effective = transforms.get(root_src)
                if effective is None:
                    with open(root_src, "rb") as handle:
                        effective = handle.read()
                new_bytes, changes, final_name = normalise_bundle_skill(
                    effective, row, norm)
                final_names[row["name"]] = final_name
                for change in changes:
                    if change[0] == "name":
                        produced.append(change[2])
                if changes:
                    bundle_tf[root_src] = new_bytes
                    extras.append((
                        str(Path(folder) / NORMALISATION_NOTE_NAME),
                        normalisation_note_text(row, changes)))
                    name_change = next(
                        (c for c in changes if c[0] == "name"), None)
                    keys_change = next(
                        (c for c in changes if c[0] == "keys_removed"),
                        None)
                    bundle_records.append({
                        "entry": row["name"], "zip": zip_name,
                        "name_from": name_change[1] if name_change else None,
                        "name_to": name_change[2] if name_change else None,
                        "keys_removed": list(keys_change[1])
                        if keys_change else [],
                        "yaml_repair": any(c[0] == "yaml_repair"
                                            for c in changes),
                    })
            zip_plans.append((zip_name, pairs, extras))
        front_filtered = [(src, rel) for src, rel in front_pairs
                            if rel != Path("starter-prompt.md")]
        print("front-door.zip: starter-prompt.md is not bundled; the "
              "zip carries the crew-orchestrator skill only — paste "
              "the starter prompt from the repository copy")
        bundle_records.append({
            "entry": "front-door", "zip": "front-door.zip",
            "layout_change": "starter-prompt.md not bundled"})
        crew_src = next(
            (src for src, rel in front_pairs
             if rel == Path("crew-orchestrator") / "SKILL.md"), None)
        if crew_src is None:
            raise BootstrapError(
                "front-door crew-orchestrator SKILL.md missing")
        try:
            crew_name = _fm_name(
                crew_src.read_bytes().decode("utf-8"))
        except UnicodeDecodeError as exc:
            raise BootstrapError(
                "front-door crew-orchestrator SKILL.md is not valid "
                "UTF-8: %s" % exc)
        all_names = list(final_names.values()) + [crew_name]
        for produced_name in produced:
            if not produced_name_ok(produced_name) \
                    or all_names.count(produced_name) != 1:
                raise BootstrapError(
                    "produced bundle name %r is not valid or not "
                    "unique across the bundle nameset" % produced_name)
        zip_plans.append(("front-door.zip", front_filtered, []))
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
                        if src in bundle_tf:
                            return sha256_bytes(bundle_tf[src])
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
            write_zip_atomic(zip_path, pairs, bundle_tf, extras)
            print("bundled: %s (%d files)" % (zip_path, len(pairs) + len(extras)))
            for arcname, _data in extras:
                if arcname.endswith(INJECTION_NOTE_NAME):
                    print("  frontmatter injected into %s in this bundle "
                          "(disclosure: %s)"
                          % (arcname.replace(INJECTION_NOTE_NAME,
                                               "SKILL.md"), arcname))
                elif arcname.endswith(NORMALISATION_NOTE_NAME):
                    print("  bundle normalisation applied to %s in this "
                          "bundle (disclosure: %s)"
                          % (arcname.replace(NORMALISATION_NOTE_NAME,
                                               "SKILL.md"), arcname))
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
    if crew is not None:
        print("Crew: %s (origin: %s)" % (crew["name"], crew_origin))
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
        "crew": ({"name": crew["name"], "origin": crew_origin}
                 if crew is not None else None),
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
    if args.bundle is not None:
        receipt["bundle_normalisation"] = bundle_records
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
