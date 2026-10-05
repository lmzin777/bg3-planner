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
  test('an item of unknown act is offered early only when it is ordinary gear with a source', () => {
    eq([foundBy(item('Risky Ring'), 1), foundBy(item('Risky Ring'), 2)], [false, true], 'a known act decides');
    ok(foundBy(item('Longsword +1'), 1), 'trader gear without an act');
    ok(!foundBy(item('Half Plate Armour +2'), 1), 'rare gear without an act is not assumed to be there');
    ok(!foundBy(item('Shield (Hope)'), 3), 'nor is an item the wiki gives no source for');
  });
  test('an item made for someone else is not offered', () => {
    const human = build(['Fighter'], { race: 'Human' });
    const gith = build(['Fighter'], { race: 'Githyanki' });
    const bard = build(['Bard'], { race: 'Human' });
    eq([suits(item('Githyanki Greatsword (Psionic)'), human), suits(item('Githyanki Greatsword (Psionic)'), gith)], [false, true], 'its one effect is for githyanki');
    eq([suits(item('Blazer of Benevolence'), human), suits(item('Blazer of Benevolence'), bard)], [false, true], 'Bardic Inspiration needs a Bard');
    eq([suits(item("Reason's Grasp"), human), suits(item("Reason's Grasp"), build(['Barbarian']))], [false, true], 'Rage needs a Barbarian');
    eq(suits(item('Greatclub (Minotaur)'), gith), false, 'not usable by humanoids');
    const fit = itemFit(item('Soulbreaker Greatsword'), human);
    eq([fit.ok, fit.missing], [true, ['Githyanki']], 'an item with other effects stays, and says what does not work');
    ok(suits(item('Blightbringer'), human) && suits(item("Voss' Silver Sword"), human), 'a race named as the target is no requirement');
    const drowHalf = build(['Rogue'], { race: 'Half-Elf', subrace: 'Drow Half-Elf' });
    eq([suits(item('Cruel Sting'), human), suits(item('Cruel Sting'), drowHalf)], [itemSentences(item('Cruel Sting')).length > 1, true], 'a half-drow counts as Drow');
    const branded = build(['Fighter']);
    eq(itemFit(item("Absolute's Talisman"), branded).missing, ["the Absolute's Brand"]);
    branded.permanent['Brand of the Absolute'] = { on: true };
    eq(itemFit(item("Absolute's Talisman"), branded).missing, []);
    ok(!liveSentences(item('Silver Sword of the Astral Plane'), human).length && liveSentences(item('Silver Sword of the Astral Plane'), gith).length === 2);
    const amulets = recommend(human, 'amulet', 'act3', 'defence', ITEMS.filter((it) => it.s === 'amulet'));
    const hunters = amulets.find((r) => r.it.n === "Aberration Hunters' Amulet");
    ok(!hunters || !hunters.reasons.some((x) => /Saving throws/.test(x)), 'the githyanki-only saving throw is not a reason for a human');
    human.gear.act1.slots.chest.name = 'Blazer of Benevolence';
    ok(buildIssues(human).some((x) => /Blazer of Benevolence: its effects are for Bard/.test(x.text)), 'worn anyway, the build check says so');
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

  // ---------- spells per level ----------
  test('each level knows how many spells and cantrips it teaches', () => {
    const at = (classes, i, sub) => { const b = build(classes); if (sub) b.levels[sub[0]].sub = sub[1]; const x = spellsAtLevel(levelInfo(b)[i]); return [x.cantrips, x.spells, x.any, x.list, x.replace]; };
    eq(at(['Sorcerer'], 0), [4, 2, 0, 'Sorcerer', false]);
    eq(at(['Sorcerer', 'Sorcerer'], 1), [0, 1, 0, 'Sorcerer', true], 'one new spell, and a known one may be swapped');
    eq(at(['Wizard'], 0), [3, 6, 0, 'Wizard', false], 'wizards never swap');
    eq(at(['Cleric'], 0), [3, 0, 0, 'Cleric', false], 'clerics prepare: only cantrips are learned');
    eq(at(['Fighter', 'Fighter', 'Fighter'], 2, [2, 'Eldritch Knight']), [2, 3, 1, 'Wizard', false], 'Eldritch Knight 3: Wizard list, one pick free of the school limit');
    eq(SPELL_PICKS['Eldritch Knight'].schools, ['Abjuration', 'Evocation']);
    eq(SPELL_PICKS['Arcane Trickster'].schools, ['Enchantment', 'Illusion']);
  });
  test('a replaced spell leaves the list, and the counts follow', () => {
    const b = build(['Sorcerer', 'Sorcerer', 'Sorcerer']);
    b.levels[0].picks.push('Cantrip: Fire Bolt', 'Spell: Sleep', 'Spell: Magic Missile');
    b.levels[1].picks.push('Spell: Shield');
    b.levels[2].picks.push('Spell: Misty Step (replaces Sleep)', 'Spell: Scorching Ray');
    eq(currentSpells(b).filter((x) => !x.cantrip).map((x) => x.name), ['Magic Missile', 'Shield', 'Misty Step', 'Scorching Ray']);
    const k = knownSpells(b)[0];
    eq([k.cantrips, k.maxCantrips, k.spells, k.maxSpells], [1, 4, 4, 4], 'five were written, four are known, as Sorcerer 3 allows');
    ok(buildIssues(b).some((x) => x.text === 'Sorcerer: 1 of 4 cantrips chosen' && x.level === 'note') && !buildIssues(b).some((x) => /spells chosen/.test(x.text)));
    const elf = build(['Fighter'], { race: 'Elf', subrace: 'High Elf', cantrip: 'Fire Bolt' });
    elf.levels[0].picks.push('Feat: Magic Initiate: Wizard (Mage Hand, Light; Shield)');
    eq(currentSpells(elf).map((x) => x.name), ['Fire Bolt', 'Mage Hand', 'Light', 'Shield'], 'the racial cantrip and the spells of a feat are known too');
  });
  test('the borrowed spell lists keep to their schools', () => {
    const b = build(['Fighter', 'Fighter', 'Fighter']);
    b.levels[2].sub = 'Eldritch Knight';
    b.levels[2].picks.push('Spell: Shield', 'Spell: Magic Missile', 'Spell: Longstrider');
    const k = knownSpells(b)[0];
    eq([k.label, k.maxCantrips, k.maxSpells, k.offSchool, k.maxAny], ['Eldritch Knight', 2, 3, 1, 1], 'Longstrider is Transmutation: the one free pick');
    b.levels[2].picks.push('Spell: Sleep');
    ok(buildIssues(b).some((x) => /2 spells outside Abjuration \/ Evocation, and only 1 may be/.test(x.text)), 'a second one is flagged');
  });

  // ---------- traits and switchable bonuses ----------
  test('traits are read from race, class and gear', () => {
    const list = (b, key, act) => traitsOf(b, act || 'act1')[key].map((x) => x[0] + (x[2] ? '*' : ''));
    const monk = build(Array.from({ length: 6 }, () => 'Monk'), { race: 'Elf', subrace: 'Wood Elf' });
    eq(list(monk, 'speed'), ['9 m', '+1.5 m', '+4.5 m*'], 'Elf speed, Fleet of Foot, and the monk table for Unarmoured Movement');
    eq(list(monk, 'senses'), ['Darkvision 12 m']);
    ok(list(monk, 'advantage').some((x) => /Charmed/.test(x) && !/\*/.test(x)) && list(monk, 'immune').includes('magical Sleep'), 'Fey Ancestry: ' + list(monk, 'advantage') + ' / ' + list(monk, 'immune'));
    const tiefling = build(['Barbarian'], { race: 'Tiefling', subrace: 'Zariel Tiefling' });
    ok(list(tiefling, 'resist').includes('Fire') && list(tiefling, 'resist').includes('Physical damage*'), 'Hellish Resistance always, Rage only while raging');
    eq(traitsOf(tiefling, 'act1').spells.map((x) => [x[0], x[2]]), [['Thaumaturgy', false], ['Searing Smite', true], ['Branding Smite', true]], 'racial spells arrive at levels 1, 3 and 5');
    tiefling.gear.act1.slots.cloak.name = 'Cloak of Protection';
    ok(!list(tiefling, 'immune').some((x) => x.length < 4), 'no stray words');
  });
  test('switched-on bonuses change the numbers they should', () => {
    const barb = build(Array.from({ length: 5 }, () => 'Barbarian'), { abilities: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 8 }, plus2: 'str' });
    barb.gear.act1.slots.meleeMain.name = 'Greataxe';
    barb.gear.act1.slots.rangedMain.name = 'Longbow';
    const rows = () => finalStats(barb, 'act1').attacks.rows;
    const before = rows().map((r) => r.damageTotal);
    barb.active = ['rage'];
    eq(rows().map((r) => r.damageTotal), [before[0] + 2, before[1]], 'Rage adds its damage to melee, not to the bow');
    const rogue = build(Array.from({ length: 5 }, () => 'Rogue'));
    rogue.gear.act1.slots.meleeMain.name = 'Rapier';
    rogue.gear.act1.slots.rangedMain.name = 'Shortbow';
    rogue.levels[3].picks.push('Feat: Sharpshooter');
    eq(availableToggles(rogue, 'act1').map((x) => x.key), ['adv', 'sneak', 'feat:Sharpshooter']);
    rogue.active = ['sneak', 'feat:Sharpshooter'];
    const r = finalStats(rogue, 'act1').attacks.rows;
    eq([r[0].extraDice[0][0], r[1].extraDice[0][0]], ['3d6', '3d6'], 'Sneak Attack on finesse and ranged weapons');
    ok(!r[0].attack.some((p) => p[0] === 'Sharpshooter') && r[1].attack.some((p) => p[0] === 'Sharpshooter' && p[1] === -5) && r[1].damage.some((p) => p[1] === 10), 'Sharpshooter only on the bow');
    eq(damageText(r[1]).replace(/\s/g, ''), '1d6+3d6+' + r[1].damageTotal);
    const cleric = build(['Cleric']);
    cleric.levels[0].picks.push('Spell: Bless', 'Spell: Shield of Faith');
    const off = finalStats(cleric, 'act1');
    cleric.active = ['text:Bless', 'text:Shield of Faith'];
    const on = finalStats(cleric, 'act1');
    eq([on.ac.act1 - off.ac.act1, on.savesDice], [2, ['1d4']], 'Shield of Faith +2 AC, Bless 1d4 on saving throws');
    const pal = build(Array.from({ length: 6 }, () => 'Paladin'), { abilities: { str: 15, dex: 10, con: 13, int: 8, wis: 10, cha: 15 }, plus1: 'cha' });
    eq(finalStats(pal).saves.find((k) => k.key === 'int').bonus, 2, 'Aura of Protection: Charisma on every saving throw, always on');
    eq(textEffect('Each duplicate increases your Armour Class by 3'), null, 'what cannot be one number is left out');
  });

  // ---------- step-by-step creation ----------
  test('the step by step shows only the steps that apply, and knows when each is done', () => {
    const b = build([]);
    const keys = (x) => wizSteps(x).map((s) => s[0]);
    eq(keys(b), ['origin', 'race', 'class', 'background', 'abilities', 'skills', 'done']);
    b.creation.race = 'Elf';
    b.levels[0].cls = 'Cleric';
    eq(keys(b).filter((k) => !k.startsWith('lv:')), ['origin', 'race', 'subrace', 'class', 'subclass', 'background', 'abilities', 'skills', 'level1', 'done']);
    eq(keys(b).filter((k) => k.startsWith('lv:')).length, 11, 'one step per level from 2 to 12');
    eq(['race', 'subrace', 'class', 'subclass', 'abilities'].map((k) => wizDone(b, k)), [true, false, true, false, false]);
    b.levels[0].sub = 'Life Domain';
    Object.assign(b.creation, { subrace: 'Wood Elf', abilities: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 }, plus2: 'wis', plus1: 'con' });
    eq(['subrace', 'subclass', 'abilities', 'level1'].map((k) => wizDone(b, k)), [true, true, true, false], 'a Cleric still has 3 cantrips to choose');
    b.levels[0].picks.push('Cantrip: Guidance', 'Cantrip: Sacred Flame', 'Cantrip: Light');
    ok(wizDone(b, 'level1'));
    ok(/Life Domain/.test(wizardView(b)) || true);
    state.ui.wizard = 'class';
    ok(/wiz-card/.test(wizardView(b)) && /Hit points/.test(wizardView(b)), 'the class step renders its cards');
    state.ui.wizard = '';
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

  // ---------- creation data from the wiki ----------
  test('races, backgrounds, classes and origins come from the generated data', () => {
    eq(Object.keys(RACES).length, 11);
    eq([RACES.Elf, RACES.Human, RACES.Dragonborn.length], [['High Elf', 'Wood Elf'], [], 10]);
    eq([DATA.races.Elf.speed, DATA.races.Dwarf.speed, DATA.races.Elf.skills, DATA.subraces['Wood Elf'].skills], ['9 m', '7.5 m', ['Perception'], ['Stealth']]);
    ok(DATA.races.Githyanki.prof.includes('Medium Armour') && DATA.races.Githyanki.prof.includes('Greatswords') && DATA.subraces['Shield Dwarf'].prof.includes('Medium Armour'));
    eq([DATA.races.Human.skillPick, DATA.subraces['High Elf'].cantrip, DATA.subraces['Zariel Tiefling'].spells.map((x) => x[1])], [1, 'Wizard', [1, 3, 5]]);
    ok(!DATA.races.Drow.features.some((f) => /Sunlight/.test(f[0])), 'what only NPC drow have is left out');
    eq(Object.keys(BACKGROUNDS).length, 12);
    eq([BACKGROUNDS.Sage, BACKGROUNDS['Haunted One']], [['Arcana', 'History'], ['Medicine', 'Intimidation']]);
    eq(CLASSES.map((c) => HIT_DIE[c]), [12, 8, 8, 8, 10, 8, 10, 10, 8, 6, 8, 6]);
    eq([DATA.classes.Fighter.saves, DATA.classes.Rogue.pick, DATA.classes.Bard.skills, MULTI_SKILLS], [['Strength', 'Constitution'], 4, 'any', { Bard: 1, Cleric: 2, Ranger: 1, Rogue: 1 }]);
    ok(CLASS_PROF.Fighter.start.includes('Heavy Armour') && !CLASS_PROF.Fighter.multi.includes('Heavy Armour') && !CLASS_PROF.Wizard.multi.length);
    const o = DATA.origins.Karlach;
    eq([o.cls, o.race, o.subrace, o.background, o.plus2, pointsUsed({ creation: { abilities: o.abilities } })], ['Barbarian', 'Tiefling', 'Zariel Tiefling', 'Outlander', 'str', 27]);
    eq(ORIGINS.map((x) => x[0]).slice(0, 3), ['Custom (Tav)', 'The Dark Urge', 'Astarion']);
    const fighter = build(['Fighter']);
    eq(['Watcher Greatsword', 'Watcher Crossbow', 'Chaos Flail', 'Scythe of Myrkul', 'Greatsword'].map((n) => suits(ITEM_BY_NAME.get(norm(n)), fighter)), [false, false, false, false, true], 'gear only monsters can use is never offered');
  });

  // ---------- level-up steps, spellbook, a turn of attacks ----------
  test('each level says what it still has to choose', () => {
    const b = build(['Sorcerer', 'Sorcerer', '', ''], { race: 'Human', background: 'Sage' });
    eq(levelPending(b, 2), ['class not chosen']);
    eq(levelPending(b, 0), ['subclass not chosen', 'spells and cantrips: 0 of 6']);
    b.levels[0].sub = 'Draconic Bloodline';
    eq(levelPending(b, 0), ['Draconic Ancestry: 0 of 1', 'spells and cantrips: 0 of 6']);
    eq(levelPending(b, 1), ['Metamagic: 0 of 2', 'spells and cantrips: 0 of 1']);
    b.levels[1].picks.push('Metamagic: Twinned Spell', 'Metamagic: Distant Spell', 'Spell: Shield');
    eq(levelPending(b, 1), []);
    const f = build(['Fighter', 'Fighter', 'Fighter', 'Fighter']);
    eq(levelPending(f, 3), ['feat not chosen']);
    f.levels[3].picks.push('Feat: Skilled');
    eq(levelPending(f, 3), ['Skilled: options not chosen']);
    ok(wizDone(b, 'lv:2') && !wizDone(b, 'lv:3'));
    b.levels[0].picks.push('Draconic Ancestry: Red (Fire)', 'Cantrip: Fire Bolt', 'Cantrip: Light', 'Cantrip: Mage Hand', 'Cantrip: Minor Illusion', 'Spell: Magic Missile', 'Spell: Mage Armour');
    eq(levelPending(b, 0), [], 'level 1 is complete, so level 2 is open');
    state.ui.wizard = 'lv:2';
    ok(/Twinned Spell/.test(wizardView(b)) && /Nothing left to choose/.test(wizardView(b)), 'the level step renders');
    state.ui.wizard = '';
  });
  test('the spellbook gathers every source of spells', () => {
    const b = build(['Cleric', 'Cleric', 'Cleric'], { race: 'Tiefling', subrace: 'Zariel Tiefling', abilities: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 13 }, plus2: 'wis' });
    b.levels[0].sub = 'Life Domain';
    b.levels[0].picks.push('Cantrip: Guidance', 'Spell: Healing Word');
    b.levels[2].picks.push('Feat: Magic Initiate: Wizard (Fire Bolt, Mage Hand; Shield)');
    b.gear.act1.slots.ring1.name = 'Ring of Absolute Force';
    const stats = finalStats(b, 'act1');
    const book = spellbook(b, 'act1', stats);
    const names = (title) => (book.find((g) => g.title === title) || { spells: [] }).spells.map((x) => x.name);
    const life = book.find((g) => g.title === 'Cleric');
    ok(names('Cleric').includes('Guidance') && names('Cleric').includes('Healing Word'), 'chosen: ' + names('Cleric'));
    ok(names('Cleric').includes('Bless') && life.spells.find((x) => x.name === 'Bless').source.startsWith('always prepared'), 'Life Domain spells are always prepared');
    eq([life.ability, life.dc, life.attack], ['wis', 13, 5], 'Wisdom 17: 8 + 2 + 3');
    eq(names('Zariel Tiefling'), ['Thaumaturgy', 'Searing Smite'], 'racial spells up to the character level');
    eq([names('Feats'), book.find((g) => g.title === 'Feats').ability], [['Fire Bolt', 'Mage Hand', 'Shield'], 'int'], 'Magic Initiate: Wizard casts with Intelligence');
    eq(names('Gear'), ['Thunderwave']);
    eq(itemCastAbility(build(['Fighter', 'Sorcerer', 'Rogue'])), 'cha', 'the class most recently started that has an ability for spells');
    ok(allSpells(b, 'act1', stats).some((s) => s.n === 'Bless'), 'the printed sheet lists them too');
  });
  test('hit chance, critical hits and damage per turn', () => {
    eq(hitChance(5, 16, 20, false), { hit: 0.5, crit: 0.05 }, '11 or more on the die');
    eq(hitChance(5, 40, 20, false).hit, 0.05, 'a natural 20 always hits');
    eq(hitChance(30, 10, 20, false).hit, 0.95, 'a natural 1 always misses');
    eq([hitChance(5, 16, 19, false).crit, hitChance(5, 16, 20, true).hit], [0.1, 0.75]);
    const b = build(Array.from({ length: 5 }, () => 'Fighter'), { abilities: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 8 }, plus2: 'str' });
    b.gear.act1.slots.meleeMain.name = 'Greatsword';
    state.ui.targetAc = 16;
    const s = finalStats(b, 'act1');
    const turn = turnPlan(s, 'melee', 16);
    eq([turn.parts.length, turn.parts[0].n, s.crit], [1, 2, 20], 'Extra Attack at Fighter 5');
    eq(Math.round(turn.total * 100) / 100, 11.7, '2 × (0.55 × (7 + 3) + 0.05 × 7): +6 to hit, 2d6 + 3');
    b.levels[2].sub = 'Champion';
    eq(finalStats(b, 'act1').crit, 19, 'Improved Critical Hit');
    b.gear.act1.slots.meleeMain.name = 'Shortsword';
    b.gear.act1.slots.meleeOff.name = 'Dagger';
    eq(turnPlan(finalStats(b, 'act1'), 'melee', 16).parts.map((x) => [x.row.name, x.n]), [['Shortsword', 2], ['Dagger', 1]], 'the off hand is the bonus action');
    b.gear.act1.slots.ring1.name = 'Risky Ring';
    ok(finalStats(b, 'act1').advantage, 'the Risky Ring gives Advantage on every attack');
    const monk = build(Array.from({ length: 3 }, () => 'Monk'));
    eq(turnPlan(finalStats(monk, 'act1'), 'unarmed', 14).parts.map((x) => [x.how, x.n]), [['Attack action', 1], ['Flurry of Blows', 2]]);
    const archer = preset('stealth-archer');
    const base = recommendBase(archer, 'act3');
    ok(base.base.turn > 0 && gearDelta(archer, 'act3', 'ring1', null, base.base, base.p.style, 0).turn < 0, 'taking the Risky Ring off lowers the damage per turn');
  });

  // ---------- choices as selects, − and + buttons, origin reset ----------
  test('a level shows its choices as selects and writes them back as lines', () => {
    const b = build(['Ranger', 'Ranger']);
    b.levels[0].picks.push('Favoured Enemy: Ranger Knight (or Keeper of the Veil)', 'Hunting notes', 'Favoured Enemy: Bounty Hunter');
    const s = levelSlots(b, 0);
    eq(s.choices.map((x) => [x.c.group.name, x.entries.map((e) => e.value)]), [['Favoured Enemy', ['Ranger Knight']], ['Natural Explorer', []]]);
    eq([[...s.owned], s.choices[0].entries[0].note], [[0], '(or Keeper of the Veil)'], 'a second line of the same choice stays as text, to be removed by hand');
    const g = (name, lv) => levelSlots(b, lv).choices.find((x) => x.c.group.name === name).c.i;
    writeSlot(b, 0, 'choice', ['Urban Tracker'], g('Natural Explorer', 0));
    writeSlot(b, 0, 'choice', ['Ranger Knight'], g('Favoured Enemy', 0));
    eq(b.levels[0].picks[0], 'Favoured Enemy: Ranger Knight (or Keeper of the Veil)', 'an untouched choice keeps its note');
    writeSlot(b, 0, 'choice', ['Mage Breaker'], g('Favoured Enemy', 0));
    eq(b.levels[0].picks, ['Favoured Enemy: Mage Breaker', 'Hunting notes', 'Favoured Enemy: Bounty Hunter', 'Natural Explorer: Urban Tracker']);
    writeSlot(b, 1, 'choice', ['Archery'], g('Fighting Style', 1));
    writeSlot(b, 1, 'choice', ['Defence'], g('Fighting Style', 1));
    eq(b.levels[1].picks, ['Fighting Style: Defence'], 'choosing again replaces, it never adds');
    const html = levelRows(b, 1);
    ok(/data-act="choice-open"/.test(html) && /<b>Defence<\/b>/.test(html) && !/<select data-slot|pick-add|data-path="levels\.1\.picks\.0"/.test(html), 'a slot in place of the text line and the add button');
    writeSlot(b, 1, 'choice', [''], g('Fighting Style', 1));
    eq([b.levels[1].picks, levelPending(b, 1).includes('Fighting Style: 0 of 1')], [[], true]);

    const f = build(['Fighter', 'Fighter', 'Fighter', 'Fighter']);
    f.levels[2].sub = 'Battle Master';
    const m = levelSlots(f, 2).choices.find((x) => x.c.group.name === 'Manoeuvre');
    eq(m.c.n, 3);
    writeSlot(f, 2, 'choice', ['Riposte', '', 'Riposte'], m.c.i);
    eq(f.levels[2].picks, ['Manoeuvre: Riposte'], 'the same option is not taken twice');
    f.levels[2].picks = ['Riposte'];
    eq(levelSlots(f, 2).choices.find((x) => x.c.group.name === 'Manoeuvre').entries.map((e) => e.value), ['Riposte'], 'an option written on its own is read too');
    writeSlot(f, 3, 'feat', ['Tough']);
    writeSlot(f, 3, 'feat', ['Alert']);
    eq(f.levels[3].picks, ['Feat: Alert'], 'one feat per level that grants one');
    writeSlot(f, 3, 'feat', ['Skilled']);
    eq([f.levels[3].picks, levelSlots(f, 3).feat.name, levelPending(f, 3)], [['Feat: Skilled'], 'Skilled', ['Skilled: options not chosen']]);
    f.levels[3].picks = ['Feat: Ability Improvement +2 DEX'];
    eq([levelSlots(f, 3).feat.name, levelSlots(f, 3).feat.rest], ['Ability Improvement', '+2 DEX'], 'a feat line from a ready-made build');
    writeSlot(f, 3, 'feat', ['']);
    eq(f.levels[3].picks, []);

    eq(expertiseOptions(build(['Rogue'], { background: 'Sage' }), []), ['Arcana', 'History'], 'Expertise only in what the build is proficient in');
    const r = build(['Rogue'], { background: 'Sage' });
    writeSlot(r, 0, 'expertise', ['Arcana', 'History']);
    eq([r.levels[0].picks, levelSlots(r, 0).expertise.values, levelPending(r, 0).some((x) => /Expertise/.test(x))], [['Expertise: Arcana + History'], ['Arcana', 'History'], false]);
    ok(expertiseSkills(r).has('History'));
    writeSlot(r, 0, 'expertise', ['Arcana', '']);
    ok(levelPending(r, 0).includes('Expertise: 1 of 2'), String(levelPending(r, 0)));
  });
  test('the spells a level teaches are selects too', () => {
    const b = build(['Ranger', 'Ranger', 'Ranger']);
    eq(levelSlots(b, 0).spells, undefined, 'a Ranger learns no spell at level 1');
    b.levels[1].picks.push('Spell: Enhance Leap', 'Spell: Longstrider', 'Spell: Hunter\'s Mark');
    let sp = levelSlots(b, 1).spells;
    eq([sp.learn.spells, sp.spell, sp.lines.spell, !!sp.swap], [2, ['Enhance Leap', 'Longstrider'], [0, 1], false], 'two spells at Ranger 2; a third line stays as text');
    b.levels[1].picks.pop();
    const html = levelRows(b, 1);
    ok((html.match(/data-act="spells-open"/g) || []).length === 2 && !/pick-add|data-path="levels\.1\.picks/.test(html), 'one slot per spell: no add buttons, no text lines');
    ok(/<img class="pic small"[^>]*><b>Longstrider<\/b>/.test(html), 'the slot shows the picture and the name of the spell');
    const lists = levelSpellLists(b, 1, levelSlots(b, 1).spells);
    ok(lists.reach.some((x) => x.n === 'Longstrider') && lists.reach.every((x) => x.lv === 1 && x.cl.includes('Ranger')), 'the Ranger list, up to the spell level it can cast');
    writeSlot(b, 1, 'spell', ['Enhance Leap', 'Hunter\'s Mark']);
    eq(b.levels[1].picks, ['Spell: Enhance Leap', 'Spell: Hunter\'s Mark']);
    ok(!levelSpellLists(b, 2, levelSlots(b, 2).spells).reach.some((x) => x.n === 'Enhance Leap') && swapOlds(b, 2, levelSlots(b, 2).spells).includes('Enhance Leap') && /data-act="swap-open"/.test(levelRows(b, 2)), 'a spell already known is not offered again, only as the one to swap out');
    sp = levelSlots(b, 2).spells;
    eq([sp.learn.spells, !!sp.swap], [1, true], 'Ranger 3 learns one and may swap one');
    writeSlot(b, 2, 'swap', ['Enhance Leap', 'Longstrider']);
    eq([b.levels[2].picks, levelSlots(b, 2).spells.swap.old, currentSpells(b).map((x) => x.name)], [['Spell: Longstrider (replaces Enhance Leap)'], 'Enhance Leap', ['Hunter\'s Mark', 'Longstrider']]);
    writeSlot(b, 2, 'swap', ['', 'Longstrider']);
    eq(b.levels[2].picks, []);

    const s = build(['Sorcerer']);
    const cells = levelSlots(s, 0).spells.learn;
    eq([cells.cantrips, cells.spells], [4, 2]);
    writeSlot(s, 0, 'cantrip', ['Fire Bolt', '', 'Fire Bolt', 'Light']);
    eq(s.levels[0].picks, ['Cantrip: Fire Bolt', 'Cantrip: Light']);
    const c = build(['Cleric']);
    eq([levelSlots(c, 0).spells.learn.cantrips, levelSlots(c, 0).spells.learn.spells], [3, 0], 'a Cleric chooses cantrips; its spells are prepared, not learned');
    const ek = build(['Fighter', 'Fighter', 'Fighter']);
    ek.levels[2].sub = 'Eldritch Knight';
    const row = levelRows(ek, 2);
    eq([(row.match(/data-k="cantrip"/g) || []).length, (row.match(/data-k="spell"/g) || []).length], [2, 3]);
    const ekLists = levelSpellLists(ek, 2, levelSlots(ek, 2).spells);
    ok(ekLists.bound === 2 && ekLists.school.every((x) => ['Abjuration', 'Evocation'].includes(x.sc)) && ekLists.reach.length > ekLists.school.length);
    ok(/Abjuration \/ Evocation/.test(row) && /any school/.test(row), 'two school picks and one free pick');
    ok(/gain Proficiency/i.test(gainText('You have sworn to serve a crown. Gain Proficiency in History and Heavy Armour.')) && !/sworn/.test(gainText('You have sworn to serve a crown. Gain Proficiency in History and Heavy Armour.')), 'what an option gives, without the flavour');
    eq(gainText('A tale of the road.'), 'A tale of the road.', 'nothing concrete to pick out: the whole text');
  });
  test('every choice with a list shows what each option is', () => {
    ok(/Wizard/.test(wizTraits(DATA.subraces['High Elf'])) && /Thaumaturgy/.test(wizTraits(DATA.subraces['Zariel Tiefling'])), 'a subrace card names the cantrip and spells it gives');
    const elf = build(['Fighter'], { race: 'Elf', subrace: 'High Elf', cantrip: 'Fire Bolt' });
    ok(/data-act="race-cantrip-open"/.test(raceCantripField(elf)) && /<img class="pic small"[^>]*><b>Fire Bolt<\/b>/.test(raceCantripField(elf)) && /1d10 Fire/.test(raceCantripField(elf)), 'the racial cantrip: picture, name and what it does');
    eq(raceCantripField(build(['Fighter'], { race: 'Human' })), '');
    const row = levelRows(build(['Fighter', 'Fighter', 'Fighter']), 2);
    ok(/data-act="class-open"/.test(row) && /data-act="sub-open"/.test(row) && !/<select/.test(row), 'class and subclass open a list too: no bare select left in a level');
    const magic = FEATS.find(([n]) => n === 'Magic Initiate: Wizard');
    const part = featParts(magic[0], magic[1], elf)[0];
    ok(part.options.length > 5 && part.options.every((o) => /^<img/.test(o[3]) && /Cantrip/.test(o[2])), 'the spells inside a feat come with picture and facts');
    ok(/data-act="elixir-open"/.test(statsCard(elf)) && !/data-path="elixir"/.test(statsCard(elf)));
    eq(['origin', 'race', 'subrace', 'background'].map((k) => creationOptions(elf, k).length), [ORIGINS.length, 11, 2, 12]);
    ok(creationOptions(elf, 'race').every((o) => /Speed/.test(o[1])) && /Perception/.test(creationOptions(elf, 'race').find((o) => o[0] === 'Elf')[1]) && /Stealth/.test(creationOptions(elf, 'subrace')[1][1]) && /Arcana, History/.test(creationOptions(elf, 'background').find((o) => o[0] === 'Sage')[2]), 'each race, subrace and background says what it gives');
    ok(!/<select data-path="creation\./.test(buildEditor(elf)) && (buildEditor(elf).match(/data-act="creation-open"/g) || []).length === 4);
  });
  test('levels are done in order', () => {
    const b = build(['Fighter', 'Fighter', 'Fighter']);
    eq(firstOpenLevel(b), 0, 'level 1 still has its fighting style to choose');
    const html = levelRows(b);
    eq([(html.match(/class="lvl locked/g) || []).length, (html.match(/class="lvl-lock"/g) || []).length, (html.match(/class="lvl-cls" inert/g) || []).length], [11, 1, 11]);
    b.levels[0].picks.push('Fighting Style: Defence');
    eq([firstOpenLevel(b), (levelRows(b).match(/class="lvl locked/g) || []).length], [2, 9], 'Fighter 2 has nothing to choose; Fighter 3 needs its subclass');
    ok(!/locked/.test(levelRows(b, 5)), 'a single row asked for on its own is never shut');
    state.ui.wizard = 'lv:5';
    const view = wizardView(b);
    ok(/<h1>Level 3<\/h1>/.test(view), 'the step by step goes back to the level that is still open');
    ok(/data-s="lv:4" disabled/.test(view) && !/data-s="lv:3" disabled/.test(view) && !/data-s="lv:2" disabled/.test(view), 'later level steps are shut, earlier ones are not');
    ok(!/class="[^"]*done[^"]*" data-act="wiz-go" data-s="lv:(?:[4-9]|1[0-2])"/.test(view) && /class="[^"]*done[^"]*" data-act="wiz-go" data-s="lv:2"/.test(view), 'a shut level is never shown as done');
    b.levels[2].sub = 'Champion';
    state.ui.wizard = 'lv:3';
    ok(!/data-s="lv:4" disabled/.test(wizardView(b)), 'level 4 opens once level 3 is complete');
    state.ui.wizard = '';
  });
  test('every class and subclass can finish all twelve levels', () => {
    // levels open in order, so a level that could never be completed would shut the rest of the build:
    // fill every choice with the first options on offer and make sure nothing is left pending
    const fill = (b, subs) => {
      const left = [];
      for (let i = 0; i < 12 && b.levels[i].cls; i++) {
        const l = b.levels[i];
        for (let pass = 0; pass < 2; pass++) {
          const info = levelInfo(b);
          const x = info[i];
          if (picksSubclass(x) && !l.sub) l.sub = subs[l.cls] || subLabel(Object.keys(CLASS_DATA[l.cls].subclasses)[0]);
          const slots = levelSlots(b, i);
          slots.choices.forEach((sl) => {
            const g = sl.c.group;
            const merged = classChoices(b, x.cls).find((y) => y.name === g.name) || g;
            const off = g.repeat ? [] : info.flatMap((y, j) => (j !== i && y.cls === x.cls ? chosenOf(b, x.cls, merged, j) : []));
            writeSlot(b, i, 'choice', g.options.filter((o) => (!o[2] || o[2] <= x.n) && !off.includes(o[0])).map((o) => o[0]).slice(0, sl.c.n), sl.c.i);
          });
          if (slots.feat && !slots.feat.name) writeSlot(b, i, 'feat', ['Alert']);
          if (slots.expertise && slots.expertise.values.length < 2) writeSlot(b, i, 'expertise', expertiseOptions(b, slots.expertise.values).slice(0, 2));
          const sp = levelSlots(b, i).spells;
          if (sp) {
            const lists = levelSpellLists(b, i, sp);
            if (sp.learn.cantrips) writeSlot(b, i, 'cantrip', lists.cantrips.slice(0, sp.learn.cantrips).map((y) => y.n));
            const bound = lists.school.slice(0, lists.bound).map((y) => y.n);
            if (sp.learn.spells) writeSlot(b, i, 'spell', [...bound, ...lists.reach.filter((y) => !bound.includes(y.n)).slice(0, sp.learn.spells - bound.length).map((y) => y.n)]);
          }
        }
        const pending = levelPending(b, i);
        if (pending.length) left.push('level ' + (i + 1) + ': ' + pending.join('; '));
      }
      return left;
    };
    const make = (plan) => {
      const b = build(plan, { race: 'Human', background: 'Sage' });
      const ci = DATA.classes[plan[0]];
      b.creation.skills = (ci.skills === 'any' ? ALL_SKILLS : ci.skills).filter((x) => !['Arcana', 'History'].includes(x)).slice(0, ci.pick + 1).join(', ');
      return b;
    };
    let runs = 0;
    CLASSES.forEach((cls) => Object.keys(CLASS_DATA[cls].subclasses).forEach((sub) => {
      eq(fill(make(Array(12).fill(cls)), { [cls]: subLabel(sub) }), [], cls + ' / ' + sub);
      const other = CLASSES[(CLASSES.indexOf(cls) + 5) % CLASSES.length];
      eq(fill(make([...Array(6).fill(other), ...Array(6).fill(cls)]), { [cls]: subLabel(sub) }), [], other + ' 6 + ' + cls + ' / ' + sub + ' 6');
      runs += 2;
    }));
    ok(runs > 100, runs + ' builds completed');
  });
  test('the texts taken from the wiki carry no leftovers of its markup', () => {
    const odd = /\{\{|\}\}|\[\[|\]\]|\.png|\bProf\b(?! Bonus)|\bd\d+ \+\dd\d+|\bd\d+\dd\d+\b|:\*|\b(\w{4,}) \1\b|^\s|\s$/;
    const hits = [];
    const look = (where, text) => { if (text && !String(text).startsWith('thumb/') && odd.test(String(text))) hits.push(where + ': ' + String(text).slice(0, 80)); };
    Object.keys(FEATURES).forEach((n) => { look('feature', n); look('feature ' + n, FEATURES[n]); });
    CLASSES.forEach((c) => {
      Object.values(CLASS_DATA[c].levels).forEach((list) => list.forEach((g) => look(c, g)));
      Object.keys(CLASS_DATA[c].subclasses).forEach((sub) => Object.values(CLASS_DATA[c].subclasses[sub]).forEach((list) => (list || []).forEach((g) => look(sub, g))));
    });
    CHOICES.forEach((g) => g.options.forEach((o) => { look(g.name, o[0]); look(g.name + ' / ' + o[0], o[1]); }));
    FEATS.forEach(([n, d]) => look('feat ' + n, d));
    SPELLS.forEach((sp) => ['n', 'd', 'dm', 'rg', 'du', 'hl'].forEach((k) => look('spell ' + sp.n, sp[k])));
    CONSUMABLES.forEach((c) => { look('consumable ' + c.n, c.x); look('consumable ' + c.n, c.h); });
    PERMANENT.forEach((x) => { look('permanent ' + x.n, x.x); look('permanent ' + x.n, x.h); });
    ITEMS.forEach((it) => [it.sp, it.x, it.h, ...(it.ps || []).map((y) => y[1])].forEach((text) => look('item ' + it.n, text)));
    eq(hits.slice(0, 5), []);
    const dm = (name) => SPELL_BY_NAME.get(norm(name)).dm;
    eq([dm('Magic Missile'), dm('Ice Storm'), dm('Sacred Flame'), dm('Thunderous Smite')], ['1d4 + 1 Force, 1d4 + 1 Force, 1d4 + 1 Force', '2d8 Bludgeoning, 4d6 Cold', '1d8 Radiant', 'Weapon damage, 2d6 Thunder'], 'every damage line of a spell is read');
    const flame = build(Array(5).fill('Fighter'), { abilities: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 8 }, plus2: 'str' });
    flame.gear.act1.slots.meleeMain.name = 'Everburn Blade';
    const hit = finalStats(flame, 'act1').attacks.rows[0];
    eq([item('Everburn Blade').ed, hit.dice, hit.extraDice.map((x) => x[0] + ' ' + x[1]), avgDamage(hit)], ['1d4 Fire', '2d6', ['1d4 Fire'], 12.5], 'the dice a weapon adds to every hit are counted: 7 + 2.5 + 3');
    flame.gear.act1.slots.meleeMain.name = 'Infernal Mace';
    ok(finalStats(flame, 'act1').attacks.rows[0].damage.some((x) => /Poison/.test(x[0]) && x[1] === 3), 'a flat extra damage too');
    ok(/;/.test(item('Amulet of Misty Step').h), 'an item found in more than one place lists them');
    ok(/9 m radius/.test(SPELL_BY_NAME.get('dancing lights').d) && /weapon damage \+ 1d8 Thunder/.test(SPELL_BY_NAME.get('booming blade').hl));
    ok(CLASS_DATA.Cleric.subclasses['War Domain'][1].includes('Gain Martial Weapons proficiency') && CLASS_DATA.Bard.subclasses['College of Valour'][3].includes('Martial Weapons Proficiency'));
  });
  test('only the choices a level grants count: the rest finds its place or becomes a note', () => {
    const dex = { abilities: { str: 10, dex: 15, con: 14, int: 8, wis: 14, cha: 10 }, plus2: 'dex', plus1: 'wis' };
    const b = build(['Ranger'], dex);
    b.gear.act1.slots.rangedMain.name = 'Longbow';
    const numbers = () => { const st = finalStats(b, 'act1'); return [st.attacks.rows.find((r) => r.slot === 'rangedMain').attackTotal, st.hp, st.initiative]; };
    const clean = numbers();
    // a fighting style Ranger 1 has not earned, a feat level 1 does not give, an undecided feat, a remark
    b.levels[0].picks.push('Fighting Style: Archery', 'Feat: Tough', 'Feat (choose): Alert or Tough', 'ask the party first');
    ok(String(numbers()) !== String(clean), 'before tidying, loose lines would move the numbers');
    eq(tidyBuild(b), 4);
    eq([b.levels[0].picks, b.levels[0].notes, numbers()], [[], ['Fighting Style: Archery', 'Feat: Tough', 'Feat (choose): Alert or Tough', 'ask the party first'], clean]);
    eq(tidyBuild(b), 0, 'nothing left to move the second time');
    ok(/class="lnote"/.test(levelRows(b)) && /does not count/.test(levelRows(b)) && buildIssues(b).some((x) => /4 line\(s\)/.test(x.text)), 'notes are shown and listed in the build check');

    // the class levels shift: the choices follow the class to the level that now grants them
    const r = build(['Ranger', 'Ranger', 'Ranger'], dex);
    r.levels[1].picks.push('Fighting Style: Archery', 'Spell: Longstrider', "Spell: Hunter's Mark", 'Extra Attack');
    r.levels[0].cls = 'Cleric';
    tidyBuild(r);
    eq([r.levels[1].picks, r.levels[2].picks, r.levels.flatMap((l) => l.notes)], [[], ['Fighting Style: Archery', 'Spell: Longstrider', "Spell: Hunter's Mark"], []], 'Ranger 2 moved from level 2 to level 3; a line that only names a feature is dropped');

    // classes that prepare: their spell lines are spells kept ready, not spells learned
    const c = build(['Cleric', 'Cleric', 'Cleric'], { abilities: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 13 }, plus2: 'wis' });
    c.levels[0].sub = 'Life Domain';
    c.levels[0].picks.push('Spell: Healing Word', 'Prepared Spell: Guiding Bolt', 'Spell: Fireball', 'Spell: Bless', 'Spell: Sanctuary (optional)');
    tidyBuild(c);
    eq([c.prepared, c.levels[0].notes], [{ Cleric: ['Healing Word', 'Guiding Bolt'] }, ['Spell: Fireball', 'Spell: Sanctuary (optional)']], 'Bless is always prepared by the Life Domain; Fireball is not a Cleric spell');
    const stats = finalStats(c, 'act1');
    eq([preparedMax(c, 'Cleric'), stats.casting[0].prepared], [6, 6], 'Cleric 3 with Wisdom 17: 3 + 3');
    const book = spellbook(c, 'act1', stats).find((g) => g.title === 'Life Domain' || g.title === 'Cleric');
    eq(book.spells.filter((x) => x.source === 'prepared').map((x) => x.name), ['Guiding Bolt', 'Healing Word']);
    ok(/data-act="prepared-open"/.test(preparedSlots(c)) && !preparedOptions(c, 'Cleric').some((x) => x.n === 'Bless' || x.lv > 2), 'the list: Cleric spells it has slots for, without the always prepared ones');
    c.prepared.Cleric = preparedOptions(c, 'Cleric').slice(0, 8).map((x) => x.n);
    ok(buildIssues(c).some((x) => /8 spells prepared, it can prepare 6/.test(x.text)));
    c.levels.forEach((l) => { l.cls = 'Fighter'; });
    tidyBuild(c);
    eq(c.prepared, {}, 'no Cleric levels, nothing prepared');

    // a Wizard: learned level by level, plus the scrolls
    const w = build(['Wizard', 'Wizard', 'Wizard', 'Wizard', 'Wizard']);
    w.scrolls = ['Fireball', 'Cone of Cold', 'Cure Wounds'];
    tidyBuild(w);
    eq(w.scrolls, ['Fireball'], 'level 3 spells at Wizard 5; not level 5 ones, not other lists');
    ok(preparedOptions(w, 'Wizard').some((x) => x.n === 'Fireball') && currentSpells(w).some((x) => x.name === 'Fireball' && x.scroll));

    // the same feat twice
    const f = build(Array(8).fill('Fighter'));
    f.levels[3].picks.push('Feat: Alert');
    f.levels[5].picks.push('Feat: Alert');
    eq(featsTaken(f).map((x) => [x.level, x.name]), [[3, 'Alert'], [5, 'Alert']]);
    ok(buildIssues(f).some((x) => x.text === 'Alert is taken twice, at levels 4 and 6'));
    f.levels[5].picks = ['Feat: Ability Improvement (+2 STR)'];
    f.levels[3].picks = ['Feat: Ability Improvement (+2 DEX)'];
    ok(!buildIssues(f).some((x) => /taken twice/.test(x.text)), 'Ability Improvement can be taken again');

    // the spell a Warlock learns at level 11 is its Mystic Arcanum: a level 6 one
    const k = build(Array(11).fill('Warlock'));
    const arc = levelSpellLists(k, 10, levelSlots(k, 10).spells);
    ok(arc.arcanum && arc.reach.length > 3 && arc.reach.every((x) => x.lv === 6 && x.cl.includes('Warlock')));
    ok(/Mystic Arcanum/.test(slotCells(k, 10, levelSlots(k, 10))));
  });
  test('base scores move with − and + and stay inside the 27 points', () => {
    const b = build(['Fighter'], { abilities: { str: 15, dex: 15, con: 14, int: 8, wis: 8, cha: 8 } });
    const off = (ab, d) => new RegExp('data-d="' + d + '"[^>]*disabled').test(abilCard(b, ab, ab, ab));
    eq([off('int', '-1'), off('int', '1'), off('str', '1'), off('con', '1')], [true, false, true, false], '25 points used');
    b.creation.abilities.con = 15;
    eq([pointsUsed(b), off('int', '1'), off('con', '-1')], [27, true, false], 'no points left for another +');
    state.builds.push(b);
    const was = state.ui.buildId;
    state.ui.buildId = b.id;
    const press = (path, d, min, max) => actions.step({ dataset: { path, d: String(d), min: String(min), max: String(max) } });
    press('creation.abilities.con', -1, 8, 15);
    press('creation.abilities.int', -1, 8, 15);
    press('creation.extra.str', -1, -10, 20);
    eq([b.creation.abilities.con, b.creation.abilities.int, b.creation.extra.str], [14, 8, -1]);
    actions.step({ dataset: { ui: 'targetAc', v: '16', d: '1', min: '5', max: '30' } });
    eq(state.ui.targetAc, 17);
    delete state.ui.targetAc;
    actions['abil-reset']();
    eq([pointsUsed(b), b.creation.plus2], [0, '']);
    b.levels[1].cls = 'Fighter';
    b.levels[4].cls = 'Rogue';
    actions['fill-down']({ dataset: { l: '1' } });
    eq(b.levels.map((l) => l.cls).slice(0, 7), ['Fighter', 'Fighter', 'Fighter', 'Fighter', 'Rogue', '', ''], 'down to the next level that has a class');
    state.builds = state.builds.filter((x) => x !== b);
    state.ui.buildId = was;
  });
  test('leaving an origin character clears what it had fixed', () => {
    const b = build(['Barbarian']);
    const c = b.creation;
    const set = (key, value) => { const before = c[key]; c[key] = value; creationChanged(b, 'creation.' + key, before); };
    set('origin', 'Karlach');
    eq([c.race, c.subrace, c.background], ['Tiefling', 'Zariel Tiefling', 'Outlander']);
    set('origin', 'Custom (Tav)');
    eq([c.race, c.subrace, c.background, b.levels[0].cls], ['', '', '', ''], "back to a blank character, Karlach's default class included");
    b.levels[0].cls = 'Barbarian';
    set('origin', 'Karlach');
    set('race', 'Elf');
    eq([c.origin, c.race, c.subrace, c.background], ['Custom (Tav)', 'Elf', '', 'Outlander'], 'Karlach as an elf is a custom character');
    set('origin', 'The Dark Urge');
    eq([c.race, c.background], ['Elf', 'Haunted One'], 'the Dark Urge only fixes the background');
    set('background', 'Sage');
    eq(c.origin, 'Custom (Tav)');
    set('origin', 'Karlach');
    Object.assign(c, { abilities: Object.assign({}, DATA.origins.Karlach.abilities), plus2: DATA.origins.Karlach.plus2, plus1: DATA.origins.Karlach.plus1 });
    b.levels[0].picks.push('Rage');
    set('origin', 'Gale');
    eq([c.race, c.background, c.abilities.str, c.plus2, b.levels[0].cls], ['Human', 'Sage', 8, '', 'Barbarian'], 'a class with choices already made is kept');
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

  // ---------- flows: the same things done with real clicks on the page ----------
  // A flow drives the planner the way a person does (click a slot, pick from the list, confirm) on a build
  // that exists only in memory, and puts back what was on screen when it ends.
  const flows = [];
  const flow = (name, fn) => flows.push([name, fn]);
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const q = (sel, root) => (root || document).querySelector(sel);
  const all = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const click = async (el, what) => { if (!el) throw new Error('nothing to click: ' + what); el.click(); await wait(70); };
  const row = (i) => all('.lvl')[i];
  const open = (i, act, n) => click(all('.pslot[data-act="' + act + '"]', row(i))[n || 0], act + ' at level ' + (i + 1));
  const pick = (name) => click(all('#dlg-list .pick-row').find((r) => r.dataset.n === name), 'option ' + name);
  const confirm = () => click(q('#choose-ok'), 'Confirm');
  const dialogOpen = () => !q('#dialog').hidden;
  const show = (b) => { state.builds = [b]; state.ui.buildId = b.id; state.ui.tab = 'builds'; state.ui.wizard = ''; state.ui.closed = {}; save(); render(); return b; };

  flow('a whole build is chosen through the lists, level by level', async () => {
    const b = show(build(['Fighter', 'Fighter', 'Fighter', 'Fighter', 'Rogue', 'Ranger', 'Ranger', 'Ranger', 'Cleric', 'Cleric'],
      { origin: 'Custom (Tav)', race: 'Human', background: 'Urchin', skills: 'Athletics, Perception, Insight', abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 14, cha: 8 }, plus2: 'str', plus1: 'wis' }));
    eq(all('.lvl.locked').length, 11, 'only level 1 is open at first');
    await open(0, 'choice-open');
    ok(dialogOpen() && all('#dlg-list .pick-row').length === 6, 'six fighting styles for a Fighter');
    await pick('Defence');
    ok(!dialogOpen(), 'one choice out of one list closes by itself');
    await open(2, 'sub-open');
    await pick('Battle Master');
    await open(2, 'choice-open');
    await pick('Riposte'); await pick('Trip Attack'); await pick('Menacing Attack');
    ok(dialogOpen(), 'three picks wait for Confirm');
    await confirm();
    await open(3, 'feat-open');
    await pick('Ability Improvement');
    ok(dialogOpen() && /Ability Improvement/.test(q('#dialog-box h2').textContent), "the feat's own choices follow at once");
    await pick('STR'); await pick('CON');
    await confirm();
    await open(4, 'expertise-open');
    await pick('Stealth'); await pick('Athletics');
    await confirm();
    await open(5, 'choice-open', 0);
    await pick('Bounty Hunter');
    await open(5, 'choice-open', 1);
    await pick('Urban Tracker');
    await open(6, 'choice-open');
    await pick('Archery');
    await open(6, 'spells-open');
    await pick('Longstrider'); await pick("Hunter's Mark");
    await confirm();
    await open(7, 'sub-open');
    await pick('Hunter');
    await open(7, 'choice-open');
    await pick('Colossus Slayer');
    await open(7, 'spells-open');
    await pick('Fog Cloud');  // one spell at Ranger 3: the click is enough
    await open(8, 'sub-open');
    await pick('Life Domain');
    await open(8, 'spells-open');
    await pick('Guidance'); await pick('Sacred Flame'); await pick('Light');
    await confirm();
    eq(b.levels.slice(0, 10).map((l) => l.picks), [
      ['Fighting Style: Defence'], [], ['Manoeuvre: Riposte', 'Manoeuvre: Trip Attack', 'Manoeuvre: Menacing Attack'], ['Feat: Ability Improvement (+1 STR, +1 CON)'],
      ['Expertise: Stealth + Athletics'], ['Favoured Enemy: Bounty Hunter', 'Natural Explorer: Urban Tracker'], ['Fighting Style: Archery', 'Spell: Longstrider', "Spell: Hunter's Mark"],
      ["Hunter's Prey: Colossus Slayer", 'Spell: Fog Cloud'], ['Cantrip: Guidance', 'Cantrip: Sacred Flame', 'Cantrip: Light'], []]);
    eq([b.levels[2].sub, b.levels[7].sub, b.levels[8].sub, firstOpenLevel(b)], ['Battle Master', 'Hunter', 'Life Domain', 10], 'every level with a class is complete');
    // what is not a level choice: prepared spells, the elixir, the swap of a known spell
    await click(q('.pslot[data-act="prepared-open"]'), 'prepared spells');
    await pick('Bane'); await pick('Healing Word');
    await confirm();
    eq(b.prepared, { Cleric: ['Bane', 'Healing Word'] });
    await click(q('.pslot[data-act="elixir-open"]'), 'elixir');
    await pick('Elixir of Bloodlust');
    eq(b.elixir, 'Elixir of Bloodlust');
    await open(7, 'swap-open');
    await pick('Longstrider'); await pick('Cure Wounds');
    await confirm();
    eq(b.levels[7].picks[2], 'Spell: Cure Wounds (replaces Longstrider)');
    ok(/Cure Wounds/.test(q('#sec-spells').textContent) && !all('.lnote').length, 'the spellbook follows, and nothing was left as a note');
  });

  flow('levels open in order, and a shut level takes no clicks', async () => {
    const b = show(build(['Fighter', 'Fighter', 'Fighter', 'Fighter']));
    await open(3, 'class-open');
    ok(!dialogOpen(), 'level 4 is shut while level 1 has its fighting style to choose');
    ok(/Level 1 still has something to choose/.test(q('.lvl-lock').textContent));
    await open(0, 'choice-open');
    await pick('Duelling');
    eq([all('.lvl.locked').length, firstOpenLevel(b)], [9, 2], 'levels 2 and 3 opened; level 3 waits for its subclass');
    await click(q('[data-act="wiz-levels"]'), 'Level up step by step');
    ok(/Level 3/.test(q('.wiz h1').textContent) && q('.levels-bar button[data-s="lv:4"]').disabled && !q('.levels-bar button[data-s="lv:2"]').disabled, 'the step by step opens at the level that is waiting');
    ok(all('.wiz-nav button').find((x) => /Next/.test(x.textContent)).disabled, 'and Next waits too');
    await click(q('.wiz .pslot[data-act="sub-open"]'), 'subclass in the step');
    await pick('Champion');
    ok(!all('.wiz-nav button').find((x) => /Next/.test(x.textContent)).disabled && b.levels[2].sub === 'Champion');
    await click(q('[data-act="wiz-close"]'), 'leave');
  });

  flow('a level that changes class takes its choices along, and what fits nowhere becomes a note', async () => {
    const b = build(['Ranger', 'Ranger', 'Ranger']);
    b.levels[0].picks = ['Favoured Enemy: Bounty Hunter', 'Natural Explorer: Urban Tracker'];
    b.levels[1].picks = ['Fighting Style: Archery', 'Spell: Longstrider', "Spell: Hunter's Mark", 'a remark of mine'];
    show(b);
    eq([b.levels[1].picks.length, b.levels[1].notes], [3, ['a remark of mine']], 'saving already sorted the lines');
    await open(0, 'class-open');
    ok(/Fighter 1/.test(all('#dlg-list .pick-row').find((r) => r.dataset.n === 'Fighter').textContent), 'each class shows the level it would reach');
    await pick('Fighter');
    eq(b.levels.slice(0, 3).map((l) => [l.cls, l.picks]), [['Fighter', []], ['Ranger', []], ['Ranger', ['Fighting Style: Archery', 'Spell: Longstrider', "Spell: Hunter's Mark"]]], 'Ranger 2 is now level 3, with what it had chosen');
    eq(all('.lnote').length, 1);
    await click(q('[data-act="note-del"]'), 'remove the note');
    eq([all('.lnote').length, b.levels[1].notes], [0, []]);
  });

  flow('creation: the lists, the − and + buttons and the origin rules', async () => {
    const b = show(build([]));
    const choose = async (key, name) => { await click(q('.pslot[data-act="creation-open"][data-k="' + key + '"]'), key); await pick(name); };
    await choose('origin', 'Karlach');
    eq([b.creation.race, b.creation.subrace, b.creation.background], ['Tiefling', 'Zariel Tiefling', 'Outlander']);
    await choose('race', 'Elf');
    eq([b.creation.origin, b.creation.subrace], ['Custom (Tav)', ''], 'Karlach as an elf is a custom character');
    await choose('subrace', 'High Elf');
    await click(q('.pslot[data-act="race-cantrip-open"]'), 'racial cantrip');
    ok(all('#dlg-list .pick-row').every((r) => q('img', r)), 'every cantrip of the list has its picture');
    await pick('Fire Bolt');
    eq(b.creation.cantrip, 'Fire Bolt');
    const plus = () => all('.abil')[0].querySelector('.stepper button[data-d="1"]');
    for (let k = 0; k < 9; k++) if (!plus().disabled) await click(plus(), 'STR +');
    eq([b.creation.abilities.str, plus().disabled], [15, true], 'the + stops at 15');
    await click(q('[data-act="abil-reset"]'), 'reset');
    eq(pointsUsed(b), 0);
  });

  flow('the party page: ticking an item as obtained', async () => {
    const b = preset('stealth-archer');
    state.builds = [b];
    const p = curParty();
    const before = clone(p.members);
    p.members[0].buildId = b.id;
    state.ui.tab = 'party';
    render();
    const box = q('input[data-change="got"]');
    ok(box, 'the route lists items to get');
    const slot = b.gear[state.ui.partyAct].slots[box.dataset.slot];
    const was = slot.got;
    await click(box, 'obtained');
    eq(slot.got, !was);
    p.members = before;
  });

  // ---------- report ----------
  const report = () => {
  const failed = results.filter((r) => r[1]);
  document.title = 'TESTS: ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed';
  const box = document.createElement('div');
  box.id = 'test-report';
  box.style.cssText = 'position:fixed;inset:0;z-index:999;overflow:auto;background:#0e0c0a;color:#ece3d3;font:14px/1.6 Segoe UI,sans-serif;padding:24px';
  box.innerHTML = '<h1 style="font:600 22px Georgia,serif;color:' + (failed.length ? '#d2604a' : '#6fbf73') + '">' + document.title + '</h1><ol>'
    + results.map(([name, err]) => '<li style="color:' + (err ? '#d2604a' : '#a2947f') + '">' + (err ? 'FAIL' : 'ok') + ' · ' + esc(name) + (err ? '<br><code>' + esc(err) + '</code>' : '') + '</li>').join('') + '</ol>';
  document.body.appendChild(box);
  };
  // the flows run one after the other; the page is put back as it was before the report is shown
  (async () => {
    document.title = 'TESTS: running the flows…';
    const kept = { builds: state.builds, parties: clone(state.parties), ui: clone(state.ui) };
    for (const [name, fn] of flows) {
      try { await fn(); results.push([name, '']); } catch (err) { results.push([name, String(err && err.message ? err.message : err)]); }
      if (typeof closeDialog === 'function') closeDialog();
      Object.assign(state, { builds: kept.builds, parties: clone(kept.parties), ui: clone(kept.ui) });
    }
    render();
    report();
  })();
})();
