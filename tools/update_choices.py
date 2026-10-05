"""Rebuild choices.js from bg3.wiki: the options of every choice a class or subclass makes while levelling
(fighting styles, invocations, metamagic, manoeuvres, ...), the options inside feats, and the permanent bonuses.

Run from anywhere:  py tools/update_choices.py
Needs only the Python standard library and an internet connection. Takes under a minute.

Which choices exist, who makes them and how many picks each level gives are listed in SPEC below, read off the
"Choose N ..." lines of the class and subclass pages. The options themselves, their descriptions and the level
that unlocks each one are collected from the wiki every time the script runs.
"""
import io, json, os, re, sys, time

from update_classes import CLASSES, FEATURE_TEMPLATE, describe, grid, plain, rclean, sections, tidy
from update_items import api, clean, field, page_texts, record, short

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "choices.js")
ALL_SKILLS = ["Athletics", "Acrobatics", "Sleight of Hand", "Stealth", "Arcana", "History", "Investigation", "Nature", "Religion",
              "Animal Handling", "Insight", "Medicine", "Perception", "Survival", "Deception", "Intimidation", "Performance", "Persuasion"]

# (name of the choice, who makes it, {class level: picks}, where the options are, extras)
# Sources: ("page", title) the first table of a page · ("section", page, level, marker) the table or list after a marker in a
# level section · ("fighting", column) the Fighting style table · ("prefix", text) every page whose title starts with the text ·
# ("lands", page) the land blocks of the Circle of the Land · ("bullets", page, level, anchor, marker) a bullet list ·
# ("skills", list or None) skills, any when None
SPEC = [
    ("Fighting Style", "Fighter", {1: 1}, ("fighting", "Fighter"), {}),
    ("Fighting Style", "Paladin", {2: 1}, ("fighting", "Paladin"), {}),
    ("Fighting Style", "Ranger", {2: 1}, ("fighting", "Ranger"), {}),
    ("Fighting Style", "College of Swords", {3: 1}, ("fighting", "College of Swords"), {}),
    ("Fighting Style", "Champion", {10: 1}, ("fighting", "Champion"), {}),
    ("Favoured Enemy", "Ranger", {1: 1, 6: 1, 10: 1}, ("page", "Favoured Enemy"), {}),
    ("Natural Explorer", "Ranger", {1: 1, 6: 1, 10: 1}, ("page", "Natural Explorer"), {}),
    ("Hunter's Prey", "Hunter", {3: 1}, ("section", "Hunter", 3, "Hunter's Prey"), {}),
    ("Defensive Tactics", "Hunter", {7: 1}, ("section", "Hunter", 7, "Defensive Tactics"), {}),
    ("Gathered Swarm", "Swarmkeeper", {3: 1}, ("section", "Swarmkeeper", 3, "Gathered Swarm"), {}),
    ("Eldritch Invocation", "Warlock", {2: 2, 5: 1, 7: 1, 9: 1, 12: 1}, ("page", "Eldritch Invocations"), {}),
    ("Pact Boon", "Warlock", {3: 1}, ("section", "Warlock", 3, "Pact Boon"), {}),
    ("Metamagic", "Sorcerer", {2: 2, 3: 1, 10: 1}, ("page", "Metamagic"), {}),
    ("Draconic Ancestry", "Draconic Bloodline", {1: 1}, ("page", "DraconicAncestryTable"), {}),
    ("Manoeuvre", "Battle Master", {3: 3, 7: 2, 10: 2}, ("page", "Manoeuvres"), {}),
    ("Arcane Shot", "Arcane Archer", {3: 3, 7: 1, 10: 1}, ("prefix", "Arcane Shot: "), {}),
    ("Bonus Cantrip", "Arcane Archer", {3: 1}, ("bullets", "Arcane Archer", 3, "Gain a Cantrip", "Choose between"), {}),
    ("Bestial Heart", "Wildheart", {3: 1}, ("section", "Wildheart", 3, "Bestial Heart"), {}),
    ("Animal Aspect", "Wildheart", {6: 1, 10: 1}, ("section", "Wildheart", 6, "Animal Aspect"), {}),
    ("Land", "Circle of the Land", {3: 1, 5: 1, 7: 1, 9: 1}, ("lands", "Circle of the Land"), {"repeat": True}),
    ("Bonus Cantrip", "Circle of the Land", {2: 1}, ("bullets", "Druid", 2, "Natural Recovery", "Choose an additional cantrip"), {}),
    ("Elemental Discipline", "Way of the Four Elements", {3: 3, 6: 1, 9: 1, 11: 1}, ("page", "Elemental Disciplines"), {}),
    ("Bonus Cantrip", "Death Domain", {1: 1}, ("bullets", "Cleric", 1, "Reaper", "Choose 1 cantrip"), {}),
    ("Bonus Cantrip", "Nature Domain", {1: 1}, ("bullets", "Cleric", 1, "Acolyte of Nature", "Choose 1 cantrip"), {}),
    ("Skills", "Nature Domain", {1: 1}, ("bullets", "Cleric", 1, "Acolyte of Nature", "Choose 1 skill"), {"join": ", "}),
    ("Expertise", "Knowledge Domain", {1: 2}, ("bullets", "Cleric", 1, "Blessings of Knowledge", "Choose 2 skills"), {"join": " + "}),
    ("Skills", "College of Lore", {3: 3}, ("skills", None), {"join": ", "}),
]


def first_name(cell):
    """The option a table cell names, as (label, page): from a feature template, a link, or the plain text."""
    m = FEATURE_TEMPLATE.search(cell)
    if m:
        return tidy(m.group(2) or m.group(1)), m.group(1).strip()
    m = re.search(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]", cell)
    if m:
        return tidy(m.group(2) or m.group(1)), m.group(1).strip()
    return tidy(plain(cell)), ""


def table_options(text):
    """Options of the first wikitable in the text: [name, page, description, level that unlocks it]."""
    m = re.search(r"\{\|.*?\n\|\}", text, re.S)
    if not m:
        return []
    rows = grid(m.group(0), multiline=True)
    if not rows:
        return []
    heads = [clean(plain(c)).lower() for c in rows[0]]
    desc_i = next((heads.index(h) for h in ("description", "effect", "grants") if h in heads), None)
    level_i = heads.index("level") if "level" in heads else None
    out = []
    for row in rows[1:]:
        if len(row) < 2:
            continue
        name, page = first_name(row[0])
        desc = rclean(row[desc_i]) if desc_i is not None and desc_i < len(row) else ""
        level = re.search(r"\d+", row[level_i]) if level_i is not None and level_i < len(row) else None
        if name and len(name) < 60:
            out.append([name, page, re.sub(r"\s*;\s*", " ", desc), int(level.group(0)) if level else 0])
    return out


def level_section(w, level):
    # class pages keep their levels under "Level progression", subclass pages under "Subclass features";
    # only the page-level heading counts, since level sections may carry a sub-heading of the same name
    body = re.split(r"^==(?!=)\s*(?:Level progression|Subclass features)\s*==(?!=)", w, maxsplit=1, flags=re.I | re.M)[-1]
    return next((text for title, text in sections(body, 3) if re.match(r"Level %d\b" % level, title.strip())), "")


def after_marker(text, marker):
    """The part of a level section that belongs to a term: from its marker to the next divider."""
    i = text.find(marker)
    if i < 0:
        return ""
    return re.split(r"\{\{\s*HorizontalRuleImage\s*\}\}", text[i:], maxsplit=1)[0]


def template_options(text):
    out = []
    for m in FEATURE_TEMPLATE.finditer(text):
        name = tidy(m.group(2) or m.group(1))
        if name and all(name != o[0] for o in out):
            out.append([name, m.group(1).strip(), "", 0])
    return out


def bullet_options(text, anchor, marker):
    """Names of the bullet list that follows a marker ("Choose 1 cantrip:") after an anchor (the feature it belongs to)."""
    i = text.find(anchor)
    j = text.find(marker, max(i, 0))
    out = []
    if j < 0:
        return out
    for line in text[j:].split("\n")[1:]:
        line = line.strip().lstrip(":")
        if not line.startswith("*"):
            if out or line:
                break
            continue
        skill = re.search(r"\{\{\s*Skill\s*\|([^{}|]+)", line)
        if skill:
            out.append([skill.group(1).strip(), "", "", 0])
        else:
            out.extend(template_options(line))
    return out


def fighting_styles(w):
    """{who: [style, page, description, 0]} from the availability table of the Fighting style page."""
    m = re.search(r"\{\|.*?\n\|\}", w, re.S)
    rows = grid(m.group(0), multiline=True)
    owners = next(r for r in rows if any("[[Fighter]]" in c for c in r))
    cols = {}
    for i, cell in enumerate(owners):
        label = clean(cell)
        for who in ("College of Swords", "Champion", "Fighter", "Paladin", "Ranger"):
            if who in label and who not in cols and not (who == "Fighter" and "Champion" in label):
                cols[who] = i
    out = {who: [] for who in cols}
    for row in rows:
        if not FEATURE_TEMPLATE.search(row[0]):
            continue
        name, page = first_name(row[0])
        for who, i in cols.items():
            if "✓" in row[i]:
                out[who].append([name, page, rclean(row[-1]), 0])
    return out


def lands(w):
    """The eight lands of the Circle of the Land, each with the spells it gives at every level it is chosen."""
    found = {}
    for level in (3, 5, 7, 9):
        text = level_section(w, level)
        for block in re.split(r"\n\|\s*\n", text):
            head = re.search(r"^;\s*(?:\{\{\s*LgPass\s*\||\[\[)([^{}|\]]+)", block.strip(), re.M)
            if not head or "Spells" in head.group(1):
                continue
            name = tidy(head.group(1))
            spells = [tidy(m.group(2) or m.group(1)) for m in re.finditer(r"\{\{\s*SAI\s*\|([^{}|]+)(?:\|([^{}|=]+)(?=\||\}\}))?", block)]
            found.setdefault(name, []).append(f"level {level}: " + ", ".join(spells))
    return [[name, "", "Always prepared — " + "; ".join(parts), 0] for name, parts in found.items()]


def prefix_pages(prefix):
    d = api(action="query", list="allpages", apprefix=prefix.strip(), apnamespace=0, aplimit=100, apfilterredir="nonredirects")
    return [p["title"] for p in d["query"]["allpages"]]


def feat_options(w):
    """Options inside feats that the feat table spells out: the elements of Elemental Adept, the cantrips of Spell Sniper."""
    out = {}
    for block in re.split(r"\{\{\s*table feat\s*", w)[1:]:
        name = clean(field("| " + block.lstrip("| "), "name") or field(block, "name"))
        if name == "Elemental Adept":
            out[name] = sorted(set(re.findall(r"Elemental Adept: (\w+)", block)))
        elif name == "Spell Sniper":
            notes = block.split("available cantrips are", 1)[-1]
            out[name] = [tidy(m.group(2) or m.group(1)) for m in re.finditer(r"^\*\*\s*\{\{\s*SAI\s*\|([^{}|]+)(?:\|([^{}|=]+)(?=\||\}\}))?", notes, re.M)]
    return out


def permanent(w):
    """Permanent bonuses by act: name, what it gives, how to get it."""
    out = []
    for act_title, body in sections(w, 2):
        act = {"act one": 1, "act two": 2, "act three": 3}.get(act_title.strip().lower())
        if not act:
            continue
        for title, text in sections(body, 3):
            parts = re.split(r"====\s*How to unlock\s*====", text, maxsplit=1, flags=re.I)
            effect = rclean(parts[0].split("{{HorizontalRuleImage}}")[0])
            effect = re.sub(r"^.{0,60}? - ", "", effect, count=1)
            how = rclean(parts[1].split("{{HorizontalRuleImage}}")[0]) if len(parts) > 1 else ""
            out.append({"n": tidy(title), "a": act, "x": short(re.sub(r"\s*;\s*", " ", effect).strip(), 300), "h": short(re.sub(r"\s*;\s*", " ", how).strip(), 260)})
    return out


# Subclasses that learn spells from another class's list, restricted by school of magic.
SPELL_SUBCLASSES = {"Eldritch Knight": "Fighter", "Arcane Trickster": "Rogue"}


def spell_picks(pages):
    """What Eldritch Knights and Arcane Tricksters learn per class level, from the "Choose N ..." lines of the class page:
    {subclass: {list, schools, at: {level: {cantrips, school (spells of its schools), any (spells of any school)}}}}."""
    out = {}
    for sub, cls in SPELL_SUBCLASSES.items():
        entry = {"list": "Wizard", "schools": [], "at": {}}
        for level in range(1, 13):
            for line in level_section(pages[cls], level).split("\n"):
                m = re.search(r"Choose (\d+) \[\[" + re.escape(sub) + r"#[^|\]]*\|(Cantrips?|Spells?)\]\](.*)", line)
                if not m:
                    continue
                at = entry["at"].setdefault(level, {})
                n, what, rest = int(m.group(1)), m.group(2).lower(), m.group(3)
                if what.startswith("cantrip"):
                    at["cantrips"] = at.get("cantrips", 0) + n
                elif "any spell school" in rest:
                    at["any"] = at.get("any", 0) + n
                else:
                    at["school"] = at.get("school", 0) + n
                    for school in re.findall(r"\[\[([A-Za-z]+)(?: \(school\))?(?:\|[^\]]*)?\]\]", rest):
                        if school not in entry["schools"]:
                            entry["schools"].append(school)
        out[sub] = entry
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    known = io.open(os.path.join(ROOT, "classes.js"), encoding="utf-8").read()
    wanted = {"Fighting style", "Feats", "Permanent bonuses"} | set(SPELL_SUBCLASSES.values())
    for name, owner, at, src, extra in SPEC:
        assert owner in CLASSES or ('"' + owner + '"') in known, owner + " is not a class or subclass in classes.js"
        if src[0] in ("page", "section", "lands", "bullets"):
            wanted.add(src[1])
    print("Reading the pages that list the options…")
    pages = page_texts(list(wanted))
    styles = fighting_styles(pages["Fighting style"])
    choices, to_describe = [], set()
    for name, owner, at, src, extra in SPEC:
        kind = src[0]
        if kind == "fighting":
            options = styles[src[1]]
        elif kind == "page":
            options = table_options(pages[src[1]])
        elif kind == "section":
            block = after_marker(level_section(pages[src[1]], src[2]), src[3])
            options = table_options(block) or template_options(block)
        elif kind == "bullets":
            options = bullet_options(level_section(pages[src[1]], src[2]), src[3], src[4])
        elif kind == "lands":
            options = lands(pages[src[1]])
        elif kind == "prefix":
            options = [[t[len(src[1]):], t, "", 0] for t in prefix_pages(src[1])]
        else:
            options = [[s, "", "", 0] for s in (src[1] or ALL_SKILLS)]
        if name == "Draconic Ancestry":  # "Red" alone says little: keep the damage type the page name carries
            options = [[o[1].split(": ", 1)[-1] if ": " in o[1] else o[0], o[1], o[2], o[3]] for o in options]
        for o in options:
            if len(o[2]) < 25 and (o[1] or kind == "bullets"):
                to_describe.add(o[1] or o[0])
        choices.append({"name": name, "owner": owner, "at": at, "options": options, **extra})
    print(f"Reading {len(to_describe)} option pages for their descriptions…")
    texts = page_texts(list(to_describe))
    for c in choices:
        for o in c["options"]:
            if len(o[2]) < 25:
                o[2] = describe(texts.get(o[1] or o[0], "")) or o[2]
        c["options"] = [[o[0], short(o[2], 320), o[3]] for o in c["options"]]

    feats = feat_options(pages["Feats"])
    bonuses = permanent(pages["Permanent bonuses"])
    learned = spell_picks(pages)
    row = lambda d: json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    js = ("// The options of every choice made while levelling, the options inside feats, and the permanent bonuses.\n"
          "// Generated by tools/update_choices.py from bg3.wiki; do not edit by hand, re-run the script instead.\n"
          "// BG3_CHOICES = [{ name, owner (class or subclass), at: {class level: picks}, options: [[name, what it does, level that unlocks it]],\n"
          "//   join (when all picks go on one line), repeat (the same option may be taken again) }]\n"
          "// BG3_FEAT_OPTIONS = {feat: [options]} · BG3_PERMANENT = [{ n name, a act, x what it gives, h how to get it }]\n"
          "// BG3_SPELL_PICKS = {subclass: { list (whose spell list), schools, at: {class level: { cantrips, school, any }} }}\n"
          f"window.BG3_CHOICES_DATE = {json.dumps(time.strftime('%Y-%m-%d'))};\n"
          "window.BG3_CHOICES = [\n" + ",\n".join("  " + row(c) for c in choices) + "\n];\n"
          "window.BG3_FEAT_OPTIONS = " + row(feats) + ";\n"
          "window.BG3_PERMANENT = [\n" + ",\n".join("  " + row(b) for b in bonuses) + "\n];\n"
          "window.BG3_SPELL_PICKS = " + row(learned) + ";\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    record("choices")

    print(f"Wrote {OUT} ({len(js) // 1024} KB)")
    for c in choices:
        blank = sum(1 for o in c["options"] if not o[1])
        print(f"  {c['name']} · {c['owner']} {c['at']}: {len(c['options'])} options" + (f", {blank} without description" if blank else "")
              + ("  <-- NO OPTIONS FOUND" if not c["options"] else "") + "  " + ", ".join(o[0] + (f"@{o[2]}" if o[2] else "") for o in c["options"])[:150])
    print("  feat options:", feats)
    print(f"  permanent bonuses: {len(bonuses)} —", ", ".join(b['n'] for b in bonuses))
    for sub, e in learned.items():
        print(f"  {sub}: {e['schools']} ·", e["at"])


if __name__ == "__main__":
    main()
