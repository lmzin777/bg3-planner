// What each character-creation choice grants, shown next to the selectors in the planner.
// Taken from the Races, Backgrounds and class pages of bg3.wiki. Game terms are in English.
//   speed     movement speed
//   prof      weapon and armour proficiencies
//   skills    skill proficiencies granted outright (these lock the matching skill toggle)
//   features  [name, what it does] pairs
(function () {
  'use strict';

  const DARKVISION = ['Darkvision', 'See in the dark up to 12 m'];
  const SUPERIOR_DARKVISION = ['Superior Darkvision', 'See in the dark up to 24 m'];
  const FEY_ANCESTRY = ['Fey Ancestry', 'Advantage against being Charmed; immune to magical Sleep'];
  const FLEET = ['Fleet of Foot', 'Base movement speed increased by 1.5 m'];
  const DROW_MAGIC = ['Drow Magic', 'Dancing Lights at level 1, Faerie Fire at level 3, Darkness at level 5'];
  const WIZARD_CANTRIP = ['Cantrip', 'One cantrip of your choice from the Wizard spell list'];
  const dragon = (damage, breath, shape) => ({ features: [['Draconic Ancestry (' + damage + ')', 'Resistance to ' + damage + ' damage'], [breath, 'Breath attack: a ' + shape + ' of ' + damage + ' damage']] });

  window.BG3_DATA = {
    races: {
      Human: { speed: '9 m / 30 ft', prof: ['Spears', 'Pikes', 'Halberds', 'Glaives', 'Light Armour', 'Shields'], skillNote: 'One skill of your choice',
        features: [['Human Versatility', 'Carrying capacity increased by 25%']] },
      Elf: { speed: '9 m / 30 ft', prof: ['Shortswords', 'Longswords', 'Shortbows', 'Longbows'], skills: ['Perception'], features: [FEY_ANCESTRY, DARKVISION] },
      Drow: { speed: '9 m / 30 ft', prof: ['Rapiers', 'Shortswords', 'Hand Crossbows'], skills: ['Perception'], features: [FEY_ANCESTRY, SUPERIOR_DARKVISION, DROW_MAGIC] },
      'Half-Elf': { speed: '9 m / 30 ft', prof: ['Spears', 'Pikes', 'Halberds', 'Glaives', 'Light Armour', 'Shields'], features: [FEY_ANCESTRY, DARKVISION] },
      'Half-Orc': { speed: '9 m / 30 ft', skills: ['Intimidation'], features: [DARKVISION, ['Savage Attacks', 'One extra damage die on a critical hit with a melee weapon'],
        ['Relentless Endurance', 'Drop to 1 hit point instead of being downed, once per Long Rest']] },
      Halfling: { speed: '7.5 m / 25 ft', features: [['Halfling Luck', 'Reroll a 1 on an Attack Roll, Ability Check or Saving Throw'], ['Brave', 'Advantage against being Frightened']] },
      Dwarf: { speed: '7.5 m / 25 ft', prof: ['Battleaxes', 'Handaxes', 'Light Hammers', 'Warhammers'],
        features: [['Dwarven Resilience', 'Advantage against being Poisoned; resistance to Poison damage'], DARKVISION] },
      Gnome: { speed: '7.5 m / 25 ft', features: [['Gnome Cunning', 'Advantage on Intelligence, Wisdom and Charisma Saving Throws'], DARKVISION] },
      Tiefling: { speed: '9 m / 30 ft', features: [['Hellish Resistance', 'Resistance to Fire damage'], DARKVISION] },
      Githyanki: { speed: '9 m / 30 ft', prof: ['Shortswords', 'Longswords', 'Greatswords', 'Light Armour', 'Medium Armour'],
        features: [['Astral Knowledge', 'Each Long Rest, gain proficiency in every skill of one ability of your choice'],
          ['Githyanki Psionics', 'Mage Hand at level 1, Enhance Leap at level 3, Misty Step at level 5']] },
      Dragonborn: { speed: '9 m / 30 ft', features: [['Draconic Ancestry', 'A damage resistance and a breath attack, set by the subrace']] },
    },
    subraces: {
      'High Elf': { features: [WIZARD_CANTRIP] },
      'Wood Elf': { speed: '10.5 m / 35 ft', skills: ['Stealth'], features: [FLEET] },
      'Lolth-Sworn Drow': { note: 'Drow subraces differ only in dialogue options and in the deities available to clerics.' },
      'Seldarine Drow': { note: 'Drow subraces differ only in dialogue options and in the deities available to clerics.' },
      'High Half-Elf': { features: [WIZARD_CANTRIP] },
      'Wood Half-Elf': { speed: '10.5 m / 35 ft', skills: ['Stealth'], features: [FLEET] },
      'Drow Half-Elf': { features: [DROW_MAGIC] },
      'Lightfoot Halfling': { features: [['Naturally Stealthy', 'Advantage on Stealth checks']] },
      'Strongheart Halfling': { features: [['Strongheart Resilience', 'Advantage against being Poisoned; resistance to Poison damage']] },
      'Gold Dwarf': { features: [['Dwarven Toughness', 'Maximum hit points increased by 1 per level']] },
      'Shield Dwarf': { prof: ['Light Armour', 'Medium Armour'], features: [['Dwarven Armour Training', 'Proficiency with light and medium armour']] },
      Duergar: { features: [['Duergar Resilience', 'Advantage on Saving Throws against illusions and against being Charmed or Paralysed'], SUPERIOR_DARKVISION,
        ['Duergar Magic', 'Enlarge at level 3, Invisibility at level 5']] },
      'Forest Gnome': { features: [['Speak with Animals', 'Can be cast at will']] },
      'Deep Gnome': { features: [SUPERIOR_DARKVISION, ['Stone Camouflage', 'Advantage on Stealth checks']] },
      'Rock Gnome': { features: [["Artificer's Lore", 'Expertise in History']] },
      'Asmodeus Tiefling': { features: [['Infernal Legacy', 'Produce Flame at level 1, Hellish Rebuke at level 3, Darkness at level 5']] },
      'Mephistopheles Tiefling': { features: [['Legacy of Cania', 'Mage Hand at level 1, Burning Hands at level 3, Flame Blade at level 5']] },
      'Zariel Tiefling': { features: [['Legacy of Avernus', 'Thaumaturgy at level 1, Searing Smite at level 3, Branding Smite at level 5']] },
      'Black Dragonborn': dragon('Acid', 'Acid Breath', 'line'),
      'Blue Dragonborn': dragon('Lightning', 'Lightning Breath', 'line'),
      'Brass Dragonborn': dragon('Fire', 'Fire Breath', 'line'),
      'Bronze Dragonborn': dragon('Lightning', 'Lightning Breath', 'line'),
      'Copper Dragonborn': dragon('Acid', 'Acid Breath', 'line'),
      'Gold Dragonborn': dragon('Fire', 'Fire Breath', 'cone'),
      'Green Dragonborn': dragon('Poison', 'Poison Breath', 'cone'),
      'Red Dragonborn': dragon('Fire', 'Fire Breath', 'cone'),
      'Silver Dragonborn': dragon('Cold', 'Frost Breath', 'cone'),
      'White Dragonborn': dragon('Cold', 'Frost Breath', 'cone'),
    },
    // Background skills live in app.js (BACKGROUNDS); this is the one-line flavour shown with them.
    backgrounds: {
      Acolyte: 'A life spent in service to a temple.',
      Charlatan: 'A practised liar who lives by cons and false identities.',
      Criminal: 'A history of breaking the law, with the contacts to match.',
      Entertainer: 'A performer who lives for the crowd.',
      'Folk Hero': 'A champion of the common people.',
      'Guild Artisan': 'A skilled trader with a craft and guild connections.',
      'Haunted One': 'Marked by a darkness that will not let go. Only available to The Dark Urge.',
      Noble: 'Raised among wealth, power and privilege.',
      Outlander: 'Grown up in the wilds, far from civilisation.',
      Sage: 'Years of study in pursuit of knowledge.',
      Soldier: 'Trained for war and used to the chain of command.',
      Urchin: 'Survived alone on the streets as a child.',
    },
    origins: {
      'Custom (Tav)': { text: 'A fully custom character: every choice is yours.' },
      'The Dark Urge': { text: 'A custom character with its own story. The background is always Haunted One; race and class are free (the default is a White Dragonborn Sorcerer).' },
      Astarion: { cls: 'Rogue', text: 'Vampire spawn. Race and background are fixed; the class can be changed.' },
      Gale: { cls: 'Wizard', text: 'Wizard of Waterdeep. Race and background are fixed; the class can be changed.' },
      Karlach: { cls: 'Barbarian', text: 'Escaped from Avernus with an infernal engine for a heart. Race and background are fixed; the class can be changed.' },
      "Lae'zel": { cls: 'Fighter', text: 'Githyanki warrior. Race and background are fixed; the class can be changed.' },
      Shadowheart: { cls: 'Cleric (Trickery Domain)', text: 'Cleric of Shar. Race and background are fixed; the class can be changed.' },
      Wyll: { cls: 'Warlock (The Fiend)', text: 'The Blade of Frontiers. Race and background are fixed; the class can be changed.' },
    },
    // Level 1 of each class: saving throw proficiencies and how many skills to pick from which list.
    classes: {
      Barbarian: { saves: ['Strength', 'Constitution'], pick: 2, skills: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
      Bard: { saves: ['Dexterity', 'Charisma'], pick: 3, skills: 'any' },
      Cleric: { saves: ['Wisdom', 'Charisma'], pick: 2, skills: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
      Druid: { saves: ['Intelligence', 'Wisdom'], pick: 2, skills: ['Animal Handling', 'Arcana', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
      Fighter: { saves: ['Strength', 'Constitution'], pick: 2, skills: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
      Monk: { saves: ['Strength', 'Dexterity'], pick: 2, skills: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
      Paladin: { saves: ['Wisdom', 'Charisma'], pick: 2, skills: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
      Ranger: { saves: ['Strength', 'Dexterity'], pick: 3, skills: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
      Rogue: { saves: ['Dexterity', 'Intelligence'], pick: 4, skills: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
      Sorcerer: { saves: ['Constitution', 'Charisma'], pick: 2, skills: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
      Warlock: { saves: ['Wisdom', 'Charisma'], pick: 2, skills: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
      Wizard: { saves: ['Intelligence', 'Wisdom'], pick: 2, skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
    },
  };
})();
