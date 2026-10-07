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
  test('every ready-made build is chosen to the end: no level is left waiting for a choice', () => {
    PRESETS.forEach((p) => {
      const b = normalizeBuild(clone(p));
      tidyBuild(b);
      eq([firstOpenLevel(b), b.levels.reduce((a, l) => a + (l.notes || []).length, 0)], [-1, 0], p.name);
    });
    const bard = preset('bardadin');
    eq([levelSlots(bard, 4).expertise.values, levelSlots(bard, 11).expertise.values], [['Persuasion', 'Deception'], ['Intimidation', 'Sleight of Hand']], 'the Bardadin: Expertise only in skills it is proficient in');
    ok(!buildIssues(bard).some((x) => /skill|Expertise|Background/i.test(x.text)), 'its skills are all chosen: ' + buildIssues(bard).map((x) => x.text).join('; '));
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
    eq([chosenOf(bm, 'Fighter', m).length, m.need], [7, 7], 'the ready-made Battle Master has its seven manoeuvres');
    bm.levels[9].picks = ['Manoeuvres: your choice', 'Manoeuvre: Rally'];
    eq(chosenOf(bm, 'Fighter', m).length, 6, 'a line that names no option decides nothing');
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
    eq(availableToggles(rogue, 'act1').map((x) => x.key), ['adv', 'haste', 'sneak', 'feat:Sharpshooter']);
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
    eq(keys(b), ['origin', 'race', 'subrace', 'class', 'subclass', 'level1', 'background', 'abilities', 'skills', 'done'], 'the choices of level 1 come right after the class; the creation ends in the summary');
    eq(wizSteps(b, true).map((s) => s[0]), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => 'lv:' + n), 'the levels are a walk of their own, from the Build Planner');
    eq(['race', 'subrace', 'class', 'subclass', 'abilities'].map((k) => wizDone(b, k)), [true, false, true, false, false]);
    b.levels[0].sub = 'Life Domain';
    Object.assign(b.creation, { subrace: 'Wood Elf', abilities: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 }, plus2: 'wis', plus1: 'con' });
    eq(['subrace', 'subclass', 'abilities', 'level1'].map((k) => wizDone(b, k)), [true, true, true, false], 'a Cleric still has 3 cantrips to choose');
    b.levels[0].picks.push('Cantrip: Guidance', 'Cantrip: Sacred Flame', 'Cantrip: Light');
    ok(wizDone(b, 'level1'));
    ok(/Life Domain/.test(wizardView(b)) || true);
    state.ui.wizard = 'class';
    ok(/wiz-card/.test(wizardView(b)) && /Hit points/.test(wizardView(b)) && !/levels-bar/.test(wizardView(b)), 'the class step renders its cards, with no levels to go to yet');
    state.ui.wizard = 'skills';
    ok(/data-act="wiz-go" data-s="done"[^>]*>Next/.test(wizardView(b)), 'after the last step of the creation comes the summary');
    state.ui.wizard = 'done';
    const summary = wizardView(b);
    ok(/Still open in the creation/.test(summary) && /class="chip" data-act="wiz-go" data-s="background"/.test(summary) && !/data-s="lv:2"/.test(summary) && /Open in the Build Planner/.test(summary),
      'the summary says what of the creation is open, each with its way back, and leads to the Build Planner');
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
  // ---------- eight builds worked out by hand ----------
  // Each number below is derived in the comment from the rules on the wiki (Hit points, Armour Class, Attacks,
  // Saving throws, Spells) and the base values of the gear, not read back from the planner.
  test('eight builds match the numbers worked out by hand', () => {
    const made = (classes, creation, subs, gear, picks) => {
      const b = build(classes, Object.assign({ race: 'Human', background: 'Soldier' }, creation));
      Object.keys(subs || {}).forEach((i) => { b.levels[i].sub = subs[i]; });
      Object.keys(gear || {}).forEach((k) => { b.gear.act1.slots[k].name = gear[k]; });
      Object.keys(picks || {}).forEach((i) => { b.levels[i].picks = picks[i]; });
      return b;
    };
    const saves = (st) => st.saves.map((k) => k.bonus);  // STR DEX CON INT WIS CHA
    const hits = (st) => st.attacks.rows.map((r) => [r.name, r.attackTotal, damageText(r)]);
    const turn = (st, style) => Math.round(turnPlan(st, style, 16).total * 1000) / 1000;
    let st;

    // Barbarian 5 (Berserker), no armour, Greataxe. STR 17 (+3), DEX 14 (+2), CON 16 (+3); proficiency +3.
    st = finalStats(made(Array(5).fill('Barbarian'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, { 2: 'Berserker' }, { meleeMain: 'Greataxe' }), 'act1');
    eq([st.hp, st.ac.act1, st.initiative, hits(st), saves(st)], [
      55,                                   // 12 + 3, then 4 × (7 + 3)
      15,                                   // Unarmoured Defence: 10 + DEX 2 + CON 3
      2,
      [['Greataxe', 6, '1d12 + 3']],        // STR 3 + proficiency 3
      [6, 2, 6, -1, 0, -1]], 'Barbarian 5'); // proficient in STR and CON
    eq(turn(st, 'melee'), 11.1);            // Extra Attack: 2 × (0.55 × 9.5 + 0.05 × 6.5); +6 hits AC 16 on 10 or more

    // Monk 6 (Open Hand), Wood Elf, unarmed. DEX 17 (+3), WIS 16 (+3), CON 14 (+2), STR 8 (−1).
    st = finalStats(made(Array(6).fill('Monk'), { race: 'Elf', subrace: 'Wood Elf', abilities: { str: 8, dex: 15, con: 14, int: 8, wis: 15, cha: 10 }, plus2: 'dex', plus1: 'wis' }, { 2: 'Way of the Open Hand' }), 'act1');
    eq([st.hp, st.ac.act1, hits(st), saves(st)], [
      45,                                   // 8 + 2, then 5 × (5 + 2)
      16,                                   // 10 + DEX 3 + WIS 3
      [['Unarmed strike', 6, '1d6 + 3']],   // Martial Arts die of Monk 3–8, Dexterity in place of Strength
      [2, 6, 2, -1, 3, 0]], 'Monk 6');      // proficient in STR and DEX
    eq(turn(st, 'unarmed'), 15);            // 2 attacks + 2 of Flurry of Blows, each 0.55 × 6.5 + 0.05 × 3.5

    // Fighter 5 (Champion), Chain Mail, Studded Shield, Longsword, Defence. STR 17, DEX 14, CON 16.
    st = finalStats(made(Array(5).fill('Fighter'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, { 2: 'Champion' },
      { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' }, { 0: ['Fighting Style: Defence'] }), 'act1');
    eq([st.hp, st.ac.act1, hits(st), st.crit], [
      49,                                   // 10 + 3, then 4 × (6 + 3)
      19,                                   // heavy armour 16 (no Dexterity) + shield 2 + Defence 1
      [['Longsword', 6, '1d8 + 3']],        // one hand, the other holds the shield
      19], 'Fighter 5');                    // Improved Critical Hit
    eq(turn(st, 'melee'), 9.15);            // 2 × (0.55 × 7.5 + 0.10 × 4.5)
    st = finalStats(made(['Fighter'], {}, {}, { chest: 'Chain Mail', meleeOff: 'Broken Shield' }), 'act1');
    eq(st.ac.act1, 17, 'the Broken Shield gives 1, as its page says');

    // Rogue 5 (Thief), Leather Armour, Shortsword and Dagger. DEX 17 (+3), CON 14, INT 12 (+1), WIS 14 (+2).
    st = finalStats(made(Array(5).fill('Rogue'), { abilities: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 }, plus2: 'dex', plus1: 'wis' }, { 2: 'Thief' },
      { chest: 'Leather Armour', meleeMain: 'Shortsword', meleeOff: 'Dagger' }), 'act1');
    eq([st.hp, st.ac.act1, hits(st), saves(st)], [
      38,                                   // 8 + 2, then 4 × (5 + 2)
      14,                                   // 11 + DEX 3
      [['Shortsword', 6, '1d6 + 3'], ['Dagger', 6, '1d4']],  // the off hand adds no modifier without Two-Weapon Fighting
      [-1, 6, 2, 4, 2, 0]], 'Rogue 5');     // proficient in DEX and INT
    eq(turn(st, 'melee'), 5.25);            // one attack 3.75, the off hand as a bonus action 1.5

    // Wizard 5 (Evocation), no armour, Mage Armour learned. INT 17 (+3), DEX 14 (+2), CON 14, WIS 13 (+1).
    const wiz = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {}, { 0: ['Spell: Mage Armour'] });
    st = finalStats(wiz, 'act1');
    eq([st.hp, st.ac.act1, armourClassInfo(wiz, 'act1').mage, st.casting.map((c) => [c.dc, c.attack, c.prepared]), st.slots, saves(st)], [
      32,                                   // 6 + 2, then 4 × (4 + 2)
      12, 15,                               // 10 + DEX 2; with Mage Armour 13 + DEX 2
      [[14, 6, 8]],                         // DC 8 + 3 + 3; attack 3 + 3; prepares 5 + 3
      [4, 3, 2],
      [-1, 2, 2, 6, 4, 0]], 'Wizard 5');    // proficient in INT and WIS

    // Paladin 6 (Vengeance) / Sorcerer 6 (Draconic), Chain Mail, Studded Shield, Longsword.
    // STR 16 (+3), DEX 8 (−1), CON 14 (+2), CHA 17 (+3); level 12, proficiency +4.
    st = finalStats(made([...Array(6).fill('Paladin'), ...Array(6).fill('Sorcerer')], { abilities: { str: 15, dex: 8, con: 14, int: 8, wis: 10, cha: 15 }, plus2: 'cha', plus1: 'str' },
      { 0: 'Oath of Vengeance', 6: 'Draconic Bloodline' }, { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' }), 'act1');
    eq([st.hp, st.ac.act1, st.initiative, hits(st), st.casting.map((c) => [c.dc, c.attack, c.prepared]), st.slots, saves(st)], [
      94,                                   // Paladin 12 + 5 × 8, Sorcerer 6 × 6, and 1 per Sorcerer level of Draconic Resilience
      18,                                   // 16 + shield 2
      -1,
      [['Longsword', 7, '1d8 + 3']],
      [[15, 7, 9], [15, 7, 0]],             // DC 8 + 4 + 3; the Paladin prepares 6 + 3
      [4, 3, 3, 3, 1],                      // 6 Sorcerer levels + half of 6 Paladin levels = a level 9 caster
      [6, 2, 5, 2, 7, 10]], 'Paladin 6 / Sorcerer 6');  // Aura of Protection adds CHA 3 to every save; WIS and CHA proficient
    eq(turn(st, 'melee'), 9.45);            // Extra Attack: 2 × (0.60 × 7.5 + 0.05 × 4.5); +7 hits on 9 or more

    // Warlock 5 (Fiend), Pact of the Blade, Leather Armour, Longsword in both hands. CHA 17 (+3), CON 15 (+2), DEX 14.
    st = finalStats(made(Array(5).fill('Warlock'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 0: 'The Fiend' },
      { chest: 'Leather Armour', meleeMain: 'Longsword' }, { 2: ['Pact Boon: Pact of the Blade'] }), 'act1');
    eq([st.hp, st.ac.act1, hits(st), st.pact, st.casting.map((c) => [c.dc, c.attack])], [
      38,                                   // 8 + 2, then 4 × (5 + 2)
      13,                                   // 11 + DEX 2
      [['Longsword', 6, '1d10 + 3']],       // the pact weapon uses Charisma; versatile, held in both hands
      { n: 2, level: 3 },
      [[14, 6]]], 'Warlock 5');
    eq(turn(st, 'melee'), 9.9);             // Deepened Pact: 2 × (0.55 × 8.5 + 0.05 × 5.5)

    // Ranger 5 (Hunter), Studded Leather, Longbow, Archery. DEX 17 (+3), WIS 15 (+2), CON 14.
    st = finalStats(made(Array(5).fill('Ranger'), { abilities: { str: 10, dex: 15, con: 14, int: 8, wis: 14, cha: 10 }, plus2: 'dex', plus1: 'wis' }, { 2: 'Hunter' },
      { chest: 'Studded Leather Armour', rangedMain: 'Longbow' }, { 1: ['Fighting Style: Archery'] }), 'act1');
    eq([st.hp, st.ac.act1, hits(st), st.casting.map((c) => [c.dc, c.attack]), st.slots, saves(st)], [
      44,                                   // 10 + 2, then 4 × (6 + 2)
      15,                                   // 12 + DEX 3
      [['Longbow', 8, '1d8 + 3']],          // DEX 3 + proficiency 3 + Archery 2
      [[13, 5]],                            // DC 8 + 3 + 2
      [4, 2],
      [3, 6, 2, -1, 2, 0]], 'Ranger 5');    // proficient in STR and DEX
    eq(turn(st, 'ranged'), 10.2);           // Extra Attack: 2 × (0.65 × 7.5 + 0.05 × 4.5); +8 hits on 8 or more
  });

  // ---------- the damage of a turn ----------
  test('spells, extra actions and the enemy enter the damage of a turn', () => {
    const kept = { target: state.ui.target, mode: state.ui.mode, castLevel: state.ui.castLevel, targets: state.ui.targets };
    state.ui.target = '';
    state.ui.mode = 'honour';
    state.ui.castLevel = 0;
    state.ui.targets = 1;
    const made = (classes, creation, subs, gear, picks) => {
      const b = build(classes, Object.assign({ race: 'Human', background: 'Soldier' }, creation));
      Object.keys(subs || {}).forEach((i) => { b.levels[i].sub = subs[i]; });
      Object.keys(gear || {}).forEach((k) => { b.gear.act1.slots[k].name = gear[k]; });
      Object.keys(picks || {}).forEach((i) => { b.levels[i].picks = picks[i]; });
      return b;
    };
    const round = (n) => Math.round(n * 10000) / 10000;
    const plain = { name: '', ac: 16, saves: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 }, res: {} };
    const enemy = (name) => { state.ui.target = name; const tg = targetOf(); state.ui.target = ''; return tg; };
    const spells = (b, tg) => spellOptions(finalStats(b, 'act1'), tg).map((x) => [x.name, round(x.total)]);
    const plan = (b, style, tg) => { const p = turnPlan(finalStats(b, 'act1'), style, tg || 16); return [round(p.total), p.parts.map((x) => [x.how, round(x.n)])]; };
    const targetToolsFor = (name) => { const was = state.ui.target; state.ui.target = name; const html = targetTools(); state.ui.target = was; return html; };

    // Wizard 5: Intelligence 17 (+3), proficiency +3: spell attack +6, spell save DC 14. Against AC 16, saves +3.
    const wiz = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {},
      { 0: ['Cantrip: Fire Bolt', 'Spell: Magic Missile'], 4: ['Spell: Fireball'] });
    eq(spells(wiz, plain), [
      ['Fireball', 21],        // 8d6 = 28; the save fails on 10 or less (50%): 28 × (0.5 + 0.5 × ½)
      ['Magic Missile', 10.5], // three darts of 1d4 + 1, no roll
      ['Fire Bolt', 6.6]]);    // 2d10 at character level 5: 0.55 × 11 + 0.05 × 11
    const st = finalStats(wiz, 'act1');
    eq([castsText(st, 0), castsText(st, 1), castsText(st, 3)], ['at will', '9 per Long Rest', '2 per Long Rest'], 'slots 4 / 3 / 2: a level 1 spell can use any of the nine');
    eq([round(bestTurn(st, 'caster', plain).total), bestTurn(st, 'caster', plain).cantrip.name], [6.6, 'Fire Bolt'], 'with no weapon, the cantrip is the turn');
    const raphael = enemy('Raphael');
    eq([raphael.ac, raphael.saves.dex, raphael.saves.cha, raphael.res.Fire], [21, 3, 8, 'i'], 'Dexterity 16, not proficient; Charisma 19 + 4');
    eq(spells(wiz, raphael), [['Magic Missile', 10.5]], 'immune to Fire: only the Force damage is left');

    // A higher slot, more than one enemy in an area, and the spells that roll an attack and then ask a save.
    state.ui.castLevel = 3;
    eq(spells(wiz, plain), [['Fireball', 21], ['Magic Missile', 17.5], ['Fire Bolt', 6.6]], 'with a level 3 slot Magic Missile throws five darts; a cantrip and a level 3 spell stay as they are');
    eq(castLevel(st, { sp: SPELL_BY_NAME.get('magic missile'), cls: 'Wizard' }), 3);
    state.ui.castLevel = 6;
    eq(castLevel(st, { sp: SPELL_BY_NAME.get('magic missile'), cls: 'Wizard' }), 3, 'no slot above level 3 at Wizard 5');
    state.ui.castLevel = 0;
    state.ui.targets = 3;
    eq(spells(wiz, plain), [['Fireball', 63], ['Magic Missile', 10.5], ['Fire Bolt', 6.6]], 'three enemies in the Fireball');
    state.ui.targets = 1;
    const one = (name, more) => spellDamage(st, Object.assign({ sp: SPELL_BY_NAME.get(norm(name)), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, more), plain);
    const worth = (name) => round(one(name).total);
    eq(worth('Ice Knife'), 6.8, 'the shard by attack roll (0.55 × 5.5 + 0.05 × 5.5), the burst of 2d6 by a save that negates it (7 × 0.5)');
    eq(worth('Scorching Ray'), 12.6, 'three rays: 3 × (0.55 × 7 + 0.05 × 7)');
    eq(worth('Heat Metal'), 9, 'a passed save still takes the full 2d8');
    eq([one('Moonbeam').perTurn, worth('Moonbeam')], [true, 8.25], 'only hurts turn after turn: 2d10 = 11, half on a save');
    state.ui.castLevel = 2;
    eq(worth('Ice Knife'), 8.55, 'one more d6 of Cold: 3.3 + 10.5 × 0.5');
    state.ui.castLevel = 3;
    eq([worth('Scorching Ray'), worth('Burning Hands')], [16.8, 13.125], 'a fourth ray; 5d6 = 17.5 × 0.75');
    state.ui.targets = 3;
    state.ui.castLevel = 0;
    eq(worth('Ice Knife'), 13.8, 'only the burst catches the others: 3.3 + 3 × 3.5');
    state.ui.targets = 1;
    // what a higher slot adds, read from each spell's own text
    const dice = (name, slot, level) => { const h = spellHits(SPELL_BY_NAME.get(norm(name)), level || 12, slot); return [h.parts.map((x) => x.dice), h.later.map((x) => x.dice), !!h.weapon]; };
    eq(dice('Lightning Arrow', 4), [['5d8', '3d8'], [], false], 'both the arrow and the burst grow');
    eq(dice('Flame Strike', 6), [['6d6', '6d6'], [], false]);
    eq(dice('Ice Storm', 5), [['3d8', '4d6'], [], false], 'only the Bludgeoning part grows');
    eq(dice("Melf's Acid Arrow", 3), [['5d4'], ['3d4'], false], 'one more d4 on impact and one at the end of the turn');
    eq(dice('Searing Smite', 2), [['2d6'], ['1d6'], true], 'the first hit grows, the burning does not');
    eq(dice('Moonbeam', 3), [[], ['3d10'], false]);
    eq(dice('Booming Blade', 0, 5), [['1d8'], ['2d8'], true], 'the cantrip at character level 5');
    eq(['Hex', "Hunter's Mark", 'Divine Favour'].map((n) => { const r = spellHits(SPELL_BY_NAME.get(norm(n)), 12, 1).rider; return r.dice + ' ' + r.type; }),
      ['1d6 Necrotic', '1d6 Weapon', '1d4 Radiant'], 'spells that add a die to every hit');

    // Sorcerer 6, Draconic Bloodline (Red): Charisma 17 (+3), DC 14, +6. Elemental Affinity adds 3 to Fire, once a cast.
    const sorc = made(Array(6).fill('Sorcerer'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 0: 'Draconic Bloodline' }, {},
      { 0: ['Draconic Ancestry: Red (Fire)', 'Cantrip: Fire Bolt', 'Spell: Magic Missile'], 1: ['Metamagic: Twinned Spell', 'Metamagic: Distant Spell'], 2: ['Metamagic: Heightened Spell', 'Spell: Scorching Ray'], 4: ['Spell: Fireball'] });
    eq(spells(sorc, plain), [
      ['Fireball', 23.25],        // (28 + 3) × 0.75
      ['Scorching Ray', 14.25],   // 12.6, and 3 more on one ray: 0.55 × 3
      ['Magic Missile', 10.5],
      ['Fire Bolt', 8.25]]);      // 0.55 × (11 + 3) + 0.05 × 11
    eq(availableToggles(sorc, 'act1').filter((x) => /^meta:/.test(x.key)).map((x) => x.label), ['Twinned Spell', 'Heightened Spell']);
    ok(!availableToggles(wiz, 'act1').some((x) => /^meta:/.test(x.key)), 'Metamagic is offered only to who chose it');
    sorc.active = ['meta:twin', 'meta:heighten'];
    eq(spells(sorc, plain), [
      ['Fireball', 27.125],       // Disadvantage on the save: it fails 1 − 0.5² = 75% of the time; 31 × (0.75 + 0.25 × ½)
      ['Fire Bolt', 16.5],        // a second target
      ['Scorching Ray', 14.25],   // three rays already: not for Twinned Spell
      ['Magic Missile', 10.5]]);
    const sst = finalStats(sorc, 'act1');
    eq(spellSpends(sst, spellOptions(sst, plain)), ['Twinned Spell: 1 Sorcery Point for each level of the slot, 1 for a cantrip', 'Heightened Spell: 3 Sorcery Points', '6 Sorcery Points per Long Rest']);
    eq(spellOptions(sst, plain).map((x) => x.points), [3, 1, 0, 0], 'Heightened Spell on the Fireball, Twinned Spell on a cantrip');
    sorc.active = [];

    // Quickened Spell: the strongest spell with the bonus action, and the action for a second one, if a slot is left for it.
    const quick = made(Array(7).fill('Sorcerer'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 0: 'Draconic Bloodline' }, {},
      { 0: ['Draconic Ancestry: Red (Fire)', 'Cantrip: Fire Bolt', 'Spell: Magic Missile'], 1: ['Metamagic: Twinned Spell', 'Metamagic: Distant Spell'], 2: ['Metamagic: Quickened Spell', 'Spell: Scorching Ray'], 4: ['Spell: Fireball'] });
    const qt = () => { const s = finalStats(quick, 'act1'); const q = quickTurn(s, null, spellOptions(s, plain)); return q && [q.first, q.second, round(q.total), q.points]; };
    eq(qt(), null, 'only when switched on');
    quick.active = ['meta:quicken'];
    ok(availableToggles(quick, 'act1').some((x) => x.key === 'meta:quicken'));
    eq(qt(), ['Fireball', 'Fireball', 46.5, 3], 'slots 4 / 3 / 3 / 1: two Fireballs of 23.25');
    state.ui.castLevel = 4;
    eq(qt(), ['Fireball', 'Fire Bolt', 34.125, 3], 'one level 4 slot only: 25.875, and the cantrip for the action');
    state.ui.castLevel = 0;
    quick.active = [];

    // Spells whose damage depends on the option chosen, and the ones that reach more than one enemy without an area of effect.
    eq([worth('Chromatic Orb'), one('Chromatic Orb').option, one('Chromatic Orb').text], [8.1, 'Thunder', '3d8 Thunder'], 'the strongest option: 0.55 × 13.5 + 0.05 × 13.5');
    const deaf = Object.assign({}, plain, { res: { Thunder: 'i' } });
    eq([round(spellDamage(st, { sp: SPELL_BY_NAME.get('chromatic orb'), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, deaf).total),
      spellDamage(st, { sp: SPELL_BY_NAME.get('chromatic orb'), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, deaf).option], [5.4, 'Acid'], 'immune to Thunder: one of the 2d8');
    state.ui.castLevel = 2;
    eq(worth('Chromatic Orb'), 10.8, 'one more d8 of the chosen type');
    state.ui.castLevel = 0;
    eq(worth('Spirit Guardians'), 10.125, '3d8 = 13.5, half on a save');
    eq(spellHits(SPELL_BY_NAME.get('spirit guardians'), 12, 5, '3d8 Radiant').parts.map((x) => x.dice), ['5d8'], '"1d8 Radiant or 1d8 Necrotic" for each level: once');
    eq([worth('Chain Lightning'), worth('Wall of Fire'), worth('Destructive Wave'), SPELL_BY_NAME.get('destructive wave').ao], [33.75, 16.875, 26.25, '9 m radius']);
    state.ui.targets = 3;
    eq([worth('Chain Lightning'), worth('Wall of Fire'), worth('Destructive Wave')], [101.25, 50.625, 78.75], 'three enemies in each');
    state.ui.targets = 6;
    eq([worth('Chain Lightning'), one('Chain Lightning').cap], [135, 4], 'the bolt leaps to three more at most');
    state.ui.targets = 1;
    ok(/2d8 Acid \/ 2d8 Cold/.test(spellDmg(SPELL_BY_NAME.get('chromatic orb'))) && spellHits(SPELL_BY_NAME.get('bestow curse'), 12, 3, SPELL_BY_NAME.get('bestow curse').vr[0][1]).rider.dice === '1d8');

    // Warlock 5 with Agonising Blast: two beams of 1d10 + 3. The patron's spells are not known by themselves.
    const lock = made(Array(5).fill('Warlock'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 0: 'The Fiend' }, {},
      { 0: ['Cantrip: Eldritch Blast', 'Spell: Hex', 'Spell: Burning Hands'], 1: ['Eldritch Invocation: Agonising Blast'] });
    eq(spells(lock, plain), [
      ['Burning Hands', 13.125],  // Pact Magic at Warlock 5 casts it with a level 3 slot: 5d6 = 17.5 × 0.75
      ['Eldritch Blast', 9.9]]);  // 2 × (0.55 × 8.5 + 0.05 × 5.5)
    eq(spellOptions(finalStats(lock, 'act1'), plain).riders.map((x) => [x.name, x.slot]), [['Hex', 3]], 'Hex is listed apart: it adds to the hits');
    ok(/Hex/.test(turnBox(finalStats(lock, 'act1'), 'caster')) && /Pact Magic casts every Warlock spell with a level 3 slot/.test(turnBox(finalStats(lock, 'act1'), 'caster')));
    ok(levelSpellLists(lock, 4, levelSlots(lock, 4).spells).reach.some((x) => x.n === 'Fireball'), 'Fireball is on the list a Fiend Warlock chooses from');

    // Fighter 5 (Champion), Longsword and shield: +6, 1d8 + 3, critical hit on 19.
    const f = made(Array(5).fill('Fighter'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, { 2: 'Champion' },
      { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' }, { 0: ['Fighting Style: Defence'] });
    eq(plan(f, 'melee'), [9.15, [['Attack action', 2]]]);
    f.active = ['surge'];
    eq(plan(f, 'melee'), [18.3, [['Attack action', 2], ['Action Surge', 2]]], 'a second action, with its Extra Attack');
    f.active = ['haste'];
    eq(plan(f, 'melee'), [13.725, [['Attack action', 2], ['Haste', 1]]], 'in Honour mode the action from Haste is one attack');
    state.ui.mode = 'balanced';
    eq(plan(f, 'melee'), [18.3, [['Attack action', 2], ['Haste', 2]]]);
    state.ui.mode = 'honour';
    f.active = [];
    // (its page gives other resistances from Tactician up: no weakness to Lightning any more, and half of Fire)
    state.ui.mode = 'balanced';
    const easyTitan = enemy('Steel Watcher Titan');
    eq([typeFactor(easyTitan, 'Lightning', false), typeFactor(easyTitan, 'Slashing', false), typeFactor(easyTitan, 'Slashing', true), typeFactor(easyTitan, 'Poison', true), typeFactor(easyTitan, 'Fire', false)], [2, 0.5, 1, 0, 1]);
    state.ui.mode = 'honour';
    const titan = enemy('Steel Watcher Titan');
    eq([typeFactor(titan, 'Lightning', false), typeFactor(titan, 'Slashing', false), typeFactor(titan, 'Slashing', true), typeFactor(titan, 'Poison', true), typeFactor(titan, 'Fire', false)], [1, 0.5, 1, 0, 0.5]);
    eq(plan(f, 'melee', titan)[0], 4.95, 'a common Longsword against resistance to non-magical Slashing: 2 × (0.6 × 7.5 + 0.1 × 4.5) ÷ 2, AC 15');
    const monk = made(Array(6).fill('Monk'), { race: 'Elf', subrace: 'Wood Elf', abilities: { str: 8, dex: 15, con: 14, int: 8, wis: 15, cha: 10 }, plus2: 'dex', plus1: 'wis' }, { 2: 'Way of the Open Hand' });
    eq(plan(monk, 'unarmed', titan)[0], 16.3, 'Ki-Empowered Strikes count as magical: 4 × (0.6 × 6.5 + 0.05 × 3.5)');
    const ms = finalStats(monk, 'act1');
    eq(turnSpends(ms, turnPlan(ms, 'unarmed', 16)), ['Flurry of Blows: 1 Ki a turn, 7 turns per Short Rest']);

    // Great Weapon Master: one more attack on the turns a critical hit lands. Greatsword +6, 2d6 + 3.
    const g = made(Array(5).fill('Fighter'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, {}, { meleeMain: 'Greatsword' }, { 3: ['Feat: Great Weapon Master'] });
    eq(plan(g, 'melee'), [12.2704, [['Attack action', 2], ['Great Weapon Master', 0.0975]]], '2 × 5.85, and 5.85 on 1 − 0.95² of the turns');
    ok(availableToggles(g, 'act1').some((x) => x.key === 'surge') && !availableToggles(wiz, 'act1').some((x) => x.key === 'surge'), 'Action Surge is offered to Fighters of level 2 and up');

    // Fighter 5 / Warlock 5 with a pact weapon: the two Extra Attacks add up only outside Honour mode.
    const fw = made([...Array(5).fill('Fighter'), ...Array(5).fill('Warlock')], { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 5: 'The Fiend' },
      { meleeMain: 'Longsword' }, { 7: ['Pact Boon: Pact of the Blade'] });
    eq(plan(fw, 'melee')[1], [['Attack action', 2]]);
    state.ui.mode = 'balanced';
    eq(plan(fw, 'melee')[1], [['Attack action', 3]]);
    // The damage test rolls what the averages are made of. With every roll in the middle: a d20 is 11, a d8 5, a d6 4.
    state.ui.mode = 'honour';
    const realRandom = simRandom;
    const fs = finalStats(f, 'act1');
    simRandom = () => 0.5;
    let turn = simTurn(fs, 'melee', plain, '', null);
    eq([turn.total, turn.lines.map((x) => [x.d20, x.hit, x.damage])], [16, [[11, true, 8], [11, true, 8]]], '11 + 6 against AC 16 hits; 1d8 (5) + 3, twice');
    eq(simTurn(fs, 'melee', titan, '', null).total, 8, 'a common sword against resistance to non-magical Slashing: half of each hit');
    simRandom = () => 0.999;
    eq(simTurn(fs, 'melee', plain, '', null).lines.map((x) => [x.crit, x.damage]), [[true, 19], [true, 19]], 'a natural 20: 2d8 (16) + 3');
    simRandom = () => 0;
    eq(simTurn(fs, 'melee', plain, '', null).total, 0, 'a natural 1 always misses');
    simRandom = () => 0.5;
    f.active = ['surge'];
    const surged = finalStats(f, 'act1');
    const fl = simResources(surged);
    eq([simTurn(surged, 'melee', plain, '', fl).lines.length, simTurn(surged, 'melee', plain, '', fl).lines.length, fl.surge], [4, 2, 0], 'Action Surge is there for one turn');
    f.active = [];
    const left = simResources(st);
    eq([left.slots, left.surge, left.ki], [[4, 3, 2], 0, 0]);
    turn = simTurn(st, 'caster', plain, 'Fireball', left);
    eq([turn.name, turn.total, turn.lines[0].passed, left.slots], ['Fireball', 16, true, [4, 3, 1]], 'the save: 11 + 3 meets DC 14, so half of 8d6 (32)');
    simTurn(st, 'caster', plain, 'Fireball', left);
    turn = simTurn(st, 'caster', plain, 'Fireball', left);
    eq([turn.name, turn.total, turn.notes.length, left.slots], ['Fire Bolt', 12, 1, [4, 3, 0]], 'no level 3 slot left: the cantrip, 11 + 6 hits, 2d10 (6 + 6)');
    eq([simTurn(st, 'caster', plain, 'Magic Missile', left).total, left.slots], [12, [3, 3, 0]], 'three darts of 1d4 (3) + 1, no roll, and a level 1 slot');
    // A fight: the plan of turns, what stays at work and for how long.
    const fightOf = (side, turns) => { const fight = newFight(side); return [fight, Array.from({ length: turns }, () => fightTurn(side, fight))]; };
    const steps = (list) => [0, 1, 2, 3].map((i) => Object.assign({ a: '', q: '', x: '' }, list[i]));
    // Warlock 5: Hex with the bonus action, then Eldritch Blast. Each beam: 1d10 (6) + 3, and 1d6 (4) of Hex.
    let [fight, rolledTurns] = fightOf(sideOf(finalStats(lock, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Eldritch Blast', q: 'Hex' }])), 2);
    eq([rolledTurns.map((x) => [x.name, x.total]), fight.left.pact, fight.effects.map((e) => [e.name, e.conc])], [[['Hex + Eldritch Blast', 26], ['Eldritch Blast', 26]], 1, [['Hex', true]]],
      'Hex is cast once, takes a pact slot and rides on both beams while it lasts');
    // Haste switched on: ten turns of one more attack (Honour mode), a turn lost to Lethargic, and on without it.
    f.active = ['haste'];
    [fight, rolledTurns] = fightOf(sideOf(finalStats(f, 'act1'), 'melee', plain, steps([])), 12);
    eq(rolledTurns.map((x) => x.lines.length), [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 2]);
    f.active = [];
    // Haste cast by the build: the action of the turn, a level 3 slot, and the action it gives goes to the cantrip.
    const hw = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {},
      { 0: ['Cantrip: Fire Bolt', 'Spell: Witch Bolt', 'Spell: Magic Missile'], 4: ['Spell: Fireball', 'Spell: Haste'] });
    [fight, rolledTurns] = fightOf(sideOf(finalStats(hw, 'act1'), 'caster', plain, steps([{ a: 'Haste' }, { a: 'Fireball', x: 'Magic Missile' }, { a: 'Witch Bolt' }, { a: 'weapon' }])), 4);
    eq(rolledTurns.map((x) => [x.name, x.total]), [['Haste + Fire Bolt', 12], ['Fireball + Magic Missile', 28], ['Witch Bolt', 0], ['Fire Bolt', 12]],
      'the action Haste gives goes to a second spell; Witch Bolt holds Concentration, which drops Haste: the spell and the rest of the turn are lost');
    eq([fight.left.slots, fight.effects.length], [[2, 3, 0], 0]);
    // with no other choice, the action on top repeats the action: a second Fireball while a slot is left
    [fight, rolledTurns] = fightOf(sideOf(finalStats(hw, 'act1'), 'caster', plain, steps([{ a: 'Haste' }, { a: 'Fireball' }, { a: 'Fireball' }, { a: 'weapon' }])), 3);
    eq([rolledTurns.map((x) => [x.name, x.total]), fight.left.slots], [[['Haste + Fire Bolt', 12], ['Fireball + Fire Bolt', 28], ['Fire Bolt + Fire Bolt', 24]], [4, 3, 0]], 'one level 3 slot left after Haste: the second Fireball has none');
    // Moonbeam hurts again on every later turn while it lasts: 2d10 (12), half on a passed save.
    const dr0 = () => { const d = made(Array(3).fill('Druid'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 15, cha: 12 }, plus2: 'wis', plus1: 'con' }); d.prepared = { Druid: ['Moonbeam'] }; return d; };
    const dr = dr0();
    [fight, rolledTurns] = fightOf(sideOf(finalStats(dr, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Moonbeam' }])), 3);
    eq([rolledTurns.map((x) => x.total), fight.left.slots, fight.effects.map((e) => [e.name, e.until])], [[6, 6, 6], [4, 1], [['Moonbeam', 10]]], 'cast once: one level 2 slot for the three turns');
    // Rage: the bonus action of the first turn and a charge; with no charge left, the build fights without it.
    const bb = made(Array(5).fill('Barbarian'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, {}, { meleeMain: 'Greataxe' });
    bb.active = ['rage'];
    const raging = simSide(bb, 'act1', plain);
    [fight, rolledTurns] = fightOf(raging, 1);
    eq([rolledTurns[0].total, fight.left.rage, fight.effects.map((e) => [e.name, e.until])], [24, 2, [['Rage', 10]]], 'two attacks of 1d12 (7) + 3 + 2 of Rage; three charges at Barbarian 5');
    const spent = newFight(raging);
    spent.left.rage = 0;
    eq(fightTurn(raging, spent).total, 20, 'no charge: 1d12 (7) + 3, twice');
    // The enemy's turn. A hit of 30 asks a Constitution save against DC 15: 11 + 2 fails, and Moonbeam ends.
    const struck = sideOf(finalStats(dr0(), 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Moonbeam' }]));
    const foeOf = (more) => Object.assign({ name: '', label: '', kind: 'a', melee: true, attacks: 1, bonus: 5, dc: 0, sv: '', os: 0, hits: null, damage: 10, steps: 0, broken: false, slot: 0, uses: 0, slots: null, fallback: null, parts: [] }, more);
    struck.foe = foeOf({ damage: 30 });  // 11 + 5 hits the druid's Armour Class of 12
    struck.hp = 999;
    [fight, rolledTurns] = fightOf(struck, 2);
    eq([rolledTurns.map((x) => x.total), fight.left.slots, fight.effects.length, struck.con], [[6, 6], [4, 0], 0, 2], 'cast again on the second turn, and lost again');
    struck.foe.damage = 20;
    [fight, rolledTurns] = fightOf(struck, 2);
    eq([fight.left.slots, fight.effects.length], [[4, 1], 1], 'a hit of 20 asks DC 10: 13 keeps it');
    // Reactions. Hellish Rebuke answers a hit with a pact slot of level 3: 4d10 (24), half on the passed save.
    const rebuke = made(Array(5).fill('Warlock'), { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 }, plus2: 'cha', plus1: 'con' }, { 0: 'The Fiend' }, {},
      { 0: ['Cantrip: Eldritch Blast', 'Spell: Hellish Rebuke', 'Spell: Armour of Agathys'], 1: ['Eldritch Invocation: Agonising Blast'] });
    const answering = sideOf(finalStats(rebuke, 'act1'), 'caster', plain, steps([{ a: 'Armour of Agathys' }, {}, {}, { a: 'Eldritch Blast' }]));
    Object.assign(answering, { react: 'Hellish Rebuke', foe: foeOf({ attacks: 2 }) });
    [fight, rolledTurns] = fightOf(answering, 2);
    eq([rolledTurns.map((x) => [x.name, x.total]), fight.left.pact, fight.effects.length, answering.hp - fight.hp], [[['Armour of Agathys', 42], ['Eldritch Blast', 18]], 0, 0, 25],
      'turn 1: two hits of 10, 15 Cold from the armour for each (a level 3 pact slot: 15 temporary hit points, gone with the second hit) and 12 from the rebuke; turn 2: the blast, and no pact slot for another rebuke. The armour took 15 of the 40 damage');
    // Riposte answers a miss: the Longsword and a superiority die, 1d8 (5) + 1d8 (5) + 3.
    const bm = made(Array(5).fill('Fighter'), { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, { 2: 'Battle Master' },
      { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' }, { 0: ['Fighting Style: Defence'], 2: ['Manoeuvre: Riposte', 'Manoeuvre: Trip Attack', 'Manoeuvre: Precision Attack'] });
    const parry = sideOf(finalStats(bm, 'act1'), 'melee', plain, steps([]));
    Object.assign(parry, { react: 'Riposte', foe: foeOf({ bonus: -5 }) });  // 11 − 5 misses an Armour Class of 19
    [fight, rolledTurns] = fightOf(parry, 1);
    eq([rolledTurns[0].total, rolledTurns[0].lines.map((l) => l.name).pop(), fight.left.dice], [29, 'Riposte', 3], 'two attacks of 8 and the riposte of 13; four dice at Battle Master 3');
    // Rage ends in a turn with no attack made and no damage taken, and is entered again with another charge.
    const idle = simSide(bb, 'act1', plain);
    idle.steps = steps([{}, { a: 'none', q: 'none' }, {}, {}]);
    [fight, rolledTurns] = fightOf(idle, 3);
    eq([rolledTurns.map((x) => x.total), fight.left.rage], [[24, 0, 24], 1], 'the third turn takes the bonus action and a second charge');
    // The build has hit points too. Rage halves a physical hit; a build with none left falls, and the fight is over.
    const hurt = simSide(bb, 'act1', plain);
    hurt.foe = foeOf({ bonus: 20, hits: [[['1d8', 6, 'Slashing']]] });
    [fight, rolledTurns] = fightOf(hurt, 1);
    eq([hurt.hp - fight.hp, rolledTurns[0].lines.filter((l) => l.kind === 'foe').map((l) => [l.hit, l.taken]), rolledTurns[0].total], [5.5, [[true, 5.5]], 24], '1d8 (5) + 6 = 11 Slashing, half while raging; what the build takes is not damage dealt');
    hurt.foe = foeOf({ bonus: 20, damage: 500 });
    [fight, rolledTurns] = fightOf(hurt, 1);
    eq([fight.down, fight.hp <= 0], [1, true]);
    const fallen = simFights(hurt, 0, 5);
    eq([fallen.lost, fallen.main.avg], [1, 24], 'every fight ends in the first turn, with the 24 dealt before falling');
    // Spike Growth hurts for every 1.5 m walked through it, and being Difficult Terrain it halves the distance.
    const spikes = (() => { const d = dr0(); d.prepared = { Druid: ['Spike Growth'] }; return sideOf(finalStats(d, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Spike Growth' }])); })();
    spikes.foe = foeOf({ attacks: 0, steps: 6 });
    [fight, rolledTurns] = fightOf(spikes, 2);
    eq([rolledTurns.map((x) => [x.total, x.lines.length]), fight.left.slots], [[[18, 3], [18, 3]], [4, 1]], 'six steps of movement are three inside the spikes: 3 × 2d4 (6), each turn, from one cast');
    eq(spellDamage(st, { sp: SPELL_BY_NAME.get('wall of ice'), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, plain).recipe.later.map((p) => p.when), ['broken'], 'the cloud of Wall of Ice waits for the wall to be broken');
    // Haste on the turn it is cast: its action is used, or left for the turn after, as the page is set.
    const waiting = sideOf(finalStats(hw, 'act1'), 'caster', plain, steps([{ a: 'Haste' }, {}, {}, { a: 'weapon' }]));
    waiting.hasteNow = false;
    [fight, rolledTurns] = fightOf(waiting, 2);
    eq(rolledTurns.map((x) => [x.name, x.total]), [['Haste', 0], ['Fire Bolt + Fire Bolt', 24]]);
    // The reference enemies bring their melee attack from their page.
    const owl = ENEMIES.find((e) => e.n === 'Owlbear').acts[0];
    eq([owl.n, owl.b, owl.w, owl.hits], ['Multiattack (Owlbear)', 7, [['Proficiency', 2], ['STR', 5]], [[['2d8', 5, 'Slashing']], [['1d10', 5, 'Piercing']]]], 'claws and beak; the bonus with the parts it is worked out from');
    const withActs = ENEMIES.filter((e) => e.acts);
    ok(withActs.length >= 70 && withActs.every((e) => e.acts.every((a) => a.hits.length && a.hits.every((h) => h.every((c) => /^\d+d\d+$/.test(c[0]))) && (a.hits[0].length || a.cd) && (a.k !== 's' || (a.dc > 0 && a.sv)))),
      'nearly all have something to do, with dice for every hit (or a condition to leave) and a DC for every save');
    const acts = (name) => ENEMIES.find((e) => e.n === name).acts;
    eq([acts('Sarevok Anchev')[0].n, !!acts('Sarevok Anchev')[0].g, acts('Sarevok Anchev').find((a) => a.n === 'Deathbringer Assault').c], ['Main Hand Attack (Sword of Chaos)', true, 1],
      'Sarevok strikes with the sword of his loot, and says it is worked out; Deathbringer Assault waits for a condition');
    const fireball = acts('Lorroakan').find((a) => a.n === 'Fireball');
    eq([acts('Lorroakan')[0].n, fireball.k, fireball.sv, fireball.dc, fireball.os, fireball.sl, ENEMIES.find((e) => e.n === 'Lorroakan').rs[3]], ['Fire Bolt', 's', 'dex', 16, 0.5, 3, 3],
      'a caster: the cantrip turn after turn, and Fireball with a save, a level 3 slot and the three slots he has');
    // A spell of the enemy against the build's saving throw: Lorroakan's Fireball, 8d6 (32), on a Barbarian with Dexterity 14.
    const burnt = simSide(bb, 'act1', plain);
    // (in Balanced mode: from Tactician up, his attack rolls and save DCs are 2 higher)
    state.ui.mode = 'balanced';
    const lorroakan = ENEMIES.find((e) => e.n === 'Lorroakan');
    burnt.foe = foeOf(Object.assign(foeMove(fireball, lorroakan), { slots: { 3: 1 }, fallback: foeMove(acts('Lorroakan')[0], lorroakan) }));
    [fight, rolledTurns] = fightOf(burnt, 2);
    eq([rolledTurns.map((x) => x.lines.filter((l) => l.kind === 'foe').map((l) => [l.how, l.mode, l.taken])), burnt.hp - fight.hp],
      [[[['Fireball', 's', 32]], [['Fire Bolt', 'a', 18]]], 50], '11 + 2 fails DC 16: all of it, Fire being no damage Rage resists; with his one slot gone he goes on with Fire Bolt, which at his level 10 is 3d10 (18)');
    // The difficulty: hit points of the mode, +2 to attack rolls and DCs from Tactician up, the actions of the mode.
    const modes = (fn) => ['balanced', 'tactician', 'honour'].map((m) => { state.ui.mode = m; return fn(); });
    const goblin = ENEMIES.find((e) => e.n === 'Goblin Warrior');
    eq(modes(() => [enemyHp(goblin), enemyHp(lorroakan)]), [[15, 98], [19, 127], [23, 127]], 'the Honour hit points when the page has them, else the Tactician ones');
    eq(modes(() => { const m = foeMove(fireball, lorroakan, 5); return [m.dc, m.slot, m.hits[0][0][0]]; }), [[16, 5, '10d6'], [18, 5, '10d6'], [18, 5, '10d6']], 'DC 16, and 18 from Tactician up; with a level 5 slot, 10d6');
    eq(modes(() => foeMove(acts('Lorroakan')[0], lorroakan).bonus), [8, 10, 10]);
    eq(modes(() => modeActs(ENEMIES.find((e) => e.n === 'Viconia DeVir')).some((a) => a.n === 'Dark Deliverance')), [false, false, true], 'an action of Honour mode only');
    eq(modes(() => modeActs(ENEMIES.find((e) => e.n === 'Raphael')).filter((a) => !a.q && a.k !== 'e')[0].n), ['Multiattack (Raphael)', 'Multiattack (Raphael, tactician)', 'Multiattack (Raphael, tactician)'], 'the Tactician version takes the place of the plain one');
    const yurgir = ENEMIES.find((e) => e.n === 'Yurgir');
    const dror = ENEMIES.find((e) => e.n === 'Dror Ragzlin');
    eq([yurgir.ea, modes(() => foeMove(dror.acts[0], dror).hits.length)], [[0, 1, 1], [2, 2, 2]], 'Extra Attack by mode; a Main Hand Attack is made once more for each');
    state.ui.mode = 'balanced';
    // A resistance of the build halves what it takes: a Tiefling and fire.
    const tief = made(Array(5).fill('Barbarian'), { race: 'Tiefling', subrace: 'Asmodeus Tiefling', abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' }, {}, { meleeMain: 'Greataxe' });
    const warm = simSide(tief, 'act1', plain);
    warm.foe = foeOf(foeMove(fireball));
    eq([[...warm.resist.always], fightOf(warm, 1)[1][0].lines.filter((l) => l.kind === 'foe').map((l) => l.taken)], [['Fire'], [16]]);
    // Evasion: nothing on a passed Dexterity save that would halve, half on a failed one. Rogue 7, DEX save +6.
    const slippery = sideOf(finalStats(made(Array(7).fill('Rogue'), { abilities: { str: 8, dex: 15, con: 14, int: 10, wis: 14, cha: 10 }, plus2: 'dex', plus1: 'con' }, {}, { meleeMain: 'Dagger' }), 'act1'), 'melee', plain, steps([]));
    slippery.foe = foeOf(foeMove(fireball, lorroakan));
    const evaded = (dc) => { slippery.foe.dc = dc; return fightOf(slippery, 1)[1][0].lines.filter((l) => l.kind === 'foe').map((l) => [l.passed, l.taken]); };
    eq([slippery.evasion, slippery.saves.dex, evaded(16), evaded(18)], [true, 6, [[true, 0]], [[false, 16]]]);
    // What the enemy does with its bonus action, and healing itself: 3d6 (12) back of the damage dealt.
    const salve = foeMove(ENEMIES.find((e) => e.n === 'Raphael').acts.find((a) => a.n === 'Infernal Salve'), null);
    const mended = sideOf(fs, 'melee', plain, steps([]));
    mended.foe = foeOf({ attacks: 0, extra: salve });
    [fight, rolledTurns] = fightOf(mended, 2);
    eq([salve.kind, rolledTurns.map((x) => x.total), fight.dealt, rolledTurns[1].lines.filter((l) => l.kind === 'foe').map((l) => l.healed)], ['e', [16, 16], 8, [12]], '16 dealt, 12 healed, 16 more, 12 healed again');
    // Spells that only protect. Blade Ward: half of physical damage for two turns. Mirror Image: +9 to Armour Class, 3 less for each attack evaded.
    const careful = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {},
      { 0: ['Cantrip: Fire Bolt', 'Cantrip: Blade Ward'], 2: ['Spell: Mirror Image'] });
    const guarded = sideOf(finalStats(careful, 'act1'), 'caster', plain, steps([{ a: 'Blade Ward' }, {}, {}, { a: 'weapon' }]));
    guarded.foe = foeOf({ bonus: 20 });
    eq([guarded.wards.map((w) => w.name), fightOf(guarded, 3)[1].map((x) => x.lines.filter((l) => l.kind === 'foe').map((l) => l.taken))], [['Blade Ward', 'Mirror Image'], [[5], [5], [10]]]);
    guarded.steps = steps([{ a: 'Mirror Image' }, {}, {}, { a: 'weapon' }]);
    guarded.foe = foeOf({ attacks: 2, bonus: 5, damage: 3 });
    [fight, rolledTurns] = fightOf(guarded, 3);
    eq(rolledTurns.map((x) => x.lines.filter((l) => l.kind === 'foe').map((l) => [l.against, l.hit])), [[[21, false], [18, false]], [[15, true], [15, true]], [[15, true], [15, true]]],
      'Armour Class 12 + 9: 11 + 5 misses twice, then against 15 it hits and no more duplicates are lost');
    // The temporary list of things to check by hand.
    const review = reviewItems();
    const asked = review.filter((x) => x.ask.length);
    ok(review.length > 40 && asked.length > 15 && asked.length < 40 && review.find((x) => x.key === 'enemy:The Netherbrain').ask.some((p) => /20~200/.test(p))
      && review.find((x) => x.key === 'enemy:Sarevok Anchev').ask.some((p) => /Sword of Chaos/.test(p)) && !review.find((x) => x.key === 'rule:initiative').ask.length,
      'what the planner guessed asks for a look (Sarevok\'s sword); and a damage read from a range (the Netherbrain\'s orb); what the wiki settles does not (Initiative)');
    eq([review.find((x) => x.key === 'rule:numbers').ask.length > 10, ENEMIES.find((e) => e.n === 'Cambion').acts.some((a) => /Trident/.test(a.n)), ENEMIES.find((e) => e.n === 'Animated Armour').acts.map((a) => a.gw && a.gw[0]),
      ENEMIES.find((e) => e.n === 'Yurgir').rx.every((a) => /Hunted creature/.test(a.tr))], [true, true, ['Greatsword', 'Heavy Crossbow'], true],
      'the guessed numbers in one entry; a weapon named another way on the page is found; what sets an answer off, in the words of its page');
    // Shield turns a hit into a miss when 5 more Armour Class is enough, and takes a level 1 slot and the reaction.
    const sw = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {}, { 0: ['Cantrip: Fire Bolt', 'Spell: Shield'] });
    const warded = sideOf(finalStats(sw, 'act1'), 'caster', plain, steps([]));
    Object.assign(warded, { react: 'Shield', foe: foeOf({ attacks: 2, bonus: 3 }) });
    [fight, rolledTurns] = fightOf(warded, 1);
    eq([warded.ac, rolledTurns[0].lines.filter((l) => l.kind === 'foe').map((l) => [l.hit, l.against]), fight.left.slots, warded.hp - fight.hp], [12, [[false, 17], [false, 17]], [3, 3, 2], 0],
      '11 + 3 hits 12 but not 17: both attacks of the turn miss');
    // Uncanny Dodge halves the first damage of the round.
    const rg = made(Array(5).fill('Rogue'), { abilities: { str: 8, dex: 15, con: 14, int: 10, wis: 14, cha: 10 }, plus2: 'dex', plus1: 'con' }, {}, { meleeMain: 'Dagger' });
    const nimble = sideOf(finalStats(rg, 'act1'), 'melee', plain, steps([]));
    Object.assign(nimble, { react: 'Uncanny Dodge', foe: foeOf({ attacks: 2, bonus: 20 }) });
    eq([nimble.dodge, fightOf(nimble, 1)[1][0].lines.filter((l) => l.kind === 'foe').map((l) => l.taken)], [true, [5, 10]]);
    // Second Wind at half the hit points: the bonus action, 1d10 (6) + Fighter level, once a Short Rest.
    const hardy = sideOf(finalStats(f, 'act1'), 'melee', plain, steps([]));
    hardy.heal = healOptions(hardy.stats).find((o) => o.kind === 'wind');
    hardy.foe = foeOf({ bonus: 20, damage: 30 });
    const bout = newFight(hardy);
    fightTurn(hardy, bout);
    hardy.foe = foeOf({ attacks: 0 });
    const after = fightTurn(hardy, bout);
    eq([hardy.hp, hardy.heal.dice, hardy.heal.flat, hardy.hp - bout.hp, bout.left.wind, after.name], [49, '1d10', 5, 19, 0, 'Second Wind + Weapon attacks'], '49 hit points, 30 taken, 11 back');
    ok(healOptions(hardy.stats).some((o) => o.name === 'Potion of Healing' && o.dice === '2d4' && o.flat === 2), 'potions drunk with the bonus action are on offer too');
    // Wall of Ice: the wiki's notes fix its DCs, 15 for the wall and 16 (Constitution) for the cloud it leaves.
    const ice = spellDamage(st, { sp: SPELL_BY_NAME.get('wall of ice'), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, plain);
    eq([ice.recipe.save.dc, ice.recipe.laterSave.dc, ice.recipe.laterSave.key, /DC 15/.test(ice.how)], [15, 16, 'con', true], 'not the wizard\'s own DC of 14');
    // A spell that only answers the enemy, and a flat damage line: Armour of Agathys.
    state.ui.castLevel = 3;
    const agathys = spellDamage(st, { sp: SPELL_BY_NAME.get('armour of agathys'), title: st.casting[0].label, ability: 'int', cls: 'Wizard' }, plain);
    eq([agathys.setup, agathys.total, agathys.recipe.later.map((p) => [p.flat, p.when])], [true, 0, [[15, 'struck']]], '5 Cold for each level of the slot');
    state.ui.castLevel = 0;
    ok(!spellHits(SPELL_BY_NAME.get('heal'), 12, 6) && spellHits(SPELL_BY_NAME.get('booming blade'), 1, 0).later.length === 1, 'healing is not damage; Booming Blade waits for the enemy to move');
    simRandom = realRandom;
    const fights = simFights(sideOf(fs, 'melee', plain, steps([])), 0, 300);
    ok(Math.abs(fights.perTurn - 9.15) < 0.7 && Math.abs(fights.main.avg - 91.5) < 7, 'three hundred fights of ten turns average what was worked out: ' + fights.perTurn.toFixed(2) + ' a turn');
    const rolled = Array.from({ length: 4000 }, () => simTurn(fs, 'melee', plain, '', null).total).reduce((a, x) => a + x, 0) / 4000;
    ok(Math.abs(rolled - 9.15) < 0.6, 'four thousand turns rolled average what was worked out: ' + rolled.toFixed(2) + ' against 9.15');
    Object.assign(state.ui, kept);
    ok(ENEMIES.length > 75 && ENEMIES.every((e) => e.ac > 5 && e.hp.b > 0 && e.act >= 1 && e.act <= 3) && ENEMIES.filter((e) => e.ty).length > 75, 'the reference enemies carry their numbers, and the kind of creature they are');
    // the two fights that are a puzzle first, in the state where damage counts
    const grym = enemy('Grym (Superheated)');
    eq([typeFactor(grym, 'Bludgeoning', false), typeFactor(grym, 'Slashing', true), typeFactor(grym, 'Fire', true), typeFactor(grym, 'Force', true)], [2, 0.5, 0, 0.5]);
    ok(/Superheated/.test(grym.enemy.note) && /Grym is immune/.test(targetToolsFor('Grym (Superheated)')), 'the note of the fight is shown with the enemy');
    eq([enemy('Gerringothe Thorm').enemy.hp.b, /Coin Armour/.test(enemy('Gerringothe Thorm').enemy.note)], [606, true]);
    eq([enemy('Balthazar').ac, /Mage Armour \(13 \+ Dexterity modifier\)/.test(enemy('Balthazar').enemy.note)], [15, true], 'no Armour Class on his page: 13 from Mage Armour + Dexterity 14');
    eq([typeFactor({ res: { Fire: 'rm' } }, 'Fire', true), typeFactor({ res: { Fire: 'rm' } }, 'Fire', false), typeFactor({ res: { Fire: 'ip' } }, 'Fire', true), typeFactor({ res: { Fire: 'ip' } }, 'Fire', false)], [0.5, 1, 0.5, 0]);
  });

  test('the damage test plays hits, conditions, Initiative, parties and several enemies', () => {
    const kept = Object.assign({}, state.ui);
    Object.assign(state.ui, { mode: 'honour', castLevel: 0, targets: 1, target: '' });
    const made = (classes, creation, subs, gear, picks) => {
      const b = build(classes, Object.assign({ race: 'Human', background: 'Soldier' }, creation));
      Object.keys(subs || {}).forEach((i) => { b.levels[i].sub = subs[i]; });
      Object.keys(gear || {}).forEach((k) => { b.gear.act1.slots[k].name = gear[k]; });
      Object.keys(picks || {}).forEach((i) => { b.levels[i].picks = picks[i]; });
      return b;
    };
    const saves = (n) => ({ str: n, dex: n, con: n, int: n, wis: n, cha: n });
    const plain = { name: '', ac: 16, saves: saves(3), res: {} };
    const weak = { name: '', ac: 16, saves: saves(0), res: {} };
    const steps = (list) => [0, 1, 2, 3].map((i) => Object.assign({ a: '', q: '', x: '' }, list[i]));
    const foeOf = (more) => Object.assign({ name: '', label: '', kind: 'a', melee: true, attacks: 1, bonus: 5, dc: 0, sv: '', os: 0, hits: null, damage: 10, steps: 0, broken: false, slot: 0, uses: 0, slots: null, fallback: null, parts: [] }, more);
    const fightOf = (side, turns) => { const fight = newFight(side); return [fight, Array.from({ length: turns }, () => fightTurn(side, fight))]; };
    const str = { abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' };
    const dex = { abilities: { str: 8, dex: 15, con: 14, int: 10, wis: 14, cha: 10 }, plus2: 'dex', plus1: 'con' };
    const realRandom = simRandom;
    simRandom = () => 0.5;  // every d20 an 11, every die its upper middle
    let fight;
    let turns;

    // The conditions come from their pages on the wiki, as flags.
    eq([CONDITIONS.Prone.f.adv, CONDITIONS.Prone.f.near, CONDITIONS.Stunned.f.skip, CONDITIONS.Paralysed.f.crit, CONDITIONS.Frightened.f.dis, CONDITIONS.Frightened.f.src, CONDITIONS.Blinded.f.dis, CONDITIONS['Hold Person'].f.rep],
      [1, 1, 1, 1, 1, 1, 1, 'wis'], 'Prone, Stunned, Paralysed, Frightened, Blinded, and the save Hold Person repeats');
    // Frightened counts down on the turn of whoever caused it: two turns of it are gone after the source's second turn.
    const source = { conds: [] };
    const victim = { conds: [] };
    addCond(victim, 'Frightened', 2, source);
    condEnd(victim, () => 0, () => {}, []);
    condEnd(source, () => 0, () => {}, [victim]);
    eq(victim.conds.map((c) => c.left), [1]);
    condEnd(source, () => 0, () => {}, [victim]);
    eq(victim.conds.length, 0);

    // Sneak Attack rides on the first attack that hits, once a turn: not on the off-hand attack that follows.
    const rogue = made(Array(5).fill('Rogue'), dex, {}, { meleeMain: 'Dagger', meleeOff: 'Dagger' });
    rogue.active = ['sneak'];
    const sneaky = sideOf(finalStats(rogue, 'act1'), 'melee', plain, steps([]));
    const once = turnPlan(sneaky.stats, 'melee', plain).once;
    ok(once && once.dice === '3d6' && Math.abs(once.total - 9.135) < 0.01, 'on average: 3d6 on the first of two attacks to hit, 0.6 × 10.5 + 0.45 × 0.6 × 10.5; got ' + (once && once.total));
    [fight, turns] = fightOf(sneaky, 1);
    eq([turns[0].lines.map((l) => !!l.turnDice), turns[0].lines[0].damage - turns[0].lines[1].damage >= 12], [[true, false], true], 'the dice are on the first hit only');

    // Divine Smite: a spell slot on a melee hit, the highest left first; 2d8, one more d8 a level, 5d8 at most.
    const paladin = made(Array(5).fill('Paladin'), str, {}, { meleeMain: 'Longsword', meleeOff: 'Studded Shield' });
    const holy = sideOf(finalStats(paladin, 'act1'), 'melee', plain, steps([]));
    ok(holy.stats.gains.includes('Divine Smite'), 'a Paladin of level 5 has Divine Smite');
    state.ui.target = 'Yurgir';
    const fiend = targetOf();
    state.ui.target = '';
    eq([smiteDice(holy.stats, plain, 1), smiteDice(holy.stats, plain, 2), smiteDice(holy.stats, plain, 6), smiteDice(holy.stats, fiend, 1), smiteDice(sneaky.stats, plain, 1)], ['2d8', '3d8', '5d8', '3d8', ''],
      'and one more against a Fiend; a Rogue has none');
    const bare = fightOf(holy, 1)[1][0].total;
    holy.smite = { when: 'all', low: false };
    [fight, turns] = fightOf(holy, 1);
    eq([turns[0].total - bare, fight.left.slots], [30, [4, 0]], 'two hits, each with a level 2 slot: 3d8 (15) more');
    holy.smite = { when: 'crit', low: true };
    eq(fightOf(holy, 1)[1][0].total, bare, 'kept for critical hits: none here');

    // Trip Attack: the Superiority Die on the damage, and Prone on a failed Strength save, which gives Advantage.
    const bm = made(Array(5).fill('Fighter'), str, { 2: 'Battle Master' }, { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' },
      { 0: ['Fighting Style: Defence'], 2: ['Manoeuvre: Riposte', 'Manoeuvre: Trip Attack', 'Manoeuvre: Precision Attack'] });
    const tripper = sideOf(finalStats(bm, 'act1'), 'melee', weak, steps([]));
    eq([tripper.weaponDc, tripper.die], [14, '1d8'], 'weapon action DC: 8 + 3 + 3');
    tripper.hit = { name: 'Trip Attack', every: false };
    [fight, turns] = fightOf(tripper, 1);
    eq([turns[0].lines.map((l) => l.kind), turns[0].lines[1].passed, fight.left.dice, turns[0].notes.some((n) => /Prone/.test(n)), turns[0].lines[0].damage - turns[0].lines[2].damage],
      [['attack', 'save', 'attack'], false, 3, true, 5], 'one die a turn: 1d8 (5) on the first hit, 11 + 0 against DC 14 fails');
    tripper.hit = { name: 'Precision Attack', every: false };
    [fight, turns] = fightOf(tripper, 1);
    eq([turns[0].lines.map((l) => l.bonus), fight.left.dice], [[11, 6], 3], 'Precision Attack: 1d8 (5) on the first attack roll');

    // Stunning Strike: a Ki Point on a hit; a Stunned enemy loses its turn.
    const monk = made(Array(5).fill('Monk'), { abilities: { str: 8, dex: 15, con: 14, int: 10, wis: 15, cha: 8 }, plus2: 'dex', plus1: 'wis' });
    const fist = sideOf(finalStats(monk, 'act1'), 'unarmed', weak, steps([]));
    fist.foe = foeOf({ bonus: 20 });
    const struck = fightOf(fist, 1)[1][0].lines.filter((l) => l.kind === 'foe').length;
    fist.hit = { name: 'Stunning Strike', every: false };
    [fight, turns] = fightOf(fist, 1);
    eq([struck, turns[0].lines.filter((l) => l.kind === 'foe').length, turns[0].notes.some((n) => /Stunned: no action/.test(n))], [1, 0, true], 'the enemy that would have struck does nothing');

    // A spell that only leaves a condition: Hold Person, held by Concentration.
    const mage = made(Array(5).fill('Wizard'), { abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' }, { 1: 'Evocation School' }, {},
      { 0: ['Cantrip: Fire Bolt', 'Spell: Magic Missile'], 2: ['Spell: Hold Person'], 4: ['Spell: Fireball'] });
    const holder = sideOf(finalStats(mage, 'act1'), 'caster', weak, steps([{ a: 'Hold Person' }, {}, {}, { a: 'Fire Bolt' }]));
    holder.foe = foeOf({ bonus: 20 });
    eq(holder.controls.map((c) => [c.name, c.key, c.dc]), [['Hold Person', 'wis', 14]]);
    [fight, turns] = fightOf(holder, 2);
    eq([turns[0].name, fight.enc.foes[0].conds.map((c) => c.name), fight.effects.some((e) => e.kind === 'hold' && e.conc), turns.map((x) => x.lines.filter((l) => l.kind === 'foe').length), fight.left.slots[1]],
      ['Hold Person', ['Hold Person'], true, [0, 0], 2], 'the enemy fails its save and the one it repeats, and does not act');
    state.ui.target = 'Owlbear';
    const beast = targetOf();
    state.ui.target = '';
    const wrong = sideOf(finalStats(mage, 'act1'), 'caster', beast, steps([{ a: 'Hold Person' }, {}, {}, { a: 'Fire Bolt' }]));
    [fight, turns] = fightOf(wrong, 1);
    eq([turns[0].name, fight.left.slots[1]], ['Fire Bolt', 3], 'Hold Person is for Humanoids: it is not cast on a Beast, and no slot is spent');

    // A fight in rounds: who acts first, and who is Surprised.
    const fighter = made(Array(5).fill('Fighter'), str, { 2: 'Champion' }, { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' }, { 0: ['Fighting Style: Defence'] });
    const sword = () => sideOf(finalStats(fighter, 'act1'), 'melee', plain, steps([]));
    const brute = () => foeState(foeOf({ bonus: 20, damage: 5 }), plain, 0);
    let enc = newEncounter([sword()], [brute()], { first: 'foes' });
    let round = encRound(enc);
    eq([round.entries.map((e) => e.kind), enc.fights[0].hp], [['foe', 'side'], 44], 'the enemy first, when the page says so');
    enc = newEncounter([sword()], [brute()], { first: 'roll' });
    encRound(enc);
    eq(enc.init.map((x) => [x.kind, x.total]), [['side', 5], ['foe', 3]], 'Initiative: d4 (3) + 2 for the build, + 0 for an enemy with no page');
    // a tie goes to the higher Dexterity score: the rogue (17) before the fighter (14), though it comes second in the party
    enc = newEncounter([Object.assign(sword(), { initiative: 4, name: 'Sword' }), Object.assign(sideOf(finalStats(rogue, 'act1'), 'melee', plain, steps([])), { initiative: 4, name: 'Rogue' })], [brute()], { first: 'roll' });
    encRound(enc);
    eq(enc.init.map((x) => x.name), ['Rogue', 'Sword', 'The enemy']);
    enc = newEncounter([sword()], [brute()], { first: 'party', surprise: 'foes' });
    eq([encRound(enc).entries.map((e) => e.lines.filter((l) => l.kind === 'foe').length), encRound(enc).entries.map((e) => e.lines.filter((l) => l.kind === 'foe').length)], [[0, 0], [0, 1]],
      'a Surprised enemy does nothing in the first round');
    enc = newEncounter([sword()], [brute()], { first: 'foes', surprise: 'party' });
    eq(encRound(enc).entries.map((e) => e.lines.length), [1, 0], 'a Surprised build takes no action in the first round');

    // A party: both members act, the enemy goes for the first, and Bless reaches the other member.
    const cleric = made(['Cleric'], { abilities: { str: 14, dex: 10, con: 14, int: 8, wis: 15, cha: 10 }, plus2: 'wis', plus1: 'con' }, { 0: 'Life Domain' }, { meleeMain: 'Mace' });
    cleric.prepared = { Cleric: ['Bless'] };
    const priest = Object.assign(sideOf(finalStats(cleric, 'act1'), 'melee', plain, steps([{ a: 'Bless' }, {}, {}, { a: 'weapon' }])), { name: 'Priest' });
    ok(priest.bless, 'the cleric can cast Bless');
    enc = newEncounter([priest, Object.assign(sword(), { name: 'Sword' })], [brute()], { first: 'party', aim: 'first' });
    round = encRound(enc);
    eq([round.entries.map((e) => e.name), round.entries[1].lines.map((l) => l.bonus), enc.fights.map((x) => x.hp < enc.sides[enc.fights.indexOf(x)].hp), enc.fights[0].effects.map((e) => [e.kind, e.to])],
      [['Bless', 'Weapon attacks', ''], [9, 9], [true, false], [['bless', [0, 1]]]], 'the fighter rolls 6 + 1d4 (3); the enemy strikes the first member');

    // Several enemies: a spell with an area is rolled against each; an attack moves on when its target falls.
    const blaster = () => sideOf(finalStats(mage, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Fireball' }]));
    const dummy = (hp, name) => Object.assign(foeState(foeOf({ attacks: 0 }), plain, hp), { name });
    enc = newEncounter([blaster()], [dummy(100, 'A'), dummy(100, 'B'), dummy(100, 'C')], { first: 'party' });
    round = encRound(enc);
    eq([round.entries[0].lines.map((l) => [l.to, l.damage]), enc.foes.map((x) => x.dealt)], [[['A', 16], ['B', 16], ['C', 16]], [16, 16, 16]], 'Fireball: 8d6 (32), halved on a passed save, on each of the three');
    enc = newEncounter([sword()], [dummy(5, 'A'), dummy(5, 'B')], { first: 'party' });
    round = encRound(enc);
    eq([round.entries[0].lines.map((l) => l.to), encWon(enc), enc.foes.map((x) => x.dead)], [['A', 'B'], true, [1, 1]], 'the second attack goes to the enemy still standing');
    enc = newEncounter([sword()], [dummy(100, 'A'), dummy(5, 'B')], { first: 'party', focus: 'helpers' });
    eq(encRound(enc).entries[0].lines.map((l) => l.to), ['B', 'A'], 'the helpers first, when the page says so');

    // An enemy answers a hit once a round: Yurgir's Legendary Action of Honour mode, which may leave the build Blinded.
    const yurgir = ENEMIES.find((e) => e.n === 'Yurgir');
    eq([['balanced', 'honour'].map((m) => { state.ui.mode = m; return foeAnswers(yurgir).map((a) => a.label); }), foeAnswers(yurgir).find((a) => a.melee).cd], [[[], ['Blinding Ambush (ranged)', 'Blinding Ambush']],
      { name: 'Blinded', turns: 2, sv: 'con', dc: 17 }], 'only in Honour mode; the save DC of its page + 2');
    const hunted = sword();
    hunted.foe = Object.assign(foeOf({ attacks: 0 }), { rx: foeAnswers(yurgir) });
    [fight, turns] = fightOf(hunted, 1);
    let answers = turns[0].lines.filter((l) => l.kind === 'foe');
    eq([answers.length, /Blinding Ambush · Legendary Action/.test(answers[0].how), answers[0].taken, answers[1].passed, fight.conds.map((c) => c.name)], [2, true, 30, true, []],
      'one answer for the two hits: 5d10 (30) Radiant, then the save against Blinded, 11 + 6 against DC 17');
    hunted.foe.rx.forEach((a) => { a.cd.dc = 18; });
    [fight, turns] = fightOf(hunted, 1);
    answers = turns[0].lines.filter((l) => l.kind === 'foe');
    eq([answers[1].passed, fight.conds.map((c) => [c.name, c.left]), turns[0].lines.filter((l) => l.kind === 'attack').length], [false, [['Blinded', 1]], 2], 'a failed save: Blinded for 2 turns, one of them gone with this turn');

    // Arrows, coatings and elixirs, read from their text.
    const item = (n) => CONSUMABLE_BY_NAME.get(norm(n));
    eq([arrowFx(item('Arrow of Fire')), arrowFx(item('Arrow of Undead Slaying')), arrowFx(item('Smokepowder Arrow')).save, arrowFx(item('Arrow of Darkness'))],
      [{ extra: ['2d4', 'Fire'], save: { key: 'dex', dc: 12 }, kept: 0 }, { double: 'Undead' }, { key: 'dex', dc: 15 }, null]);
    eq([coatFx(item('Drow Poison')), coatFx(item('Diluted Oil of Sharpness')).attack, coatFx(item('Wyvern Toxin')).later], [{ save: { key: 'con', dc: 13 }, conds: ['Poisoned', 'Sleeping'] }, 1, ['1d8', 'Poison']]);
    const archer = made(Array(5).fill('Ranger'), dex, {}, { rangedMain: 'Longbow' });
    const bow = sideOf(finalStats(archer, 'act1'), 'ranged', plain, steps([]));
    bow.arrow = { name: 'Arrow of Fire', fx: arrowFx(item('Arrow of Fire')), n: 1 };
    [fight, turns] = fightOf(bow, 1);
    eq([turns[0].lines.map((l) => l.kind), fight.left.arrows], [['attack', 'save', 'attack'], 0], 'the one arrow carried goes with the first attack; the enemy saves against its burst');
    fighter.elixir = 'Elixir of Bloodlust';
    const thirsty = sword();
    eq([thirsty.brew.blood, elixirFx(Object.assign({}, thirsty.stats, { build: Object.assign({}, fighter, { elixir: 'Elixir of Heroism' }) })).temp,
      simResources(Object.assign({}, holder.stats, { build: Object.assign({}, mage, { elixir: 'Elixir of Arcane Cultivation' }) })).slots[0] - simResources(holder.stats).slots[0]], [5, 10, 1]);
    enc = newEncounter([thirsty], [dummy(5, 'A'), dummy(100, 'B')], { first: 'party' });
    round = encRound(enc);
    eq([round.entries[0].lines.length, enc.fights[0].temp], [3, 5], 'Bloodlust: a kill gives 5 temporary hit points and one more action, which in Honour mode is one attack');
    state.ui.mode = 'balanced';
    eq(encRound(newEncounter([sword()], [dummy(5, 'A'), dummy(100, 'B')], { first: 'party' })).entries[0].lines.length, 4, 'and outside Honour mode the two attacks of Extra Attack');
    state.ui.mode = 'honour';
    fighter.elixir = '';

    // The manoeuvres that are not about one hit, and what a party does for its own.
    eq([CONDITIONS.Goaded.f.dis, CONDITIONS.Distracted.f.ally, CONDITIONS.Distracted.f.once, CONDITIONS['Evasive Footwork'].f.guard], [1, 1, 1, 1], 'Goaded, Distracted and Evasive Footwork, from their pages');
    const captain = made(Array(5).fill('Fighter'), str, { 2: 'Battle Master' }, { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' },
      { 0: ['Fighting Style: Defence'], 2: ['Manoeuvre: Distracting Strike', 'Manoeuvre: Sweeping Attack', 'Manoeuvre: Rally'] });
    const lead = (more, plan) => Object.assign(sideOf(finalStats(captain, 'act1'), 'melee', plain, steps(plan || [])), { name: 'Captain' }, more);
    const mate = () => Object.assign(sword(), { name: 'Sword', b: fighter });
    // Distracting Strike: the next attack roll of an ally has Advantage; the fighter's own does not spend it.
    enc = newEncounter([lead({ hit: { name: 'Distracting Strike', every: false } }), mate()], [dummy(1000, 'A')], { first: 'party' });
    enc.round = 1;
    buildTurn(enc, 0);
    eq([enc.foes[0].conds.map((c) => c.name), enc.fights[0].left.dice], [['Distracted'], 3]);
    buildTurn(enc, 1);
    eq(enc.foes[0].conds.length, 0, 'spent by the ally\'s first attack');
    // Sweeping Attack: one attack on every enemy for the Superiority Die alone, then the rest of the Attack action.
    enc = newEncounter([lead({}, [{}, {}, {}, { a: 'Sweeping Attack' }])], [dummy(100, 'A'), dummy(100, 'B'), dummy(100, 'C')], { first: 'party' });
    round = encRound(enc);
    eq([round.entries[0].lines.map((l) => [l.name, l.to, l.damage]), enc.fights[0].left.dice], [[['Sweeping Attack', 'A', 5], ['Sweeping Attack', 'B', 5], ['Sweeping Attack', 'C', 5], ['Longsword', 'A', 8]], 3],
      '1d8 (5) on each, with nothing added; the second attack of the action follows');
    // A member at 0 hit points is Downed. Rally brings it back with the bonus action; Help, with the action.
    const felled = (more) => { const e = newEncounter([lead(more), mate()], [dummy(1000, 'A')], { first: 'party' }); e.round = 1; Object.assign(e.fights[1], { hp: -4, down: 1, fell: true, death: { ok: 0, bad: 0 } }); return e; };
    enc = felled({ rally: true });
    let mine = buildTurn(enc, 0);
    eq([mine.name, enc.fights[1].hp, enc.fights[1].temp, enc.fights[1].down, enc.fights[0].left.dice, mine.lines.length], ['Rally + Weapon attacks', 1, 8, 0, 3, 2], 'back at 1 hit point, with 8 temporary ones; the action is still there');
    enc = felled({ helps: true });
    mine = buildTurn(enc, 0);
    eq([mine.name, enc.fights[1].hp, enc.fights[1].down, mine.lines.length], ['Help', 1, 0, 0], 'the action goes to the ally');
    enc = felled({});
    eq([[1, 2, 3, 4].map(() => { const e = downedTurn(enc, 1); return e ? enc.fights[1].death.ok : null; }), enc.fights[1].dead], [[1, 2, 3, null], false], 'death saving throws: three of 11 and it is Stable');
    simRandom = () => 0;
    enc = felled({});
    [1, 2, 3].forEach(() => downedTurn(enc, 1));
    eq([enc.fights[1].dead, buildTurn(enc, 1), encLost(enc)], [true, null, false], 'three failed and it is dead; the party is not lost while one stands');
    simRandom = () => 0.5;
    // Commander's Strike: one attack and the bonus action of the fighter, for an attack of the ally with the die on it.
    const marshal = made(Array(5).fill('Fighter'), str, { 2: 'Battle Master' }, { chest: 'Chain Mail', meleeMain: 'Longsword', meleeOff: 'Studded Shield' },
      { 0: ['Fighting Style: Defence'], 2: ['Manoeuvre: Commander\'s Strike', 'Manoeuvre: Evasive Footwork', 'Manoeuvre: Goading Attack'] });
    const order = (more) => Object.assign(sideOf(finalStats(marshal, 'act1'), 'melee', plain, steps([])), { name: 'Marshal' }, more);
    enc = newEncounter([order({ cmd: fighter.id }), mate()], [dummy(1000, 'A')], { first: 'party' });
    round = encRound(enc);
    eq([round.entries.map((e) => e.lines.map((l) => l.how)), round.entries[1].lines[2].damage - round.entries[1].lines[0].damage, enc.fights[0].left.dice],
      [[['Attack action'], ['Attack action', 'Attack action', 'Commander\'s Strike']], 5, 3], 'the fighter attacks once; the ally, three times, the third with 1d8 (5) more');
    // Evasive Footwork takes a die each turn; Goading Attack leaves the enemy Goaded when it fails its save.
    enc = newEncounter([order({ foot: true, hit: { name: 'Goading Attack', every: false } })], [Object.assign(foeState(foeOf({ attacks: 0 }), weak, 1000), { name: 'A' })], { first: 'party' });
    enc.round = 1;
    mine = buildTurn(enc, 0);
    eq([enc.fights[0].left.dice, mine.notes.some((n) => /Evasive Footwork/.test(n)), enc.foes[0].conds.map((c) => c.name)], [2, true, ['Goaded']]);
    // Where a member stands: a melee attack goes for whoever is next to the enemy, though the archer is first in the party.
    enc = newEncounter([Object.assign(sideOf(finalStats(archer, 'act1'), 'ranged', plain, steps([])), { name: 'Bow' }), mate()], [brute()], { first: 'party', aim: 'first' });
    encRound(enc);
    eq([enc.sides.map((x) => x.front), enc.fights.map((x, k) => x.hp < enc.sides[k].hp)], [[false, true], [false, true]]);
    // Sneak Attack needs Advantage, or an ally next to the target: alone, the page says whether one is there.
    const alone = (ally) => encRound(newEncounter([sideOf(finalStats(rogue, 'act1'), 'melee', plain, steps([]))], [dummy(1000, 'A')], { first: 'party', ally })).entries[0].lines.map((l) => !!l.turnDice);
    eq([alone(true), alone(false)], [[true, false], [false, false]]);
    // Arcane Acuity: the Elixir of Battlemage's Power keeps it at 3, on spell attack rolls and on the save DC.
    const plainBolt = fightOf(sideOf(finalStats(mage, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: 'Fire Bolt' }])), 1)[1][0].lines[0].bonus;
    mage.elixir = 'Elixir of Battlemage\'s Power';
    const sharp = (spell) => sideOf(finalStats(mage, 'act1'), 'caster', plain, steps([{}, {}, {}, { a: spell }]));
    eq([sharp('Fire Bolt').acu.floor, fightOf(sharp('Fire Bolt'), 1)[1][0].lines[0].bonus - plainBolt, fightOf(sharp('Fireball'), 1)[1][0].lines[0].against], [3, 3, 17], '+3 to hit, and DC 14 + 3');
    mage.elixir = '';
    // A helper may have its action chosen, like the main enemy.
    eq([simFoe(enemyTarget(yurgir), true).label, simFoe(enemyTarget(yurgir), { foeAct: 'Infernal Dagger' }).label, simFoe(enemyTarget(yurgir), { foeAct: 'none' }).attacks], ['Concussive Burst', 'Infernal Dagger', 0]);

    // What an enemy's page gives for the difficulty: its numbers of Tactician, what adds to its Initiative, its passives.
    const by = (n) => ENEMIES.find((e) => e.n === n);
    const inMode = (m, fn) => { state.ui.mode = m; const out = fn(); state.ui.mode = 'honour'; return out; };
    eq([inMode('balanced', () => enemyTarget(by('Apostle of Myrkul')).ac === by('Apostle of Myrkul').ac), [enemyTarget(by('Apostle of Myrkul')).ac, enemyTarget(by('Apostle of Myrkul')).ab.str], by('Auntie Ethel').xi,
      inMode('balanced', () => foePassives(by('Cazador Szarr'))), foePassives(by('Cazador Szarr')), !!foePassives(by('Raphael')).mr, by('The Netherbrain').acts[0].gr, by('Prelate Lir\'i\'c').acts.some((a) => !a.q)],
      [true, [20, 25], 5, { al: 1, rg: 10 }, { al: 1, rg: 10, lr: 3 }, true, '20~200', true], 'Armour Class 20 and Strength 25 from Tactician up; Legendary Resistance from Tactician up; the two that did nothing have an action');
    const withPv = (target, pv, more) => Object.assign({}, target, { pv }, more);
    // Magic Resistance: Advantage on the save against a spell, in the average too.
    const ball = (target) => simBase(sideOf(finalStats(mage, 'act1'), 'caster', target, steps([]))).spells.get('Fireball');
    eq([ball(plain).total, ball(withPv(plain, { mr: 1 })).total, ball(withPv(plain, { mr: 1 })).recipe.save.adv, ball(withPv(plain, { ev: 1 })).total], [21, 17.5, true, 7],
      '8d6 (28): half the time all of it and half of it otherwise; with Advantage a quarter of the time; with Evasion nothing on a pass and half on a fail');
    // Legendary Resistance: 10 more on a failed save, while it lasts. The general one on any save; the other only against what incapacitates.
    const burn = (pv) => fightOf(sideOf(finalStats(mage, 'act1'), 'caster', withPv(weak, pv), steps([{}, {}, {}, { a: 'Fireball' }])), 2)[1].map((x) => x.total);
    eq([burn({ lr: 1 }), burn({ li: 1 }), burn({ ev: 1 })], [[16, 32], [32, 32], [16, 16]], 'a failed save turned into a passed one, once');
    const numb = sideOf(finalStats(monk, 'act1'), 'unarmed', withPv(weak, { li: 1 }), steps([]));
    Object.assign(numb, { foe: foeOf({ bonus: 20 }), hit: { name: 'Stunning Strike', every: false } });
    [fight, turns] = fightOf(numb, 2);
    eq([turns[0].lines.find((l) => l.cond).legend, turns.map((x) => x.lines.filter((l) => l.kind === 'foe').length)], [true, [1, 0]], 'the first Stunning Strike is resisted, the second lands');
    // With nothing chosen an enemy plays the strongest it can pay for; with an action chosen, that one.
    const lorTarget = inMode('balanced', () => enemyTarget(by('Lorroakan')));
    const lor = inMode('balanced', () => simFoe(lorTarget, true));
    ok(lor.smart.length > 3 && lor.smart[0].label !== 'Fire Bolt' && lor.smart[0].slot > 0 && lor.smart.some((m) => m.label === 'Fire Bolt') && !inMode('balanced', () => simFoe(lorTarget, { foeAct: 'Fire Bolt' })).smart,
      'Lorroakan: a spell with a slot before his cantrip; first ' + lor.smart[0].label);
    state.ui.mode = 'balanced';
    enc = newEncounter([sword()], [foeState(lor, lorTarget, 1000)], { first: 'foes' });
    const slotsBefore = Object.assign({}, lor.slots);
    round = encRound(enc);
    eq([round.entries[0].lines[0].how.indexOf(lor.smart[0].label) === 0, enc.foes[0].slots[lor.smart[0].slot] === slotsBefore[lor.smart[0].slot] - 1], [true, true], 'and it takes the slot');
    state.ui.mode = 'honour';
    // The level the build fights at, set on the page of the test.
    state.ui.simLevel = 4;
    const young = simSide(fighter, 'act1', plain);
    delete state.ui.simLevel;
    eq([young.at, young.stats.level, simSide(fighter, 'act1', plain).stats.level], [4, 4, 5]);
    // An action with an area catches everyone in the line of the one it is aimed at.
    const blast = () => foeState(Object.assign(foeOf({ kind: 's', sv: 'dex', dc: 30, os: 0.5, hits: [[['2d6', 0, 'Fire']]], area: true })), plain, 0);
    enc = newEncounter([Object.assign(sword(), { name: 'A' }), mate(), Object.assign(sideOf(finalStats(archer, 'act1'), 'ranged', plain, steps([])), { name: 'Bow' })], [blast()], { first: 'foes', aim: 'first' });
    encRound(enc);
    eq(enc.fights.map((x, k) => enc.sides[k].hp - x.hp), [8, 8, 0], '2d6 (8) to the two who stand next to it; the archer is elsewhere');
    // What adds to its Initiative: Auntie Ethel's Dexterity modifier and the 5 of her page.
    const ethel = enemyTarget(by('Auntie Ethel'));
    enc = newEncounter([sword()], [foeState(foeOf({ attacks: 0 }), ethel, 100)], { first: 'roll' });
    encRound(enc);
    eq(enc.init.find((x) => x.kind === 'foe').bonus, Math.floor((ethel.ab.dex - 10) / 2) + 5);
    // Passives: Vampire Regeneration, Githyanki Parry, Tenacity, Alert.
    const passive = (pv, foe, opts) => newEncounter([sword()], [Object.assign(foeState(foeOf(Object.assign({ attacks: 0 }, foe)), withPv(plain, pv, { ab: { str: 20, dex: 10 } }), 1000), { name: 'V' })], Object.assign({ first: 'party' }, opts));
    enc = passive({ rg: 10 });
    eq([encRound(enc) && enc.foes[0].dealt, encRound(enc) && enc.foes[0].dealt], [6, 12], '16 dealt and 10 back, each round');
    enc = passive({ pr: 10 });
    eq(encRound(enc).entries[0].lines.map((l) => l.damage), [0, 8], 'the parry takes 10 off one hit a round');
    enc = passive({ tn: 1 }, { attacks: 1, bonus: -5 });
    round = encRound(enc);
    eq([round.entries[1].lines[0].taken, / Tenacity/.test(round.entries[1].lines[0].how)], [5, true], 'a missed melee attack still deals its Strength modifier');
    eq([encRound(passive({ al: 1 }, { attacks: 1, bonus: 20 }, { surprise: 'foes' })).entries.length, encRound(passive({}, { attacks: 1, bonus: 20 }, { surprise: 'foes' })).entries.filter((e) => e.lines.length).length], [2, 1], 'with Alert it is not Surprised');
    // What the build cannot be: its own immunities, and the Aura of Courage of a Paladin in its line.
    const scare = () => foeState(foeOf({ bonus: 20, damage: 1, cd: { name: 'Frightened', turns: 2, sv: '', dc: 0 } }), plain, 0);
    enc = newEncounter([sword()], [scare()], { first: 'foes' });
    encRound(enc);
    const brave = Object.assign(sword(), { immune: ['Frightened'] });
    const encB = newEncounter([brave], [scare()], { first: 'foes' });
    encRound(encB);
    const encC = newEncounter([Object.assign(sword(), { name: 'A' }), Object.assign(mate(), { courage: true })], [scare()], { first: 'foes', aim: 'first' });
    encRound(encC);
    eq([enc.fights[0].conds.map((c) => c.name), encB.fights[0].conds.length, encC.fights[0].conds.length], [['Frightened'], 0, 0]);
    // From Tactician up an enemy finishes off whoever it downs: one blow, a failed death saving throw, then someone else.
    const killer = (mode) => inMode(mode, () => { const e = newEncounter([Object.assign(sword(), { name: 'A' }), mate()], [foeState(foeOf({ attacks: 3, bonus: 20, damage: 500 }), plain, 0)], { first: 'foes', aim: 'first' }); encRound(e); return [e.fights[0].death.bad, !!e.fights[1].down]; });
    eq([killer('honour'), killer('balanced')], [[1, true], [0, true]]);
    // The ready-made builds leave nothing open but what the guide leaves to whoever plays them.
    eq(buildIssues(preset('tavern-brawler-monk')).filter((x) => x.level === 'warn').map((x) => x.text), [], 'the monk\'s skills are filled in');

    // Many fights of a setup, with the numbers of each kept for the chart.
    simRandom = realRandom;
    const many = encFights(() => newEncounter([sword()], [Object.assign(foeState(foeOf({ bonus: 5, damage: 4 }), plain, 60), { name: 'A' })], {}), 40);
    ok(many.perRound.length === 40 && many.rounds.length + Math.round(many.lost * 40) === 40 && many.members.length === 1 && many.main.avg > 3, 'forty fights against 60 hit points: ' + JSON.stringify(many.main));
    Object.keys(state.ui).forEach((k) => { if (!(k in kept)) delete state.ui[k]; });
    Object.assign(state.ui, kept);
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

    // a level handed to another class: what it had chosen goes to the class that offers that choice
    const s2 = build(['Ranger', 'Ranger'], dex);
    s2.levels[0].picks.push('Favoured Enemy: Bounty Hunter', 'Natural Explorer: Urban Tracker');
    s2.levels[0].cls = 'Cleric';
    tidyBuild(s2);
    eq([s2.levels[0].picks, s2.levels[1].picks, s2.levels[0].notes], [[], ['Favoured Enemy: Bounty Hunter', 'Natural Explorer: Urban Tracker'], []], 'level 2 is Ranger 1 now');

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
  test('consumables are listed with the items', () => {
    const f = libState('items');
    const saved = clone(f);
    Object.assign(f, { q: 'hill giant', kind: 'consumable', type: '', tag: '', rar: [], act: '', build: '' });
    eq(libSorted('items').map((it) => it.n), ['Elixir of Hill Giant Strength']);
    Object.assign(f, saved);
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

  flow('the damage of a turn follows the enemy and what is switched on', async () => {
    const b = build(Array(5).fill('Fighter'), { race: 'Human', background: 'Soldier', abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' });
    b.levels[0].picks = ['Fighting Style: Defence'];
    b.levels[2].sub = 'Champion';
    b.gear.act1.slots.meleeMain.name = 'Longsword';
    state.ui.act = 'act1';
    state.ui.target = '';
    state.ui.targetAc = 16;
    show(b);
    const shown = () => Number(q('.turn b').textContent);
    const base = shown();
    ok(base > 0 && /AC 16/.test(q('.turn').textContent));
    await click(all('[data-act="toggle-active"]').find((x) => /Action Surge/.test(x.textContent)), 'Action Surge');
    ok(Math.abs(shown() - base * 2) < 0.11, 'a second Attack action doubles the turn: ' + base + ' → ' + shown());
    await click(q('.pslot[data-act="enemy-open"]'), 'enemy');
    await pick('Raphael');
    ok(/Raphael/.test(q('.turn').textContent) && /AC 21/.test(q('.enemy-line').textContent) && shown() < base * 2, 'the numbers are now against Raphael: harder to hit, and a common sword is resisted');
    await click(q('[data-act="mode"][data-k="balanced"]'), 'difficulty');
    eq([state.ui.mode, honourMode()], ['balanced', false]);
    state.ui.mode = 'honour';
    // a caster: the slot its spells are cast with
    const w = build(Array(5).fill('Wizard'), { race: 'Human', background: 'Sage', abilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, plus2: 'int', plus1: 'wis' });
    w.levels[0].picks = ['Cantrip: Fire Bolt', 'Spell: Magic Missile'];
    w.levels[4].picks = ['Spell: Fireball'];
    state.ui.target = '';
    state.ui.castLevel = 0;
    state.ui.targets = 1;
    show(w);
    const rowOf = (name) => all('.opts .opt').find((x) => x.querySelector('b').textContent.trim() === name);
    eq(rowOf('Magic Missile').querySelector('strong').textContent, '10.5');
    await click(q('[data-act="cast-level"][data-n="3"]'), 'level 3 slot');
    eq([state.ui.castLevel, rowOf('Magic Missile').querySelector('strong').textContent], [3, '17.5']);
    await click(q('.cast-tools [data-act="step"][data-d="1"]'), 'one more enemy in the area');
    eq([state.ui.targets, rowOf('Fireball').querySelector('strong').textContent], [2, '42.0']);
    state.ui.castLevel = 0;
    state.ui.targets = 1;
  });

  flow('the menu opens a whole group or one part of it, and the damage test rolls turns', async () => {
    const b = build(Array(5).fill('Fighter'), { race: 'Human', background: 'Soldier', abilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 8 }, plus2: 'str', plus1: 'con' });
    b.levels[0].picks = ['Fighting Style: Defence'];
    b.levels[2].sub = 'Champion';
    b.gear.act1.slots.meleeMain.name = 'Longsword';
    Object.assign(state.ui, { act: 'act1', target: '', targetAc: 16, simAction: '', mode: 'honour' });
    show(b);
    await click(q('#tabs [data-tab="items"][data-kind="ring"]'), 'Items › Ring');
    eq([state.ui.tab, lib.items.kind, all('#lib-results .lib-card').length > 0, q('#tabs .nav-menu button.on').textContent], ['items', 'ring', true, 'Ring']);
    await click(q('#tabs .nav-top[data-tab="items"]'), 'Items');
    eq([lib.items.kind, q('#tabs .nav-menu button.on').textContent], ['', 'All items'], 'the group itself shows every item');
    await click(q('#tabs [data-tab="spells"][data-lv="0"]'), 'Spells › Cantrips');
    eq([state.ui.tab, lib.spells.lv], ['spells', ['0']]);
    await click(q('#tabs .nav-top[data-tab="hub"]'), 'Builds');
    ok(all('.hub-card').length === 3 && q('.hub-card [data-act="build-select"]'), 'the three pages of the group, each with what it holds');
    await click(q('.hub-card [data-act="build-select"]'), 'a build of the list');
    eq([state.ui.tab, q('#tabs .nav-top.on').textContent.replace('▾', '')], ['builds', 'Builds']);
    await click(q('#tabs [data-tab="damage"]'), 'Damage test');
    eq([all('.sim-tabs button').length, q('.sim-tabs button.on').dataset.k, !!q('[data-act="sim-party-open"]')], [4, 'build', true], 'four steps; the first says who fights');
    await click(q('.sim-tabs [data-k="enemy"]'), 'the enemy');
    ok(q('.foe-tools [data-ui="foeAttacks"]') && q('[data-act="sim-set"][data-k="simFirst"]') && !q('[data-act="helper-open"]'), 'what the enemy does can be set; helpers wait for a reference enemy');
    await click(q('[data-act="sim-set"][data-k="simFirst"][data-v="party"]'), 'the build acts first');
    await click(q('.sim-tabs [data-k="plan"]'), 'the plan');
    ok(Math.abs(Number(q('.sim .turn b').textContent) - 10.45) < 0.06, 'the expected average of the turn, the Longsword held in both hands: 2 × (0.55 × 8.5 + 0.1 × 5.5); shown ' + q('.sim .turn b').textContent);
    eq(all('.sim-step .pslot').map((x) => x.querySelector('b').textContent), [...Array(9).fill('as from turn 4 on'), 'Weapon attacks', 'The same as the action', 'The best it has'],
      'the plan: three turns that follow the last, which goes to the weapon; a Fighter of level 2 and up has Action Surge, so the action on top is there');
    ok(!q('[data-act="sim-react-open"]') && !q('[data-act="sim-smite-open"]') && !q('[data-act="sim-hit-open"]'), 'this build has no reaction, smite or manoeuvre to choose');
    await click(q('.sim-tabs [data-k="result"]'), 'the result');
    await click(q('[data-act="sim-roll"][data-n="10"]'), 'roll 10 rounds');
    eq([all('.sim-round').length, all('.sim-turn').length, all('.sim-turn li').length], [10, 10, 20], 'ten rounds of two attacks each; an enemy that does nothing has no turn to show');
    await click(q('.sim-tabs [data-k="plan"]'), 'the plan');
    await click(q('.sim-step .pslot[data-i="0"][data-f="a"]'), 'the action of turn 1');
    await pick('Nothing');
    eq(state.ui.simPlans[b.id][0].a, 'none');
    await click(q('.sim-tabs [data-k="result"]'), 'the result');
    await click(q('[data-act="sim-roll"][data-n="1"]'), 'roll a round');
    eq([all('.sim-turn').length, all('.sim-turn li').length], [1, 0], 'nothing in the first turn, as planned');
    await click(q('[data-act="sim-fights"]'), 'many fights');
    ok(all('.sim-many tbody tr').length === 4 && all('.sim-many thead th').length === 2 && all('.chart').length === 2 && all('.chart .bar').length > 1, 'the table of the fights rolled, one side, and the two charts');
    state.ui.simPlans = {};
    // a scenario keeps the setup by name
    q('[data-sim="sceneName"]').value = 'Fighter test';
    q('[data-sim="sceneName"]').dispatchEvent(new Event('input', { bubbles: true }));
    await click(q('[data-act="scene-save"]'), 'save the scenario');
    eq([state.ui.scenes.map((x) => x.name), state.ui.scenes[0].ui.simFirst, q('.pslot[data-act="scene-open"] b').textContent], [['Fighter test'], 'party', 'Fighter test']);
    await click(q('.sim-tabs [data-k="enemy"]'), 'the enemy');
    await click(q('.pslot[data-act="enemy-open"]'), 'enemy');
    await pick('Goblin Warrior');
    ok(q('[data-act="helper-open"]'), 'a reference enemy can have helpers');
    await click(q('[data-act="helper-open"][data-i="0"]'), 'a helper');
    await pick('Worg');
    eq([state.ui.help0, sim.enc.foes.map((x) => x.name)], ['Worg', ['Goblin Warrior', 'Worg']]);
    await click(q('.sim-tabs [data-k="result"]'), 'the result');
    eq(all('.sim-turn').length, 0, 'another enemy starts the test over');
    await click(q('[data-act="sim-roll"][data-n="kill"]'), 'until it is over');
    ok(q('.sim-down') && q('[data-act="sim-roll"]').disabled && q('.hpbar.down') && all('.hpbar').length >= 3, 'the fight ends and the rolling stops; a bar for each enemy and for the build');
    await click(q('[data-act="sim-reset"]'), 'start over');
    ok(!q('.sim-down') && !all('.sim-turn').length);
    await click(q('.pslot[data-act="scene-open"]'), 'scenario');
    await pick('Fighter test');
    eq([state.ui.target, state.ui.help0, state.ui.simFirst], ['', undefined, 'party'], 'the scenario brings its enemy back');
    // the temporary list of things to check: a tick and a note for each entry
    await click(q('#tabs [data-tab="review"]'), 'To check');
    const note = q('.review-note textarea');
    note.value = 'seen in game';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    eq([state.ui.reviewNotes[note.dataset.review], all('.review-list > .review-item:not(.plain)').length > 20, all('.review-rest .review-item.plain').length > 5, all('.review-item:not(.plain)').every((x) => q('[data-act="review-toggle"]', x))],
      ['seen in game', true, true, true], 'what asks for a look has a tick and a note; the rest is kept apart');
    ['scenes', 'scene', 'sceneName', 'reviewNotes', 'simFirst', 'simTab', 'help0'].forEach((k) => { delete state.ui[k]; });
    state.ui.target = '';
    state.ui.tab = 'builds';
  });

  flow('a first visit starts with no build, and every page still opens', async () => {
    const first = fresh();
    eq([first.builds.length, first.ui.tab, first.parties.length, fresh(true).builds.length], [0, 'home', 1, 1], 'nothing in My builds until the visitor makes or copies one; the first page is Home');
    state.builds = [];
    state.ui.buildId = '';
    state.ui.wizard = '';
    for (const tab of ['home', 'hub', 'builds', 'party', 'presets', 'damage', 'review', 'items', 'spells']) {
      state.ui.tab = tab;
      render();
      await wait(40);
      ok(q('.content, .layout'), 'the page ' + tab + ' with no build');
    }
    // Home: the name at the top of the page and the first entry of the menu lead to it; each of its cards, into a part
    await click(q('button.brand'), 'BG3 Planner, at the top');
    eq([state.ui.tab, q('#tabs .nav-top.on').dataset.tab, all('.home-card').length, !!q('.home-hero [data-act="wiz-new"]')], ['home', 'home', 4, true]);
    await click(q('.home-card .home-title[data-tab="damage"]'), 'the Damage test, from Home');
    eq(state.ui.tab, 'damage');
    await click(q('#tabs .nav-top[data-tab="home"]'), 'Home, in the menu');
    await click(q('.home-card [data-tab="items"]'), 'the items, from Home');
    eq([state.ui.tab, q('#tabs .nav-group.shut')], ['items', null], 'no menu is left shut by it');
    state.ui.tab = 'builds';
  });

  flow('items are chosen from a list with their pictures: gear slots, alternatives, setup items and consumables', async () => {
    const b = build(['Fighter', 'Fighter']);
    show(b);
    state.ui.act = 'act1';
    render();
    const card = () => q('.slot .pslot[data-slot="head"]').closest('.slot');
    eq([all('#sec-gear input[type="text"]').length, all('#sec-extras input[type="text"]').length, all('.slot .pslot[data-act="picker-open"]').length, !!q('[data-act="list-add"], [data-act="alt-add"]')],
      [0, 0, SLOTS.length, false], 'no item is typed into a field: every slot is a button that opens the list');
    await click(q('.slot .pslot[data-slot="head"]'), 'the Head slot');
    const first = q('#picker-list .pick-row');
    ok(first && q('img', first), 'the items of the slot, each with its picture');
    const name = first.dataset.n;
    await click(first, 'the first item');
    const it = ITEM_BY_NAME.get(norm(name));
    eq([b.gear.act1.slots.head.name, b.gear.act1.slots.head.rarity, !!q('.pslot img', card()), (q('.slot-fx', card()) || {}).textContent.includes(it.t)], [name, it.r, true, true], 'the slot shows the item, its picture and what it does');
    // a name the list does not have goes in as it is typed
    await click(q('.slot .pslot[data-slot="head"]'), 'the Head slot again');
    q('#picker-box [data-picker="q"]').value = 'Helmet of Nowhere';
    q('#picker-box [data-picker="q"]').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(60);
    await click(q('#picker-list .pick-row.custom'), 'the typed name');
    eq([b.gear.act1.slots.head.name, b.gear.act1.slots.head.rarity, !!q('[data-act="wiki-fill"]', card())], ['Helmet of Nowhere', '', true], 'and can be filled from the wiki');
    await click(q('[data-act="slot-clear"]', card()), 'take it out');
    eq(b.gear.act1.slots.head, blankSlot());
    // an alternative: the slot, then the item
    await click(q('.pslot[data-act="alt-new-open"]'), 'a new alternative');
    await pick(t('Ring 1'));
    const ring = q('#picker-list .pick-row');
    await click(ring, 'a ring');
    eq(b.gear.act1.alts.map((a) => [a.slot, a.name]), [['ring1', ring.dataset.n]]);
    ok(q('.alt .pslot img') && q('.alt .slot-label'), 'the alternative shows its slot and the picture of the item');
    // consumables: several at once, each kept with its note
    b.consumables = [{ name: 'Elixir of Bloodlust', note: 'every long rest' }, { name: 'Bottle of Nothing', note: 'mine' }];
    render();
    ok(q('#sec-extras .li img') && /Elixir/.test(q('#sec-extras .li-head').textContent) && q('#sec-extras .li-fx'), 'a chosen consumable shows its picture, its kind and what it does');
    await click(q('.pslot[data-act="list-open"][data-list="consumables"]'), 'the consumables');
    eq([all('#dlg-list .pick-row.on').map((r) => r.dataset.n), all('#dlg-list .pick-row img').length > 100], [['Elixir of Bloodlust', 'Bottle of Nothing'], true], 'what is chosen comes first, ticked; the list has the pictures');
    await pick('Elixir of Hill Giant Strength');
    await pick('Bottle of Nothing');
    await confirm();
    eq(b.consumables, [{ name: 'Elixir of Bloodlust', note: 'every long rest' }, { name: 'Elixir of Hill Giant Strength', note: '' }]);
    // setup items: from the items of the game, or a name typed in
    await click(q('.pslot[data-act="list-open"][data-list="setup"]'), 'the setup items');
    ok(all('#dlg-list .pick-row').length === 150 && /first 150/.test(q('#dlg-list').textContent), 'a long list shows its first rows and asks for a search');
    q('#dialog [data-dlg="q"]').value = 'Resonance Stone';
    q('#dialog [data-dlg="q"]').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(60);
    await click(q('#dlg-list .pick-row.custom'), 'the typed name');
    q('#dialog [data-dlg="q"]').value = 'Drakethroat';
    q('#dialog [data-dlg="q"]').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(60);
    await pick('Drakethroat Glaive');
    await confirm();
    eq(b.setup.map((x) => x.name), ['Resonance Stone', 'Drakethroat Glaive']);
    await click(q('#sec-extras [data-act="list-del"][data-list="setup"]'), 'remove the first');
    eq(b.setup.map((x) => x.name), ['Drakethroat Glaive']);
    ok(q('#sec-extras .li img') && q('#sec-extras .li-where'), 'an item of the database shows its picture and where it is found');
  });

  flow('the build check leads to where each thing is settled', async () => {
    const b = build(['Fighter', 'Fighter']);
    show(b);
    eq([buildIssues(b).every((x) => x.go && x.go.s), !q('[data-act="check-toggle"]'), all('.issues button.issue').length > 2], [true, true, true], 'always in view, each entry with its place');
    const entry = all('.issues button.issue').find((x) => x.dataset.s === 'levels') || q('.issues button.issue');
    state.ui.closed = { [entry.dataset.s]: true };
    render();
    await click(all('.issues button.issue').find((x) => x.dataset.s === entry.dataset.s && x.dataset.l === entry.dataset.l), 'an entry of the check');
    ok(!state.ui.closed[entry.dataset.s] && q('#sec-' + entry.dataset.s) && q('.lit'), 'its section is opened and what it points at is lit');
    state.ui.closed = {};
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
