// Item tags and recommendations. An item is judged first by what it changes in the build's own numbers
// (attack, damage, armour class, spell save DC, hit points…) and then by the effects the numbers cannot
// show, which are read as tags from its text and weighed by the goal and by the build's profile.
'use strict';

const ABILITY_NAMES = 'strength|dexterity|constitution|intelligence|wisdom|charisma';
// [key, label, what to look for in the item's effect text]
const ITEM_TAGS = [
  ['damage', 'Extra damage', /(additional|extra|bonus) [^.;]*damage|deals? an additional|\+\d+ (?:to )?damage|\d+d\d+ [A-Z][a-z]+ damage|damage rolls? \+\d/i],
  ['crit', 'Critical hits', /critical/i],
  ['accuracy', 'Attack rolls', /advantage on (?:[a-z]+ )*attack rolls|bonus to (?:[a-z]+ )*attack rolls|attack rolls? \+\d|\+\d (?:bonus )?to (?:[a-z]+ )*attack rolls/i],
  ['spelldc', 'Spell DC', /spell save dc|spell attack|arcane acuity/i],
  ['spells', 'Grants spells', /\bcast\b|spell slot|cantrip/i],
  ['defence', 'Protection', /resistance to|damage (?:is )?reduced|reduces? (?:all )?incoming|can(?:no|')t land critical|disadvantage on attack rolls against|temporary hit points|immun/i],
  ['saves', 'Saving throws', /saving throws? \+\d|\+\d (?:bonus )?to (?:[a-z ,]+ )?saving throws|advantage on (?:[a-z, ]+ )?saving throws|bonus to armour class and saving throws/i],
  ['initiative', 'Initiative', /initiative/i],
  ['mobility', 'Mobility', /movement speed|\bjump|misty step|\bdash\b|\bfly\b|teleport|difficult terrain/i],
  ['stealth', 'Stealth', /stealth|invisib|obscured|\bhid(?:e|den|ing)\b/i],
  ['healing', 'Healing', /\bheal|regain[s]? [^.;]*hit points/i],
  ['control', 'Control', /\b(prone|stunn?ed|stun|frighten(?:ed)?|blind(?:ed)?|paraly[sz]ed?|restrain(?:ed)?|slow(?:ed)?|charm(?:ed)?|dazed?|frozen|silenced?|off balance|reeling|bane)\b/i],
  ['ability', 'Ability score', new RegExp('(?:' + ABILITY_NAMES + ') (?:score )?(?:to|by|increases) \\d|\\+\\d (?:' + ABILITY_NAMES + ')|(?:' + ABILITY_NAMES + ') \\+\\d', 'i')],
  ['skills', 'Skill checks', /checks? \+\d|\+\d (?:bonus )?to [^.;]*checks|advantage on [^.;]*checks|(?:athletics|acrobatics|sleight of hand|persuasion|deception|intimidation|perception|performance) \+\d/i],
  ['unarmed', 'Unarmed', /unarmed/i],
  ['thrown', 'Throwing', /thrown (?:weapon|attack|object)|when (?:it is |you )?throw|\bhurl/i],
  ['concentration', 'Concentration', /concentrat/i],
  ['summon', 'Summons', /summon/i],
];
// Named effects that several items build on together.
const ENGINES = ['Reverberation', 'Radiating Orb', 'Lightning Charges', 'Encrusted with Frost', 'Arcane Synergy', 'Arcane Acuity', 'Momentum', 'Wrath', 'Force Conduit', 'Heat', 'Bleeding', 'Burning', 'Mental Fatigue'];
const ELEMENTS = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];
const TAG_LABEL = Object.fromEntries(ITEM_TAGS.map(([k, label]) => [k, label]).concat([['ac', 'Armour Class'], ['synergy', 'Combo effect']]));

const itemText = (it) => [it.x || '', it.sp || '', ...(it.ps || []).map((p) => p.join(' '))].join(' ');
function tagItem(it) {
  const text = itemText(it);
  const tags = ITEM_TAGS.filter(([, , re]) => re.test(text)).map(([k]) => k);
  if (itemAcBonus(it)) tags.push('ac');
  it.en2 = ENGINES.filter((e) => text.includes(e));
  if (it.en2.length) tags.push('synergy');
  it.el = ELEMENTS.filter((e) => new RegExp('\\b' + e + '\\b').test(text) || (it.d || '').includes(e));
  it.g = tags;
}
ITEMS.forEach(tagItem);

// ---------- build profile ----------
const FULL_CASTERS = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'];
const CASTING_ABILITY = { Bard: 'cha', Cleric: 'wis', Druid: 'wis', Sorcerer: 'cha', Warlock: 'cha', Wizard: 'int', Paladin: 'cha', Ranger: 'wis' };

function buildProfile(b, act) {
  const info = levelInfo(b);
  const levels = {};
  info.forEach((x) => { if (x.cls) levels[x.cls] = (levels[x.cls] || 0) + 1; });
  const total = charLevel(b);
  const picks = allPicks(b).join(' | ');
  const subs = new Set(info.map((x) => x.sub).filter(Boolean));
  const stats = finalStats(b, act);
  const casterLevels = FULL_CASTERS.reduce((a, c) => a + (levels[c] || 0), 0);
  const has = (re) => re.test(picks);
  let style = 'melee';
  if ((levels.Monk || 0) >= 3) style = 'unarmed';
  else if (has(/tavern brawler/i) && levels.Barbarian) style = 'thrown';
  else if (has(/archery|sharpshooter/i)) style = 'ranged';
  // a warlock who fights with a pact weapon is a weapon user, however many caster levels it has
  else if (subs.has('The Hexblade') || has(/pact of the blade/i)) style = 'melee';
  else if (total && casterLevels * 2 >= total && !(levels.Paladin >= casterLevels)) style = 'caster';
  const topCaster = Object.keys(levels).filter((c) => CASTING_ABILITY[c]).sort((a, c) => levels[c] - levels[a])[0];
  const main = style === 'ranged' ? 'dex' : style === 'caster' ? (CASTING_ABILITY[topCaster] || 'cha')
    : style === 'thrown' ? 'str' : (stats.scores.str >= stats.scores.dex ? 'str' : 'dex');
  const known = currentSpells(b).map((x) => SPELL_BY_NAME.get(norm(x.name))).filter(Boolean);
  // damage types the build deals: from its spells and from choices that name one (not from resistances)
  const dealing = allPicks(b).filter((x) => !/resist|wanderer|ward/i.test(x)).join(' | ');
  const elements = new Set(ELEMENTS.filter((e) => new RegExp('\\b' + e + '\\b', 'i').test(dealing) || known.some((s) => (s.dm || '').includes(e))));
  if (subs.has('Tempest Domain') || subs.has('Storm Sorcery')) { elements.add('Lightning'); elements.add('Thunder'); }
  return {
    style, main, levels, total, stats, elements,
    prof: proficiencies(b),
    crit: subs.has('Champion') || subs.has('Assassin') || has(/critical|\bcrit\b/i),
    stealth: !!levels.Rogue || subs.has('Gloom Stalker') || stats.skills.some((k) => k.name === 'Stealth' && k.proficient),
    caster: casterLevels > 0 || !!levels.Paladin || !!levels.Ranger,
    monk: !!levels.Monk,
    dual: has(/dual wielder|two-weapon fighting/i),
  };
}
const STYLE_LABEL = { melee: 'Melee', ranged: 'Ranged', caster: 'Caster', unarmed: 'Unarmed', thrown: 'Thrower' };
function profileText(p) {
  const traits = [p.crit ? t('critical hits') : '', p.stealth ? t('stealth') : '', p.dual ? t('two weapons') : '', ...[...p.elements].map((e) => e.toLowerCase())].filter(Boolean);
  return t(STYLE_LABEL[p.style]) + ' · ' + p.main.toUpperCase() + (traits.length ? ' · ' + traits.join(', ') : '');
}

// ---------- what an item changes in the numbers ----------
// The numbers a goal looks at: armour class, hit points, initiative, saving throws, the main attack
// (bonus and average damage per hit) and the best spell save DC and spell attack.
function keyNumbers(s, act, style) {
  const r = mainAttack(s, style);
  return { ac: s.ac[act], hp: s.hp, initiative: s.initiative, saves: s.saves.reduce((a, k) => a + k.bonus, 0),
    attack: r ? r.attackTotal : 0, damage: avgDamage(r),
    dc: s.casting.length ? Math.max(...s.casting.map((c) => c.dc)) : 0,
    spellAttack: s.casting.length ? Math.max(...s.casting.map((c) => c.attack)) : 0 };
}
// The numbers with the item in the slot (or with the slot empty, for a null item).
const numbersWith = (b, act, slot, it, style, level) => keyNumbers(finalStats(b, act, { swap: { [slot]: it }, level }), act, style);
// What differs between two sets of numbers, e.g. { ac: 1, attack: -1 }.
function numbersDiff(now, base) {
  const out = {};
  Object.keys(now).forEach((k) => { const d = Math.round((now[k] - base[k]) * 10) / 10; if (d) out[k] = d; });
  return out;
}
// What moves in the numbers with the item in the slot, against a base.
const gearDelta = (b, act, slot, it, base, style, level) => numbersDiff(numbersWith(b, act, slot, it, style, level), base);
const DELTA_LABEL = { attack: 'Attack', damage: 'Damage', dc: 'Spell save DC', spellAttack: 'Spell attack', ac: 'AC', hp: 'Hit points', saves: 'Saving throws', initiative: 'Initiative' };
// The six saving throws are compared as a total; when all move together, say it per saving throw.
const deltaBit = (k, v) => (k === 'saves' && v % 6 === 0 ? t('Every saving throw') + ' ' + (v > 0 ? '+' : '−') + Math.abs(v / 6)
  : t(DELTA_LABEL[k]) + (k === 'saves' ? ' (' + t('total') + ')' : '') + ' ' + (v > 0 ? '+' : '−') + Math.abs(v));
const deltaText = (d) => Object.keys(DELTA_LABEL).filter((k) => d[k]).map((k) => deltaBit(k, d[k])).join(' · ');
// What one point of each number is worth to each goal.
const DELTA_WEIGHT = {
  damage: { attack: 1.6, damage: 1, dc: 2, spellAttack: 1.2, initiative: 0.3 },
  defence: { ac: 2.5, hp: 0.12, saves: 0.5, initiative: 0.3 },
  versatile: { ac: 1, hp: 0.06, saves: 0.3, initiative: 0.5, attack: 0.8, damage: 0.5, dc: 1, spellAttack: 0.6 },
};
// A weapon number means little to a caster, a spell number little to someone who does not cast.
const deltaFit = (k, p) => ((k === 'attack' || k === 'damage') && p.style === 'caster' ? 0.2
  : (k === 'dc' || k === 'spellAttack') && p.style !== 'caster' ? (p.caster ? 0.4 : 0) : 1);

// ---------- scoring ----------
const GOALS = {
  damage: { damage: 3, accuracy: 2.5, crit: 2, spelldc: 2.5, synergy: 1.5, initiative: 1, spells: 0.5, control: 0.5 },
  defence: { defence: 1.5, saves: 1.2, healing: 1, initiative: 0.6, stealth: 0.4, mobility: 0.4 },
  versatile: { spells: 2, mobility: 2, skills: 2, control: 1.5, stealth: 1.5, initiative: 1.5, saves: 1, healing: 1, damage: 1, synergy: 1 },
};
const GOAL_LABEL = { damage: 'Best for damage', defence: 'Best for defence', versatile: 'Most versatile' };
// Tags whose effect, when it is a flat bonus, already shows in the numbers: counted there, not twice.
const TAG_NUMBER = { initiative: 'initiative', saves: 'saves', spelldc: 'dc' };

// How much a tag of this item matters to this build, as a multiplier, with the reason when it stands out.
function tagFit(tag, it, p, text) {
  if (tag === 'damage' || tag === 'accuracy' || tag === 'crit') {
    const onlyRanged = /ranged/i.test(text) && !/melee/i.test(text);
    const onlyMelee = /melee/i.test(text) && !/ranged/i.test(text);
    if (/unarmed/i.test(text) && p.style !== 'unarmed') return [0.15, ''];
    if (onlyRanged && p.style !== 'ranged') return [0.2, ''];
    if (onlyMelee && (p.style === 'ranged' || p.style === 'caster')) return [0.2, ''];
    if (/spell/i.test(text) && !/weapon/i.test(text) && p.style !== 'caster') return [0.4, ''];
    if (tag === 'crit' && p.crit) return [1.6, t('your build crits often')];
    // Advantage on every attack is worth far more than a flat +1
    if (tag === 'accuracy' && /gains? advantage on attack rolls/i.test(text)) return [1.8, t('Advantage on every attack')];
    return [1, ''];
  }
  if (tag === 'spelldc') return p.style === 'caster' ? [1.6, t('you cast for a living')] : p.caster ? [0.6, ''] : [0.1, ''];
  if (tag === 'spells') return p.style === 'caster' ? [0.8, ''] : [1, ''];
  if (tag === 'stealth') return p.stealth ? [1.6, t('your build relies on stealth')] : [0.5, ''];
  if (tag === 'unarmed') return p.style === 'unarmed' ? [1, ''] : [0, ''];
  if (tag === 'thrown') return p.style === 'thrown' ? [1, ''] : [0, ''];
  if (tag === 'concentration') return p.caster ? [1, ''] : [0.2, ''];
  return [1, ''];
}

// Score of one item for a slot, an act and a goal: { score, reasons, delta }.
// The score measures the item against an empty slot, so the ranking does not depend on what happens to be
// worn; the reasons and the delta say what changes against what is worn now.
function scoreItem(b, p, it, slot, act, goal, base, empty) {
  const weights = GOALS[goal];
  const text = itemText(it);
  const reasons = [];
  let score = 0;
  // a monk in armour loses Unarmoured Defence and movement, so armour is not offered
  if (slot === 'chest' && p.monk && ARMOUR_TYPES.includes(it.t)) return { score: 0, reasons: [], delta: {} };
  // first, what the item does to the numbers of this build
  const now = numbersWith(b, act, slot, it, p.style, p.level);
  const delta = numbersDiff(now, base);
  const worth = numbersDiff(now, empty || base);
  Object.keys(worth).forEach((k) => {
    const w = (DELTA_WEIGHT[goal][k] || 0) * deltaFit(k, p);
    if (!w) return;
    score += worth[k] * w;
    if (delta[k] > 0) reasons.push([10 + delta[k] * w, deltaBit(k, delta[k])]);
  });
  // then the effects the numbers do not show; an effect reserved for a race the build is not counts for little
  const races = Object.keys(RACES).filter((r) => new RegExp('\\b' + r.replace('-', '.?') + '(?:s|es|ves)?\\b', 'i').test(text.replace(/dwarves/gi, 'dwarf').replace(/elves/gi, 'elf')));
  const gate = races.length && !races.includes(b.creation.race) ? 0.2 : 1;
  it.g.forEach((tag) => {
    const w = weights[tag];
    if (!w || (TAG_NUMBER[tag] && worth[TAG_NUMBER[tag]])) return;
    const [base_fit, why] = tagFit(tag, it, p, text);
    const fit = base_fit * gate;
    if (fit <= 0) return;
    score += w * fit;
    reasons.push([w * fit, t(TAG_LABEL[tag]) + (why ? ' (' + why + ')' : '')]);
  });
  if (it.s === 'shield' && (p.monk || p.style === 'ranged')) score -= 1;
  if (isWeapon(it) && it.s === 'melee' && p.main === 'dex' && !(it.pp || []).includes('Finesse') && (slot === 'meleeMain') && weights.damage) reasons.push([0, t('not a finesse weapon, so it uses Strength')]);
  const matched = (it.el || []).filter((e) => p.elements.has(e));
  if (matched.length && weights.damage) { score += 1.5; reasons.push([1.5, t('matches your {el} damage', { el: matched.join(', ') })]); }
  const partners = SLOTS.map(([k]) => (k === slot ? null : ITEM_BY_NAME.get(norm(b.gear[act].slots[k].name)))).filter((x) => x && (x.en2 || []).some((e) => (it.en2 || []).includes(e)));
  if (partners.length) { score += 1.5; reasons.push([1.5, t('combines with {x}', { x: partners[0].n })]); }
  if (score > 0) score += RARITY_RANK[it.r] * 0.25;
  reasons.sort((x, y) => y[0] - x[0]);
  return { score, reasons: reasons.slice(0, 4).map((r) => r[1]), delta };
}

// The numbers the picker compares against: the build as it is, at the level it is marked at.
function recommendBase(b, act) {
  const p = buildProfile(b, act);
  p.level = b.current && b.current < charLevel(b) ? b.current : 0;
  return { p, base: keyNumbers(finalStats(b, act, { level: p.level }), act, p.style) };
}
// The usable items of a slot, best first for the goal.
// An item another member of the party already wears drops down the list, and says who has it.
function recommend(b, slot, act, goal, list) {
  const { p, base } = recommendBase(b, act);
  const empty = numbersWith(b, act, slot, null, p.style, p.level);
  const taken = partyTaken(b, act);
  return list.map((it) => {
    const r = Object.assign({ it }, scoreItem(b, p, it, slot, act, goal, base, empty));
    if (taken[norm(it.n)]) { r.score *= 0.3; r.taken = taken[norm(it.n)]; }
    return r;
  }).filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score || x.it.n.localeCompare(y.it.n));
}
