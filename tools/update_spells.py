"""Rebuild spells.js, the planner's spell reference, from bg3.wiki.

Run from anywhere:  py tools/update_spells.py
Needs only the Python standard library and an internet connection. Takes well under a minute.

Reads every page in the wiki's "Spells" category. Spells that only creatures use and the per-option
variants of a spell (for example each "Bestow Curse: ..." choice) are left out; when the damage of a spell
depends on the option chosen (Chromatic Orb, Spirit Guardians), the options' damage is kept with the spell.
"""
import io, json, os, re, sys, time

from update_items import THUMBS, THUMB_SIZE, api, clean, drop_empty, field, names, record, remember_thumb, short

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spells.js")
CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"]
# The wiki's predefined range values, as the game shows them.
RANGE_WORD = {"self": "Self", "melee": "Melee · 1.5 m", "ranged": "18 m", "weapon": "Weapon range"}
yes = lambda v: v.strip().lower() in ("yes", "y", "true", "t", "1")


def spell_pages():
    out, cont = {}, {}
    while True:
        d = api(action="query", generator="categorymembers", gcmtitle="Category:Spells", gcmnamespace=0, gcmlimit=50,
                prop="revisions|pageimages", rvprop="content", rvslots="main", piprop="thumbnail", pithumbsize=THUMB_SIZE, pilimit=50, **cont)
        for p in d.get("query", {}).get("pages", {}).values():
            remember_thumb(p)
            if "revisions" in p:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
        if "continue" not in d:
            return out
        cont = d["continue"]
        print(f"  {len(out)} pages…")


def learners(w):
    """Who learns the spell and at which class level, from the "class/race learns at level N" fields."""
    out = []
    for kind, level, value in re.findall(r"^\|\s*(class|race) learns at level (\d+)\s*=[ \t]*(.*)$", w, re.M):
        for entry in value.split(","):
            who, _, note = entry.partition(":")
            who = clean(who)
            # Magical Secrets lets a Bard take any spell; listing it would put every spell on the Bard list
            if who and "Magical Secrets" not in note:
                out.append([who, int(level)])
    return sorted(out, key=lambda e: (e[1], e[0]))


# {{#invoke: Damage display | main | damage 1 = weapon | damage 2 = 1d8 | damage 2 type = Thunder | … }}
DISPLAY = re.compile(r"\s*\{\{\s*#invoke:\s*Damage display\s*\|\s*main(.*?)\}\}", re.S | re.I)


def display(m):
    """A "Damage display" block as text: "weapon damage + 1d8 Thunder + 2d8 Thunder (when the target moves)"."""
    body = "\n" + m.group(1)
    parts = []
    for n in ("1", "2", "3", "4"):
        dice = clean(field(body, "damage " + n))
        if not dice:
            continue
        info = clean(field(body, "damage " + n + " info"))
        text = "weapon damage" if dice.lower() == "weapon" else " ".join(x for x in (dice, clean(field(body, "damage " + n + " type"))) if x)
        parts.append(text + (" (" + info[0].lower() + info[1:] + ")" if info else ""))
    return " " + " + ".join(parts)


def turns(value):
    """A duration field as text: "10" becomes "10 turns", wording such as "Until Long Rest" is kept."""
    value = clean(value)
    if not value:
        return ""
    if value.isdigit():
        return value + (" turn" if value == "1" else " turns")
    return value[0].upper() + value[1:]


def conditions(w):
    """Conditions the spell applies, as [name, duration, saving throw that ends or resists it]."""
    out = []
    for n in ("", " 1", " 2", " 3", " 4", " 5"):
        name = clean(field(w, "condition" + n))
        if name:
            out.append([name, turns(field(w, "condition" + n + " duration")), clean(field(w, "condition" + n + " save"))])
    return out


def feature(w):
    """The page from its "Feature page" block on, or nothing when it has none."""
    m = re.search(r"\{\{\s*Feature page", w, re.I)
    return w[m.start():] if m else ""


def damage_lines(w):
    """The spell's own damage lines, as text: "1d10 Piercing", "2d6 Cold (DEX Saving Throw to negate)"."""
    out = []
    # the "Damage display" blocks inside "higher levels" carry lines of the same name
    own = re.sub(DISPLAY, "", w)
    for n in ("", " 1", " 2", " 3", " 4", " 5"):
        # "D8Cantrip" is the wiki's code for a cantrip die that grows with the character: 1d8 at first
        dice = re.sub(r"^[dD](\d+)Cantrip$", r"1d\1", clean(field(own, "damage" + n)))
        kind = clean(field(own, "damage" + n + " type"))
        text = "Weapon damage" if dice.lower() == "weapon" else " ".join(x for x in (dice, kind) if x)
        info = clean(field(own, "damage" + n + " info"))
        if text:
            # the note starts in lower case, unless it opens with an abbreviation such as DEX
            out.append(text + (" (" + (info if info[:2].isupper() else info[0].lower() + info[1:]) + ")" if info else ""))
    return out


def variants(title, w, pages):
    """The options of a spell that deal damage of their own, as [option, damage line, the option's page]:
    "Chromatic Orb: Thunder" gives ["Thunder", "3d8 Thunder", …]."""
    out = []
    for v in (x.strip() for x in field(w, "variants").split(",")):
        vw = feature(pages.get(v, ""))
        lines = damage_lines(vw) if vw else []
        if not lines or all(x.lower().startswith("weapon damage") for x in lines):
            continue
        label = re.sub(r"^" + re.escape(title) + r"\s*[:(]\s*", "", clean(field(vw, "name")) or v).rstrip(")").strip()
        out.append([label, ", ".join(lines), vw])
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("Reading spell pages…")
    spells, skipped = [], {"creature only": 0, "variant of another spell": 0, "no level": 0}
    pages = spell_pages()
    for title, w in pages.items():
        w = feature(w)
        if not w:
            continue
        if yes(field(w, "npc only")):
            skipped["creature only"] += 1
            continue
        if field(w, "variant of"):
            skipped["variant of another spell"] += 1
            continue
        level = field(w, "level").lower()
        if level not in ("cantrip", "1", "2", "3", "4", "5", "6"):
            skipped["no level"] += 1
            continue
        cost = [c.strip().lower() for c in field(w, "cost").split(",")]
        flags = field(w, "spell flags")
        learn = learners(w)
        classes = sorted({c for c in (clean(x) for x in field(w, "classes").split(",")) if c in CLASSES} | {who for who, _ in learn if who in CLASSES})
        range_m = field(w, "range m")
        aoe_m, aoe = field(w, "aoe m"), field(w, "aoe").lower()
        area_m, area_shape = field(w, "area m"), field(w, "area shape").lower()
        damage = damage_lines(w)
        options = [] if damage else variants(title, w, pages)
        # what a passed save does: the spell's own field, else what its first damaging option says
        on_save = clean(field(w, "on save"))
        for _, _, vw in options:
            said = re.search(r"[^.;]*Saving Throw[^.;]*(?:half|negat)[^.;]*\.", clean(field(vw, "description")))
            on_save = on_save or clean(field(vw, "on save")) or (said.group(0).strip() if said else "")
        # a spell cast around the caster on everyone it names ("Enemies only") reaches as far as its range
        if not aoe and range_m and field(w, "uid").startswith("Shout_") and field(w, "targets") and damage:
            aoe_m, aoe = range_m, "radius"
        conds = conditions(w)
        # how long the effect lasts: an explicit duration, else that of the summon, the area or the first condition
        duration = turns(field(w, "duration")) or turns(field(w, "creature duration")) or turns(field(w, "area duration")) or next((c[1] for c in conds if c[1]), "")
        # the options of a spell may carry what it has none of its own: how long the first damaging one lasts
        for _, _, vw in options:
            duration = duration or turns(field(vw, "duration")) or next((c[1] for c in conditions(vw) if c[1]), "")
        spells.append({
            "n": clean(field(w, "name")) or title,
            "p": title,
            "i": THUMBS.get(title, ""),
            "lv": 0 if level == "cantrip" else int(level),
            "sc": clean(field(w, "school")).capitalize(),
            "a": "reaction" if "reaction" in cost else "bonus" if "bonus" in cost else "action",
            # a smite is cast with the attack and takes a bonus action more when it hits
            "ah": "bonus" if "bonus" in field(w, "hit cost").lower() else "",
            "rg": (range_m + " m") if range_m else RANGE_WORD.get(field(w, "range").lower(), ""),
            "ao": (aoe_m + " m " + aoe).strip() if aoe else "",
            "du": duration,
            "co": yes(field(w, "concentration")),
            "ri": yes(field(w, "ritual")),
            "sv": clean(field(w, "save")).upper(),
            "os": short(on_save, 140),
            "at": bool(field(w, "attack roll").strip()),
            "dm": ", ".join(damage),
            "vr": [[a, b] for a, b, _ in options],
            # a save DC the notes say is fixed, whoever casts it: [what it is for, DC, ability when named]
            "fd": [[x.strip(), int(n), ab[:3].upper()] for x, n, ab in re.findall(r"DC for ([^.;]*?) is fixed at (\d+)(?: \((\w+)\))?", clean(field(w, "notes")) + "; " + clean(field(w, "bugs")))],
            "tg": short(clean(field(w, "targets")), 120),
            "rc": clean(field(w, "recharge")).capitalize(),
            "cn": conds,
            "ar": " ".join(x for x in (clean(field(w, "area")), (area_m + " m " + area_shape).strip() if area_m else "", "for " + turns(field(w, "area duration")).lower() if field(w, "area duration") else "") if x),
            "sm": " ".join(x for x in (clean(field(w, "creature")), "for " + turns(field(w, "creature duration")).lower() if field(w, "creature duration") else "") if x),
            # a die picture leaves its own name before the bonus ("d4 +1d4"): keep the bonus
            "d": re.sub(r"\bd(\d+) \+(\d+)d\1\b", r"+\2d\1", short(clean(field(w, "description")), 420)),
            "xd": short(clean(field(w, "extra description")), 300),
            # the blocks are written out first: their "| damage 1 = …" lines would end the field early
            "hl": short(clean(field(re.sub(DISPLAY, display, w), "higher levels")), 260),
            "vb": "HasVerbalComponent" in flags,
            "sb": yes(field(w, "scribing")),
            "cl": classes,
            "lr": learn,
            "ft": short(", ".join(names(field(w, "granted by feats")) + names(field(w, "granted by features"))), 160),
            "it": short(", ".join(clean(x.split(":")[0]) for x in field(w, "granted by items").split(",") if x.strip()), 160),
        })

    spells.sort(key=lambda s: (s["lv"], s["n"].lower()))
    for s in spells:
        drop_empty(s, keep=("n", "lv"))
        if s.get("p") == s["n"]:
            del s["p"]
    body = ",\n".join("  " + json.dumps(s, ensure_ascii=False, separators=(",", ":")) for s in spells)
    js = ("// Spell reference for the planner's Spells tab. Generated by tools/update_spells.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead. Fields that would be empty are left out.\n"
          "// n name · p wiki page when it differs · i picture (path under bg3.wiki/w/images/) · lv level (0 = cantrip) · sc school\n"
          "// a action cost · rg range · ao area of effect · du duration · co concentration · ri ritual · sv saving throw · os on a save\n"
          "// at attack roll · dm damage · vr [option, damage] when the damage depends on the option chosen · tg who it targets\n"
          "// fd save DCs the wiki's notes give as fixed: [what for, DC, ability]\n"
          "// rc recharge · cn conditions as [name, duration, save] · ar area created · sm summon\n"
          "// d description · xd more description · hl at higher levels · vb verbal component · sb can be learned from a scroll\n"
          "// cl classes · lr [who learns it, class level] · ft feats and features that grant it · it items that grant it\n"
          f"window.BG3_SPELLS_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_SPELLS = [\n" + body + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    record("spells")

    by_level = {}
    for s in spells:
        by_level[s["lv"]] = by_level.get(s["lv"], 0) + 1
    print(f"Wrote {len(spells)} spells to {OUT} ({len(js) // 1024} KB)")
    print("  by level:", dict(sorted(by_level.items())))
    print("  learnable by a class:", sum(1 for s in spells if s.get("cl")), "| skipped:", skipped)
    print("  damage by option:", ", ".join(s["n"] for s in spells if s.get("vr")), "| with targets:", ", ".join(s["n"] for s in spells if s.get("tg")))
    print("  with picture:", sum(1 for s in spells if s.get("i")), "| with duration:", sum(1 for s in spells if s.get("du")), "| with range:", sum(1 for s in spells if s.get("rg")))


if __name__ == "__main__":
    main()
