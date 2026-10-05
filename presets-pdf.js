// Ready-made builds: the other builds from Morgana Evelyn's Honour Mode Party Template.
// Same shape as presets.js. Gear is split by act using each item's location on bg3.wiki;
// "where" is "Location — how to get it". Pieces from the guide's second loadout are under "alts".
(function () {
  'use strict';
  window.BG3_PRESETS = (window.BG3_PRESETS || []).concat([
    {
      "presetId": "sorcadin",
      "name": "Sorcadin",
      "role": "Melee damage · control and support",
      "credit": "Morgana Evelyn — Honour Mode Party Template",
      "summary": "A paladin/sorcerer that works as the party's mainstay: heavy armour, smites and a high spell save DC for Sleet Storm, upcast Command and Hold Person. Since Patch 8, Quickened Booming Blade smites with an upcast Shadow Blade delete targets on the first hit.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "",
        "skills": "",
        "abilities": {
          "str": 14,
          "dex": 10,
          "con": 14,
          "int": 8,
          "wis": 10,
          "cha": 15
        },
        "plus2": "str",
        "plus1": "cha"
      },
      "levels": [
        {
          "cls": "Paladin",
          "sub": "Vengeance Paladin",
          "picks": []
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": [
            "Fighting Style: Defence"
          ]
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": [
            "Feat: Alert"
          ]
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Sorcerer",
          "sub": "Shadow Sorcerer",
          "picks": [
            "Cantrip: Booming Blade",
            "Cantrip: Friends (or your choice)",
            "Cantrip: Minor Illusion",
            "Cantrip: Ray of Frost (or your choice)",
            "Spell: Magic Missile (or your choice)",
            "Spell: Shield"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Thunderwave (or your choice)",
            "Metamagic: Extended Spell",
            "Metamagic: Twinned Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Mirror Image",
            "Spell: Shadow Blade (replaces Thunderwave)",
            "Metamagic: Quickened Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Cantrip: Light",
            "Spell: Blur",
            "Feat: Savage Attacker"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Sleet Storm"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Counterspell"
          ]
        }
      ],
      "setup": [
        {
          "name": "Drakethroat Glaive",
          "note": "Moonrise Towers (Act 2) — Roah Moonglow. Use on the primary weapon"
        },
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        },
        {
          "name": "Resonance Stone",
          "note": "Mind Flayer Colony (Act 2) — south-west of the Necrotic Laboratory. Disadvantage on mental Saving Throws and double psychic damage"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Bloodlust",
          "note": ""
        },
        {
          "name": "Elixir of Cloud Giant Strength",
          "note": ""
        }
      ],
      "variants": "• Solo / Shadow Blade distribution — 8 STR / 16 DEX / 14 CON / 10 INT / 10 WIS / 16 CHA\n• Two-handed loadouts for each act are listed under the alternatives\n• The guide swaps a free-choice spell for Shadow Blade at Sorcerer 3: Thunderwave is the one replaced here. Hypnotic Pattern at level 12 is optional in the guide (Counterspell is set). Filled in by the planner, not in the guide (\"player's choice\"): the cantrip of Sorcerer 4 (Light).",
      "notes": "The gear shown is the guide's 1h + shield set in Act 1, the Shadow Blade set in Act 2 and the Solo set in Act 3.",
      "source": "https://youtu.be/vvDdS5uxAOs",
      "gear": {
        "act1": {
          "slots": {
            "head": {
              "name": "Grymskull Helm",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Carried by Grym",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Adamantine Splint Armour",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Forged from a Splint Mould and Mithral Ore",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of the Growling Underdog",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — In Dror Ragzlin treasure crates behind the locked iron gate",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Disintegrating Night Walkers",
              "rarity": "",
              "where": "Grymforge — Worn by Nere",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Ring of Protection",
              "rarity": "rare",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Strange Conduit Ring",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — Inside an elegant chest in the Inquisitor's Chamber",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Phalar Aluve",
              "rarity": "rare",
              "where": "Underdark — Embedded inside a rock",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Adamantine Shield",
              "rarity": "rare",
              "where": "Adamantine Forge — Forged from a Shield Mould and Mithral Ore",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "meleeMain",
              "name": "Svartlebee's Woundseeker",
              "where": "Waukeen's Rest — Carried by Yeva",
              "note": "Two-handed loadout"
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Helmet of Arcane Acuity",
              "rarity": "uncommon",
              "where": "Mason's Guild — in a locked and trapped Gilded Chest in a secret basement area",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Flawed Helldusk Armour",
              "rarity": "rare",
              "where": "Last Light Inn — Crafted by Dammon",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Flawed Helldusk Gloves",
              "rarity": "rare",
              "where": "Last Light Inn — Crafted by Dammon after giving him a third piece of Infernal Iron",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Evasive Shoes",
              "rarity": "rare",
              "where": "Last Light Inn — Sold by Mattis",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Killer's Sweetheart",
              "rarity": "veryrare",
              "where": "Gauntlet of Shar — On the ground where the shadow copy appearing next to the Brazier is defeated in the Self-Same Trial",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Shadow Blade",
              "rarity": "",
              "where": "Conjured with the Shadow Blade spell",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Sentinel Shield",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "gloves",
              "name": "Gloves of Battlemage's Power",
              "where": "Reithwin Tollhouse — in a locked opulent chest on the second floor in the room with two locked doors",
              "note": "Two-handed loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Halberd of Vigilance",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "Two-handed loadout"
            },
            {
              "slot": "head",
              "name": "Holy Lance Helm",
              "where": "Rosymorn Monastery — In a painted chest, accessible from the top level",
              "note": ""
            },
            {
              "slot": "head",
              "name": "Diadem of Arcane Synergy",
              "where": "Crèche Y'llek — Carried by Jhe'rezath in the Inquisitor's Chamber",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Breastplate +1",
              "where": "Emerald Grove — On crate near Dammon in the The Hollow",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Luminous Armour",
              "where": "Selûnite Outpost — in a locked and trapped opulent chest",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Dwarven Splintmail",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Reaper's Embrace",
              "where": "Mind Flayer Colony — Worn by Ketheric Thorm",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Luminous Gloves",
              "where": "Ruined Battlefield — in the potter's chest",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Dark Justiciar Gauntlets (Uncommon)",
              "where": "Gauntlet of Shar — on a pile of boxes, near Yurgir",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Dark Justiciar Gauntlets (Rare)",
              "where": "Shadowfell — Rewarded to Shadowheart for killing the Nightsong",
              "note": ""
            },
            {
              "slot": "ring1",
              "name": "Shadow-Cloaked Ring",
              "where": "Ruined Battlefield — Carried by Shadow Mastiff Alpha in a cursed camp north of the ruined pottery",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Unseen Menace",
              "where": "Crèche Y'llek — Sold by Jeera",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Soulbreaker Greatsword",
              "where": "Crèche Y'llek — Carried by Therezzyn in the Captain's Quarters",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Doom Hammer",
              "where": "Goblin Camp — Sold by Grat",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Safeguard Shield",
              "where": "The Hollow — Sold by Dammon in the Emerald Grove",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Ketheric's Shield",
              "where": "Mind Flayer Colony — Carried by Ketheric Thorm when fought atop Moonrise Towers and in the Mind Flayer Colony (see notes)",
              "note": ""
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Hood of the Weave",
              "rarity": "veryrare",
              "where": "Philgrave's Mansion — Sold by Mystic Carrion",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of the Weave",
              "rarity": "veryrare",
              "where": "Devil's Fee — Sold by Helsik once her special stock is unlocked",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Helldusk Armour",
              "rarity": "legendary",
              "where": "House of Hope — Carried by Raphael",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Craterflesh Gloves",
              "rarity": "rare",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Persistence",
              "rarity": "veryrare",
              "where": "Forge of the Nine — Sold by Dammon in the Lower City",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Amulet of the Devout",
              "rarity": "veryrare",
              "where": "Stormshore Tabernacle — in the main Offering Chest in the basement",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Feywild Sparks",
              "rarity": "veryrare",
              "where": "The Blushing Mermaid — Carried by Auntie Ethel",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Shadow Blade",
              "rarity": "",
              "where": "Conjured with the Shadow Blade spell",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Viconia's Walking Fortress",
              "rarity": "legendary",
              "where": "Cloister of Sombre Embrace — Carried by Viconia DeVir during the quest Daughter of Darkness",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "boots",
              "name": "Helldusk Boots",
              "where": "Wyrm's Rock Fortress — in a locked Gilded Chest on the top floor",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Dolor Amarus",
              "where": "Highberry's Home — Carried by Dolor",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Vicious Shortbow",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Bhaalist Armour",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": "Piercing Vulnerability loadout"
            },
            {
              "slot": "ring1",
              "name": "Shadow-Cloaked Ring",
              "where": "Ruined Battlefield — Carried by Shadow Mastiff Alpha in a cursed camp north of the ruined pottery",
              "note": "Piercing Vulnerability loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Shar's Spear of Evening",
              "where": "Shadowfell — Rewarded to Shadowheart for killing the Aylin",
              "note": "Piercing Vulnerability loadout"
            },
            {
              "slot": "head",
              "name": "Helm of Balduran",
              "where": "The Dragon's Sanctum — On a stone altar next to Ansur",
              "note": "Two-handed loadout"
            },
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": "Two-handed loadout"
            },
            {
              "slot": "chest",
              "name": "Armour of Persistence",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": "Two-handed loadout"
            },
            {
              "slot": "gloves",
              "name": "Gauntlets of Hill Giant Strength",
              "where": "House of Hope — on a pedestal in the Archive",
              "note": "Two-handed loadout"
            },
            {
              "slot": "amulet",
              "name": "Amulet of Greater Health",
              "where": "House of Hope — on the left-most pedestal in the Archive",
              "note": "Two-handed loadout"
            },
            {
              "slot": "ring1",
              "name": "Ring of Protection",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "Two-handed loadout"
            },
            {
              "slot": "ring2",
              "name": "Killer's Sweetheart",
              "where": "Gauntlet of Shar — On the ground where the shadow copy appearing next to the Brazier is defeated in the Self-Same Trial",
              "note": "Two-handed loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Balduran's Giantslayer",
              "where": "The Dragon's Sanctum — on the corpse of Ansur",
              "note": "Two-handed loadout"
            }
          ]
        }
      },
      "prepared": {
        "Paladin": [
          "Bless",
          "Command",
          "Divine Favour",
          "Protection from Evil and Good",
          "Searing Smite",
          "Shield of Faith",
          "Thunderous Smite",
          "Wrathful Smite",
          "Aid"
        ]
      }
    },
    {
      "presetId": "ice-sorcerer",
      "name": "Ice Sorcerer",
      "role": "Crowd control · cold damage",
      "credit": "Morgana Evelyn — Honour Mode Party Template (build by Curar)",
      "summary": "A full Draconic Sorcerer built around ice: slippery surfaces, Frozen targets and slowed enemies. Wet plus Twinned or Quickened Ray of Frost gives solid damage, and the spell save DC also decides whether enemies slip.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "",
        "skills": "",
        "abilities": {
          "str": 8,
          "dex": 14,
          "con": 15,
          "int": 8,
          "wis": 10,
          "cha": 15
        },
        "plus2": "cha",
        "plus1": "con"
      },
      "levels": [
        {
          "cls": "Sorcerer",
          "sub": "Draconic Sorcerer",
          "picks": [
            "Draconic Ancestry: White (Cold)",
            "Cantrip: Friends",
            "Cantrip: Mage Hand",
            "Cantrip: Minor Illusion",
            "Cantrip: Ray of Frost",
            "Spell: Magic Missile",
            "Spell: Shield"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Enhance Leap",
            "Metamagic: Extended Spell",
            "Metamagic: Twinned Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Hold Person",
            "Metamagic: Quickened Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Cantrip: Light",
            "Feat: Ability Improvement +2 CHA",
            "Spell: Misty Step"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Sleet Storm"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Counterspell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Ice Storm"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Greater Invisibility",
            "Feat: Dual Wielder"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Cone of Cold"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Cantrip: Blade Ward",
            "Spell: Hold Monster",
            "Metamagic: Heightened Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Globe of Invulnerability"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Feat: Elemental Adept - Cold",
            "Spell: Chain Lightning"
          ]
        }
      ],
      "setup": [
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        },
        {
          "name": "Shield of Devotion",
          "note": "Last Light Inn (Act 2). Equip and re-equip to refresh its spell slot"
        },
        {
          "name": "Potion of Angelic Reprieve",
          "note": ""
        },
        {
          "name": "Freecast",
          "note": "Act 3: refresh it by moving in and out of any aura"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Bloodlust",
          "note": ""
        },
        {
          "name": "Water",
          "note": "Throw to make targets Wet"
        }
      ],
      "variants": "• Armour of Agathys is not chosen: it comes with the White ancestry. Filled in by the planner, not in the guide (\"your choice\"): the cantrips of levels 4 and 10 (Light, Blade Ward) and the spell of level 12 (Chain Lightning).",
      "notes": "Skills: Athletics if playing solo, social skills in a party.\nThe gear shown is the guide's Solo set; the Party differences are listed under the alternatives.",
      "source": "https://www.youtube.com/watch?v=nmIDi4tgkpI",
      "gear": {
        "act1": {
          "slots": {
            "gloves": {
              "name": "Winter's Clutches",
              "rarity": "uncommon",
              "where": "Underdark — Given by Glut for completing Avenge Glut's Circle",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Necklace of Elemental Augmentation",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — inside a display case in the Inquisitor's Chamber",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Mourning Frost",
              "rarity": "veryrare",
              "where": "Underdark — Created by combining the components carried by the three Drow mages competing to discover the Adamantine Forge:; Icy Crystal - carried by Filro the Forgotten near the Sus",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Melf's First Staff",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "boots",
              "name": "Hoarfrost Boots",
              "where": "Crèche Y'llek — Inside a display case in the Inquisitor's Chamber",
              "note": "Party loadout"
            },
            {
              "slot": "chest",
              "name": "The Protecty Sparkswall",
              "where": "Grymforge — in a gilded chest at the end of the trapped bridge",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "The Spellsparkler",
              "where": "Waukeen's Rest — Rewarded by Florrick for rescuing her from the burning inn during the quest Rescue the Grand Duke.",
              "note": ""
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Coldbrim Hat",
              "rarity": "uncommon",
              "where": "Moonrise Towers — In a locked chest in a hidden room behind a bookcase in Balthazar's Chambers",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Potent Robe",
              "rarity": "veryrare",
              "where": "Last Light Inn — Rewarded by Alfira for successfully completing Rescue the Tieflings",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Winter's Clutches",
              "rarity": "uncommon",
              "where": "Underdark — Given by Glut for completing Avenge Glut's Circle",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Necklace of Elemental Augmentation",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — inside a display case in the Inquisitor's Chamber",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Snowburst Ring",
              "rarity": "uncommon",
              "where": "Last Light Inn — Inside a loose plank in the bedroom north of the bar",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Mourning Frost",
              "rarity": "veryrare",
              "where": "Underdark — Created by combining the components carried by the three Drow mages competing to discover the Adamantine Forge:; Icy Crystal - carried by Filro the Forgotten near the Sus",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Melf's First Staff",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "boots",
              "name": "Hoarfrost Boots",
              "where": "Crèche Y'llek — Inside a display case in the Inquisitor's Chamber",
              "note": "Party loadout"
            },
            {
              "slot": "meleeOff",
              "name": "Sentinel Shield",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": ""
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Birthright",
              "rarity": "veryrare",
              "where": "Sorcerous Sundries — Sold by Lorroakan's Projection or Rolan on the ground floor",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of the Weave",
              "rarity": "veryrare",
              "where": "Devil's Fee — Sold by Helsik once her special stock is unlocked",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Potent Robe",
              "rarity": "veryrare",
              "where": "Last Light Inn — Rewarded by Alfira for successfully completing Rescue the Tieflings",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Spellmight Gloves",
              "rarity": "veryrare",
              "where": "Circus of the Last Days — Rewarded by Lucretious at the end of the Find Dribbles the Clown quest",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Necklace of Elemental Augmentation",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — inside a display case in the Inquisitor's Chamber",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Snowburst Ring",
              "rarity": "uncommon",
              "where": "Last Light Inn — Inside a loose plank in the bedroom north of the bar",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Markoheshkir",
              "rarity": "legendary",
              "where": "Ramazith's Tower — in a Globe of Invulnerability",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Mourning Frost",
              "rarity": "veryrare",
              "where": "Underdark — Created by combining the components carried by the three Drow mages competing to discover the Adamantine Forge:; Icy Crystal - carried by Filro the Forgotten near the Sus",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Hoarfrost Boots",
              "where": "Crèche Y'llek — Inside a display case in the Inquisitor's Chamber",
              "note": "Party loadout"
            },
            {
              "slot": "ring2",
              "name": "Ring of Feywild Sparks",
              "where": "The Blushing Mermaid — Carried by Auntie Ethel",
              "note": "Party loadout"
            }
          ]
        }
      }
    },
    {
      "presetId": "tavern-brawler-monk",
      "name": "Tavern Brawler Monk",
      "role": "Melee damage · stuns",
      "credit": "Morgana Evelyn — Honour Mode Party Template",
      "summary": "Unarmed striker and one of the most consistent damage dealers: Tavern Brawler adds the Strength modifier twice to attack and damage rolls. Stunning Strike removes enemy turns and Flurry of Blows removes enemies. This is the party version (9 Open Hand Monk / 3 Thief).",
      "creation": {
        "origin": "Karlach",
        "race": "Tiefling",
        "subrace": "Zariel Tiefling",
        "background": "Outlander",
        "skills": "Athletics",
        "abilities": {
          "str": 8,
          "dex": 14,
          "con": 15,
          "int": 8,
          "wis": 15,
          "cha": 10
        },
        "plus2": "dex",
        "plus1": "wis"
      },
      "levels": [
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "Open Hand Monk",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": [
            "Feat: Tavern Brawler +1 CON"
          ]
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": [
            "Feat: Alert"
          ]
        },
        {
          "cls": "Monk",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Rogue",
          "sub": "",
          "picks": [
            "Expertise: Athletics + Stealth"
          ]
        },
        {
          "cls": "Rogue",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Rogue",
          "sub": "Thief",
          "picks": []
        }
      ],
      "setup": [
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        },
        {
          "name": "Resonance Stone",
          "note": "Mind Flayer Colony (Act 2) — south-west of the Necrotic Laboratory. Psychic damage vulnerability"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Hill Giant Strength",
          "note": "21 STR: with Tavern Brawler that is +10 to attack and damage rolls"
        },
        {
          "name": "Elixir of Cloud Giant Strength",
          "note": ""
        }
      ],
      "variants": "• Solo — 6 Open Hand Monk / 4 Thief / 2 Fighter. 8 STR / 17 DEX / 15 CON / 8 INT / 16 WIS / 8 CHA. The Fighter levels give armour proficiency and Action Surge\n• Radiant Orb (used in the Impossible Challenge) — 1 Fighter / 6 Open Hand Monk / 4 Thief / 1 Fighter solo, or 1 Fighter / 8 Open Hand Monk / 3 Thief in a party. Holy Lance Helm, Luminous Gloves and Luminous Armour: radiant unarmed hits from Monk 6 stack Radiating Orbs, up to -10 to enemy attack rolls",
      "notes": "ORIGIN\nKarlach (2d4 Fire damage from Act 1) or Astarion (1d10 Necrotic damage in Act 3).\nPer the guide, Soul Coins are bugged: they last until Long Rest, do not need Karlach to be Raging or at low health, and add 2d4 Fire to unarmed attacks.\n\nSKILLS\nAthletics is required; the rest is your choice.",
      "source": "https://www.youtube.com/watch?v=vC3m1PXG3RQ",
      "gear": {
        "act1": {
          "slots": {
            "chest": {
              "name": "The Graceful Cloth",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "The Sparkle Hands",
              "rarity": "rare",
              "where": "Decrepit Sanctuary — in a wooden chest at the base of the giant tree stump in the Sunlit Wetlands",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Sentient Amulet (Rare)",
              "rarity": "rare",
              "where": "Abandoned Refuge — In a locked Adamantine Chest on the island with the broken structure near the Lava Elemental in Grymforge",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Ring of Flinging",
              "rarity": "uncommon",
              "where": "The Hollow — Sold by Arron next to the Silvanus statue",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Protection",
              "rarity": "rare",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "amulet",
              "name": "Periapt of Wound Closure",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "Solo loadout"
            },
            {
              "slot": "gloves",
              "name": "Gloves of Uninhibited Kushigo",
              "where": "Ebonlake Grotto — Reward by Derryth Bonecloak for saving Baelen Bonecloak during Find the Mushroom Picker",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Disintegrating Night Walkers",
              "where": "Grymforge — Worn by Nere",
              "note": ""
            },
            {
              "slot": "ring1",
              "name": "Crusher's Ring",
              "where": "Goblin Camp — Worn by Crusher",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Bow of Awareness",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Titanstring Bow",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Adamantine Mace",
              "where": "Adamantine Forge — Forged with a Mace Mould and Mithral Ore",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Adamantine Shield",
              "where": "Adamantine Forge — Forged from a Shield Mould and Mithral Ore",
              "note": ""
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Fistbreaker Helm",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "The Graceful Cloth",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "The Sparkle Hands",
              "rarity": "rare",
              "where": "Decrepit Sanctuary — in a wooden chest at the base of the giant tree stump in the Sunlit Wetlands",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Evasive Shoes",
              "rarity": "rare",
              "where": "Last Light Inn — Sold by Mattis",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Sentient Amulet (Rare)",
              "rarity": "rare",
              "where": "Abandoned Refuge — In a locked Adamantine Chest on the island with the broken structure near the Lava Elemental in Grymforge",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Ring of Flinging",
              "rarity": "uncommon",
              "where": "The Hollow — Sold by Arron next to the Silvanus statue",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Protection",
              "rarity": "rare",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "amulet",
              "name": "Periapt of Wound Closure",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "Solo loadout"
            },
            {
              "slot": "ring1",
              "name": "Ring of Free Action",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "Solo loadout"
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Horns of the Berserker",
              "rarity": "veryrare",
              "where": "Danthelon's Dancing Axe — Sold by Entharl Danthelon in Wyrm's Crossing",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Vest of Soul Rejuvenation",
              "rarity": "veryrare",
              "where": "Sorcerous Sundries — sold by Rolan or Lorroakan's Projection",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of Soul Catching",
              "rarity": "legendary",
              "where": "House of Hope — Given by Hope for completing her quest Save Hope",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Uninhibited Kushigo",
              "rarity": "rare",
              "where": "Astral Plane — Carried by Lir'i'c, as entering Act Three",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Sentient Amulet (Very Rare)",
              "rarity": "veryrare",
              "where": "Open Hand Temple Cellar — Obtained upon completing the Help the Cursed Monk quest",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Ring of Flinging",
              "rarity": "uncommon",
              "where": "The Hollow — Sold by Arron next to the Silvanus statue",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Protection",
              "rarity": "rare",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": ""
            },
            {
              "slot": "amulet",
              "name": "Amulet of Greater Health",
              "where": "House of Hope — on the left-most pedestal in the Archive",
              "note": "Solo loadout"
            },
            {
              "slot": "ring1",
              "name": "Ring of Free Action",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "Solo loadout"
            }
          ]
        }
      }
    },
    {
      "presetId": "battle-master-fighter",
      "name": "Battle Master Fighter",
      "role": "Melee damage · simple and forgiving",
      "credit": "Morgana Evelyn — Honour Mode Party Template",
      "summary": "A pure Fighter: no multiclassing, very forgiving with gear and easy to pick up. Three attacks at level 11, Action Surge and Battle Master manoeuvres do the rest.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "",
        "skills": "Athletics",
        "abilities": {
          "str": 8,
          "dex": 14,
          "con": 15,
          "int": 10,
          "wis": 14,
          "cha": 10
        },
        "plus2": "dex",
        "plus1": "con"
      },
      "levels": [
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Fighting Style: Great Weapon Fighting (or Archery / Defence)"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Fighter",
          "sub": "Battle Master",
          "picks": [
            "Manoeuvre: Precision Attack",
            "Manoeuvre: Riposte",
            "Manoeuvre: Trip Attack"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Feat: Alert"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Feat: Great Weapon Master (or Savage Attacker; Sharpshooter for a Dex archer)"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Manoeuvre: Disarming Attack",
            "Manoeuvre: Pushing Attack"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Feat: Savage Attacker (whichever you skipped at level 6)"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Manoeuvre: Menacing Attack",
            "Manoeuvre: Goading Attack"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Feat: Ability Improvement (+2 STR)"
          ]
        }
      ],
      "setup": [
        {
          "name": "Drakethroat Glaive",
          "note": "Moonrise Towers (Act 2) — Roah Moonglow. Thunder on the Titanstring"
        },
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Bloodlust",
          "note": ""
        },
        {
          "name": "Elixir of Hill Giant Strength",
          "note": ""
        }
      ],
      "variants": "• Without elixir — 17 STR / 16 DEX / 14 CON / 8 INT / 10 WIS / 8 CHA\n• Swap CON and DEX to taste\n• Filled in by the planner, not in the guide (\"your choice\"): the two manoeuvres of level 10 (Menacing Attack, Goading Attack). At level 12 the guide offers Ability Improvement (your choice), Athlete or Tough: Ability Improvement +2 STR is set here.",
      "notes": "The ability scores shown are the guide's With Elixir distribution: Strength comes from Elixir of Hill Giant Strength.\nChoose the fighting style for the weapons you will use; the guide assumes Great Weapon Fighting.",
      "source": "",
      "gear": {
        "act1": {
          "slots": {
            "head": {
              "name": "Grymskull Helm",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Carried by Grym",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Disintegrating Night Walkers",
              "rarity": "",
              "where": "Grymforge — Worn by Nere",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Soulbreaker Greatsword",
              "rarity": "rare",
              "where": "Crèche Y'llek — Carried by Therezzyn in the Captain's Quarters",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "ring1",
              "name": "Crusher's Ring",
              "where": "Goblin Camp — Worn by Crusher",
              "note": "Party loadout"
            },
            {
              "slot": "ring2",
              "name": "Ring of Protection",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "Party loadout"
            },
            {
              "slot": "rangedMain",
              "name": "Giantbreaker",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": "Party loadout"
            },
            {
              "slot": "head",
              "name": "Haste Helm",
              "where": "Blighted Village — Inside the Moss-Covered Chest",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Adamantine Splint Armour",
              "where": "Adamantine Forge — Forged from a Splint Mould and Mithral Ore",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Gloves of the Growling Underdog",
              "where": "Shattered Sanctum — In Dror Ragzlin treasure crates behind the locked iron gate",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Boots of Speed",
              "where": "Ebonlake Grotto — Worn by Thulla",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Doom Hammer",
              "where": "Goblin Camp — Sold by Grat",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Svartlebee's Woundseeker",
              "where": "Waukeen's Rest — Carried by Yeva",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Jorgoral's Greatsword",
              "where": "Grymforge — carried or sold by Corsair Greymon",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Unseen Menace",
              "where": "Crèche Y'llek — Sold by Jeera",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Titanstring Bow",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": ""
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Grymskull Helm",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Carried by Grym",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Plate Armour +2",
              "rarity": "rare",
              "where": "Sold by traders with levelled magic armour once you are level 11 or above",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Flawed Helldusk Gloves",
              "rarity": "rare",
              "where": "Last Light Inn — Crafted by Dammon after giving him a third piece of Infernal Iron",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Disintegrating Night Walkers",
              "rarity": "",
              "where": "Grymforge — Worn by Nere",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Free Action",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Soulbreaker Greatsword",
              "rarity": "rare",
              "where": "Crèche Y'llek — Carried by Therezzyn in the Captain's Quarters",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "boots",
              "name": "Evasive Shoes",
              "where": "Last Light Inn — Sold by Mattis",
              "note": "Party loadout"
            },
            {
              "slot": "ring1",
              "name": "Crusher's Ring",
              "where": "Goblin Camp — Worn by Crusher",
              "note": "Party loadout"
            },
            {
              "slot": "ring2",
              "name": "Ring of Protection",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "Party loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Halberd of Vigilance",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "Party loadout"
            },
            {
              "slot": "rangedMain",
              "name": "Giantbreaker",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": "Party loadout"
            },
            {
              "slot": "chest",
              "name": "Reaper's Embrace",
              "where": "Mind Flayer Colony — Worn by Ketheric Thorm",
              "note": ""
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Helm of Balduran",
              "rarity": "legendary",
              "where": "The Dragon's Sanctum — On a stone altar next to Ansur",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Helldusk Armour",
              "rarity": "legendary",
              "where": "House of Hope — Carried by Raphael",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Legacy of the Masters",
              "rarity": "veryrare",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Persistence",
              "rarity": "veryrare",
              "where": "Forge of the Nine — Sold by Dammon in the Lower City",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Amulet of Greater Health",
              "rarity": "veryrare",
              "where": "House of Hope — on the left-most pedestal in the Archive",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Crusher's Ring",
              "rarity": "uncommon",
              "where": "Goblin Camp — Worn by Crusher",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Silver Sword of the Astral Plane",
              "rarity": "legendary",
              "where": "Lower City Sewers — Rewarded for showing the Orphic Hammer to (or killing) Voss after agreeing to meet him in the sewers within the Undercity in Act Three",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "chest",
              "name": "Armour of Persistence",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Gauntlets of the Warmaster",
              "where": "Danthelon's Dancing Axe — Sold by Entharl Danthelon in Wyrm's Crossing",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Gauntlets of Hill Giant Strength",
              "where": "House of Hope — on a pedestal in the Archive",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Helldusk Boots",
              "where": "Wyrm's Rock Fortress — in a locked Gilded Chest on the top floor",
              "note": ""
            },
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": ""
            },
            {
              "slot": "meleeMain",
              "name": "Balduran's Giantslayer",
              "where": "The Dragon's Sanctum — on the corpse of Ansur",
              "note": ""
            },
            {
              "slot": "cloak",
              "name": "Cloak of Displacement",
              "where": "Danthelon's Dancing Axe — Sold by Entharl Danthelon in Wyrm's Crossing",
              "note": "Party loadout"
            }
          ]
        }
      }
    },
    {
      "presetId": "frost-giant-barbarian",
      "name": "Frost Giant Barbarian",
      "role": "Throw and melee damage · frontliner",
      "credit": "Morgana Evelyn — Honour Mode Party Template",
      "summary": "Path of the Giant barbarian that throws and kicks things. Solid, consistent and durable damage; the cold version freezes targets through Encrusted with Frost without casting a single spell.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "",
        "skills": "Athletics",
        "abilities": {
          "str": 8,
          "dex": 15,
          "con": 15,
          "int": 8,
          "wis": 14,
          "cha": 10
        },
        "plus2": "con",
        "plus1": "dex"
      },
      "levels": [
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "Giant Barbarian",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": [
            "Feat: Tavern Brawler +1 CON"
          ]
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": [
            "Feat: Alert (or Dual Wielder)"
          ]
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Barbarian",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": [
            "Fighting Style: Defence, Great Weapon Fighting or Two-Weapon Fighting"
          ]
        },
        {
          "cls": "Fighter",
          "sub": "",
          "picks": []
        }
      ],
      "setup": [
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Hill Giant Strength",
          "note": ""
        },
        {
          "name": "Elixir of Cloud Giant Strength",
          "note": ""
        }
      ],
      "variants": "• 8 Giant Barbarian / 4 Thief — if you prefer kicking to throwing\n• Without elixir — 17 STR / 14 DEX / 16 CON / 8 INT / 10 WIS / 8 CHA",
      "notes": "ENCRUSTED WITH FROST\nElemental Cleaver: Cold adds 1d6 Cold damage, which makes Winter's Clutches apply 2 turns of Encrusted with Frost; that condition then makes the Coldbrim Hat add 2 more. At 7 stacks the target saves (DC 12 CON) or is Frozen: incapacitated for 2 turns and vulnerable to Bludgeoning, Thunder and Force.\n\nSCARLET SATURATION\nKills with Rhapsody grant Scarlet Remittance, which becomes Scarlet Saturation. Thrown attacks do not consume it, so every throw crits for two turns.\n\nThe gear shown is the guide's Lightning set; the Cold pieces are listed under the alternatives.",
      "source": "https://www.youtube.com/watch?v=PO5TdvMgrXo",
      "gear": {
        "act1": {
          "slots": {
            "gloves": {
              "name": "The Sparkle Hands",
              "rarity": "rare",
              "where": "Decrepit Sanctuary — in a wooden chest at the base of the giant tree stump in the Sunlit Wetlands",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Disintegrating Night Walkers",
              "rarity": "",
              "where": "Grymforge — Worn by Nere",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "gloves",
              "name": "Winter's Clutches",
              "where": "Underdark — Given by Glut for completing Avenge Glut's Circle",
              "note": "Cold loadout"
            },
            {
              "slot": "head",
              "name": "Cap of Wrath",
              "where": "Grymforge — Carried by Thudd",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "The Graceful Cloth",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Gloves of Uninhibited Kushigo",
              "where": "Ebonlake Grotto — Reward by Derryth Bonecloak for saving Baelen Bonecloak during Find the Mushroom Picker",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Titanstring Bow",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": ""
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Coldbrim Hat",
              "rarity": "uncommon",
              "where": "Moonrise Towers — In a locked chest in a hidden room behind a bookcase in Balthazar's Chambers",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Enraging Heart Garb",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "The Sparkle Hands",
              "rarity": "rare",
              "where": "Decrepit Sanctuary — in a wooden chest at the base of the giant tree stump in the Sunlit Wetlands",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Disintegrating Night Walkers",
              "rarity": "",
              "where": "Grymforge — Worn by Nere",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Periapt of Wound Closure",
              "rarity": "rare",
              "where": "Rosymorn Monastery Trail — Sold by Esther, north-east of the Trielta Crags waypoint",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Shadow-Cloaked Ring",
              "rarity": "uncommon",
              "where": "Ruined Battlefield — Carried by Shadow Mastiff Alpha in a cursed camp north of the ruined pottery",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Snowburst Ring",
              "rarity": "uncommon",
              "where": "Last Light Inn — Inside a loose plank in the bedroom north of the bar",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Lightning Jabber",
              "rarity": "uncommon",
              "where": "Reithwin Town — Carried by the Cursed Kuo-Toa Chief in the Cursed Kuo-toa ambush North East of the Grand Mausoleum entrance",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Bow of Awareness",
              "rarity": "uncommon",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "gloves",
              "name": "Winter's Clutches",
              "where": "Underdark — Given by Glut for completing Avenge Glut's Circle",
              "note": "Cold loadout"
            },
            {
              "slot": "ring1",
              "name": "Callous Glow Ring",
              "where": "Gauntlet of Shar — in an opulent chest in the vault room near Balthazar",
              "note": "Cold loadout"
            },
            {
              "slot": "head",
              "name": "Fistbreaker Helm",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Gloves of Crushing",
              "where": "Moonrise Towers — Sold by Roah Moonglow on the main floor",
              "note": ""
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Coldbrim Hat",
              "rarity": "uncommon",
              "where": "Moonrise Towers — In a locked chest in a hidden room behind a bookcase in Balthazar's Chambers",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Bonespike Garb",
              "rarity": "veryrare",
              "where": "Rivington General — Sold by Exxvikyap in Rivington during Act Three",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Craterflesh Gloves",
              "rarity": "rare",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Bonespike Boots",
              "rarity": "veryrare",
              "where": "Western Beach — in wooden chest, in a secluded passageway, at the far end of the western trail leading away from the South Span Checkpoint in Rivington, at -1340",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Amulet of Greater Health",
              "rarity": "veryrare",
              "where": "House of Hope — on the left-most pedestal in the Archive",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Shadow-Cloaked Ring",
              "rarity": "uncommon",
              "where": "Ruined Battlefield — Carried by Shadow Mastiff Alpha in a cursed camp north of the ruined pottery",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Snowburst Ring",
              "rarity": "uncommon",
              "where": "Last Light Inn — Inside a loose plank in the bedroom north of the bar",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Lightning Jabber",
              "rarity": "uncommon",
              "where": "Reithwin Town — Carried by the Cursed Kuo-Toa Chief in the Cursed Kuo-toa ambush North East of the Grand Mausoleum entrance",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Rhapsody",
              "rarity": "veryrare",
              "where": "Cazador's Dungeon — Carried by Cazador",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": ""
            },
            {
              "slot": "ring1",
              "name": "Callous Glow Ring",
              "where": "Gauntlet of Shar — in an opulent chest in the vault room near Balthazar",
              "note": "Cold loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Dwarven Thrower",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "Cold loadout"
            }
          ]
        }
      }
    },
    {
      "presetId": "bardadin",
      "name": "Bardadin",
      "role": "Control · smite damage",
      "credit": "Morgana Evelyn — Honour Mode Party Template (build by Prestigious_Juice341)",
      "summary": "A martial with full-caster spell slots, which means a lot of smites. Arcane Acuity and the Band of the Mystic Scoundrel push the spell save DC so high that control spells always land.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "Charlatan",
        "skills": "Persuasion, Intimidation, Perception",
        "abilities": {
          "str": 8,
          "dex": 15,
          "con": 14,
          "int": 8,
          "wis": 10,
          "cha": 15
        },
        "plus2": "dex",
        "plus1": "cha"
      },
      "levels": [
        {
          "cls": "Paladin",
          "sub": "Vengeance Paladin",
          "picks": []
        },
        {
          "cls": "Paladin",
          "sub": "",
          "picks": [
            "Fighting Style: Defence (or Great Weapon Fighting)"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Cantrip: Friends",
            "Cantrip: Minor Illusion",
            "Spell: Healing Word",
            "Spell: Feather Fall",
            "Spell: Longstrider",
            "Spell: Thunderwave"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Dissonant Whispers"
          ]
        },
        {
          "cls": "Bard",
          "sub": "Swords Bard",
          "picks": [
            "Fighting Style: Duelling (or Two-Weapon Fighting for dual hand crossbows)",
            "Expertise: Persuasion + Deception",
            "Spell: Enhance Ability"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Cantrip: Light",
            "Spell: Hold Person",
            "Spell: Knock (replaces Healing Word)",
            "Feat: Alert"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Hypnotic Pattern"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Fear"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Greater Invisibility"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Freedom of Movement",
            "Feat: Savage Attacker"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Spell: Hold Monster"
          ]
        },
        {
          "cls": "Bard",
          "sub": "",
          "picks": [
            "Cantrip: Mage Hand",
            "Expertise: Intimidation + Sleight of Hand",
            "Spell: Dimension Door",
            "Spell: Banishing Smite",
            "Spell: Counterspell"
          ]
        }
      ],
      "setup": [
        {
          "name": "Drakethroat Glaive",
          "note": "Moonrise Towers (Act 2) — Roah Moonglow. Use on the primary weapon"
        },
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        },
        {
          "name": "Resonance Stone",
          "note": "Mind Flayer Colony (Act 2) — south-west of the Necrotic Laboratory. Disadvantage on mental Saving Throws"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Bloodlust",
          "note": ""
        },
        {
          "name": "Elixir of Cloud Giant Strength",
          "note": ""
        }
      ],
      "variants": "• 6 Swords Bard / 2 Paladin / 4 Sorcerer — Patch 8+: upcast Shadow Blade with the Resonance Stone\n• 10 Swords Bard / 2 Paladin — the original build, shown here\n• Magical Secrets at Bard 10: the guide lists Banishing Smite, Counterspell, Death Ward, Hunger of Hadar and Spirit Guardians; the first two are set here. Filled in by the planner, not in the guide (\"player's choice\"): the Bard spells of levels 8 and 12 (Fear, Dimension Door); and, so that the build can be finished, the skills of a party face: Charlatan as background (Deception, Sleight of Hand), Persuasion and Intimidation from Paladin, Perception from Bard, Expertise in Persuasion and Deception at Bard 3 and in Intimidation and Sleight of Hand at Bard 10. Change them freely.",
      "notes": "LEVELLING\nPlay as a pure Bard for levels 1-7: Slashing Flourish with ranged weapons is the main damage, and the Bard 4 feat is Alert (low initiative) or Sharpshooter (low damage).\nAt level 8 respec into the order shown here, 2 Paladin first and then Bard, for martial weapon and heavy armour proficiency. Take Alert as the feat from then on.\n\nThe gear shown is the guide's Good set; the Evil pieces are listed under the alternatives.",
      "source": "",
      "gear": {
        "act1": {
          "slots": {
            "chest": {
              "name": "Luminous Armour",
              "rarity": "uncommon",
              "where": "Selûnite Outpost — in a locked and trapped opulent chest",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of Archery",
              "rarity": "uncommon",
              "where": "Goblin Camp — Sold by Grat",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Broodmother's Revenge",
              "rarity": "uncommon",
              "where": "Inner Sanctum — Carried by Kagha in the Emerald Grove",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Elemental Infusion",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — Worn by Gish Umr'a'ac in the southern section of the Infirmary",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Knife of the Undermountain King",
              "rarity": "veryrare",
              "where": "Crèche Y'llek — Sold by Jeera",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Titanstring Bow",
              "rarity": "rare",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "cloak",
              "name": "The Deathstalker Mantle",
              "where": "Campsite (Act One) — given to The Dark Urge Origin by Sceleritas Fel",
              "note": "Evil loadout"
            },
            {
              "slot": "boots",
              "name": "Boots of Genial Striding",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Disintegrating Night Walkers",
              "where": "Grymforge — Worn by Nere",
              "note": ""
            },
            {
              "slot": "ring1",
              "name": "Strange Conduit Ring",
              "where": "Crèche Y'llek — Inside an elegant chest in the Inquisitor's Chamber",
              "note": ""
            },
            {
              "slot": "ring1",
              "name": "Ring of Absolute Force",
              "where": "Grymforge — Carried by Elenna Thrinn",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Bow of the Banshee",
              "where": "Grymforge — carried or sold by Corsair Greymon",
              "note": ""
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Helmet of Arcane Acuity",
              "rarity": "uncommon",
              "where": "Mason's Guild — in a locked and trapped Gilded Chest in a secret basement area",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Luminous Armour",
              "rarity": "uncommon",
              "where": "Selûnite Outpost — in a locked and trapped opulent chest",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of Archery",
              "rarity": "uncommon",
              "where": "Goblin Camp — Sold by Grat",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Broodmother's Revenge",
              "rarity": "uncommon",
              "where": "Inner Sanctum — Carried by Kagha in the Emerald Grove",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Elemental Infusion",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — Worn by Gish Umr'a'ac in the southern section of the Infirmary",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Knife of the Undermountain King",
              "rarity": "veryrare",
              "where": "Crèche Y'llek — Sold by Jeera",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Titanstring Bow",
              "rarity": "rare",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "cloak",
              "name": "The Deathstalker Mantle",
              "where": "Campsite (Act One) — given to The Dark Urge Origin by Sceleritas Fel",
              "note": "Evil loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Halberd of Vigilance",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "Evil loadout"
            },
            {
              "slot": "rangedMain",
              "name": "Ne'er Misser",
              "where": "Moonrise Towers — Sold by Roah Moonglow on the main floor",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Hellfire Hand Crossbow",
              "where": "Gauntlet of Shar — Carried by Yurgir",
              "note": ""
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Birthright",
              "rarity": "veryrare",
              "where": "Sorcerous Sundries — Sold by Lorroakan's Projection or Rolan on the ground floor",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of the Weave",
              "rarity": "veryrare",
              "where": "Devil's Fee — Sold by Helsik once her special stock is unlocked",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Armour of Persistence",
              "rarity": "veryrare",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Legacy of the Masters",
              "rarity": "veryrare",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Amulet of the Devout",
              "rarity": "veryrare",
              "where": "Stormshore Tabernacle — in the main Offering Chest in the basement",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Band of the Mystic Scoundrel",
              "rarity": "rare",
              "where": "Jungle — In a backpack",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Risky Ring",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Shadow Blade",
              "rarity": "",
              "where": "Conjured with the Shadow Blade spell",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Viconia's Walking Fortress",
              "rarity": "legendary",
              "where": "Cloister of Sombre Embrace — Carried by Viconia DeVir during the quest Daughter of Darkness",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "chest",
              "name": "Helldusk Armour",
              "where": "House of Hope — Carried by Raphael",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Boots of Persistence",
              "where": "Forge of the Nine — Sold by Dammon in the Lower City",
              "note": ""
            },
            {
              "slot": "cloak",
              "name": "Wavemother's Cloak",
              "where": "Water Queen's House — in an opulent chest behind Allandra Grey desk on the upper floor",
              "note": ""
            },
            {
              "slot": "head",
              "name": "Helmet of Arcane Acuity",
              "where": "Mason's Guild — in a locked and trapped Gilded Chest in a secret basement area",
              "note": "Evil loadout"
            },
            {
              "slot": "cloak",
              "name": "The Deathstalker Mantle",
              "where": "Campsite (Act One) — given to The Dark Urge Origin by Sceleritas Fel",
              "note": "Evil loadout"
            },
            {
              "slot": "chest",
              "name": "Bhaalist Armour",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": "Evil loadout"
            },
            {
              "slot": "gloves",
              "name": "Craterflesh Gloves",
              "where": "Murder Tribunal — Sold by Echo of Abazigal",
              "note": "Evil loadout"
            },
            {
              "slot": "meleeMain",
              "name": "Shar's Spear of Evening",
              "where": "Shadowfell — Rewarded to Shadowheart for killing the Aylin",
              "note": "Evil loadout"
            },
            {
              "slot": "rangedMain",
              "name": "Titanstring Bow",
              "where": "Zhentarim Basement — Sold by Brem after completing the quest Find the Missing Shipment",
              "note": "Evil loadout"
            }
          ]
        }
      }
    },
    {
      "presetId": "tempest-sorcerer",
      "name": "Tempest Sorcerer",
      "role": "Burst lightning damage",
      "credit": "Morgana Evelyn — Honour Mode Party Template",
      "summary": "A classic: make enemies Wet for lightning vulnerability, then cast one big lightning spell. Destructive Wrath max-rolls the damage, and heavy armour comes with the Cleric levels.",
      "creation": {
        "origin": "",
        "race": "",
        "subrace": "",
        "background": "",
        "skills": "",
        "abilities": {
          "str": 8,
          "dex": 15,
          "con": 14,
          "int": 8,
          "wis": 10,
          "cha": 15
        },
        "plus2": "cha",
        "plus1": "dex"
      },
      "levels": [
        {
          "cls": "Cleric",
          "sub": "Tempest Cleric",
          "picks": [
            "Cantrip: Blade Ward",
            "Cantrip: Guidance",
            "Cantrip: Resistance"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "Draconic Sorcerer",
          "picks": [
            "Cantrip: Friends",
            "Cantrip: Minor Illusion",
            "Cantrip: Ray of Frost",
            "Cantrip: Shocking Grasp",
            "Spell: Chromatic Orb",
            "Spell: Shield",
            "Draconic Ancestry: Blue (Lightning)"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Magic Missile",
            "Metamagic: Extended Spell",
            "Metamagic: Twinned Spell"
          ]
        },
        {
          "cls": "Cleric",
          "sub": "",
          "picks": []
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Cloud of Daggers",
            "Metamagic: Quickened Spell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Cantrip: Light",
            "Spell: Blindness",
            "Feat: Dual Wielder"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Lightning Bolt"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Counterspell"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Ice Storm"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Sleet Storm",
            "Feat: Ability Improvement (+2 CHA)"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Spell: Cone of Cold"
          ]
        },
        {
          "cls": "Sorcerer",
          "sub": "",
          "picks": [
            "Cantrip: Mage Hand",
            "Spell: Hold Monster",
            "Metamagic: Heightened Spell"
          ]
        }
      ],
      "setup": [
        {
          "name": "Shadeclinger Armour",
          "note": "Last Light Inn (Act 2) — Talli. Equip and remove to keep Advantage on Saving Throws"
        }
      ],
      "consumables": [
        {
          "name": "Elixir of Bloodlust",
          "note": ""
        },
        {
          "name": "Elixir of Vigilance",
          "note": ""
        }
      ],
      "variants": "• 6 Tempest Cleric / 6 Storm Sorcerer — for Call Lightning\n• 12 Storm Sorcerer — Heart of the Storm focused\n• Storm Sorcerer instead of Draconic for the 10 Sorcerer levels\n• Where the guide offers a choice, the first option is set here: Cloud of Daggers (or Enhance Ability, Misty Step) at level 5; Light (or Mage Hand) and Blindness at level 6; Ability Improvement +2 CHA (or Alert) at level 10; Cone of Cold, then Hold Monster (or Hypnotic Pattern) at levels 11 and 12. The last cantrip (\"any\") is Mage Hand. Witch Bolt comes with the Blue ancestry.",
      "notes": "DAMAGE EXAMPLE\nWitch Bolt critical hit, per the guide: 6d12 max-rolled = 72, doubled by the crit = 144, doubled again by Wet = 288.\n\nThe gear shown is the guide's Heavy Armour set in Act 1 and the Lightning Surface set in Act 2.",
      "source": "https://youtu.be/cJX481cNXKc",
      "gear": {
        "act1": {
          "slots": {
            "head": {
              "name": "The Shadespell Circlet",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Adamantine Splint Armour",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Forged from a Splint Mould and Mithral Ore",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of Belligerent Skies",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — In an elegant chest in the Inquisitor's Chamber, along the southern wall of the room, on the western side",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "The Watersparkers",
              "rarity": "rare",
              "where": "Shattered Sanctum — In a gilded chest in Minthara area of the Shattered Sanctum 339",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Psychic Spark",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Ring of Protection",
              "rarity": "rare",
              "where": "Tiefling Hideout — Rewarded by Mol for completing the quest Steal the Sacred Idol in the Emerald Grove",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "The Sparkswall",
              "rarity": "uncommon",
              "where": "Arcane Tower — In a gilded chest on the upper level of the Arcane Tower's basement",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Melf's First Staff",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "The Spellsparkler",
              "rarity": "rare",
              "where": "Waukeen's Rest — Rewarded by Florrick for rescuing her from the burning inn during the quest Rescue the Grand Duke.",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hand Crossbow +1",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Derryth Bonecloak in the Underdark",
              "note": "",
              "got": false
            },
            "rangedOff": {
              "name": "Hand Crossbow +1",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Derryth Bonecloak in the Underdark",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "chest",
              "name": "The Protecty Sparkswall",
              "where": "Grymforge — in a gilded chest at the end of the trapped bridge",
              "note": "Robe loadout"
            },
            {
              "slot": "gloves",
              "name": "Gloves of Missile Snaring",
              "where": "The Hollow — Sold by Arron next to the Silvanus statue",
              "note": ""
            },
            {
              "slot": "gloves",
              "name": "Daredevil Gloves",
              "where": "Crèche Y'llek — Sold by Jeera",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Safeguard Shield",
              "where": "The Hollow — Sold by Dammon in the Emerald Grove",
              "note": ""
            },
            {
              "slot": "amulet",
              "name": "Pearl of Power Amulet",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": ""
            },
            {
              "slot": "amulet",
              "name": "The Blast Pendant",
              "where": "Underdark — Worn by Dhourn, a petrified drow west of the Selûnite Outpost",
              "note": ""
            },
            {
              "slot": "rangedMain",
              "name": "Bow of Awareness",
              "where": "Shattered Sanctum — Sold by Roah Moonglow, to the left beyond the sanctum entrance",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Boots of Stormy Clamour",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "Magic Missile loadout (optional)"
            },
            {
              "slot": "meleeOff",
              "name": "Phalar Aluve",
              "where": "Underdark — Embedded inside a rock",
              "note": "Magic Missile loadout (optional)"
            }
          ]
        },
        "act2": {
          "slots": {
            "head": {
              "name": "Fistbreaker Helm",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of Protection",
              "rarity": "uncommon",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Adamantine Splint Armour",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Forged from a Splint Mould and Mithral Ore",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Gloves of Belligerent Skies",
              "rarity": "uncommon",
              "where": "Crèche Y'llek — In an elegant chest in the Inquisitor's Chamber, along the southern wall of the room, on the western side",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "The Watersparkers",
              "rarity": "rare",
              "where": "Shattered Sanctum — In a gilded chest in Minthara area of the Shattered Sanctum 339",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Spineshudder Amulet",
              "rarity": "uncommon",
              "where": "Moonrise Towers — in the Mimic in Isobel Thorm bedroom on the upper floor",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Callous Glow Ring",
              "rarity": "uncommon",
              "where": "Gauntlet of Shar — in an opulent chest in the vault room near Balthazar",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "The Sparkswall",
              "rarity": "uncommon",
              "where": "Arcane Tower — In a gilded chest on the upper level of the Arcane Tower's basement",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Melf's First Staff",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Blurg",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "The Spellsparkler",
              "rarity": "rare",
              "where": "Waukeen's Rest — Rewarded by Florrick for rescuing her from the burning inn during the quest Rescue the Grand Duke.",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hand Crossbow +1",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Derryth Bonecloak in the Underdark",
              "note": "",
              "got": false
            },
            "rangedOff": {
              "name": "Ne'er Misser",
              "rarity": "rare",
              "where": "Moonrise Towers — Sold by Roah Moonglow on the main floor",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "chest",
              "name": "Robe of Exquisite Focus",
              "where": "Moonrise Towers — Sold by Araj Oblodra on the main floor",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Sentinel Shield",
              "where": "Moonrise Towers — Sold by Lann Tarv on the main floor",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Shield of Devotion",
              "where": "Last Light Inn — Sold by Talli near the Last Light Inn waypoint",
              "note": ""
            },
            {
              "slot": "meleeOff",
              "name": "Ketheric's Shield",
              "where": "Mind Flayer Colony — Carried by Ketheric Thorm when fought atop Moonrise Towers and in the Mind Flayer Colony (see notes)",
              "note": ""
            },
            {
              "slot": "amulet",
              "name": "Spellcrux Amulet",
              "where": "Moonrise Towers Prison — Worn by the The Warden",
              "note": ""
            },
            {
              "slot": "boots",
              "name": "Boots of Stormy Clamour",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "Reverberation loadout"
            },
            {
              "slot": "ring2",
              "name": "Coruscation Ring",
              "where": "Last Light Inn - Cellar — in a trapped heavy chest in the cellar of the Last Light Inn",
              "note": "Reverberation loadout"
            },
            {
              "slot": "ring1",
              "name": "Coruscation Ring",
              "where": "Last Light Inn - Cellar — in a trapped heavy chest in the cellar of the Last Light Inn",
              "note": "Magic Missile loadout (optional)"
            }
          ]
        },
        "act3": {
          "slots": {
            "head": {
              "name": "Birthright",
              "rarity": "veryrare",
              "where": "Sorcerous Sundries — Sold by Lorroakan's Projection or Rolan on the ground floor",
              "note": "",
              "got": false
            },
            "cloak": {
              "name": "Cloak of the Weave",
              "rarity": "veryrare",
              "where": "Devil's Fee — Sold by Helsik once her special stock is unlocked",
              "note": "",
              "got": false
            },
            "chest": {
              "name": "Adamantine Splint Armour",
              "rarity": "veryrare",
              "where": "Adamantine Forge — Forged from a Splint Mould and Mithral Ore",
              "note": "",
              "got": false
            },
            "gloves": {
              "name": "Helldusk Gloves",
              "rarity": "veryrare",
              "where": "House of Hope — Worn by Haarlep in the Boudoir",
              "note": "",
              "got": false
            },
            "boots": {
              "name": "Boots of Stormy Clamour",
              "rarity": "uncommon",
              "where": "Ebonlake Grotto — Sold by Omeluum after completing the quest Help Omeluum Investigate the Parasite",
              "note": "",
              "got": false
            },
            "amulet": {
              "name": "Amulet of the Devout",
              "rarity": "veryrare",
              "where": "Stormshore Tabernacle — in the main Offering Chest in the basement",
              "note": "",
              "got": false
            },
            "ring1": {
              "name": "Callous Glow Ring",
              "rarity": "uncommon",
              "where": "Gauntlet of Shar — in an opulent chest in the vault room near Balthazar",
              "note": "",
              "got": false
            },
            "ring2": {
              "name": "Ring of Feywild Sparks",
              "rarity": "veryrare",
              "where": "The Blushing Mermaid — Carried by Auntie Ethel",
              "note": "",
              "got": false
            },
            "meleeMain": {
              "name": "Markoheshkir",
              "rarity": "legendary",
              "where": "Ramazith's Tower — in a Globe of Invulnerability",
              "note": "",
              "got": false
            },
            "meleeOff": {
              "name": "Rhapsody",
              "rarity": "veryrare",
              "where": "Cazador's Dungeon — Carried by Cazador",
              "note": "",
              "got": false
            },
            "rangedMain": {
              "name": "Hellrider Longbow",
              "rarity": "uncommon",
              "where": "Rivington — Sold by Ferg Drogher near the Requisitioned Barn",
              "note": "",
              "got": false
            }
          },
          "alts": [
            {
              "slot": "chest",
              "name": "Armour of Persistence",
              "where": "Forge of the Nine — Sold by Dammon in Act Three",
              "note": ""
            },
            {
              "slot": "chest",
              "name": "Armour of Landfall",
              "where": "Sorcerous Sundries — Sold by Lorroakan's Projection or Rolan on the ground floor",
              "note": ""
            }
          ]
        }
      },
      "prepared": {
        "Cleric": [
          "Create or Destroy Water",
          "Sanctuary"
        ]
      }
    }
  ]);
})();
