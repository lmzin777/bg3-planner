"""Builds enemies.js: a short list of reference enemies to measure damage against.

    py tools/update_enemies.py

The list of names below is a choice (well-known fights of each act); every number comes from the creature's
infobox on bg3.wiki: its "/Combat" page when it has one, else its own page.
Two fights are a puzzle before they are a matter of numbers, and are listed in the state where damage counts:
Grym while Superheated (immune to everything otherwise), and Gerringothe Thorm with all her Coin Armour on.
Balthazar's page gives no Armour Class: it is worked out from the Mage Armour he keeps on, and says so.

What an enemy does to a character comes from the "Attacks and actions" of its page: every action that costs its
action and deals damage, by attack roll, by saving throw or with no roll. The damage, the saving throw, a fixed
Difficulty Class, the spell slot and how often it recharges are the action's own. Two numbers are not on the wiki
and are worked out the way the game does it, with their parts kept so the planner can show them:
  attack bonus = proficiency bonus + ability modifier + the weapon's enchantment
  save DC      = 8 + proficiency bonus + spellcasting ability modifier (when the action says "caster")
The ability is the one the action names; else Strength for melee (the higher of Strength and Dexterity with a
Finesse weapon), Dexterity at range, and the spellcasting ability for spells.
A creature whose page lists no Main Hand Attack gets one with the weapon its page names: the one a passive of
its infobox comes from ("Crimson Weapon @ Crimson Mischief"), else the only weapon in its loot. Such an attack
carries a note saying so.

Difficulty: the infobox gives the hit points of Balanced, Tactician and Honour mode, and the passives of each. An
action listed under a "Honour mode" heading of the page is marked as there only in that mode, and one whose name
says "tactician" from Tactician up. What a page lists but the damage test does not use (reactions, Legendary
Actions, an attack with a weapon the page does not name) is kept by name, for the planner's list of things to check.
"""
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_items import clean, field, page_texts, record

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "enemies.js")
# (act, page title)
ENEMIES = [
    # the fights everyone remembers
    (1, "Goblin Warrior"), (1, "Owlbear"), (1, "Phase Spider Matriarch"), (1, "Auntie Ethel"), (1, "Priestess Gut"), (1, "Dror Ragzlin"),
    (1, "Minthara"), (1, "Bulette"), (1, "Grym"), (1, "Inquisitor W'wargaz"),
    (2, "Yurgir"), (2, "Balthazar"), (2, "Thisobald Thorm"), (2, "Gerringothe Thorm"), (2, "Malus Thorm"), (2, "Ketheric Thorm"), (2, "Apostle of Myrkul"),
    (3, "Steel Watcher Titan"), (3, "Lorroakan"), (3, "Cazador Szarr"), (3, "Viconia DeVir"), (3, "Sarevok Anchev"), (3, "Orin"), (3, "Enver Gortash"),
    (3, "Ansur"), (3, "Raphael"), (3, "The Netherbrain"),
    # other bosses, and the common enemies that stand next to them
    (1, "Commander Zhalk"), (1, "Flind"), (1, "Kagha"), (1, "Nere"), (1, "Spectator"), (1, "Bernard"), (1, "Lump the Enlightened"), (1, "Minotaur"), (1, "Hook Horror"),
    (1, "Owlbear Mate"), (1, "Goblin Booyahg"), (1, "Goblin Tracker"), (1, "Worg"), (1, "Bugbear"), (1, "Gnoll Hunter"), (1, "Hyena"), (1, "Harpy"), (1, "Phase Spider"),
    (1, "Ettercap"), (1, "Intellect Devourer"), (1, "Mud Mephit"), (1, "Wood Woad"), (1, "Animated Armour"),
    (2, "Kar'niss"), (2, "Disciple Z'rell"), (2, "Mind Flayer"), (2, "Displacer Beast"), (2, "Meenlock"), (2, "Shadow"), (2, "Shadow Mastiff"), (2, "Shadow-Cursed Harper"),
    (2, "Ghoul"), (2, "Ghast"), (2, "Death Shepherd"), (2, "Necromite"), (2, "Winged Horror"), (2, "Merregon Legionnaire"), (2, "Sister Hunna"), (2, "Skeleton"), (2, "Zombie"),
    (3, "Mystic Carrion"), (3, "Prelate Lir'i'c"), (3, "Dolor"), (3, "Cloaker"), (3, "Wraith"), (3, "Sahuagin"), (3, "Doppelganger"), (3, "Werewolf"), (3, "Cambion"),
    (3, "Vengeful Cambion"), (3, "Death's Head of Bhaal"), (3, "Black Gauntlet"), (3, "Fire Myrmidon"), (3, "Air Myrmidon"), (3, "Water Myrmidon"), (3, "Earth Myrmidon"),
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


def infobox(text, need_ac=True):
    """The first creature infobox of a page that gives an Armour Class (or the first one, when that is not asked)."""
    for m in re.finditer(r"\{\{\s*Infobox creature", text, re.I):
        body = text[m.start():]
        end = re.search(r"^\}\}", body, re.M)
        body = body[:end.start()] if end else body
        if not need_ac or number(field(body, "ac")) is not None:
            return body
    return None


# ---------- what the enemy does ----------
BOX = re.compile(r"\{\{\s*feature box\s*\|([^}|]+)((?:\|[^}]*)?)\}\}", re.I)
DICE = re.compile(r"^\s*(\d+d\d+)\s*(?:\+\s*(\d+))?\s*(?:\+\s*([A-Za-z]+)(?:\s+mod\w*)?)?\s*$")
ITEM = re.compile(r"\{\{\s*(?:Md|Sm)?RarityItem\s*\|([^}|]+)", re.I)


def feature(text):
    m = re.search(r"\{\{\s*(?:Feature|Reaction|Passive feature) page", text or "", re.I)
    return text[m.start():] if m else ""


def listed_actions(text):
    """The actions a page lists: [(name, {parameter: value}, mode)]. A parameter of the box overrides the action's
    page ("Ray of Sickness|damage 1=3d8": cast with a higher slot). The mode is "h" for an action under a heading
    that says Honour, "t" for one under a heading or with a name that says Tactician, else ""."""
    out, mode, depth = [], "", 0
    for m in re.finditer(r"^(=+)[ \t]*([^=\n]+?)[ \t]*=+[ \t]*$|\{\{\s*feature box\s*\|([^}|]+)((?:\|[^}]*)?)\}\}", text or "", re.M | re.I):
        if m.group(1):
            level, title = len(m.group(1)), m.group(2).lower()
            if "honour" in title or "tactician" in title:
                mode, depth = ("h" if "honour" in title else "t"), level
            elif level <= depth:
                mode, depth = "", 0
            continue
        given = dict((k.strip().lower(), v.strip()) for k, _, v in (x.partition("=") for x in m.group(4).split("|") if "=" in x))
        name = m.group(3).strip()
        out.append((name, given, mode or ("t" if "tactician" in name.lower() else "")))
    return out


def loot_weapons(text):
    """The items of a page's Loot section."""
    m = re.search(r"^(=+)\s*(?:Notable )?[Ll]oot\s*=+\s*$", text or "", re.M)
    if not m:
        return []
    rest = text[m.end():]
    end = re.search(r"^={1,%d}[^=]" % len(m.group(1)), rest, re.M)
    return [x.strip() for x in ITEM.findall(rest[:end.start()] if end else rest)]


ABILITY_WORD = r"(?:strength|dexterity|constitution|intelligence|wisdom|charisma)"


def condition_flags(text):
    """What a condition page says that the damage test can use, read from its effects: ({flags}, the effects).
    skip no actions · nr no reactions · adv attacks against it have Advantage (near: only from within 3 m)
    · crit hits from within 3 m are critical · dis its attack rolls have Disadvantage · fail saves it fails
    · sd saves it rolls with Disadvantage · drop ends Concentration · tk "start" when it counts down at the start
    of a turn · src 1 when it counts down on the turn of whoever caused it · rep the save it repeats each turn ("same": the one
    that let it in) · wake 1 when taking damage ends it · ally 1 when the Advantage is only for the allies of whoever
    caused it, once 1 when it is spent by the next attack · guard 1 when melee attacks against it have Disadvantage."""
    m = re.search(r"\{\{\s*condition page", text or "", re.I)
    if not m:
        return {}, ""
    w = text[m.start():]
    said = clean(field(w, "effects"))
    low = said.lower().replace("\u2019", "'")
    f = {}
    parts = [x.strip() for x in re.split(r";|\.(?=\s|$)|, while |, and ", low) if x.strip()]
    if re.search(r"(?:can't|cannot|can not|unable to) (?:\w+ or |\w+, )?(?:take (?:any )?actions?|act\b)|\bincapacitated\b", low):
        f["skip"] = 1
    if re.search(r"(?:can't|cannot|can not)[^.;]*reactions?", low):
        f["nr"] = 1
    a = re.search(r"attack(?: roll)?s against[^.;]*?(?:have|has|with) advantage|attackers have advantage", low)
    if a:
        f["adv"] = 1
        if re.search(r"within [\d.]+ ?m", low[a.start():a.end() + 70]):
            f["near"] = 1
    if re.search(r"attacks against[^.;]*automatically succeed", low):
        f["adv"] = 1
    if re.search(r"always critical hits?|is a critical hit", low):
        f["crit"] = 1
    # its own attack rolls: not "attackers have Disadvantage against it", not "against anyone but the caster", not "if Undead"
    if any(re.search(r"disadvantage on (?:(?:ability )?checks and )?attack rolls|attack rolls and \w+ saving throws have disadvantage|'s attack rolls[^.;]*disadvantage", x)
           and not re.search(r"attack rolls against|^if\b|attackers have", x) for x in parts):
        f["dis"] = 1
    if re.search(r"automatically fails?[^.;]*strength and dexterity", low):
        f["fail"] = ["str", "dex"]
    d = re.search(r"disadvantage on (" + ABILITY_WORD + r"(?:(?:,| and|, and) " + ABILITY_WORD + r")*) saving throws?", low)
    if d:
        f["sd"] = [x[:3] for x in re.findall(ABILITY_WORD, d.group(1))]
    elif re.search(r"dexterity saving throws have disadvantage|attack rolls and dexterity saving throws", low):
        f["sd"] = ["dex"]
    if re.search(r"(?:ends|breaks?) (?:the )?concentration", low):
        f["drop"] = 1
    if re.search(r"cannot target (?:him|her|it|them) with attacks", low):
        f["skip"] = 1
    # what the page's bug notes say the game really does: Goaded is Disadvantage on every attack roll
    if re.search(r"disadvantage on (?:'')?all(?:'')? attack rolls", clean(field(w, "bugs")).lower()):
        f["dis"] = 1
    # Distracted: Advantage for the allies of whoever caused it, on their next attack roll only
    if re.search(r"allies have advantage on their next attack roll against", low):
        f.update({"adv": 1, "ally": 1, "once": 1})
    # Evasive Footwork: melee attacks against it are made with Disadvantage
    if re.search(r"disadvantage on melee attacks against", low):
        f["guard"] = 1
    if f and re.search(r"removed by taking damage", low):
        f["wake"] = 1
    rep = re.search(r"at the (?:end|start) of (?:each|its|their) turn[^.;]*?(?:(" + ABILITY_WORD + r")|shake off|saving throw)", low)
    if rep and f:
        f["rep"] = rep.group(1)[:3] if rep.group(1) else "same"
    if f:
        if clean(field(w, "tick type")).lower().startswith("start"):
            f["tk"] = "start"
        if "tickingwithsource" in field(w, "properties").lower():
            f["src"] = 1
    return f, said


def is_weapon(page):
    return bool(DICE.match(clean(field(page, "damage")))) and bool(clean(field(page, "damage type")))


class Maker:
    """Turns the actions of one enemy into numbers."""

    def __init__(self, box, scores, pb):
        self.box, self.scores, self.pb = box, scores, pb
        self.casting = ""
        self.casting = self.ability(field(box, "casting ability")) or max(("int", "wis", "cha"), key=lambda k: scores[k])

    def mod(self, key):
        return (self.scores[key] - 10) // 2

    def ability(self, word):
        """ "Strength", "dex", "finesse", "spell mod" as an ability key."""
        w = (word or "").strip().lower()
        if w.startswith("fin"):
            return "dex" if self.scores["dex"] > self.scores["str"] else "str"
        if w.startswith("spell"):
            return self.casting
        return next((k for k in ABILITIES if w.startswith(k)), "")

    def weapon_attack(self, name, weapon, more, note=""):
        """A Main Hand Attack with a weapon page: one attack, and one more for each Extra Attack."""
        m = DICE.match(clean(field(weapon, "damage")))
        if not m:
            return None
        fine = clean(field(weapon, "finesse")).lower() in ("yes", "true")
        ranged = bool(re.search(r"bow", field(weapon, "type"), re.I))
        key = "dex" if ranged else self.ability("finesse" if fine else "strength")
        enchant = number(field(weapon, "enchantment")) or 0
        comps = [[m.group(1), int(m.group(2) or 0) + self.mod(key), clean(field(weapon, "damage type"))]]
        for extra in clean(field(weapon, "extra damage")).split(","):
            e = re.match(r"\s*(\d+d\d+)\s+([A-Z][a-z]+)", extra)
            if e:
                comps.append([e.group(1), 0, e.group(2)])
        parts = [["Proficiency", self.pb], [key.upper(), self.mod(key)]] + ([["Enchantment", enchant]] if enchant else [])
        out = {"n": name.replace("Main Hand", "Ranged") if ranged else name, "k": "a", "m": 0 if ranged else 1, "b": sum(p[1] for p in parts), "w": parts, "hits": [comps], "x": 1}
        if note:
            out["g"] = note
        return out

    def condition(self, get, flags):
        """The condition an action leaves, when it is one the damage test can use: [name, turns, save, DC]."""
        for n in ("", " 1", " 2"):
            name = clean(get("condition" + n))
            if not name or not flags.get(name):
                continue
            dc = clean(get("condition" + n + " dc")).lower()
            fixed = number(dc) if re.match(r"\d+$", dc) else None
            worked = 8 + self.pb + (max(self.mod("str"), self.mod("dex")) if "weapon" in dc else self.mod(self.casting))
            save = clean(get("condition" + n + " save")).lower()[:3]
            return [name, number(get("condition" + n + " duration")) or 0, save if save in ABILITIES else "", (fixed or worked) if save in ABILITIES else 0]
        return None

    def action(self, name, given, page, weapon, more, free=False, flags=None):
        """One listed action as {n, k: a attack roll / s saving throw / h no roll, m: 1 melee, b or dc with its
        parts w, sv, os, hits, sl spell slot, u uses a fight, c: 1 when it is not there every turn}."""
        w = feature(page)
        get = lambda k: given.get(k) or field(w, k)
        cost = get("cost").lower()
        if not w:
            return None
        acts = bool(re.search(r"(^|,)\s*action\b", cost))
        bonus = not acts and "bonus" in cost
        if not acts and not bonus and not free:
            return None
        cond = self.condition(get, flags or {})
        if name.startswith("Main Hand Attack") and weapon:
            return self.weapon_attack(name + " (" + given.get("item", "") + ")", weapon, more)
        # healing: what it gives itself back
        mend = [(clean(get("damage" + n)), clean(get("damage" + n + " type")) or clean(get("damage type"))) for n in ("", " 1")]
        mend = [DICE.match(text) for text, kind in mend if kind == "Healing"]
        if mend and mend[0]:
            heal = {"n": name, "k": "e", "m": 0, "hits": [[[mend[0].group(1), int(mend[0].group(2) or 0), "Healing"]]]}
            if bonus:
                heal["q"] = 1
            limit = clean(get("recharge")).lower()
            if limit and not re.search(r"turn|round", limit):
                heal["u"] = 4 if "four" in limit else 2 if "twice" in limit else 1
            return heal
        roll = clean(get("attack roll")).lower()
        save = clean(get("save")).lower()[:3]
        reach, metres = clean(get("range")).lower(), number(get("range m"))
        spell = clean(field(w, "type")).lower() == "spell" or roll.endswith("spell") or "spell" in cost
        melee = roll.startswith("melee") or (roll == "yes" and (reach in ("melee", "weapon") or (metres is not None and metres <= 4)))
        ability, comps, unknown, kept_by_line, sometimes = "", [], False, None, False
        for n in ("", " 1", " 2", " 3", " 4", " 5"):
            if (n == "" and "damage 1" in given) or (n == " 1" and "damage" in given and "damage 1" not in given):
                continue
            text, kind = clean(get("damage" + n)), clean(get("damage" + n + " type")) or (clean(get("damage type")) if n == " 1" else "")
            info = get("damage" + n + " info")
            sometimes = sometimes or bool(re.match(r"\s*if\b", clean(info), re.I))
            # with no roll and no save of its own, the damage line may name the save ("CON Saving Throw to halve")
            said = re.search(r"(\w+) saving throw to (halve|negate)", clean(info), re.I)
            if said and not roll:
                save = save if save in ABILITIES else said.group(1).lower()[:3]
                kept_by_line = 0.5 if said.group(2).lower() == "halve" else 0
            # healing is no damage, and a line that depends on a saving throw is not part of every hit
            if not text or kind == "Healing" or (roll and re.search(r"saving throw", info, re.I)):
                continue
            if text.lower() == "weapon":
                m = DICE.match(clean(field(weapon, "damage"))) if weapon else None
                if not m:
                    unknown = True
                    continue
                fine = clean(field(weapon, "finesse")).lower() in ("yes", "true")
                ability = ability or self.ability("finesse" if fine else "strength")
                comps.append([m.group(1), int(m.group(2) or 0) + self.mod(ability), clean(field(weapon, "damage type")), True])
                continue
            m = DICE.match(text)
            if not m:
                continue
            named = self.ability(m.group(3)) or self.ability(get("damage" + n + " modifier"))
            ability = ability or named
            comps.append([m.group(1), int(m.group(2) or 0) + (self.mod(named) if named else 0), "" if kind == "Weapon" else kind, bool(named)])
        # the weapon it strikes with is not named on the page: nothing to go by
        # (an action that only leaves a condition the test can use is kept, with no damage)
        if unknown or (not comps and not (cond and (roll or save in ABILITIES))):
            return None
        out = {"n": name + (" (" + given["item"] + ")" if given.get("item") else ""), "m": 1 if melee else 0}
        if roll:
            if spell:
                key = self.casting
            elif ability:
                key = ability
            elif roll.startswith("ranged") or not melee:
                key = "dex"
            else:
                key = "dex" if self.scores["dex"] > self.scores["str"] else "str"
            enchant = (number(field(weapon, "enchantment")) or 0) if weapon else 0
            parts = [["Proficiency", self.pb], [key.upper(), self.mod(key)]] + ([["Enchantment", enchant]] if enchant else [])
            # a Multiattack, or the same blow written several times over, is one attack for each line; a line of a
            # Multiattack with no ability of its own and no weapon damage type rides on the attack before it
            if name.startswith("Multiattack") or (len(comps) > 1 and all(c[:3] == comps[0][:3] for c in comps)):
                hits = []
                for c in comps:
                    if hits and not c[3] and c[2] not in ("Slashing", "Piercing", "Bludgeoning", ""):
                        hits[-1].append(c[:3])
                    else:
                        hits.append([c[:3]])
            else:
                hits = [[c[:3] for c in comps]]
            out.update({"k": "a", "b": sum(p[1] for p in parts), "w": parts, "hits": hits})
        elif save in ABILITIES:
            fixed = number(get("save dc")) if re.match(r"\s*\d+\s*$", get("save dc")) else None
            parts = [] if fixed else [["8", 8], ["Proficiency", self.pb], [self.casting.upper(), self.mod(self.casting)]]
            said = clean(get("on save")).lower()
            out.update({"k": "s", "sv": save, "dc": fixed or sum(p[1] for p in parts), "w": parts,
                        "os": kept_by_line if kept_by_line is not None else 0.5 if "half" in said else 0 if "negat" in said else 1, "hits": [[c[:3] for c in comps]]})
        else:
            out.update({"k": "h", "hits": [[c[:3] for c in comps]]})
        slot = re.search(r"spell(\d)", cost)
        if slot:
            out["sl"] = int(slot.group(1))
        recharge = clean(get("recharge")).lower()
        if recharge and not re.search(r"turn|round", recharge):
            out["u"] = 4 if "four" in recharge else 2 if "twice" in recharge else 1
        if re.search(r"can only use", clean(field(w, "summary")), re.I) or sometimes:
            out["c"] = 1
        if cond:
            out["cd"] = cond
        if roll and "half" in clean(get("on miss")).lower():
            out["om"] = 0.5
        if bonus:
            out["q"] = 1
        if spell:
            out["_spell"] = True
            # a spell of the planner's own list, with the damage of its page untouched: the planner can work out
            # what it does at the enemy's level and with a higher slot
            if clean(field(w, "type")).lower() == "spell" and not any(k.startswith("damage") for k in given):
                out["s"] = name
        return out


def average(act, more=0):
    """The damage of an action when everything lands, to tell the main one from the rest."""
    once = sum((int(d.split("d")[0]) * (int(d.split("d")[1]) + 1) / 2) + flat for hit in act["hits"] for d, flat, _ in hit if d)
    return once * (1 + more if act.get("x") else 1)


def extra_attacks(passives):
    return 2 if "Improved Extra Attack" in passives else 1 if "Extra Attack" in passives else 0


ANSWERS = re.compile(r"retaliat|strikes? back|when (?:struck|attacked|hit|damaged)|after (?:he is |she is |it is |being )?(?:struck|attacked|hit|damaged)|when (?:you|it|he|she) takes? damage|"
                     r"when (?:you take|taking) damage|upon first time that you take damage|\battackers?\b|that attacked|attacks or casts a spell", re.I)
# "…makes his assistants cast {{SAI|Wail of Loss (Assistant)}}": the action a reaction sets off (not one it may
# "still use", or uses "instead")
LINKED = re.compile(r"\b(?:cast|use)s?\s+(?:\{\{\s*(?:Sm|Lg|Md)?SAI\s*\||\[\[)([^}|\]]+)", re.I)


def linked_actions(w):
    out = []
    for part in re.split(r"(?<=[.!?])\s+", field(w, "summary") + " " + field(w, "description")):
        if not re.search(r"\bstill\b|\binstead\b", part, re.I):
            out += [x.strip() for x in LINKED.findall(part)]
    return out


def actions_of(name, pages, actions, items, box, scores, pb, flags):
    """Everything the enemy can do to a character with its action or its bonus action, the one it does by default
    first, and what its page lists that the damage test does not use: (actions, [[name, why]])."""
    text = (pages.get(name + "/Combat") or "") + "\n= =\n" + (pages.get(name) or "")
    passives = clean(field(box, "passives"))
    more = extra_attacks(passives)
    make = Maker(box, scores, pb)
    out, seen, unused = [], set(), []
    for title, given, mode in listed_actions(text):
        page = feature(actions.get(title, ""))
        act = make.action(title, given, actions.get(title, ""), items.get(given.get("item", ""), ""), more, flags=flags)
        if act and act["n"] not in seen:
            seen.add(act["n"])
            if mode:
                act["md"] = mode
            out.append(act)
        elif not act and title not in seen:
            seen.add(title)
            get = lambda k: given.get(k) or field(page, k)
            cost = get("cost").lower()
            hurts = any(DICE.match(clean(get("damage" + n))) or clean(get("damage" + n)).lower() == "weapon" for n in ("", " 1", " 2"))
            if not page:
                unused.append([title, "no page"])
            elif hurts and "reaction" in cost:
                unused.append([title, "reaction"])
            elif hurts and not re.search(r"action|bonus", cost):
                unused.append([title, "no cost"])
            elif hurts:
                unused.append([title, "weapon"])
    # Legendary Actions of Honour mode, from the passives of that mode
    for legend in re.findall(r"Legendary Action: ([^,;@]+)", clean(field(box, "h passives"))):
        if legend.strip() not in [u[0] for u in unused]:
            unused.append([legend.strip(), "legendary"])
    if not any(a["n"].startswith("Main Hand Attack") for a in out):
        # no Main Hand Attack listed: the weapon a passive of the infobox comes from; else, for a creature with no
        # melee attack of its own that is always there, the only weapon in its loot
        held = [x.strip() for x in re.findall(r"@\s*([^,;]+)", passives) if is_weapon(items.get(x.strip(), ""))]
        loot = [x for x in dict.fromkeys(loot_weapons(pages.get(name) or "") + loot_weapons(pages.get(name + "/Combat") or "")) if is_weapon(items.get(x, ""))]
        armed = any(a["k"] == "a" and a["m"] and not a.get("_spell") and not a.get("c") and not a.get("q") for a in out)
        weapon, why = (held[0], "its page lists no Main Hand Attack: this is the weapon one of its passives comes from") if held else \
            (loot[0], "its page lists no Main Hand Attack: this is the only weapon in its loot") if len(loot) == 1 and not armed else ("", "")
        if weapon:
            act = make.weapon_attack("Main Hand Attack (" + weapon + ")", items[weapon], more, why)
            if act:
                out.append(act)
    # two actions that do the same are one: the one that is always there stays
    limited = lambda a: bool(a.get("c") or a.get("u") or a.get("sl") or a.get("md"))
    kept = {}
    for a in sorted(out, key=limited):
        kept.setdefault(json.dumps([a["k"], a.get("b"), a.get("dc"), a.get("sv"), a["hits"], a.get("q"), a.get("md", "") if a.get("md") else ""]), a)
    out = [a for a in out if any(a is k for k in kept.values())]
    # the one it does turn after turn with its action: nothing that waits for a condition, runs out, takes a spell
    # slot or belongs to a harder mode. Its Multiattack, else the strongest attack roll, else the strongest left
    usual = [a for a in out if not a.get("q") and a["k"] != "e"]
    free = [a for a in usual if not limited(a)]
    rolls = [a for a in free if a["k"] == "a"]
    multi = [a for a in rolls if a["n"].startswith("Multiattack")]
    pool = multi or rolls or free or [a for a in usual if not a.get("c") and not a.get("md")]
    if pool:
        first = max(pool, key=lambda a: average(a, more))
        out.remove(first)
        out.insert(0, first)
    # what answers the character: its reactions, and the Legendary Actions of Honour mode. One is used when its page
    # gives it damage or a condition of its own; a "strike back" is one attack of its Main Hand; else the action its
    # text names. What is left stays in the list of things the test does not use.
    reacts = []
    for title, why in list(unused):
        if why not in ("reaction", "legendary", "no cost"):
            continue
        page = actions.get(title, "")
        w = feature(page)
        said = clean(field(w, "summary")) + " " + clean(field(w, "description")) + " " + clean(field(w, "extra description"))
        legendary = why == "legendary" or bool(re.search(r"\{\{\s*HonourBanner|legendary (?:re)?action", page[:1500], re.I))
        if why != "reaction" and not ANSWERS.search(said):
            continue
        act = make.action(title, {}, page, "", more, free=True, flags=flags)
        if not act and re.search(r"strike back|retaliat\w* with an attack", said, re.I):
            main = next((a for a in out if a["n"].startswith("Main Hand Attack")), None) or next((a for a in out if a["k"] == "a" and a["m"] and not a.get("q")), None)
            if main:
                act = {"n": title, "m": 1, "k": "a", "b": main["b"], "w": main["w"], "hits": [main["hits"][0]], "as": main["n"]}
        if not act:
            for linked in linked_actions(w):
                act = make.action(title, {}, actions.get(linked.strip(), ""), "", more, free=True, flags=flags)
                if act:
                    act["as"] = linked.strip()
                    break
        if not act:
            continue
        for k in ("q", "x", "_spell", "s", "sl"):
            act.pop(k, None)
        if legendary:
            act["md"] = "h"
            act["lg"] = 1
        same = lambda r: json.dumps([r["k"], r["hits"], r.get("cd")]) == json.dumps([act["k"], act["hits"], act.get("cd")])
        if any(same(r) for r in reacts):
            # the same answer listed twice (a melee and a ranged version): the Legendary Action stays
            if legendary:
                reacts = [r for r in reacts if not same(r)] + [act]
        else:
            reacts.append(act)
        unused.remove([title, why])
    for a in out + reacts:
        a.pop("_spell", None)
    return out, unused, reacts


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    titles = [name for _, name in ENEMIES]
    pages = page_texts(set(titles) | {name + "/Combat" for name in titles} | {"Superheated (Condition)", "Mage Armour (Condition)"})
    listed = {name: listed_actions((pages.get(name + "/Combat") or "") + "\n= =\n" + (pages.get(name) or "")) for name in titles}
    actions = page_texts({a for v in listed.values() for a, _, _ in v})
    wanted = {g["item"] for v in listed.values() for _, g, _ in v if g.get("item")}
    for name in titles:
        box = infobox(pages.get(name + "/Combat", "") or "", False) or infobox(pages.get(name, "") or "", False) or ""
        wanted |= {x.strip() for x in re.findall(r"@\s*([^,;]+)", clean(field(box, "passives")))}
        wanted |= set(loot_weapons(pages.get(name) or "")) | set(loot_weapons(pages.get(name + "/Combat") or ""))
    items = page_texts(wanted)
    # Legendary Actions are named in the passives of Honour mode; a reaction may only name the action it sets off
    boxes = {name: infobox(pages.get(name + "/Combat", "") or "", False) or infobox(pages.get(name, "") or "", False) or "" for name in titles}
    legends = {x.strip() for box in boxes.values() for x in re.findall(r"Legendary Action: ([^,;@]+)", clean(field(box, "h passives")))}
    actions.update(page_texts(legends - set(actions)))
    linked = {x for text in actions.values() for x in linked_actions(feature(text))}
    actions.update(page_texts(linked - set(actions)))
    # the conditions the actions leave: only those the damage test can use are kept
    named = {clean(field(feature(text), "condition" + n)) for text in actions.values() for n in ("", " 1", " 2")} - {""}
    cond_pages = page_texts({c + " (Condition)" for c in named} | named)
    flags = {c: condition_flags(cond_pages.get(c + " (Condition)") or cond_pages.get(c) or "")[0] for c in named}
    out, missing = [], []
    for act, name in ENEMIES:
        box = infobox(pages.get(name + "/Combat", "")) or infobox(pages.get(name, "")) or infobox(pages.get(name, ""), False)
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
        move = number(field(box, "movement m"))
        if move:
            e["mv"] = move
        # the kind of creature (Fiend, Undead, Humanoid…) is on its own page; an Initiative bonus, when the page gives one
        for src in (pages.get(name) or "", pages.get(name + "/Combat") or ""):
            kind = clean(field(infobox(src, False) or "", "type"))
            if kind:
                e["ty"] = kind
                break
        if number(field(box, "initiative")) is not None:
            e["in"] = number(field(box, "initiative"))
        acts, unused, reacts = actions_of(name, pages, actions, items, box, scores, e["pb"], flags)
        if acts:
            e["acts"] = acts
        if reacts:
            e["rx"] = reacts
        if unused:
            e["nu"] = unused
        # Extra Attacks in Balanced, Tactician and Honour mode, from the passives of each
        base = clean(field(box, "passives"))
        e["ea"] = [extra_attacks(base), extra_attacks(clean(field(box, "t passives")) or base), extra_attacks(clean(field(box, "h passives")) or clean(field(box, "t passives")) or base)]
        slots = {int(a): int(b) for a, b in re.findall(r"spell(\d)\s*:\s*(\d+)", field(box, "resources"))}
        if slots:
            e["rs"] = slots
        if e["ac"] is None:
            # no Armour Class on the page: Mage Armour kept on sets the base, and Dexterity adds to it
            base = re.search(r"Base \{\{Armour Class\}\} is (\d+)", pages.get("Mage Armour (Condition)", ""))
            if not base or "Mage Armour" not in field(box, "conditions"):
                missing.append(out.pop()["n"])
                continue
            e["ac"] = int(base.group(1)) + (scores["dex"] - 10) // 2
            e["note"] = f"Armour Class worked out from Mage Armour ({base.group(1)} + Dexterity modifier): the page gives no number."
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
        print(f"  act {act} · {name}: level {e['lv']}, AC {e['ac']}, HP {e['hp']}, slots {e.get('rs')}, moves {e.get('mv')}")
        for a in e.get("acts", []):
            how = f"+{a['b']}" if a["k"] == "a" else f"{a['sv'].upper()} DC {a['dc']} (x{a['os']})" if a["k"] == "s" else "heals" if a["k"] == "e" else "no roll"
            print("      ", a["n"], "|", how, "|", a["hits"], "|", {k: a[k] for k in ("sl", "u", "c", "m", "q", "md", "s", "x", "cd", "om") if a.get(k)}, "| worked out" if a.get("g") else "")
        for a in e.get("rx", []):
            how = f"+{a['b']}" if a["k"] == "a" else f"{a['sv'].upper()} DC {a['dc']} (x{a['os']})" if a["k"] == "s" else "no roll"
            print("       answers with", a["n"], "|", how, "|", a["hits"], "|", {k: a[k] for k in ("c", "md", "cd", "om", "as") if a.get(k)})
        if e.get("nu"):
            print("       not used:", e["nu"], "| extra attacks", e["ea"])
    if missing:
        print("  without a creature infobox with an Armour Class (left out):", ", ".join(missing))
    body = ",\n".join("  " + json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in out)
    js = ("// Reference enemies to measure damage against. Generated by tools/update_enemies.py from bg3.wiki;\n"
          "// do not edit by hand, re-run the script instead.\n"
          "// n name · act · lv level · ac Armour Class · hp hit points (b balanced, t tactician, h honour) · ab ability scores\n"
          "// sv saving throws it is proficient in · pb proficiency bonus · res damage types: r resistant, rn resistant to\n"
          "// non-magical damage only, rm resistant to magical only, i immune, in immune to non-magical only,\n"
          "// ip immune to non-magical and resistant to magical, v vulnerable · note what to know about the fight\n"
          "// mv movement in metres · rs its spell slots by level · acts what it does with its action, the usual one first:\n"
          "//   n name · k a attack roll, s saving throw, h no roll · m 1 melee · b attack bonus or dc save DC, with the parts\n"
          "//   it is worked out from in w (empty when the DC is the action's own) · sv the save · os what stays on a passed\n"
          "//   save · hits one list of [dice, flat, type] for each attack · sl spell slot · u uses a fight · c 1 when it\n"
          "//   waits for a condition · g why it is here when the page does not list it · q 1 bonus action · k e heals itself\n"
          "//   md t from Tactician up, h in Honour mode only · s the spell it is, when the planner has it · x 1 once more\n"
          "//   for each Extra Attack · cd the condition it leaves: [name, turns, save, DC] · om what a miss still deals\n"
          "// ea Extra Attacks in [Balanced, Tactician, Honour] · nu listed but not used: [name, why] · ty kind of creature\n"
          "// in Initiative bonus, when the page gives one · rx what answers a hit, once a round (lg 1: a Legendary Action;\n"
          "//   as: the action whose numbers it borrows)\n"
          "window.BG3_ENEMIES = [\n" + body + "\n];\n")
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    record("enemies")
    print(f"Wrote {len(out)} enemies to {OUT}")


if __name__ == "__main__":
    main()
