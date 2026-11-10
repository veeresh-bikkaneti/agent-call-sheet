#!/usr/bin/env python3
"""Pin every script of the game page with Subresource Integrity.

Fills three things in features/site/index.html, and can be run again at any
time (it replaces the previous values):
  - the inline import map, whose "integrity" table holds a sha384 hash for
    every JavaScript module the page can load;
  - the integrity attribute on the main.js script tag;
  - the sha256 hash of the import map in the Content-Security-Policy, so the
    policy allows that one inline script and nothing else.

Usage: python3 features/site/tools/build_sri.py [--check]
--check exits 1 if index.html is not up to date, without writing it.
"""
import base64
import hashlib
import json
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parents[1]
INDEX = SITE / "index.html"


def sri(data: bytes, algo: str = "sha384") -> str:
    return algo + "-" + base64.b64encode(hashlib.new(algo, data).digest()).decode()


def modules():
    files = sorted((SITE / "assets" / "game").glob("*.js"))
    files += sorted((SITE / "assets" / "vendor" / "three").glob("*.js"))
    return files


def build(html: str) -> str:
    integrity = {}
    for f in modules():
        rel = "./" + f.relative_to(SITE).as_posix()
        integrity[rel] = sri(f.read_bytes())
    importmap = json.dumps({"imports": {}, "integrity": integrity}, indent=None, separators=(",", ":"))
    html, n1 = re.subn(r'(<script type="importmap">)(.*?)(</script>)', lambda m: m.group(1) + importmap + m.group(3), html, count=1, flags=re.S)
    csp_hash = "'" + sri(importmap.encode(), "sha256") + "'"
    html, n2 = re.subn(r"script-src 'self' '[^']*'", "script-src 'self' " + csp_hash, html, count=1)
    main_sri = integrity["./assets/game/main.js"]
    html, n3 = re.subn(r'(<script type="module" src="assets/game/main.js" integrity=")[^"]*(")', lambda m: m.group(1) + main_sri + m.group(2), html, count=1)
    if (n1, n2, n3) != (1, 1, 1):
        sys.exit("index.html is missing the import map, the CSP script-src or the main.js tag")
    return html


def main():
    old = INDEX.read_text(encoding="utf-8")
    new = build(old)
    if "--check" in sys.argv:
        if new != old:
            print("index.html is out of date: run python3 features/site/tools/build_sri.py")
            sys.exit(1)
        print("index.html integrity is up to date")
        return
    INDEX.write_text(new, encoding="utf-8")
    print("updated", INDEX.relative_to(SITE.parents[1]), "with", len(modules()), "pinned modules")


if __name__ == "__main__":
    main()
