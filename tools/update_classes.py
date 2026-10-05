"""Rebuild classes.js from bg3.wiki: what each class and subclass gains per level, the numbers of the
class tables (resources, cantrips and spells known, spell slots), what each feature does, and the feats.

Run from anywhere:  py tools/update_classes.py
Needs only the Python standard library and an internet connection. Takes about a minute.

Class features and numbers come from the "Class progression" table of each class page, the subclasses
from its "Select a subclass" table, subclass features from the level sections of each subclass page,
feature descriptions from the page of each feature, and feats from the table on the Feats page.
"""
import io, json, os, re, sys, time

from update_items import api, clean, field, page_texts, short

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "classes.js")
CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"]
FEATURE_TEMPLATE = re.compile(
    r"\{\{\s*(?:Lg|Md|Sm)?(?:SAI|Pass|Passive|Spell action|Action|Reaction|Feature box)\s*\|([^{}|]+)(?:\|([^{}|=]+)(?=\||\}\}))?[^{}]*\}\}", re.I)
# The wiki page behind each feature name, collected while the names are read; used to fetch the descriptions.
PAGE_OF = {}
RESOURCES = {}
# Features that are used (actions, bonus actions, reactions) rather than always on, by the template the wiki shows them with.
ACTIONS = set()
ACTION_TEMPLATE = re.compile(r"\{\{\s*(?:Lg|Md|Sm)?(?:SAI|Spell action|Action|Reaction)\s*\|([^{}|]+)(?:\|([^{}|=]+)(?=\||\}\}))?", re.I)


def sections(text, level):
    """Split wikitext into (heading, body) pairs for headings of exactly this level."""
    eq = "=" * level
    parts = re.split(r"^" + eq + r"(?!=)\s*(.+?)\s*" + eq + r"(?!=)[ \t]*(?:<!--.*?-->)?[ \t]*$", text, flags=re.M)
    return list(zip(parts[1::2], parts[2::2]))


def tidy(name):
    # {{MartialWeaponsProf}} is the wiki's icon for a proficiency: keep its words, "Martial Weapons"
    alone = re.fullmatch(r"\s*\{\{\s*[A-Za-z]+?Prof\s*\}\}\s*", name)  # the whole gain is that proficiency
    name = re.sub(r"\{\{\s*([A-Za-z]+?)Prof\s*\}\}", lambda m: re.sub(r"(?<=[a-z])(?=[A-Z])", " ", m.group(1)), name) + (" Proficiency" if alone else "")
    name = clean(name.replace("&colon;", ":")).strip(" :-–")
    name = re.sub(r"\s*\((?:passive feature|Melee|Ranged|class action)\)", "", name)
    return re.sub(r"\(\s+", "(", name).strip()


def remember(label, page):
    """Note which page a feature name leads to. Links back into the class page itself say nothing."""
    page = page.split("#")[0].strip().replace("_", " ")
    label = tidy(label)
    if page and label and page not in CLASSES and label not in PAGE_OF:
        PAGE_OF[label] = page


def resource(code, plural):
    """Name of a class resource from the code the wiki's {{R}} template takes ("ki" is "Ki Points")."""
    key = (code.strip().lower(), plural)
    if key not in RESOURCES:
        text = "{{R|" + code.strip() + ("|forceplural=yes" if plural else "") + "}}"
        out = api(action="expandtemplates", text=text, prop="wikitext").get("expandtemplates", {}).get("wikitext", "")
        out = re.sub(r"\[\[File:[^\]]*\]\]|&#8239;", "", out)
        RESOURCES[key] = clean(out) or code.strip()
    return RESOURCES[key]


def resource_sub(m):
    parts = [x.strip() for x in m.group(1).split("|")]
    if any(re.match(r"icon\s*only", x, re.I) for x in parts[1:]):
        return ""
    return resource(parts[0].split(":")[0], any(x.lower().startswith("forceplural") for x in parts[1:]))


def icon_link(m):
    """{{Icon link|picture|page|label}}: keep the label, remember the page."""
    args = [x.strip() for x in m.group(1).split("|") if "=" not in x]
    label = args[-1] if args else ""
    if len(args) >= 2:
        remember(label, args[1])
    return label


def feature_sub(m):
    remember(m.group(2) or m.group(1), m.group(1))
    return m.group(2) or m.group(1)


def plain(text):
    """Icon templates carry a file name first; keep only the label a reader would see."""
    for m in ACTION_TEMPLATE.finditer(text):
        ACTIONS.add(tidy(m.group(2) or m.group(1)))
    text = re.sub(r"\[\[File:[^\]]*\]\]", "", text, flags=re.I)
    text = re.sub(r"\{\{\s*(?:Icon|DieIcon|SpellSlot)\s*\|[^{}]*\}\}", "", text, flags=re.I)
    text = re.sub(r"\{\{\s*(?:Sm|Md|Lg)?Icon ?link\s*\|([^{}]*)\}\}", icon_link, text, flags=re.I)
    text = re.sub(r"\{\{\s*(?:R|Resource)\s*\|([^{}]*)\}\}", resource_sub, text, flags=re.I)
    text = re.sub(r"\{\{\s*Anchor\s*\|[^{}]*\}\}", "", text, flags=re.I)
    for page, label in re.findall(r"\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]", text):
        remember(label, page)
    for page in re.findall(r"\[\[([^\]|#]+)\]\]", text):
        remember(page, page)
    return FEATURE_TEMPLATE.sub(feature_sub, text)


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
            plain(raw)  # remembers the page of each feature
            for n in found:
                add(n)
        elif raw.startswith(";"):
            # "Superiority Dice: 4" keeps its number; any other text after the colon is an explanation
            add(re.sub(r"&colon;(?!\s*\d+\s*$).*$", "", plain(raw[1:])))
        elif raw.startswith("*") and not raw.startswith("**"):
            add(plain(raw.lstrip("* ")))
    return out


def grid(table, multiline=False):
    """Rows of a wikitable as lists of cell texts, with rowspan and colspan expanded.

    With multiline, text on the lines after a cell marker stays part of that cell.
    """
    rows, pending = [], {}
    for raw in re.split(r"\n\|-[^\n]*", table):
        cells = []
        for line in raw.split("\n"):
            if line.startswith("|}") or line.startswith("{|") or line.startswith("|+"):
                continue
            if not line or line[0] not in "!|":
                if multiline and cells and line.strip():
                    cells[-1] = (cells[-1][0] + "\n" + line.strip(), cells[-1][1], cells[-1][2])
                continue
            for part in re.split(r"\s*(?:!!|\|\|)\s*", line[1:]):
                m = re.match(r'\s*((?:(?:style|rowspan|colspan|class|scope)\s*=\s*(?:"[^"]*"|\w+)\s*)+)\|(?!\|)(.*)$', part, re.S)
                attrs, text = (m.group(1), m.group(2)) if m else ("", part)
                rs = re.search(r'rowspan\s*=\s*"?(\d+)', attrs)
                cs = re.search(r'colspan\s*=\s*"?(\d+)', attrs)
                cells.append((text.strip(), int(rs.group(1)) if rs else 1, int(cs.group(1)) if cs else 1))
        if not cells:
            continue
        row, col = [], 0
        while cells or col in pending:
            if col in pending:
                text, left = pending[col]
                row.append(text)
                if left > 1:
                    pending[col] = (text, left - 1)
                else:
                    del pending[col]
                col += 1
                continue
            text, rs, cs = cells.pop(0)
            for _ in range(cs):
                row.append(text)
                if rs > 1:
                    pending[col] = (text, rs - 1)
                col += 1
        rows.append(row)
    return rows


SLOT_COLUMN = re.compile(r"^(\d)(?:st|nd|rd|th)$")
SKIP_COLUMNS = {"level", "proficiency bonus", "features", "subclass"}


def class_table(w):
    """The class progression table: features per level, and the numbers of its other columns.

    Returns (levels, cols, table, slots): {level: [feature]}, the names of the number columns,
    {level: [value per column]} and {level: [slots of spell level 1, 2, ...]}.
    """
    levels, cols, table, slots = {}, [], {}, {}
    m = re.search(r"==\s*Class progression\s*==(.*?)\n\|\}", w, re.S | re.I)
    rows = grid(m.group(1)) if m else []
    header = next((r for r in rows if any(clean(c).lower() == "features" for c in r)), [])
    names = [clean(plain(c)) for c in header]
    col_ix = [i for i, n in enumerate(names) if n.lower() not in SKIP_COLUMNS and not SLOT_COLUMN.match(n)]
    slot_ix = [i for i, n in enumerate(names) if SLOT_COLUMN.match(n)]
    feat_ix = next((i for i, n in enumerate(names) if n.lower() == "features"), 2)
    cols = [names[i] for i in col_ix]
    for row in rows:
        lv = re.search(r"\[\[\w*#Level (\d+)\|", row[0]) if row else None
        if not lv or len(row) < len(names):
            continue
        n = int(lv.group(1))
        found = []
        for piece in re.split(r",(?![^{]*\}\})(?![^\[]*\]\])", plain(row[feat_ix])):
            text = tidy(piece)
            if text and not re.fullmatch(r"[\d+\-–\s]*", text) and text not in found:
                found.append(text)
        levels[n] = found
        if cols:
            table[n] = [("" if clean(row[i]) in ("-", "–") else clean(row[i])) for i in col_ix]
        if slot_ix:
            slots[n] = [int(clean(row[i])) if clean(row[i]).isdigit() else 0 for i in slot_ix]
    return levels, cols, table, slots


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


def rclean(text):
    """clean(), with resource codes ({{R|ki}}) written out as their names first."""
    return clean(re.sub(r"\{\{\s*(?:R|Resource)\s*\|([^{}]*)\}\}", resource_sub, text, flags=re.I))


def describe(w):
    """What a feature does, from its page: the in-game description, else the wiki's summary, else its first sentence."""
    if re.search(r"\{\{\s*Disambig", w, re.I):
        return ""
    text = " ".join(x for x in (rclean(field(w, "description")), rclean(field(w, "extra description"))) if x)
    if not text:
        text = rclean(field(w, "summary"))
    if not text:
        for line in w.split("\n"):
            line = line.strip()
            if len(line) > 60 and re.match(r"['A-Za-z]", line) and not line.startswith("File:"):
                text = rclean(re.sub(r"\{\{\s*ref\s*\|.*?\}\}(?=[ .]|$)", "", line))
                break
    text = re.sub(r"\s*;\s*", " ", text)
    return short(text, 340)


def descriptions(data):
    """{feature name: what it does} for every feature a class or subclass grants."""
    names = set()
    for d in data.values():
        for feats_ in list(d["levels"].values()) + [f for s in d["subclasses"].values() for f in s.values()]:
            names.update(feats_)
    wanted = {n: PAGE_OF.get(n) or PAGE_OF.get(re.sub(r"\s*\([^)]*\)$", "", n)) or n for n in names
              if not re.match(r"(feats?|choose a subclass|subclass features?)$", n, re.I) and not re.search(r"^(choose|select|you )|\d$", n, re.I)}
    pages = page_texts(list(set(wanted.values())))
    out = {}
    for n, page in sorted(wanted.items()):
        text = describe(pages.get(page, ""))
        # a page shared by many features (the Spells page behind "Spellcasting") says nothing about this one
        if text and not text.startswith("Spells are "):
            out[n] = text
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("Reading class pages…")
    pages = page_texts(CLASSES + ["Feats"])
    data, wanted = {}, {}
    for c in CLASSES:
        w = pages.get(c, "")
        level, subs = subclass_list(w)
        levels, cols, table, slots = class_table(w)
        data[c] = {"levels": levels, "subclassLevel": level, "subclasses": {}, "cols": cols, "table": table, "slots": slots}
        for s in subs:
            wanted[s] = c
    print(f"Reading {len(wanted)} subclass pages…")
    sub_pages = page_texts(list(wanted))
    for s, c in wanted.items():
        data[c]["subclasses"][s] = subclass_levels(sub_pages.get(s, ""))
    feat_list = feats(pages.get("Feats", ""))
    print("Reading what each feature does…")
    features = descriptions(data)

    row = lambda d: json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    js = ("// What each class and subclass gains per level, the numbers of the class tables, what each feature does, and the feats.\n"
          "// Generated by tools/update_classes.py from bg3.wiki; do not edit by hand, re-run the script instead.\n"
          "// BG3_CLASSES[class] = { levels: {class level: [features]}, subclassLevel, subclasses: {name: {class level: [features]}},\n"
          "//   cols: [names of the number columns], table: {class level: [value per column]}, slots: {class level: [slots per spell level]} }\n"
          "// BG3_FEATS = [[name, what it does], ...] · BG3_FEATURES = {feature name: what it does}\n"
          "// BG3_ACTIONS = [features that are used as an action, bonus action or reaction, rather than always on]\n"
          f"window.BG3_CLASSES_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_CLASSES = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
          "window.BG3_FEATS = [\n" + ",\n".join("  " + row(f) for f in feat_list) + "\n];\n"
          "window.BG3_FEATURES = {\n" + ",\n".join("  " + json.dumps(k, ensure_ascii=False) + ":" + json.dumps(v, ensure_ascii=False) for k, v in features.items()) + "\n};\n"
          "window.BG3_ACTIONS = " + json.dumps(sorted(n for n in ACTIONS if n in features), ensure_ascii=False) + ";\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)

    print(f"Wrote {OUT} ({len(js) // 1024} KB): {len(feat_list)} feats, {len(features)} feature descriptions")
    for c in CLASSES:
        d = data[c]
        empty = [s for s, lv in d["subclasses"].items() if not lv]
        print(f"  {c}: {len(d['levels'])} levels, subclass at {d['subclassLevel']}, columns {d['cols']}, slots {'yes' if d['slots'] else 'no'}"
              + (f" | NO FEATURES FOUND: {empty}" if empty else ""))


if __name__ == "__main__":
    main()
