"""Builds enemies.js: a short list of reference enemies to measure damage against.

    py tools/update_enemies.py

The list of names below is a choice (well-known fights of each act); every number comes from the creature's
infobox on bg3.wiki: its "/Combat" page when it has one, else its own page.
Two fights are a puzzle before they are a matter of numbers, and are listed in the state where damage counts:
Grym while Superheated (immune to everything otherwise), and Gerringothe Thorm with all her Coin Armour on.
Balthazar is left out: his page gives no Armour Class.
"""
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_items import clean, field, page_texts, record

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "enemies.js")
# (act, page title)
ENEMIES = [
    (1, "Goblin Warrior"), (1, "Owlbear"), (1, "Phase Spider Matriarch"), (1, "Auntie Ethel"), (1, "Priestess Gut"), (1, "Dror Ragzlin"),
    (1, "Minthara"), (1, "Bulette"), (1, "Grym"), (1, "Inquisitor W'wargaz"),
    (2, "Yurgir"), (2, "Balthazar"), (2, "Thisobald Thorm"), (2, "Gerringothe Thorm"), (2, "Malus Thorm"), (2, "Ketheric Thorm"), (2, "Apostle of Myrkul"),
    (3, "Steel Watcher Titan"), (3, "Lorroakan"), (3, "Cazador Szarr"), (3, "Viconia DeVir"), (3, "Sarevok Anchev"), (3, "Orin"), (3, "Enver Gortash"),
    (3, "Ansur"), (3, "Raphael"), (3, "The Netherbrain"),
]
ABILITIES = ("str", "dex", "con", "int", "wis", "cha")
TYPES = ("Slashing", "Piercing", "Bludgeoning", "Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder")


def number(text):
    m = re.search(r"-?\d+", text or "")
    return int(m.group(0)) if m else None


def code(level):
    """The wiki's wording of a resistance as a code: v vulnerable · r resistant · rn resistant to non-magical damage
    only · rm resistant to magical damage only · i immune · in immune to non-magical only · ip immune to non-magical
    and resistant to magical ("nm plus"). "full" and "double" mean magical and non-magical alike."""
    level = level.lower()
    if level.startswith("vuln"):
        return "v"
    kind = "i" if "immun" in level else "r"
    if re.search(r"\bnm plus\b", level):
        return "ip"
    if re.search(r"\bnm\b|non-?magical", level):
        return kind + "n"
    if kind == "r" and re.search(r"\bm\b|^magical", level):
        return "rm"
    return kind


def resistances(text):
    """ "Slashing resistant nm, Fire immunity, Cold vulnerable" → {"Slashing": "rn", "Fire": "i", "Cold": "v"}."""
    out = {}
    for part in clean(text).split(","):
        m = re.match(r"\s*(\w+)\s+((?:resist|immun|vuln).*)$", part.strip(), re.I)
        if m and m.group(1).capitalize() in TYPES:
            out[m.group(1).capitalize()] = code(m.group(2))
    return out


def resistance_icons(text):
    """The {{Resistance|Type|level}} icons of a page, as the same codes."""
    return {a.strip().capitalize(): code(b) for a, b in re.findall(r"\{\{\s*Resistance\s*\|([^|{}]+)\|([^|{}]+)", text, re.I) if a.strip().capitalize() in TYPES}


def infobox(text):
    """The first creature infobox of a page that gives an Armour Class."""
    for m in re.finditer(r"\{\{\s*Infobox creature", text, re.I):
        body = text[m.start():]
        end = re.search(r"^\}\}", body, re.M)
        body = body[:end.start()] if end else body
        if number(field(body, "ac")) is not None:
            return body
    return None


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    titles = [name for _, name in ENEMIES]
    pages = page_texts(set(titles) | {name + "/Combat" for name in titles} | {"Superheated (Condition)"})
    out, missing = [], []
    for act, name in ENEMIES:
        box = infobox(pages.get(name + "/Combat", "")) or infobox(pages.get(name, ""))
        if not box:
            missing.append(name)
            continue
        level = number(field(box, "level")) or 1
        scores = {k: number(field(box, k)) or 10 for k in ABILITIES}
        saves = [k for k in ABILITIES if clean(field(box, k + " save prof")).lower() in ("y", "yes", "true", "1", "proficient")]
        hp = {"b": number(field(box, "hp")), "t": number(field(box, "t hp")), "h": number(field(box, "h hp"))}
        out.append({"n": name, "act": act, "lv": level, "ac": number(field(box, "ac")), "hp": {k: v for k, v in hp.items() if v},
                    "ab": scores, "sv": saves, "pb": number(field(box, "prof bonus")) or 2 + (level - 1) // 4, "res": resistances(field(box, "resistances"))})
        e = out[-1]
        if name == "Grym":
            # immune to everything until lava softens it: the state in which it can be damaged is the one listed
            heated = resistance_icons(pages.get("Superheated (Condition)", ""))
            if not heated:
                raise SystemExit("The Superheated condition no longer lists Grym's resistances")
            e.update({"n": "Grym (Superheated)", "res": heated, "note": "Only while Superheated, standing in lava. Otherwise Grym is immune to all damage."})
        if name == "Gerringothe Thorm":
            # her hit points are her armour: 100 for each piece of Coin Armour, one piece lost for each Visage killed
            pieces = len(re.findall(r"\bCoin (?:Cuirass|Cuisse|Helmet|Vambrace)", field(box, "conditions")))
            if not pieces or not re.search(r"100 maximum hit points per instance", field(box, "hp")):
                raise SystemExit("Gerringothe Thorm's Coin Armour is no longer described the same way")
            e["hp"] = {"b": e["hp"]["b"] + 100 * pieces}
            e["note"] = f"With all {pieces} pieces of Coin Armour. She loses 100 hit points for each Visage killed."
        print(f"  act {act} · {name}: level {e['lv']}, AC {e['ac']}, HP {e['hp']}, saves {e['sv']} +{e['pb']}, {e['res']}")
    if missing:
        print("  without a creature infobox with an Armour Class (left out):", ", ".join(missing))
    body = ",\n".join("  " + json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in out)
    js = ("// Reference enemies to measure damage against. Generated by tools/update_enemies.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead.\n"
          "// n name · act · lv level · ac Armour Class · hp hit points (b balanced, t tactician, h honour) · ab ability scores\n"
          "// sv saving throws it is proficient in · pb proficiency bonus · res damage types: r resistant, rn resistant to\n"
          "// non-magical damage only, rm resistant to magical only, i immune, in immune to non-magical only,\n"
          "// ip immune to non-magical and resistant to magical, v vulnerable · note what to know about the fight\n"
          "window.BG3_ENEMIES = [\n" + body + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    record("enemies")
    print(f"Wrote {len(out)} enemies to {OUT}")


if __name__ == "__main__":
    main()
