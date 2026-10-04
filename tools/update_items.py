"""Rebuild items.js, the planner's local item database, from bg3.wiki.

Run from anywhere:  py tools/update_items.py
Needs only the Python standard library and an internet connection. Takes about a minute.

How it works: bg3.wiki is a MediaWiki site with a public API. Its structured item tables are not open
to anonymous queries, so this reads the wikitext of every page built on the "Equipment page" and "Weapon page"
templates (about 50 pages per request) and keeps the fields the planner filters on. Each item's act
comes from the "act" field of its location's page.
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request

API = "https://bg3.wiki/w/api.php"
UA = {"User-Agent": "bg3-planner item database builder (personal, non-commercial tool)"}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "items.js")
PAUSE = 0.4  # seconds between requests, to stay polite

RARITY = {"common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "veryrare", "veryrare": "veryrare", "legendary": "legendary"}
ACTS = {"one": 1, "two": 2, "three": 3, "1": 1, "2": 2, "3": 3}
# Locations whose wiki page has no act field.
ACT_OVERRIDE = {"Nautiloid": 1, "Campsite (Act One)": 1, "Campsite (Act Two)": 2, "Campsite (Act Three)": 3, "Astral Plane": 3}
# Simple or martial is a property of the weapon type; the per-item field on the wiki is not always filled in.
SIMPLE = {"Clubs", "Daggers", "Darts", "Greatclubs", "Handaxes", "Javelins", "Light Crossbows", "Light Hammers", "Maces", "Quarterstaves", "Shortbows", "Sickles", "Slings", "Spears"}
WEAPON_PROPS = [("finesse", "Finesse"), ("light", "Light"), ("heavy", "Heavy"), ("reach", "Reach"), ("thrown", "Thrown")]
EQUIP_SLOT = {"Helmets": "head", "Cloaks": "cloak", "Clothing": "chest", "Light Armour": "chest", "Medium Armour": "chest", "Heavy Armour": "chest",
              "Gloves": "gloves", "Boots": "boots", "Amulets": "amulet", "Rings": "ring", "Shields": "shield"}


def api(**params):
    params["format"] = "json"
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(PAUSE)
                return json.load(r)
        except Exception as err:  # transient network errors: wait and retry
            if attempt == 3:
                raise
            print("  retrying after error:", err)
            time.sleep(3 * (attempt + 1))


def pages_using(template):
    """Wikitext of every main-namespace page that transcludes the template, as {title: text}.

    The thumbnail of each page's main image is collected into THUMBS on the way.
    """
    out, cont = {}, {}
    while True:
        d = api(action="query", generator="embeddedin", geititle="Template:" + template, geinamespace=0, geilimit=50,
                prop="revisions|pageimages", rvprop="content", rvslots="main", piprop="thumbnail", pithumbsize=THUMB_SIZE, pilimit=50, **cont)
        for p in d.get("query", {}).get("pages", {}).values():
            remember_thumb(p)
            if "revisions" in p:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
        if "continue" not in d:
            return out
        cont = d["continue"]
        print(f"  {template}: {len(out)} pages…")


# Thumbnails are stored without this prefix; the planner adds it back when it shows the picture.
IMAGE_BASE = "https://bg3.wiki/w/images/"
THUMB_SIZE = 96
THUMBS = {}


def remember_thumb(page):
    src = (page.get("thumbnail") or {}).get("source", "")
    if src.startswith(IMAGE_BASE):
        THUMBS[page["title"]] = src[len(IMAGE_BASE):]


def names(value):
    """A comma-separated template value as a list of clean names."""
    return [n for n in (clean(x) for x in value.split(",")) if n]


def drop_empty(record, keep=("n",)):
    for k in [k for k, v in record.items() if v in ("", False, [], None) and k not in keep]:
        del record[k]


def page_texts(titles):
    """Wikitext for specific titles, following redirects. Returns {requested title: text}."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = api(action="query", prop="revisions", rvprop="content", rvslots="main", redirects=1, titles="|".join(chunk))["query"]
        alias = {r["from"]: r["to"] for k in ("normalized", "redirects") for r in d.get(k, [])}
        by_title = {p["title"]: p["revisions"][0]["slots"]["main"]["*"] for p in d["pages"].values() if "revisions" in p}
        for t in chunk:
            final = t
            for _ in range(3):
                final = alias.get(final, final)
            if final in by_title:
                out[t] = by_title[final]
    return out


def field(text, key):
    """Value of a template parameter ("| key = value"), which may span several lines."""
    m = re.search(r"^\|\s*" + re.escape(key) + r"\s*=[ \t]*(.*(?:\n(?!\s*\||\s*\}\}).*)*)", text, re.M)
    return m.group(1).strip() if m else ""


def template_body(text, name):
    """The page text from the item template onwards, so parameters of other templates above it are not picked up."""
    m = re.search(r"\{\{\s*" + name.replace("Page", r"\s*page"), text, re.I)
    return text[m.start():] if m else text


def unobtainable(text):
    return re.search(r"\{\{\s*unobtainable", text, re.I) is not None


def clean(s):
    """Wikitext to plain text: {{CharLink|Omeluum}} becomes "Omeluum", [[a|b]] becomes "b"."""
    s = re.sub(r"(\w)\{\{", r"\1 {{", s)
    prev = None
    while prev != s:
        prev = s

        def sub(m):
            parts = [x.strip() for x in m.group(1).split("|")]
            name = parts[0].lower()
            named = {k.strip(): v.strip() for k, v in (x.split("=", 1) for x in parts[1:] if re.match(r"^[\w ]+=", x))}
            args = [x for x in parts[1:] if not re.match(r"^[\w ]+=", x)]
            if name in ("see bugs", "seebugs", "ref", "note"):
                return ""
            if name in ("temp hp", "temphp") and args:
                return args[0] + " temporary hit points"
            if name == "dist":
                return named["m"] + " m" if named.get("m") else named.get("ft", "") + " ft"
            if name in ("damagetext", "damage text") and len(args) > 1:
                return args[0] + " " + args[1]
            if name in ("saving throw", "savingthrow"):
                return (args[0] + " " if args else "") + "Saving Throw"
            if name == "ability check":
                return (args[0] + " " if args else "") + "Check"
            return args[0] if args else re.sub(r"([a-z])([A-Z])", r"\1 \2", parts[0])
        s = re.sub(r"\{\{([^{}]*)\}\}", sub, s)
    s = re.sub(r"\{\{[^}]*$", "", s)  # a template call cut off by the field boundary
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'{2,}|<[^>]+>", "", s)
    s = re.sub(r"^\s*\*+\s*", "", s, flags=re.M)
    return re.sub(r"\s+", " ", re.sub(r"\s*\n\s*", "; ", s)).strip()


def short(s, n):
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    items, skipped = [], {}

    print("Reading equipment pages…")
    for title, w in pages_using("Equipment page").items():
        if unobtainable(w):
            skipped["(unobtainable)"] = skipped.get("(unobtainable)", 0) + 1
            continue
        w = template_body(w, "EquipmentPage")
        kind = clean(field(w, "type"))
        slot = EQUIP_SLOT.get(kind)
        if not slot:
            skipped[kind] = skipped.get(kind, 0) + 1
            continue
        ac = clean(field(w, "armour class"))
        items.append({"n": title, "s": slot, "t": kind, "p": clean(field(w, "proficiency")), "r": RARITY.get(clean(field(w, "rarity")).lower(), "common"),
                      "l": clean(field(w, "where to find location")), "h": short(clean(field(w, "where to find")), 160), "d": ("AC " + ac) if ac else "",
                      "x": short(clean(field(w, "description")), 240), "i": THUMBS.get(title, ""),
                      "ps": names(field(w, "passives")), "sp": short(clean(field(w, "special")), 220),
                      "sd": clean(field(w, "stealth disadvantage")).lower() in ("yes", "true"),
                      "ab": clean(field(w, "armour class bonus")).lstrip("+"),
                      "wt": clean(field(w, "weight kg")), "pr": clean(field(w, "price"))})

    print("Reading weapon pages…")
    for title, w in pages_using("Weapon page").items():
        if unobtainable(w):
            skipped["(unobtainable)"] = skipped.get("(unobtainable)", 0) + 1
            continue
        w = template_body(w, "WeaponPage")
        kind = clean(field(w, "type"))
        if not kind:
            skipped["(weapon without type)"] = skipped.get("(weapon without type)", 0) + 1
            continue
        ranged = clean(field(w, "melee or ranged")).lower().startswith("ranged")
        hand = clean(field(w, "handedness")).lower()
        dmg = " ".join(x for x in (clean(field(w, "damage")), clean(field(w, "damage type"))) if x)
        items.append({"n": title, "s": "ranged" if ranged else "melee", "t": kind, "c": "simple" if kind in SIMPLE else "martial",
                      "w": "two" if hand.startswith("two") else "versatile" if hand.startswith("vers") else "one",
                      "r": RARITY.get(clean(field(w, "rarity")).lower(), "common"),
                      "l": clean(field(w, "where to find location")), "h": short(clean(field(w, "where to find")), 160), "d": dmg,
                      "x": short(clean(field(w, "description")), 240), "i": THUMBS.get(title, ""),
                      "ps": [n for k in ("passives", "weapon passives", "passives main hand", "passives off hand") for n in names(field(w, k))],
                      "wa": [n for k in ("weapon actions", "special weapon actions") for n in names(field(w, k))],
                      "pp": [label for key, label in WEAPON_PROPS if clean(field(w, key)).lower() in ("yes", "true")],
                      "vd": clean(field(w, "versatile damage")), "en": clean(field(w, "enchantment")), "sp": short(clean(field(w, "special")), 220),
                      "wt": clean(field(w, "weight kg")), "pr": clean(field(w, "price"))})

    print("Reading location pages for the act of each item…")
    locs = {it["l"] for it in items if it["l"]}
    acts = {}
    for loc, w in page_texts(locs).items():
        acts[loc] = ACTS.get(clean(field(w, "act")).lower(), 0)
    acts.update(ACT_OVERRIDE)
    # Items without a location field often name the place in their description ("Sold by Greymon at Grymforge").
    named = sorted((l for l in acts if acts[l] and len(l) > 5), key=len, reverse=True)
    for it in items:
        it["a"] = acts.get(it["l"], 0)
        if not it["a"] and it["h"]:
            hit = next((l for l in named if l in it["h"]), None)
            if hit:
                it["a"] = acts[hit]
        if not it["a"] and re.search(r"Netherbrain|Upper City|High Hall", it["h"]):
            it["a"] = 3  # the final battles
        if not it["a"]:
            said = re.search(r"\bAct (One|Two|Three|[123])\b", it["h"] + " " + it["l"], re.I)
            if said:
                it["a"] = ACTS[said.group(1).lower()]

    print("Reading the passive features of the items…")
    passive_pages = page_texts({n for it in items for n in it["ps"]})
    for it in items:
        resolved = []
        for n in it["ps"]:
            w = passive_pages.get(n, "")
            label = clean(field(w, "name")) or re.sub(r"\s*\(passive feature\)$", "", n)
            resolved.append([label, short(clean(field(w, "description")), 260)])
        it["ps"] = resolved
        drop_empty(it, keep=("n", "a", "r"))

    items.sort(key=lambda it: it["n"].lower())
    body =",\n".join("  " + json.dumps(it, ensure_ascii=False, separators=(",", ":")) for it in items)
    js = ("// Item database for the planner's item picker. Generated by tools/update_items.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead.\n"
          "// n name · s slot kind · t type · p armour proficiency needed · c weapon category · w handedness\n"
          "// r rarity · a act (0 = unknown) · l location · h how to get it · d armour class or damage · x description\n"
          "// i picture (path under bg3.wiki/w/images/) · ps passives as [name, effect] · sp other effects · wa weapon actions\n"
          "// pp weapon properties · vd versatile damage · en enchantment · sd stealth disadvantage · wt weight kg · pr price\n"
          "// ab Armour Class a shield adds\n"
          "// Fields that would be empty are left out.\n"
          f"window.BG3_ITEMS_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_ITEMS = [\n" + body + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)

    by_slot, by_act = {}, {}
    for it in items:
        by_slot[it["s"]] = by_slot.get(it["s"], 0) + 1
        by_act[it["a"]] = by_act.get(it["a"], 0) + 1
    print(f"Wrote {len(items)} items to {OUT} ({len(js) // 1024} KB)")
    print("  by slot:", dict(sorted(by_slot.items())))
    print("  by act:", dict(sorted(by_act.items())), "(0 = location missing or without an act)")
    print("  skipped equipment types:", dict(sorted(skipped.items(), key=lambda kv: -kv[1])))
    print("  locations without an act:", sorted(l for l in locs if not acts.get(l))[:40])
    print("  weapon categories:", sorted({it.get("c", "") for it in items if it["s"] in ("melee", "ranged")}))
    print("  armour proficiencies:", sorted({it.get("p", "") for it in items if it["s"] not in ("melee", "ranged")}))


if __name__ == "__main__":
    main()
