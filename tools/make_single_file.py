"""Bundle the planner into one HTML file that can be sent to other people.

Run from anywhere:  py tools/make_single_file.py
Writes dist/BG3-Planner.html with the stylesheet, scripts, ready-made builds and item database inlined.
Whoever receives it just opens the file in a browser; their builds are saved in that browser.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "BG3-Planner.html")


def read(name):
    return io.open(os.path.join(ROOT, name), encoding="utf-8").read()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    html = read("index.html")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + read(m.group(1)) + "</style>", html)

    def inline(m):
        code = read(m.group(1))
        if m.group(1) == "images.js":  # the single file travels without the img/ folder
            code = "window.BG3_IMAGES_LOCAL = false;\n"
        # a literal closing script tag inside the code would end the inline block early
        if "</script" in code.lower():
            raise SystemExit(m.group(1) + " contains '</script', which cannot be inlined as is")
        return "<script>\n" + code + "</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(html)
    print(f"Wrote {OUT} ({len(html.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    main()
