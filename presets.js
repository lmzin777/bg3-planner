// Ready-made builds. Each entry uses the same shape as a build saved in the planner;
// omitted fields are filled in blank by the app (see normalizeBuild in app.js).
// To add another ready-made build, copy the object below and change its values.
(function () {
  'use strict';

  // item(name, rarity, "Location — how to get it", note)
  const item = (name, rarity, where, note) => ({ name, rarity: rarity || '', where: where || '', note: note || '', got: false });
  const alt = (slot, name, where, note) => ({ slot, name, where: where || '', note: note || '' });

  // Items reused across acts
  const DIADEM = () => item('Diadem of Arcane Synergy', 'rare', "Crèche Y'llek — carried by Ardent Jhe'rezath (Inquisitor's Chamber)");
  const MANTLE = () => item('The Deathstalker Mantle', 'rare', 'Campsite (Act 1) — given by Sceleritas Fel', 'Dark Urge only');
  const SKIES = () => item('Gloves of Belligerent Skies', 'uncommon', "Crèche Y'llek — elegant chest in the Inquisitor's Chamber");
  const CLAMOUR = () => item('Boots of Stormy Clamour', 'uncommon', 'Ebonlake Grotto (Underdark) — sold by Omeluum after Help Omeluum Investigate the Parasite');
  const BROOD = (note) => item("Broodmother's Revenge", 'uncommon', 'Emerald Grove — carried by Kagha', note);
  const KNIFE = () => item('Knife of the Undermountain King', 'veryrare', "Crèche Y'llek — sold by A'jak'nir Jeera");
  const CLUB = () => item('Club of Hill Giant Strength', 'uncommon', 'Arcane Tower (Underdark) — break the Stool of Hill Giant Strength', 'Strength 19 for Titanstring damage');
  const TITAN = () => item('Titanstring Bow', 'rare', 'Zhentarim Basement — sold by Brem (special stock after the Zhentarim quest)', 'In Act 2 also from Lann Tarv at Moonrise, if Brem was not unlocked');
  const YUANTI = () => item('Yuan-Ti Scale Mail', 'rare', 'Last Light Inn — sold by Quartermaster Talli');
  const RISKY = () => item('Risky Ring', 'rare', 'Moonrise Towers — sold by Araj Oblodra', 'Advantage on attacks, Disadvantage on Saving Throws');
  const EVERSIGHT = () => item('Eversight Ring', 'uncommon', 'House of Healing Morgue — locked opulent chest', 'Solo. In a party the guide leaves this ring free (e.g. Shadow-Cloaked Ring)');

  window.BG3_PRESETS = [
    {
      presetId: 'stealth-archer',
      name: "Morgana Evelyn's Stealth Archer",
      role: 'Ranged damage · stealth and surprise round',
      source: 'https://youtu.be/JLkItLjbj8s',
      credit: 'Morgana Evelyn — Honour Mode Party Template',
      summary:
        'A stealth archer that ends fights before turn-based combat even starts. More a set of techniques than a fixed build: ' +
        'ranged attacks, stealth, darkness, surprise, critical hits and high initiative. ' +
        'This is the version from the video (5 Gloom Stalker / 5 Assassin / 2 Fighter), the most approachable one.',
      creation: {
        origin: 'The Dark Urge',
        race: '',
        subrace: '',
        background: 'Haunted One',
        skills: 'Sleight of Hand, Stealth',
        abilities: { str: 8, dex: 15, con: 14, int: 8, wis: 15, cha: 10 },
        plus2: 'dex',
        plus1: 'wis',
      },
      levels: [
        { cls: 'Ranger', sub: '', picks: ['Favoured Enemy: Ranger Knight (or Keeper of the Veil)', 'Natural Explorer: Urban Tracker (or Wasteland Wanderer: Fire)'] },
        { cls: 'Ranger', sub: '', picks: ['Fighting Style: Archery', 'Spell: Enhance Leap', 'Spell: Longstrider'] },
        { cls: 'Ranger', sub: 'Gloom Stalker', picks: ["Spell: Hunter's Mark"] },
        { cls: 'Ranger', sub: '', picks: ['Feat: Sharpshooter'] },
        { cls: 'Ranger', sub: '', picks: ['Spell: Pass Without Trace'] },
        { cls: 'Rogue', sub: '', picks: ['Expertise: Athletics + Stealth'] },
        { cls: 'Rogue', sub: '', picks: [] },
        { cls: 'Rogue', sub: 'Assassin', picks: [] },
        { cls: 'Rogue', sub: '', picks: ['Feat: Ability Improvement +2 DEX'] },
        { cls: 'Fighter', sub: '', picks: ['Fighting Style: Defence'] },
        { cls: 'Fighter', sub: '', picks: [] },
        { cls: 'Rogue', sub: '', picks: [] },
      ],
      gear: {
        act1: {
          slots: {
            head: DIADEM(),
            cloak: MANTLE(),
            chest: item('The Graceful Cloth', 'rare', 'Rosymorn Monastery Trail — sold by Lady Esther', "The guide's alternative until Yuan-Ti Scale Mail in Act 2"),
            gloves: SKIES(),
            boots: CLAMOUR(),
            amulet: BROOD(),
            ring1: item('Strange Conduit Ring', 'uncommon', "Crèche Y'llek — elegant chest in the Inquisitor's Chamber", "The guide's alternative until the Risky Ring in Act 2"),
            meleeMain: KNIFE(),
            meleeOff: CLUB(),
            rangedMain: TITAN(),
          },
          alts: [
            alt('amulet', 'Silver Pendant', 'Ravaged Beach — skeleton at the Harper outpost south-west of the Druid Grove'),
            alt('gloves', 'Gloves of Archery', 'Goblin Camp — sold by Grat'),
            alt('gloves', "Winter's Clutches", 'Underdark — reward from Glut (or Lady Esther at Rosymorn)', 'Ice Archer variant'),
            alt('meleeOff', 'Adamantine Shield', 'Adamantine Forge — Shield Mould + Mithral Ore'),
          ],
        },
        act2: {
          slots: {
            head: DIADEM(),
            cloak: MANTLE(),
            chest: YUANTI(),
            gloves: SKIES(),
            boots: CLAMOUR(),
            amulet: BROOD(),
            ring1: RISKY(),
            ring2: EVERSIGHT(),
            meleeMain: KNIFE(),
            meleeOff: CLUB(),
            rangedMain: TITAN(),
          },
          alts: [
            alt('head', 'Coldbrim Hat', "Moonrise Towers — chest in the hidden room of Balthazar's chambers", 'Ice Archer variant'),
            alt('head', 'Helmet of Arcane Acuity', "Mason's Guild — gilded chest in the secret basement", 'For bosses: Hold + Arrow of Many Targets combo'),
            alt('cloak', 'Cloak of Protection', 'Last Light Inn — sold by Quartermaster Talli'),
            alt('ring2', 'Shadow-Cloaked Ring', 'Ruined Battlefield — carried by the Shadow Mastiff Alpha', "The guide's pick when playing in a party"),
            alt('ring2', 'Snowburst Ring', 'Last Light Inn — loose plank in the bedroom north of the bar', 'Ice Archer variant'),
            alt('ring1', 'Strange Conduit Ring', "Crèche Y'llek — elegant chest in the Inquisitor's Chamber"),
          ],
        },
        act3: {
          slots: {
            head: DIADEM(),
            cloak: MANTLE(),
            chest: item('Bhaalist Armour', 'veryrare', 'Murder Tribunal — sold by Echo of Abazigal'),
            gloves: item('Craterflesh Gloves', 'rare', 'Murder Tribunal — sold by Echo of Abazigal'),
            boots: CLAMOUR(),
            amulet: item('Amulet of Greater Health', 'veryrare', 'House of Hope — left-most pedestal in the Archive', "Solo. In a party the guide keeps Broodmother's Revenge"),
            ring1: RISKY(),
            ring2: EVERSIGHT(),
            meleeMain: item('Dolor Amarus', 'rare', "Highberry's Home — carried by Dolor"),
            meleeOff: item('Dolor Amarus', 'rare', 'Murder Tribunal — sold by Echo of Abazigal', 'Second copy'),
            rangedMain: TITAN(),
          },
          alts: [
            alt('amulet', "Broodmother's Revenge", 'Emerald Grove — carried by Kagha', "Damage; the guide's pick for a party"),
            alt('cloak', "Wavemother's Cloak", "Water Queen's House — opulent chest on the upper floor"),
            alt('rangedMain', 'Vicious Shortbow', 'Murder Tribunal — sold by Echo of Abazigal', "Compared in the guide's damage maths"),
            alt('rangedMain', 'The Dead Shot', 'Stormshore Armoury — sold by Fytz', "Compared in the guide's damage maths"),
            alt('rangedMain', 'Gontr Mael', 'Steel Watch Foundry — Steel Watcher Titan', "Compared in the guide's damage maths"),
          ],
        },
      },
      setup: [
        { name: 'Drakethroat Glaive', note: 'Moonrise Towers (Act 2) — Roah Moonglow. Thunder on the Titanstring; Ice for Snowburst Ring or Acid for Ichorous Gloves' },
        { name: 'Shadeclinger Armour', note: 'Last Light Inn (Act 2) — Talli. Equip and remove to offset the Disadvantage from the Risky Ring' },
      ],
      consumables: [
        { name: 'Elixir of Bloodlust', note: '' },
        { name: 'Elixir of Hill Giant Strength', note: '' },
        { name: 'Potion of Speed', note: '' },
        { name: 'Potion of Invisibility', note: '' },
      ],
      variants:
        "• Filled in by the planner, not in the guide: the Ranger level 3 spell (Hunter's Mark). Misty Step is not chosen: it comes with the Gloom Stalker at Ranger 5.\n" +
        '• 5 Gloom Stalker / 4 Assassin / 2 Fighter / 1 War Cleric — the classic version\n' +
        '• 5 Gloom Stalker / 7 Assassin — more Sneak Attack dice\n' +
        '• Swap Gloom Stalker for Hunter (Horde Breaker) — for advanced players\n' +
        "• Ice Archer — same build with Coldbrim Hat, Winter's Clutches, Snowburst Ring and Drakethroat Glaive (ice). 8 STR / 17 DEX / 14 CON / 8 INT / 16 WIS / 10 CHA\n" +
        '• Eldritch Knight Archer — 12 EK Fighter. 8 STR / 16 DEX / 14 CON / 16 INT / 10 WIS / 10 CHA. Feats: Sharpshooter, Alert, ASI DEX x2. Band of the Mystic Scoundrel\n' +
        '• OTK Assassin — 6 Swords Bard / 3 Assassin / 3 Gloom Stalker. 8 STR / 17 DEX / 14 CON / 8 INT / 10 WIS / 16 CHA. Feat: Sharpshooter',
      notes:
        'DARKNESS\n' +
        'With the Eversight Ring, create Darkness and use your bonus action to Hide inside it: enemies without sight in magical darkness cannot find you. ' +
        'Darkness arrows last 3 turns; scrolls last 10 but need concentration.\n\n' +
        'STEALTH IN HONOUR MODE (Patch 8)\n' +
        'The DC to keep Greater Invisibility grows quadratically: 15, 16, 19, 24, 31, 40, 51. In practice, do not count on more than 4 checks in a row.\n\n' +
        'REMINDER\n' +
        'Enhance Leap and Longstrider are rituals: outside combat they cost no spell slot.',
    },
    // Minthara as an Oathbreaker Paladin with two levels of Hexblade, after Hack The Minotaur's guide (read on 2026-10-10).
    // Item rarities and locations are the ones of bg3.wiki (items.js), not the guide's wording.
    {
      presetId: 'minthara-oathbreaker',
      name: 'Minthara · Oathbreaker / Hexblade',
      role: 'Melee burst damage · frontline, auras and fear',
      source: 'https://hacktheminotaur.com/baldurs-gate-3/ultimate-bg3-minthara-build/',
      credit: 'Hack The Minotaur — Ultimate BG3 Minthara Build',
      summary:
        'Minthara as an Oathbreaker Paladin who fights with Charisma alone. Two levels of Hexblade Warlock, taken early, make Charisma the ability of her weapon, ' +
        'so one score drives her attacks, her Divine Smites, both auras and her dialogue, and Strength can stay at 8. ' +
        'A critical hit doubles the dice of Divine Smite: the build looks for sure critical hits and spends its best spell slot on them.',
      elixir: 'Elixir of Bloodlust',
      creation: {
        origin: 'Custom',
        race: 'Drow',
        subrace: 'Lolth-Sworn Drow',
        background: 'Noble',
        skills: 'Intimidation, Athletics',
        abilities: { str: 8, dex: 14, con: 15, int: 10, wis: 10, cha: 14 },
        plus2: 'cha',
        plus1: 'con',
      },
      levels: [
        { cls: 'Paladin', sub: 'Oathbreaker', picks: [] },
        { cls: 'Paladin', sub: '', picks: ['Fighting Style: Great Weapon Fighting'] },
        { cls: 'Warlock', sub: 'The Hexblade', picks: ['Cantrip: Eldritch Blast', 'Cantrip: Booming Blade', 'Spell: Shield', 'Spell: Hex'] },
        { cls: 'Warlock', sub: '', picks: ['Eldritch Invocation: Agonising Blast', "Eldritch Invocation: Devil's Sight", 'Spell: Hellish Rebuke'] },
        { cls: 'Paladin', sub: '', picks: [] },
        { cls: 'Paladin', sub: '', picks: ['Feat: Great Weapon Master'] },
        { cls: 'Paladin', sub: '', picks: [] },
        { cls: 'Paladin', sub: '', picks: [] },
        { cls: 'Paladin', sub: '', picks: [] },
        { cls: 'Paladin', sub: '', picks: ['Feat: Ability Improvement (+2 CHA)'] },
        { cls: 'Paladin', sub: '', picks: [] },
        { cls: 'Paladin', sub: '', picks: [] },
      ],
      prepared: {
        Paladin: ['Command', 'Thunderous Smite', 'Wrathful Smite', 'Divine Favour', 'Cure Wounds', 'Searing Smite', 'Shield of Faith', 'Aid', 'Magic Weapon', 'Branding Smite',
          'Lesser Restoration', 'Blinding Smite', 'Elemental Weapon', 'Warden of Vitality'],
      },
      gear: {
        act1: {
          slots: {
            head: item('Helmet of Smiting', 'uncommon', 'Selûnite Outpost — inside a locked gilded chest south-west of the waypoint', 'Minthara only joins in Act 2: collect it for her'),
            chest: item('Adamantine Scale Mail', 'veryrare', 'Adamantine Forge — forged from a Scale Mail Mould and Mithral Ore', 'Collect it for Act 2'),
            gloves: item('Gloves of the Growling Underdog', 'uncommon', "Shattered Sanctum — in Dror Ragzlin's treasure crates behind the locked iron gate", 'Collect it for Act 2'),
            boots: item('Disintegrating Night Walkers', 'common', 'Grymforge — worn by Nere', 'Collect it for Act 2'),
          },
          alts: [],
        },
        act2: {
          slots: {
            head: item('Helmet of Smiting', 'uncommon', 'Selûnite Outpost — inside a locked gilded chest south-west of the waypoint'),
            cloak: item('Cloak of Protection', 'uncommon', 'Last Light Inn — sold by Talli near the Last Light Inn waypoint'),
            chest: item('Adamantine Scale Mail', 'veryrare', 'Adamantine Forge — forged from a Scale Mail Mould and Mithral Ore'),
            gloves: item('Gloves of the Growling Underdog', 'uncommon', "Shattered Sanctum — in Dror Ragzlin's treasure crates behind the locked iron gate"),
            boots: item('Disintegrating Night Walkers', 'common', 'Grymforge — worn by Nere'),
            amulet: item("Surgeon's Subjugation Amulet", 'rare', 'House of Healing — worn by Malus Thorm'),
            ring1: item('Risky Ring', 'rare', 'Moonrise Towers — sold by Araj Oblodra on the main floor', 'Advantage on attack rolls, which makes up for the −5 of Great Weapon Master; Disadvantage on Saving Throws'),
            ring2: item("Killer's Sweetheart", 'veryrare', 'Gauntlet of Shar — on the ground where the shadow copy is defeated in the Self-Same Trial', 'A sure critical hit after a kill: keep it for a Divine Smite'),
            meleeMain: item('Halberd of Vigilance', 'veryrare', 'Moonrise Towers — sold by Lann Tarv on the main floor'),
            rangedMain: item('Darkfire Shortbow', 'rare', 'Last Light Inn — sold by Dammon in Act Two'),
          },
          alts: [],
        },
        act3: {
          slots: {
            head: item('Birthright', 'veryrare', "Sorcerous Sundries — sold by Lorroakan's Projection or Rolan on the ground floor", '+2 Charisma, up to 22'),
            cloak: item('Cloak of Protection', 'uncommon', 'Last Light Inn — sold by Talli near the Last Light Inn waypoint'),
            chest: item('Bhaalist Armour', 'veryrare', 'Murder Tribunal — sold by Echo of Abazigal', 'Enemies near her are vulnerable to Piercing damage, which is what Nyrulna deals'),
            gloves: item('Legacy of the Masters', 'veryrare', 'Forge of the Nine — sold by Dammon in Act Three'),
            boots: item('Helldusk Boots', 'veryrare', "Wyrm's Rock Fortress — in a locked gilded chest on the top floor"),
            amulet: item('Amulet of Greater Health', 'veryrare', 'House of Hope — on the left-most pedestal in the Archive'),
            ring1: item("Killer's Sweetheart", 'veryrare', 'Gauntlet of Shar — on the ground where the shadow copy is defeated in the Self-Same Trial'),
            ring2: item('Risky Ring', 'rare', 'Moonrise Towers — sold by Araj Oblodra on the main floor'),
            meleeMain: item('Nyrulna', 'legendary', 'Circus of the Last Days — the jackpot of Akabi sends you to the Jungle, where it lies in a locked painted chest near the portal out'),
            rangedMain: item('Hellrider Longbow', 'uncommon', 'Rivington — sold by Ferg Drogher near the Requisitioned Barn', '+3 to Initiative'),
          },
          alts: [
            alt('chest', 'Helldusk Armour', 'House of Hope — carried by Raphael', "The guide's other choice for the chest"),
          ],
        },
      },
      setup: [
        { name: 'Resonance Stone', note: 'Mind Flayer Colony (Act 2) — south-west of the Necrotic Laboratory. Everyone within 9 m, the party too, has Disadvantage on mental Saving Throws and takes double Psychic damage' },
      ],
      consumables: [
        { name: 'Elixir of Bloodlust', note: 'One more action after a kill, once a turn' },
        { name: 'Potion of Speed', note: 'One more action: more attacks and Divine Smites' },
        { name: 'Diluted Oil of Sharpness', note: 'On the weapon before a big turn. The guide says "Oil of Sharpness"; the one found in the game is the Diluted one' },
        { name: 'Potion of Healing', note: 'A few; Lay on Hands covers most emergencies' },
      ],
      variants:
        '• Filled in by the planner, not in the guide: the point buy behind the scores (the guide gives 8 / 14 / 16 / 10 / 10 / 16; here 15 Constitution +1 and 14 Charisma +2), ' +
        'and the list of prepared Paladin spells put together: the twelve the guide names along the levels and the two its section on spells adds (Searing Smite, Shield of Faith), ' +
        'fourteen in all, which is what she can prepare at level 12.\n' +
        '• Minthara is a companion, not an origin character: the build is entered as a custom Lolth-Sworn Drow with the Noble background, which is what she is. Respec her at Withers when she joins, in Act 2.\n' +
        '• The planner has one subclass for each class, so she is an Oathbreaker from level 1. In the game she starts as Oath of Vengeance and breaks the oath, which the guide does at Paladin 3 (character level 5).\n' +
        '• 11 Paladin / 1 Hexblade: keeps Hex Warrior and Hexblade\'s Curse, and reaches Improved Divine Smite.\n' +
        '• 12 Oathbreaker Paladin: one more feat and Animate Dead, with no Charisma weapon.\n' +
        '• Oath of Vengeance instead of breaking the oath: Vow of Enmity for Advantage, without Aura of Hate.\n' +
        '• A greatsword for Great Weapon Master, or a one-handed weapon and a shield for defence.',
      notes:
        'ORDER OF THE LEVELS\n' +
        'Paladin 2, then the two levels of Hexblade (character levels 3 and 4), then Paladin to 10. With Strength at 8 she only fights well once Hex Warrior is there. ' +
        'The price: Extra Attack comes at character level 7 and Aura of Hate at 9.\n\n' +
        'A TURN\n' +
        'Bonus action: Hexblade\'s Curse on the main target. Action: two attacks, with Divine Smite on a hit, best on a critical hit. ' +
        'Channel Oath has one charge between rests: Dreadful Aspect on the first turn to frighten a group, Control Undead against undead, Spiteful Suffering on a single strong target.\n\n' +
        'BEFORE A FIGHT\n' +
        'Bless or Shield of Faith, and stand so that Aura of Protection and Aura of Hate cover the party.\n\n' +
        'ILLITHID POWERS (optional)\n' +
        'Luck of the Far Realms for a sure critical hit, Fly, Favourable Beginnings, Cull the Weak.',
    },
  ];
})();
