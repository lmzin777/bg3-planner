// Automated checks for the planner's rules. Open index.html?test to run them.
// In test mode the planner starts from the default data and never reads or writes what you saved.
'use strict';

(function () {
  const results = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function test(name, fn) {
    try { fn(); results.push([name, '']); } catch (err) { results.push([name, String(err && err.message ? err.message : err)]); }
  }
  function eq(actual, expected, what) {
    if (!same(actual, expected)) throw new Error((what ? what + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
  const ok = (value, what) => { if (!value) throw new Error(what || 'expected a true value'); };
  const preset = (id) => normalizeBuild(clone(PRESETS.find((p) => p.presetId === id)));
  const build = (classes, creation) => {
    const b = blankBuild();
    classes.forEach((c, i) => { b.levels[i].cls = c; });
    Object.assign(b.creation, creation || {});
    return b;
  };
  const item = (name) => ITEM_BY_NAME.get(norm(name));

  // ---------- saved data ----------
  test('old free-text creation values are mapped to the game names', () => {
    const b = normalizeBuild({ creation: { origin: 'Tav (custom)', race: 'human', background: 'soldier', skills: 'stealth, sleight of hand' } });
    eq([b.creation.origin, b.creation.race, b.creation.background, b.creation.skills], ['Custom (Tav)', 'Human', 'Soldier', 'Stealth, Sleight of Hand']);
  });
  test('a subrace typed as the race is split into race and subrace', () => {
    const b = normalizeBuild({ creation: { race: 'High Elf' } });
    eq([b.creation.race, b.creation.subrace], ['Elf', 'High Elf']);
  });
  test('a build missing fields is completed', () => {
    const b = normalizeBuild({ name: 'x' });
    eq([b.levels.length, Object.keys(b.gear), b.creation.extra.str], [12, ['act1', 'act2', 'act3'], 0]);
  });
  test('every ready-made build has 12 levels and spends exactly 27 points', () => {
    PRESETS.forEach((p) => {
      const b = normalizeBuild(clone(p));
      eq([b.levels.filter((l) => l.cls).length, pointsUsed(b)], [12, 27], p.name);
    });
  });
  test('merging a backup adds new builds and skips identical ones', () => {
    const before = state.builds.length;
    const copy = clone(state.builds[0]);
    eq(mergeBackup({ builds: [copy], parties: [] }), 0, 'identical build');
    copy.name = 'Changed';
    eq(mergeBackup({ builds: [copy], parties: [] }), 1, 'changed build');
    eq(state.builds.length, before + 1);
    state.builds.pop();
  });

  // ---------- classes and levels ----------
  test('the class split reads subclasses from the level rows', () => {
    eq(splitText(preset('stealth-archer')), '5 Gloom Stalker / 5 Assassin / 2 Fighter');
  });
  test('free-text subclass names resolve to the game subclass', () => {
    eq([matchSubclass('Paladin', 'Vengeance Paladin'), matchSubclass('Monk', 'Open Hand Monk'), matchSubclass('Sorcerer', 'Shadow Sorcerer'), matchSubclass('Ranger', 'Gloom Stalker')],
      ['Oath of Vengeance', 'Way of the Open Hand', 'Shadow Magic', 'Gloom Stalker']);
    ok(matchSubclass('Barbarian', 'Giant Barbarian').startsWith('Giant'), 'Giant');
    eq(matchSubclass('Fighter', ''), '');
  });
  test('a level lists what the class and the subclass grant', () => {
    const b = preset('stealth-archer');
    const info = levelInfo(b);
    eq([info[4].cls, info[4].n, info[4].sub], ['Ranger', 5, 'Gloom Stalker']);
    const gains = levelGains(info[4]);
    ok(gains.includes('Extra Attack') && gains.includes('Misty Step'), 'Ranger 5 gains: ' + gains.join(', '));
    ok(grantsFeat(info[3]) && !grantsFeat(info[4]), 'feat at Ranger 4 only');
    ok(picksSubclass(info[2]), 'Ranger picks the subclass at level 3');
  });
  test('feats know which ability they can raise', () => {
    eq(featAbilities('Ability Improvement', '').length, 6);
    eq(featAbilities('Actor', (FEATS.find((f) => f[0] === 'Actor') || ['', ''])[1]), ['CHA']);
    eq(featAbilities('Alert', (FEATS.find((f) => f[0] === 'Alert') || ['', ''])[1]), []);
  });

  // ---------- proficiencies and items ----------
  test('proficiencies follow the starting class, multiclass and feature rules', () => {
    ok(proficiencies(preset('stealth-archer')).has('Heavy Armour'), 'Ranger Knight grants heavy armour');
    const sorc = proficiencies(preset('ice-sorcerer'));
    ok(!sorc.has('Light Armour') && sorc.has('Daggers'), 'sorcerer');
    ok(!proficiencies(build(['Wizard', 'Fighter'])).has('Heavy Armour'), 'multiclassing into Fighter gives no heavy armour');
    ok(proficiencies(build(['Fighter', 'Wizard'])).has('Heavy Armour'), 'starting as Fighter does');
    ok(proficiencies(build(['Wizard'], { race: 'Human' })).has('Light Armour'), 'Human grants light armour');
    const wm = build(['Wizard']);
    wm.levels[0].picks.push('Feat: Weapon Master (Longbows, Rapiers)');
    ok(proficiencies(wm).has('Longbows') && !proficiencies(wm).has('Greatswords'), 'Weapon Master');
  });
  test('an item is usable only with its proficiency', () => {
    const wizard = proficiencies(build(['Wizard']));
    const ranger = proficiencies(build(['Ranger']));
    eq([canUse(item('Yuan-Ti Scale Mail'), wizard), canUse(item('Yuan-Ti Scale Mail'), ranger)], [false, true]);
    eq([canUse(item('Titanstring Bow'), wizard), canUse(item('Titanstring Bow'), ranger)], [false, true]);
    ok(canUse(item('Risky Ring'), wizard), 'rings need no proficiency');
  });
  test('the off hand takes light weapons unless the build has Dual Wielder', () => {
    const b = build(['Fighter']);
    eq([canOffHand(item('Dolor Amarus'), b), canOffHand(item('Phalar Aluve'), b), canOffHand(item('Adamantine Shield'), b)], [true, false, true]);
    b.levels[3].picks.push('Feat: Dual Wielder');
    ok(canOffHand(item('Phalar Aluve'), b), 'with Dual Wielder');
  });

  // ---------- skills ----------
  test('skills unlock after race, background and class, within the class limit', () => {
    eq(skillState(build([])).missing.length, 3);
    const st = skillState(build(['Rogue'], { race: 'Human', background: 'Criminal' }));
    eq([st.missing.length, st.max, Object.keys(st.granted).sort()], [0, 5, ['Deception', 'Stealth']]);
    ok(st.canAdd('Perception') && st.canAdd('Arcana'), 'a Human may take one skill outside the class list');
    const elf = skillState(build(['Rogue'], { race: 'Elf', subrace: 'Wood Elf', background: 'Criminal' }));
    ok(elf.canAdd('Insight') && !elf.canAdd('Arcana'), 'others pick from the class list only');
    eq(elf.granted.Perception, 'Elf');
  });

  // ---------- final numbers ----------
  test('proficiency bonus grows every four levels', () => {
    eq([1, 4, 5, 8, 9, 12].map(profBonus), [2, 2, 3, 3, 4, 4]);
  });
  test('ability increases are read from feat choices', () => {
    const b = build(['Fighter']);
    b.levels[3].picks.push('Feat: Ability Improvement (+1 DEX, +1 CON)');
    b.levels[5].picks.push('Feat: Tavern Brawler +1 CON');
    b.levels[6].picks.push('Spell: Longstrider +9 STR');
    eq([featBonuses(b).dex, featBonuses(b).con, featBonuses(b).str], [1, 2, 0]);
  });
  test('the Stealth Archer ends at level 12 with the expected numbers', () => {
    const b = preset('stealth-archer');
    const s = finalStats(b, 'act2');
    eq([s.level, s.pb, s.scores.dex, s.hp], [12, 4, 19, 95]);
    eq(s.initiativeParts.map((p) => p[0]), ['DEX', 'Dread Ambusher', 'Yuan-Ti Scale Mail'], 'initiative comes from Dexterity, the Gloom Stalker and the armour');
    const stealth = s.skills.find((k) => k.name === 'Stealth');
    eq([stealth.expert, stealth.bonus], [true, 12]);
    eq(s.saves.filter((k) => k.proficient).map((k) => k.short), ['STR', 'DEX'], 'saving throws of the first class');
    // act 3 wears the Amulet of Greater Health: Constitution 23 and the hit points that come with it
    const late = finalStats(b, 'act3');
    eq([late.scores.con, late.hp], [23, 143]);
  });
  test('gear and elixirs change ability scores the way their text says', () => {
    const b = build(['Fighter'], { abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 8 } });
    const slots = b.gear.act1.slots;
    eq(abilityScores(b, 'act1').scores.str, 15);
    slots.gloves.name = 'Gauntlets of Hill Giant Strength';
    eq(abilityScores(b, 'act1').scores.str, 23, 'set to 23');
    eq(abilityScores(b, 'act2').scores.str, 15, 'only in the act that wears it');
    slots.gloves.name = 'Gloves of Dexterity';
    eq(abilityScores(b, 'act1').scores.dex, 18);
    b.creation.abilities.dex = 15; b.creation.plus2 = 'dex'; b.levels[3].picks.push('Feat: Ability Improvement (+2 DEX)');
    eq(abilityScores(b, 'act1').scores.dex, 19, 'an item that sets a score never lowers it');
    slots.chest.name = 'The Graceful Cloth';
    eq(abilityScores(b, 'act1').scores.dex, 20, '+2 up to a maximum of 20');
    slots.meleeMain.name = 'Harmonium Halberd';
    eq([abilityScores(b, 'act1').scores.int, abilityScores(b, 'act1').scores.wis], [7, 9], 'penalties count too');
    b.elixir = 'Elixir of Cloud Giant Strength';
    eq(abilityScores(b, 'act3').scores.str, 27, 'the elixir applies in every act');
    eq(elixirAbility('Elixir of Bloodlust'), null);
    const gnome = build(['Rogue'], { race: 'Gnome' });
    gnome.gear.act1.slots.gloves.name = 'Nimblefinger Gloves';
    eq(abilityScores(gnome, 'act1').scores.dex - abilityScores(gnome, 'act2').scores.dex, 2, 'a bonus only for some races');
  });
  test('builds saved before the elixir field pick it up from their consumables', () => {
    eq(normalizeBuild({ consumables: [{ name: 'Elixir of Bloodlust' }, { name: 'Elixir of Hill Giant Strength' }] }).elixir, 'Elixir of Hill Giant Strength');
    eq(normalizeBuild({ elixir: '', consumables: [{ name: 'Elixir of Hill Giant Strength' }] }).elixir, '', 'an explicit "none" is kept');
  });
  test('attack and damage follow ability, proficiency, enchantment and fighting style', () => {
    const b = build(['Fighter', 'Fighter', 'Fighter', 'Fighter', 'Fighter'], { abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 8 }, plus2: 'str' });
    const slots = b.gear.act1.slots;
    slots.meleeMain.name = 'Longsword +1';
    slots.rangedMain.name = 'Titanstring Bow';
    const row = (name) => finalStats(b, 'act1').attacks.rows.find((r) => r.name === name);
    eq([row('Longsword +1').attackTotal, row('Longsword +1').dice, row('Longsword +1').damageTotal], [7, '1d10', 4], '+3 STR +3 proficiency +1; held in two hands');
    slots.meleeOff.name = 'Adamantine Shield';
    b.levels[0].picks.push('Fighting Style: Duelling (or Defence)');
    eq([row('Longsword +1').dice, row('Longsword +1').damageTotal], ['1d8', 6], 'one hand with a shield, Duelling +2');
    eq([row('Titanstring Bow').attackTotal, row('Titanstring Bow').damageTotal], [6, 6], '+2 DEX +3 +1; damage +2 DEX +1 +3 STR from the bow');
    b.levels[0].picks[0] = 'Fighting Style: Archery';
    eq(row('Titanstring Bow').attackTotal, 8, 'Archery +2');
    const wizard = build(['Wizard']);
    wizard.gear.act1.slots.meleeMain.name = 'Longsword +1';
    eq(finalStats(wizard, 'act1').attacks.rows[0].proficient, false, 'no proficiency bonus without proficiency');
    const monk = preset('tavern-brawler-monk');
    const fist = finalStats(monk, 'act3').attacks.rows.find((r) => r.slot === 'unarmed');
    ok(fist && fist.attack.some((p) => p[0] === 'Tavern Brawler') && /^1d\d+$/.test(fist.dice), 'monk unarmed strike with Tavern Brawler: ' + JSON.stringify(fist));
  });
  test('spell numbers and slots follow class, multiclass and Pact Magic', () => {
    const levels = (list) => list.flatMap(([c, n]) => Array.from({ length: n }, () => c));
    const wizard = build(levels([['Wizard', 5]]), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 10, cha: 8 }, plus2: 'int' });
    const s = finalStats(wizard, 'act1');
    eq([s.casting[0].dc, s.casting[0].attack, s.casting[0].prepared, s.slots], [14, 6, 8, [4, 3, 2]], '8 + 3 + 3; +3 +3; INT + level; Wizard 5');
    wizard.gear.act1.slots.head.name = 'Hood of the Weave';
    eq([finalStats(wizard, 'act1').casting[0].dc, finalStats(wizard, 'act1').casting[0].attack], [16, 8], 'gear adds to spell save DC and spell attack');
    eq(spellSlots(build(levels([['Paladin', 2], ['Sorcerer', 10]]))), [4, 3, 3, 3, 2, 1], 'effective level 1 + 10');
    eq(spellSlots(build(levels([['Paladin', 5]]))), [4, 2], 'a single class uses its own table');
    const ek = build(levels([['Fighter', 7]]));
    ek.levels[2].sub = 'Eldritch Knight';
    eq([spellSlots(ek), finalStats(ek, 'act1').casting[0].ability], [[4, 2], 'int'], 'Eldritch Knight 7 counts as level 3');
    const lock = build(levels([['Warlock', 5], ['Fighter', 2]]));
    eq([spellSlots(lock), pactSlots(lock)], [[], { n: 2, level: 3 }], 'Pact Magic is apart from spell slots');
    eq([maxSpellLevel(wizard, 4), maxSpellLevel(wizard, 0), maxSpellLevel(build(['Fighter']), 0)], [3, 1, 0]);
  });
  test('class tables give resources and what changes at each level', () => {
    const barb = build(Array.from({ length: 9 }, () => 'Barbarian'));
    const res = Object.fromEntries(classResources(barb));
    eq([res['Rage Charges'], res['Rage Damage']], ['4', '+3']);
    ok(levelNumbers(levelInfo(barb)[2]).some((x) => x.startsWith('Rage Charges')), 'Barbarian 3 gains a Rage charge');
    const wizard = build(['Wizard', 'Wizard', 'Wizard']);
    ok(levelNumbers(levelInfo(wizard)[2]).some((x) => x.includes('4 / 2')), 'Wizard 3 shows its new slots: ' + levelNumbers(levelInfo(wizard)[2]));
    ok(CLASSES.every((c) => Object.values(CLASS_DATA[c].levels).flat().every((g) => !/\dpx/.test(g))), 'no picture sizes left in feature names');
    const bm = build(Array.from({ length: 7 }, () => 'Fighter'));
    bm.levels[2].sub = 'Battle Master';
    eq(Object.fromEntries(classResources(bm))['Superiority Dice'], '5');
  });
  test('features carry their description', () => {
    ok(/extra damage/i.test(featureText('Rage')), 'Rage: ' + featureText('Rage'));
    ok(featureText('Sneak Attack') && featureText('Extra Attack') && featureText('Bardic Inspiration (d6)'), 'common features');
    ok(featureText('Misty Step'), 'a granted spell falls back to the spell description');
    ok(Object.keys(FEATURES).length > 400, 'descriptions collected: ' + Object.keys(FEATURES).length);
  });
  test('items that grant proficiency count for the build', () => {
    const wizard = build(['Wizard']);
    ok(canUse(item('Elven Chain'), proficiencies(wizard)), 'Elven Chain makes its wearer proficient with it');
    ok(!canUse(item('Titanstring Bow'), proficiencies(wizard, 'act1')), 'no longbows yet');
    wizard.gear.act1.slots.gloves.name = 'Gloves of Archery';
    ok(canUse(item('Titanstring Bow'), proficiencies(wizard, 'act1')) && !canUse(item('Titanstring Bow'), proficiencies(wizard, 'act2')), 'longbows while the gloves are on');
  });
  test('multiclassing adds skill picks, and Expertise is read from the level choices', () => {
    const b = build(['Fighter', 'Rogue'], { race: 'Elf', subrace: 'Wood Elf', background: 'Soldier' });
    const st = skillState(b);
    eq(st.max, 3, 'Fighter 2 + Rogue 1');
    ok(st.canAdd('Sleight of Hand') && !st.canAdd('Arcana'), 'the extra pick comes from the Rogue list');
    ok(grantsExpertise(levelInfo(b)[1]) && !grantsExpertise(levelInfo(b)[0]), 'Rogue 1 grants Expertise');
    b.levels[1].picks.push('Expertise: Athletics + Stealth');
    eq(finalStats(b).skills.find((k) => k.name === 'Athletics').expert, true);
  });

  // ---------- guided choices ----------
  test('each level knows the choices it opens, with their options from the wiki', () => {
    const fighter = build(Array.from({ length: 10 }, () => 'Fighter'));
    fighter.levels[2].sub = 'Champion';
    const info = levelInfo(fighter);
    eq(levelChoices(info[0]).map((c) => [c.group.name, c.n]), [['Fighting Style', 1]]);
    eq(levelChoices(info[9]).map((c) => c.group.name), ['Fighting Style'], 'a Champion takes a second one at level 10');
    eq(classChoices(fighter, 'Fighter').map((g) => [g.name, g.need]), [['Fighting Style', 2]]);
    const style = CHOICES.find((c) => c.name === 'Fighting Style' && c.owner === 'Ranger');
    ok(style.options.some((o) => o[0] === 'Archery') && !style.options.some((o) => o[0] === 'Protection'), 'a Ranger cannot take Protection');
    const lock = build(Array.from({ length: 5 }, () => 'Warlock'));
    eq(classChoices(lock, 'Warlock').map((g) => [g.name, g.need]), [['Eldritch Invocation', 3], ['Pact Boon', 1]]);
    const inv = CHOICES.find((c) => c.name === 'Eldritch Invocation');
    ok(inv.options.find((o) => o[0] === 'Agonising Blast')[2] === 2 && inv.options.find((o) => o[0] === 'Lifedrinker')[2] === 12, 'invocations carry the level that unlocks them');
    ok(CHOICES.every((c) => c.options.length >= 2), 'every choice has options');
  });
  test('choices written in the levels are counted, in the forms the builds use', () => {
    const b = build(['Sorcerer', 'Sorcerer', 'Sorcerer']);
    const meta = () => { const g = classChoices(b, 'Sorcerer').find((x) => x.name === 'Metamagic'); return [chosenOf(b, 'Sorcerer', g).length, g.need]; };
    eq(meta(), [0, 3]);
    b.levels[1].picks.push('Metamagic: Twinned Spell', 'Metamagic: Extended Spell');
    eq(meta(), [2, 3]);
    b.levels[2].picks.push('Quickened Spell');
    eq(meta(), [3, 3], 'a bare option name counts too');
    ok(!buildIssues(b).some((x) => /Metamagic/.test(x.text)), 'nothing pending once all are chosen');
    const bm = preset('battle-master-fighter');
    const m = classChoices(bm, 'Fighter').find((x) => x.name === 'Manoeuvre');
    eq([chosenOf(bm, 'Fighter', m).length, m.need], [6, 7], '"Manoeuvres: your choice" counts as one');
    ok(buildIssues(bm).some((x) => x.text === 'Fighter: Manoeuvre — 6 of 7 chosen'), 'and the check says what is missing');
    const druid = build(Array.from({ length: 5 }, () => 'Druid'));
    druid.levels[1].sub = 'Circle of the Land';
    druid.levels[2].picks.push('Land: Coast');
    druid.levels[4].picks.push('Land: Coast');
    eq(chosenOf(druid, 'Druid', classChoices(druid, 'Druid').find((x) => x.name === 'Land')).length, 2, 'the same land may be taken again');
  });
  test('a chosen option grants what its text says', () => {
    const b = build(['Ranger'], { race: 'Elf', subrace: 'Wood Elf', background: 'Soldier' });
    ok(!proficiencies(b).has('Heavy Armour') && !pickedSkills(b).has('History'));
    b.levels[0].picks.push('Favoured Enemy: Ranger Knight');
    ok(proficiencies(b).has('Heavy Armour') && pickedSkills(b).has('History'), 'Ranger Knight: heavy armour and History');
    b.levels[0].picks.push('Natural Explorer: Urban Tracker');
    ok(finalStats(b).skills.find((k) => k.name === 'Sleight of Hand').proficient, 'Urban Tracker: Sleight of Hand');
  });
  test('feats ask for what is chosen inside them', () => {
    const b = build(['Fighter', 'Fighter', 'Fighter', 'Fighter'], { race: 'Human', background: 'Soldier' });
    const parts = (name) => featParts(name, (FEATS.find((f) => f[0] === name) || ['', ''])[1], b);
    eq(parts('Alert').length, 0);
    eq(parts('Ability Improvement').map((p) => [p.n, p.min]), [[2, 1]]);
    eq(parts('Skilled').map((p) => p.n), [3]);
    eq(parts('Weapon Master').map((p) => p.n), [1], 'a Fighter already has every weapon, so only the ability is asked');
    const wizard = build(['Wizard', 'Wizard', 'Wizard', 'Wizard']);
    const wm = featParts('Weapon Master', FEATS.find((f) => f[0] === 'Weapon Master')[1], wizard);
    eq(wm.map((p) => p.n), [1, 4]);
    ok(wm[1].options.some((o) => o[0] === 'Longbows') && !wm[1].options.some((o) => o[0] === 'Daggers'), 'only the weapon types the build lacks');
    eq(parts('Magic Initiate: Wizard').map((p) => p.n), [2, 1]);
    ok(parts('Magic Initiate: Wizard')[0].options.some((o) => o[0] === 'Fire Bolt'), 'wizard cantrips on offer');
    eq(parts('Martial Adept')[0].options.length, 14);
    eq(parts('Elemental Adept')[0].options.map((o) => o[0]), ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    const asi = parts('Ability Improvement');
    asi[0].chosen = ['DEX'];
    eq(featText('Ability Improvement', '', asi), 'Feat: Ability Improvement (+2 DEX)');
    wm[0].chosen = ['STR'];
    wm[1].chosen = ['Longbows', 'Rapiers'];
    eq(featText('Weapon Master', FEATS.find((f) => f[0] === 'Weapon Master')[1], wm), 'Feat: Weapon Master (+1 STR; Longbows, Rapiers)');
    b.levels[3].picks.push('Feat: Skilled');
    ok(buildIssues(b).some((x) => /Skilled — its options are not chosen/.test(x.text)), 'a feat left without its options is flagged');
    b.levels[3].picks[0] = 'Feat: Skilled (Arcana, History, Insight)';
    ok(!buildIssues(b).some((x) => /Skilled/.test(x.text)) && finalStats(b).skills.find((k) => k.name === 'Arcana').proficient, 'and counts once they are written');
  });
  test('High Elves choose a Wizard cantrip', () => {
    const b = build(['Fighter'], { race: 'Elf', subrace: 'High Elf', background: 'Soldier' });
    ok(raceCantrips(b).includes('Fire Bolt') && !raceCantrips(build(['Fighter'], { race: 'Human' })).length);
    ok(buildIssues(b).some((x) => x.text === 'Racial cantrip not chosen'));
    b.creation.cantrip = 'Fire Bolt';
    ok(!buildIssues(b).some((x) => x.text === 'Racial cantrip not chosen'));
  });

  // ---------- permanent bonuses and levels ----------
  test('permanent bonuses enter the numbers from their act on', () => {
    const b = build(['Fighter'], { abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 8 } });
    const fx = (name) => permanentEffect(PERMANENT.find((p) => p.n === name));
    eq([fx("Auntie Ethel's Hair").choice, fx('Potion of Everlasting Vigour').fixed, fx('Mirror of Loss').choice, fx('Mirror of Loss').optional, fx('Anointed in Splendour').saves],
      [1, [{ ab: 'str', n: 2 }], 2, { ab: 'cha', n: 1 }, 2]);
    b.permanent["Auntie Ethel's Hair"] = { on: true, ab: 'dex', got: false };
    b.permanent['Potion of Everlasting Vigour'] = { on: true, ab: '', got: false };
    b.permanent['Mirror of Loss'] = { on: true, ab: 'str', extra: true, got: false };
    eq(ABILS.map(([k]) => abilityScores(b, 'act1').scores[k]), [15, 15, 13, 8, 10, 8], 'act 1: the hair');
    eq(abilityScores(b, 'act2').scores.str, 17, 'act 2: the potion');
    eq([abilityScores(b, 'act3').scores.str, abilityScores(b, 'act3').scores.cha], [19, 9], 'act 3: the mirror, with its optional Charisma');
    b.permanent['Anointed in Splendour'] = { on: true };
    eq(finalStats(b, 'act3').saves.find((k) => k.key === 'wis').bonus - finalStats(b, 'act2').saves.find((k) => k.key === 'wis').bonus, 2);
    eq(normalizeBuild(clone(b)).permanent['Mirror of Loss'], { on: true, ab: 'str', extra: true, got: false }, 'kept when saved and loaded');
    ok(buildIssues(Object.assign(build(['Fighter']), { permanent: { "Auntie Ethel's Hair": { on: true, ab: '' } } })).some((x) => /choose the ability/.test(x.text)));
  });
  test('the numbers can be read at any level', () => {
    const b = preset('stealth-archer');
    const at = (n) => finalStats(b, 'act1', { level: n });
    eq([at(1).level, at(1).pb, at(4).pb, at(5).pb, at(12).level], [1, 2, 2, 3, 12]);
    ok(at(3).hp < at(4).hp && at(4).hp < at(12).hp, 'hit points grow');
    eq([at(1).slots, at(2).slots, at(5).slots], [[], [2], [4, 2]], 'Ranger slots arrive at level 2');
    ok(!at(2).initiativeParts.some((p) => p[0] === 'Dread Ambusher') && at(3).initiativeParts.some((p) => p[0] === 'Dread Ambusher'), 'Gloom Stalker features start at level 3');
    eq(splitText(atLevel(b, 6)), '5 Gloom Stalker / 1 Rogue');
    b.current = 4;
    ok(/Next: level 5/.test(nextLevelText(b)) && /Extra Attack/.test(nextLevelText(b)), nextLevelText(b));
  });
  test('monk weapons, thrown weapons and Remarkable Athlete follow the wiki', () => {
    const monk = build(Array.from({ length: 4 }, () => 'Monk'), { abilities: { str: 10, dex: 15, con: 14, int: 8, wis: 15, cha: 8 }, plus2: 'dex' });
    monk.gear.act1.slots.meleeMain.name = 'Quarterstaff';
    const staff = finalStats(monk, 'act1').attacks.rows[0];
    eq([staff.attack[0], staff.attackTotal], [['DEX', 3], 5], 'a quarterstaff uses Dexterity in a monk\'s hands');
    monk.gear.act1.slots.meleeMain.name = 'Dagger';
    eq(finalStats(monk, 'act1').attacks.rows[0].dice, '1d6', 'Deft Strikes: the Martial Arts die when it is higher than 1d4');
    const thrower = build(Array.from({ length: 4 }, () => 'Barbarian'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str' });
    thrower.gear.act1.slots.meleeMain.name = 'Javelin';
    eq(finalStats(thrower, 'act1').attacks.rows.filter((r) => r.thrown).length, 0, 'no thrown row without Tavern Brawler');
    thrower.levels[3].picks.push('Feat: Tavern Brawler (+1 STR)');
    const thrown = finalStats(thrower, 'act1').attacks.rows.find((r) => r.thrown);
    eq([thrown.attackTotal, thrown.damageTotal], [10, 8], 'STR 18: +4 +2 proficiency +4 again; damage +4 +4');
    const champ = build(Array.from({ length: 7 }, () => 'Fighter'), { race: 'Human', background: 'Soldier', abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 8 } });
    const before = finalStats(champ).skills.find((k) => k.name === 'Stealth').bonus;
    champ.levels[2].sub = 'Champion';
    const s = finalStats(champ);
    eq([s.skills.find((k) => k.name === 'Stealth').bonus - before, s.skills.find((k) => k.name === 'Arcana').bonus], [1, -1], 'half of +3, rounded down, on physical skills only');
  });
  test('an item is compared by what it changes in the numbers', () => {
    const b = build(Array.from({ length: 5 }, () => 'Fighter'), { abilities: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 8 }, plus2: 'str' });
    b.gear.act1.slots.chest.name = 'Chain Mail';
    b.gear.act1.slots.meleeMain.name = 'Longsword';
    const { p, base } = recommendBase(b, 'act1');
    eq(gearDelta(b, 'act1', 'chest', item('Adamantine Splint Armour'), base, p.style, 0).ac, 2, 'AC 18 against 16');
    const sword = gearDelta(b, 'act1', 'meleeMain', item('Longsword +1'), base, p.style, 0);
    eq([sword.attack, sword.damage], [1, 1]);
    eq(gearDelta(b, 'act1', 'gloves', item('Gauntlets of Hill Giant Strength'), base, p.style, 0).attack, 3, 'Strength 23 instead of 17');
    ok(/AC \+2/.test(deltaText({ ac: 2, initiative: -1 })) && /Initiative −1/.test(deltaText({ ac: 2, initiative: -1 })));
    eq(deltaText({ saves: 12 }), 'Every saving throw +2');
    const best = recommend(b, 'gloves', 'act1', 'damage', ITEMS.filter((it) => it.s === 'gloves' && (!it.a || it.a <= 3)))[0];
    eq(best.it.n, 'Gauntlets of Hill Giant Strength', 'the biggest real gain comes first: ' + best.reasons.join('; '));
  });
  test('the party table shows each member at their level', () => {
    const a = build(Array.from({ length: 12 }, () => 'Fighter'));
    a.current = 3;
    eq([memberStats(a).level, finalStats(a).level], [3, 12]);
    ok(mainAttack(finalStats(preset('stealth-archer'), 'act3'), 'ranged').name === 'Titanstring Bow');
  });

  // ---------- build check ----------
  test('the build check lists what is missing and what does not fit', () => {
    const texts = (b) => buildIssues(b).map((x) => x.text).join(' | ');
    const b = build(['Fighter', 'Fighter', 'Fighter', 'Fighter'], { race: 'Human', background: 'Soldier', abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, plus2: 'str', plus1: 'con', skills: 'Perception, Survival, Arcana' });
    ok(/subclass not chosen/.test(texts(b)) && /Level 4: feat not chosen/.test(texts(b)), texts(b));
    b.levels[2].sub = 'Champion';
    b.levels[3].picks.push('Feat: Alert');
    ok(!/subclass|feat not chosen/.test(texts(b)), 'cleared once chosen: ' + texts(b));
    b.gear.act1.slots.chest.name = 'Helldusk Armour';
    b.gear.act1.slots.meleeMain.name = 'Balduran\'s Giantslayer';
    b.gear.act1.slots.meleeOff.name = 'Adamantine Shield';
    ok(/Helldusk Armour is only found in Act 3/.test(texts(b)) && /needs both hands/.test(texts(b)), texts(b));
    const wizard = build(['Wizard']);
    wizard.gear.act1.slots.chest.name = 'Adamantine Splint Armour';
    wizard.levels[0].picks.push('Spell: Fireball');
    ok(/not proficient with Heavy Armour/.test(texts(wizard)) && /Fireball is a level 3 spell/.test(texts(wizard)), texts(wizard));
    eq(buildIssues(preset('stealth-archer')).filter((x) => x.level === 'warn').map((x) => x.text), ['Race not chosen'], 'the ready-made archer only lacks a race');
    eq(buildIssues(preset('tempest-sorcerer')).filter((x) => x.level === 'warn' && x.where === 'Level progression').map((x) => x.text), [], 'the ready-made builds name their choices');
  });
  test('a contested item shows in the build check and drops in the recommendations', () => {
    const a = build(['Fighter']);
    const c = build(['Fighter']);
    a.gear.act1.slots.ring1.name = 'Risky Ring';
    state.builds.push(a, c);
    const party = blankParty('Test');
    party.members[0].buildId = a.id;
    party.members[1].buildId = c.id;
    party.members[0].char = 'Karlach';
    state.parties.push(party);
    eq(partyTaken(c, 'act1')[norm('Risky Ring')], 'Karlach');
    c.gear.act1.slots.ring1.name = 'Risky Ring';
    ok(buildIssues(c).some((x) => /also worn by Karlach/.test(x.text)), 'flagged in the check');
    const rings = ITEMS.filter((it) => it.s === 'ring');
    const taken = recommend(c, 'ring2', 'act1', 'damage', rings).find((r) => r.it.n === 'Risky Ring');
    ok(taken && taken.taken === 'Karlach', 'marked in the recommendations');
    state.parties.pop();
    state.builds.splice(-2, 2);
  });

  // ---------- undo and sharing ----------
  test('a deleted build comes back with its place in the party', () => {
    const b = build(['Fighter']);
    b.name = 'Trash test';
    state.builds.push(b);
    const p = curParty();
    const free = p.members.findIndex((m) => !m.buildId);
    p.members[free].buildId = b.id;
    toTrash('build', b, [[p.id, free]]);
    p.members[free].buildId = '';
    state.builds.pop();
    eq(state.trash[0].data.name, 'Trash test');
    const back = restoreTrash(0);
    eq([back.name, p.members[free].buildId === back.id, state.trash.length], ['Trash test', true, 0]);
    p.members[free].buildId = '';
    state.builds.pop();
  });
  test('pruning for the share code loses nothing', () => {
    const b = preset('stealth-archer');
    b.gear.act1.slots.ring1 = { name: 'Risky Ring', rarity: item('Risky Ring').r, where: itemWhere(item('Risky Ring')), note: 'mine', got: true };
    const lean = leanBuild(b);
    eq(lean.gear.act1.slots.ring1, { name: 'Risky Ring', note: 'mine', got: true }, 'what the item database knows is left out');
    const back = normalizeBuild(fromLean(JSON.parse(JSON.stringify(lean))));
    back.id = b.id;
    eq(back, b);
    ok(JSON.stringify(lean).length < JSON.stringify(b).length, 'and it is shorter');
    ok(isShareCode('BG3B2.' + 'a'.repeat(40)) && !isShareCode('{"type":"bg3-planner"}'), 'codes are told apart from backups');
  });
  test('heavy armour ignores Dexterity, medium armour caps it', () => {
    const b = build(['Fighter'], { abilities: { str: 15, dex: 15, con: 13, int: 8, wis: 10, cha: 8 } });
    const mods = finalStats(b).mods;
    b.gear.act1.slots.chest.name = 'Adamantine Splint Armour';
    eq(armourClass(b, 'act1', mods), 18);
    b.gear.act1.slots.chest.name = 'Adamantine Scale Mail';
    eq(armourClass(b, 'act1', mods), 18, '16 + 2');
    b.gear.act1.slots.meleeOff.name = 'Adamantine Shield';
    eq(armourClass(b, 'act1', mods), 20, 'with a shield');
    eq(armourClass(b, 'act2', mods), 12, 'unarmoured: 10 + DEX');
  });

  // ---------- armour class ----------
  test('items add to Armour Class only when their own text says so', () => {
    eq([itemAcBonus(item('Cloak of Protection')).when, itemAcBonus(item('Cloak of Protection')).n], ['always', 1]);
    eq([itemAcBonus(item('Bracers of Defence')).when, itemAcBonus(item('Bracers of Defence')).n], ['unarmoured', 2]);
    eq(itemAcBonus(item('Ring of Twilight')).when, 'situational');
    eq(itemAcBonus(item('Gleamdance Dagger')).when, 'offhand');
    eq(itemAcBonus(item('Risky Ring')), null);
  });
  test('Armour Class follows the wiki formulas', () => {
    const b = build(['Wizard'], { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 10, cha: 8 } });
    const mods = finalStats(b).mods;
    const slots = b.gear.act1.slots;
    eq(armourClass(b, 'act1', mods), 12, 'unarmoured: 10 + DEX');
    slots.cloak.name = 'Cloak of Protection';
    slots.gloves.name = 'Bracers of Defence';
    eq(armourClass(b, 'act1', mods), 15, 'cloak +1 and bracers +2 while unarmoured');
    slots.meleeOff.name = 'Adamantine Shield';
    eq(armourClass(b, 'act1', mods), 15, 'a shield adds 2 but switches the bracers off');
    slots.ring1.name = 'Ring of Twilight';
    const info = armourClassInfo(b, 'act1', mods);
    eq([info.total, info.situational.length], [15, 1], 'situational bonuses are listed, not added');
    b.levels[0].picks.push('Spell: Mage Armour');
    slots.meleeOff.name = '';
    eq(armourClassInfo(b, 'act1', mods).mage, 18, '13 + DEX + cloak + bracers');
    const barb = build(['Barbarian'], { abilities: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 8 } });
    eq(armourClass(barb, 'act1', finalStats(barb).mods), 14, 'Unarmoured Defence: 10 + DEX + CON');
  });

  // ---------- tags and recommendations ----------
  test('items are tagged from their effect text', () => {
    ok(item('Risky Ring').g.includes('accuracy'), 'Risky Ring: ' + item('Risky Ring').g);
    ok(item('Cloak of Protection').g.includes('ac') && item('Cloak of Protection').g.includes('saves'), 'Cloak of Protection: ' + item('Cloak of Protection').g);
    ok(item('Boots of Stormy Clamour').en2.includes('Reverberation'), 'combo effect');
  });
  test('the build profile reads style, main ability and habits', () => {
    const p = buildProfile(preset('stealth-archer'));
    eq([p.style, p.main, p.stealth, p.crit, p.elements.has('Fire')], ['ranged', 'dex', true, true, false]);
    eq(buildProfile(preset('ice-sorcerer')).style, 'caster');
    eq(buildProfile(preset('tavern-brawler-monk')).style, 'unarmed');
  });
  test('recommendations respect the build', () => {
    const archer = preset('stealth-archer');
    const usable = (b, kinds) => ITEMS.filter((it) => kinds.includes(it.s) && canUse(it, proficiencies(b)));
    const rings = recommend(archer, 'ring1', 'act3', 'damage', usable(archer, ['ring'])).slice(0, 3).map((r) => r.it.n);
    ok(rings.includes('Risky Ring'), 'Risky Ring in the top 3 rings for damage: ' + rings.join(', '));
    const monk = preset('tavern-brawler-monk');
    ok(recommend(monk, 'chest', 'act3', 'defence', usable(monk, ['chest'])).every((r) => !ARMOUR_TYPES.includes(r.it.t)), 'no armour for a monk');
    const fighter = build(['Fighter'], { abilities: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 8 } });
    const best = recommend(fighter, 'chest', 'act3', 'defence', usable(fighter, ['chest']))[0];
    eq(best.it.t, 'Heavy Armour', 'a fighter with 10 DEX is told to wear ' + best.it.n);
    ok(best.reasons.length > 0, 'every recommendation says why');
  });

  // ---------- reference tabs ----------
  test('item filters and sorting work together', () => {
    const f = libState('items');
    const saved = clone(f);
    Object.assign(f, { q: '', kind: 'ring', type: '', rar: ['rare'], act: '', build: '', sort: 'name', dir: 'asc' });
    const list = libSorted('items');
    ok(list.length > 0 && list.every((it) => it.s === 'ring' && it.r === 'rare'), 'only rare rings');
    eq(list.map((it) => it.n), list.map((it) => it.n).slice().sort((a, b) => a.localeCompare(b)), 'sorted by name');
    f.dir = 'desc';
    eq(libSorted('items')[0].n, list[list.length - 1].n, 'descending reverses it');
    ok(libCounts('items', 'kind').head > 0, 'facet counts ignore their own filter');
    Object.assign(f, saved);
  });
  test('spell filters find class spells', () => {
    const f = libState('spells');
    const saved = clone(f);
    Object.assign(f, { q: 'fireball', lv: [], cls: 'Wizard', origin: 'class', school: '', cost: '', dmg: 'Fire', save: 'DEX', conc: false, ritual: false });
    eq(libSorted('spells').map((s) => s.n), ['Fireball']);
    Object.assign(f, { q: '', cls: '', dmg: '', save: '', origin: 'class' });
    const classOnly = libSorted('spells').length;
    f.origin = '';
    ok(classOnly < libSorted('spells').length && libSorted('spells').length === SPELLS.length, 'follow-up actions and item spells are hidden until asked for');
    eq(SPELLS.find((s) => s.n === 'Produce Flame: Hurl').og, 'other');
    Object.assign(f, saved);
  });
  test('consumables are listed with the items and suggested by name', () => {
    const f = libState('items');
    const saved = clone(f);
    Object.assign(f, { q: 'hill giant', kind: 'consumable', type: '', tag: '', rar: [], act: '', build: '' });
    eq(libSorted('items').map((it) => it.n), ['Elixir of Hill Giant Strength']);
    Object.assign(f, saved);
    eq(suggestItems('consumable', 'cloud gi').map((c) => c.n), ['Elixir of Cloud Giant Strength']);
    ok(CONSUMABLES.filter((c) => c.t === 'Elixir').length > 30, 'elixirs collected');
  });

  // ---------- translation ----------
  test('placeholders are filled and unknown strings fall back to English', () => {
    const lang = state.ui.lang;
    state.ui.lang = 'pt-BR';
    eq([t('Act {n}', { n: 2 }), t('A string nobody translated')], ['Ato 2', 'A string nobody translated']);
    state.ui.lang = lang;
  });

  // ---------- report ----------
  const failed = results.filter((r) => r[1]);
  document.title = 'TESTS: ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed';
  const box = document.createElement('div');
  box.id = 'test-report';
  box.style.cssText = 'position:fixed;inset:0;z-index:999;overflow:auto;background:#0e0c0a;color:#ece3d3;font:14px/1.6 Segoe UI,sans-serif;padding:24px';
  box.innerHTML = '<h1 style="font:600 22px Georgia,serif;color:' + (failed.length ? '#d2604a' : '#6fbf73') + '">' + document.title + '</h1><ol>'
    + results.map(([name, err]) => '<li style="color:' + (err ? '#d2604a' : '#a2947f') + '">' + (err ? 'FAIL' : 'ok') + ' · ' + esc(name) + (err ? '<br><code>' + esc(err) + '</code>' : '') + '</li>').join('') + '</ol>';
  document.body.appendChild(box);
})();
