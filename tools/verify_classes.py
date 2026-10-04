"""Cross-check classes.js against bg3.wiki.

Run from anywhere:  py tools/verify_classes.py
The wiki describes each subclass twice: on the subclass's own page (which classes.js is built from)
and in the per-level tables of the class page. This reads both and reports where they disagree,
so a parsing mistake or an out-of-date file shows up. It also checks every class has 12 levels
and that the feat levels match the rule on the Feats page.
"""
import io, json, os, re, sys

from update_classes import CLASSES, class_table, feature_names, sections, subclass_levels, subclass_list
from update_items import clean, page_texts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Lines that announce a choice or a resource rather than name a feature; both sources word them differently.
LOOSE = re.compile(r"^(choose|gain|learn|you |select|additional|spells?( known)?$|cantrips?|level \d|domain spells|oath spells|always prepared|\d)", re.I)


def loose(names):
    """Feature names reduced to what both wiki sources spell the same way."""
    out = set()
    for n in names:
        n = re.sub(r"\s*\([^)]*\)$", "", n).strip().lower()
        n = re.sub(r":.*$", "", n)
        if n and not LOOSE.match(n):
            out.add(n)
    return out


def class_page_subclasses(w):
    """Subclass features as the class page lists them: {subclass: {level: [features]}}."""
    out = {}
    for title, body in sections(w.split("Level progression", 1)[-1], 3):
        lv = re.match(r"Level (\d+)", title)
        if not lv:
            continue
        for table in re.findall(r"\{\|.*?\n\|\}", body, re.S):
            # a table may repeat "header row, feature row" for a second group of subclasses
            heads = []
            for row in re.split(r"\n\|-[^\n]*", table):
                named = []
                for cell in re.findall(r"^!(.*)$", row, re.M):
                    m = re.search(r"\{\{\s*ImageLink\s*\|[^|{}]*\|([^|{}]+)", cell) or re.search(r"\[\[([^\]|]+)", cell)
                    if m:
                        named.append(clean(m.group(1)))
                cells = re.split(r"\n\|(?!\})", row)[1:]
                if len(named) == 1 and cells:  # one subclass per row: every cell of the row describes it
                    names = feature_names("\n".join(cells))
                    if names:
                        out.setdefault(named[0], {})[int(lv.group(1))] = names
                    continue
                if named:
                    heads = named
                    continue
                if heads and len(cells) == len(heads):
                    for name, cell in zip(heads, cells):
                        names = feature_names(re.sub(r'^\s*(?:style|rowspan|colspan)="[^"]*"\s*\|', "", cell))
                        if names:
                            out.setdefault(name, {})[int(lv.group(1))] = names
    return out


def granted_spells():
    """Spells each subclass gets on its own, by class level, from the "learns at level" data in spells.js."""
    path = os.path.join(ROOT, "spells.js")
    if not os.path.exists(path):
        return {}
    text = io.open(path, encoding="utf-8").read()
    spells = json.loads("[" + text.split("window.BG3_SPELLS = [", 1)[1].rsplit("]", 1)[0] + "]")
    out = {}
    for sp in spells:
        for who, lv in sp.get("lr", []):
            out.setdefault(who, {}).setdefault(lv, []).append(sp["n"])
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    text = io.open(os.path.join(ROOT, "classes.js"), encoding="utf-8").read()
    data = json.loads(text.split("window.BG3_CLASSES = ", 1)[1].split(";\nwindow.BG3_FEATS", 1)[0])
    pages = page_texts(CLASSES)
    wanted = {s: c for c in CLASSES for s in subclass_list(pages[c])[1]}
    sub_pages = page_texts(list(wanted))
    problems = 0
    total_subs = 0
    tally = {"same": 0, "unlisted": 0, "worded": 0, "spells": 0, "choice": 0}
    notes = []
    granted = granted_spells()
    for c in CLASSES:
        w = pages[c]
        d = data.get(c)
        level, subs = subclass_list(w)
        table = class_table(w)
        issues = []
        if not d:
            issues.append("class missing from classes.js")
        else:
            if {int(k) for k in d["levels"]} != set(range(1, 13)):
                issues.append("levels in file: " + ", ".join(sorted(d["levels"])))
            if {int(k): v for k, v in d["levels"].items()} != table:
                issues.append("class table differs from the wiki now (re-run update_classes.py)")
            if d["subclassLevel"] != level or sorted(d["subclasses"]) != sorted(subs):
                issues.append(f"subclasses differ: file has {sorted(d['subclasses'])} at {d['subclassLevel']}, wiki has {sorted(subs)} at {level}")
            feat_levels = sorted(int(k) for k, v in d["levels"].items() if any(re.fullmatch(r"feats?", x, re.I) for x in v))
            expected = sorted({4, 8, 12} | ({6} if c == "Fighter" else set()) | ({10} if c == "Rogue" else set()))
            if feat_levels != expected:
                issues.append(f"feat levels {feat_levels}, expected {expected}")
        on_class_page = class_page_subclasses(w)
        for s in subs:
            total_subs += 1
            mine = {int(k): v for k, v in (d or {"subclasses": {}})["subclasses"].get(s, {}).items()}
            fresh = subclass_levels(sub_pages.get(s, ""))
            if mine != fresh:
                issues.append(f"{s}: file differs from its wiki page now (re-run update_classes.py)")
            if not mine:
                issues.append(f"{s}: no features found")
            other = on_class_page.get(s, {})
            for lv in sorted(set(mine) | set(other)):
                a, b = loose(mine.get(lv, [])), loose(other.get(lv, []))
                if a == b:
                    tally["same"] += 1
                elif not b:
                    tally["unlisted"] += 1  # the class page has no table for this subclass level, nothing to compare with
                else:
                    tally["worded"] += 1
                    notes.append(f"{s} level {lv}: subclass page {sorted(a - b)} / class page {sorted(b - a)}")
            # spells a subclass always has prepared are also recorded on each spell's own page
            for lv, names in granted.get(s, {}).items():
                have = {n.lower() for n in mine.get(lv, [])}
                missing = sorted(n for n in names if n.lower() not in have)
                tally["spells"] += len(names) - len(missing)
                if missing:  # spells picked from a list, or cast through a feature that is listed under its own name
                    tally["choice"] += len(missing)
        print(f"{c}: {len(table)} levels, subclass at level {level}, {len(subs)} subclasses" + ("" if issues else " — no errors"))
        for i in issues:
            problems += 1
            print("   !", i)
    print(f"\n{len(CLASSES)} classes and {total_subs} subclasses checked: {problems} error(s).")
    print(f"Subclass levels compared with the class pages: {tally['same']} identical, {tally['worded']} worded differently, "
          f"{tally['unlisted']} not listed on the class page. Granted spells confirmed against the spell pages: {tally['spells']} "
          f"(another {tally['choice']} are spells a subclass chooses from a list, which classes.js names as one choice).")
    if notes and "--notes" in sys.argv:
        print("\nWorded differently (usually a feature group on one page and its options on the other):")
        for n in notes:
            print("  ", n)


if __name__ == "__main__":
    main()
