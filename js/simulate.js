// Damage test: the dice of a turn, rolled. The page takes the build on screen with the enemy and the switches of
// Final numbers, and rolls what damage.js works out on average: every attack roll, saving throw and damage die,
// turn after turn, spending the spell slots and the other things that run out. Nothing here is saved.
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
// The damage of one roll as text: "1d8 (5) + 3 = 8 Slashing", and what is left of it after a resistance.
function damageBits(bits, raw, dealt) {
  const text = bits.map((x, i) => (i ? '+ ' : '') + x).join(' ');
  return text + ' = ' + tenth(raw) + (Math.abs(raw - dealt) > 0.001 ? ' → ' + tenth(dealt) : '');
}

// One weapon attack: the d20 against the Armour Class (a natural 1 misses, the critical threshold always hits),
// then every damage die, rolled twice on a critical hit.
function rollWeapon(stats, row, target) {
  const d20 = rollD20(stats.advantage ? 1 : 0);
  const bonus = row.attackTotal + (row.attackDice || []).reduce((a, x) => a + rollDice(x).sum, 0);
  const crit = d20 >= stats.crit;
  const hit = d20 !== 1 && (crit || d20 + bonus >= target.ac);
  const line = { name: row.name, kind: 'attack', d20, bonus, against: target.ac, hit, crit: hit && crit, damage: 0, text: '' };
  if (!hit) return line;
  const magical = rowMagical(stats, row);
  const bits = [];
  let raw = 0;
  [[row.dice, row.type], ...(row.extraDice || [])].forEach(([dice, type]) => {
    if (!dice) return;
    const r = rollDice(dice, crit);
    const f = typeFactor(target, type || row.type, magical);
    raw += r.sum;
    line.damage += r.sum * f;
    bits.push(r.rolls.length ? `${r.rolls.length}d${/d(\d+)/.exec(dice)[1]} (${r.rolls.join(', ')})${type && type !== row.type ? ' ' + type : ''}` : String(r.sum));
  });
  if (row.damageTotal) { raw += row.damageTotal; line.damage += row.damageTotal * typeFactor(target, row.type, magical); bits.push(String(row.damageTotal)); }
  line.text = damageBits(bits, raw, line.damage) + ' ' + row.type;
  return line;
}
// One cast of a spell, from the recipe spellDamage leaves: each part by attack roll, by the enemy's saving throw
// (one for each enemy, for all the parts) or with no roll.
function rollSpell(stats, x, target) {
  const r = x.recipe;
  const lines = [];
  const savePart = (part, save) => {
    const dice = rollDice(part.dice);
    const raw = dice.sum + part.flat;
    const dealt = raw * part.f * (save.passed ? part.kept : 1);
    return { name: x.name, kind: 'save', ab: r.save.key.toUpperCase(), d20: save.d20, bonus: r.save.bonus, against: r.save.dc, passed: save.passed, kept: part.kept, damage: dealt,
      text: damageBits([dice.rolls.length ? `${part.dice} (${dice.rolls.join(', ')})` : '', part.flat ? String(part.flat) : ''].filter(Boolean), raw, dealt) + ' ' + part.type };
  };
  const throwSave = () => { const d20 = rollD20(r.save.dis ? -1 : 0); return { d20, passed: d20 + r.save.bonus >= r.save.dc }; };
  if (r.weapon) {
    const line = rollWeapon(stats, r.weapon, target);
    line.name = x.name;
    lines.push(line);
    if (line.hit && r.save) { const save = throwSave(); r.parts.forEach((part) => lines.push(savePart(part, save))); }
    return lines;
  }
  for (let rep = 0; rep < r.repeat; rep++) {
    const saves = [];
    r.parts.forEach((part) => {
      for (let k = 0; k < part.times; k++) {
        if (part.mode === 'save') { saves[k] = saves[k] || throwSave(); lines.push(savePart(part, saves[k])); continue; }
        const d20 = part.mode === 'attack' ? rollD20(r.adv ? 1 : 0) : 0;
        const crit = part.mode === 'attack' && d20 >= r.crit;
        const hit = part.mode !== 'attack' || (d20 !== 1 && (crit || d20 + r.attack >= r.ac));
        const line = { name: x.name, kind: part.mode, d20, bonus: r.attack, against: r.ac, hit, crit: hit && crit, damage: 0, text: '' };
        if (hit) {
          const dice = rollDice(part.dice, crit);
          const raw = dice.sum + part.flat;
          line.damage = raw * part.f;
          line.text = damageBits([dice.rolls.length ? `${dice.rolls.length}d${/d(\d+)/.exec(part.dice)[1]} (${dice.rolls.join(', ')})` : '', part.flat ? String(part.flat) : ''].filter(Boolean), raw, line.damage) + ' ' + part.type;
        }
        lines.push(line);
      }
    });
  }
  return lines;
}

// What a build starts a fight with, of the things that run out.
function simResources(stats) {
  const res = Object.fromEntries((stats.resources || []).map(([n, v]) => [n, Number(v) || 0]));
  return { slots: (stats.slots || []).slice(), pact: stats.pact ? stats.pact.n : 0, pactLevel: stats.pact ? stats.pact.level : 0,
    points: res['Sorcery Points'] || 0, ki: res['Ki Points'] || 0, surge: (stats.fighter || 0) >= 2 ? 1 : 0 };
}
// A slot for the cast: the lowest one that is enough, a Warlock spell from the pact slots first.
function takeSlot(left, x, spend) {
  const pact = () => { if (!(left.pact > 0 && left.pactLevel >= x.slot)) return false; if (spend) left.pact--; return true; };
  if (x.cls === 'Warlock' && pact()) return true;
  for (let i = x.slot - 1; i < left.slots.length; i++) if (left.slots[i] > 0) { if (spend) left.slots[i]--; return true; }
  return pact();
}
// One turn of the test: the spell chosen, or the weapon attacks, with what is left to spend (`left`; with none
// given, nothing runs out). { name, lines, total, notes }
function simTurn(stats, style, target, action, left) {
  const notes = [];
  let on = (stats.active || []).slice();
  if (left && on.includes('surge') && left.surge < 1) on = on.filter((k) => k !== 'surge');
  const without = new Set(left && left.ki < 1 ? ['Ki Points'] : []);
  let st = Object.assign({}, stats, { active: on });
  const plan = () => turnPlan(st, style, target, without);
  const find = (name) => { const p = plan(); return spellOptions(st, target, p ? p.parts[0].row : null).find((x) => x.name === name) || null; };
  let spell = action ? find(action) : null;
  if (spell && left) {
    if ((spell.points || 0) > left.points) {
      // Metamagic the Sorcery Points no longer pay for is left out
      on = on.filter((k) => !/^meta:/.test(k));
      st = Object.assign({}, stats, { active: on });
      spell = find(action);
      notes.push(t('No Sorcery Points left for the Metamagic.'));
    }
    if (spell && spell.slot && !takeSlot(left, spell, false)) {
      notes.push(t('No spell slot left for {spell}: the turn goes to what the build does at will.', { spell: action }));
      spell = null;
      action = '';
    }
  }
  // at will: the weapon attacks, or the cantrip when there is no weapon or the slots ran out and it does more
  if (!spell) {
    const best = bestTurn(st, style, target);
    if (best.cantrip && (!best.plan || (notes.length && best.cantrip.total > best.plan.total))) spell = best.cantrip;
  }
  const lines = [];
  if (spell) {
    lines.push(...rollSpell(st, spell, target));
    if (left) { if (spell.slot) takeSlot(left, spell, true); left.points -= spell.points || 0; }
  } else {
    const p = plan();
    let crits = 0;
    (p ? p.parts : []).forEach((part) => {
      // Great Weapon Master gives its attack only after a critical hit in the turn
      if (part.chance != null && !crits) return;
      const n = part.chance != null ? 1 : part.n;
      for (let k = 0; k < n; k++) {
        const line = rollWeapon(st, part.row, target);
        line.how = part.how;
        if (line.crit) crits++;
        lines.push(line);
      }
      if (left && part.spends === 'Action Surge') left.surge--;
      if (left && part.spends === 'Ki Points') left.ki--;
    });
  }
  return { name: spell ? spell.name : t('Weapon attacks'), lines, total: lines.reduce((a, x) => a + x.damage, 0), notes };
}

// ---------- the page ----------
let sim = { key: '', turns: [], left: null, dealt: 0, many: null };
// In Honour mode the enemy has its Honour hit points, or the Tactician ones when its page gives no others.
const enemyHp = (e) => (honourMode() ? e.hp.h || e.hp.t || e.hp.b : e.hp.b);
// Everything the test needs from the build on screen; a change in any of it starts the test over.
function simContext() {
  const b = curBuild();
  if (!b || !charLevel(b)) return null;
  const total = charLevel(b);
  const at = b.current && b.current < total ? b.current : 0;
  const stats = finalStats(b, state.ui.act, at ? { level: at } : null);
  const style = buildProfile(at ? atLevel(b, at) : b, state.ui.act).style;
  const target = targetOf();
  const plan = turnPlan(stats, style, target);
  const spells = spellOptions(stats, target, plan ? plan.parts[0].row : null);
  let action = state.ui.simAction || '';
  if (action && !spells.some((x) => x.name === action)) action = '';
  if (!action && !plan && spells.length) action = (spells.find((x) => !x.sp.lv) || spells[0]).name;
  const chosen = spells.find((x) => x.name === action) || null;
  const expected = chosen ? chosen.total : plan ? plan.total : 0;
  const hp = target.enemy ? enemyHp(target.enemy) : 0;
  const key = JSON.stringify([b.id, state.ui.act, at, target.name, target.ac, target.saves, action, b.active, honourMode(), state.ui.castLevel, state.ui.targets, tenth(expected * 100)]);
  if (sim.key !== key) sim = { key, turns: [], left: simResources(stats), dealt: 0, many: null };
  return { b, stats, style, target, plan, spells, action, chosen, expected, hp };
}
function simRun(ctx, n, untilDown) {
  for (let k = 0; k < n; k++) {
    if (ctx.hp && sim.dealt >= ctx.hp) break;
    const turn = simTurn(ctx.stats, ctx.style, ctx.target, ctx.action, sim.left);
    sim.dealt += turn.total;
    sim.turns.push(Object.assign(turn, { n: sim.turns.length + 1 }));
    if (!untilDown && k + 1 >= n) break;
  }
}
const SIM_SHOWN = 30;
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
  return `<li class="${good ? '' : 'off'}${x.crit ? ' crit' : ''}"><b>${esc(x.name)}</b>${x.how ? `<i>${esc(x.how)}</i>` : ''}<span>${esc(roll)}${out ? ` · <em>${esc(out)}</em>` : ''}</span>
    <span>${esc(x.text || '')}</span><strong>${tenth(x.damage)}</strong></li>`;
}
function renderDamage() {
  const b = curBuild();
  const ctx = simContext();
  const head = `<section class="card hero"><h1>${t('Damage test')}</h1>
    <p class="muted">${t('Rolls the dice of a turn against an enemy: every attack roll, saving throw and damage die, with the spell slots and the other resources running out as they are spent. It uses the build, the gear and the switches below; nothing rolled here is saved.')}</p>
    <div class="stat-tools">
      <div class="field"><span>${t('Build')}</span>${slotButton('sim-build-open', '', b ? b.name || t('Unnamed') : '', '', t('— choose —'))}</div>
      ${ctx ? `<div><span class="lbl">${t('With the gear of')}</span>${actTabs(state.ui.act, 'act')}</div>${targetTools()}` : ''}
    </div>
    ${ctx ? togglesRow(b) : ''}</section>`;
  if (!ctx) return `<div class="content wide sim">${head}<section class="card empty"><h2>${t('Choose a build with at least one level.')}</h2></section></div>`;
  const { stats, target, plan, spells, action, chosen, expected, hp } = ctx;
  const who = targetLabel(target);
  const turns = sim.turns;
  const down = hp && sim.dealt >= hp;
  const left = sim.left;
  const res = [
    left.slots.length ? t('Spell slots') + ' ' + left.slots.map((n, i) => `<span class="slot-n${n ? '' : ' out'}" title="${t('Level {n}', { n: i + 1 })}">${i + 1}<i>×${n}</i></span>`).join('') : '',
    left.pactLevel ? esc(t('Pact Magic slots')) + ' <b>' + left.pact + '</b>' : '',
    simResources(stats).points ? 'Sorcery Points <b>' + left.points + '</b>' : '',
    simResources(stats).ki ? 'Ki Points <b>' + left.ki + '</b>' : '',
    simResources(stats).surge ? 'Action Surge <b>' + left.surge + '</b>' : ''].filter(Boolean);
  const totals = turns.map((x) => x.total);
  const mean = turns.length ? sim.dealt / turns.length : 0;
  const box = (label, value, hint) => `<div class="stat"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const log = turns.slice(-SIM_SHOWN).reverse().map((x) => `<article class="sim-turn"><header><b>${t('Turn {n}', { n: x.n })}</b><span>${esc(x.name)}</span><strong>${tenth(x.total)}</strong></header>
    ${x.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}<ul>${x.lines.map(simLine).join('')}</ul></article>`).join('');
  return `<div class="content wide sim">${head}
    <section class="card">
      <div class="stat-tools">
        <div class="field"><span>${t('In each turn')}</span>${slotButton('sim-action-open', '', chosen ? chosen.name : plan ? t('Weapon attacks') : '', chosen ? pic(chosen.sp.i, 'pic small') : '', t('— nothing to roll —'))}</div>
        ${castTools(stats, spells)}
      </div>
      <p class="turn"><b>${expected.toFixed(1)}</b>${t('expected on average in a turn against {who}', { who: esc(who) })}${chosen ? ': ' + esc(chosen.text + ' · ' + chosen.how) : plan ? ': ' + plan.parts.map((x) =>
        `${x.chance != null ? Math.round(x.chance * 100) + '%' : x.n} × ${esc(x.row.name)} (${esc(x.how)})`).join(' + ') : ''}</p>
      ${hp ? `<div class="hpbar${down ? ' down' : ''}"><i style="width:${Math.max(0, 100 - sim.dealt / hp * 100).toFixed(1)}%"></i><span>${esc(who)} · ${t('{left} of {hp} hit points', { left: tenth(Math.max(0, hp - sim.dealt)), hp })}</span></div>` : ''}
      ${down ? `<p class="sim-down">${t('{who} falls in turn {n}.', { who: esc(who), n: turns.length })}</p>` : ''}
      <div class="row-btns sim-btns">
        <button class="btn primary" data-act="sim-roll" data-n="1"${down || !expected ? ' disabled' : ''}>${t('Roll a turn')}</button>
        <button class="btn" data-act="sim-roll" data-n="10"${down || !expected ? ' disabled' : ''}>${t('Roll 10 turns')}</button>
        ${hp ? `<button class="btn" data-act="sim-roll" data-n="kill"${down || !expected ? ' disabled' : ''}>${t('Roll until it falls')}</button>` : ''}
        <button class="btn" data-act="sim-many"${expected ? '' : ' disabled'} title="${t('Rolls 1,000 turns with nothing running out, to compare with the expected average.')}">${t('Average of 1,000 turns')}</button>
        <button class="btn" data-act="sim-rest" data-k="short" title="${t('Pact Magic slots, Ki Points and Action Surge come back.')}">Short Rest</button>
        <button class="btn" data-act="sim-rest" data-k="long" title="${t('Everything comes back.')}">Long Rest</button>
        <button class="btn" data-act="sim-reset"${turns.length || sim.many ? '' : ' disabled'}>${t('Start over')}</button>
      </div>
      ${res.length ? `<p class="points sim-res"><b>${t('Left to spend')}</b> ${res.join(' · ')}</p>` : ''}
      ${sim.many ? `<p class="turn"><b>${sim.many.avg.toFixed(1)}</b>${t('average of {n} turns rolled, from {min} to {max} · expected {x}', { n: sim.many.n, min: tenth(sim.many.min), max: tenth(sim.many.max), x: expected.toFixed(1) })}</p>` : ''}
      ${turns.length ? `<div class="stat-row">${box(t('Turns'), turns.length)}${box(t('Total damage'), tenth(sim.dealt))}${box(t('Average a turn'), mean.toFixed(1), t('expected {x}', { x: expected.toFixed(1) }))}
        ${box(t('Best turn'), tenth(Math.max(...totals)))}${box(t('Worst turn'), tenth(Math.min(...totals)))}</div>
        <div class="sim-log">${log}</div>${turns.length > SIM_SHOWN ? `<p class="muted">${t('The last {n} turns are shown.', { n: SIM_SHOWN })}</p>` : ''}`
    : `<p class="muted">${t('Nothing rolled yet. A change in the build, the enemy or what is done in the turn starts the test over.')}</p>`}
      <p class="muted">${t('Resistance halves and vulnerability doubles each roll as it is, without rounding, so the rolled average meets the expected one.')}</p>
    </section>
  </div>`;
}

Object.assign(actions, {
  'sim-roll'(el) {
    const ctx = simContext();
    if (!ctx) return;
    if (el.dataset.n === 'kill') simRun(ctx, 200, true); else simRun(ctx, Number(el.dataset.n) || 1);
  },
  'sim-many'() {
    const ctx = simContext();
    if (!ctx) return;
    const n = 1000;
    const totals = Array.from({ length: n }, () => simTurn(ctx.stats, ctx.style, ctx.target, ctx.action, null).total);
    sim.many = { n, avg: totals.reduce((a, x) => a + x, 0) / n, min: Math.min(...totals), max: Math.max(...totals) };
  },
  'sim-rest'(el) {
    const ctx = simContext();
    if (!ctx) return;
    const full = simResources(ctx.stats);
    if (el.dataset.k === 'long') sim.left = full;
    else Object.assign(sim.left, { pact: full.pact, ki: full.ki, surge: full.surge });
  },
  'sim-reset'() { sim.key = ''; },
  'sim-build-open'() {
    const list = state.builds.filter((x) => charLevel(x));
    const ids = list.map((x) => x.id);
    // two builds of the same name are told apart by their place in the list
    const rows = list.map((x, i) => { const name = x.name || t('Unnamed'); const same = list.slice(0, i).filter((y) => (y.name || t('Unnamed')) === name).length; return [name + (same ? ' (' + (same + 1) + ')' : ''), splitText(x), '', '', '']; });
    const cur = curBuild();
    openChooser(t('Build'), t('The builds of My builds that have at least one level.'), [{ label: t('Build'), n: 1, min: 0, options: rows, chosen: cur && ids.includes(cur.id) ? [rows[ids.indexOf(cur.id)][0]] : [] }],
      (done) => { const i = rows.findIndex((r) => r[0] === done[0].chosen[0]); if (i >= 0) { state.ui.buildId = ids[i]; state.ui.wizard = ''; } });
    return false;
  },
  'sim-action-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const weapon = ctx.plan ? [[t('Weapon attacks'), ctx.plan.parts.map((x) => `${x.chance != null ? Math.round(x.chance * 100) + '%' : x.n} × ${x.row.name} (${x.how})`).join(' + '),
      t('{n} a turn on average', { n: ctx.plan.total.toFixed(1) }), '', t('At will')]] : [];
    const rows = weapon.concat(ctx.spells.map((x) => [x.name, x.text + ' · ' + x.how, [t('{n} a turn on average', { n: x.total.toFixed(1) }), x.slot ? t('level {n} slot', { n: x.slot }) : t('at will'), x.points ? sorceryText(x.points) : ''].filter(Boolean).join(' · '),
      pic(x.sp.i, 'pic small'), x.slot ? t('Spells') : t('At will')]));
    openChooser(t('In each turn'), t('What the build does every turn of the test. A spell spends a slot each time; when none is left, the turn goes to what the build does at will.'),
      [{ label: t('In each turn'), n: 1, min: 0, options: rows, chosen: [ctx.chosen ? ctx.chosen.name : t('Weapon attacks')] }],
      (done) => { const name = done[0].chosen[0] || ''; state.ui.simAction = name === t('Weapon attacks') ? '' : name; });
    return false;
  },
});
