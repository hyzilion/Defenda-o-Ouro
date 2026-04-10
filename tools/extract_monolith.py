# -*- coding: utf-8 -*-
"""One-off extractor: defenda_o_ouro_v127.html -> css/, js/, index.html"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "defenda_o_ouro_v127.html"
OUT_HTML = ROOT / "index.html"
CSS_DIR = ROOT / "css"
JS_DIR = ROOT / "js"

BLOCK = re.compile(
    r"<(?P<tag>style|script)\b(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=tag)>",
    re.DOTALL | re.IGNORECASE,
)


def main():
    raw = SRC.read_text(encoding="utf-8")
    CSS_DIR.mkdir(exist_ok=True)
    JS_DIR.mkdir(exist_ok=True)

    css_files = []
    js_files = []

    matches = list(BLOCK.finditer(raw))
    # Process in reverse so string replacements keep indices valid
    html = raw
    css_i = js_i = 0

    for m in reversed(matches):
        tag = m.group("tag").lower()
        attrs = m.group("attrs")
        body = m.group("body").strip("\n")
        if tag == "style":
            css_i += 1
            id_m = re.search(r'id\s*=\s*"([^"]+)"', attrs, re.I)
            sid = id_m.group(1) if id_m else f"block-{css_i}"
            safe = re.sub(r"[^\w\-]+", "_", sid)[:48]
            name = f"{css_i:02d}-{safe}.css"
            path = CSS_DIR / name
            path.write_text(body.strip() + "\n", encoding="utf-8")
            css_files.append(name)
        else:
            js_i += 1
            id_m = re.search(r'id\s*=\s*"([^"]+)"', attrs, re.I)
            sid = id_m.group(1) if id_m else f"block-{js_i}"
            safe = re.sub(r"[^\w\-]+", "_", sid)[:48]
            name = f"{js_i:02d}-{safe}.js"
            path = JS_DIR / name
            path.write_text(body.strip() + "\n", encoding="utf-8")
            js_files.append(name)
        html = html[: m.start()] + html[m.end() :]

    css_files.reverse()
    js_files.reverse()

    # Fix invalid HTML: move stray div before <html> into body
    html = html.lstrip("\ufeff")
    if html.startswith("<!DOCTYPE html>"):
        rest = html[len("<!DOCTYPE html>") :].lstrip()
    else:
        rest = html

    stray = ""
    m = re.match(
        r'(<div\b[^>]*id="bgMenuPattern"[^>]*>\s*</div>\s*)',
        rest,
        re.I,
    )
    if m:
        stray = m.group(1)
        rest = rest[m.end() :]

    rest = rest.lstrip()
    if not rest.lower().startswith("<html"):
        raise SystemExit("Expected <html> after DOCTYPE")

    # Insert links after <title>...</title>
    link_block = "\n".join(
        f'  <link rel="stylesheet" href="css/{n}"/>' for n in css_files
    )
    rest, n_sub = re.subn(
        r"(</title>\s*)",
        r"\1\n" + link_block + "\n",
        rest,
        count=1,
        flags=re.I,
    )
    if n_sub != 1:
        raise SystemExit("Could not find </title> for CSS injection")

    # Prepend stray bg div right after <body
    body_m = re.search(r"<body\b[^>]*>", rest, re.I)
    if not body_m:
        raise SystemExit("No <body>")
    ins_at = body_m.end()
    rest = rest[:ins_at] + "\n" + stray + rest[ins_at:]

    # Scripts before </body> (reverse order was extraction; js_files is correct load order)
    script_block = "\n".join(
        f'  <script src="js/{n}" defer></script>' for n in js_files
    )
    rest, n_sub = re.subn(
        r"(\s*)</body>",
        r"\n" + script_block + r"\n</body>",
        rest,
        count=1,
        flags=re.I,
    )
    if n_sub != 1:
        raise SystemExit("Could not find </body> for script injection")

    out = "<!DOCTYPE html>\n" + rest
    OUT_HTML.write_text(out, encoding="utf-8")
    print("Wrote", OUT_HTML)
    print("CSS:", len(css_files), "JS:", len(js_files))


if __name__ == "__main__":
    main()
