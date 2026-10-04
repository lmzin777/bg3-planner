// Item tags and recommendations. Every item gets tags from the text of its effects; a build gets a
// profile from its classes and choices; a goal (damage, defence, versatility) weighs the tags; and the
// score of an item is how well its tags serve that goal for that profile.
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

function buildProfile(b) {
  const info = levelInfo(b);
  const levels = {};
  info.forEach((x) => { if (x.cls) levels[x.cls] = (levels[x.cls] || 0) + 1; });
  const total = charLevel(b);
  const picks = allPicks(b).join(' | ');
  const subs = new Set(info.map((x) => x.sub).filter(Boolean));
  const stats = finalStats(b);
  const casterLevels = FULL_CASTERS.reduce((a, c) => a + (levels[c] || 0), 0);
  const has = (re) => re.test(picks);
  let style = 'melee';
  if ((levels.Monk || 0) >= 3) style = 'unarmed';
  else if (has(/tavern brawler/i) && levels.Barbarian) style = 'thrown';
  else if (has(/archery|sharpshooter/i)) style = 'ranged';
  else if (total && casterLevels * 2 >= total && !(levels.Paladin >= casterLevels)) style = 'caster';
  const topCaster = Object.keys(levels).filter((c) => CASTING_ABILITY[c]).sort((a, c) => levels[c] - levels[a])[0];
  const main = style === 'ranged' ? 'dex' : style === 'caster' ? (CASTING_ABILITY[topCaster] || 'cha')
    : style === 'thrown' ? 'str' : (stats.scores.str >= stats.scores.dex ? 'str' : 'dex');
  const known = allPicks(b).map((p) => /^(?:spell|cantrip)\s*:\s*([^(]+)/i.exec(p.trim())).filter(Boolean).map((m) => SPELLS.find((s) => norm(s.n) === norm(m[1]))).filter(Boolean);
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

// ---------- scoring ----------
const GOALS = {
  damage: { damage: 3, accuracy: 2.5, crit: 2, spelldc: 2.5, ability: 2, synergy: 1.5, initiative: 1, spells: 0.5, control: 0.5 },
  defence: { ac: 3, defence: 2.5, saves: 2, healing: 1.5, initiative: 1, stealth: 0.5, mobility: 0.5, ability: 0.5 },
  versatile: { spells: 2, mobility: 2, skills: 2, control: 1.5, stealth: 1.5, initiative: 1.5, saves: 1, healing: 1, damage: 1, ac: 1, ability: 1, synergy: 1 },
};
const GOAL_LABEL = { damage: 'Best for damage', defence: 'Best for defence', versatile: 'Most versatile' };
const diceAverage = (text) => { const m = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/.exec(text || ''); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 + Number(m[3] || 0) : 0; };

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
  if (tag === 'ability') {
    const raised = ABILS.filter((a) => new RegExp(a[2], 'i').test(text)).map((a) => a[0]);
    if (raised.includes(p.main)) return [1.6, t('raises {ab}, your main ability', { ab: p.main.toUpperCase() })];
    return raised.includes('con') ? [1, ''] : [0.4, ''];
  }
  return [1, ''];
}

// Score of one item for a slot, an act and a goal: { score, reasons }.
function scoreItem(b, p, it, slot, act, goal, current) {
  const weights = GOALS[goal];
  const text = itemText(it);
  const reasons = [];
  let score = 0;
  it.g.forEach((tag) => {
    const w = weights[tag];
    if (!w) return;
    const [fit, why] = tagFit(tag, it, p, text);
    if (fit <= 0) return;
    score += w * fit;
    reasons.push([w * fit, t(TAG_LABEL[tag]) + (why ? ' (' + why + ')' : '')]);
  });
  // a monk in armour loses Unarmoured Defence and movement, so armour is not offered
  if (slot === 'chest' && p.monk && ARMOUR_TYPES.includes(it.t)) return { score: 0, reasons: [] };
  if (it.s === 'shield' && (p.monk || p.style === 'ranged')) score -= 1;
  // armour, shields and anything that changes Armour Class: count the real difference to what is worn now
  if (weights.ac && (slot === 'chest' || it.s === 'shield' || it.g.includes('ac'))) {
    const delta = armourClass(b, act, p.stats.mods, { [slot]: it }) - current;
    if (delta) { score += delta * weights.ac * 0.6; reasons.push([Math.abs(delta) * weights.ac * 0.6, t('AC {n} against what you wear now', { n: signed(delta) })]); }
  }
  // weapons: the damage they deal and whether the build's ability works with them
  if (isWeapon(it) && (slot === 'meleeMain' || slot === 'rangedMain') && weights.damage) {
    let fit = 1;
    if (it.s === 'melee' && p.main === 'dex' && !(it.pp || []).includes('Finesse')) fit = 0.4;
    if (it.s === 'melee' && p.style === 'unarmed') fit = 0.2;
    const power = diceAverage(it.d) * 0.35 * weights.damage / 3 * fit;
    if (power) { score += power; reasons.push([power, t('{d} base damage', { d: it.d })]); }
    if (fit < 1 && it.s === 'melee' && p.main === 'dex') reasons.push([0, t('not a finesse weapon, so it uses Strength')]);
  }
  const matched = (it.el || []).filter((e) => p.elements.has(e));
  if (matched.length && weights.damage) { score += 1.5; reasons.push([1.5, t('matches your {el} damage', { el: matched.join(', ') })]); }
  const partners = SLOTS.map(([k]) => (k === slot ? null : ITEM_BY_NAME.get(norm(b.gear[act].slots[k].name)))).filter((x) => x && (x.en2 || []).some((e) => (it.en2 || []).includes(e)));
  if (partners.length) { score += 1.5; reasons.push([1.5, t('combines with {x}', { x: partners[0].n })]); }
  if (score > 0) score += RARITY_RANK[it.r] * 0.25;
  reasons.sort((x, y) => y[0] - x[0]);
  return { score, reasons: reasons.slice(0, 3).map((r) => r[1]) };
}

// The usable items of a slot, best first for the goal.
function recommend(b, slot, act, goal, list) {
  const p = buildProfile(b);
  const current = armourClass(b, act, p.stats.mods);
  return list.map((it) => Object.assign({ it }, scoreItem(b, p, it, slot, act, goal, current)))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score || x.it.n.localeCompare(y.it.n));
}
