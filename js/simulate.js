// Damage test, the engine: the dice of a fight, rolled. What damage.js works out on average is rolled here, die by
// die: every attack roll, saving throw and damage die, round after round, in Initiative order. A side is a build
// with its plan of turns (an action, an action on top and a bonus action for each of the first three turns and for
// the ones after), what it does on a hit, its reaction and what it heals with; a fight sets one build or a whole
// party against one enemy or several, spends the spell slots and the other things that run out, counts how long
// Haste, Rage, Concentration and the conditions last, and lets the enemies act and answer. The page is in
// simpage.js. Nothing rolled here is saved.
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
// `x` is what the moment adds: adv and dis (Advantage and Disadvantage, which cancel each other), dice and attack
// on the attack roll, crit (a hit is a critical hit), damage (flat), turnDice (the dice that come once a turn may
// ride on this attack), double (the damage counts twice), and onHit(line), called once the hit is known, which
// returns more dice as [dice, type, label].
function rollWeapon(stats, row, target, riders, x) {
  x = x || {};
  const d20 = rollD20((stats.advantage || x.adv ? 1 : 0) - (x.dis ? 1 : 0));
  const bonus = row.attackTotal + (x.attack || 0) + [...(row.attackDice || []), ...(x.dice || [])].reduce((a, d) => a + rollDice(d).sum, 0);
  const natural = d20 >= stats.crit;
  const hit = d20 !== 1 && (natural || d20 + bonus >= target.ac);
  const crit = hit && (natural || !!x.crit);
  const line = { name: row.name, kind: 'attack', weapon: true, d20, bonus, against: target.ac, hit, crit, damage: 0, text: '' };
  if (!hit) return line;
  const magical = rowMagical(stats, row) || !!x.magical;
  const bits = [];
  let raw = 0;
  const more = (x.onHit && x.onHit(line)) || [];
  const own = (row.extraDice || []).filter((d) => d[3] !== 'turn' || x.turnDice);
  if (own.some((d) => d[3] === 'turn')) line.turnDice = true;
  const extra = (riders || []).map((r) => [r.dice, /weapon/i.test(r.type) ? '' : r.type, r.name, true]);
  [[row.dice, row.type, ''], ...own.map((d) => [d[0], d[1], d[3] === 'turn' ? d[2] : '']), ...extra, ...more.map((d) => [d[0], d[1], d[2], true])].forEach(([dice, type, from, spell]) => {
    if (!dice) return;
    const r = rollDice(dice, crit);
    raw += r.sum;
    line.damage += r.sum * typeFactor(target, type || row.type, spell ? true : magical);
    bits.push(diceBit(dice, r, from || (type && type !== row.type ? type : '')));
  });
  const flat = row.damageTotal + (x.damage || 0);
  if (flat) { raw += flat; line.damage += flat * typeFactor(target, row.type, magical); bits.push(String(flat)); }
  if (x.double) { raw *= 2; line.damage *= 2; bits.push('(× 2)'); }
  line.text = damageBits(bits, raw, line.damage) + ' ' + row.type;
  return line;
}
// The saving throw of an enemy against a cast: { d20, passed }. `m.saveFx(key)` says what its conditions do to it:
// fail (it fails by itself), dis (Disadvantage).
// `kind` says what the save is against: 'spell', 'hold' (a spell that incapacitates), 'stun' (a strike that does)
// or nothing; it decides whether Magic Resistance (adv) and a Legendary Resistance (resist: 10 more on a failed
// save that it turns into a passed one) come in.
function throwSave(save, m, kind) {
  const fx = (m && m.saveFx && m.saveFx(save.key, kind)) || {};
  if (fx.fail) return { d20: 0, passed: false, auto: true };
  const d20 = rollD20((save.adv || fx.adv ? 1 : 0) - (save.dis || fx.dis ? 1 : 0));
  const passed = d20 + save.bonus >= save.dc;
  const legend = !passed && d20 + save.bonus + 10 >= save.dc && !!fx.resist && fx.resist(d20);
  return { d20, passed: passed || legend, legend };
}
// One part of a spell's damage against a saving throw already rolled.
function saveLine(name, save, part, thrown) {
  const dice = rollDice(part.dice);
  const raw = dice.sum + part.flat;
  // (`ev`: the enemy has Evasion and this is a Dexterity save that halves: nothing when passed, half when failed)
  const dealt = raw * part.f * (thrown.passed ? (part.ev ? 0 : part.kept) : part.ev ? 0.5 : 1);
  return { name, kind: 'save', ab: save.key.toUpperCase(), d20: thrown.d20, auto: !!thrown.auto, legend: !!thrown.legend, bonus: save.bonus, against: save.dc, passed: thrown.passed, kept: part.ev ? 0 : part.kept, damage: dealt,
    text: damageBits([dice.rolls.length ? diceBit(part.dice, dice) : '', part.flat ? String(part.flat) : ''], raw, dealt) + ' ' + part.type };
}
// One cast of a spell, from the recipe spellDamage leaves: each part by attack roll, by the enemy's saving throw
// (one for each enemy, for all the parts) or with no roll. `m` is what the moment adds, as for a weapon attack.
function rollSpell(stats, x, target, riders, m) {
  m = m || {};
  const r = x.recipe;
  const lines = [];
  // Arcane Acuity: that much more on the spell attack roll and on the save DC of the spell
  const up = m.spell || 0;
  const save = r.save && up ? Object.assign({}, r.save, { dc: r.save.dc + up }) : r.save;
  if (r.weapon) {
    const line = rollWeapon(stats, r.weapon, target, riders, m);
    line.name = x.name;
    lines.push(line);
    if (line.hit && save && r.parts.length) { const thrown = throwSave(save, m, 'spell'); r.parts.forEach((part) => lines.push(saveLine(x.name, save, part, thrown))); }
    return lines;
  }
  for (let rep = 0; rep < r.repeat; rep++) {
    const saves = [];
    r.parts.forEach((part) => {
      for (let k = 0; k < part.times; k++) {
        if (part.mode === 'save') { saves[k] = saves[k] || throwSave(save, m, 'spell'); lines.push(saveLine(x.name, save, part, saves[k])); continue; }
        const d20 = part.mode === 'attack' ? rollD20((r.adv || m.adv ? 1 : 0) - (m.dis ? 1 : 0)) : 0;
        const bonus = r.attack + (part.mode === 'attack' ? up + (m.dice || []).reduce((a, d) => a + rollDice(d).sum, 0) : 0);
        const natural = part.mode === 'attack' && d20 >= r.crit;
        const hit = part.mode !== 'attack' || (d20 !== 1 && (natural || d20 + bonus >= r.ac));
        const crit = part.mode === 'attack' && hit && (natural || !!m.crit);
        const line = { name: x.name, kind: part.mode, d20, bonus, against: r.ac, hit, crit, damage: 0, text: '' };
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

// ---------- conditions ----------
// What the test plays of a condition comes from its page on the wiki (conditions.js): no actions, no reactions,
// Advantage for whoever attacks it, critical hits from up close, Disadvantage on its own attack rolls, saving
// throws it fails or rolls with Disadvantage, Concentration ended. A holder is a build's fight or an enemy.
const CONDITIONS = window.BG3_CONDITIONS || {};
const condFx = (name) => (CONDITIONS[name] || {}).f || null;
const condHas = (holder, flag) => holder.conds.some((c) => c.f[flag]);
// Puts a condition on a holder for a number of turns. `by` is whoever caused it: some conditions count down on
// that one's turn. `save` ({ key, dc }) is the saving throw repeated to shake it off.
function addCond(holder, name, turns, by, save) {
  const f = condFx(name);
  if (!f) return null;
  holder.conds = holder.conds.filter((c) => c.name !== name);
  const c = { name, f, left: Math.max(1, Number(turns) || 2), by, save: save || null };
  holder.conds.push(c);
  return c;
}
// The start of a holder's turn: the conditions that count down then do; a Prone creature stands up.
function condStart(holder, note) {
  holder.conds = holder.conds.filter((c) => {
    if (c.name === 'Prone') { note(t('{name} ends.', { name: c.name })); return false; }
    if (c.f.tk !== 'start' || c.f.src) return true;
    if (--c.left > 0) return true;
    note(t('{name} ends.', { name: c.name }));
    return false;
  });
}
// The end of a creature's turn: its own conditions count down and the save to shake one off is rolled; the ones
// it caused on others, and that count down on its turn, do so too. `saveOf(key)` gives the holder's bonus.
function condEnd(holder, saveOf, note, others) {
  holder.conds = holder.conds.filter((c) => {
    if (c.save && (c.f.rep || c.rep)) {
      const d20 = rollD20(0);
      if (d20 + saveOf(c.save.key) >= c.save.dc) { note(t('{name} shaken off: {ab} save {roll} against DC {dc}.', { name: c.name, ab: c.save.key.toUpperCase(), roll: d20 + saveOf(c.save.key), dc: c.save.dc })); return false; }
    }
    if (c.f.tk === 'start' || c.f.src) return true;
    if (--c.left > 0) return true;
    note(t('{name} ends.', { name: c.name }));
    return false;
  });
  (others || []).forEach((o) => { o.conds = o.conds.filter((c) => !(c.f.src && c.f.tk !== 'start' && c.by === holder && --c.left <= 0)); });
}
// The start of a creature's turn: the conditions it caused on others that count down then (Distracted) do.
function condSource(holder, others) {
  others.forEach((o) => { o.conds = o.conds.filter((c) => !(c.f.src && c.f.tk === 'start' && c.by === holder && --c.left <= 0)); });
}
// What a manoeuvre or a strike leaves on a hit, from its page on the wiki: [condition, turns, saving throw]. The
// save is against the weapon action DC: 8 + proficiency bonus + Strength or Dexterity modifier.
// Distracting Strike asks no save: the allies of whoever landed it have Advantage on their next attack roll.
const HIT_CONDITIONS = { 'Trip Attack': ['Prone', 1, 'str'], 'Menacing Attack': ['Frightened', 2, 'wis'], 'Goading Attack': ['Goaded', 1, 'wis'], 'Distracting Strike': ['Distracted', 1, ''],
  'Stunning Strike': ['Stunned', 1, 'con'] };
// The manoeuvres that add the Superiority Die to the damage of a hit (their pages give "damage: weapon +
// superiority die"), the one that adds it to the attack roll, and the one that takes the bonus action as well.
const HIT_MANOEUVRES = ['Trip Attack', 'Menacing Attack', 'Disarming Attack', 'Pushing Attack', 'Goading Attack', 'Manoeuvring Attack', 'Distracting Strike'];

// ---------- consumables ----------
// What an arrow does, read from its text: { extra: dice on a hit the enemy can save against, plus: dice on top of
// the weapon's, double: the kind of creature it does double damage to, many: half the damage to three others,
// blast: an explosion in place of the weapon damage }. null when it does nothing the test can roll.
function arrowFx(c) {
  const x = c.x || '';
  const save = /(\w+) Saving Throw:? (?:\(DC|DC) (\d+)\)?/i.exec(x);
  const key = save ? save[1].toLowerCase().slice(0, 3) : '';
  const blast = /Explodes and deals (\d+d\d+) (\w+) \+ (\d+d\d+) (\w+) damage/i.exec(x);
  if (blast && save) return { blast: [[blast[1], blast[2]], [blast[3], blast[4]]], save: { key, dc: Number(save[2]) }, kept: /to halve/i.test(x) ? 0.5 : 0 };
  const extra = /additional (\d+d\d+) (\w+) damage/i.exec(x);
  if (extra && save) return { extra: [extra[1], extra[2]], save: { key, dc: Number(save[2]) }, kept: /to halve/i.test(x) ? 0.5 : 0 };
  const plus = /Weapon Damage \+ (\d+d\d+) (\w+)/i.exec(x);
  if (plus) return { plus: [plus[1], plus[2]] };
  const twice = /Damage is doubled against (\w+?)s?\./i.exec(x);
  if (twice) return { double: twice[1].replace(/ie$/, 'y').replace(/Monstrosit$/, 'Monstrosity') };
  if (/additional half of that damage to three other targets/i.test(x)) return { many: 3 };
  return null;
}
// What a coated weapon does, read from the text of the coating's condition: a bonus to attack and damage rolls,
// the saving throw a target hit makes, the conditions it gets when it fails, damage that comes at the end of its
// next turn, dice on top of the hit. null when it does nothing the test can roll.
function coatFx(c) {
  const x = (c.cx || '') + ' ' + (c.x || '');
  const out = {};
  const hit = /\+(\d) bonus to (Damage and )?Attack Rolls/i.exec(x);
  if (hit) { out.attack = Number(hit[1]); if (hit[2]) out.damage = Number(hit[1]); out.magical = /become magical/i.test(x); }
  const save = /(\w+) Saving Throw \(DC (\d+)\)|(\w+) Saving Throw: DC (\d+)/i.exec(x);
  if (save) out.save = { key: (save[1] || save[3]).toLowerCase().slice(0, 3), dc: Number(save[2] || save[4]) };
  const conds = (c.cs || []).filter((n) => condFx(n));
  if (conds.length) out.conds = conds;
  // how long they last: so many turns, or (-1) until the save is passed, rolled again at the end of each turn
  if (conds.length) { out.turns = c.ct > 0 ? c.ct : 2; out.until = c.ct < 0; }
  const later = /take (\d+d\d+) (\w+) damage at the end of their next turn/i.exec(x);
  if (later) out.later = [later[1], later[2]];
  const extra = /additional (\d+d\d+) (\w+) damage/i.exec(x);
  if (extra) { out.extra = [extra[1], extra[2]]; out.kept = /to halve/i.test(x) ? 0.5 : 0; }
  return Object.keys(out).length ? out : null;
}
// What the elixir kept active gives a fight besides numbers: temporary hit points, one more spell slot, an Armour
// Class to start from, the action a kill gives (Bloodlust).
function elixirFx(stats) {
  const c = stats.build && CONSUMABLE_BY_NAME.get(norm(stats.build.elixir));
  const x = c ? c.x : '';
  const blood = /when you kill a foe[^.]*additional Action/i.test(x);
  const temp = Number((/(\d+) temporary hit points/i.exec(x) || [])[1]) || 0;
  return { name: c ? c.n : '', blood: blood ? temp || 5 : 0, temp: blood ? 0 : temp, slot: Number((/Level (\d) Spell Slot/i.exec(x) || [])[1]) || 0,
    ac: Number((/Armour Class to (\d+)/i.exec(x) || [])[1]) || 0 };
}

// Arcane Acuity (+1 to spell attack rolls and to the spell save DC for each turn of it left, 10 at most; a turn
// goes at the start of each turn and two with every hit taken): what keeps it up (the Elixir of Battlemage's Power:
// never below 3) and what adds turns to it, read from the gear: damage with a weapon attack, Fire or Thunder damage,
// a hit with a spell that uses a weapon. Two turns each time: the text of some items leaves the number out, and
// the pages of their passives give it (Thunderous Acuity "applies 2 turns", Battlemage's Power lasts 2).
function acuityOf(stats) {
  const c = stats.build && CONSUMABLE_BY_NAME.get(norm(stats.build.elixir));
  const out = { floor: Number((/(\d) stacks of Arcane Acuity/i.exec(c ? c.x : '') || [])[1]) || 0, weapon: 0, fire: 0, thunder: 0, smite: 0 };
  Object.values(stats.worn || {}).forEach((it) => effectTexts(it).forEach((text) => {
    if (!/Arcane Acuity/.test(text)) return;
    const turns = Number((/Arcane Acuity for (\d) turns/i.exec(text) || [])[1]) || 2;
    const kind = /damage with a weapon attack/i.test(text) ? 'weapon' : /deals? Fire damage/i.test(text) ? 'fire' : /deals? Thunder damage/i.test(text) ? 'thunder'
      : /hit a target with a spell or cantrip that uses a weapon/i.test(text) ? 'smite' : '';
    if (kind) out[kind] = Math.max(out[kind], turns);
  }));
  return out;
}

// ---------- a side of the test ----------
// What a build starts a fight with, of the things that run out.
function simResources(stats) {
  const res = Object.fromEntries((stats.resources || []).map(([n, v]) => [n, Number(v) || 0]));
  const slots = (stats.slots || []).slice();
  // an Elixir of Arcane Cultivation is one more spell slot
  const more = elixirFx(stats).slot;
  if (more) { while (slots.length < more) slots.push(0); slots[more - 1]++; }
  return { slots, pact: stats.pact ? stats.pact.n : 0, pactLevel: stats.pact ? stats.pact.level : 0,
    points: res['Sorcery Points'] || 0, ki: res['Ki Points'] || 0, rage: res['Rage Charges'] || 0, surge: (stats.fighter || 0) >= 2 ? 1 : 0,
    wind: (stats.gains || []).includes('Second Wind') ? 1 : 0, potions: 0, arrows: 0,
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
// Any slot at all, for Divine Smite: the lowest left or the highest. Its level, or 0 when none is left.
function takeAnySlot(left, low) {
  const levels = left.slots.map((n, i) => (n > 0 ? i + 1 : 0)).filter(Boolean).concat(left.pact > 0 ? [left.pactLevel] : []);
  if (!levels.length) return 0;
  const lv = low ? Math.min(...levels) : Math.max(...levels);
  if (left.slots[lv - 1] > 0) left.slots[lv - 1]--; else left.pact--;
  return lv;
}
// The plan of turns of a build: four steps (turns 1, 2, 3 and every turn after), each with what the action, the
// action on top and the bonus action go to. An empty field of the first three follows the last; the last
// defaults to the weapon and to the best bonus action the build has.
const simSteps = (b) => { const saved = (state.ui.simPlans || {})[b.id] || []; return [0, 1, 2, 3].map((i) => ({ a: (saved[i] || {}).a || '', q: (saved[i] || {}).q || '', x: (saved[i] || {}).x || '' })); };
const PHYSICAL = ['Bludgeoning', 'Piercing', 'Slashing'];
// The enemy's actions in the difficulty chosen: the ones of Balanced mode, the ones Tactician adds, the ones of
// Honour mode. A "tactician" version of an action takes the place of the plain one.
function modeActs(e, list) {
  const mode = gameMode();
  const there = (a) => !a.md || (a.md === 't' && mode !== 'balanced') || (a.md === 'h' && mode === 'honour');
  // (with the ability scores its page gives for Tactician, the numbers of its actions are other: "at")
  const all = (list || (e && ((mode !== 'balanced' && e.at) || e.acts)) || []).filter(there);
  const plain = (n) => n.replace(/,\s*tactician\)/i, ')').replace(/\s*\(tactician\)/i, '');
  const harder = all.filter((a) => plain(a.n) !== a.n);
  return all.filter((a) => !harder.includes(a)).map((a) => harder.find((h) => plain(h.n) === a.n) || a).concat(harder.filter((h) => !all.some((a) => a.n === plain(h.n))));
}
// The highest spell slot an enemy has (6 when its page does not say).
const topSlot = (e) => (e && e.rs ? Math.max(...Object.keys(e.rs).map(Number)) : 6);
// What an enemy does with one of the actions of its page (enemies.js), as the fight uses it: with the +2 to
// attack rolls and save DCs of Tactician and Honour mode, one more attack for each Extra Attack it has in the
// mode, and, for a spell the planner knows, the damage it deals at the enemy's level (a cantrip) or with the
// slot it is cast with.
function foeMove(act, e, slotWanted) {
  const idx = Math.max(0, MODES.findIndex(([k]) => k === gameMode()));
  const up = idx > 0 && (act.k === 'a' || act.k === 's') ? 2 : 0;
  let hits = act.hits;
  let slot = act.sl || 0;
  const s = act.s && act.k !== 'e' ? SPELL_BY_NAME.get(norm(act.s)) : null;
  if (s) {
    if (slot && s.lv) slot = Math.max(s.lv, Math.min(Number(slotWanted) || 0, topSlot(e)));
    const h = spellHits(s, e ? e.lv : 1, slot || s.lv);
    if (h && !h.rider && !h.weapon && h.parts.length) {
      const comps = h.parts.map((p) => [p.dice, p.flat, p.type]);
      const alike = comps.every((c) => c.join() === comps[0].join());
      hits = act.k === 'a' && h.beams > 1 ? Array.from({ length: h.beams }, () => comps) : act.k === 'a' && comps.length > 1 && alike ? comps.map((c) => [c]) : [comps];
    }
  }
  if (act.x) hits = Array.from({ length: 1 + (((e && e.ea) || [])[idx] || 0) }, () => act.hits[0]);
  // the condition it leaves is kept when it is one the test plays, with the +2 of the mode on a save DC of its own
  const cd = act.cd && condFx(act.cd[0]) ? { name: act.cd[0], turns: act.cd[1] || 2, sv: act.cd[2] || '', dc: act.cd[3] ? act.cd[3] + (idx > 0 ? 2 : 0) : 0 } : null;
  return { label: act.n, kind: act.k, melee: !!act.m, bonus: (act.b || 0) + (act.k === 'a' ? up : 0), dc: (act.dc || 0) + (act.k === 's' ? up : 0), sv: act.sv || '', os: act.os == null ? 0 : act.os, hits,
    slot, spell: s ? s.lv : -1, uses: act.u || 0, parts: act.w || [], up, guess: act.g || '', waits: !!act.c, cd, om: act.om || 0, legend: !!act.lg, as: act.as || '', tr: act.tr || '',
    // gone once so much damage is dealt to it · an answer after so many hits · only while its temporary hit points last · to each piece of armour lost
    ud: act.ud || 0, after: act.af || 0, temp: !!act.wt, piece: !!act.ev,
    // it catches everyone in an area; its damage is a range of its page read as dice
    area: !!act.ar || !!(s && (s.ao || s.ar)), gr: act.gr || '' };
}
// What an enemy answers a hit with, once a round, in the difficulty chosen: its reactions and, in Honour mode, its
// Legendary Actions.
const foeAnswers = (e) => modeActs(e, (e && ((gameMode() !== 'balanced' && e.rt) || e.rx)) || []).map((a) => foeMove(a, e));
// The enemy's side of the fight: the action chosen on the page (its usual one when none is), how often it does it
// each turn, what it goes on with when the action needs a spell slot or runs out, what its bonus action goes to,
// and what it answers a hit with. With no reference enemy, or one whose page lists nothing to go by, a melee
// attack set by hand. `fixed` leaves the choices of the page aside: true for what it usually does, or
// { foeAct } for a helper whose action was chosen.
function simFoe(target, fixed) {
  const e = target && target.enemy;
  const acts = modeActs(e);
  const mains = acts.filter((a) => !a.q);
  const usual = mains.find((a) => a.k !== 'e') || null;
  const ui = fixed ? (fixed === true ? {} : fixed) : state.ui;
  const num = (key, by) => (ui[key] == null || ui[key] === '' ? by : Number(ui[key]) || 0);
  const pick = ui.foeAct || '';
  const act = pick === 'none' ? null : mains.find((a) => a.n === pick) || usual;
  const move = act ? foeMove(act, e, ui.foeSlot) : { label: '', kind: 'a', melee: true, bonus: 5, dc: 0, sv: '', os: 0, hits: null, slot: 0, spell: -1, uses: 0, parts: [], up: 0, guess: '', waits: false, cd: null, om: 0 };
  const own = act && usual && usual !== act && (move.slot || move.uses || move.kind === 'e') && !(usual.sl || usual.u || usual.c) ? foeMove(usual, e) : null;
  const set = num('foeBonus', move.kind === 'a' ? move.bonus : move.dc);
  const seconds = acts.filter((a) => a.q);
  const second = seconds.find((a) => a.n === ui.foeAct2);
  // with nothing chosen it plays the strongest thing it can each turn: its actions by what they deal when all of it
  // lands, the ones that take a spell slot or have few uses while they last; not those its page ties to a condition
  const worth = (m) => (m.hits || []).reduce((a, h) => a + h.reduce((x, [d, n]) => x + avgDice(d) + n, 0), 0);
  const ranked = (list) => list.filter((a) => a.k !== 'e' && !a.c).map((a) => foeMove(a, e)).sort((x, y) => worth(y) - worth(x));
  const smart = !pick && ranked(mains).length ? ranked(mains) : null;
  const mend = seconds.concat(mains).filter((a) => a.k === 'e' && a.q).map((a) => foeMove(a, e))[0] || null;
  return Object.assign(move, { smart, smartBonus: smart && !ui.foeAct2 && seconds.length ? { hits: ranked(seconds), heal: mend, worth: mend ? worth(mend) : 0 } : null, name: e ? e.n : '', none: pick === 'none', attacks: pick === 'none' ? 0 : Math.max(0, num('foeAttacks', act ? move.hits.length : 0)),
    bonus: move.kind === 'a' ? set : 0, dc: move.kind === 's' ? set : 0, damage: Math.max(1, num('foeDamage', 10)), steps: Math.max(0, num('foeSteps', 0)), broken: !!ui.foeBroken,
    slots: e && e.rs ? e.rs : null, fallback: own, extra: second ? foeMove(second, e) : null, rx: state.ui.foeReacts === false ? [] : foeAnswers(e) });
}
// How much of a hit's damage the build takes: half with a resistance of its own, with one that Rage gives
// (Bludgeoning, Piercing and Slashing; all but Psychic for a Bear Heart), or under Blade Ward.
function takes(side, type, raging, warded) {
  const physical = !type || PHYSICAL.includes(type);
  const has = (set, rage) => set.has(type) || (set.has('All damage') && !(rage && type === 'Psychic')) || (set.has('Physical damage') && physical);
  return has(side.resist.always, false) || (raging && has(side.resist.raging, true)) || (warded && physical) ? 0.5 : 1;
}
// What the enemy's action does to the build in a turn, on average.
function foeAverage(side, move, times) {
  let sum = 0;
  for (let k = 0; k < times && move.kind !== 'e'; k++) {
    const comps = move.hits ? move.hits[Math.min(k, move.hits.length - 1)] : [['', move.damage, '']];
    const dice = comps.reduce((a, [d, , type]) => a + avgDice(d) * takes(side, type, false), 0);
    const flat = comps.reduce((a, [, n, type]) => a + n * takes(side, type, false), 0);
    if (move.kind === 'a') { const p = hitChance(move.bonus, side.ac, 20, false); sum += p.hit * (dice + flat) + p.crit * dice + (1 - p.hit) * (move.om || 0) * (dice + flat); }
    else if (move.kind === 's') {
      const one = Math.max(0, Math.min(1, (move.dc - 1 - (side.saves[move.sv] || 0)) / 20));
      const fail = side.saveAdv.has(move.sv) ? one * one : one;
      const evades = side.evasion && move.sv === 'dex' && move.os === 0.5;
      sum += (dice + flat) * (fail * (evades ? 0.5 : 1) + (1 - fail) * (evades ? 0 : move.os));
    } else sum += dice + flat;
  }
  return sum;
}
// What the build can heal with, using its bonus action: Second Wind, a healing spell cast that way, a potion.
function healOptions(stats) {
  const out = [];
  const wind = /(\d+d\d+) \+ Fighter Level/i.exec(featureText('Second Wind'));
  if (wind && (stats.gains || []).includes('Second Wind')) out.push({ value: 'wind', kind: 'wind', name: 'Second Wind', dice: wind[1], flat: stats.fighter || 0, text: featureText('Second Wind'), pic: '', facts: wind[1] + ' + ' + (stats.fighter || 0) + ' · Short Rest' });
  if (stats.build) spellbook(stats.build, stats.act, stats).forEach((g) => g.spells.forEach((x) => {
    const m = x.sp && x.sp.a === 'bonus' && /^(\d+d\d+)(?: \+ [\w ]+? mod)? Healing/i.exec(x.sp.dm || '');
    if (!m || out.some((o) => o.name === x.sp.n)) return;
    const flat = /mod/i.test(x.sp.dm) && g.ability ? stats.mods[g.ability] : 0;
    out.push({ value: 'spell:' + x.sp.n, kind: 'spell', name: x.sp.n, dice: m[1], flat, slot: x.sp.lv, cls: g.cls || '', text: x.sp.d || '', pic: pic(x.sp.i, 'pic small'), facts: m[1] + (flat ? ' + ' + flat : '') + ' · ' + t('level {n} slot', { n: x.sp.lv }) });
  }));
  CONSUMABLES.filter((c) => c.t === 'Potion' && /bonus/i.test(c.uc || '')).forEach((c) => {
    const m = /Restore (\d+d\d+)\s*\+\s*(\d+) Healing/i.exec(c.x || '');
    if (m) out.push({ value: 'potion:' + c.n, kind: 'potion', name: c.n, dice: m[1], flat: Number(m[2]), text: c.x, pic: pic(c.i, 'pic small'), facts: m[1] + ' + ' + m[2] });
  });
  return out;
}
// A spell among the ones a build can cast, with the group that casts it (Haste, Shield).
function knownSpell(stats, name) {
  let out = null;
  if (stats.build) spellbook(stats.build, stats.act, stats).forEach((g) => g.spells.forEach((x) => { if (!out && x.sp && x.sp.n === name) out = { name, sp: x.sp, slot: x.sp.lv, cls: g.cls || '', title: g.title, ability: g.ability }; }));
  return out;
}
// The spells of a build that deal no damage but leave on an enemy a condition the test plays (Hold Person,
// Blindness, Tasha's Hideous Laughter), with the save DC of the group that casts them.
function controlSpells(stats) {
  const out = [];
  if (!stats.build) return out;
  spellbook(stats.build, stats.act, stats).forEach((g) => g.spells.forEach((x) => {
    const s = x.sp;
    if (!s || !s.lv || out.some((o) => o.name === s.n) || s.a === 'reaction' || !s.sv || !(s.cn || []).some((c) => condFx(c[0])) || spellLines(s).some((v) => spellHits(s, 12, 6, v[1]))) return;
    const cast = stats.casting.find((c) => c.label === g.title);
    out.push({ name: s.n, sp: s, slot: s.lv, cls: g.cls || '', key: String(s.sv).toLowerCase().slice(0, 3), dc: cast ? cast.dc : 8 + stats.pb + (g.ability ? stats.mods[g.ability] : 0) });
  }));
  return out;
}
// A side: the numbers of a build with the gear of an act, the enemy and the plan. `calm()` gives the numbers
// without Rage, for the turns the build is not raging.
function sideOf(stats, style, target, steps) {
  const con = (stats.saves || []).find((k) => k.key === 'con');
  const gains = stats.gains || [];
  const brew = elixirFx(stats);
  const side = { stats, style, target, steps, memo: new Map(), calm: () => stats, react: '', name: '',
    foe: { name: '', label: '', kind: 'a', melee: true, attacks: 0, bonus: 0, dc: 0, sv: '', os: 0, hits: null, damage: 10, steps: 0, broken: false, slot: 0, uses: 0, slots: null, fallback: null, parts: [] },
    // the build's saving throws, its resistances (always, and while raging), Uncanny Dodge, what it heals with
    saves: Object.fromEntries((stats.saves || []).map((k) => [k.key, k.bonus])), resist: { always: new Set(), raging: new Set(['Physical damage']) },
    dodge: gains.includes('Uncanny Dodge'), heal: null, potions: 2,
    // Evasion, and the saving throws the build rolls with Advantage
    evasion: gains.includes('Evasion'), saveAdv: new Set(),
    // the build's Armour Class and hit points with the gear of the act (an Elixir of Barkskin sets the Armour Class
    // it starts from); whether Haste gives its action on the turn it is cast
    ac: Math.max((stats.ac || {})[stats.act] || 10, brew.ac), hp: stats.hp || 1, hasteNow: true,
    // the Constitution save that keeps Concentration, with Advantage from a feat that says so (War Caster)
    con: con ? con.bonus : 0, conAdv: FEATS.some(([name, text]) => (stats.featNames || new Set()).has(name) && /Advantage on Saving Throws to maintain Concentration/i.test(text)),
    // what it does on a hit (Divine Smite; a manoeuvre or Stunning Strike), the arrows it shoots and the coating
    // on its weapon; the Initiative it rolls with; whether it can be Surprised; the elixir it drank
    smite: null, hit: null, arrow: null, coat: null, initiative: stats.initiative || 0, wary: false, brew,
    // Charisma to the saving throws of the allies near a Paladin (Aura of Protection)
    aura: gains.includes('Aura of Protection') ? Math.max(0, (stats.mods || {}).cha || 0) : 0,
    die: gains.includes('Improved Combat Superiority') ? '1d10' : '1d8',
    // whether it helps a fallen ally up, the manoeuvres it
    // uses apart from a hit (Rally, Evasive Footwork, Commander's Strike on an ally), and its Arcane Acuity
    helps: false, rally: false, foot: false, cmd: '', acu: acuityOf(stats),
    // the conditions it cannot have, as its Traits say them; a Paladin's Aura of Courage keeps its line from being Frightened
    immune: [], courage: gains.includes('Aura of Courage'),
    // the weapon action DC: 8 + proficiency bonus + Strength or Dexterity modifier
    weaponDc: 8 + (stats.pb || 0) + Math.max((stats.mods || {}).str || 0, (stats.mods || {}).dex || 0) };
  let haste;
  let shield;
  let wards;
  let controls;
  let bless;
  let front;
  // where it stands, until the page says otherwise: next to the enemy when what it does at will is a melee or
  // unarmed attack; away from it with a bow, a cantrip or nothing to attack with
  Object.defineProperty(side, 'front', { enumerable: true, configurable: true, set: (x) => { front = !!x; },
    get: () => {
      if (front === undefined) { const v = simBase(side); front = atWill(v) === 'weapon' && !!v.plan && !/^ranged/.test(v.plan.parts[0].row.slot); }
      return front;
    } });
  // spells that only protect: Blade Ward (Resistance to Bludgeoning, Piercing and Slashing for 2 turns) and Mirror
  // Image (three duplicates, +3 to Armour Class each, one gone with every attack evaded)
  Object.defineProperty(side, 'wards', { get: () => wards || (wards = ['Blade Ward', 'Mirror Image'].map((name) => knownSpell(stats, name)).filter(Boolean)) });
  Object.defineProperty(side, 'haste', { get: () => (haste === undefined ? (haste = knownSpell(stats, 'Haste')) : haste) });
  Object.defineProperty(side, 'shield', { get: () => (shield === undefined ? (shield = knownSpell(stats, 'Shield')) : shield) });
  Object.defineProperty(side, 'controls', { get: () => controls || (controls = controlSpells(stats)) });
  Object.defineProperty(side, 'bless', { get: () => (bless === undefined ? (bless = knownSpell(stats, 'Bless')) : bless) });
  return side;
}
// What a build does on a hit, as saved for it on the page: { smite: ''|'all'|'crit', low, hit, every, arrow, arrows, coat }.
// and where it stands and what it does for its allies: { line: ''|'front'|'back', help, rally, foot, cmd }
const simHits = (b) => Object.assign({ smite: '', low: false, hit: '', every: false, arrow: '', arrows: 5, coat: '', line: '', help: true, rally: true, foot: false, cmd: '' }, (state.ui.simHits || {})[b.id] || {});
function simSide(b, act, target) {
  const total = charLevel(b);
  // the level it fights at: the one set on the page of the test, else the "current level" of the build, else all of it
  const want = Number(state.ui.simLevel) || 0;
  const at = want && want < total ? want : b.current && b.current < total ? b.current : 0;
  const opts = at ? { level: at } : null;
  const side = sideOf(finalStats(b, act, opts), buildProfile(at ? atLevel(b, at) : b, act).style, target, simSteps(b));
  let calm = null;
  side.calm = () => calm || (calm = finalStats(Object.assign({}, b, { active: (b.active || []).filter((k) => k !== 'rage') }), act, opts));
  // resistances as the Traits of the build give them: the ones that are always there, and the ones Rage brings
  const resist = { always: new Set(), raging: new Set() };
  const traits = traitsOf(at ? atLevel(b, at) : b, act);
  traits.resist.forEach(([what, source, cond]) => { if (!cond) resist.always.add(what); else if (/^Rage$|Bear Heart/i.test(source)) resist.raging.add(what); });
  if (!resist.raging.size) resist.raging.add('Physical damage');
  const heal = healOptions(side.stats).find((o) => o.value === (state.ui.simHeals || {})[b.id]) || null;
  // "Advantage on Dexterity Saving Throws" among the traits that are always there
  traits.advantage.forEach(([what, , cond]) => { if (!cond) ABILS.forEach(([k, , name]) => { if (new RegExp(name + ' Saving Throws', 'i').test(what)) side.saveAdv.add(k); }); });
  // what it does on a hit, when the build has it
  const h = simHits(b);
  const st = side.stats;
  const opt = st.options || new Set();
  const has = (name) => opt.has(name) || (name === 'Stunning Strike' && (st.gains || []).includes('Stunning Strike'));
  const arrow = CONSUMABLE_BY_NAME.get(norm(h.arrow));
  const coat = CONSUMABLE_BY_NAME.get(norm(h.coat));
  if (h.line) side.front = h.line === 'front';
  return Object.assign(side, { b, act, at, name: b.name || t('Unnamed'), foe: simFoe(target), react: (state.ui.simReacts || {})[b.id] || '', hasteNow: state.ui.hasteNow !== false, resist, heal,
    potions: state.ui.simPotions == null ? 2 : Math.max(0, Number(state.ui.simPotions) || 0),
    smite: h.smite && (st.gains || []).includes('Divine Smite') ? { when: h.smite, low: !!h.low } : null,
    hit: h.hit && has(h.hit) ? { name: h.hit, every: !!h.every } : null,
    arrow: arrow && arrowFx(arrow) ? { name: arrow.n, fx: arrowFx(arrow), n: Math.max(0, Number(h.arrows) || 0) } : null,
    coat: coat && coatFx(coat) ? { name: coat.n, fx: coatFx(coat) } : null,
    helps: h.help !== false, rally: h.rally !== false && opt.has('Rally'),
    foot: !!h.foot && opt.has('Evasive Footwork') && !!condFx('Evasive Footwork'), cmd: opt.has("Commander's Strike") ? h.cmd || '' : '',
    wary: traits.immune.some(([what, , cond]) => !cond && /surprised/i.test(what)),
    immune: traits.immune.filter(([, , cond]) => !cond).map(([what]) => what) });
}
// What a side can do with a set of switches on: its weapon turn and its spells against a target. Worked out once
// for each set. With `many` enemies in the fight, a spell with an area is rolled against each of them in turn.
function simView(side, calm, on, noKi, target, many) {
  const aim = target || side.target;
  const key = (calm ? 'c|' : 'r|') + on.join(',') + (noKi ? '|k' : '') + '|' + (aim === side.target ? '' : aim.name + ':' + aim.ac) + (many ? '|m' : '');
  let v = side.memo.get(key);
  if (!v) {
    const st = Object.assign({}, calm ? side.calm() : side.stats, { active: on }, many ? { targets: 1 } : {});
    const plan = turnPlan(st, side.style, aim, new Set(noKi ? ['Ki Points'] : []));
    const list = spellOptions(st, aim, plan ? plan.parts[0].row : null);
    // reactions: the spells cast in answer to a hit (Hellish Rebuke), and Riposte with the melee weapon
    const reacts = new Map();
    if (st.build) spellbook(st.build, st.act, st).forEach((g) => g.spells.forEach((x) => {
      if (!x.sp || x.sp.a !== 'reaction' || reacts.has(x.sp.n)) return;
      const r = spellDamage(st, { sp: x.sp, title: g.title, ability: g.ability, cls: g.cls || '' }, aim, plan ? plan.parts[0].row : null);
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
// What a build does at will when its plan says nothing: its weapon attacks, or its cantrip when that does more.
// (with no weapon at all, "the weapon" is the cantrip already)
const atWill = (v) => (v.plan && v.cantrip && v.cantrip.total > v.plan.total ? v.cantrip.name : 'weapon');

// ---------- a fight ----------
// With `endless`, nothing runs out and what is switched on simply stays on: one turn of it is the turn the
// averages describe.
const sideResources = (side) => Object.assign(simResources(side.stats), { potions: side.potions, arrows: side.arrow ? side.arrow.n : 0 });
const newRound = () => ({ lost: false, reacted: false, shielded: false, attacked: false, hurt: 0, hurtNow: 0, missNow: 0, kills: 0, crits: 0, sneaked: false, man: 0, bonus: false, blood: false, off: [], stop: false });
const newFight = (side, endless) => ({ turn: 0, left: endless ? null : sideResources(side), dealt: 0, effects: [], lethargic: 0, used: [], hp: side.hp, down: 0, conds: [],
  temp: endless ? 0 : (side.brew || {}).temp || 0, round: newRound(), acuity: endless ? 0 : (side.acu || { floor: 0 }).floor, death: null, dead: false, fell: false, onus: null });
// An enemy in a fight: what it does (`move`, as simFoe gives it), what is aimed at (`target`), its hit points
// (Infinity when there are none to go by), the damage it took and the conditions on it.
// `pv` are its passives in the difficulty chosen; `lr` and `li` the Legendary Resistances it has left.
// `temp` are the temporary hit points of a standing condition, `floor` the damage under which a hit does nothing
// while they last; `struck` counts the hits it took, for an answer that waits for so many; `gone` the pieces of
// its armour that fell.
const foeState = (move, target, hp) => {
  const pv = (target && target.pv) || {};
  return { move, target, name: (move && move.name) || (target && target.name) || '', hp: hp || Infinity, dealt: 0, conds: [], reacted: false, acted: false, dead: 0, inoc: {},
    pv, lr: pv.lr || 0, li: pv.li || 0, parried: false, radiant: false,
    temp: (target && target.tp && target.tp.hp) || 0, floor: (target && target.tp && target.tp.min) || 0, tempName: (target && target.tp && target.tp.n) || '', struck: 0,
    arm: (target && target.arm) || null, gone: 0 };
};
// A fight: the sides (builds) with a fight state each, the enemies, and how it is set up: who acts first ('roll',
// 'party' or 'foes'), who is Surprised ('', 'party' or 'foes'), whom an enemy aims at ('random', 'first' or
// 'weakest'), whom the party strikes first ('main' or 'helpers'), and, for a build alone, whether an ally is taken
// to stand next to the enemy (`ally`, which Sneak Attack asks for when there is no Advantage).
function newEncounter(sides, foes, opts) {
  return { round: 0, live: true, sides, fights: sides.map((s) => newFight(s)), foes, opts: Object.assign({ first: 'roll', surprise: '', aim: 'random', focus: 'main', ally: true }, opts || {}), order: null, init: [] };
}
// A build that fell comes back: helped up, healed or rallied.
function standUp(fight, hp) { Object.assign(fight, { hp: Math.max(1, hp), down: 0, death: null }); }
const encWon = (enc) => enc.foes.every((f) => f.dead);
const encLost = (enc) => enc.fights.every((f) => f.down);
const encOver = (enc) => encWon(enc) || encLost(enc);
// Initiative (the wiki's Initiative page): a d4 plus the bonus, highest first; on a tie, the higher Dexterity score
// (and a build before an enemy when that is a tie too).
function rollInitiative(enc) {
  const all = [...enc.sides.map((s, i) => ({ kind: 'side', i, bonus: s.initiative || 0, dex: ((s.stats || {}).scores || {}).dex || 10, name: s.name })),
    ...enc.foes.map((f, i) => {
      const e = f.target && f.target.enemy;
      const dex = ((f.target && f.target.ab) || (e && e.ab) || { dex: 10 }).dex;
      // (a bonus its page sets outright, else its Dexterity modifier and what the page adds to it: Alert…)
      return { kind: 'foe', i, bonus: e ? (e.in != null ? e.in : Math.floor((dex - 10) / 2) + (e.xi || 0)) : 0, dex, name: f.name || t('The enemy') };
    })];
  if (enc.opts.first === 'roll') all.forEach((x) => { x.roll = rollDie(4); x.total = x.roll + x.bonus; });
  const rank = (x) => (enc.opts.first === 'roll' ? x.total * 1000 + x.dex * 2 + (x.kind === 'side' ? 1 : 0) : (x.kind === 'side') === (enc.opts.first !== 'foes') ? 1 : 0);
  enc.init = all.slice().sort((x, y) => rank(y) - rank(x));
  return enc.init.map((x) => [x.kind, x.i]);
}
// Ends effects of a side: what one of them holds on somebody else goes with it (a condition on an enemy, Haste on
// an ally, who is left Lethargic).
function dropEffects(enc, fight, list, note) {
  if (!list.length) return;
  fight.effects = fight.effects.filter((e) => !list.includes(e));
  list.forEach((e) => {
    (e.holds || []).forEach(([holder, name]) => { holder.conds = holder.conds.filter((c) => c.name !== name); });
    if (e.ally) {
      const there = e.ally.effects.find((y) => y.kind === 'haste' && y.from === e);
      if (there) { e.ally.effects = e.ally.effects.filter((y) => y !== there); e.ally.lethargic = e.ally.turn + 1; if (note) note(t('Haste ends on the ally too, who is left Lethargic.')); }
    }
  });
}
// Everything a side needs to act or to be acted on in a round: its switches, what it sees, how it pays, how its
// attacks and saving throws are changed by the conditions in play, how a blow lands on it. `out` is where the
// lines and notes go: the build's own turn, or the turn of the enemy that strikes it.
function turnTools(enc, i, out) {
  const side = enc.sides[i];
  const fight = enc.fights[i];
  const left = fight.left;
  const R = fight.round;
  const base = side.stats.active || [];
  const many = enc.foes.length > 1;
  const has = (kind) => fight.effects.find((e) => e.kind === kind);
  const named = (name) => fight.effects.find((e) => e.name === name);
  const note = (text) => { if (!out.notes.includes(text)) out.notes.push(text); };
  const drop = (list) => dropEffects(enc, fight, list, note);
  const raging = () => base.includes('rage') && (!left || !!has('rage'));
  const onNow = () => {
    const on = base.filter((k) => (k !== 'haste' || !left || !!has('haste')) && (k !== 'rage' || raging()) && (k !== 'surge' || !left || left.surge > 0) && !R.off.includes(k));
    if (has('haste') && !on.includes('haste')) on.push('haste');
    return on;
  };
  const view = (target) => simView(side, base.includes('rage') && !raging(), onNow(), !!left && left.ki < 1, target || (focus() || enc.foes[0]).target, many);
  const riders = () => fight.effects.filter((e) => e.kind === 'rider').map((e) => e.rider);
  // the enemies still standing, the one the party strikes first in front: the main one, or its helpers before it
  const alive = () => { const list = enc.foes.filter((f) => !f.dead); return enc.opts.focus === 'helpers' && list.length > 1 && list[0] === enc.foes[0] ? list.slice(1).concat(list[0]) : list; };
  function focus() { return alive()[0] || null; }
  // Bless cast by anyone of the party on this member (not counted twice with the switch of Final numbers)
  const blessed = () => !base.includes('text:Bless') && enc.fights.some((f) => f.effects.some((e) => e.kind === 'bless' && e.to.includes(i)));
  // pays for a cast: a slot, or its one use a rest for a spell that recharges that way; false when it cannot
  // (`silent` leaves the reason unsaid: a reaction that cannot be paid for just does not happen)
  const pay = (x, points, silent) => {
    if (!left) return true;
    const free = /rest/i.test(x.sp.rc || '');
    if (free && fight.used.includes(x.name)) { if (!silent) note(t('{spell} was used already: it comes back with a rest.', { spell: x.name })); return false; }
    if (!free && x.slot && !takeSlot(left, x, false)) { if (!silent) note(t('No spell slot left for {spell}: the turn goes to what the build does at will.', { spell: x.name })); return false; }
    if (free) fight.used.push(x.name); else if (x.slot) takeSlot(left, x, true);
    left.points -= points || 0;
    return true;
  };
  // what the conditions in play do to an attack of this build on an enemy: `near` when it is made from up close
  const mods = (f, near) => {
    const m = { adv: false, dis: condHas(fight, 'dis'), crit: false, dice: blessed() ? ['1d4'] : [], spell: fight.acuity || 0, once: [],
      saveFx: (key, kind) => ({ fail: f.conds.some((c) => (c.f.fail || []).includes(key)), dis: f.conds.some((c) => (c.f.sd || []).includes(key)),
        // Magic Resistance: Advantage against spells
        adv: (kind === 'spell' || kind === 'hold') && !!f.pv.mr,
        // Legendary Resistance, three times: the general one on any save, though not on a natural 1 or 20 (its page's
        // bug note); the other only against what incapacitates
        resist: (d20) => {
          if (f.lr > 0 && d20 !== 1 && d20 !== 20) { f.lr--; return true; }
          if ((kind === 'hold' || kind === 'stun') && f.li > 0) { f.li--; return true; }
          return false;
        } }) };
    f.conds.forEach((c) => {
      if (c.f.ally && c.by === fight) return;  // Distracted: for the allies of whoever caused it, not for that one
      if (c.f.adv && (!c.f.near || near)) { m.adv = true; if (c.f.once) m.once.push(c); }
      if (c.f.crit && near) m.crit = true;
    });
    const gains = side.stats.gains || [];
    // Assassinate: Advantage against whoever has not taken a turn yet; a hit on a Surprised creature is a critical hit
    if (enc.live && !f.acted && gains.includes('Assassinate: Initiative')) m.adv = true;
    if (enc.live && f.surprised && gains.includes('Assassinate: Ambush')) m.crit = true;
    return m;
  };
  // an attack roll made with the Advantage of a condition that is good for one attack (Distracted) spends it
  const spend = (m, f) => { if (m.once && m.once.length) f.conds = f.conds.filter((c) => !m.once.includes(c)); };
  // what every saving throw of the build gets on top: the die of Bless or of what is switched on, and the Aura of
  // Protection of a Paladin still standing in the same line (within its 3 m)
  const saveExtra = () => [...(side.stats.savesDice || []), ...(blessed() ? ['1d4'] : [])].reduce((a, d) => a + rollDice(d).sum, 0)
    + enc.sides.reduce((a, s, k) => (k !== i && !enc.fights[k].down && s.front === side.front ? Math.max(a, s.aura || 0) : a), 0);
  // a saving throw of the build: { d20, total, passed }. Conditions on it, Advantage from its traits, and the above.
  const mySave = (key, dc) => {
    const auto = fight.conds.some((c) => (c.f.fail || []).includes(key));
    const d20 = auto ? 0 : rollD20((side.saveAdv.has(key) ? 1 : 0) - (fight.conds.some((c) => (c.f.sd || []).includes(key)) ? 1 : 0));
    const bonus = (side.saves[key] || 0) + saveExtra();
    return { d20, bonus, passed: !auto && d20 + bonus >= dc, auto };
  };
  // damage lands on an enemy: it may fall; else it may answer, once a round
  const land = (lines, f, near) => {
    if (f && many) lines.forEach((l) => { l.to = f.name; });
    out.lines.push(...lines);
    if (lines.some((l) => l.kind === 'attack')) R.attacked = true;
    // Githyanki Parry: that much off one weapon or unarmed hit a round
    if (f && f.pv.pr && !f.parried && !condHas(f, 'skip')) {
      const hit = lines.find((l) => l.weapon && l.hit && l.damage > 0);
      if (hit) { const off = Math.min(f.pv.pr, hit.damage); f.parried = true; hit.damage -= off; hit.text += ' − ' + tenth(off) + ' (Githyanki Parry)'; }
    }
    if (f && lines.some((l) => l.damage > 0 && /\bRadiant\b/.test(l.text || ''))) f.radiant = true;
    // temporary hit points of a standing condition (the Bulette's Diamond Scales): while they last, a hit of less
    // than so much does nothing
    if (f && f.temp > 0 && f.floor) lines.forEach((l) => { if (l.damage > 0 && l.damage < f.floor) { l.text += ' → 0 (' + f.tempName + ')'; l.damage = 0; } });
    const dmg = lines.reduce((a, l) => a + (l.damage || 0), 0);
    // Fire damage dealt keeps Arcane Acuity up, with the gear that says so
    if (left) ['Fire', 'Thunder'].forEach((type) => {
      const turns = side.acu[type.toLowerCase()];
      if (turns && lines.some((l) => l.damage > 0 && new RegExp('\\b' + type + '\\b').test(l.text || ''))) fight.acuity = Math.min(10, (fight.acuity || 0) + turns);
    });
    if (!f) return;
    const free = () => !f.dead && left && !f.surprised && !R.answering && !condHas(f, 'nr') && !condHas(f, 'skip') && !f.conds.some((c) => /Restrained/.test(c.name));
    if (dmg > 0) {
      const soak = Math.min(f.temp, dmg);
      if (soak) { f.temp -= soak; note(f.temp ? t('{name}: {n} temporary hit points left.', { name: f.tempName, n: tenth(f.temp) }) : t('{name} is gone: its temporary hit points are spent.', { name: f.tempName })); }
      f.dealt += dmg - soak;
      fight.dealt += dmg;
      f.conds = f.conds.filter((c) => !c.f.wake);
      if (f.dealt >= f.hp && !f.dead) { f.dead = enc.round || 1; R.kills++; note(t('{who} falls.', { who: f.name || t('The enemy') })); return; }
      // armour that is its hit points (Gerringothe Thorm's Coin Armour): a piece falls with every so much damage,
      // and in Honour mode each one is answered, whatever else it answered this round, to whoever stands by it
      while (f.arm && f.gone < Math.min(f.arm.n, Math.floor(f.dealt / f.arm.hp))) {
        f.gone++;
        note(t('A piece of its armour falls: {n} of {max} left.', { n: f.arm.n - f.gone, max: f.arm.n }));
        const piece = (f.move.rx || []).find((a) => a.piece);
        if (piece && free() && (near || side.front)) { R.answering = true; strike(piece, 0, f, true); R.answering = false; }
      }
    }
    // an answer that waits for so many hits (the Spectator's Paranoid Dreams): one for each that lands
    const waits = (f.move.rx || []).some((a) => a.after);
    if (waits) f.struck += lines.filter((l) => (l.kind === 'attack' && l.hit) || l.damage > 0).length;
    if (free() && !f.reacted && (dmg > 0 || lines.some((l) => l.kind === 'attack'))) {
      const rx = (f.move.rx || []).filter((a) => !a.piece && (!a.temp || f.temp > 0) && (!a.after || f.struck >= a.after) && (!a.uses || ((f.used || {})[a.label] || 0) < a.uses));
      const act = rx.find((a) => a.melee === !!near) || rx[0];
      if (act) {
        f.reacted = true;
        if (act.after) f.struck = 0;
        R.answering = true;
        strike(act, 0, f, true);
        R.answering = false;
      }
    }
  };
  // the build's Armour Class as the blow comes: Hastened +2, +3 for each duplicate of Mirror Image, Shield +5
  const armour = () => { const mirror = has('mirror'); return side.ac + (has('haste') ? 2 : 0) + (mirror ? 3 * mirror.images : 0) + (R.shielded ? 5 : 0); };
  // Concentration ends: by a hit, by a condition
  const lose = (why) => {
    const held = fight.effects.filter((e) => e.conc);
    if (!held.length) return;
    drop(held);
    if (held.some((e) => e.kind === 'haste')) fight.lethargic = fight.turn + 1;
    note(why(held.map((e) => e.name).join(', ')));
  };
  // one blow of an enemy on the build
  function strike(act, k, f, answering) {
    const move = f.move;
    const blow = { name: f.name || t('The enemy'), how: (act.label || t('melee attack')) + (answering ? ' · ' + (act.legend ? 'Legendary Action' : t('reaction')) : ''), kind: 'foe', mode: act.kind, d20: 0, bonus: 0, against: 0, hit: true, crit: false, passed: false, kept: 0, damage: 0, taken: 0, text: '' };
    if (many || enc.sides.length > 1) blow.on = side.name;
    out.lines.push(blow);
    if (act.kind === 'e') {
      // it heals itself: that much of the damage dealt so far is undone
      const [dice, flat] = act.hits[0][0];
      const r = rollDice(dice);
      blow.healed = r.sum + flat;
      blow.text = [r.rolls.length ? diceBit(dice, r) : '', flat ? String(flat) : ''].filter(Boolean).join(' + ') + ' = ' + tenth(blow.healed);
      f.dealt = Math.max(0, f.dealt - blow.healed);
      return;
    }
    let share = 1;
    let landed = true;
    if (act.kind === 'a') {
      const ac = armour();
      // conditions: Advantage against a build that is Prone (from up close), Blinded, Stunned…; Disadvantage for an
      // enemy that is Frightened, Blinded, Poisoned…
      const adv = fight.conds.some((c) => c.f.adv && !c.f.ally && (!c.f.near || act.melee));
      // (Evasive Footwork: Disadvantage for melee attacks on the build)
      Object.assign(blow, { d20: rollD20((adv ? 1 : 0) - (condHas(f, 'dis') || (act.melee && condHas(fight, 'guard')) ? 1 : 0)), bonus: act.bonus, against: ac });
      blow.crit = blow.d20 === 20;
      blow.hit = blow.d20 !== 1 && (blow.crit || blow.d20 + act.bonus >= ac);
      if (blow.hit && act.melee && fight.conds.some((c) => c.f.crit)) blow.crit = true;
      // Shield: +5 to Armour Class until the build's next turn, cast when that turns the hit into a miss
      if (blow.hit && !blow.crit && side.react === 'Shield' && !R.reacted && !R.shielded && side.shield && blow.d20 + act.bonus < ac + 5 && pay(side.shield, 0, true)) {
        R.reacted = true;
        R.shielded = true;
        Object.assign(blow, { hit: false, against: ac + 5 });
        note(t('Shield: +5 to Armour Class until the next turn.'));
      }
      if (!blow.hit) {
        if (act.melee) R.missNow++;
        // an attack evaded takes one duplicate of Mirror Image with it
        const mirror = has('mirror');
        if (mirror && --mirror.images <= 0) { drop([mirror]); note(t('{name} ends.', { name: mirror.name })); }
        // (some attacks still deal half their damage on a miss; with Tenacity a missed melee attack deals its Strength modifier)
        const tough = act.melee && !!f.pv.tn && !act.om;
        if (!act.om && !tough) return;
        share = act.om || 1;
        blow.half = !tough;
        if (tough) { blow.tenacity = Math.max(1, Math.floor((((f.target.ab || {}).str || 10) - 10) / 2)); blow.how += ' · Tenacity'; }
        landed = false;
      }
    } else if (act.kind === 's') {
      // Evasion: nothing on a passed Dexterity save that would halve, half on a failed one
      const evades = side.evasion && act.sv === 'dex' && act.os === 0.5;
      const thrown = mySave(act.sv, act.dc);
      Object.assign(blow, { d20: thrown.d20, auto: thrown.auto, bonus: thrown.bonus, against: act.dc, ab: act.sv.toUpperCase(), kept: evades ? 0 : act.os, passed: thrown.passed });
      share = blow.passed ? (evades ? 0 : act.os) : evades ? 0.5 : 1;
      if (evades) blow.how += ' · Evasion';
      landed = !blow.passed;
      blow.hit = share > 0 || (landed && !!act.cd);
      if (!blow.hit) return;
    }
    // what lands on the build: a resistance halves it, and so does Uncanny Dodge, once a round
    const bits = [];
    let raw = 0;
    (blow.tenacity ? [['', blow.tenacity, 'Bludgeoning']] : act.hits ? act.hits[Math.min(k, act.hits.length - 1)] : [['', move.damage, '']]).forEach(([dice, flat, type]) => {
      const r = rollDice(dice, blow.crit);
      raw += r.sum + flat;
      blow.taken += (r.sum + flat) * share * takes(side, type, !!has('rage'), !!has('ward'));
      bits.push([r.rolls.length ? diceBit(dice, r) : '', flat || !r.rolls.length ? String(flat) : ''].filter(Boolean).join(' + ') + (type ? ' ' + type : ''));
    });
    if (side.react === 'Uncanny Dodge' && !R.reacted && side.dodge && blow.taken > 0) { R.reacted = true; blow.taken /= 2; blow.how += ' · Uncanny Dodge'; }
    blow.text = bits.join(' + ') + (bits.length > 1 || Math.abs(raw - blow.taken) > 0.001 ? ' = ' + tenth(raw) : '') + (Math.abs(raw - blow.taken) > 0.001 ? ' → ' + tenth(blow.taken) : '');
    if (blow.taken > 0 || !act.hits || (act.hits[0] || []).length) { R.hurt++; R.hurtNow++; }
    // what answers a melee hit
    if (act.kind === 'a' && act.melee && landed) fight.effects.filter((e) => e.kind === 'later' && e.later.some((p) => p.when === 'struck')).forEach((e) => {
      const back = rollLater(e, 'struck');
      back.forEach((l) => { l.how = t('when struck'); if (many) l.to = f.name; });
      out.lines.push(...back);
      const dmg = back.reduce((a, l) => a + l.damage, 0);
      f.dealt += dmg;
      fight.dealt += dmg;
      if (f.dealt >= f.hp && !f.dead) { f.dead = enc.round || 1; note(t('{who} falls.', { who: f.name || t('The enemy') })); }
    });
    // temporary hit points go first (an elixir's, Armour of Agathys), then the build's own
    let rest = blow.taken;
    if (fight.temp > 0) { const part = Math.min(fight.temp, rest); fight.temp -= part; rest -= part; }
    fight.effects.filter((e) => e.pool != null).forEach((e) => {
      const part = Math.min(e.pool, rest);
      e.pool -= part;
      rest -= part;
      if (e.pool <= 0) { drop([e]); note(t('{name} ends.', { name: e.name })); }
    });
    fight.hp -= rest;
    if (blow.taken > 0) fight.conds = fight.conds.filter((c) => !c.f.wake);
    // a hit taken costs two turns of Arcane Acuity
    if (blow.taken > 0 && fight.acuity) fight.acuity = Math.max(side.acu.floor, fight.acuity - 2);
    if (fight.hp <= 0) {
      // Downed: out of the fight until helped up or healed, rolling death saving throws meanwhile
      Object.assign(fight, { down: enc.round || 1, fell: true, death: { ok: 0, bad: 0 }, conds: [], onus: null });
      R.stop = true;
      drop(fight.effects.filter((e) => e.conc));
      note(enc.sides.length > 1 ? t('{who} falls in turn {n}.', { who: side.name, n: fight.down }) : t('The build falls in turn {n}.', { n: fight.down }));
      return;
    }
    // the condition the blow leaves, when the build fails the save against it (the blow's own save counts)
    // (not one the build cannot have: its own immunities, and a Paladin's Aura of Courage against Frightened)
    const shrugs = !!act.cd && landed && (side.immune.some((x) => new RegExp('\\b' + escRe(act.cd.name) + '\\b', 'i').test(x))
      || (/Frightened/.test(act.cd.name) && enc.sides.some((y, k) => y.courage && !enc.fights[k].down && (k === i || y.front === side.front))));
    if (shrugs) note(t('{who} cannot be {cond}.', { who: side.name || t('The build'), cond: act.cd.name }));
    if (act.cd && landed && !shrugs && !fight.conds.some((c) => c.name === act.cd.name)) {
      const cd = act.cd;
      const own = cd.sv && !(act.kind === 's' && cd.sv === act.sv);
      const thrown = own ? mySave(cd.sv, cd.dc) : null;
      if (thrown) out.lines.push({ name: blow.name, how: cd.name, kind: 'foe', mode: 's', on: blow.on, d20: thrown.d20, auto: thrown.auto, bonus: thrown.bonus, against: cd.dc, ab: cd.sv.toUpperCase(), passed: thrown.passed, kept: 0, hit: !thrown.passed, damage: 0, taken: 0, text: '', cond: true });
      if (!thrown || !thrown.passed) {
        const c = addCond(fight, cd.name, cd.turns, f, cd.sv && cd.dc ? { key: cd.sv, dc: cd.dc } : null);
        note(t('{who} is {cond} for {n} turn(s).', { who: side.name || t('The build'), cond: cd.name, n: c.left }));
        if (c.f.drop) lose((names) => t('{cond} ends the Concentration: {name} ends.', { cond: cd.name, name: names }));
      }
    }
    // damage taken can break Concentration: Constitution save against 10 or half the damage, whichever is higher
    if (fight.effects.some((e) => e.conc) && blow.taken > 0) {
      const dc = Math.max(10, Math.floor(blow.taken / 2));
      const save = rollD20(side.conAdv ? 1 : 0);
      if (save === 1 || save + side.con < dc) lose((names) => t('A hit breaks the Concentration ({roll} {bonus} against DC {dc}): {name} ends.', { roll: save, bonus: (side.con < 0 ? '− ' : '+ ') + Math.abs(side.con), dc, name: names }));
    }
  }
  return { side, fight, left, R, base, many, has, named, note, drop, raging, onNow, view, riders, alive, focus, blessed, pay, mods, spend, saveExtra, mySave, land, strike, lose };
}
// The turn of a build that is Downed: a death saving throw (the wiki's Death Saving Throw page), a d20 against 10
// with nothing added but the die of Bless and a Paladin's aura. Three passed and it is Stable; three failed, dead.
function downedTurn(enc, i) {
  const side = enc.sides[i];
  const fight = enc.fights[i];
  const d = fight.death || (fight.death = { ok: 0, bad: 0 });
  if (d.ok >= 3) return null;
  const out = { who: i, kind: 'side', title: side.name, name: 'Downed', lines: [], notes: [], total: 0 };
  const d20 = rollD20(0);
  const total = d20 + turnTools(enc, i, out).saveExtra();
  if (d20 !== 1 && total >= 10) d.ok++; else d.bad++;
  out.notes.push(t('Death saving throw: {roll} against DC 10. {ok} passed, {bad} failed.', { roll: total, ok: d.ok, bad: d.bad }));
  if (d.bad >= 3) { fight.dead = true; out.notes.push(t('{who} dies.', { who: side.name || t('The build') })); }
  else if (d.ok >= 3) out.notes.push(t('{who} is Stable: no more death saving throws.', { who: side.name || t('The build') }));
  return out;
}

// One turn of a build in a fight. { who, kind: 'side', name, lines, notes, total }
function buildTurn(enc, i) {
  const side = enc.sides[i];
  const fight = enc.fights[i];
  if (fight.down) return enc.live && !fight.dead ? downedTurn(enc, i) : null;
  const out = { who: i, kind: 'side', title: side.name, name: '', lines: [], notes: [], total: 0 };
  const n = ++fight.turn;
  const keep = fight.round;
  const R = fight.round = Object.assign(newRound(), { attacked: keep.attacked, hurt: keep.hurt });
  const T = turnTools(enc, i, out);
  const { left, base, has, named, note, drop, view, riders, pay, land } = T;
  const opts = side.stats.options || new Set();
  const gains = side.stats.gains || [];
  const lines = out.lines;
  const did = [];
  const done = () => {
    out.total = lines.reduce((a, x) => a + x.damage, 0);
    out.name = did.join(' + ') || t('Nothing');
    // the end of the turn: conditions count down, on the build and the ones it caused
    condEnd(fight, (key) => side.saves[key] || 0, note, enc.foes);
    return out;
  };
  // what ran its course; the turn after Haste ends is lost
  fight.effects.filter((e) => e.until < n).forEach((e) => {
    if (!e.quiet) note(t('{name} ends.', { name: e.name }));
    if (e.kind === 'haste') fight.lethargic = n;
    drop([e]);
  });
  condStart(fight, note);
  condSource(fight, enc.foes);
  // Arcane Acuity runs down a turn at a time, never below what an elixir keeps it at
  if (left) fight.acuity = Math.max(side.acu.floor, (fight.acuity || 0) - (n > 1 ? 1 : 0));
  // the allies that are Downed and can still be brought back
  const fallen = () => enc.sides.map((s, k) => k).filter((k) => k !== i && enc.fights[k].down && !enc.fights[k].dead);
  // the damage of what was cast on earlier turns
  fight.effects.filter((e) => e.kind === 'later' && e.from < n).forEach((e) => {
    if (e.foe && e.foe.dead) return;
    const dealt = rollLater(e, '');
    if (!dealt.length) return;
    land(dealt, e.foe || T.focus());
    if (e.once) { e.until = n; e.quiet = true; }
  });
  const lost = fight.lethargic === n;
  const held = fight.conds.find((c) => c.f.skip);
  const surprised = !!fight.surprised && enc.round <= 1;
  if (lost) { note(t('Lethargic after Haste: no action this turn.')); did.push('Lethargic'); }
  else if (held) { note(t('{cond}: no action this turn.', { cond: held.name })); did.push(held.name); }
  else if (surprised) note(t('Surprised: no action and no reaction in the first round.'));
  R.lost = lost || !!held;
  R.reacted = R.lost || surprised || condHas(fight, 'nr');
  // Haste switched on above comes from someone else: it is there from the first turn, for its ten turns
  if (left && n === 1 && base.includes('haste')) fight.effects.push({ name: 'Haste', kind: 'haste', until: 10 });
  if (left && n === 1 && side.coat) note(t('{name} on the weapon, for its 10 turns.', { name: side.coat.name }));
  // at half its hit points or less, the bonus action goes to the healing chosen on the page; a healing spell also
  // goes to whoever of the party is that low
  R.bonus = R.lost;
  // Evasive Footwork: a Superiority Die for Disadvantage on the melee attacks made on the build. The wiki notes that
  // it ends with the build's own turn, so it only covers what answers the build during that turn.
  if (!R.lost && left && side.foot && left.dice > 0) { left.dice--; addCond(fight, 'Evasive Footwork', 1, fight); note(t('Evasive Footwork: Disadvantage on melee attacks against the build, until the end of its turn.')); }
  if (!R.lost && left && side.heal) {
    const h = side.heal;
    const low = (k) => !enc.fights[k].down && enc.fights[k].hp <= enc.sides[k].hp / 2;
    // a healing spell goes first to an ally that is Downed, which stands up with what it heals
    const who = h.kind === 'spell' && fallen().length ? fallen()[0] : low(i) ? i : h.kind === 'spell' ? enc.sides.map((s, k) => k).filter(low).sort((a, b) => enc.fights[a].hp / enc.sides[a].hp - enc.fights[b].hp / enc.sides[b].hp)[0] : undefined;
    const can = who === undefined ? false : h.kind === 'wind' ? left.wind > 0 : h.kind === 'potion' ? left.potions > 0 : !has('rage') && takeSlot(left, h, false);
    if (can) {
      if (h.kind === 'wind') left.wind--; else if (h.kind === 'potion') left.potions--; else takeSlot(left, h, true);
      const healed = rollDice(h.dice).sum + h.flat;
      if (enc.fights[who].down) standUp(enc.fights[who], healed);
      else enc.fights[who].hp = Math.min(enc.sides[who].hp, enc.fights[who].hp + healed);
      R.bonus = true;
      did.push(h.name);
      note(who === i ? t('{what}: {n} hit points back, with the bonus action.', { what: h.name, n: tenth(healed) }) : t('{what}: {n} hit points back to {who}, with the bonus action.', { what: h.name, n: tenth(healed), who: enc.sides[who].name }));
    }
  }
  // Rally: the bonus action and a Superiority Die for 8 temporary hit points, to an ally that is Downed (who is back
  // at 1 hit point first) or to whoever of the party is at half its hit points or less
  if (!R.bonus && left && side.rally && left.dice > 0) {
    const weak = enc.sides.map((s, k) => k).filter((k) => !enc.fights[k].down && enc.fights[k].hp <= enc.sides[k].hp / 2 && enc.fights[k].temp < 8);
    const k = fallen().length ? fallen()[0] : weak[0];
    if (k !== undefined) {
      left.dice--;
      R.bonus = true;
      if (enc.fights[k].down) standUp(enc.fights[k], 1);
      enc.fights[k].temp = Math.max(enc.fights[k].temp, 8);
      did.push('Rally');
      note(t('Rally: 8 temporary hit points to {who}, with the bonus action.', { who: enc.sides[k].name || t('The build') }));
    }
  }
  // Rage is entered with the bonus action, lasts ten turns and takes a charge
  if (!R.bonus && left && base.includes('rage') && !has('rage')) {
    if (left.rage > 0) { left.rage--; fight.effects.push({ name: 'Rage', kind: 'rage', until: n + 9 }); R.bonus = true; note(t('Rage: entered with the bonus action.')); }
    else if (!fight.noRage) { fight.noRage = true; note(t('No Rage Charges left.')); }
  }
  const raging = T.raging();
  const step = side.steps[Math.min(n, 4) - 1];
  const wantOf = (f, by) => step[f] || side.steps[3][f] || by;
  // (with nothing planned: the weapon, or the cantrip when that does more)
  const wantA = wantOf('a', '') || (raging ? 'weapon' : atWill(view()));
  const wantQ = wantOf('q', 'auto');
  const wantX = wantOf('x', 'same');
  // one spell at a time holds Concentration. Haste cast on oneself and dropped for another spell leaves the caster
  // Lethargic at once (until the end of the turn), and the new spell ends
  const concentrate = (name) => {
    const own = fight.effects.find((e) => e.kind === 'haste' && e.conc);
    if (own) {
      drop([own]);
      R.stop = true;
      note(t('Casting {spell} drops the Concentration on Haste: Lethargic at once, the new spell ends and the rest of the turn is lost.', { spell: name }));
      return false;
    }
    fight.effects.filter((e) => e.conc).forEach((e) => { note(t('{name} ends: Concentration goes to {spell}.', { name: e.name, spell: name })); drop([e]); });
    return true;
  };
  const noSpells = (name) => { if (raging) note(t('No spells while raging: {spell} is not cast.', { spell: name })); return raging; };
  // the condition a spell leaves on an enemy that failed its save (or was hit): held by the caster's Concentration
  // when the spell asks for it. `failed` is how the roll of the cast went, when there was one.
  const leave = (s, f, save, failed, effect) => {
    (s.cn || []).filter((c) => condFx(c[0]) && !f.conds.some((y) => y.name === c[0])).forEach((c) => {
      if (!failed) return;
      const fx = condFx(c[0]);
      const key = fx.rep && fx.rep !== 'same' ? fx.rep : save ? save.key : '';
      const cond = addCond(f, c[0], parseInt(c[1], 10) || 2, fight, save && key ? { key, dc: save.dc } : null);
      note(t('{who} is {cond} for {n} turn(s).', { who: f.name || t('The enemy'), cond: c[0], n: cond.left }));
      if (effect) (effect.holds = effect.holds || []).push([f, c[0]]);
    });
  };
  // a spell that deals damage or answers the enemy; `quick` casts it with the bonus action, for 3 Sorcery Points more
  const cast = (name, quick) => {
    let x = view().spells.get(name);
    if (!x || noSpells(name)) return false;
    if (named(name) && (x.perTurn || x.setup)) return false;  // still at work: not cast again
    if (left && (x.points || 0) + (quick ? 3 : 0) > left.points) {
      if (quick && left.points < 3) { note(t('No Sorcery Points left for Quickened Spell.')); return false; }
      if (x.points) {
        R.off.push('meta:twin', 'meta:heighten');
        x = view().spells.get(name);
        note(t('No Sorcery Points left for the Metamagic.'));
        if (!x) return false;
      }
    }
    if (!pay(x, (x.points || 0) + (quick ? 3 : 0))) return false;
    did.push(name + (quick ? ' (Quickened Spell)' : ''));
    if (x.recipe.conc && !concentrate(name)) return true;
    // whom it lands on: every enemy an area catches, a second one for Twinned Spell, else the one in front
    const there = T.alive();
    const marks = !T.many ? [T.focus()] : x.area ? there.slice(0, x.cap || 8) : x.recipe.repeat > 1 ? there.slice(0, 2) : [T.focus()];
    let first = true;
    marks.filter(Boolean).forEach((f) => {
      const xf = T.many ? view(f.target).spells.get(name) || x : x;
      const r = T.many && xf.recipe.repeat > 1 && marks.length > 1 ? Object.assign({}, xf.recipe, { repeat: 1 }) : xf.recipe;
      const dealt = rollSpell(view(f.target).st, Object.assign({}, xf, { recipe: r }), f.target, riders(), T.mods(f, false));
      if (quick) dealt.forEach((l) => { l.how = 'Quickened Spell'; });
      // what it leaves at work: damage on the following turns (when the attack that carries it hit), damage that
      // waits for the enemy, Concentration
      const landed = !dealt.some((l) => l.kind === 'attack') || dealt.some((l) => l.kind === 'attack' && l.hit);
      // a wall leaves its cloud only when the page says it is broken; from then on that is damage of every turn
      const later = (landed ? r.later : []).filter((p) => p.when !== 'broken' || enc.foes[0].move.broken).map((p) => (p.when === 'broken' ? Object.assign({}, p, { when: '' }) : p));
      const ticking = later.filter((p) => !p.when);
      const once = ticking.length > 0 && ticking.every((p) => p.once);
      const moving = later.length > 0 && later.every((p) => p.when === 'moves');
      let e = null;
      if (later.length || r.conc) {
        if (first) drop(fight.effects.filter((y) => y.name === name));
        e = { name, kind: 'later', from: n, conc: r.conc, later, save: r.laterSave || r.save, once, quiet: moving || (once && later.length === ticking.length) || !first,
          until: moving ? n : once ? n + 1 : r.turns ? n + r.turns - 1 : Infinity, foe: T.many && !x.setup ? f : null };
        // Armour of Agathys answers while the temporary hit points it gives hold
        if (x.setup && /temporary hit points/i.test(x.sp.d || '')) e.pool = later.reduce((a, p) => a + p.flat, 0);
        fight.effects.push(e);
        if (x.setup && first) note(t('{spell} cast: {x}.', { spell: name, x: x.text }));
      }
      // the condition it leaves, by its saving throw or by the hit
      const saves = dealt.filter((l) => l.kind === 'save');
      const hits = dealt.filter((l) => l.kind === 'attack');
      if ((x.sp.cn || []).some((c) => condFx(c[0])) && (r.save || x.sp.at) && (saves.length || hits.length)) {
        leave(x.sp, f, r.save, saves.length ? saves.some((l) => !l.passed) : hits.some((l) => l.hit), e && r.conc ? e : null);
      }
      land(dealt, f, false);
      if (hits.length) T.spend(T.mods(f, false), f);
      // a hit with a spell that uses a weapon keeps Arcane Acuity up, with the gloves that say so
      if (left && side.acu.smite && r.weapon && hits.some((l) => l.hit)) fight.acuity = Math.min(10, (fight.acuity || 0) + side.acu.smite);
      first = false;
    });
    return true;
  };
  // a spell that only leaves a condition (Hold Person): the enemy in front saves against it
  const castControl = (name) => {
    const x = side.controls.find((c) => c.name === name);
    const f = T.focus();
    if (!x || !f || noSpells(name) || x.sp.cn.every((c) => f.conds.some((y) => y.name === c[0]))) return false;
    // "Hold a humanoid": no use on anything else
    if (/\bhumanoid\b/i.test(x.sp.d || '') && f.target.enemy && !enemyIs(f.target, 'Humanoid')) { note(t('{spell} only works on a Humanoid: it is not cast.', { spell: name })); return false; }
    const high = T.onNow().includes('meta:heighten') && opts.has('Heightened Spell') && (!left || left.points >= 3);
    if (!pay(x, high ? 3 : 0)) return false;
    did.push(name);
    if (x.sp.co && !concentrate(name)) return true;
    const save = { key: x.key, bonus: f.target.saves[x.key] || 0, dc: x.dc, dis: high };
    const thrown = throwSave(save, T.mods(f, false), x.sp.cn.some((c) => (condFx(c[0]) || {}).skip) ? 'hold' : 'spell');
    const turns = parseInt((x.sp.cn.find((c) => condFx(c[0])) || [])[1], 10) || 2;
    const e = x.sp.co ? { name, kind: 'hold', conc: true, until: n + turns - 1, quiet: false } : null;
    if (e) fight.effects.push(e);
    leave(x.sp, f, save, !thrown.passed, e);
    land([{ name, kind: 'save', ab: x.key.toUpperCase(), d20: thrown.d20, auto: !!thrown.auto, legend: !!thrown.legend, bonus: save.bonus, against: save.dc, passed: thrown.passed, kept: 0, damage: 0, cond: true,
      how: high ? 'Heightened Spell' : '', text: thrown.passed ? '' : x.sp.cn.filter((c) => condFx(c[0])).map((c) => c[0]).join(', ') }], f, false);
    if (thrown.passed && e) drop([e]);
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
    note(t('{spell} cast: {dice} on every hit while it lasts.', { spell: name, dice: dicePart(x.rider) }));
    return true;
  };
  const castWard = (name) => {
    const x = side.wards.find((w) => w.name === name);
    if (!x || named(name) || noSpells(name) || !pay(x, 0)) return false;
    did.push(name);
    if (x.sp.co && !concentrate(name)) return true;
    const turns = Number((/(\d+) turn/.exec(x.sp.du || '') || [])[1]) || 1;
    fight.effects.push(Object.assign({ name, kind: name === 'Mirror Image' ? 'mirror' : 'ward', until: n + turns - 1, conc: !!x.sp.co }, name === 'Mirror Image' ? { images: 3 } : {}));
    return true;
  };
  // Haste, on the caster or on an ally ("Haste>" and the ally's build): the caster holds the Concentration
  const castHaste = (to) => {
    const x = side.haste;
    const k = to ? enc.sides.findIndex((s, j) => j !== i && s.b && s.b.id === to && !enc.fights[j].down) : -1;
    const ally = k >= 0 ? enc.fights[k] : null;
    if (!x || (ally ? ally.effects.some((e) => e.kind === 'haste') : has('haste')) || noSpells('Haste') || !pay(x, 0)) return false;
    did.push(ally ? t('Haste on {who}', { who: enc.sides[k].name }) : 'Haste');
    if (!concentrate('Haste')) return true;
    if (ally) {
      const link = { name: 'Haste', kind: 'link', until: n + 9, conc: true, ally };
      fight.effects.push(link);
      ally.effects.push({ name: 'Haste', kind: 'haste', until: ally.turn + 10, from: link });
      note(t('Haste cast on {who}: one more action a turn, for 10 turns.', { who: enc.sides[k].name }));
      return true;
    }
    fight.effects.push({ name: 'Haste', kind: 'haste', until: n + 9, conc: true, from: n });
    note(t('Haste cast: one more action a turn, for 10 turns.'));
    return true;
  };
  // Bless: a d4 on the attack rolls and saving throws of three of the party, the caster first
  const castBless = () => {
    const x = side.bless;
    if (!x || named('Bless') || noSpells('Bless') || !pay(x, 0)) return false;
    did.push('Bless');
    if (!concentrate('Bless')) return true;
    const to = [i, ...enc.sides.map((s, k) => k).filter((k) => k !== i && !enc.fights[k].down)].slice(0, 3);
    fight.effects.push({ name: 'Bless', kind: 'bless', until: n + 9, conc: true, to });
    note(t('Bless cast on {who}: 1d4 on attack rolls and saving throws, for 10 turns.', { who: to.map((k) => enc.sides[k].name || t('The build')).join(', ') }));
    return true;
  };
  // ----- weapon attacks -----
  const hitName = side.hit ? side.hit.name : '';
  const swing = (part, more) => {
    const k = part.chance != null ? 1 : part.n;
    if (!did.includes(t('Weapon attacks'))) did.push(t('Weapon attacks'));
    for (let s = 0; s < k && !R.stop; s++) {
      const f = T.focus();
      if (!f) break;
      const st = view(f.target).st;
      const row = part.row;
      const near = row.slot === 'unarmed' || ((row.slot === 'meleeMain' || row.slot === 'meleeOff') && !row.thrown);
      const ranged = row.slot === 'rangedMain' || row.slot === 'rangedOff';
      const weapon = row.slot !== 'unarmed';
      const m = T.mods(f, near);
      const how = [part.how];
      let after = null;   // what a hit leaves: [name, HIT_CONDITIONS entry]
      // the coating on the weapon, for its ten turns
      const coat = left && weapon && side.coat && n <= 10 ? side.coat.fx : null;
      if (coat) { m.attack = coat.attack || 0; m.damage = coat.damage || 0; m.magical = !!coat.magical; }
      // a special arrow, while there are any
      const arrow = left && ranged && side.arrow && left.arrows > 0 ? side.arrow : null;
      const afx = arrow && (!arrow.fx.double || enemyIs(f.target, arrow.fx.double)) ? arrow.fx : null;
      if (afx) { left.arrows--; how.push(arrow.name); }
      if (afx && afx.blast) {
        // it explodes in place of the weapon damage: every enemy near saves against it
        T.alive().forEach((y) => {
          const save = { key: afx.save.key, bonus: y.target.saves[afx.save.key] || 0, dc: afx.save.dc };
          const thrown = throwSave(save, T.mods(y, false));
          const out2 = afx.blast.map(([dice, type]) => saveLine(arrow.name, save, { dice, flat: 0, type, f: typeFactor(y.target, type, true), kept: afx.kept }, thrown));
          out2.forEach((l) => { l.how = part.how; });
          land(out2, y, false);
        });
        R.attacked = true;
        continue;
      }
      if (afx && afx.double) m.double = true;
      // Precision Attack adds the Superiority Die to the attack roll; Feinting Attack gives Advantage
      const h = left && side.hit && (side.hit.every || !R.man) ? side.hit : null;
      if (h && h.name === 'Precision Attack' && weapon && left.dice > 0) { left.dice--; R.man++; m.dice = m.dice.concat(side.die); how.push('Precision Attack'); }
      const feint = h && h.name === 'Feinting Attack' && near && weapon && left.dice > 0 && !R.bonus && !R.man;
      if (feint) { m.adv = true; how.push('Feinting Attack'); }
      m.onHit = (line) => {
        const add = [];
        // Divine Smite: a spell slot for 2d8 Radiant and more, on a melee weapon hit
        if (side.smite && left && near && weapon && (side.smite.when === 'all' || line.crit)) {
          const lv = takeAnySlot(left, side.smite.low);
          if (lv) add.push([smiteDice(st, f.target, lv), 'Radiant', 'Divine Smite (' + t('level {n} slot', { n: lv }) + ')']);
          else if (!fight.noSmite) { fight.noSmite = true; note(t('No spell slot left for Divine Smite.')); }
        }
        // a manoeuvre: the Superiority Die on the damage, and what it may leave on the target
        if (h && HIT_MANOEUVRES.includes(h.name) && weapon && left.dice > 0) { left.dice--; R.man++; add.push([side.die, '', h.name]); after = h.name; }
        if (feint) { left.dice--; R.man++; R.bonus = true; add.push([side.die, '', 'Feinting Attack']); }
        // Stunning Strike: a Ki Point on a melee hit
        if (h && h.name === 'Stunning Strike' && near && left.ki > 0) { left.ki--; R.man++; after = h.name; how.push('Stunning Strike'); }
        if (afx && afx.plus) add.push([afx.plus[0], afx.plus[1], arrow.name]);
        if (more) add.push(more);
        return add;
      };
      // Sneak Attack, once a turn, needs Advantage on the attack, or an ally next to the target and no Disadvantage
      const flank = enc.sides.length > 1 ? enc.sides.some((y, k) => k !== i && y.front && !enc.fights[k].down) : enc.opts.ally !== false;
      m.turnDice = !R.sneaked && (!enc.live || (!m.dis && (st.advantage || m.adv || flank)));
      const line = rollWeapon(st, row, f.target, riders(), m);
      T.spend(m, f);
      line.how = how.join(' · ');
      if (line.crit) R.crits++;
      if (line.turnDice) R.sneaked = true;
      // damage with a weapon attack keeps Arcane Acuity up, with the gear that says so
      if (left && line.hit && line.damage > 0 && side.acu.weapon) fight.acuity = Math.min(10, (fight.acuity || 0) + side.acu.weapon);
      const all = [line];
      if (line.hit) {
        // what the hit leaves, by the target's save against the weapon action DC
        const cond = after && HIT_CONDITIONS[after];
        if (cond && condFx(cond[0]) && !f.conds.some((c) => c.name === cond[0])) {
          let failed = true;
          if (cond[2]) {
            const save = { key: cond[2], bonus: f.target.saves[cond[2]] || 0, dc: side.weaponDc };
            const thrown = throwSave(save, m, condFx(cond[0]).skip && cond[0] !== 'Prone' ? 'stun' : '');
            all.push({ name: after, kind: 'save', ab: cond[2].toUpperCase(), d20: thrown.d20, auto: !!thrown.auto, legend: !!thrown.legend, bonus: save.bonus, against: save.dc, passed: thrown.passed, kept: 0, damage: 0, cond: true, text: thrown.passed ? '' : cond[0] });
            failed = !thrown.passed;
          }
          if (failed) { const c = addCond(f, cond[0], cond[1], fight, null); note(t('{who} is {cond} for {n} turn(s).', { who: f.name || t('The enemy'), cond: cond[0], n: c.left })); }
        }
        // an arrow that bursts: the target saves against the burst
        if (afx && afx.extra) {
          const save = { key: afx.save.key, bonus: f.target.saves[afx.save.key] || 0, dc: afx.save.dc };
          all.push(saveLine(arrow.name, save, { dice: afx.extra[0], flat: 0, type: afx.extra[1], f: typeFactor(f.target, afx.extra[1], true), kept: afx.kept }, throwSave(save, m)));
        }
        // the coating: the save it asks, and what a failed one brings
        if (coat && (coat.save || coat.conds || coat.extra) && !((f.inoc[side.coat.name] || 0) >= enc.round)) {
          const save = coat.save ? { key: coat.save.key, bonus: f.target.saves[coat.save.key] || 0, dc: coat.save.dc } : null;
          const thrown = save ? throwSave(save, m) : { passed: false, d20: 0 };
          if (coat.extra) all.push(saveLine(side.coat.name, save || { key: 'con', bonus: 0, dc: 0 }, { dice: coat.extra[0], flat: 0, type: coat.extra[1], f: typeFactor(f.target, coat.extra[1], true), kept: coat.kept }, thrown));
          else if (coat.later) all.push(saveLine(side.coat.name, save, { dice: coat.later[0], flat: 0, type: coat.later[1], f: typeFactor(f.target, coat.later[1], true), kept: 0 }, thrown));
          else if (save) all.push({ name: side.coat.name, kind: 'save', ab: save.key.toUpperCase(), d20: thrown.d20, auto: !!thrown.auto, legend: !!thrown.legend, bonus: save.bonus, against: save.dc, passed: thrown.passed, kept: 0, damage: 0, cond: true, text: thrown.passed ? '' : (coat.conds || []).join(', ') });
          if (!thrown.passed) (coat.conds || []).filter((c) => !f.conds.some((y) => y.name === c)).forEach((c) => {
            const y = addCond(f, c, coat.until ? 99 : coat.turns, fight, coat.until && save ? { key: save.key, dc: save.dc } : null);
            if (coat.until && save) { y.rep = true; note(t('{who} is {cond} until it passes a {ab} save against DC {dc}, rolled at the end of each of its turns.', { who: f.name || t('The enemy'), cond: c, ab: save.key.toUpperCase(), dc: save.dc })); }
            else note(t('{who} is {cond} for {n} turn(s).', { who: f.name || t('The enemy'), cond: c, n: y.left }));
          });
          else if (save) f.inoc[side.coat.name] = enc.round + 2;  // a passed save leaves it Inoculated for 2 turns
        }
      }
      land(all, f, near);
      // an Arrow of Many Targets: half the damage to three others
      if (line.hit && afx && afx.many && T.many) T.alive().filter((y) => y !== f).slice(0, afx.many).forEach((y) => land([{ name: arrow.name, kind: 'auto', hit: true, damage: line.damage / 2, text: t('half of {n}', { n: tenth(line.damage) }) }], y, false));
    }
    if (left && part.spends === 'Action Surge') left.surge--;
    if (left && part.spends === 'Ki Points') left.ki--;
  };
  // an action spent on the weapon: the Attack action, or the attacks Action Surge or Haste allow; with no weapon,
  // the cantrip
  // (`less` attacks of it go to something else: Commander's Strike takes one)
  const weaponAct = (kind, less) => {
    const v = view();
    if (!v.plan) {
      if (v.cantrip && !raging) cast(v.cantrip.name);
      if (left && kind === 'surge') left.surge--;
      return;
    }
    const part = kind === 'main' || kind === 'blood' ? v.plan.parts[0] : v.plan.parts.find((x) => x.spends === (kind === 'surge' ? 'Action Surge' : 'Haste'));
    // (in Honour mode only Action Surge lets an action on top use Extra Attack: the one of Bloodlust is one attack)
    if (part) swing(Object.assign({}, part, kind === 'blood' ? { how: 'Elixir of Bloodlust', n: honourMode() ? 1 : part.n } : {}, less ? { n: Math.max(0, part.n - less) } : {}));
  };
  const meleeRow = () => ((view().st.attacks || {}).rows || []).find((r) => r.slot === 'meleeMain' && !r.thrown);
  // Commander's Strike: one attack of the Attack action, the bonus action and a Superiority Die, for an ally to make
  // a melee weapon attack with its reaction on its next turn, with the die on its damage. True when it was given.
  const command = () => {
    const k = side.cmd ? enc.sides.findIndex((y, j) => j !== i && y.b && y.b.id === side.cmd) : -1;
    if (!left || k < 0 || enc.fights[k].down || enc.fights[k].onus || R.bonus || left.dice < 1 || !view().plan) return false;
    left.dice--;
    R.bonus = true;
    enc.fights[k].onus = { die: side.die, by: side.name };
    did.push("Commander's Strike");
    note(t('Commander\'s Strike: {who} strikes on its next turn, with its reaction.', { who: enc.sides[k].name }));
    return true;
  };
  // Sweeping Attack: the action and a Superiority Die for one attack roll on every enemy in reach, each dealing the
  // die alone; the other attacks of the Attack action follow
  const sweep = () => {
    const row = meleeRow();
    if (!row || !view().plan || !opts.has('Sweeping Attack') || (left && left.dice < 1)) return false;
    if (left) left.dice--;
    did.push('Sweeping Attack');
    T.alive().forEach((f) => {
      const m = T.mods(f, true);
      const line = rollWeapon(view(f.target).st, Object.assign({}, row, { name: 'Sweeping Attack', dice: side.die, damage: [], damageTotal: 0, extraDice: [] }), f.target, [], m);
      T.spend(m, f);
      land([line], f, true);
    });
    const part = view().plan.parts[0];
    if (part.n > 1 && !R.stop) swing(Object.assign({}, part, { n: part.n - 1 }));
    return true;
  };
  // an action that goes to a spell, falling back on what the build does at will
  const spellAct = (name, kind) => {
    if (cast(name)) { if (left && kind === 'surge') left.surge--; return name; }
    const v = view();
    if (kind === 'main' && v.plan && v.cantrip && !raging && v.cantrip.total > v.plan.total) cast(v.cantrip.name); else weaponAct(kind);
    return 'weapon';
  };
  const bonusAttack = () => { const p = view().plan; const part = p && p.parts.find((x) => x.bonus); if (part && (part.chance == null || R.crits || R.kills)) swing(part); };
  // what an action goes to when it is none of the weapon or a damaging spell: true when it was done
  const special = (want) => {
    if (want === 'Haste' || want.indexOf('Haste>') === 0) return side.haste ? castHaste(want.slice(6)) : false;
    if (want === 'Bless') return castBless();
    if (want === 'Sweeping Attack') return sweep();
    if (side.wards.some((w) => w.name === want)) return castWard(want);
    if (side.controls.some((c) => c.name === want)) return castControl(want);
    if (view().riders.has(want)) return castRider(want);
    return null;  // not one of these
  };

  if (!R.lost && T.focus()) {
    // the bonus action comes first when it sets something up for the attacks
    if (!R.bonus && view().riders.has(wantQ) && view().riders.get(wantQ).sp.a === 'bonus') R.bonus = castRider(wantQ);
    let went = '';  // what the action went to: the weapon, or a spell that can be cast again
    const acts = !surprised && wantA !== 'none';
    // Help: the action goes to an ally that is Downed, who is back on its feet with 1 hit point
    let helped = false;
    if (acts && left && side.helps && fallen().length) {
      const k = fallen()[0];
      standUp(enc.fights[k], 1);
      helped = true;
      did.push('Help');
      note(t('Help: {who} is back up, with 1 hit point.', { who: enc.sides[k].name }));
    }
    if (!R.stop && acts && !helped) {
      if (wantA === 'weapon') { weaponAct('main', command() ? 1 : 0); went = 'weapon'; }
      else {
        const sp = special(wantA);
        if (sp === false) { weaponAct('main'); went = 'weapon'; }
        else if (sp === null) went = spellAct(wantA, 'main');
      }
      // Dread Ambusher: on the first turn of the fight, one more weapon attack with 1d8 on top
      if (enc.live && n === 1 && went === 'weapon' && gains.includes('Dread Ambusher') && view().plan && !R.stop && T.focus()) swing(Object.assign({}, view().plan.parts[0], { n: 1, how: 'Dread Ambusher' }), ['1d8', '', 'Dread Ambusher']);
    }
    // the attack an ally's Commander's Strike gave: one melee weapon attack, with the reaction
    if (fight.onus && !R.reacted && !R.stop && T.focus() && meleeRow()) {
      const onus = fight.onus;
      fight.onus = null;
      R.reacted = true;
      swing({ row: meleeRow(), n: 1, how: "Commander's Strike" }, [onus.die, '', "Commander's Strike"]);
    }
    // the actions on top: Action Surge (once a Short Rest, when switched on), the one Haste gives, and the one a
    // kill gives with an Elixir of Bloodlust
    const extras = [];
    if (T.onNow().includes('surge') && (side.stats.fighter || 0) >= 2) extras.push('surge');
    // (on the turn Haste is cast, only when the page is set to count its action from that turn)
    const hasted = has('haste');
    if ((hasted && (hasted.from !== n || side.hasteNow)) || (!left && base.includes('haste'))) extras.push('haste');
    const onTop = (kind) => {
      if (R.stop || !acts || wantX === 'none' || !T.focus()) return;
      const want = wantX === 'same' ? went || 'weapon' : wantX;
      const settled = view().spells.get(want);
      if (want === 'weapon' || !settled || (settled.setup && named(want))) weaponAct(kind); else spellAct(want, kind);
    };
    extras.forEach(onTop);
    if (left && side.brew.blood && R.kills && !R.blood) { R.blood = true; fight.temp = Math.max(fight.temp, side.brew.blood); note(t('Elixir of Bloodlust: a kill gives {n} temporary hit points and one more action.', { n: side.brew.blood })); onTop('blood'); }
    if (!R.stop && !R.bonus && wantQ !== 'none' && T.focus()) {
      if (wantQ.indexOf('quick:') === 0) { if (!(opts.has('Quickened Spell') && cast(wantQ.slice(6), true))) bonusAttack(); }
      else if (view().spells.has(wantQ) && view().spells.get(wantQ).sp.a === 'bonus') { if (!cast(wantQ)) bonusAttack(); }
      else if (side.controls.some((c) => c.name === wantQ && c.sp.a === 'bonus')) { if (!castControl(wantQ)) bonusAttack(); }
      else bonusAttack();
    }
  }
  return done();
}

// One turn of an enemy in a fight: what it does to a build with its action and its bonus action, and its
// movement. { who, kind: 'foe', name, lines, notes, total }
function foeTurn(enc, j) {
  const f = enc.foes[j];
  if (f.dead) return null;
  const move = f.move;
  const out = { who: j, kind: 'foe', title: f.name || t('The enemy'), name: '', lines: [], notes: [], total: 0 };
  const note = (text) => { if (!out.notes.includes(text)) out.notes.push(text); };
  condStart(f, note);
  condSource(f, enc.fights);
  // what it regains at the start of its turn (Vampire Regeneration), unless Radiant damage reached it since its last one
  if (f.pv.rg && f.dealt > 0 && !f.radiant) { f.dealt = Math.max(0, f.dealt - f.pv.rg); note(t('{who} regains {n} hit points.', { who: out.title, n: f.pv.rg })); }
  f.radiant = false;
  const held = f.conds.find((c) => c.f.skip);
  const idle = !!held || !!f.surprised;
  if (held) note(t('{who} is {cond}: no action this turn.', { who: out.title, cond: held.name }));
  else if (f.surprised) note(t('{who} is Surprised: no action and no reaction in the first round.', { who: out.title }));
  // whom it goes for, among the builds still standing
  const standing = () => enc.fights.map((x, k) => k).filter((k) => !enc.fights[k].down && enc.fights[k].left);
  // (a melee attack goes for those who stand next to it, while any of them is up)
  const pick = (melee) => {
    let list = standing();
    if (!list.length) return -1;
    const front = list.filter((k) => enc.sides[k].front);
    if (melee && front.length) list = front;
    if (enc.opts.aim === 'first' || list.length === 1) return list[0];
    if (enc.opts.aim === 'weakest') return list.slice().sort((a, b) => enc.fights[a].hp - enc.fights[b].hp)[0];
    return list[Math.floor(simRandom() * list.length)];
  };
  let vi = pick(!!move.melee);
  let T = vi >= 0 ? turnTools(enc, vi, out) : null;
  if (T && !idle && (move.attacks || move.extra || move.smart)) {
    T.R.hurtNow = 0;
    T.R.missNow = 0;
    // whether it can pay for an action: a spell slot of its own, one of its uses in the fight
    // (`peek` only asks, and takes nothing)
    const spend = (act, peek) => {
      let lv = 0;
      if (act.slot) {
        if (f.slots === undefined) f.slots = move.slots ? Object.assign({}, move.slots) : null;
        lv = f.slots ? Object.keys(f.slots).map(Number).sort((x, y) => x - y).find((k) => k >= act.slot && f.slots[k] > 0) : 0;
        if (f.slots && !lv) return false;
      }
      const used = f.used || (f.used = {});
      if (act.uses && (used[act.label] || 0) >= act.uses) return false;
      if (peek) return true;
      if (lv) f.slots[lv]--;
      if (act.uses) used[act.label] = (used[act.label] || 0) + 1;
      return true;
    };
    // from Tactician up an enemy tries to finish off whoever it has downed (the wiki's Difficulty page): one blow on
    // a Downed member is a failed death saving throw, and then it turns to someone else
    const finish = (V, act) => {
      const d = V.fight.death || (V.fight.death = { ok: 0, bad: 0 });
      d.bad++;
      V.fight.struck = enc.round;
      out.lines.push({ name: f.name || t('The enemy'), how: (act.label || t('melee attack')) + ' · ' + t('on a Downed member'), kind: 'foe', mode: 'h', on: V.side.name, hit: true, damage: 0, taken: 0, text: '', finish: true });
      if (d.bad >= 3) { V.fight.dead = true; note(t('{who} dies.', { who: V.side.name })); }
      else note(t('{who}: a blow while Downed is a failed death saving throw ({bad} failed).', { who: V.side.name, bad: d.bad }));
    };
    const blows = (act, times) => {
      for (let k = 0; k < times && !f.dead; k++) {
        if (T.fight.down) {
          if (enc.live && enc.sides.length > 1 && gameMode() !== 'balanced' && !T.fight.dead && act.kind !== 'e' && T.fight.struck !== enc.round) { finish(T, act); continue; }
          answer();
          vi = pick(!!act.melee);
          if (vi < 0) return;
          T = turnTools(enc, vi, out);
          T.R.hurtNow = 0;
          T.R.missNow = 0;
        }
        T.strike(act, k, f);
        // an action with an area catches everyone who stands in the same line as the one it is aimed at
        if (act.area) standing().filter((j) => j !== vi && enc.sides[j].front === enc.sides[vi].front).forEach((j) => turnTools(enc, j, out).strike(act, k, f));
      }
    };
    // the reaction of the build it struck, when Shield or Uncanny Dodge did not take it
    function answer() {
      const { side, fight, left, R } = T;
      if (fight.down || f.dead) return;
      const v = T.view(f.target);
      if (side.react === 'Riposte') {
        if (!R.reacted && R.missNow > 0 && v.riposte && left.dice > 0) {
          left.dice--;
          R.reacted = true;
          // weapon damage and the superiority die: 1d8, 1d10 with Improved Combat Superiority (the wiki's Riposte page)
          const m = T.mods(f, true);
          const line = rollWeapon(v.st, Object.assign({}, v.riposte, { extraDice: [...(v.riposte.extraDice || []), [side.die, '', 'Riposte']] }), f.target, T.riders(), m);
          T.spend(m, f);
          Object.assign(line, { name: 'Riposte', how: t('reaction') });
          T.R.answering = true;
          T.land([line], f, true);
          T.R.answering = false;
        }
      } else if (side.react && !R.reacted && R.hurtNow > 0 && v.reacts.has(side.react)) {
        const x = v.reacts.get(side.react);
        if (T.pay(x, 0, true)) {
          R.reacted = true;
          const back = rollSpell(v.st, x, f.target, [], T.mods(f, false));
          back.forEach((l) => { l.how = t('reaction'); });
          T.R.answering = true;
          T.land(back, f, false);
          T.R.answering = false;
        } else if (!fight.noReact) { fight.noReact = true; T.note(t('Nothing left to pay for {spell}: no more reactions with it.', { spell: x.name })); }
      }
    }
    // its action: the one chosen while its spell slot and its uses last, else the one it always has
    let act = move;
    let times = move.attacks;
    // (an action is gone once so much damage is dealt to it: a Coin Whip, with the vambrace it comes from)
    const open = (a) => !a.ud || f.dealt < a.ud;
    if (move.smart) {
      // nothing chosen: the strongest of its actions that it can pay for this turn
      act = move.smart.find((a) => open(a) && spend(a, true)) || null;
      if (act) spend(act);
      times = act ? act.hits.length : 0;
    } else if (times && (!open(move) || !spend(move))) {
      act = move.fallback;
      times = act ? act.hits.length : 0;
      if (!f.out) { f.out = true; note(act ? t('{who} has no more of {a}: it goes on with {b}.', { who: f.name, a: move.label, b: act.label }) : t('{who} has no more of {a}.', { who: f.name, a: move.label })); }
    }
    if (act) blows(act, times);
    // its bonus action: the one chosen; else, with nothing chosen, it heals itself once it has lost that much, or
    // uses the strongest one it can pay for
    const sb = move.smartBonus;
    const extra = sb ? (sb.heal && f.dealt >= sb.worth && spend(sb.heal, true) ? sb.heal : sb.hits.find((a) => open(a) && spend(a, true)) || null) : move.extra && open(move.extra) ? move.extra : null;
    if (!f.dead && vi >= 0 && extra && spend(extra)) blows(extra, extra.hits.length);
    if (vi >= 0) answer();
  }
  // damage that waits for the enemy to move: once when it moves at all (Booming Blade), or for every 1.5 m it
  // walks through an area (Spike Growth; half the distance where the area is Difficult Terrain)
  const stuck = idle || condHas(f, 'still');  // Frightened, Restrained, held: it cannot move
  if (!f.dead) enc.fights.forEach((fight, k) => {
    if (!fight.left) return;
    const mine = (e) => e.kind === 'later' && (!e.foe || e.foe === f);
    const sink = turnTools(enc, k, out);
    fight.effects.filter((e) => mine(e) && e.later.some((p) => p.when === 'moves')).forEach((e) => {
      if (move.steps > 0 && !stuck) { const dealt = rollLater(e, 'moves'); dealt.forEach((l) => { l.how = t('when it moves'); }); sink.R.answering = true; sink.land(dealt, f, false); sink.R.answering = false; }
      sink.drop([e]);
    });
    fight.effects.filter((e) => mine(e) && e.later.some((p) => p.when === 'walks')).forEach((e) => {
      const walked = stuck ? 0 : e.later.some((p) => p.halved) ? Math.floor(move.steps / 2) : move.steps;
      for (let s = 0; s < walked && !f.dead; s++) { const dealt = rollLater(e, 'walks'); dealt.forEach((l) => { l.how = t('1.5 m walked'); }); sink.R.answering = true; sink.land(dealt, f, false); sink.R.answering = false; }
    });
  });
  // the end of its turn: its conditions count down, and the ones it caused on the builds
  condEnd(f, (key) => (f.target.saves || {})[key] || 0, note, enc.fights);
  f.acted = true;
  out.total = out.lines.reduce((a, x) => a + (x.damage || 0), 0);
  return out;
}
// The end of a round: Rage ends early for a build that made no attack and took no damage; Surprise is over.
function endRound(enc, last) {
  enc.fights.forEach((fight, i) => {
    if (!fight.left) return;
    const rage = fight.effects.find((e) => e.kind === 'rage');
    if (rage && !fight.down && !fight.round.attacked && !fight.round.hurt) {
      dropEffects(enc, fight, [rage]);
      if (last) last.notes.push(enc.sides.length > 1 ? t('{who}: Rage ends early, no attack made and no damage taken this turn.', { who: enc.sides[i].name }) : t('Rage ends early: no attack made and no damage taken this turn.'));
    }
    fight.round.attacked = false;
    fight.round.hurt = 0;
    fight.surprised = false;
  });
  enc.foes.forEach((f) => { f.surprised = false; f.reacted = false; f.parried = false; });
}
// One round of a fight, in Initiative order: { n, entries: [turn], total }
function encRound(enc) {
  if (!enc.order) {
    enc.order = rollInitiative(enc);
    // who is Surprised cannot act or react in the first round; a build that cannot be Surprised is not
    // (an enemy with Alert is never Surprised)
    if (enc.opts.surprise === 'foes') enc.foes.forEach((f) => { f.surprised = !f.pv.al; });
    if (enc.opts.surprise === 'party') enc.fights.forEach((fight, i) => { fight.surprised = !enc.sides[i].wary; });
  }
  enc.round++;
  const entries = [];
  enc.order.forEach(([kind, i]) => {
    if (encOver(enc)) return;
    const e = kind === 'side' ? buildTurn(enc, i) : foeTurn(enc, i);
    if (e && (kind === 'side' || e.lines.length || e.notes.length)) entries.push(e);
  });
  endRound(enc, entries[entries.length - 1]);
  return { n: enc.round, entries, total: entries.reduce((a, e) => a + e.total, 0) };
}
// One turn of a build alone against the enemy of its side, the build first and the enemy after it:
// { n, name, lines, total, notes }. The fight keeps what the build did to that enemy in `dealt`.
function fightTurn(side, fight) {
  const enc = fight.enc || (fight.enc = { round: 0, sides: [side], fights: [fight], foes: [foeState(side.foe, side.target, 0)], opts: { first: 'party', surprise: '', aim: 'first', focus: 'main' }, order: [], init: [] });
  enc.foes[0].move = side.foe;  // (the page and the tests may change it between two turns)
  fight.round = fight.round || newRound();
  fight.conds = fight.conds || [];
  enc.round++;
  const mine = buildTurn(enc, 0);
  const theirs = fight.left ? foeTurn(enc, 0) : null;
  const lines = mine.lines.concat(theirs ? theirs.lines : []);
  const out = { n: fight.turn, name: mine.name, lines, total: lines.reduce((a, x) => a + (x.damage || 0), 0), notes: mine.notes.concat(theirs ? theirs.notes : []) };
  endRound(enc, out);
  fight.dealt = enc.foes[0].dealt;
  return out;
}
// One turn the way the averages see it: `action` every turn ('' for the weapon), with `left` to spend (nothing
// runs out when it is null).
function simTurn(stats, style, target, action, left) {
  const side = sideOf(stats, style, target, [0, 1, 2, 3].map(() => ({ a: action || 'weapon', q: 'auto', x: 'same' })));
  return fightTurn(side, Object.assign(newFight(side, true), { left, hp: Infinity }));
}
// Many fights with a side's plan: the average damage of a turn and of the first turn, how many turns the enemy
// lasts in the fights the build wins (or, with no hit points to go by, the damage of ten turns), and in how many
// of the fights the build falls first.
function simFights(side, hp, count) {
  const per = [];
  const first = [];
  const main = [];
  let lost = 0;
  for (let k = 0; k < count; k++) {
    const fight = newFight(side);
    let turns = 0;
    while (!fight.down && (hp ? fight.dealt < hp && turns < 60 : turns < 10)) { const r = fightTurn(side, fight); if (!turns) first.push(r.total); turns++; }
    per.push(fight.dealt / turns);
    const won = !fight.down || (hp && fight.dealt >= hp);
    if (!won) lost++;
    if (!hp) main.push(fight.dealt); else if (won) main.push(turns);
  }
  const avg = (list) => list.reduce((a, x) => a + x, 0) / list.length;
  return { count, perTurn: avg(per), first: avg(first), lost: lost / count, main: main.length ? { avg: avg(main), min: Math.min(...main), max: Math.max(...main) } : null };
}
// Many fights of a whole setup, each made anew by `make()`: the average damage of a round and of the first one,
// in how many rounds the enemies fall in the fights won (or the damage of ten rounds, with no hit points to go
// by), how often the party falls first, and how often each member does; with the numbers of every fight kept for
// the chart (`perRound`, and `rounds` or `damage`).
function encFights(make, count) {
  const perRound = [];
  const first = [];
  const rounds = [];
  const damage = [];
  let lost = 0;
  let names = [];
  let downs = [];
  let dealt = [];
  for (let k = 0; k < count; k++) {
    const enc = make();
    const mortal = enc.foes.some((f) => isFinite(f.hp));
    let total = 0;
    while (!encOver(enc) && (mortal ? enc.round < 60 : enc.round < 10)) { const r = encRound(enc); if (enc.round === 1) first.push(r.total); total += r.total; }
    perRound.push(total / Math.max(1, enc.round));
    if (encLost(enc) && !encWon(enc)) lost++;
    if (!mortal) damage.push(total); else if (encWon(enc)) rounds.push(enc.round);
    if (!k) { names = enc.sides.map((s) => s.name); downs = enc.sides.map(() => 0); dealt = enc.sides.map(() => 0); }
    enc.fights.forEach((f, i) => { if (f.fell || f.down) downs[i]++; dealt[i] += f.dealt / Math.max(1, enc.round); });
  }
  const avg = (list) => (list.length ? list.reduce((a, x) => a + x, 0) / list.length : 0);
  const main = rounds.length ? rounds : damage;
  return { count, perTurn: avg(perRound), first: avg(first), lost: lost / count, main: main.length ? { avg: avg(main), min: Math.min(...main), max: Math.max(...main) } : null,
    perRound, rounds, damage, members: names.map((name, i) => ({ name, down: downs[i] / count, perTurn: dealt[i] / count })) };
}
