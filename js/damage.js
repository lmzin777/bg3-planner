// Damage: what a turn is worth against an enemy. Weapon attacks with every action the turn has (Extra Attack,
// Action Surge, Haste, the bonus action), the spells the build casts, the enemy's Armour Class, saving throws
// and resistances, and what each option spends. Rules from the wiki's Attacks, Critical hit, Saving throws,
// Resistances, Extra Attack, Hastened and Action Surge pages.
'use strict';

const ENEMIES = window.BG3_ENEMIES || [];
const ENEMY_BY_NAME = new Map(ENEMIES.map((e) => [e.n, e]));
// Honour mode changes two things here: Extra Attack from Deepened Pact does not add to a class's Extra Attack,
// and the action Haste gives cannot use Extra Attack. On by default, as the guide the planner started from.
const honourMode = () => state.ui.honour !== false;

// ---------- the enemy ----------
// A reference enemy of the list, or just an Armour Class and one saving throw bonus for every ability.
function targetOf() {
  const e = ENEMY_BY_NAME.get(state.ui.target);
  if (!e) {
    const save = state.ui.targetSave == null ? 3 : Number(state.ui.targetSave);
    return { name: '', ac: Number(state.ui.targetAc) || 16, saves: Object.fromEntries(ABILITY_KEYS.map((k) => [k, save])), res: {} };
  }
  const mod = (k) => Math.floor((e.ab[k] - 10) / 2);
  return { name: e.n, enemy: e, ac: e.ac, saves: Object.fromEntries(ABILITY_KEYS.map((k) => [k, mod(k) + (e.sv.includes(k) ? e.pb : 0)])), res: e.res || {} };
}
const asTarget = (x) => (typeof x === 'number' ? { name: '', ac: x, saves: Object.fromEntries(ABILITY_KEYS.map((k) => [k, 3])), res: {} } : x || targetOf());
// How much of a damage type gets through: nothing if immune, half if resistant, double if vulnerable.
// "rn" and "in" hold only against damage that is not magical.
function typeFactor(target, type, magical) {
  const r = (target.res || {})[type] || '';
  if (r === 'v') return 2;
  if (r === 'i' || ((r === 'in' || r === 'ip') && !magical)) return 0;
  if (r === 'r' || (r === 'rn' && !magical) || ((r === 'rm' || r === 'ip') && magical)) return 0.5;
  return 1;
}
const targetLabel = (target) => (target.name ? target.name : t('AC {ac}', { ac: target.ac }));

// ---------- weapon attacks ----------
// One attack of a row against the target: the chances, and the damage it is worth on average.
// A weapon counts as magical when it is enchanted or more than common; unarmed strikes from Monk 6 on.
function rowDamage(stats, row, target) {
  const bonus = row.attackTotal + (row.attackDice || []).reduce((a, d) => a + avgDice(d), 0);
  const p = hitChance(bonus, target.ac, stats.crit, stats.advantage);
  const magical = row.slot === 'unarmed' ? stats.gains.some((g) => /^ki-empowered strikes/i.test(g)) : !!(row.item && (row.item.en || (row.item.r && row.item.r !== 'common')));
  const f = typeFactor(target, row.type, magical);
  const dice = avgDice(row.dice) * f + (row.extraDice || []).reduce((a, d) => a + avgDice(d[0]) * typeFactor(target, d[1] || row.type, magical), 0);
  return { p, each: p.hit * (dice + row.damageTotal * f) + p.crit * dice };
}
const POLEARMS = ['Glaives', 'Halberds', 'Pikes', 'Quarterstaves', 'Spears'];
// A turn of weapon attacks: the Attack action with Extra Attack, the actions switched on (Action Surge, Haste)
// and the best use of the bonus action the build has. A critical hit rolls every damage die twice.
// { target, ac, parts: [{ row, n, how, each, p, spends, chance }], total }
function turnPlan(stats, style, against) {
  const target = asTarget(against);
  const main = mainAttack(stats, style);
  if (!main) return null;
  const gains = stats.gains;
  const on = stats.active || [];
  const own = gains.includes('Improved Extra Attack') ? 2 : gains.includes('Extra Attack') ? 1 : 0;
  const pact = gains.includes('Deepened Pact') && stats.pactBlade && main.slot === 'meleeMain' ? 1 : 0;
  // Extra Attack from two classes does not add up; the pact weapon's does, outside Honour mode
  const perAction = 1 + (honourMode() ? Math.max(own, pact) : own + pact);
  const hit = rowDamage(stats, main, target);
  const part = (row, n, how, d, more) => Object.assign({ row, n, how }, d, more || {});
  const parts = [part(main, perAction, t('Attack action'), hit)];
  if (on.includes('surge') && (stats.fighter || 0) >= 2) parts.push(part(main, perAction, 'Action Surge', hit, { spends: 'Action Surge' }));
  if (on.includes('haste')) parts.push(part(main, honourMode() ? 1 : perAction, 'Haste', hit, { spends: 'Haste' }));
  // the bonus action: whichever of these the build has that is worth most
  const bonus = [];
  const melee = main.slot === 'meleeMain' && !main.thrown;
  const off = stats.attacks.rows.find((r) => !r.thrown && r.slot === (main.slot === 'rangedMain' ? 'rangedOff' : main.slot === 'meleeMain' ? 'meleeOff' : ''));
  if (main.slot === 'unarmed' && stats.monk) bonus.push(part(main, 2, 'Flurry of Blows', hit, { spends: 'Ki Points' }));
  if (off && !main.thrown) bonus.push(part(off, 1, t('bonus action'), rowDamage(stats, off, target)));
  const feats = stats.featNames || new Set();
  if (melee && feats.has('Great Weapon Master')) {
    // one more attack on the turns a critical hit lands (a kill gives it too, which no average can count)
    const swings = parts.reduce((a, x) => a + x.n, 0);
    const chance = 1 - (1 - hit.p.crit) ** swings;
    bonus.push(part(main, chance, 'Great Weapon Master', hit, { chance }));
  }
  if (melee && main.item && feats.has('Polearm Master') && POLEARMS.includes(main.item.t)) {
    const butt = Object.assign({}, main, { name: main.name + ' · ' + t('butt'), dice: '1d4', type: 'Bludgeoning', extraDice: [] });
    bonus.push(part(butt, 1, 'Polearm Master', rowDamage(stats, butt, target)));
  }
  if (melee && main.item && (main.item.wa || []).includes("Dueller's Enthusiasm") && !(stats.worn || {}).meleeOff) bonus.push(part(main, 1, "Dueller's Enthusiasm", hit));
  if (bonus.length) parts.push(bonus.sort((x, y) => y.n * y.each - x.n * x.each)[0]);
  return { target, ac: target.ac, parts, total: parts.reduce((a, x) => a + x.n * x.each, 0) };
}

// ---------- spells ----------
// Damage a spell deals after the turn it is cast, and damage it adds to weapon hits instead of dealing itself.
const LATER = /per turn|when the target moves|delayed|per [\d.]+ ?m moved|when hit by|when the wall breaks/i;
const RIDER = /per (?:weapon )?attack/i;
const SAVE_NOTE = /Saving Throw/i;
const ANCESTRY = /^(?:Black|Blue|Brass|Bronze|Copper|Gold|Green|Red|Silver|White) \((\w+)\)$/;
// What a spell does when cast with a slot of level `slot`, read from its damage line and its text on higher levels:
// { parts: [{ dice, flat, type, note, up, like }] dealt on the cast, later: the same for following turns,
//   beams, weapon: it rides on a weapon attack (a smite), rider: the die it adds to every hit }.
// A cantrip uses the line of the character's level ("At character level 5, the damage increases to…").
function spellHits(s, level, slot) {
  let text = s.dm || '';
  let at = 0;
  if (!s.lv) {
    for (const m of String(s.hl || '').matchAll(/At character level (\d+), the damage increases to ([^.;]+)/gi)) {
      if (level >= Number(m[1]) && Number(m[1]) > at) { at = Number(m[1]); text = m[2].trim(); }
    }
  }
  // no damage line, but a text saying what it adds to weapon hits (Divine Favour)
  const adds = !text && /weapons? (?:attacks? )?deal an additional (\d+d\d+) (\w+) damage/i.exec(s.d || '');
  if (adds) return { rider: { dice: adds[1], flat: 0, type: adds[2], note: '' }, parts: [], later: [], beams: 1 };
  if (!text) return null;
  // "weapon damage + 1d8 Thunder + 2d8 Thunder (when the target moves)" is the same list, written with plus signs
  text = text.replace(/\s\+\s(?=\d+d\d)/g, ', ');
  let beams = 1;
  for (const m of String(s.hl || '').matchAll(/(\d+) beams at character level (\d+)/gi)) if (level >= Number(m[2])) beams = Math.max(beams, Number(m[1]));
  const all = text.split(/,\s*(?![^()]*\))/).map((x) => {
    if (/^weapon damage/i.test(x.trim())) return { weapon: true };
    const m = /^(\d+d\d+)?\s*(?:\+\s*(\d+))?\s*([A-Za-z]+)?\s*(?:\((.*)\))?$/.exec(x.trim());
    return m && (m[1] || m[2]) ? { dice: m[1] || '', flat: Number(m[2]) || 0, type: m[3] || '', note: m[4] || '' } : null;
  }).filter(Boolean);
  const dealt = all.filter((x) => !x.weapon);
  const rider = dealt.find((x) => RIDER.test(x.note));
  if (rider) return { rider, parts: [], later: [], beams: 1 };
  const parts = dealt.filter((x) => !LATER.test(x.note));
  const later = dealt.filter((x) => LATER.test(x.note));
  // a higher slot: for each level above the spell's own, one more dart or ray, or more dice of the kind it names
  const up = s.lv && slot > s.lv ? slot - s.lv : 0;
  const sentence = up ? String(s.hl || '').split(/[.;]\s*/).find((x) => UPCAST.test(x)) || '' : '';
  if (sentence && /additional (?:\w+ )?(?:dart|ray)\b/i.test(sentence)) {
    if (parts[0]) for (let k = 0; k < up; k++) parts.push(Object.assign({}, parts[0], { up: true }));
  } else if (sentence) {
    const grow = (x, d) => {
      const more = /(\d+)d(\d+)/.exec(d);
      const own = /(\d+)d(\d+)/.exec(x.dice);
      if (!more) x.flat += Number(d) * up;
      else if (own && own[2] === more[2]) x.dice = Number(own[1]) + Number(more[1]) * up + 'd' + own[2];
      else (later.includes(x) ? later : parts).push({ dice: Number(more[1]) * up + 'd' + more[2], flat: 0, type: x.type, note: x.note, like: x });
    };
    // "an extra 2d4 Acid damage (1d4 Acid on impact and at the end of target's turn)": the brackets say how it is split
    const inner = /\(([^)]*\d+d\d+[^)]*)\)/.exec(sentence);
    const found = [...(inner ? inner[1] : sentence).matchAll(/(\d+d\d+|\b\d+)\s+([A-Z][a-z]+)/g)].filter((m) => DAMAGE_TYPES.includes(m[2]));
    const bare = /\d+d\d+/.exec(sentence);
    if (!found.length && bare && (parts[0] || later[0])) grow(parts[0] || later[0], bare[0]);
    found.forEach((m) => {
      const now = parts.filter((x) => x.type === m[2]);
      const then = later.filter((x) => x.type === m[2]);
      const to = inner ? [now[0], then[0]] : /\bboth\b/i.test(sentence) ? now : [now[0] || then[0] || parts[0] || later[0]];
      to.filter(Boolean).forEach((x) => grow(x, m[1]));
    });
  }
  const weapon = all.some((x) => x.weapon);
  if (!parts.length && !later.length && !weapon) return null;
  return { parts, later, beams, weapon };
}
// The damaging spells a build casts, with the group they are cast from: [{ sp, title, ability, cls }].
// Worked out once for a build and act while its choices stay the same.
const spellMemo = new WeakMap();
function damagingSpells(stats) {
  const b = stats.build;
  const sig = JSON.stringify([b.levels, b.prepared, b.scrolls, b.creation.cantrip, b.creation.race, b.creation.subrace, stats.act, SLOTS.map(([k]) => b.gear[stats.act].slots[k].name)]);
  const kept = spellMemo.get(b);
  if (kept && kept.sig === sig) return kept.list;
  const seen = new Set();
  const list = [];
  spellbook(b, stats.act, stats).forEach((g) => g.spells.forEach((x) => {
    if (!x.sp || seen.has(x.sp.n) || x.sp.a === 'reaction' || !spellHits(x.sp, 12, 6)) return;
    seen.add(x.sp.n);
    list.push({ sp: x.sp, title: g.title, ability: g.ability, cls: g.cls || '' });
  }));
  spellMemo.set(b, { sig, list });
  return list;
}
// The slot a spell is cast with: its own level, or the level chosen in Final numbers when the build has such a
// slot. A Warlock's pact slots are all of one level, so its spells are always cast at that level. A spell that
// gains nothing from a higher slot keeps its own.
const UPCAST = /per level|for each spell slot level/i;
function castLevel(stats, entry) {
  const s = entry.sp;
  if (!s.lv) return 0;
  if (entry.cls === 'Warlock' && stats.pact) return Math.max(s.lv, stats.pact.level);
  if (!UPCAST.test(s.hl || '')) return s.lv;
  return Math.max(s.lv, Math.min(Number(state.ui.castLevel) || 0, (stats.slots || []).length));
}
const dicePart = (x) => [x.dice, x.flat ? (x.dice ? '+ ' : '') + x.flat : '', x.type].filter(Boolean).join(' ');
// One cast of a spell against the target, on average. Each part of its damage goes by an attack roll, by a
// saving throw (failed: all of it; passed: all, half or nothing, as the spell says) or simply lands; a spell with
// both rolls an attack for its first part and asks a save for the rest (Ice Knife). `main` is the weapon attack
// a smite rides on. A spell that only hurts turn after turn (Moonbeam) is worth one of those turns.
function spellDamage(stats, entry, target, main) {
  const s = entry.sp;
  const slot = castLevel(stats, entry);
  const hits = spellHits(s, stats.level, slot);
  if (!hits) return null;
  if (hits.rider) return { name: s.n, sp: s, rider: hits.rider, slot, total: 0 };
  const cast = stats.casting.find((c) => c.label === entry.title);
  const mod = entry.ability ? stats.mods[entry.ability] : 0;
  const dc = cast ? cast.dc : 8 + stats.pb + mod;
  const attack = cast ? cast.attack : stats.pb + mod;
  const on = stats.active || [];
  const opts = stats.options || new Set();
  const gains = stats.gains || [];
  const p = hitChance(attack, target.ac, stats.crit, stats.advantage);
  const upText = slot > s.lv ? ' · ' + t('with a level {n} slot', { n: slot }) : '';
  // the saving throw, and what stays of the damage when it is passed
  const noteSave = [...hits.parts, ...hits.later].map((x) => /(STR|DEX|CON|INT|WIS|CHA)\w* Saving Throw/i.exec(x.note)).find(Boolean);
  const saveKey = s.sv ? String(s.sv).toLowerCase().slice(0, 3) : noteSave ? noteSave[1].toLowerCase().slice(0, 3) : '';
  let fail = saveKey ? Math.max(0, Math.min(1, (dc - 1 - target.saves[saveKey]) / 20)) : 0;
  const heightened = !!saveKey && on.includes('meta:heighten') && opts.has('Heightened Spell');
  if (heightened) fail = 1 - (1 - fail) ** 2;  // Disadvantage: the worse of two rolls
  const potent = !s.lv && gains.includes('Potent Cantrip');
  const kept = (x) => {
    const said = SAVE_NOTE.test(x.note) ? x.note : s.os || '';
    return Math.max(/full damage/i.test(said) ? 1 : /hal[fv]/i.test(said) ? 0.5 : 0, potent ? 0.5 : 0);
  };
  const saved = (x) => fail + (1 - fail) * kept(x);
  const saveText = () => t('{ab} save, DC {dc}: {n}% fail', { ab: saveKey.toUpperCase(), dc, n: Math.round(fail * 100) });
  const laterText = hits.parts.length || hits.weapon ? hits.later.map((x) => dicePart(x) + ' (' + x.note + ')').join(', ') : '';
  if (hits.weapon) {
    // a smite: one weapon attack with the spell's dice on top; a burst that asks a save comes when the attack hits
    if (!main) return null;
    const typed = (x) => (/weapon/i.test(x.type) ? main.type : x.type);
    const ride = hits.parts.filter((x) => !SAVE_NOTE.test(x.note));
    const burst = hits.parts.filter((x) => SAVE_NOTE.test(x.note));
    const row = Object.assign({}, main, { extraDice: [...(main.extraDice || []), ...ride.map((x) => [x.dice, typed(x), s.n])] });
    const d = rowDamage(stats, row, target);
    const total = d.each + burst.reduce((a, x) => a + d.p.hit * (avgDice(x.dice) + x.flat) * typeFactor(target, typed(x), true) * saved(x), 0);
    return { name: s.n, sp: s, slot, total, how: t('{n}% to hit', { n: Math.round(d.p.hit * 100) }) + (burst.length && saveKey ? ' · ' + saveText() : '') + upText,
      text: [t('weapon hit'), ...hits.parts.map(dicePart)].join(' + '), later: laterText, area: false, bonuses: [] };
  }
  const now = hits.parts.length ? hits.parts : hits.later.filter((x) => /per turn/i.test(x.note));
  if (!now.length) return null;
  const perTurn = !hits.parts.length;
  // what the build adds to the damage of its spells
  const bonuses = [];
  const add = (name, n) => { if (n > 0) bonuses.push(name + ' +' + n); return Math.max(0, n); };
  let each = 0;   // on every damage roll
  let once = 0;   // once in the cast
  let onceAt = 0;
  if (s.n === 'Eldritch Blast' && opts.has('Agonising Blast')) each += add('Agonising Blast', stats.mods.cha);
  if (gains.includes('Empowered Evocation') && s.sc === 'Evocation') each += add('Empowered Evocation', stats.mods.int);
  if (!s.lv && entry.cls === 'Cleric' && gains.includes('Potent Spellcasting')) once += add('Potent Spellcasting', stats.mods.wis);
  const ancestry = [...opts].map((o) => ANCESTRY.exec(o)).find(Boolean);
  if (ancestry && gains.includes('Elemental Affinity: Damage') && now.some((x) => x.type === ancestry[1])) {
    onceAt = now.findIndex((x) => x.type === ancestry[1]);
    once += add('Elemental Affinity', stats.mods.cha);
  }
  // how each part lands
  const own = now.filter((x) => !x.up && !x.like);
  const mixed = !!s.at && !!saveKey && own.length > 1;
  const modeOf = (x, k) => {
    if (!s.at) return saveKey ? 'save' : 'auto';
    if (!mixed) return 'attack';
    return (x.like ? now.indexOf(x.like) : k) === 0 ? 'attack' : 'save';
  };
  // more than one enemy: the ones caught in an area (not the part aimed at one of them)
  const area = !!s.ao;
  const targets = area ? Math.max(1, Number(state.ui.targets) || 1) : 1;
  const modes = new Set();
  let total = 0;
  now.forEach((x, k) => {
    const f = typeFactor(target, x.type, true);
    const dice = avgDice(x.dice) * f;
    const flat = (x.flat + each + (k === onceAt ? once : 0)) * f;
    const mode = modeOf(x, k);
    modes.add(mode);
    if (mode === 'attack') total += hits.beams * (p.hit * (dice + flat) + p.crit * dice) * (mixed ? 1 : targets);
    else if (mode === 'save') total += (dice + flat) * saved(x) * targets;
    else total += hits.beams * (dice + flat) * targets;
  });
  // "3 × 1d4 + 1 Force" for darts and rays that are all alike
  const same = now.length > 1 && now.every((x) => dicePart(x) === dicePart(now[0]));
  // Twinned Spell: a spell that targets one creature also hits a second one
  const twin = !area && !same && hits.beams === 1 && on.includes('meta:twin') && opts.has('Twinned Spell');
  if (twin) total *= 2;
  const halfText = now.some((x, k) => modeOf(x, k) === 'save' && kept(x) === 0.5) ? ' · ' + t('half on a save') : '';
  const how = [modes.has('attack') ? t('{n}% to hit', { n: Math.round(p.hit * 100) }) : '',
    modes.has('save') ? saveText() + halfText : '',
    modes.has('auto') ? t('always lands') : ''].filter(Boolean).join(' · ') + upText + (perTurn ? ' · ' + t('each turn') : '')
    + (targets > 1 ? ' · ' + t('{n} targets', { n: targets }) : '') + (twin ? ' · Twinned Spell' : '') + (heightened ? ' · Heightened Spell' : '');
  const text = (hits.beams > 1 ? hits.beams + ' × ' : same ? now.length + ' × ' : '') + (same ? dicePart(now[0]) : now.map(dicePart).join(', '));
  return { name: s.n, sp: s, slot, total, how, text, later: laterText, area, bonuses, twin, heightened, perTurn };
}
// Every damaging spell of the build against the target, strongest first; the ones that add a die to weapon
// hits come apart, in `riders`.
function spellOptions(stats, target, main) {
  const all = damagingSpells(stats).map((x) => spellDamage(stats, x, target, main)).filter(Boolean);
  const list = all.filter((x) => !x.rider && x.total > 0).sort((x, y) => y.total - x.total);
  list.riders = all.filter((x) => x.rider);
  return list;
}
// How often a spell can be cast with a slot of that level: at will, or the slots of that level and above.
function castsText(stats, lv) {
  if (!lv) return t('at will');
  const shared = (stats.slots || []).slice(lv - 1).reduce((a, n) => a + n, 0);
  const pact = stats.pact && stats.pact.level >= lv ? stats.pact.n : 0;
  return [shared ? t('{n} per Long Rest', { n: shared }) : '', pact ? t('{n} per Short Rest', { n: pact }) : ''].filter(Boolean).join(' + ') || t('no slot of that level');
}

// ---------- the turn, all told ----------
// What the build does best every turn without spending anything that runs out: its weapon attacks or its
// strongest cantrip. { total, plan, cantrip, spells }
function bestTurn(stats, style, against) {
  const target = asTarget(against);
  const plan = turnPlan(stats, style, target);
  const spells = stats.build ? spellOptions(stats, target, plan ? plan.parts[0].row : null) : [];
  const cantrip = spells.find((x) => !x.sp.lv) || null;
  return { target, plan, spells, riders: spells.riders || [], cantrip, total: Math.max(plan ? plan.total : 0, cantrip ? cantrip.total : 0) };
}
// What the plan spends and for how long it holds: Ki for Flurry of Blows, Action Surge, Haste, Rage.
function turnSpends(stats, plan) {
  const res = Object.fromEntries((stats.resources || []).map(([n, v]) => [n, v]));
  const out = [];
  const spends = new Set((plan ? plan.parts : []).map((x) => x.spends).filter(Boolean));
  if (spends.has('Ki Points') && res['Ki Points']) out.push(t('Flurry of Blows: 1 Ki a turn, {n} turns per Short Rest', { n: res['Ki Points'] }));
  if (spends.has('Action Surge')) out.push(t('Action Surge: one turn per Short Rest'));
  if (spends.has('Haste')) out.push(t('Haste: a level 3 spell slot or a potion, 10 turns, while Concentration holds'));
  if ((stats.active || []).includes('rage') && res['Rage Charges']) out.push(t('Rage: {n} per Long Rest, 10 turns each', { n: res['Rage Charges'] }));
  return out;
}
// What the Metamagic switched on costs, for the spells it changed.
function spellSpends(stats, spells) {
  const points = (stats.resources || []).find(([n]) => n === 'Sorcery Points');
  const out = [];
  if (spells.some((x) => x.twin)) out.push(t('Twinned Spell: Sorcery Points for each cast'));
  if (spells.some((x) => x.heightened)) out.push(t('Heightened Spell: 3 Sorcery Points for each cast'));
  if (out.length && points) out.push(t('{n} Sorcery Points per Long Rest', { n: points[1] }));
  return out;
}
// The block under the attacks: the turn of weapon attacks, the best the build does at will, the spells.
function turnBox(stats, style) {
  const best = bestTurn(stats, style, targetOf());
  const { plan, spells, riders, cantrip, target } = best;
  if (!plan && !spells.length) return '';
  const who = esc(targetLabel(target));
  const count = (x) => (x.chance != null ? Math.round(x.chance * 100) + '%' : x.n) + ' × ';
  const weapon = plan ? `<p class="turn"><b>${plan.total.toFixed(1)}</b>${t('average damage in a turn against {who}', { who })}: ${plan.parts.map((x) =>
    `${count(x)}${esc(x.row.name)} (${esc(x.how)}, ${x.each.toFixed(1)} ${t('each')})`).join(' + ')}${
    stats.advantage ? ' · ' + t('with Advantage') : ''}${stats.crit < 20 ? ' · ' + t('critical hit on {n} or more', { n: stats.crit }) : ''}</p>` : '';
  const spends = turnSpends(stats, plan);
  const row = (x) => `<div class="opt"><b>${pic(x.sp.i, 'pic small')}${esc(x.name)}</b><span>${esc(x.text)}</span><span>${esc(x.how)}</span>
    <strong>${x.total.toFixed(1)}</strong><small>${[x.slot ? t('level {n} slot', { n: x.slot }) : '', castsText(stats, x.slot), x.area && !(Number(state.ui.targets) > 1) ? t('each target in the area') : '',
      x.bonuses.join(', '), x.later ? t('then {x}', { x: x.later }) : ''].filter(Boolean).map(esc).join(' · ')}</small></div>`;
  const shown = spells.slice(0, 10);
  // a spell that adds a die to every weapon hit is worth what the hits of the turn make of it
  const riderRow = (x) => {
    const worth = plan ? plan.parts.reduce((a, part) => { const f = typeFactor(target, /weapon/i.test(x.rider.type) ? part.row.type : x.rider.type, true); return a + part.n * (part.p.hit + part.p.crit) * avgDice(x.rider.dice) * f; }, 0) : 0;
    return `<div class="opt"><b>${pic(x.sp.i, 'pic small')}${esc(x.name)}</b><span>${esc(dicePart(x.rider))}</span><span>${t('on every hit')}</span>
      <strong>+${worth.toFixed(1)}</strong><small>${[x.slot ? t('level {n} slot', { n: x.slot }) : '', castsText(stats, x.slot), x.sp.du || '', x.sp.co ? t('Concentration') : ''].filter(Boolean).map(esc).join(' · ')}</small></div>`;
  };
  // the slot the spells are cast with, and how many enemies an area catches
  const top = (stats.slots || []).length;
  const chosen = Math.min(Number(state.ui.castLevel) || 0, top);
  const slotButtons = top > 1 ? `<span class="lbl">${t('Cast with a slot of')}</span><div class="acts mini">${[0, ...Array.from({ length: top - 1 }, (x, k) => k + 2)].map((n) =>
    `<button class="${chosen === n ? 'on' : ''}" data-act="cast-level" data-n="${n}">${n ? t('level {n}', { n }) : t('its own level')}</button>`).join('')}</div>` : '';
  const areaTools = spells.some((x) => x.area) ? `<span class="lbl">${t('Enemies in an area')}</span>${stepper(Math.max(1, Number(state.ui.targets) || 1), 'data-ui="targets" data-v="1"', 1, 8)}` : '';
  const costs = spellSpends(stats, spells);
  return `${weapon}
    ${spends.length ? `<p class="muted">${spends.map(esc).join(' · ')}</p>` : ''}
    ${cantrip && plan && cantrip.total > plan.total ? `<p class="muted">${t('At will, {spell} does more than the weapon: {n} a turn.', { spell: esc(cantrip.name), n: cantrip.total.toFixed(1) })}</p>` : ''}
    ${shown.length || riders.length ? `<h3 class="group">${t('Spells against {who}', { who })}</h3>
      ${slotButtons || areaTools ? `<div class="cast-tools">${slotButtons}${areaTools}</div>` : ''}
      ${stats.pact ? `<p class="muted">${t('Pact Magic casts every Warlock spell with a level {n} slot.', { n: stats.pact.level })}</p>` : ''}
      <div class="opts">${shown.map(row).join('')}${riders.map(riderRow).join('')}</div>
      ${costs.length ? `<p class="muted">${costs.map(esc).join(' · ')}</p>` : ''}
      <p class="muted">${t('Average damage of one cast. Damage of the following turns is named after "then" and not added.')}</p>` : ''}`;
}
// "Fire immune, Slashing resistant (non-magical)".
const resText = (e) => Object.keys(e.res || {}).map((k) => k + ' ' + ({ r: t('resistant'), rn: t('resistant (non-magical)'), rm: t('resistant (magical)'), i: t('immune'), in: t('immune (non-magical)'),
  ip: t('immune (non-magical), resistant (magical)'), v: t('vulnerable') })[e.res[k]]);
// The enemy the numbers are measured against, chosen in Final numbers.
function targetTools() {
  const target = targetOf();
  const e = target.enemy;
  const res = e ? resText(e) : [];
  return `<div class="field enemy-field"><span>${t('Enemy')}</span>${slotButton('enemy-open', '', e ? e.n : '', '', t('Any enemy'))}</div>
    ${e ? '' : `<div class="field ac-field"><span>${t('Enemy Armour Class')}</span>${stepper(target.ac, 'data-ui="targetAc" data-v="16"', 5, 30)}</div>
      <div class="field ac-field"><span>${t('Its saving throws')}</span>${stepper(target.saves.str, 'data-ui="targetSave" data-v="3"', -3, 15)}</div>`}
    <div class="field"><span>${t('Rules')}</span><button class="btn tiny${honourMode() ? ' gold' : ''}" data-act="honour-toggle" title="${t('In Honour mode, Extra Attack from Deepened Pact does not add to a class\'s Extra Attack, and the action Haste gives cannot use Extra Attack.')}">${honourMode() ? t('Honour mode') : t('Standard rules')}</button></div>
    ${e ? `<p class="enemy-line">${t('Act {n}', { n: e.act })} · ${t('level {n}', { n: e.lv })} · AC ${e.ac} · HP ${[e.hp.b, e.hp.t ? e.hp.t + ' Tactician' : '', e.hp.h ? e.hp.h + ' Honour' : ''].filter(Boolean).join(' / ')} · ${
      ABILS.map(([k, short]) => short + ' ' + signed(target.saves[k])).join(' ')}${res.length ? ' · ' + esc(res.join(', ')) : ''}${e.note ? `<br><em>${esc(e.note)}</em>` : ''}</p>` : ''}`;
}

Object.assign(actions, {
  'enemy-open'() {
    const rows = ENEMIES.map((e) => [e.n, [resText(e).join(', '), e.note || ''].filter(Boolean).join(' — '), `AC ${e.ac} · HP ${e.hp.b} · ${t('level {n}', { n: e.lv })}`, '', t('Act {n}', { n: e.act })]);
    openChooser(t('Enemy'), t('Reference enemies, with the numbers of their page on bg3.wiki. Take the choice back and confirm to measure against just an Armour Class.'),
      [{ label: t('Enemy'), n: 1, min: 0, options: rows, chosen: state.ui.target ? [state.ui.target] : [] }], (done) => { state.ui.target = done[0].chosen[0] || ''; });
    return false;
  },
  'honour-toggle'() { state.ui.honour = !honourMode(); },
  'cast-level'(el) { state.ui.castLevel = Number(el.dataset.n) || 0; },
});
