#!/usr/bin/env python3
"""Build the packs table on packs/index.html from features/docs/manifest.csv.

Standard library only. The output is deterministic: rows are sorted by pack id and every
count is recomputed from the CSV, never typed by hand.

  python features/site/tools/build_packs.py          rewrite the table in place
  python features/site/tools/build_packs.py --check  regenerate in memory and fail on any difference
"""
import csv
import html
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "features" / "docs" / "manifest.csv"
PAGE = ROOT / "features" / "site" / "packs" / "index.html"
BEGIN, END = "<!-- PACKS:BEGIN -->", "<!-- PACKS:END -->"

# Display names and one-line blurbs follow the README pack table; the numbers never do.
PACKS = {
    "crew-personas": ("Crew Personas", "Specialist seats: reality checker, architects, developers, reviewers, test and evidence seats, security, AI and prompt work, design, product, research."),
    "rigor": ("Rigor", "The discipline stack: ponytail, karpathy-guidelines, pstack picks, agents-orchestrator, Archify, Graphify, production-path verification."),
    "memory-comms": ("Memory &amp; Comms", "Output shaping and the memory and catch-up practices."),
    "design-video-3d": ("Design / Video / 3D", "Remotion, OpenFilm, Three.js skills, UI/UX and frontend design, plus reference libraries listed link-only."),
    "seo": ("SEO", "One leaf skill per job: canonical, sitemap, Core Web Vitals, schema, keywords, local, programmatic and the rest."),
    "legal": ("Legal", "Legal and privacy advisor skills."),
}


def classify(distribution):
    d = distribution.strip().lower()
    if d.startswith("include"):
        return "included"
    if d.startswith("link-only"):
        return "link-only"
    return "practice"


def render():
    with open(MANIFEST, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    counts = {}
    for r in rows:
        counts.setdefault(r["pack"], Counter())[classify(r["distribution"])] += 1
    total = Counter()
    lines = ['<div class="table-scroll"><table>',
             "<caption>Entries per pack, computed from features/docs/manifest.csv</caption>",
             '<thead><tr><th scope="col">Pack</th><th scope="col">What is in it</th>'
             '<th scope="col" class="num">Included</th><th scope="col" class="num">Link-only</th>'
             '<th scope="col" class="num">Practices</th><th scope="col" class="num">Total</th></tr></thead>',
             "<tbody>"]
    for pack in sorted(counts):
        c = counts[pack]
        total.update(c)
        name, blurb = PACKS.get(pack, (html.escape(pack), ""))
        n = sum(c.values())
        lines.append('<tr><th scope="row"><code>%s</code><br>%s</th><td>%s</td><td class="num">%d</td><td class="num">%d</td><td class="num">%d</td><td class="num">%d</td></tr>'
                     % (html.escape(pack), name, blurb, c["included"], c["link-only"], c["practice"], n))
    lines.append("</tbody>")
    lines.append('<tfoot><tr><th scope="row" colspan="2">All packs</th><td class="num">%d</td><td class="num">%d</td><td class="num">%d</td><td class="num">%d</td></tr></tfoot>'
                 % (total["included"], total["link-only"], total["practice"], sum(total.values())))
    lines.append("</table></div>")
    lines.append('<p class="small">%d manifest rows read. "Practices" are entries with no file to copy or link (ways of working). The count of manifest entries is the only count this project claims for its library.</p>' % len(rows))
    return "\n".join(lines)


def main(argv):
    text = PAGE.read_text(encoding="utf-8").replace("\r\n", "\n")
    if BEGIN not in text or END not in text:
        print("FAIL: markers %s / %s not found in %s" % (BEGIN, END, PAGE))
        return 1
    head, rest = text.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    new = head + BEGIN + "\n" + render() + "\n" + END + tail
    if "--check" in argv:
        if new != text:
            print("FAIL: packs/index.html is out of date with manifest.csv. Run: python features/site/tools/build_packs.py")
            return 1
        print("PASS: packs table matches manifest.csv")
        return 0
    PAGE.write_text(new, encoding="utf-8", newline="\n")
    print("wrote", PAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
