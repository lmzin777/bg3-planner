"""Check the SPEC list of tools/update_choices.py against bg3.wiki: who makes each choice, at which class
levels, and how many picks each level gives.

Run from anywhere:  py tools/verify_choices.py
Reads the class and subclass pages and looks, in each level section, for the "Choose N ..." line of every
choice. It reports the levels where the wiki and the list disagree, the levels where no such line could be
found (the page words it another way), and choice lines on the wiki that the list does not cover.
"""
import io, json, os, re, sys

from update_choices import ROOT, SPEC, SPELL_SUBCLASSES, level_section, spell_picks
from update_classes import CLASSES
from update_items import clean, page_texts

# Words that tell a choice line apart, per choice name.
KEYWORDS = {
    "Fighting Style": r"fighting style", "Favoured Enemy": r"favoured enemy", "Natural Explorer": r"natural explorer",
    "Hunter's Prey": r"hunter.s prey|following features", "Defensive Tactics": r"defensive tactics|of the following",
    "Gathered Swarm": r"swarm", "Eldritch Invocation": r"invocation", "Pact Boon": r"pact boon", "Metamagic": r"metamagic",
    "Draconic Ancestry": r"draconic ancestry", "Manoeuvre": r"manoeuvre", "Arcane Shot": r"arcane shot", "Bonus Cantrip": r"cantrip",
    "Bestial Heart": r"bestial heart", "Animal Aspect": r"aspect", "Land": r"land", "Elemental Discipline": r"discipline|spell from the",
    "Skills": r"skill", "Expertise": r"skills? with double",
}
NUMBER = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4}
# Lines that are about spells of the class list, feats and subclasses: other parts of the planner handle those.
OTHER = re.compile(r"spell list|\[\[feat|feat\]\]|subclass|replace it|number of (prepared )?spells|deit|spells\]\]|\|spell\]\]|\|cantrips?\]\]|known \[\[spell", re.I)


def count_in(line):
    m = re.search(r"\b(?:choose|select|pick|gain(?: proficiency in)?)\s+(?:between\s+)?(\d+|an?|one|two|three|four)\b", line, re.I)
    if m:
        return NUMBER.get(m.group(1).lower()) or int(m.group(1))
    m = re.search(r"choose\s+(\d+)\)|\((?:choose|select)\s+(\d+)\)", line, re.I)
    return int(m.group(1) or m.group(2)) if m else None


def choice_lines(text):
    """Lines of a level section that announce a choice, as [(line, count)]."""
    out = []
    for raw in text.split("\n"):
        line = clean(raw)
        if re.search(r"\b(choose|select)\b|\(choose \d\)|gain (proficiency in )?\d", line, re.I) and (not OTHER.search(raw) or "Elemental Disciplines" in raw):
            out.append((line, count_in(line)))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    known = json.loads("{" + io.open(os.path.join(ROOT, "classes.js"), encoding="utf-8").read().split("window.BG3_CLASSES = {", 1)[1].split("};\nwindow.BG3_FEATS", 1)[0] + "}")
    parent = {sub: cls for cls, d in known.items() for sub in d["subclasses"]}
    pages = page_texts(sorted(set(CLASSES) | set(parent)))
    confirmed = differ = unseen = 0
    covered = set()
    for name, owner, at, src, extra in SPEC:
        cls = parent.get(owner, owner)
        key = re.compile(KEYWORDS[name], re.I)
        for level, picks in sorted(at.items()):
            # a subclass's choices are described on its own page and, often, on the page of its class
            found = []
            for page in ([owner, cls] if owner != cls else [cls]):
                for line, n in choice_lines(level_section(pages.get(page, ""), level)):
                    if key.search(line):
                        found.append((page, line, n))
                        covered.add((page, level, line))
            counts = {n for _, _, n in found if n}
            if picks in counts:
                confirmed += 1
            elif counts:
                differ += 1
                print(f"  ! {name} · {owner} level {level}: the list says {picks}, the wiki says {sorted(counts)} — {found[0][1][:110]}")
            else:
                unseen += 1
                print(f"  ? {name} · {owner} level {level}: no \"Choose N\" line found" + (f" (closest: {found[0][1][:90]})" if found else ""))
    print(f"\n{confirmed + differ + unseen} choice levels checked: {confirmed} confirmed by a \"Choose N\" line, {differ} differ, {unseen} worded another way on the wiki.")

    extra_lines = []
    owners = {owner for _, owner, _, _, _ in SPEC}
    for page in sorted(set(CLASSES) | set(parent)):
        for level in range(1, 13):
            for line, n in choice_lines(level_section(pages.get(page, ""), level)):
                if (page, level, line) not in covered:
                    extra_lines.append(f"  · {page} level {level}: {line[:120]}")
    print(f"\nChoice lines on the wiki that the list does not cover ({len(extra_lines)}):")
    print("\n".join(extra_lines) or "  none")

    print("\nSpells of the subclasses that borrow a spell list:")
    for sub, entry in spell_picks(pages).items():
        total = {k: sum(v.get(k, 0) for v in entry["at"].values()) for k in ("cantrips", "school", "any")}
        print(f"  {sub}: schools {entry['schools']}, by level 12: {total['cantrips']} cantrips, {total['school']} spells of its schools, {total['any']} of any school")


if __name__ == "__main__":
    main()
