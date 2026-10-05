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
  if (r === 'i' || (r === 'in' && !magical)) return 0;
  if (r === 'r' || (r === 'rn' && !magical)) return 0.5;
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
// The damage a spell deals when cast, read from its damage line: [{ dice, flat, type, note }] and how many
// beams. A cantrip uses the line of the character's level ("At character level 5, the damage increases to…").
// Damage that comes later (per turn, when the target moves) and spells that only add to a weapon attack are left out.
function spellHits(s, level) {
  let text = s.dm || '';
  let at = 0;
  if (!s.lv) {
    for (const m of String(s.hl || '').matchAll(/At character level (\d+), the damage increases to ([^.;]+)/gi)) {
      if (level >= Number(m[1]) && Number(m[1]) > at) { at = Number(m[1]); text = m[2].trim(); }
    }
  }
  // Hex and Divine Favour add their die to weapon hits while they last: not damage of their own cast
  if (!text || /weapon/i.test(text) || /^(?:hex|divine favour)$/i.test(s.n)) return null;
  let beams = 1;
  for (const m of String(s.hl || '').matchAll(/(\d+) beams at character level (\d+)/gi)) if (level >= Number(m[2])) beams = Math.max(beams, Number(m[1]));
  const parts = text.split(/,\s*(?![^()]*\))/).map((x) => {
    const m = /^(\d+d\d+)?\s*(?:\+\s*(\d+))?\s*([A-Za-z]+)?\s*(?:\((.*)\))?$/.exec(x.trim());
    return m && (m[1] || m[2]) ? { dice: m[1] || '', flat: Number(m[2]) || 0, type: m[3] || '', note: m[4] || '' } : null;
  }).filter((x) => x && !/per turn|when the target moves|delayed|each turn|at the start|at the end/i.test(x.note));
  return parts.length ? { parts, beams } : null;
}
// The damaging spells a build casts, with the group they are cast from: [{ sp, title, ability }].
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
    if (!x.sp || seen.has(x.sp.n) || !x.sp.dm || x.sp.a === 'reaction' || !spellHits(x.sp, 12)) return;
    seen.add(x.sp.n);
    list.push({ sp: x.sp, title: g.title, ability: g.ability });
  }));
  spellMemo.set(b, { sig, list });
  return list;
}
// One cast of a spell against the target, on average: an attack roll, a saving throw (failed: all of it;
// passed: half or nothing, as the spell says) or damage that simply lands. Cast at the spell's own level.
function spellDamage(stats, entry, target) {
  const s = entry.sp;
  const hits = spellHits(s, stats.level);
  if (!hits) return null;
  const cast = stats.casting.find((c) => c.label === entry.title);
  const mod = entry.ability ? stats.mods[entry.ability] : 0;
  const dc = cast ? cast.dc : 8 + stats.pb + mod;
  const attack = cast ? cast.attack : stats.pb + mod;
  // Agonising Blast: the Charisma modifier on each beam of Eldritch Blast
  const flat = s.n === 'Eldritch Blast' && (stats.options || new Set()).has('Agonising Blast') ? Math.max(0, stats.mods.cha) : 0;
  const dmg = (x) => ({ dice: avgDice(x.dice) * typeFactor(target, x.type, true), flat: (x.flat + flat) * typeFactor(target, x.type, true) });
  const noteSave = hits.parts.map((x) => /(STR|DEX|CON|INT|WIS|CHA)\w* Saving Throw/i.exec(x.note)).find(Boolean);
  const saveKey = s.sv ? String(s.sv).toLowerCase().slice(0, 3) : noteSave ? noteSave[1].toLowerCase() : '';
  let total = 0;
  let how = '';
  if (s.at) {
    const p = hitChance(attack, target.ac, stats.crit, stats.advantage);
    total = hits.beams * hits.parts.reduce((a, x) => { const d = dmg(x); return a + p.hit * (d.dice + d.flat) + p.crit * d.dice; }, 0);
    how = t('{n}% to hit', { n: Math.round(p.hit * 100) });
  } else if (saveKey && target.saves) {
    // the target fails when its d20 plus the save bonus stays under the DC
    const fail = Math.max(0, Math.min(1, (dc - 1 - target.saves[saveKey]) / 20));
    const kept = /half|halv/i.test((s.os || '') + hits.parts.map((x) => x.note).join(' ')) ? 0.5 : 0;
    total = hits.parts.reduce((a, x) => { const d = dmg(x); return a + (d.dice + d.flat) * (fail + (1 - fail) * kept); }, 0);
    how = t('{ab} save, DC {dc}: {n}% fail', { ab: saveKey.toUpperCase(), dc, n: Math.round(fail * 100) }) + (kept ? ' · ' + t('half on a save') : '');
  } else {
    total = hits.beams * hits.parts.reduce((a, x) => { const d = dmg(x); return a + d.dice + d.flat; }, 0);
    how = t('always lands');
  }
  const text = hits.parts.map((x) => [x.dice, x.flat + flat ? '+ ' + (x.flat + flat) : '', x.type].filter(Boolean).join(' ')).join(', ');
  return { name: s.n, sp: s, total, how, text: (hits.beams > 1 ? hits.beams + ' × ' : '') + text, area: !!s.ao };
}
// Every damaging spell of the build against the target, strongest first.
const spellOptions = (stats, target) => damagingSpells(stats).map((x) => spellDamage(stats, x, target)).filter((x) => x && x.total > 0).sort((x, y) => y.total - x.total);
// How often a spell of that level can be cast: at will, or the slots of its level and above.
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
  const spells = stats.build ? spellOptions(stats, target) : [];
  const cantrip = spells.find((x) => !x.sp.lv) || null;
  return { target, plan, spells, cantrip, total: Math.max(plan ? plan.total : 0, cantrip ? cantrip.total : 0) };
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
// The block under the attacks: the turn of weapon attacks, the best the build does at will, the spells.
function turnBox(stats, style) {
  const best = bestTurn(stats, style, targetOf());
  const { plan, spells, cantrip, target } = best;
  if (!plan && !spells.length) return '';
  const who = esc(targetLabel(target));
  const count = (x) => (x.chance != null ? Math.round(x.chance * 100) + '%' : x.n) + ' × ';
  const weapon = plan ? `<p class="turn"><b>${plan.total.toFixed(1)}</b>${t('average damage in a turn against {who}', { who })}: ${plan.parts.map((x) =>
    `${count(x)}${esc(x.row.name)} (${esc(x.how)}, ${x.each.toFixed(1)} ${t('each')})`).join(' + ')}${
    stats.advantage ? ' · ' + t('with Advantage') : ''}${stats.crit < 20 ? ' · ' + t('critical hit on {n} or more', { n: stats.crit }) : ''}</p>` : '';
  const spends = turnSpends(stats, plan);
  const row = (x) => `<div class="opt"><b>${pic(x.sp.i, 'pic small')}${esc(x.name)}</b><span>${esc(x.text)}</span><span>${esc(x.how)}</span>
    <strong>${x.total.toFixed(1)}</strong><small>${x.sp.lv ? t('level {n} slot', { n: x.sp.lv }) + ' · ' : ''}${esc(castsText(stats, x.sp.lv))}${x.area ? ' · ' + t('each target in the area') : ''}</small></div>`;
  const shown = spells.slice(0, 8);
  return `${weapon}
    ${spends.length ? `<p class="muted">${spends.map(esc).join(' · ')}</p>` : ''}
    ${cantrip && plan && cantrip.total > plan.total ? `<p class="muted">${t('At will, {spell} does more than the weapon: {n} a turn.', { spell: esc(cantrip.name), n: cantrip.total.toFixed(1) })}</p>` : ''}
    ${shown.length ? `<h3 class="group">${t('Spells against {who}', { who })}</h3><div class="opts">${shown.map(row).join('')}</div>
      <p class="muted">${t('Average damage of one cast at the spell\'s own level, on one target. Damage that comes on later turns is not counted.')}</p>` : ''}`;
}
// "Fire immune, Slashing resistant (non-magical)".
const resText = (e) => Object.keys(e.res || {}).map((k) => k + ' ' + ({ r: t('resistant'), rn: t('resistant (non-magical)'), i: t('immune'), in: t('immune (non-magical)'), v: t('vulnerable') })[e.res[k]]);
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
      ABILS.map(([k, short]) => short + ' ' + signed(target.saves[k])).join(' ')}${res.length ? ' · ' + esc(res.join(', ')) : ''}</p>` : ''}`;
}

Object.assign(actions, {
  'enemy-open'() {
    const rows = ENEMIES.map((e) => [e.n, resText(e).join(', '), `AC ${e.ac} · HP ${e.hp.b} · ${t('level {n}', { n: e.lv })}`, '', t('Act {n}', { n: e.act })]);
    openChooser(t('Enemy'), t('Reference enemies, with the numbers of their page on bg3.wiki. Take the choice back and confirm to measure against just an Armour Class.'),
      [{ label: t('Enemy'), n: 1, min: 0, options: rows, chosen: state.ui.target ? [state.ui.target] : [] }], (done) => { state.ui.target = done[0].chosen[0] || ''; });
    return false;
  },
  'honour-toggle'() { state.ui.honour = !honourMode(); },
});
