"""Download the item and spell pictures so the planner shows them without internet.

Run from anywhere:  py tools/download_images.py
Saves every picture referenced by items.js and spells.js into img/ (about 1300 small files) and
switches the planner to use them. Pictures already downloaded are skipped, so it is safe to re-run
after updating the databases. Delete img/ and set images.js back to false to return to loading
the pictures from the wiki.
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_BASE = "https://bg3.wiki/w/images/"
UA = {"User-Agent": "bg3-planner picture downloader (personal, non-commercial tool)"}


def local_name(path):
    """File name used on disk; js/library.js builds the same name from the same path."""
    return re.sub(r"[^\w.\-'() ]", "_", urllib.parse.unquote(path.rsplit("/", 1)[-1]))


def paths():
    out = set()
    for name, var in (("items.js", "BG3_ITEMS"), ("spells.js", "BG3_SPELLS")):
        text = io.open(os.path.join(ROOT, name), encoding="utf-8").read()
        records = json.loads("[" + text.split("window." + var + " = [", 1)[1].rsplit("]", 1)[0] + "]")
        out.update(r["i"] for r in records if r.get("i"))
    return sorted(out)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    folder = os.path.join(ROOT, "img")
    os.makedirs(folder, exist_ok=True)
    todo = paths()
    done = failed = skipped = 0
    for i, path in enumerate(todo, 1):
        target = os.path.join(folder, local_name(path))
        if os.path.exists(target) and os.path.getsize(target) > 0:
            skipped += 1
            continue
        try:
            with urllib.request.urlopen(urllib.request.Request(IMAGE_BASE + path, headers=UA), timeout=60) as r:
                data = r.read()
            with open(target, "wb") as f:
                f.write(data)
            done += 1
            time.sleep(0.05)
        except Exception as err:
            failed += 1
            print("  failed:", path, err)
        if i % 200 == 0:
            print(f"  {i} of {len(todo)}…")
    io.open(os.path.join(ROOT, "images.js"), "w", encoding="utf-8", newline="\n").write(
        "// Whether the pictures were downloaded into img/ (see tools/download_images.py). When false they load from bg3.wiki.\n"
        f"window.BG3_IMAGES_LOCAL = {'true' if failed < len(todo) else 'false'};\n")
    size = sum(os.path.getsize(os.path.join(folder, f)) for f in os.listdir(folder))
    print(f"{done} downloaded, {skipped} already there, {failed} failed. img/ holds {len(os.listdir(folder))} files, {size // 1024 // 1024} MB.")


if __name__ == "__main__":
    main()
