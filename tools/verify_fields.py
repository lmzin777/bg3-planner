"""Checks that the data scripts read every field the wiki fills in.

    py tools/verify_fields.py            (spells, consumables and items; items take a few minutes)
    py tools/verify_fields.py spells     (only one of them)

Each script is run for real, without writing its file, while this one notes which template fields it asks for.
The fields that are filled in on the same pages and were never asked for are listed, most used first. A field
that matters and is missing from the data shows up here (this is how the unread "damage 1" of the spells would
have been caught); a field that does not matter goes into IGNORED below, with the reason, so the list stays short.
"""
import io, os, re, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update_items, update_spells, update_consumables

# Fields the planner has no use for, by data file. Anything not asked for and not listed here is reported.
IGNORED = {
    "*": {
        "image": "the picture comes from the page's thumbnail", "icon": "same", "controller icon": "same", "image size": "layout", "icon size": "layout",
        "uid": "internal game id", "uuid": "internal game id", "id": "internal game id", "notes": "free text for readers", "bugs": "free text for readers",
        "gallery": "pictures", "summary": "repeats the description for the page header", "external links": "links", "see also": "links",
        "hotbar icon": "picture", "video": "picture", "type": "the kind of page", "disambig": "page header", "subject": "page header",
        "use1": "page header", "article1": "page header", "use2": "page header", "article2": "page header", "suppress sources": "layout",
    },
    "spells": {
        "used by creatures": "which monsters cast it", "warning": "a remark for readers", "variants": "the variants are pages of their own",
        "targets": "what can be targeted, in words", "creature description": "the summoned creature's own actions", "grants": "follow-up actions the spell unlocks",
        "other ways to learn": "free text; items and feats are read from their own fields", "granted by spells": "follow-up of another spell",
        "save dc": "who sets the DC: always the caster for a player", "condition dc": "same", "condition 1 dc": "same", "condition 2 dc": "same", "condition 3 dc": "same",
        "range ft": "the same range in feet; range m is read", "aoe ft": "same", "area ft": "same", "force m": "how far a target is pushed", "force info": "same",
        "hit cost": "what a smite spends when the attack hits; the planner shows the cost of casting", "on miss": "what happens on a miss, in words",
        "item": "the weapon a spell conjures", "item duration": "same",
    },
    "consumables": {
        "description": "the wiki's blurb; what the item does comes from the effect field", "quote": "flavour text", "weight kg": "not shown", "stats": "internal game id",
        "single use": "every consumable is", "usage cost": "action or bonus action; not shown", "name": "same as the page title",
        "condition": "named in the effect text", "condition save": "same", "condition dc": "same", "condition2": "same", "condition2 duration": "same",
        "condition2 save": "same", "condition2 dc": "same", "technical description": "the long form of the effect",
        "area": "the surface or cloud left behind, named in the effect text", "area shape": "same", "area range m": "same", "area range ft": "same", "area duration": "same",
        "hp": "of the bottle as an object", "resistances": "of the bottle as an object",
    },
    "items": {
        "quote": "flavour text", "stats": "internal game id", "stats2": "same", "stats functor context": "same", "filename": "model file", "filename2": "same",
        "filename3": "same", "filename4": "same", "uid2": "internal game id", "uuid2": "same", "seo description": "page header", "image description": "picture caption",
        "where to find x": "map coordinates", "where to find y": "same", "where to find2 x": "same", "where to find2 y": "same", "where to find3 x": "same",
        "where to find3 y": "same", "where to find2 location": "the act is read from the first place", "where to find3 location": "same",
        "category": "simple or martial is worked out from the weapon type", "dippable": "not shown", "ammunition": "not shown", "loading": "not shown",
        "range": "weapon range is not shown", "range m": "same", "consumegale": "whether Gale can consume it", "price honour": "price in Honour mode",
        "condition": "named in the item's own text", "condition duration": "same", "condition save": "same", "condition dc": "same",
        "brief": "short form of a passive; the description is read", "properties": "flags of a passive", "recharge": "of a passive, said in its text",
        "region": "location pages, read only for their act", "prefix": "same", "region prefix": "same", "north": "same", "east": "same", "south": "same", "west": "same",
        "font-size": "layout", "author": "quotation", "height": "layout",
    },
}
# Families of fields: "… learns at level N" is read by the spell script with a pattern of its own;
# "reaction N …" describes the reaction a spell adds (Counterspell), which the planner does not list.
PATTERNS = {
    "spells": [r"^(class|race) learns at level \d+$", r"^reaction \d+ "],
}


def body_fields(text):
    """Field names filled in on a page: "| name = value" at the start of a line, with a value."""
    out = {}
    for m in re.finditer(r"^\|\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*=[ \t]*(\S.*)?$", text, re.M):
        if m.group(2):
            out.setdefault(m.group(1).strip().lower(), m.group(2).strip())
    return out


def check(name, module, fetchers):
    asked, pages = set(), {}
    real_field = update_items.field

    def spy(text, key):
        asked.add(key.strip().lower())
        return real_field(text, key)

    def recording(fetch):
        def run(*args, **kwargs):
            got = fetch(*args, **kwargs)
            pages.update(got)
            return got
        return run

    for mod in {update_items, module}:
        mod.field = spy
        mod.record = lambda *a: None
    for owner, fn in fetchers:
        setattr(owner, fn, recording(getattr(owner, fn)))
    module.OUT = os.path.join(tempfile.gettempdir(), "bg3-verify-" + name + ".js")
    print(f"== {name}: running {module.__name__} without writing its file…")
    module.main()

    used = {}
    for title, text in pages.items():
        for key, value in body_fields(text).items():
            used.setdefault(key, []).append((title, value))
    skip = dict(IGNORED["*"], **IGNORED.get(name, {}))
    by_pattern = [re.compile(x) for x in PATTERNS.get(name, [])]
    unread = sorted(((k, v) for k, v in used.items() if k not in asked and k not in skip and not any(x.search(k) for x in by_pattern)), key=lambda kv: -len(kv[1]))
    print(f"   {len(pages)} pages, {len(used)} different fields filled in, {len(asked)} asked for, {len(unread)} never asked for")
    for key, where in unread:
        if len(where) < 3:
            continue  # a field used on one or two pages is a quirk of those pages
        title, value = where[0]
        print(f"   - {key:28} on {len(where):4} pages   e.g. {title}: {value[:70]}")
    return unread


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    jobs = {
        "spells": (update_spells, [(update_spells, "spell_pages")]),
        "consumables": (update_consumables, [(update_consumables, "category_pages")]),
        "items": (update_items, [(update_items, "pages_using"), (update_items, "page_texts")]),
    }
    for name in (sys.argv[1:] or list(jobs)):
        module, fetchers = jobs[name]
        check(name, module, fetchers)


if __name__ == "__main__":
    main()
