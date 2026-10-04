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
        { cls: 'Ranger', sub: 'Gloom Stalker', picks: ['Dread Ambusher', 'Dread Ambusher: Hide'] },
        { cls: 'Ranger', sub: '', picks: ['Feat: Sharpshooter'] },
        { cls: 'Ranger', sub: '', picks: ['Extra Attack', 'Spell: Misty Step', 'Spell: Pass Without Trace'] },
        { cls: 'Rogue', sub: '', picks: ['Sneak Attack 1d6', 'Expertise: Athletics + Stealth'] },
        { cls: 'Rogue', sub: '', picks: ['Cunning Action: Dash', 'Cunning Action: Disengage', 'Cunning Action: Hide'] },
        { cls: 'Rogue', sub: 'Assassin', picks: ['Sneak Attack 2d6', "Assassin's Alacrity", 'Assassinate: Ambush', 'Assassinate: Initiative'] },
        { cls: 'Rogue', sub: '', picks: ['Feat: Ability Improvement +2 DEX'] },
        { cls: 'Fighter', sub: '', picks: ['Fighting Style: Defence'] },
        { cls: 'Fighter', sub: '', picks: ['Action Surge'] },
        { cls: 'Rogue', sub: '', picks: ['Sneak Attack 3d6', 'Uncanny Dodge'] },
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
  ];
})();
