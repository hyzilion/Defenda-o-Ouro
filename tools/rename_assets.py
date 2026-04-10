# -*- coding: utf-8 -*-
"""Rename extracted css/js to semantic names; rewrite index.html links."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

CSS_MAP = [
    ("css/09-block-9.css", "css/01-base-layout.css"),
    ("css/08-onlineStyles.css", "css/02-online-lobby.css"),
    ("css/06-bg-base-transparent.css", "css/04-bg-transparent.css"),
    ("css/05-bgMenuPattern-style.css", "css/05-bg-menu-pattern.css"),
    ("css/04-exp-system-styles.css", "css/06-exp-account.css"),
    ("css/03-block-3.css", "css/07-profile-screen.css"),
    ("css/02-gold-minimal-override.css", "css/08-btn-start-shine.css"),
    ("css/01-gold-minimal-override-2.css", "css/09-btn-start-type.css"),
]

JS_MAP = [
    ("js/08-block-8.js", "js/input-mode.js"),
    ("js/07-block-7.js", "js/game-core.js"),
    ("js/06-score-counter-anim.js", "js/score-anim.js"),
    ("js/05-zoom-button-script.js", "js/zoom.js"),
    ("js/03-bgMenuPattern-toggle.js", "js/bg-menu-pattern.js"),
    ("js/02-options-menu-script.js", "js/options-and-structure-menus.js"),
    ("js/01-block-1.js", "js/online-coop.js"),
]


def main():
    html = INDEX.read_text(encoding="utf-8")
    for old, new in CSS_MAP + JS_MAP:
        op, np = ROOT / old, ROOT / new
        np.parent.mkdir(parents=True, exist_ok=True)
        if op.exists():
            op.rename(np)
        html = html.replace(old, new)
    INDEX.write_text(html, encoding="utf-8")
    print("Renamed assets and updated index.html")


if __name__ == "__main__":
    main()
