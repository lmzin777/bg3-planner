"""Rebuild classes.js from bg3.wiki: what each class and subclass gains per level, and the list of feats.

Run from anywhere:  py tools/update_classes.py
Needs only the Python standard library and an internet connection. Takes under a minute.

Class features come from the "Class progression" table of each class page, the subclasses from its
"Select a subclass" table, subclass features from the level sections of each subclass page, and feats
from the table on the Feats page.
"""
import io, json, os, re, sys, time

from update_items import clean, field, page_texts, short

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "classes.js")
CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"]
FEATURE_TEMPLATE = re.compile(
    r"\{\{\s*(?:Lg|Md|Sm)?(?:SAI|Pass|Passive|Spell action|Action|Reaction|Feature box)\s*\|([^{}|]+)(?:\|([^{}|=]+)(?=\||\}\}))?[^{}]*\}\}", re.I)


def sections(text, level):
    """Split wikitext into (heading, body) pairs for headings of exactly this level."""
    eq = "=" * level
    parts = re.split(r"^" + eq + r"(?!=)\s*(.+?)\s*" + eq + r"(?!=)[ \t]*(?:<!--.*?-->)?[ \t]*$", text, flags=re.M)
    return list(zip(parts[1::2], parts[2::2]))


def tidy(name):
    name = clean(name.replace("&colon;", ":")).strip(" :-–")
    return re.sub(r"\s*\((?:passive feature|Melee|Ranged)\)$", "", name)


def plain(text):
    """Icon templates carry a file name first; keep only the label a reader would see."""
    text = re.sub(r"\{\{\s*(?:Icon|DieIcon|SpellSlot)\s*\|[^{}]*\}\}", "", text, flags=re.I)
    text = re.sub(r"\{\{\s*(?:Sm|Md|Lg)?Icon ?link\s*\|([^{}]*)\}\}", lambda m: [x for x in m.group(1).split("|") if "=" not in x][-1], text, flags=re.I)
    text = re.sub(r"\{\{\s*(?:R|Resource|Anchor)\s*\|[^{}]*\}\}", "", text, flags=re.I)
    return FEATURE_TEMPLATE.sub(lambda m: m.group(2) or m.group(1), text)


# Bookkeeping lines of a level section: spell slots, counts and reminders rather than features.
BOOKKEEPING = re.compile(r"spell slots?|cantrips? known|spells? known|known spells|prepared spells|spellcasting ability|"
                         r"new .*available|replacement spell|^\d+$|^level \d+$|^spells marked|^the dc for|^subclass spells$", re.I)


def without_options(text):
    """Drop the parts of a level section that list what can be chosen, keeping what is granted.

    Option lists come as wikitables, multi-column blocks, flexboxes, and nested definition lists
    under a feature (the children of "Fighting Style", for example).
    """
    text = re.sub(r"\{\|.*?\n\|\}", "", text, flags=re.S)
    text = re.sub(r"\{\{\s*div col.*?\{\{\s*div col end\s*\}\}", "", text, flags=re.S | re.I)
    text = re.sub(r"\{\{\s*div col.*", "", text, flags=re.S | re.I)  # an unclosed block runs to the end of the section
    # {{Flexbox | ... }} holds nested templates, so cut it by counting braces
    out, i = "", 0
    while True:
        m = re.search(r"\{\{\s*Flexbox", text[i:], re.I)
        if not m:
            out += text[i:]
            break
        start = i + m.start()
        out += text[i:start]
        depth, j = 0, start
        while j < len(text):
            if text.startswith("{{", j):
                depth += 1
                j += 2
            elif text.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        i = j
    out = re.sub(r"<dd>\s*<dl>.*?</dl>\s*</dd>", "", out, flags=re.S | re.I)
    return re.sub(r"\{\{\s*:[^{}]*\}\}", "", out)


def feature_names(text):
    """What a level section grants: features named by templates, definition terms and short bullet lines."""
    out = []

    def add(name):
        name = tidy(name)
        if len(name) > 2 and len(name) < 90 and name not in out and not BOOKKEEPING.search(name):
            out.append(name)

    for raw in without_options(text).split("\n"):
        raw = raw.strip()
        found = [m.group(2) or m.group(1) for m in FEATURE_TEMPLATE.finditer(raw)]
        if raw.startswith(":;") or raw.startswith("::"):
            continue  # a sub-entry of the term above it
        dt = re.match(r"<d[td]>(.*?)</d[td]>", raw, re.I)  # a term, or a one-line remark such as "Choose 1 additional fighting style"
        if dt:
            add(plain(dt.group(1)).rstrip("."))
        elif found:
            for n in found:
                add(n)
        elif raw.startswith(";"):
            add(re.sub(r"&colon;.*$", "", plain(raw[1:])))
        elif raw.startswith("*") and not raw.startswith("**"):
            add(plain(raw.lstrip("* ")))
    return out


def class_table(w):
    """Features column of the class progression table, as {level: [feature, ...]}."""
    out = {}
    m = re.search(r"==\s*Class progression\s*==(.*?)\n\|\}", w, re.S | re.I)
    table = m.group(1) if m else ""
    for row in re.split(r"\n\|-[^\n]*", table):
        lv = re.search(r"\[\[\w*#Level (\d+)\|", row)
        if not lv:
            continue
        cells = re.split(r"\n\|", row)[1:]
        best = max(cells, key=lambda c: len(re.findall(r"\{\{|\[\[", c)), default="")
        best = re.sub(r'^\s*(?:(?:style|rowspan|colspan|class)="[^"]*"\s*)+\|', "", best)
        names = []
        for piece in re.split(r",(?![^{]*\}\})(?![^\[]*\]\])", plain(best)):
            text = tidy(piece)
            if text and not re.fullmatch(r"[\d+\-–\s]*", text) and text not in names:
                names.append(text)
        out[int(lv.group(1))] = names
    return out


def subclass_list(w):
    """Subclasses offered by the class and the level at which they are chosen."""
    for title, body in sections(w.split("Level progression", 1)[-1], 3):
        lv = re.match(r"Level (\d+)$", title)
        m = re.search(r"Select a subclass", body, re.I)
        if lv and m:
            names = [clean(n) for n in re.findall(r"\{\{\s*ImageLink\s*\|[^|{}]*\|([^|{}]+)", body[m.end():])]
            return int(lv.group(1)), [n for i, n in enumerate(names) if n and n not in names[:i]]
    return 0, []


def subclass_levels(w):
    out = {}
    body = re.split(r"==\s*Subclass features\s*==", w, maxsplit=1, flags=re.I)[-1]
    body = re.split(r"\n==[^=]", body, maxsplit=1)[0]
    for title, text in sections(body, 3):
        lv = re.match(r"Level (\d+)", title)
        if lv:
            names = feature_names(text)
            if names:
                out[int(lv.group(1))] = names
    return out


def feats(w):
    out = []
    for block in re.split(r"\{\{\s*table feat\s*", w)[1:]:
        name = clean(field("| " + block.lstrip("| "), "name") or field(block, "name"))
        parts = []
        for k in ("description", "description1", "description2", "description3"):
            v = field(block, k)
            if v:
                parts.append(clean(v))
        if name:
            out.append([name, short("; ".join(parts), 320)])
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("Reading class pages…")
    pages = page_texts(CLASSES + ["Feats"])
    data, wanted = {}, {}
    for c in CLASSES:
        w = pages.get(c, "")
        level, subs = subclass_list(w)
        data[c] = {"levels": class_table(w), "subclassLevel": level, "subclasses": {}}
        for s in subs:
            wanted[s] = c
    print(f"Reading {len(wanted)} subclass pages…")
    sub_pages = page_texts(list(wanted))
    for s, c in wanted.items():
        data[c]["subclasses"][s] = subclass_levels(sub_pages.get(s, ""))
    feat_list = feats(pages.get("Feats", ""))

    js = ("// What each class and subclass gains per level, and the feats. Generated by tools/update_classes.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead.\n"
          "// BG3_CLASSES[class] = { levels: {class level: [features]}, subclassLevel, subclasses: {name: {class level: [features]}} }\n"
          "// BG3_FEATS = [[name, what it does], ...]\n"
          f"window.BG3_CLASSES_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_CLASSES = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
          "window.BG3_FEATS = [\n" + ",\n".join("  " + json.dumps(f, ensure_ascii=False) for f in feat_list) + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)

    print(f"Wrote {OUT} ({len(js) // 1024} KB): {len(feat_list)} feats")
    for c in CLASSES:
        d = data[c]
        empty = [s for s, lv in d["subclasses"].items() if not lv]
        print(f"  {c}: {len(d['levels'])} levels, subclass at {d['subclassLevel']}: {', '.join(d['subclasses'])}" + (f" | NO FEATURES FOUND: {empty}" if empty else ""))


if __name__ == "__main__":
    main()
