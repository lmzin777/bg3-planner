// Damage test: the dice of a fight, rolled. The page takes the build on screen with the enemy and the switches of
// Final numbers, and rolls what damage.js works out on average: every attack roll, saving throw and damage die,
// turn after turn, following a plan of turns (an action and a bonus action for each of the first three turns and
// for the ones after), spending the spell slots and the other things that run out, and counting how long Haste,
// Rage and the spells that hold Concentration last. Nothing rolled here is saved.
'use strict';

let simRandom = Math.random;  // the tests put a fixed roll here
const rollDie = (sides) => 1 + Math.floor(simRandom() * sides);
// "2d6" rolled, with twice the dice on a critical hit: { sum, rolls }. A flat number is itself.
function rollDice(text, crit) {
  const m = /(\d+)d(\d+)/.exec(text || '');
  if (!m) return { sum: Number(text) || 0, rolls: [] };
  const rolls = Array.from({ length: Number(m[1]) * (crit ? 2 : 1) }, () => rollDie(Number(m[2])));
  return { sum: rolls.reduce((a, n) => a + n, 0), rolls };
}
// A d20: the better of two rolls with Advantage (1), the worse with Disadvantage (-1).
function rollD20(mode) {
  const a = rollDie(20);
  if (!mode) return a;
  const b = rollDie(20);
  return mode > 0 ? Math.max(a, b) : Math.min(a, b);
}
const tenth = (n) => (Math.round(n * 10) / 10).toString();
// The damage of one roll as text: "1d8 (5) + 3 = 8", and what is left of it after a resistance.
function damageBits(bits, raw, dealt) {
  const text = bits.filter(Boolean).map((x, i) => (i ? '+ ' : '') + x).join(' ');
  return text + ' = ' + tenth(raw) + (Math.abs(raw - dealt) > 0.001 ? ' → ' + tenth(dealt) : '');
}
const diceBit = (dice, r, label) => (r.rolls.length ? `${r.rolls.length}d${/d(\d+)/.exec(dice)[1]} (${r.rolls.join(', ')})` : String(r.sum)) + (label ? ' ' + label : '');

// One weapon attack: the d20 against the Armour Class (a natural 1 misses, the critical threshold always hits),
// then every damage die, rolled twice on a critical hit. `riders` are the spells at work that add a die to it.
function rollWeapon(stats, row, target, riders) {
  const d20 = rollD20(stats.advantage ? 1 : 0);
  const bonus = row.attackTotal + (row.attackDice || []).reduce((a, x) => a + rollDice(x).sum, 0);
  const crit = d20 >= stats.crit;
  const hit = d20 !== 1 && (crit || d20 + bonus >= target.ac);
  const line = { name: row.name, kind: 'attack', d20, bonus, against: target.ac, hit, crit: hit && crit, damage: 0, text: '' };
  if (!hit) return line;
  const magical = rowMagical(stats, row);
  const bits = [];
  let raw = 0;
  const extra = (riders || []).map((r) => [r.dice, /weapon/i.test(r.type) ? '' : r.type, r.name]);
  [[row.dice, row.type, ''], ...(row.extraDice || []).map((d) => [d[0], d[1], '']), ...extra].forEach(([dice, type, from]) => {
    if (!dice) return;
    const r = rollDice(dice, crit);
    raw += r.sum;
    line.damage += r.sum * typeFactor(target, type || row.type, from ? true : magical);
    bits.push(diceBit(dice, r, from || (type && type !== row.type ? type : '')));
  });
  if (row.damageTotal) { raw += row.damageTotal; line.damage += row.damageTotal * typeFactor(target, row.type, magical); bits.push(String(row.damageTotal)); }
  line.text = damageBits(bits, raw, line.damage) + ' ' + row.type;
  return line;
}
// The saving throw of an enemy against a cast: { d20, passed }.
const throwSave = (save) => { const d20 = rollD20(save.dis ? -1 : 0); return { d20, passed: d20 + save.bonus >= save.dc }; };
// One part of a spell's damage against a saving throw already rolled.
function saveLine(name, save, part, thrown) {
  const dice = rollDice(part.dice);
  const raw = dice.sum + part.flat;
  const dealt = raw * part.f * (thrown.passed ? part.kept : 1);
  return { name, kind: 'save', ab: save.key.toUpperCase(), d20: thrown.d20, bonus: save.bonus, against: save.dc, passed: thrown.passed, kept: part.kept, damage: dealt,
    text: damageBits([dice.rolls.length ? diceBit(part.dice, dice) : '', part.flat ? String(part.flat) : ''], raw, dealt) + ' ' + part.type };
}
// One cast of a spell, from the recipe spellDamage leaves: each part by attack roll, by the enemy's saving throw
// (one for each enemy, for all the parts) or with no roll.
function rollSpell(stats, x, target, riders) {
  const r = x.recipe;
  const lines = [];
  if (r.weapon) {
    const line = rollWeapon(stats, r.weapon, target, riders);
    line.name = x.name;
    lines.push(line);
    if (line.hit && r.save && r.parts.length) { const thrown = throwSave(r.save); r.parts.forEach((part) => lines.push(saveLine(x.name, r.save, part, thrown))); }
    return lines;
  }
  for (let rep = 0; rep < r.repeat; rep++) {
    const saves = [];
    r.parts.forEach((part) => {
      for (let k = 0; k < part.times; k++) {
        if (part.mode === 'save') { saves[k] = saves[k] || throwSave(r.save); lines.push(saveLine(x.name, r.save, part, saves[k])); continue; }
        const d20 = part.mode === 'attack' ? rollD20(r.adv ? 1 : 0) : 0;
        const crit = part.mode === 'attack' && d20 >= r.crit;
        const hit = part.mode !== 'attack' || (d20 !== 1 && (crit || d20 + r.attack >= r.ac));
        const line = { name: x.name, kind: part.mode, d20, bonus: r.attack, against: r.ac, hit, crit: hit && crit, damage: 0, text: '' };
        if (hit) {
          const dice = rollDice(part.dice, crit);
          let raw = dice.sum + part.flat;
          line.damage = raw * part.f;
          const bits = [dice.rolls.length ? diceBit(part.dice, dice) : '', part.flat ? String(part.flat) : ''];
          // a die on "every attack from the caster" (Hex) rides on spell attacks too
          (part.mode === 'attack' ? riders || [] : []).filter((y) => y.all).forEach((y) => {
            const more = rollDice(y.dice, crit);
            raw += more.sum;
            line.damage += more.sum * typeFactor(target, y.type, true);
            bits.push(diceBit(y.dice, more, y.name));
          });
          line.text = damageBits(bits, raw, line.damage) + ' ' + part.type;
        }
        lines.push(line);
      }
    });
  }
  return lines;
}
// The damage a spell cast earlier does now: on its own turn after turn (`when` empty), or when the enemy does
// what it waits for ('struck', 'moves').
function rollLater(e, when) {
  const lines = [];
  const saves = [];
  e.later.filter((part) => (part.when || '') === when).forEach((part) => {
    for (let k = 0; k < part.times; k++) {
      if (part.mode === 'save' && e.save) { saves[k] = saves[k] || throwSave(e.save); lines.push(saveLine(e.name, e.save, part, saves[k])); continue; }
      const dice = rollDice(part.dice);
      const raw = dice.sum + part.flat;
      lines.push({ name: e.name, kind: 'auto', hit: true, damage: raw * part.f, text: damageBits([dice.rolls.length ? diceBit(part.dice, dice) : '', part.flat ? String(part.flat) : ''], raw, raw * part.f) + ' ' + part.type });
    }
  });
  lines.forEach((x) => { x.how = t('still at work'); });
  return lines;
}

// ---------- a side of the test ----------
// What a build starts a fight with, of the things that run out.
function simResources(stats) {
  const res = Object.fromEntries((stats.resources || []).map(([n, v]) => [n, Number(v) || 0]));
  return { slots: (stats.slots || []).slice(), pact: stats.pact ? stats.pact.n : 0, pactLevel: stats.pact ? stats.pact.level : 0,
    points: res['Sorcery Points'] || 0, ki: res['Ki Points'] || 0, rage: res['Rage Charges'] || 0, surge: (stats.fighter || 0) >= 2 ? 1 : 0,
    // the Martial Adept feat gives one Superiority Die of its own
    dice: (res['Superiority Dice'] || 0) + ((stats.featNames || new Set()).has('Martial Adept') ? 1 : 0) };
}
// A slot for the cast: the lowest one that is enough, a Warlock spell from the pact slots first.
function takeSlot(left, x, spend) {
  const pact = () => { if (!(left.pact > 0 && left.pactLevel >= x.slot)) return false; if (spend) left.pact--; return true; };
  if (x.cls === 'Warlock' && pact()) return true;
  for (let i = x.slot - 1; i < left.slots.length; i++) if (left.slots[i] > 0) { if (spend) left.slots[i]--; return true; }
  return pact();
}
// The plan of turns of a build: four steps (turns 1, 2, 3 and every turn after), each with what the action and
// the bonus action go to. An empty field of the first three follows the last; the last defaults to the weapon
// and to the best bonus action the build has.
const simSteps = (b) => { const saved = (state.ui.simPlans || {})[b.id] || []; return [0, 1, 2, 3].map((i) => ({ a: (saved[i] || {}).a || '', q: (saved[i] || {}).q || '', x: (saved[i] || {}).x || '' })); };
// What the enemy does to the build each turn, as set on the page: melee attacks, how many of them hit, the damage
// of a hit, and whether it moves.
const simFoe = () => { const attacks = Math.max(0, Number(state.ui.foeAttacks) || 0); return { attacks, hits: Math.min(attacks, Math.max(0, Number(state.ui.foeHits) || 0)), damage: Math.max(1, Number(state.ui.foeDamage) || 10), moves: !!state.ui.foeMoves }; };
// Haste among the spells of a build, with the group that casts it.
function knownHaste(stats) {
  let out = null;
  if (stats.build) spellbook(stats.build, stats.act, stats).forEach((g) => g.spells.forEach((x) => { if (!out && x.sp && x.sp.n === 'Haste') out = { name: 'Haste', sp: x.sp, slot: x.sp.lv, cls: g.cls || '' }; }));
  return out;
}
// A side: the numbers of a build with the gear of an act, the enemy and the plan. `calm()` gives the numbers
// without Rage, for the turns the build is not raging.
function sideOf(stats, style, target, steps) {
  const con = (stats.saves || []).find((k) => k.key === 'con');
  const side = { stats, style, target, steps, memo: new Map(), calm: () => stats, foe: { attacks: 0, hits: 0, damage: 0, moves: false }, react: '',
    // the Constitution save that keeps Concentration, with Advantage from a feat that says so (War Caster)
    con: con ? con.bonus : 0, conAdv: FEATS.some(([name, text]) => (stats.featNames || new Set()).has(name) && /Advantage on Saving Throws to maintain Concentration/i.test(text)) };
  let haste;
  Object.defineProperty(side, 'haste', { get: () => (haste === undefined ? (haste = knownHaste(stats)) : haste) });
  return side;
}
function simSide(b, act, target) {
  const total = charLevel(b);
  const at = b.current && b.current < total ? b.current : 0;
  const opts = at ? { level: at } : null;
  const side = sideOf(finalStats(b, act, opts), buildProfile(at ? atLevel(b, at) : b, act).style, target, simSteps(b));
  let calm = null;
  side.calm = () => calm || (calm = finalStats(Object.assign({}, b, { active: (b.active || []).filter((k) => k !== 'rage') }), act, opts));
  return Object.assign(side, { b, act, at, foe: simFoe(), react: (state.ui.simReacts || {})[b.id] || '' });
}
// What a side can do with a set of switches on: its weapon turn and its spells. Worked out once for each set.
function simView(side, calm, on, noKi) {
  const key = (calm ? 'c|' : 'r|') + on.join(',') + (noKi ? '|k' : '');
  let v = side.memo.get(key);
  if (!v) {
    const st = Object.assign({}, calm ? side.calm() : side.stats, { active: on });
    const plan = turnPlan(st, side.style, side.target, new Set(noKi ? ['Ki Points'] : []));
    const list = spellOptions(st, side.target, plan ? plan.parts[0].row : null);
    // reactions: the spells cast in answer to a hit (Hellish Rebuke), and Riposte with the melee weapon
    const reacts = new Map();
    if (st.build) spellbook(st.build, st.act, st).forEach((g) => g.spells.forEach((x) => {
      if (!x.sp || x.sp.a !== 'reaction' || reacts.has(x.sp.n)) return;
      const r = spellDamage(st, { sp: x.sp, title: g.title, ability: g.ability, cls: g.cls || '' }, side.target, plan ? plan.parts[0].row : null);
      if (r && !r.rider && r.total > 0) reacts.set(r.name, r);
    }));
    const melee = (st.attacks ? st.attacks.rows : []).find((r) => r.slot === 'meleeMain' && !r.thrown) || (st.attacks ? st.attacks.rows : []).find((r) => r.slot === 'unarmed');
    v = { st, plan, list, spells: new Map([...list, ...(list.setups || [])].map((x) => [x.name, x])), riders: new Map((list.riders || []).map((x) => [x.name, x])), cantrip: list.find((x) => !x.sp.lv) || null,
      reacts, riposte: (st.options || new Set()).has('Riposte') && melee ? melee : null };
    side.memo.set(key, v);
  }
  return v;
}
// The side as Final numbers sees it: everything switched on, nothing run out.
const simBase = (side) => simView(side, false, side.stats.active || [], false);

// ---------- a fight ----------
// With `endless`, nothing runs out and what is switched on simply stays on: one turn of it is the turn the
// averages describe.
const newFight = (side, endless) => ({ turn: 0, left: endless ? null : simResources(side.stats), dealt: 0, effects: [], lethargic: 0, used: [] });
// One turn of a fight: the build's own turn, then the enemy's (what it does to the build is set on the page).
// { n, name, lines, total, notes }
function fightTurn(side, fight) {
  const n = ++fight.turn;
  const left = fight.left;
  const base = side.stats.active || [];
  const opts = side.stats.options || new Set();
  const target = side.target;
  const notes = [];
  const lines = [];
  const did = [];
  const has = (kind) => fight.effects.find((e) => e.kind === kind);
  const named = (name) => fight.effects.find((e) => e.name === name);
  const drop = (list) => { fight.effects = fight.effects.filter((e) => !list.includes(e)); };
  const done = () => { const total = lines.reduce((a, x) => a + x.damage, 0); fight.dealt += total; return { n, name: did.join(' + ') || t('Nothing'), lines, total, notes }; };
  // what ran its course; the turn after Haste ends is lost
  fight.effects = fight.effects.filter((e) => {
    if (e.until >= n) return true;
    if (!e.quiet) notes.push(t('{name} ends.', { name: e.name }));
    if (e.kind === 'haste') fight.lethargic = n;
    return false;
  });
  // the damage of what was cast on earlier turns
  fight.effects.filter((e) => e.kind === 'later' && e.from < n).forEach((e) => { const out = rollLater(e, ''); if (!out.length) return; lines.push(...out); if (e.once) { e.until = n; e.quiet = true; } });
  const lost = fight.lethargic === n;
  if (lost) { notes.push(t('Lethargic after Haste: no action this turn.')); did.push('Lethargic'); }
  // Haste switched on above comes from someone else: it is there from the first turn, for its ten turns
  if (left && n === 1 && base.includes('haste')) fight.effects.push({ name: 'Haste', kind: 'haste', until: 10 });
  // Rage is entered with the bonus action, lasts ten turns and takes a charge
  let bonusUsed = lost;
  if (!lost && left && base.includes('rage') && !has('rage')) {
    if (left.rage > 0) { left.rage--; fight.effects.push({ name: 'Rage', kind: 'rage', until: n + 9 }); bonusUsed = true; notes.push(t('Rage: entered with the bonus action.')); }
    else if (!fight.noRage) { fight.noRage = true; notes.push(t('No Rage Charges left.')); }
  }
  const raging = base.includes('rage') && (!left || !!has('rage'));
  const calm = base.includes('rage') && !raging;
  let on = base.filter((k) => (k !== 'haste' || !left || !!has('haste')) && (k !== 'rage' || raging) && (k !== 'surge' || !left || left.surge > 0));
  if (has('haste') && !on.includes('haste')) on.push('haste');
  const view = () => simView(side, calm, on, !!left && left.ki < 1);
  const step = side.steps[Math.min(n, 4) - 1];
  const wantOf = (f, by) => step[f] || side.steps[3][f] || by;
  const wantA = wantOf('a', 'weapon');
  const wantQ = wantOf('q', 'auto');
  const wantX = wantOf('x', 'same');
  const riders = () => fight.effects.filter((e) => e.kind === 'rider').map((e) => e.rider);
  let stop = false;     // the rest of the turn is lost
  let crits = 0;
  const noSlot = (name) => t('No spell slot left for {spell}: the turn goes to what the build does at will.', { spell: name });
  // one spell at a time holds Concentration. Haste cast on oneself and dropped for another spell leaves the caster
  // Lethargic at once (until the end of the turn), and the new spell ends
  const concentrate = (name) => {
    const own = fight.effects.find((e) => e.kind === 'haste' && e.conc);
    if (own) {
      drop([own]);
      stop = true;
      notes.push(t('Casting {spell} drops the Concentration on Haste: Lethargic at once, the new spell ends and the rest of the turn is lost.', { spell: name }));
      return false;
    }
    fight.effects = fight.effects.filter((e) => { if (!e.conc) return true; notes.push(t('{name} ends: Concentration goes to {spell}.', { name: e.name, spell: name })); return false; });
    return true;
  };
  const noSpells = (name) => { if (raging) notes.push(t('No spells while raging: {spell} is not cast.', { spell: name })); return raging; };
  // pays for a cast: a slot, or its one use a rest for a spell that recharges that way; false when it cannot
  // (`silent` leaves the reason unsaid: a reaction that cannot be paid for just does not happen)
  const pay = (x, points, silent) => {
    if (!left) return true;
    const free = /rest/i.test(x.sp.rc || '');
    if (free && fight.used.includes(x.name)) { if (!silent) notes.push(t('{spell} was used already: it comes back with a rest.', { spell: x.name })); return false; }
    if (!free && x.slot && !takeSlot(left, x, false)) { if (!silent) notes.push(noSlot(x.name)); return false; }
    if (free) fight.used.push(x.name); else if (x.slot) takeSlot(left, x, true);
    left.points -= points || 0;
    return true;
  };
  // a spell that deals damage or answers the enemy; `quick` casts it with the bonus action, for 3 Sorcery Points more
  const cast = (name, quick) => {
    let x = view().spells.get(name);
    if (!x || noSpells(name)) return false;
    if (named(name) && (x.perTurn || x.setup)) return false;  // still at work: not cast again
    if (left && (x.points || 0) + (quick ? 3 : 0) > left.points) {
      if (quick && left.points < 3) { notes.push(t('No Sorcery Points left for Quickened Spell.')); return false; }
      if (x.points) {
        on = on.filter((k) => k !== 'meta:twin' && k !== 'meta:heighten');
        x = view().spells.get(name);
        notes.push(t('No Sorcery Points left for the Metamagic.'));
        if (!x) return false;
      }
    }
    if (!pay(x, (x.points || 0) + (quick ? 3 : 0))) return false;
    did.push(name + (quick ? ' (Quickened Spell)' : ''));
    const r = x.recipe;
    if (r.conc && !concentrate(name)) return true;
    const out = rollSpell(view().st, x, target, riders());
    if (quick) out.forEach((l) => { l.how = 'Quickened Spell'; });
    lines.push(...out);
    // what it leaves at work: damage on the following turns (when the attack that carries it hit), damage that
    // waits for the enemy, Concentration
    const landed = !out.some((l) => l.kind === 'attack') || out.some((l) => l.kind === 'attack' && l.hit);
    const later = landed ? r.later : [];
    const ticking = later.filter((p) => !p.when);
    const once = ticking.length > 0 && ticking.every((p) => p.once);
    const moving = later.length > 0 && later.every((p) => p.when === 'moves');
    if (later.length || r.conc) {
      drop(fight.effects.filter((e) => e.name === name));
      const e = { name, kind: 'later', from: n, conc: r.conc, later, save: r.save, once, quiet: moving || (once && later.length === ticking.length),
        until: moving ? n : once ? n + 1 : r.turns ? n + r.turns - 1 : Infinity };
      // Armour of Agathys answers while the temporary hit points it gives hold
      if (x.setup && /temporary hit points/i.test(x.sp.d || '')) e.pool = later.reduce((a, p) => a + p.flat, 0);
      fight.effects.push(e);
      if (x.setup) notes.push(t('{spell} cast: {x}.', { spell: name, x: x.text }));
    }
    return true;
  };
  // a spell that adds a die to every hit while it lasts
  const castRider = (name) => {
    const x = view().riders.get(name);
    if (!x || named(name) || base.includes('text:' + name) || noSpells(name)) return false;  // at work already, or counted by its switch
    if (!pay(x, 0)) return false;
    did.push(name);
    if (x.sp.co && !concentrate(name)) return true;
    const turns = Number((/(\d+) turn/.exec(x.sp.du || '') || [])[1]) || 0;
    fight.effects.push({ name, kind: 'rider', until: turns ? n + turns - 1 : Infinity, conc: !!x.sp.co, rider: { name, dice: x.rider.dice, type: x.rider.type, all: /attack from/i.test(x.rider.note || '') } });
    notes.push(t('{spell} cast: {dice} on every hit while it lasts.', { spell: name, dice: dicePart(x.rider) }));
    return true;
  };
  const castHaste = () => {
    const x = side.haste;
    if (!x || has('haste') || noSpells('Haste') || !pay(x, 0)) return false;
    did.push('Haste');
    if (!concentrate('Haste')) return true;
    fight.effects.push({ name: 'Haste', kind: 'haste', until: n + 9, conc: true });
    if (!on.includes('haste')) on = on.concat('haste');
    notes.push(t('Haste cast: one more action a turn, for 10 turns.'));
    return true;
  };
  // weapon attacks
  const swing = (part) => {
    const k = part.chance != null ? 1 : part.n;
    if (!did.includes(t('Weapon attacks'))) did.push(t('Weapon attacks'));
    for (let i = 0; i < k; i++) {
      const line = rollWeapon(view().st, part.row, target, riders());
      line.how = part.how;
      if (line.crit) crits++;
      lines.push(line);
    }
    if (left && part.spends === 'Action Surge') left.surge--;
    if (left && part.spends === 'Ki Points') left.ki--;
  };
  // an action spent on the weapon: the Attack action, or the attacks Action Surge or Haste allow; with no weapon,
  // the cantrip
  const weaponAct = (kind) => {
    const v = view();
    if (!v.plan) {
      if (v.cantrip && !raging) cast(v.cantrip.name);
      if (left && kind === 'surge') left.surge--;
      return;
    }
    const part = kind === 'main' ? v.plan.parts[0] : v.plan.parts.find((x) => x.spends === (kind === 'surge' ? 'Action Surge' : 'Haste'));
    if (part) swing(part);
  };
  // an action that goes to a spell, falling back on what the build does at will
  const spellAct = (name, kind) => {
    if (cast(name)) { if (left && kind === 'surge') left.surge--; return name; }
    const v = view();
    if (kind === 'main' && v.plan && v.cantrip && !raging && v.cantrip.total > v.plan.total) cast(v.cantrip.name); else weaponAct(kind);
    return 'weapon';
  };
  const bonusAttack = () => { const p = view().plan; const part = p && p.parts.find((x) => x.bonus); if (part && (part.chance == null || crits)) swing(part); };

  if (!lost) {
    // the bonus action comes first when it sets something up for the attacks
    if (!bonusUsed && view().riders.has(wantQ) && view().riders.get(wantQ).sp.a === 'bonus') bonusUsed = castRider(wantQ);
    let went = '';  // what the action went to: the weapon, or a spell that can be cast again
    if (!stop && wantA !== 'none') {
      if (wantA === 'weapon') { weaponAct('main'); went = 'weapon'; }
      else if (wantA === 'Haste' && side.haste) { if (!castHaste()) { weaponAct('main'); went = 'weapon'; } }
      else if (view().riders.has(wantA)) { if (!castRider(wantA)) { weaponAct('main'); went = 'weapon'; } }
      else went = spellAct(wantA, 'main');
    }
    // the actions on top: Action Surge (once a Short Rest, when switched on) and the one Haste gives
    const extras = [];
    if (on.includes('surge') && (side.stats.fighter || 0) >= 2) extras.push('surge');
    if (has('haste') || (!left && base.includes('haste'))) extras.push('haste');
    extras.forEach((kind) => {
      if (stop || wantA === 'none' || wantX === 'none') return;
      const want = wantX === 'same' ? went || 'weapon' : wantX;
      const settled = view().spells.get(want);
      if (want === 'weapon' || !settled || (settled.setup && named(want))) weaponAct(kind); else spellAct(want, kind);
    });
    if (!stop && !bonusUsed && wantQ !== 'none') {
      if (wantQ.indexOf('quick:') === 0) { if (!(opts.has('Quickened Spell') && cast(wantQ.slice(6), true))) bonusAttack(); }
      else if (view().spells.has(wantQ) && view().spells.get(wantQ).sp.a === 'bonus') { if (!cast(wantQ)) bonusAttack(); }
      else bonusAttack();
    }
  }

  // ----- the enemy's turn: what it does to the build is set on the page -----
  const foe = side.foe;
  if (left && (foe.attacks || foe.moves || has('rage') || fight.effects.some((e) => e.later && e.later.some((p) => p.when)))) {
    const attacked = lines.some((l) => l.kind === 'attack');
    const hits = Math.min(foe.hits, foe.attacks);
    for (let h = 0; h < hits; h++) {
      // what answers a melee hit
      fight.effects.filter((e) => e.kind === 'later' && e.later.some((p) => p.when === 'struck')).forEach((e) => {
        const out = rollLater(e, 'struck');
        out.forEach((l) => { l.how = t('when struck'); });
        lines.push(...out);
        if (e.pool != null) { e.pool -= foe.damage; if (e.pool <= 0) { drop([e]); notes.push(t('{name} ends.', { name: e.name })); } }
      });
      // damage taken can break Concentration: Constitution save against 10 or half the damage, whichever is higher
      const held = fight.effects.filter((e) => e.conc);
      if (held.length && foe.damage > 0) {
        const dc = Math.max(10, Math.floor(foe.damage / 2));
        const d20 = rollD20(side.conAdv ? 1 : 0);
        if (d20 === 1 || d20 + side.con < dc) {
          drop(held);
          if (held.some((e) => e.kind === 'haste')) fight.lethargic = n + 1;
          notes.push(t('A hit breaks the Concentration ({roll} {bonus} against DC {dc}): {name} ends.', { roll: d20, bonus: (side.con < 0 ? '− ' : '+ ') + Math.abs(side.con), dc, name: held.map((e) => e.name).join(', ') }));
        }
      }
    }
    // one reaction a round
    const v = view();
    if (side.react === 'Riposte') {
      if (foe.attacks - hits > 0 && v.riposte && left.dice > 0) {
        left.dice--;
        // weapon damage and the superiority die: 1d8, 1d10 with Improved Combat Superiority (the wiki's Riposte page)
        const die = (side.stats.gains || []).includes('Improved Combat Superiority') ? '1d10' : '1d8';
        const line = rollWeapon(v.st, Object.assign({}, v.riposte, { extraDice: [...(v.riposte.extraDice || []), [die, '', 'Riposte']] }), target, riders());
        Object.assign(line, { name: 'Riposte', how: t('reaction') });
        lines.push(line);
      }
    } else if (side.react && hits > 0 && v.reacts.has(side.react)) {
      const x = v.reacts.get(side.react);
      if (pay(x, 0, true)) { const out = rollSpell(v.st, x, target, []); out.forEach((l) => { l.how = t('reaction'); }); lines.push(...out); }
      else if (!fight.noReact) { fight.noReact = true; notes.push(t('Nothing left to pay for {spell}: no more reactions with it.', { spell: x.name })); }
    }
    // damage that waits for the enemy to move (Booming Blade)
    fight.effects.filter((e) => e.kind === 'later' && e.later.some((p) => p.when === 'moves')).forEach((e) => {
      if (foe.moves) { const out = rollLater(e, 'moves'); out.forEach((l) => { l.how = t('when it moves'); }); lines.push(...out); }
      drop([e]);
    });
    // Rage ends early in a turn with no attack made and no damage taken
    const rage = has('rage');
    if (rage && !attacked && !hits) { drop([rage]); notes.push(t('Rage ends early: no attack made and no damage taken this turn.')); }
  }
  return done();
}
// One turn the way the averages see it: `action` every turn ('' for the weapon), with `left` to spend (nothing
// runs out when it is null).
function simTurn(stats, style, target, action, left) {
  const side = sideOf(stats, style, target, [0, 1, 2, 3].map(() => ({ a: action || 'weapon', q: 'auto', x: 'same' })));
  return fightTurn(side, { turn: 0, left, dealt: 0, effects: [], lethargic: 0, used: [] });
}
// Many fights with a side's plan: the average damage of a turn and of the first turn, and how many turns the
// enemy lasts (or, with no hit points to go by, the damage of ten turns).
function simFights(side, hp, count) {
  const per = [];
  const first = [];
  const main = [];
  for (let k = 0; k < count; k++) {
    const fight = newFight(side);
    let turns = 0;
    while (hp ? fight.dealt < hp && turns < 60 : turns < 10) { const r = fightTurn(side, fight); if (!turns) first.push(r.total); turns++; }
    per.push(fight.dealt / turns);
    main.push(hp ? turns : fight.dealt);
  }
  const avg = (list) => list.reduce((a, x) => a + x, 0) / list.length;
  return { count, perTurn: avg(per), first: avg(first), main: { avg: avg(main), min: Math.min(...main), max: Math.max(...main) } };
}

// ---------- the page ----------
let sim = { key: '', fight: null, turns: [], many: null };
// In Honour mode the enemy has its Honour hit points, or the Tactician ones when its page gives no others.
const enemyHp = (e) => (honourMode() ? e.hp.h || e.hp.t || e.hp.b : e.hp.b);
const sideKey = (side) => [side.b.id, side.act, side.at, side.b.active, side.steps, side.b.elixir, side.react, side.foe, simBase(side).list.map((x) => x.total.toFixed(2)), simBase(side).plan ? simBase(side).plan.total.toFixed(2) : ''];
// Everything the test needs from the build on screen; a change in any of it starts the test over.
function simContext() {
  const b = curBuild();
  if (!b || !charLevel(b)) return null;
  const target = targetOf();
  const side = simSide(b, state.ui.act, target);
  const v = simBase(side);
  const sb = state.ui.simB;
  const ob = sb && buildById(sb.id);
  const other = ob && charLevel(ob) && !(ob.id === b.id && (sb.act || state.ui.act) === state.ui.act) ? simSide(ob, sb.act || state.ui.act, target) : null;
  const hp = target.enemy ? enemyHp(target.enemy) : 0;
  const key = JSON.stringify([sideKey(side), other ? sideKey(other) : '', target.name, target.ac, target.saves, honourMode(), state.ui.castLevel, state.ui.targets]);
  if (sim.key !== key) sim = { key, fight: newFight(side), turns: [], many: null };
  const mainA = side.steps[3].a || 'weapon';
  const chosen = v.spells.get(mainA) || (!v.plan && mainA === 'weapon' ? v.cantrip : null);
  return { b, side, other, v, target, hp, chosen, expected: chosen ? chosen.total : v.plan ? v.plan.total : 0, can: !!(v.plan || v.list.length) };
}
function simRun(ctx, n, untilDown) {
  for (let k = 0; k < n; k++) {
    if (ctx.hp && sim.fight.dealt >= ctx.hp) break;
    sim.turns.push(fightTurn(ctx.side, sim.fight));
    if (!untilDown && k + 1 >= n) break;
  }
}
const SIM_SHOWN = 30;
const SIM_FIGHTS = 300;
function simLine(x) {
  const sign = (n) => (n < 0 ? ' − ' + Math.abs(n) : ' + ' + n);
  let roll = '';
  let out = '';
  if (x.kind === 'attack') {
    roll = t('{roll}{bonus} = {total} against AC {ac}', { roll: x.d20, bonus: sign(x.bonus), total: x.d20 + x.bonus, ac: x.against });
    out = x.crit ? t('critical hit') : x.hit ? t('hit') : x.d20 === 1 ? t('natural 1: miss') : t('miss');
  } else if (x.kind === 'save') {
    roll = t('{ab} save {roll}{bonus} = {total} against DC {dc}', { ab: x.ab, roll: x.d20, bonus: sign(x.bonus), total: x.d20 + x.bonus, dc: x.against });
    out = !x.passed ? t('failed') : x.kept === 1 ? t('passed, all the same') : x.kept ? t('passed: half') : t('passed: nothing');
  } else roll = t('no roll');
  const good = x.kind === 'save' ? !x.passed : x.hit;
  return `<li class="${good ? '' : 'off'}${x.crit ? ' crit' : ''}"><b>${esc(x.name)}${x.how ? `<i>${esc(x.how)}</i>` : ''}</b><span>${esc(roll)}${out ? ` · <em>${esc(out)}</em>` : ''}</span>
    <span>${esc(x.text || '')}</span><strong>${tenth(x.damage)}</strong></li>`;
}
// The choices of a field of the plan: [value, name, description, facts, picture, group].
function stepOptions(ctx, i, f) {
  const { v, side } = ctx;
  const opts = side.stats.options || new Set();
  const spell = (x, value, name) => [value, name || x.name, x.text + ' · ' + x.how, [t('{n} on average', { n: x.total.toFixed(1) }), x.slot ? t('level {n} slot', { n: x.slot }) : t('at will'), x.points ? sorceryText(x.points) : '',
    x.sp.co ? t('Concentration') : '', x.later ? t('then {x}', { x: x.later }) : ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), x.slot ? t('Spells') : t('At will')];
  const rider = (x) => [x.name, x.name, x.sp.d || '', [dicePart(x.rider) + ' ' + t('on every hit'), x.slot ? t('level {n} slot', { n: x.slot }) : '', x.sp.du || '', x.sp.co ? t('Concentration') : ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), t('Sets up')];
  const out = i < 3 ? [['', t('As from turn 4 on'), '', '', '', '']] : [];
  if (f === 'x') {
    out.push(['same', t('The same as the action'), t('The weapon again, or the same spell once more while a slot is left.'), '', '', t('At will')]);
    if (v.plan) out.push(['weapon', t('Weapon attacks'), v.plan.parts[0].n + ' × ' + v.plan.parts[0].row.name + ' · ' + t('with Haste in Honour mode, one attack'), '', '', t('At will')]);
    v.list.filter((x) => x.sp.a === 'action').forEach((x) => out.push(spell(x, x.name)));
  } else if (f === 'a') {
    if (v.plan) out.push(['weapon', t('Weapon attacks'), v.plan.parts.filter((x) => !x.bonus).map((x) => `${x.n} × ${x.row.name} (${x.how})`).join(' + '), t('{n} on average', { n: v.plan.parts.filter((x) => !x.bonus).reduce((a, x) => a + x.n * x.each, 0).toFixed(1) }), '', t('At will')]);
    else if (i === 3 && v.cantrip) out.push(['weapon', v.cantrip.name, v.cantrip.text + ' · ' + v.cantrip.how, t('{n} on average', { n: v.cantrip.total.toFixed(1) }), pic(v.cantrip.sp.i, 'pic small'), t('At will')]);
    v.list.filter((x) => x.sp.a === 'action' && !(i === 3 && !v.plan && x === v.cantrip)).forEach((x) => out.push(spell(x, x.name)));
    (v.list.setups || []).filter((x) => x.sp.a === 'action').forEach((x) => out.push([x.name, x.name, x.sp.d || '', [x.text, x.slot ? t('level {n} slot', { n: x.slot }) : '', x.sp.du || ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), t('Sets up')]));
    if (side.haste) out.push(['Haste', 'Haste', side.haste.sp.d || '', [t('level {n} slot', { n: side.haste.slot }), side.haste.sp.du || '', t('Concentration')].join(' · '), pic(side.haste.sp.i, 'pic small'), t('Sets up')]);
    [...v.riders.values()].filter((x) => x.sp.a === 'action').forEach((x) => out.push(rider(x)));
  } else {
    const part = v.plan && v.plan.parts.find((x) => x.bonus);
    out.push(['auto', t('The best it has'), part ? `${part.chance != null ? Math.round(part.chance * 100) + '%' : part.n} × ${part.row.name} (${part.how})` : t('The build has no attack for its bonus action.'), '', '', t('At will')]);
    v.list.filter((x) => x.sp.a === 'bonus').forEach((x) => out.push(spell(x, x.name)));
    [...v.riders.values()].filter((x) => x.sp.a === 'bonus').forEach((x) => out.push(rider(x)));
    if (opts.has('Quickened Spell')) v.list.filter((x) => x.sp.a === 'action' && !x.weapon).forEach((x) => { const row = spell(x, 'quick:' + x.name, 'Quickened Spell: ' + x.name); row[5] = 'Quickened Spell · ' + sorceryText(3); out.push(row); });
  }
  out.push(['none', t('Nothing'), '', '', '', t('At will')]);
  return out;
}
const STEP_DEFAULT = { a: 'weapon', q: 'auto', x: 'same' };
// The reactions a build can answer the enemy with: [value, name, description, facts, picture].
function reactOptions(ctx) {
  const v = ctx.v;
  const out = [...v.reacts.values()].map((x) => [x.name, x.name, x.sp.d || '', [x.text + ' · ' + x.how, t('when the enemy lands a hit'), /rest/i.test(x.sp.rc || '') ? x.sp.rc : x.slot ? t('level {n} slot', { n: x.slot }) : ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small')]);
  if (v.riposte) out.push(['Riposte', 'Riposte', featureText('Riposte') || '', t('when the enemy misses a melee attack') + ' · Superiority Dice', '']);
  return out;
}
const stepLabel = (ctx, i, f, value) => { const row = stepOptions(ctx, i, f).find((x) => x[0] === value); return row ? row : null; };
function simPlanHtml(ctx) {
  const names = [t('Turn {n}', { n: 1 }), t('Turn {n}', { n: 2 }), t('Turn {n}', { n: 3 }), t('From turn 4 on')];
  const on = ctx.side.stats.active || [];
  // the third field shows when the build can have a second action: Action Surge, or Haste cast or switched on
  const extra = (ctx.side.stats.fighter || 0) >= 2 || !!ctx.side.haste || on.includes('haste');
  const cell = (i, f, label) => {
    const value = ctx.side.steps[i][f] || (i === 3 ? STEP_DEFAULT[f] : '');
    const row = value ? stepLabel(ctx, i, f, value) : null;
    return `<div class="field"><span>${label}</span>${slotButton('sim-step-open', `data-i="${i}" data-f="${f}"`, row ? row[1] : '', row ? row[4] : '', i < 3 ? t('as from turn 4 on') : t('— choose —'))}</div>`;
  };
  return `<div class="sim-plan">${names.map((name, i) => `<div class="sim-step${extra ? ' three' : ''}"><b>${name}</b>${cell(i, 'a', t('Action'))}${extra ? cell(i, 'x', t('Action on top (Action Surge, Haste)')) : ''}${cell(i, 'q', t('Bonus action'))}</div>`).join('')}</div>`;
}
const sideName = (side) => (side.b.name || t('Unnamed')) + ' · ' + t((ACTS.find(([k]) => k === side.act) || ['', ''])[1]);
function simManyHtml(ctx) {
  const m = sim.many;
  if (!m) return '';
  const cols = [m.a, m.b].filter(Boolean);
  const range = (x, unit) => `${x.avg.toFixed(1)}${unit} <small>${t('from {min} to {max}', { min: tenth(x.min), max: tenth(x.max) })}</small>`;
  const row = (label, cell) => `<tr><th>${label}</th>${cols.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`;
  return `<table class="sim-many"><thead><tr><th>${t('{n} fights rolled', { n: m.a.count })}</th>${cols.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
    ${row(t('Average damage a turn'), (c) => `<b>${c.perTurn.toFixed(1)}</b>`)}
    ${row(t('First turn'), (c) => c.first.toFixed(1))}
    ${row(ctx.hp ? t('Turns until {who} falls', { who: esc(targetLabel(ctx.target)) }) : t('Damage in 10 turns'), (c) => range(c.main, ''))}
  </tbody></table>`;
}
function renderDamage() {
  const b = curBuild();
  const ctx = simContext();
  const head = `<section class="card hero"><h1>${t('Damage test')}</h1>
    <p class="muted">${t('Rolls the dice of a fight against an enemy: every attack roll, saving throw and damage die, turn after turn, with the spell slots and the other resources running out as they are spent. It uses the build, the gear and the switches below; nothing rolled here is saved.')}</p>
    <div class="stat-tools">
      <div class="field"><span>${t('Build')}</span>${slotButton('sim-build-open', '', b ? b.name || t('Unnamed') : '', '', t('— choose —'))}</div>
      ${ctx ? `<div><span class="lbl">${t('With the gear of')}</span>${actTabs(state.ui.act, 'act')}</div>${targetTools()}` : ''}
    </div>
    ${ctx ? togglesRow(b) : ''}</section>`;
  if (!ctx) return `<div class="content wide sim">${head}<section class="card empty"><h2>${t('Choose a build with at least one level.')}</h2></section></div>`;
  const { side, other, v, target, hp, chosen, expected, can } = ctx;
  const who = targetLabel(target);
  const turns = sim.turns;
  const fight = sim.fight;
  const down = hp && fight.dealt >= hp;
  const left = fight.left;
  const full = simResources(side.stats);
  const res = [
    left.slots.length ? t('Spell slots') + ' ' + left.slots.map((n, i) => `<span class="slot-n${n ? '' : ' out'}" title="${t('Level {n}', { n: i + 1 })}">${i + 1}<i>×${n}</i></span>`).join('') : '',
    left.pactLevel ? esc(t('Pact Magic slots')) + ' <b>' + left.pact + '</b>' : '',
    full.points ? 'Sorcery Points <b>' + left.points + '</b>' : '', full.ki ? 'Ki Points <b>' + left.ki + '</b>' : '',
    full.rage ? 'Rage Charges <b>' + left.rage + '</b>' : '', full.surge ? 'Action Surge <b>' + left.surge + '</b>' : '', full.dice ? 'Superiority Dice <b>' + left.dice + '</b>' : ''].filter(Boolean);
  const work = fight.effects.filter((e) => !e.quiet).map((e) => esc(e.name) + (isFinite(e.until) ? ' <b>' + t('{n} turn(s) left', { n: e.until - fight.turn }) + '</b>' : '') + (e.conc ? ' · ' + t('Concentration') : ''));
  const on = side.stats.active || [];
  const reacts = reactOptions(ctx);
  const rules = [
    on.includes('rage') ? t('Rage (switched on above) is entered with the bonus action, lasts 10 turns and takes a Rage Charge each time; without a charge the build fights without it.') : '',
    on.includes('haste') ? t('Haste (switched on above) is on the build for the first 10 turns, as if someone else cast it; the turn after it ends is lost to Lethargic.') : '',
    side.haste ? t('Haste cast by the build holds its Concentration: another Concentration spell ends it, and leaves the caster Lethargic.') : '',
    side.haste || on.includes('haste') ? t('The action Haste gives is used from the turn Haste is cast. The wiki says "an additional action each turn" and does not single out that first turn, so this is how the planner reads it.') : ''].filter(Boolean);
  const totals = turns.map((x) => x.total);
  const mean = turns.length ? fight.dealt / turns.length : 0;
  const box = (label, value, hint) => `<div class="stat"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const log = turns.slice(-SIM_SHOWN).reverse().map((x) => `<article class="sim-turn"><header><b>${t('Turn {n}', { n: x.n })}</b><span>${esc(x.name)}</span><strong>${tenth(x.total)}</strong></header>
    ${x.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}${x.lines.length ? `<ul>${x.lines.map(simLine).join('')}</ul>` : ''}</article>`).join('');
  return `<div class="content wide sim">${head}
    <section class="card">
      <h2>${t('The turns')}</h2>
      <p class="muted">${t('What the build does with its action and its bonus action in each of the first three turns and in the ones after. A spell that is still at work is not cast again; with no slot left, the turn goes to what the build does at will.')}</p>
      ${simPlanHtml(ctx)}
      ${castTools(side.stats, v.list)}
      ${reacts.length ? `<div class="stat-tools"><div class="field"><span>${t('Reaction')}</span>${slotButton('sim-react-open', '', side.react && reacts.some((r) => r[0] === side.react) ? side.react : '', '', t('— none —'))}</div></div>` : ''}
      <h3 class="group">${t('What the enemy does on its turn')}</h3>
      <div class="stat-tools foe-tools">
        <div class="field ac-field"><span>${t('Melee attacks on the build')}</span>${stepper(side.foe.attacks, 'data-ui="foeAttacks" data-v="0"', 0, 8)}</div>
        <div class="field ac-field"><span>${t('Of which hit')}</span>${stepper(side.foe.hits, 'data-ui="foeHits" data-v="0"', 0, side.foe.attacks)}</div>
        <div class="field ac-field"><span>${t('Damage of each hit')}</span>${stepper(side.foe.damage, 'data-ui="foeDamage" data-v="10"', 1, 99)}</div>
        <div class="field"><span>${t('Movement')}</span><button class="btn tiny${side.foe.moves ? ' gold' : ''}" data-act="foe-moves">${side.foe.moves ? t('It moves every turn') : t('It stays where it is')}</button></div>
      </div>
      <p class="muted">${t('With no attacks and no movement, the enemy only takes damage. Hits on the build can break Concentration and keep Rage going; a miss opens Riposte, a hit opens Hellish Rebuke, Armour of Agathys and Fire Shield; movement sets off Booming Blade.')}</p>
      ${rules.map((x) => `<p class="muted">${x}</p>`).join('')}
      <p class="turn"><b>${expected.toFixed(1)}</b>${t('expected on average from the action of the later turns against {who}', { who: esc(who) })}${chosen ? ': ' + esc(chosen.text + ' · ' + chosen.how) : v.plan ? ': ' + v.plan.parts.map((x) =>
        `${x.chance != null ? Math.round(x.chance * 100) + '%' : x.n} × ${esc(x.row.name)} (${esc(x.how)})`).join(' + ') : ''}</p>
    </section>
    <section class="card">
      <h2>${t('The fight')}</h2>
      ${hp ? `<div class="hpbar${down ? ' down' : ''}"><i style="width:${Math.max(0, 100 - fight.dealt / hp * 100).toFixed(1)}%"></i><span>${esc(who)} · ${t('{left} of {hp} hit points', { left: tenth(Math.max(0, hp - fight.dealt)), hp })}</span></div>` : ''}
      ${down ? `<p class="sim-down">${t('{who} falls in turn {n}.', { who: esc(who), n: turns.length })}</p>` : ''}
      <div class="row-btns sim-btns">
        <button class="btn primary" data-act="sim-roll" data-n="1"${down || !can ? ' disabled' : ''}>${t('Roll a turn')}</button>
        <button class="btn" data-act="sim-roll" data-n="10"${down || !can ? ' disabled' : ''}>${t('Roll 10 turns')}</button>
        ${hp ? `<button class="btn" data-act="sim-roll" data-n="kill"${down || !can ? ' disabled' : ''}>${t('Roll until it falls')}</button>` : ''}
        <button class="btn" data-act="sim-rest" data-k="short" title="${t('Pact Magic slots, Ki Points and Action Surge come back.')}">Short Rest</button>
        <button class="btn" data-act="sim-rest" data-k="long" title="${t('Everything comes back.')}">Long Rest</button>
        <button class="btn" data-act="sim-reset"${turns.length ? '' : ' disabled'}>${t('Start over')}</button>
      </div>
      ${res.length ? `<p class="points sim-res"><b>${t('Left to spend')}</b> ${res.join(' · ')}</p>` : ''}
      ${work.length ? `<p class="points sim-res"><b>${t('At work')}</b> ${work.join(' · ')}</p>` : ''}
      ${turns.length ? `<div class="stat-row">${box(t('Turns'), turns.length)}${box(t('Total damage'), tenth(fight.dealt))}${box(t('Average a turn'), mean.toFixed(1))}
        ${box(t('Best turn'), tenth(Math.max(...totals)))}${box(t('Worst turn'), tenth(Math.min(...totals)))}</div>
        <div class="sim-log">${log}</div>${turns.length > SIM_SHOWN ? `<p class="muted">${t('The last {n} turns are shown.', { n: SIM_SHOWN })}</p>` : ''}`
    : `<p class="muted">${t('Nothing rolled yet. A change in the build, the enemy or the plan starts the fight over.')}</p>`}
      <p class="muted">${t('Resistance halves and vulnerability doubles each roll as it is, without rounding, so the rolled average meets the expected one.')}</p>
    </section>
    <section class="card">
      <h2>${t('Many fights, side by side')}</h2>
      <p class="muted">${t('Rolls {n} fights with the plan above, each from a Long Rest, and sets them next to another build or to the same build with the gear of another act. The other side follows its own plan and switches: to change them, put it on screen with "Swap sides".', { n: SIM_FIGHTS })}</p>
      <div class="stat-tools">
        <div class="field"><span>${t('Compare with')}</span>${slotButton('sim-b-open', '', other ? other.b.name || t('Unnamed') : '', '', t('— nothing —'))}</div>
        ${other ? `<div><span class="lbl">${t('With the gear of')}</span>${actTabs(other.act, 'sim-b-act')}</div>` : ''}
      </div>
      <div class="row-btns sim-btns">
        <button class="btn primary" data-act="sim-fights"${can ? '' : ' disabled'}>${t('Roll {n} fights', { n: SIM_FIGHTS })}</button>
        ${other ? `<button class="btn" data-act="sim-swap">${t('Swap sides')}</button>` : ''}
      </div>
      ${simManyHtml(ctx)}
    </section>
  </div>`;
}

Object.assign(actions, {
  'sim-roll'(el) {
    const ctx = simContext();
    if (!ctx) return;
    if (el.dataset.n === 'kill') simRun(ctx, 200, true); else simRun(ctx, Number(el.dataset.n) || 1);
  },
  'sim-fights'() {
    const ctx = simContext();
    if (!ctx) return;
    sim.many = { a: Object.assign(simFights(ctx.side, ctx.hp, SIM_FIGHTS), { name: sideName(ctx.side) }),
      b: ctx.other ? Object.assign(simFights(ctx.other, ctx.hp, SIM_FIGHTS), { name: sideName(ctx.other) }) : null };
  },
  'sim-rest'(el) {
    const ctx = simContext();
    if (!ctx) return;
    const full = simResources(ctx.side.stats);
    if (el.dataset.k === 'long') sim.fight.left = full;
    else Object.assign(sim.fight.left, { pact: full.pact, ki: full.ki, surge: full.surge, dice: full.dice });
    if (el.dataset.k === 'long') sim.fight.used = [];
  },
  'sim-reset'() { sim.key = ''; },
  'foe-moves'() { state.ui.foeMoves = !state.ui.foeMoves; },
  'sim-react-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = reactOptions(ctx);
    openChooser(t('Reaction'), t('One reaction a round, on the enemy\'s turn, when what it answers happens.'), [{ label: t('Reaction'), n: 1, min: 0, options: rows.map((r) => r.slice(1)), chosen: rows.filter((r) => r[0] === ctx.side.react).map((r) => r[1]) }],
      (done) => { const row = rows.find((r) => r[1] === done[0].chosen[0]); (state.ui.simReacts || (state.ui.simReacts = {}))[ctx.b.id] = row ? row[0] : ''; });
    return false;
  },
  'sim-build-open'() { simBuildChooser(t('Build'), curBuild(), (id) => { if (id) { state.ui.buildId = id; state.ui.wizard = ''; } }); return false; },
  'sim-b-open'() {
    const sb = state.ui.simB;
    simBuildChooser(t('Compare with'), sb ? buildById(sb.id) : null, (id) => { state.ui.simB = id ? { id, act: (sb && sb.act) || (id === state.ui.buildId ? ACTS.map(([k]) => k).find((k) => k !== state.ui.act) : state.ui.act) } : null; });
    return false;
  },
  'sim-b-act'(el) { if (state.ui.simB) state.ui.simB.act = el.dataset.k; },
  'sim-swap'() {
    const sb = state.ui.simB;
    if (!sb || !buildById(sb.id)) return;
    const mine = { id: state.ui.buildId, act: state.ui.act };
    Object.assign(state.ui, { buildId: sb.id, act: sb.act || state.ui.act, simB: mine, wizard: '' });
  },
  'sim-step-open'(el) {
    const ctx = simContext();
    if (!ctx) return false;
    const i = Number(el.dataset.i);
    const f = el.dataset.f;
    const rows = stepOptions(ctx, i, f);
    const cur = ctx.side.steps[i][f] || (i === 3 ? STEP_DEFAULT[f] : '');
    const title = [t('Turn {n}', { n: 1 }), t('Turn {n}', { n: 2 }), t('Turn {n}', { n: 3 }), t('From turn 4 on')][i] + ' · ' + (f === 'a' ? t('Action') : f === 'x' ? t('Action on top (Action Surge, Haste)') : t('Bonus action'));
    openChooser(title, f === 'a' ? t('What the action of the turn goes to.') : f === 'x' ? t('What a second action goes to, on the turns the build has one: Action Surge once a Short Rest, and Haste while it lasts.')
      : t('What the bonus action of the turn goes to. A spell that sets something up is cast before the attacks.'),
      [{ label: title, n: 1, min: 0, options: rows.map((r) => r.slice(1)), chosen: rows.filter((r) => r[0] === cur).map((r) => r[1]) }],
      (done) => {
        const row = rows.find((r) => r[1] === done[0].chosen[0]);
        const plans = state.ui.simPlans || (state.ui.simPlans = {});
        const steps = simSteps(ctx.b);
        steps[i][f] = row ? row[0] : '';
        plans[ctx.b.id] = steps;
      });
    return false;
  },
});
// The list of builds that have at least one level, to choose one from; two of the same name are told apart by
// their place in the list.
function simBuildChooser(title, cur, done) {
  const list = state.builds.filter((x) => charLevel(x));
  const rows = list.map((x, i) => { const name = x.name || t('Unnamed'); const same = list.slice(0, i).filter((y) => (y.name || t('Unnamed')) === name).length; return [name + (same ? ' (' + (same + 1) + ')' : ''), splitText(x), '', '', '']; });
  openChooser(title, t('The builds of My builds that have at least one level.'), [{ label: title, n: 1, min: 0, options: rows, chosen: cur && list.includes(cur) ? [rows[list.indexOf(cur)][0]] : [] }],
    (res) => { const i = rows.findIndex((r) => r[0] === res[0].chosen[0]); done(i >= 0 ? list[i].id : ''); });
}
