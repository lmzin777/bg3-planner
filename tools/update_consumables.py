"""Rebuild consumables.js from bg3.wiki: elixirs, potions, arrows, coatings and grenades, with what each one does.

Run from anywhere:  py tools/update_consumables.py
Needs only the Python standard library and an internet connection. Takes a few seconds.
"""
import io, json, os, re, sys, time

from update_items import RARITY, THUMBS, THUMB_SIZE, api, clean, drop_empty, field, page_texts, record, remember_thumb, short

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "consumables.js")
KINDS = [("Elixirs", "Elixir"), ("Potions", "Potion"), ("Arrows", "Arrow"), ("Coatings", "Coating"), ("Grenades", "Grenade")]


def category_pages(category):
    out, cont = {}, {}
    while True:
        d = api(action="query", generator="categorymembers", gcmtitle="Category:" + category, gcmnamespace=0, gcmlimit=50,
                prop="revisions|pageimages", rvprop="content", rvslots="main", piprop="thumbnail", pithumbsize=THUMB_SIZE, pilimit=50, **cont)
        for p in d.get("query", {}).get("pages", {}).values():
            remember_thumb(p)
            if "revisions" in p:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
        if "continue" not in d:
            return out
        cont = d["continue"]


def keep_dc(text):
    """ "{{Saving Throw|Constitution|dc=11}}" as "CON Saving Throw (DC 11)": the number would be lost otherwise."""
    return re.sub(r"\{\{\s*Saving ?[Tt]hrow\s*\|\s*([A-Za-z]+)\s*\|\s*dc\s*=\s*(\d+)\s*\}\}", lambda m: m.group(1)[:3].upper() + " Saving Throw (DC " + m.group(2) + ")", text or "")


def effect(w):
    """What the item does when used: the first lines of the effect field, without the thrown variant."""
    text = keep_dc(field(w, "effect"))
    text = re.split(r"\n\s*\{\{\s*InfoBlob", text, maxsplit=1, flags=re.I)[0]  # what follows is the thrown variant
    # the bullet list of the wiki becomes sentences; range and area icons leave stray words behind
    text = re.sub(r"\.?\s*;\s*", ". ", clean(text)).strip().rstrip(".") + "."
    text = re.sub(r"\w+ Icon\.(?:png|webp)", "", re.sub(r"(?<=\. )(?:ranged|melee)\. ", "", text))
    return short(re.sub(r"\s+", " ", text), 300)


def duration(value):
    value = clean(value)
    return (value + (" turn" if value == "1" else " turns")) if value.isdigit() else value


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    items = []
    for category, kind in KINDS:
        print(f"Reading {category}…")
        for title, w in category_pages(category).items():
            m = re.search(r"\{\{\s*misc\s*item\s*page", w, re.I)
            if not m or re.search(r"\{\{\s*unobtainable", w, re.I):
                continue
            w = w[m.start():]
            items.append({"n": title, "t": kind, "r": RARITY.get(clean(field(w, "rarity")).lower(), "common"), "x": effect(w),
                          "du": duration(field(w, "condition duration")), "uc": {"bonus": "Bonus action"}.get(clean(field(w, "usage cost")).lower(), clean(field(w, "usage cost")).capitalize()), "i": THUMBS.get(title, ""),
                          "h": short(clean(field(w, "where to find")), 200), "pr": clean(field(w, "price"))})
            if kind == "Coating":
                # how long what the coating leaves on a target lasts, as its own page gives it: a number of turns,
                # or "Saving Throw" (until the save is passed)
                items[-1]["_turns"] = clean(field(w, "condition2 duration"))
                items[-1]["_notes"] = clean(field(w, "notes"))
                items[-1]["_cond"] = clean(field(w, "condition"))
    # a coating's page only says "coat your weapon": what the coated weapon does is on the page of its condition
    coats = page_texts({it["_cond"] + " (Condition)" for it in items if it.get("_cond")})
    # the condition a coated weapon leaves has a page of its own, which may say when it ends
    left = {it["n"]: clean(field(coats.get(it["_cond"] + " (Condition)", ""), "condition")) for it in items if it.get("_cond")}
    left_pages = page_texts({c + " (Condition)" for c in left.values() if c})
    for it in items:
        cond = it.pop("_cond", "")
        turns, notes = it.pop("_turns", ""), it.pop("_notes", "")
        page = coats.get(cond + " (Condition)", "") if cond else ""
        ends = clean(field(left_pages.get(left.get(it["n"], "") + " (Condition)", ""), "effects"))
        if cond:
            lasting = re.search(r"saving throw", turns, re.I) or re.search(r"lasts until [^.]*successful|ends on a successful", ends, re.I) or re.search(r"lasts until a successful", notes, re.I)
            if lasting:
                it["ct"] = -1
            elif re.search(r"\d+", turns):
                it["ct"] = int(re.search(r"\d+", turns).group(0))
        said = field(page[page.lower().find("{{condition page"):], "effects") if "{{condition page" in page.lower() else ""
        if said:
            it["cx"] = short(re.sub(r"\s+", " ", re.sub(r"\.?\s*;\s*", ". ", clean(keep_dc(said)))).strip().rstrip(".") + ".", 400)
            # the conditions it inflicts (not the "Inoculated" one a passed save gives)
            it["cs"] = [x.strip() for x in re.findall(r"\{\{\s*(?:Sm)?Cond\s*\|([^}|]+)", said) if not x.strip().startswith("Inoculated")]
    seen = set()
    items = [it for it in sorted(items, key=lambda it: it["n"].lower()) if not (it["n"] in seen or seen.add(it["n"]))]
    for it in items:
        drop_empty(it, keep=("n", "t"))
    body = ",\n".join("  " + json.dumps(it, ensure_ascii=False, separators=(",", ":")) for it in items)
    js = ("// Consumables for the planner: elixirs, potions, arrows, coatings and grenades. Generated by tools/update_consumables.py\n"
          "// from bg3.wiki; do not edit by hand, re-run the script instead.\n"
          "// n name · t kind · r rarity · x what it does · du how long it lasts · uc what using it takes (Action, Bonus action) · i picture · h where to get it · pr price\n"
          "// cx what a weapon coated with it does · cs the conditions it inflicts · ct for how many turns (-1: until the\n"
          "//   target passes the save, rolled again at the end of each of its turns)\n"
          f"window.BG3_CONSUMABLES_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_CONSUMABLES = [\n" + body + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    record("consumables")
    by_kind = {}
    for it in items:
        by_kind[it["t"]] = by_kind.get(it["t"], 0) + 1
    print(f"Wrote {len(items)} consumables to {OUT} ({len(js) // 1024} KB):", by_kind)
    print("  without effect text:", [it["n"] for it in items if not it.get("x")])


if __name__ == "__main__":
    main()
