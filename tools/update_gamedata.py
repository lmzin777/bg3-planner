"""Rebuild gamedata.js from bg3.wiki: what each race, subrace, background and origin character brings to
character creation, and the starting numbers of each class.

Run from anywhere:  py tools/update_gamedata.py
Needs only the Python standard library and an internet connection. Takes under a minute.

Races and subraces come from the "Racial features" and "Subraces" sections of each race page, with the text of
every passive feature read from its own page; backgrounds from the Backgrounds page; classes from the "Class
information" section of each class page; origin characters from the infobox of their page.
"""
import io, itertools, json, os, re, sys, time

from update_classes import CLASSES, describe, rclean, sections, tidy
from update_items import clean, field, page_texts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "gamedata.js")
RACES = ["Human", "Elf", "Drow", "Half-Elf", "Half-Orc", "Halfling", "Dwarf", "Gnome", "Tiefling", "Githyanki", "Dragonborn"]
ORIGINS = ["Astarion", "Gale", "Karlach", "Lae'zel", "Shadowheart", "Wyll"]
ABILITIES = [("str", "Strength"), ("dex", "Dexterity"), ("con", "Constitution"), ("int", "Intelligence"), ("wis", "Wisdom"), ("cha", "Charisma")]
SKILLS = ["Athletics", "Acrobatics", "Sleight of Hand", "Stealth", "Arcana", "History", "Investigation", "Nature", "Religion",
          "Animal Handling", "Insight", "Medicine", "Perception", "Survival", "Deception", "Intimidation", "Performance", "Persuasion"]
ARMOUR = ["Light Armour", "Medium Armour", "Heavy Armour", "Shields"]
PROF_TEMPLATE = {"simpleweaponsprof": "Simple", "martialweaponsprof": "Martial", "lightarmour": "Light Armour", "mediumarmour": "Medium Armour",
                 "heavyarmour": "Heavy Armour", "shields": "Shields"}
POINT_COST = {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}
# The two creation choices that are not a wiki page of a character.
CUSTOM = {
    "Custom (Tav)": {"text": "A fully custom character: every choice is yours."},
    "The Dark Urge": {"text": "A custom character with its own story. The background is always Haunted One; race and class are free.", "background": "Haunted One"},
}


def weapon_types():
    """Weapon type names ("Longswords"), as the item database spells them."""
    text = io.open(os.path.join(ROOT, "items.js"), encoding="utf-8").read()
    return sorted(set(re.findall(r'"s":"(?:melee|ranged)","t":"([^"]+)"', text)), key=len, reverse=True)


def title(name):
    """"Lolth-sworn drow" as the game writes it: "Lolth-Sworn Drow"."""
    return re.sub(r"[A-Za-z']+", lambda m: m.group(0)[0].upper() + m.group(0)[1:], clean(name).strip())


def top_section(w, heading):
    """Body of a level-2 section whose title matches the pattern."""
    return next((body for name, body in sections(w, 2) if re.fullmatch(heading, name.strip(), re.I)), "")


def term_name(text):
    text = re.sub(r"\{\{\s*SmallIcon\s*\|[^{}]*\}\}", "", text)
    text = re.sub(r"\{\{\s*(?:SAI|Passive|Pass)\s*\|([^{}|]+)[^{}]*\}\}", r"\1", text)
    return clean(text).strip(" :*;")


def read_features(body):
    """What a "features" section grants: speed, skills, passives (named, described later), written features,
    spells by character level, the ability they cast with, and a cantrip to choose from a class list."""
    out = {"speed": "", "skills": [], "passives": [], "features": [], "spells": [], "ability": "", "cantrip": "", "note": ""}
    body = re.split(r"={3,4}\s*NPC (?:characters|features)\s*={3,4}", body, maxsplit=1, flags=re.I)[0]
    term = None  # [name, [lines of text]]

    def close():
        nonlocal term
        if term and term[0] and term[0].lower() not in ("base racial speed", "size") and (term[1] or not out["cantrip"]):
            out["features"].append([term[0], " ".join(term[1]).strip()])
        term = None

    for raw in body.split("\n"):
        line = raw.strip()
        if not line or re.match(r"\[\[File:|\{\{\s*(?:Quote|clear|HorizontalRuleImage|div col)|=", line, re.I):
            continue
        m = re.match(r"\{\{\s*Passive\s*\|([^{}|]+)", line)
        if m:
            close()
            out["passives"].append(m.group(1).strip())
            continue
        m = re.match(r"\{\{\s*Skill\s*\|([^{}|]+)\}\}\s*Proficiency", line)
        if m:
            out["skills"].append(m.group(1).strip())
            continue
        if re.search(r"Choose 1 \[\[[^\]]*Cantrip\]\] from the \[\[(\w+)\]\]", line):
            close()
            out["cantrip"] = re.search(r"from the \[\[(\w+)\]\]", line).group(1)
            continue
        if re.match(r"\*\s*\{\{\s*SAI\s*\|[^{}]*\}\}\s*$", line) and out["cantrip"]:
            continue  # the options of that cantrip choice
        spell = re.match(r":\*.*?\{\{\s*SAI\s*\|([^{}|]+)(?:\|([^{}|=]+))?[^{}]*\}\}", line)
        level = re.search(r"level (\d+)", line, re.I)
        if spell and level and term:
            name = tidy(spell.group(2) or spell.group(1)).split(": ")[-1]
            out["spells"].append([name, int(level.group(1))])
            term[1].append(f"{name} at level {level.group(1)},")
            continue
        # a subrace that adds nothing says so in a sentence, not in a feature
        if line.startswith("*") and len(line.split()) > 6 and not re.match(r"\*\s*(?:\[\[|\{\{)", line):
            out["note"] = out["note"] or rclean(line.lstrip("* "))
            continue
        if line.startswith(";") or (line.startswith("*") and not line.startswith("**")):
            close()
            head, _, rest = line.lstrip(";* ").partition("&colon;")
            term = [term_name(head), [rclean(rest)] if rest.strip() else []]
            if "Base Racial Speed".lower() in term[0].lower():
                term[0] = "Base Racial Speed"
            continue
        if line.startswith(":") and term is not None:
            text = line.lstrip(":* ")
            speed = re.search(r"\{\{\s*dist\s*\|\s*m\s*=\s*([\d.]+)", text, re.I)
            if term[0] == "Base Racial Speed" and speed:
                out["speed"] = speed.group(1) + " m"
                continue
            use = re.search(r"spells use \[\[(\w+)\]\]", text)
            if use:
                out["ability"] = use.group(1)
                continue
            skill = re.search(r"Proficiency\]\] in the \{\{\s*Skill\s*\|([^{}|]+)", text)
            if skill:
                out["skills"].append(skill.group(1).strip())
            term[1].append(re.sub(r"\s*;\s*", " ", rclean(re.sub(r"\{\{\s*ref\s*\|.*", "", text))))
    close()
    for f in out["features"]:
        f[1] = re.sub(r",$", "", re.sub(r",\s+(?=\S+ at level)", ", ", f[1])).strip()
    return out


def grants(texts, weapons):
    """Proficiencies and skills that feature texts state: (weapon and armour proficiencies, skills, extra skill picks)."""
    prof, skills, pick = [], [], 0
    for text in texts:
        for sentence in re.split(r"(?<=[.;])\s+", text):
            if not re.search(r"proficien", sentence, re.I):
                continue
            if re.search(r"skill of your choice|additional skill|an extra skill|one skill", sentence, re.I):
                pick = 1
                continue
            if re.search(r"light (?:armour )?and medium armour", sentence, re.I):
                prof += ["Light Armour", "Medium Armour"]
            taken = sentence
            for name in ARMOUR + weapons:
                if re.search(r"\b" + re.escape(name) + r"\b", taken, re.I) and name not in prof:
                    prof.append(name)
                    taken = re.sub(re.escape(name), "", taken, flags=re.I)
            for name in SKILLS:  # "Proficiency in the Intimidation skill", not "twice your Proficiency Bonus to History checks"
                if re.search(r"proficien\w* in (?:the )?" + re.escape(name) + r"\b", sentence, re.I) and name not in skills:
                    skills.append(name)
    return prof, skills, pick


def race_entry(parts, texts, weapons):
    """One race or subrace as the planner stores it."""
    features = [[name, texts.get(name, "")] for name in parts["passives"]] + parts["features"]
    features = [[n, re.sub(r"\w+ Icon\.png ", "", t)] for n, t in features if n]
    prof, skills, pick = grants([t for _, t in features], weapons)
    entry = {"features": features}
    if parts["speed"]:
        entry["speed"] = parts["speed"]
    if prof:
        entry["prof"] = prof
    if parts["skills"] or skills:
        entry["skills"] = list(dict.fromkeys(parts["skills"] + skills))
    if pick:
        entry["skillPick"] = pick
    if parts["spells"]:
        entry["spells"] = parts["spells"]
        entry["spellAbility"] = parts["ability"]
    if parts["cantrip"]:
        entry["cantrip"] = parts["cantrip"]
    if parts["note"]:
        entry["note"] = parts["note"]
    return entry


def class_entry(w):
    """Saving throws, equipment proficiencies, skill list and hit points of a class, as starting class and as multiclass."""
    info = top_section(w, r"Class information")
    blocks = {name.strip().lower(): body for name, body in sections(info, 3)}

    def terms(body):
        out, cur = {}, None
        for raw in body.split("\n"):
            line = raw.strip()
            if line.startswith(";"):
                head, _, rest = line[1:].partition(" : ")
                cur = clean(re.sub(r"\[\[[^\]|]*\|", "[[", head)).strip().lower()
                out[cur] = [rest] if rest.strip() else []
            elif line.startswith(":") and cur is not None:
                out[cur].append(line.lstrip(": "))
        return out

    def equipment(lines):
        found = []
        for name in re.findall(r"\{\{\s*(\w+)\s*\}\}|\{\{\s*WeaponType\s*\|([^{}|]+)", " ".join(lines)):
            value = PROF_TEMPLATE.get(name[0].lower()) if name[0] else name[1].strip()
            if value and value not in found:
                found.append(value)
        return found

    def skill_choice(table):
        key = next((k for k in table if k.startswith("skill")), None)
        if not key:
            return 0, []
        count = re.search(r"choose (\d+)", key)
        names = re.findall(r"\{\{\s*Skill\s*\|([^{}|]+)", " ".join(table[key]))
        return int(count.group(1)) if count else 0, [n.strip() for n in names]

    start, multi, attrs = terms(blocks.get("starting proficiencies", "")), terms(blocks.get("multiclass proficiencies", "")), terms(blocks.get("attributes", ""))
    saves = re.findall(r"\{\{\s*Ability\s*\|(\w+)", " ".join(next((v for k, v in start.items() if k.startswith("saving throw")), [])))
    pick, skills = skill_choice(start)
    multi_pick, multi_skills = skill_choice(multi)
    hp = [int(n) for n in re.findall(r"InfoBlob\s*\|\s*(\d+)", " ".join(attrs.get("hit points", [])))]
    return {"saves": saves, "pick": pick, "skills": "any" if len(skills) == len(SKILLS) else sorted(skills),
            "start": equipment(next((v for k, v in start.items() if k.startswith("equipment")), [])),
            "multi": equipment(next((v for k, v in multi.items() if k.startswith("equipment")), [])),
            "multiSkills": multi_pick, "hp": hp[:2]}


def backgrounds(w):
    out = {}
    for name, body in sections(w, 2):
        m = re.search(r"(?:Skill proficiencies|Improves):\s*(.*)", body)
        if m:
            out[re.sub(r"\s*\(.*\)$", "", name.strip())] = [clean(x) for x in re.findall(r"\[\[([^\]|]+)", m.group(1))]
    return out


def creation_scores(final):
    """The point-buy scores and the +2 / +1 bonuses that give an origin character's starting abilities."""
    keys = [k for k, _ in ABILITIES]
    for two, one in itertools.permutations(keys, 2):
        base = {k: final[k] - (2 if k == two else 1 if k == one else 0) for k in keys}
        if all(v in POINT_COST for v in base.values()) and sum(POINT_COST[v] for v in base.values()) == 27:
            return {"abilities": base, "plus2": two, "plus1": one}
    return None


def origin_entry(w):
    box = w[w.find("{{Infobox creature"):] if "{{Infobox creature" in w else w
    final = {k: int(field(box, k) or 0) for k, _ in ABILITIES}
    entry = {"text": clean(field(box, "page description")), "cls": clean(field(box, "class")), "sub": re.sub(r"\s*\(.*\)$", "", title(field(box, "subclass"))),
             "race": title(field(box, "race")), "subrace": title(field(box, "subrace")), "background": clean(field(box, "background"))}
    scores = creation_scores(final) if all(final.values()) else None
    if scores:
        entry.update(scores)
    return {k: v for k, v in entry.items() if v}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    weapons = weapon_types()
    print("Reading race, class, background and origin pages…")
    pages = page_texts(RACES + CLASSES + ORIGINS + ["Backgrounds"])
    races, subraces, raw = {}, {}, {}
    for race in RACES:
        w = pages[race]
        raw[race] = read_features(top_section(w, r"Racial features|Race features"))
        for name, body in sections(top_section(w, r"Subraces"), 3):
            raw[title(name)] = dict(read_features(body), parent=race)
    passive_names = sorted({n for parts in raw.values() for n in parts["passives"]})
    print(f"Reading {len(passive_names)} racial features…")
    passive_pages = page_texts(passive_names)
    texts = {n: re.sub(r"\s+", " ", describe(passive_pages.get(n, ""))) for n in passive_names}
    order = {}
    for name, parts in raw.items():
        entry = race_entry(parts, texts, weapons)
        if "parent" in parts:
            subraces[name] = entry
            order.setdefault(parts["parent"], []).append(name)
        else:
            races[name] = entry
            order.setdefault(name, [])
    bgs = backgrounds(pages["Backgrounds"])
    bg_pages = page_texts(list(bgs))
    classes = {c: class_entry(pages[c]) for c in CLASSES}
    origins = dict(CUSTOM)
    for name in ORIGINS:
        origins[name] = origin_entry(pages[name])

    # the page layouts this script reads can change: stop rather than write data with holes in it
    problems = [f"{r}: no speed" for r in RACES if not races[r].get("speed")]
    problems += [f"{c}: {k} not read" for c in CLASSES for k in ("saves", "pick", "skills", "start", "hp") if not classes[c][k] or (k in ("saves", "hp") and len(classes[c][k]) != 2)]
    problems += [f"{n}: {len(sk)} skills" for n, sk in bgs.items() if len(sk) != 2] + ([] if len(bgs) >= 12 else [f"only {len(bgs)} backgrounds"])
    problems += [f"{n}: class or abilities not read" for n in ORIGINS if not origins[n].get("cls") or not origins[n].get("abilities")]
    if problems:
        raise SystemExit("The wiki pages no longer match what this script expects:\n  " + "\n  ".join(problems))

    data = {"races": races, "subraces": subraces, "raceOrder": order,
            "backgrounds": {name: {"skills": skills, "text": describe(bg_pages.get(name, ""))} for name, skills in bgs.items()},
            "origins": origins, "classes": classes}
    js = ("// What each character-creation choice grants. Generated by tools/update_gamedata.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead.\n"
          "// races / subraces: { speed, prof (weapon and armour proficiencies), skills, skillPick (free skill picks), features: [[name, text]],\n"
          "//   spells: [[name, character level]], spellAbility, cantrip (class list to choose one cantrip from) } · raceOrder: {race: [subraces]}\n"
          "// backgrounds: { skills, text } · origins: { text, cls, sub, race, subrace, background, abilities, plus2, plus1 }\n"
          "// classes: { saves, pick, skills (or 'any'), start / multi (equipment proficiencies), multiSkills, hp: [level 1, later levels] }\n"
          f"window.BG3_DATA_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)

    print(f"Wrote {OUT} ({len(js) // 1024} KB)")
    for race in RACES:
        r = races[race]
        print(f"  {race}: speed {r.get('speed')}, prof {r.get('prof', [])}, skills {r.get('skills', [])}{' +pick' if r.get('skillPick') else ''}, "
              f"features {[f[0] for f in r['features']]}, spells {r.get('spells', [])}")
        for sub in order[race]:
            s = subraces[sub]
            print(f"     {sub}: prof {s.get('prof', [])}, skills {s.get('skills', [])}, features {[f[0] for f in s['features']]}, spells {s.get('spells', [])} "
                  f"{s.get('spellAbility', '')} {('cantrip from ' + s['cantrip']) if s.get('cantrip') else ''}")
    for c in CLASSES:
        d = classes[c]
        print(f"  {c}: hp {d['hp']}, saves {d['saves']}, pick {d['pick']} of {d['skills'] if d['skills'] == 'any' else len(d['skills'])}, start {d['start']}, multi {d['multi']} +{d['multiSkills']} skills")
    print("  backgrounds:", {k: v for k, v in bgs.items()})
    for name in ORIGINS:
        o = origins[name]
        print(f"  {name}: {o.get('cls')} / {o.get('sub', '-')}, {o.get('race')} / {o.get('subrace', '-')}, {o.get('background')}, {o.get('abilities')} +2 {o.get('plus2')} +1 {o.get('plus1')}")
    missing = [n for n in passive_names if not texts[n]]
    if missing:
        print("  racial features without a description:", missing)


if __name__ == "__main__":
    main()
