#!/usr/bin/env python3
"""Static checks for the docs site (standard library only). Run: python -I features/site/tools/check_site.py

Checks every page under features/site (skipping content/, tools/, .screenshots/):
well-formed HTML, unique ids, one h1, img alt, button type, internal links, #anchors and asset references,
no external scripts, no inline style attributes (the pages carry a strict CSP), and no canvas/WebGL.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urlparse, unquote

SITE = Path(__file__).resolve().parents[1]
SKIP = {"content", "tools", ".screenshots"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
errors = []


def err(page, msg):
    errors.append("%s: %s" % (page, msg))


class Page(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name, self.stack, self.ids, self.refs = name, [], [], []
        self.h1 = 0
        self.tags = []
        self.titled = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append(tag)
        if tag not in VOID:
            self.stack.append(tag)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "img" and "alt" not in a:
            err(self.name, "<img> without alt: %s" % a.get("src"))
        if tag == "button" and a.get("type") not in ("button", "submit", "reset"):
            err(self.name, "<button> without explicit type")
        if "style" in a:
            err(self.name, "inline style attribute on <%s> (blocked by CSP)" % tag)
        if any(k.startswith("on") for k in a):
            err(self.name, "inline event handler on <%s>" % tag)
        if tag in ("canvas",):
            err(self.name, "<canvas> is not allowed on this site")
        for k in ("href", "src", "poster", "data-src"):
            if k in a and a[k] is not None and tag != "base":
                self.refs.append((tag, k, a[k]))

    def handle_startendtag(self, tag, attrs):
        # <br/> style; treat as a start tag of a void element, or a self-closing SVG shape.
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            err(self.name, "unexpected </%s>; open stack ends %s" % (tag, self.stack[-3:]))
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
            return
        self.stack.pop()


def quest_data(text, start_re, end_re):
    """Return [(title, [commands])] for each step block found between start_re matches."""
    import html as _h
    out = []
    parts = re.split(start_re, text)[1:]
    for part in parts:
        part = re.split(end_re, part)[0]
        m = re.search(r"<h3[^>]*>(.*?)</h3>", part, re.S)
        cmds = [_h.unescape(c) for c in re.findall(r"<pre><code>(.*?)</code></pre>", part, re.S)]
        out.append((_h.unescape(m.group(1)).strip() if m else None, cmds))
    return out


def check_game_drift():
    """Every quest card in game/index.html must match the install step of the same order: same title, same commands."""
    ip, gp = SITE / "install" / "index.html", SITE / "game" / "index.html"
    if not gp.exists():
        err("game/index.html", "missing")
        return
    itext = ip.read_text(encoding="utf-8")
    ol = itext.split('<ol class="steps">', 1)[-1].split("</ol>", 1)[0]
    steps = quest_data(ol, r'<li id="step-[^"]*">', r"(?!x)x")
    quests = quest_data(gp.read_text(encoding="utf-8"), r'<article class="quest"[^>]*>', r"</article>")
    if len(steps) != len(quests):
        err("game/index.html", "quest cards (%d) and install steps (%d) differ in number" % (len(quests), len(steps)))
    for i, (s, q) in enumerate(zip(steps, quests), 1):
        if s[0] != q[0]:
            err("game/index.html", "quest %d title %r differs from install step %r" % (i, q[0], s[0]))
        if s[1] != q[1]:
            err("game/index.html", "quest %d commands differ from install step %d: %r vs %r" % (i, i, q[1], s[1]))


def pages():
    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(SITE)
        if rel.parts[0] in SKIP:
            continue
        yield p


def main():
    parsed = {}
    for p in pages():
        name = p.relative_to(SITE).as_posix()
        text = p.read_text(encoding="utf-8")
        pg = Page(name)
        pg.feed(text)
        pg.close()
        if pg.stack:
            err(name, "unclosed tags: %s" % pg.stack)
        if pg.h1 != 1:
            err(name, "expected exactly one <h1>, found %d" % pg.h1)
        dup = sorted({i for i in pg.ids if pg.ids.count(i) > 1})
        if dup:
            err(name, "duplicate ids: %s" % dup)
        for need in ('<html lang="', "<title>", 'class="skip-link"', 'id="main"', "<nav ", "<footer"):
            if need not in text:
                err(name, "missing %s" % need)
        if re.search(r"webgl|three\.(module|core)\.js|requestAnimationFrame", text, re.I):
            err(name, "mentions WebGL/three.js/animation loop")
        parsed[p.resolve()] = pg

    if not parsed:
        err("site", "no pages found")

    checked = 0
    for path, pg in parsed.items():
        name = path.relative_to(SITE).as_posix()
        for tag, attr, url in pg.refs:
            url = url.strip()
            u = urlparse(url)
            if u.scheme in ("http", "https"):
                if tag in ("script", "link", "img", "source", "video", "iframe"):
                    err(name, "<%s> loads from outside: %s" % (tag, url))
                continue
            if u.scheme in ("mailto", "tel", "data") or url == "":
                continue
            if u.scheme or url.startswith("//") or url.startswith("/"):
                err(name, "non-relative link (site is served under a sub-path): %s" % url)
                continue
            base, frag = urldefrag(url)
            target = path if base == "" else (path.parent / unquote(urlparse(base).path)).resolve()
            if target.is_dir():
                target = target / "index.html"
            checked += 1
            if not target.exists():
                err(name, "broken link %s -> %s" % (url, target))
                continue
            try:
                target.relative_to(SITE.resolve())
            except ValueError:
                err(name, "link escapes the site folder: %s" % url)
                continue
            if frag and target.suffix == ".html":
                tp = parsed.get(target)
                if tp is None:
                    err(name, "anchor target page not parsed: %s" % url)
                elif frag not in tp.ids:
                    err(name, "missing anchor #%s in %s" % (frag, target.relative_to(SITE).as_posix()))
    check_game_drift()
    css = (SITE / "assets" / "site.css").read_text(encoding="utf-8")
    if "prefers-reduced-motion" not in css:
        err("assets/site.css", "no prefers-reduced-motion rule")
    nav_pages = {p.relative_to(SITE).as_posix() for p in parsed}
    if len(nav_pages) < 6:
        err("site", "expected at least 6 pages, found %s" % sorted(nav_pages))
    for e in errors:
        print("FAIL", e)
    print("%s: %d pages, %d internal references checked, %d problems" % ("FAIL" if errors else "PASS", len(parsed), checked, len(errors)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
