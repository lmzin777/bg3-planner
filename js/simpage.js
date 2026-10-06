// Damage test, the page: who fights, the enemy, the plan of turns and the result, each on its own tab. It takes
// the build on screen (or the party it belongs to) with the enemy and the switches of Final numbers, and has
// simulate.js roll the fight: round after round, or many fights at once with a chart of how they went. A setup
// can be kept by name, as a scenario, to come back to. Nothing rolled here is saved.
'use strict';

let sim = { key: '', enc: null, rounds: [], many: null };
const SIM_SHOWN = 20;
const SIM_FIGHTS = 300;
const SIM_TABS = [['build', 'Who fights'], ['enemy', 'The enemy'], ['plan', 'Plan of turns'], ['result', 'Result']];
// What a scenario keeps of the page (the plans and choices of each build are kept with it too).
const SCENE_KEYS = ['act', 'simParty', 'target', 'targetAc', 'targetSave', 'mode', 'castLevel', 'targets', 'foeAct', 'foeAct2', 'foeSlot', 'foeAttacks', 'foeBonus', 'foeDamage', 'foeSteps',
  'foeBroken', 'hasteNow', 'help0', 'help1', 'help2', 'helpN0', 'helpN1', 'helpN2', 'helpA0', 'helpA1', 'helpA2', 'simFirst', 'simSurprise', 'simAim', 'simFocus', 'simAlly', 'simLevel', 'foeReacts', 'simPotions', 'simB'];
const simTab = () => (SIM_TABS.some(([k]) => k === state.ui.simTab) ? state.ui.simTab : 'build');
const setHit = (b, patch) => { (state.ui.simHits || (state.ui.simHits = {}))[b.id] = Object.assign(simHits(b), patch); };
// The enemies that stand with the main one: up to three kinds, some of each, each kind with the action chosen
// for it (what it usually does, when none is).
const simHelpers = (target) => (target.enemy ? [0, 1, 2].map((i) => ({ i, e: ENEMY_BY_NAME.get(state.ui['help' + i]), n: Math.max(1, Math.min(6, Number(state.ui['helpN' + i]) || 1)), a: state.ui['helpA' + i] || '' })).filter((h) => h.e) : []);
const helperFoe = (h) => simFoe(enemyTarget(h.e), h.a ? { foeAct: h.a } : true);
// A fight of the page: the sides against the enemy chosen and its helpers, set up as the page says.
function simEncounter(sides, target, hp, helpers) {
  const foes = [foeState(sides[0].foe, target, hp)];
  helpers.forEach((h) => {
    const aim = enemyTarget(h.e);
    for (let k = 0; k < h.n; k++) foes.push(Object.assign(foeState(simFoe(aim, h.a ? { foeAct: h.a } : true), aim, enemyHp(h.e)), { name: h.e.n + (h.n > 1 ? ' ' + (k + 1) : '') }));
  });
  return newEncounter(sides, foes, { first: state.ui.simFirst || 'roll', surprise: state.ui.simSurprise || '', aim: state.ui.simAim || 'random', focus: state.ui.simFocus || 'main', ally: state.ui.simAlly !== false });
}
const sideKey = (side) => [side.b.id, side.act, side.at, side.b.active, side.steps, side.b.elixir, side.react, side.foe, side.hasteNow, side.ac, side.hp, side.heal && side.heal.value, side.potions, simHits(side.b),
  simBase(side).list.map((x) => x.total.toFixed(2)), simBase(side).plan ? simBase(side).plan.total.toFixed(2) : ''];
// The party chosen for the test, when the build on screen is one of its members: its builds that have a level.
function simMembers(b) {
  const party = state.parties.find((p) => p.id === state.ui.simParty);
  const list = party ? [...new Set(party.members.map((m) => buildById(m.buildId)).filter((x) => x && charLevel(x)))] : [];
  return { party, list, on: list.length > 1 && list.includes(b) };
}
// Everything the test needs from the build on screen; a change in any of it starts the test over.
function simContext() {
  const b = curBuild();
  if (!b || !charLevel(b)) return null;
  const target = targetOf();
  const side = simSide(b, state.ui.act, target);
  const team = simMembers(b);
  const sides = team.on ? team.list.map((m) => (m === b ? side : simSide(m, state.ui.act, target))) : [side];
  const helpers = simHelpers(target);
  const v = simBase(side);
  const sb = state.ui.simB;
  const ob = !team.on && sb && buildById(sb.id);
  const other = ob && charLevel(ob) && !(ob.id === b.id && (sb.act || state.ui.act) === state.ui.act) ? simSide(ob, sb.act || state.ui.act, target) : null;
  const hp = target.enemy ? enemyHp(target.enemy) : 0;
  const key = JSON.stringify([sides.map(sideKey), other ? sideKey(other) : '', target.name, target.ac, target.saves, gameMode(), state.ui.castLevel, state.ui.targets,
    helpers.map((h) => [h.e.n, h.n, h.a]), state.ui.simFirst, state.ui.simSurprise, state.ui.simAim, state.ui.simFocus, state.ui.simAlly, state.ui.simLevel, state.ui.foeReacts]);
  if (sim.key !== key) sim = { key, enc: simEncounter(sides, target, hp, helpers), rounds: [], many: null };
  const mainA = side.steps[3].a || atWill(v);
  const chosen = v.spells.get(mainA) || (!v.plan && mainA === 'weapon' ? v.cantrip : null);
  return { b, side, sides, team, helpers, other, v, target, hp, chosen, expected: chosen ? chosen.total : v.plan ? v.plan.total : 0, can: !!(v.plan || v.list.length) };
}
function simRun(ctx, n, untilOver) {
  for (let k = 0; k < n; k++) {
    if (encOver(sim.enc)) break;
    sim.rounds.push(encRound(sim.enc));
    if (!untilOver && k + 1 >= n) break;
  }
}
function simLine(x) {
  const sign = (n) => (n < 0 ? ' − ' + Math.abs(n) : ' + ' + n);
  let roll = '';
  let out = '';
  const save = () => (x.auto ? t('{ab} save failed by itself', { ab: x.ab }) : t('{ab} save {roll}{bonus} = {total} against DC {dc}', { ab: x.ab, roll: x.d20, bonus: sign(x.bonus), total: x.d20 + x.bonus, dc: x.against }));
  if (x.kind === 'foe') {
    // an attack of the enemy on a build: what it takes is shown apart, and is no damage dealt
    const who = `<b>${esc(x.name)}<i>${esc(x.how)}${x.on ? ' → ' + esc(x.on) : ''}</i></b>`;
    if (x.mode === 'e') return `<li class="foe">${who}<span>${t('heals itself')}</span><span>${esc(x.text)}</span><strong>+${tenth(x.healed)}</strong></li>`;
    const text = x.mode === 's' ? save() : x.mode === 'a' ? t('{roll}{bonus} = {total} against AC {ac}', { roll: x.d20, bonus: sign(x.bonus), total: x.d20 + x.bonus, ac: x.against }) : t('no roll');
    const end = x.mode === 's' ? (!x.passed ? t('failed') : x.cond ? t('passed') : x.kept === 1 ? t('passed, all the same') : x.kept ? t('passed: half') : t('passed: nothing'))
      : x.mode === 'a' ? (x.crit ? t('critical hit') : x.hit ? t('hit') : x.half ? t('miss: half the damage') : x.d20 === 1 ? t('natural 1: miss') : t('miss')) : '';
    const lands = x.taken > 0;
    if (x.finish) return `<li class="foe">${who}<span>${t('a failed death saving throw')}</span><span></span><strong></strong></li>`;
    return `<li class="foe${x.hit || lands ? '' : ' off'}">${who}<span>${esc(text)}${end ? ` · <em>${esc(end)}</em>` : ''}</span>
      <span>${lands ? esc(x.text) + ' ' + t('to the build') : ''}</span><strong>${lands ? '−' + tenth(x.taken) : ''}</strong></li>`;
  }
  if (x.kind === 'attack') {
    roll = t('{roll}{bonus} = {total} against AC {ac}', { roll: x.d20, bonus: sign(x.bonus), total: x.d20 + x.bonus, ac: x.against });
    out = x.crit ? t('critical hit') : x.hit ? t('hit') : x.d20 === 1 ? t('natural 1: miss') : t('miss');
  } else if (x.kind === 'save') {
    roll = save();
    out = (!x.passed ? t('failed') : x.cond ? t('passed') : x.kept === 1 ? t('passed, all the same') : x.kept ? t('passed: half') : t('passed: nothing')) + (x.legend ? ' · Legendary Resistance (+10)' : '');
  } else roll = t('no roll');
  const good = x.kind === 'save' ? !x.passed : x.hit;
  return `<li class="${good ? '' : 'off'}${x.crit ? ' crit' : ''}"><b>${esc(x.name)}${x.how || x.to ? `<i>${esc([x.how, x.to ? '→ ' + x.to : ''].filter(Boolean).join(' '))}</i>` : ''}</b><span>${esc(roll)}${out ? ` · <em>${esc(out)}</em>` : ''}</span>
    <span>${esc(x.text || '')}</span><strong>${x.cond ? '' : tenth(x.damage)}</strong></li>`;
}
// The choices of a field of the plan: [value, name, description, facts, picture, group].
function stepOptions(ctx, i, f) {
  const { v, side } = ctx;
  const opts = side.stats.options || new Set();
  const slotOf = (x) => (x.slot ? t('level {n} slot', { n: x.slot }) : t('at will'));
  const spell = (x, value, name) => [value, name || x.name, x.text + ' · ' + x.how, [t('{n} on average', { n: x.total.toFixed(1) }), slotOf(x), x.points ? sorceryText(x.points) : '',
    x.sp.co ? t('Concentration') : '', x.later ? t('then {x}', { x: x.later }) : '', (x.sp.cn || []).filter((c) => condFx(c[0])).map((c) => c[0]).join(', ')].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), x.slot ? t('Spells') : t('At will')];
  const rider = (x) => [x.name, x.name, x.sp.d || '', [dicePart(x.rider) + ' ' + t('on every hit'), x.slot ? t('level {n} slot', { n: x.slot }) : '', x.sp.du || '', x.sp.co ? t('Concentration') : ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), t('Sets up')];
  const control = (x) => [x.name, x.name, x.sp.d || '', [t('{ab} save, DC {dc}', { ab: x.key.toUpperCase(), dc: x.dc }), x.sp.cn.filter((c) => condFx(c[0])).map((c) => c[0] + (c[1] ? ' (' + c[1] + ')' : '')).join(', '),
    slotOf(x), x.sp.co ? t('Concentration') : ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), t('Control')];
  const out = i < 3 ? [['', t('As from turn 4 on'), '', '', '', '']] : [];
  if (f === 'x') {
    out.push(['same', t('The same as the action'), t('The weapon again, or the same spell once more while a slot is left.'), '', '', t('At will')]);
    if (v.plan) out.push(['weapon', t('Weapon attacks'), v.plan.parts[0].n + ' × ' + v.plan.parts[0].row.name + ' · ' + t('with Haste in Honour mode, one attack'), '', '', t('At will')]);
    v.list.filter((x) => x.sp.a === 'action').forEach((x) => out.push(spell(x, x.name)));
  } else if (f === 'a') {
    if (v.plan) out.push(['weapon', t('Weapon attacks'), v.plan.parts.filter((x) => !x.bonus).map((x) => `${x.n} × ${x.row.name} (${x.how})`).join(' + ') + (v.plan.once ? ' + ' + v.plan.once.label + ' (' + t('once a turn') + ')' : ''),
      t('{n} on average', { n: (v.plan.parts.filter((x) => !x.bonus).reduce((a, x) => a + x.n * x.each, 0) + (v.plan.once ? v.plan.once.total : 0)).toFixed(1) }), '', t('At will')]);
    else if (i === 3 && v.cantrip) out.push(['weapon', v.cantrip.name, v.cantrip.text + ' · ' + v.cantrip.how, t('{n} on average', { n: v.cantrip.total.toFixed(1) }), pic(v.cantrip.sp.i, 'pic small'), t('At will')]);
    v.list.filter((x) => x.sp.a === 'action' && !(i === 3 && !v.plan && x === v.cantrip)).forEach((x) => out.push(spell(x, x.name)));
    side.controls.filter((x) => x.sp.a === 'action').forEach((x) => out.push(control(x)));
    if (v.plan && opts.has('Sweeping Attack') && v.plan.parts[0].row.slot === 'meleeMain') out.push(['Sweeping Attack', 'Sweeping Attack', manoeuvreText('Sweeping Attack'),
      [t('one attack on every enemy in reach, each dealing {die} alone', { die: side.die }), t('then the other attacks of the Attack action'), 'Superiority Dice'].join(' · '), '', t('At will')]);
    (v.list.setups || []).filter((x) => x.sp.a === 'action').forEach((x) => out.push([x.name, x.name, x.sp.d || '', [x.text, x.slot ? t('level {n} slot', { n: x.slot }) : '', x.sp.du || ''].filter(Boolean).join(' · '), pic(x.sp.i, 'pic small'), t('Sets up')]));
    side.wards.forEach((w) => out.push([w.name, w.name, w.sp.d || '', [slotOf(w), w.sp.du || ''].filter(Boolean).join(' · '), pic(w.sp.i, 'pic small'), t('Sets up')]));
    if (side.haste) {
      const facts = [t('level {n} slot', { n: side.haste.slot }), side.haste.sp.du || '', t('Concentration')].join(' · ');
      out.push(['Haste', 'Haste', side.haste.sp.d || '', facts, pic(side.haste.sp.i, 'pic small'), t('Sets up')]);
      ctx.sides.filter((s) => s !== side).forEach((s) => out.push(['Haste>' + s.b.id, t('Haste on {who}', { who: s.name }), side.haste.sp.d || '', facts, pic(side.haste.sp.i, 'pic small'), t('Helps the party')]));
    }
    if (side.bless) out.push(['Bless', 'Bless', side.bless.sp.d || '', [t('level {n} slot', { n: side.bless.slot }), side.bless.sp.du || '', t('Concentration'), t('the caster and two more of the party')].join(' · '), pic(side.bless.sp.i, 'pic small'), t('Helps the party')]);
    [...v.riders.values()].filter((x) => x.sp.a === 'action').forEach((x) => out.push(rider(x)));
  } else {
    const part = v.plan && v.plan.parts.find((x) => x.bonus);
    out.push(['auto', t('The best it has'), part ? `${part.chance != null ? Math.round(part.chance * 100) + '%' : part.n} × ${part.row.name} (${part.how})` : t('The build has no attack for its bonus action.'), '', '', t('At will')]);
    v.list.filter((x) => x.sp.a === 'bonus').forEach((x) => out.push(spell(x, x.name)));
    side.controls.filter((x) => x.sp.a === 'bonus').forEach((x) => out.push(control(x)));
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
  const shield = ctx.side.shield;
  if (shield) out.push(['Shield', 'Shield', shield.sp.d || '', t('when an attack would hit by less than 5') + ' · ' + t('level {n} slot', { n: shield.slot }), pic(shield.sp.i, 'pic small')]);
  if (ctx.side.dodge) out.push(['Uncanny Dodge', 'Uncanny Dodge', featureText('Uncanny Dodge') || '', t('halves the first damage taken each round'), '']);
  return out;
}
// What the wiki says a manoeuvre does, as the choices of the class give it.
const manoeuvreText = (name) => (((CHOICES.find((c) => c.name === 'Manoeuvre') || { options: [] }).options.find((o) => o[0] === name) || [])[1] || '');
// What a build can do on a hit besides Divine Smite: the manoeuvres it chose and Stunning Strike, as
// [name, description, facts].
function hitOptions(side) {
  const st = side.stats;
  const texts = Object.fromEntries(((CHOICES.find((c) => c.name === 'Manoeuvre') || { options: [] }).options).map((o) => [o[0], o[1]]));
  const out = [];
  const cond = (name) => { const c = HIT_CONDITIONS[name]; return !c || !condFx(c[0]) ? '' : c[2] ? t('{ab} save, DC {dc}', { ab: c[2].toUpperCase(), dc: side.weaponDc }) + ': ' + c[0] : c[0]; };
  [...HIT_MANOEUVRES, 'Precision Attack', 'Feinting Attack'].filter((n) => (st.options || new Set()).has(n)).forEach((n) => out.push([n, texts[n] || '',
    [n === 'Precision Attack' ? t('{die} on the attack roll', { die: side.die }) : t('{die} on the damage of the hit', { die: side.die }), n === 'Feinting Attack' ? t('Advantage on the attack; takes the bonus action too') : '', cond(n), 'Superiority Dice'].filter(Boolean).join(' · ')]));
  if ((st.gains || []).includes('Stunning Strike')) out.push(['Stunning Strike', featureText('Stunning Strike') || '', [cond('Stunning Strike'), 'Ki Points'].join(' · ')]);
  return out;
}
const stepLabel = (ctx, i, f, value) => { const row = stepOptions(ctx, i, f).find((x) => x[0] === value); return row ? row : null; };
function simPlanHtml(ctx) {
  const names = [t('Turn {n}', { n: 1 }), t('Turn {n}', { n: 2 }), t('Turn {n}', { n: 3 }), t('From turn 4 on')];
  const on = ctx.side.stats.active || [];
  // the third field shows when the build can have a second action: Action Surge, Haste cast or switched on, an Elixir of Bloodlust
  const extra = (ctx.side.stats.fighter || 0) >= 2 || !!ctx.side.haste || on.includes('haste') || !!ctx.side.brew.blood || ctx.sides.some((s) => s !== ctx.side && s.haste);
  const cell = (i, f, label) => {
    const value = ctx.side.steps[i][f] || (i === 3 ? (f === 'a' ? atWill(ctx.v) : STEP_DEFAULT[f]) : '');
    const row = value ? stepLabel(ctx, i, f, value) : null;
    return `<div class="field"><span>${label}</span>${slotButton('sim-step-open', `data-i="${i}" data-f="${f}"`, row ? row[1] : '', row ? row[4] : '', i < 3 ? t('as from turn 4 on') : t('— choose —'))}</div>`;
  };
  return `<div class="sim-plan">${names.map((name, i) => `<div class="sim-step${extra ? ' three' : ''}"><b>${name}</b>${cell(i, 'a', t('Action'))}${extra ? cell(i, 'x', t('Action on top (Action Surge, Haste)')) : ''}${cell(i, 'q', t('Bonus action'))}</div>`).join('')}</div>`;
}
const sideName = (side) => (side.b.name || t('Unnamed')) + ' · ' + t((ACTS.find(([k]) => k === side.act) || ['', ''])[1]);
// The members of the party, to put one of them on screen: its plan and choices are the ones shown.
const memberChips = (ctx) => (ctx.team.on ? `<div class="sim-members"><span class="lbl">${t('Member on screen')}</span><div class="acts mini">${ctx.sides.map((s) =>
  `<button class="${s === ctx.side ? 'on' : ''}" data-act="sim-member" data-id="${esc(s.b.id)}">${esc(s.name)}</button>`).join('')}</div></div>` : '');
const pickButtons = (key, cur, list) => `<div class="acts mini">${list.map(([v, label]) => `<button class="${cur === v ? 'on' : ''}" data-act="sim-set" data-k="${key}" data-v="${v}">${label}</button>`).join('')}</div>`;
const condsText = (holder) => holder.conds.map((c) => esc(c.name) + ' <b>' + c.left + '</b>').join(' · ');
// A chart of the fights rolled: how many of them (in %) gave each value.
function simChart(title, values, label, whole) {
  if (!values.length) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const bins = whole ? Math.min(12, Math.round(hi - lo) + 1) : Math.min(10, Math.max(1, Math.ceil(hi - lo)));
  const size = whole ? Math.max(1, Math.ceil((hi - lo + 1) / bins)) : (hi - lo) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((x) => { counts[Math.min(bins - 1, Math.floor((x - lo) / size))]++; });
  const top = Math.max(...counts);
  const name = (k) => { const a = lo + k * size; return whole ? (size > 1 ? Math.round(a) + '–' + Math.round(a + size - 1) : String(Math.round(a))) : tenth(a) + '–' + tenth(a + size); };
  return `<div class="chart"><h4>${title}</h4><div class="bars">${counts.map((n, k) => `<div class="bar" title="${n} × ${esc(name(k))}"><small>${Math.round(n / values.length * 100)}%</small><i style="height:${(n / top * 100).toFixed(1)}%"></i><b>${esc(name(k))}</b></div>`).join('')}</div>
    <p class="muted">${label}</p></div>`;
}
function simManyHtml(ctx) {
  const m = sim.many;
  if (!m) return '';
  const cols = [m.a, m.b].filter(Boolean);
  const range = (x, unit) => `${x.avg.toFixed(1)}${unit} <small>${t('from {min} to {max}', { min: tenth(x.min), max: tenth(x.max) })}</small>`;
  const row = (label, cell) => `<tr><th>${label}</th>${cols.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`;
  const mortal = ctx.hp > 0;
  const who = ctx.helpers.length ? t('the enemies') : esc(targetLabel(ctx.target));
  const members = m.a.members.length > 1 ? `<table class="sim-many"><thead><tr><th>${t('Member')}</th><th>${t('Damage a round')}</th><th>${t('Falls')}</th></tr></thead><tbody>${m.a.members.map((x) =>
    `<tr><th>${esc(x.name)}</th><td><b>${x.perTurn.toFixed(1)}</b></td><td>${Math.round(x.down * 100)}%</td></tr>`).join('')}</tbody></table>` : '';
  const charts = cols.map((c) => `<div class="chart-set">${cols.length > 1 ? `<h3 class="group">${esc(c.name)}</h3>` : ''}
    ${mortal ? simChart(t('Rounds until {who} fall', { who }), c.rounds, t('Of the fights won. Lost: {n}%.', { n: Math.round(c.lost * 100) }), true) : simChart(t('Damage in 10 rounds'), c.damage, t('Of {n} fights.', { n: c.count }), false)}
    ${simChart(t('Average damage a round'), c.perRound, t('Of {n} fights.', { n: c.count }), false)}</div>`).join('');
  return `<table class="sim-many"><thead><tr><th>${t('{n} fights rolled', { n: m.a.count })}</th>${cols.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
    ${row(t('Average damage a round'), (c) => `<b>${c.perTurn.toFixed(1)}</b>`)}
    ${row(t('First round'), (c) => c.first.toFixed(1))}
    ${row(mortal ? t('Rounds until {who} fall', { who }) : t('Damage in 10 rounds'), (c) => (c.main ? range(c.main, '') : '—'))}
    ${row(ctx.sides.length > 1 ? t('Fights the party falls first') : t('Fights the build falls first'), (c) => Math.round(c.lost * 100) + '%')}
  </tbody></table>${members}<div class="charts${cols.length > 1 ? ' two' : ''}">${charts}</div>`;
}

// ---------- the four tabs ----------
function simTabBuild(ctx, b) {
  const team = ctx ? ctx.team : simMembers(b);
  const h = ctx ? simHits(ctx.b) : null;
  const arrow = h && CONSUMABLE_BY_NAME.get(norm(h.arrow));
  const coat = h && CONSUMABLE_BY_NAME.get(norm(h.coat));
  const elixir = ctx && CONSUMABLE_BY_NAME.get(norm(ctx.b.elixir));
  const ranged = ctx && (ctx.side.stats.attacks ? ctx.side.stats.attacks.rows : []).some((r) => r.slot === 'rangedMain');
  const heals = ctx ? healOptions(ctx.side.stats) : [];
  return `<section class="card">
    <h2>${t('Who fights')}</h2>
    <div class="stat-tools">
      <div class="field"><span>${t('Build')}</span>${slotButton('sim-build-open', '', b ? b.name || t('Unnamed') : '', '', t('— choose —'))}</div>
      <div class="field"><span>${t('Party')}</span>${slotButton('sim-party-open', '', team.party ? team.party.name || t('Unnamed') : '', '', t('— just this build —'))}</div>
      ${ctx ? `<div><span class="lbl">${t('With the gear of')}</span>${actTabs(state.ui.act, 'act')}</div>
      <div class="field ac-field"><span>${t('Character level')}</span>${stepper(ctx.side.at || charLevel(ctx.b), `data-ui="simLevel" data-v="${ctx.side.at || charLevel(ctx.b)}"`, 1, 12)}</div>` : ''}
    </div>
    ${ctx ? `<p class="muted">${t('The build fights with the levels it has up to that one{enemy}.', { enemy: ctx.target.enemy ? '; ' + t('{who} is level {n}', { who: esc(ctx.target.enemy.n), n: ctx.target.enemy.lv }) : '' })}${
      ctx.side.at ? ' ' + t('Now: {split}.', { split: esc(splitText(atLevel(ctx.b, ctx.side.at))) }) : ''}</p>` : ''}
    ${team.party && !team.on ? `<p class="muted">${team.list.length > 1 ? t('{name} is not a member of this party: it fights alone. Choose a member of the party as the build to have them all fight.', { name: esc(b ? b.name || t('Unnamed') : '') })
    : t('A party needs at least two builds with a level to fight together.')}</p>` : ''}
    ${ctx ? memberChips(ctx) : ''}
    ${ctx && team.on ? `<p class="muted">${t('The whole party fights: {list}. Each member follows its own plan, switches and choices; put a member on screen to change them.', { list: ctx.sides.map((s) => esc(s.name)).join(', ') })}</p>` : ''}
    ${ctx ? togglesRow(ctx.b) : ''}
    ${ctx ? `<div class="stat-tools">
      <div><span class="lbl">${t('{name} stands', { name: esc(ctx.side.name) })}</span><div class="acts mini">${[['front', t('Next to the enemy')], ['back', t('Away from it')]].map(([v, label]) =>
        `<button class="${ctx.side.front === (v === 'front') ? 'on' : ''}" data-act="sim-line" data-v="${v}">${label}</button>`).join('')}</div></div>
      ${!team.on && (ctx.side.stats.gains || []).some((g) => /^Sneak Attack/.test(g)) ? `<div class="field"><span>${t('An ally next to the enemy')}</span><button class="btn tiny${state.ui.simAlly === false ? '' : ' gold'}" data-act="sim-ally">${
        state.ui.simAlly === false ? t('No: Sneak Attack needs Advantage') : t('Yes: Sneak Attack is there')}</button></div>` : ''}
    </div>
    <p class="muted">${t('An enemy that strikes in melee goes for those who stand next to it, while any of them is up. Sneak Attack needs Advantage, or an ally next to the target; a Paladin\'s Aura of Protection reaches the allies in its own line.')}</p>` : ''}
    ${ctx ? `<h3 class="group">${t('What {name} takes into the fight', { name: esc(ctx.side.name) })}</h3>
    <div class="stat-tools">
      <div class="field enemy-field"><span>${t('Elixir kept active')}</span>${slotButton('elixir-open', '', ctx.b.elixir, elixir ? pic(elixir.i, 'pic small') : '', t('— none —'))}</div>
      <div class="field enemy-field"><span>${t('Coating on the weapon')}</span>${slotButton('sim-coat-open', '', coat ? coat.n : '', coat ? pic(coat.i, 'pic small') : '', t('— none —'))}</div>
      ${ranged ? `<div class="field enemy-field"><span>${t('Arrows it shoots')}</span>${slotButton('sim-arrow-open', '', arrow ? arrow.n : '', arrow ? pic(arrow.i, 'pic small') : '', t('— common arrows —'))}</div>
      ${arrow ? `<div class="field ac-field"><span>${t('Of them, carried')}</span><span class="stepper"><button data-act="sim-arrows" data-d="-1"${h.arrows <= 1 ? ' disabled' : ''} aria-label="${t('Decrease')}">−</button><b>${h.arrows}</b>
        <button data-act="sim-arrows" data-d="1"${h.arrows >= 30 ? ' disabled' : ''} aria-label="${t('Increase')}">+</button></span></div>` : ''}` : ''}
    </div>
    ${elixir ? `<p class="muted">${esc(elixir.n)}: ${esc(elixir.x)}</p>` : ''}
    ${coat ? `<p class="muted">${esc(coat.n)}: ${esc(coat.cx || coat.x)} ${t('Put on before the fight; it lasts 10 turns.')}</p>` : ''}
    ${arrow ? `<p class="muted">${esc(arrow.n)}: ${esc(arrow.x)} ${t('One for each attack with the ranged weapon, while they last.')}</p>` : ''}
    ${heals.length ? `<div class="stat-tools"><div class="field enemy-field"><span>${t('At half its hit points, the build heals with')}</span>${slotButton('sim-heal-open', '', ctx.side.heal ? ctx.side.heal.name : '', ctx.side.heal ? ctx.side.heal.pic : '', t('— nothing —'))}</div>
      ${ctx.side.heal && ctx.side.heal.kind === 'potion' ? `<div class="field ac-field"><span>${t('Potions carried')}</span>${stepper(ctx.side.potions, 'data-ui="simPotions" data-v="2"', 0, 10)}</div>` : ''}</div>
      ${team.on ? `<p class="muted">${t('A healing spell also goes to whoever of the party is at half its hit points or less.')}</p>` : ''}` : ''}
    <p class="muted">${t('Hit points {hp} · Armour Class {ac} · Initiative {i}', { hp: ctx.side.hp, ac: ctx.side.ac, i: signed(ctx.side.initiative) })}${ctx.side.wary ? ' · ' + t('cannot be Surprised') : ''}${
      Object.values(ctx.side.acu).some(Boolean) ? ' · Arcane Acuity: ' + [ctx.side.acu.floor ? t('never below {n}', { n: ctx.side.acu.floor }) : '', ctx.side.acu.weapon ? t('+{n} with a weapon hit', { n: ctx.side.acu.weapon }) : '',
        ctx.side.acu.fire ? t('+{n} with Fire damage', { n: ctx.side.acu.fire }) : '', ctx.side.acu.thunder ? t('+{n} with Thunder damage', { n: ctx.side.acu.thunder }) : '',
        ctx.side.acu.smite ? t('+{n} with a hit of a spell that uses a weapon', { n: ctx.side.acu.smite }) : ''].filter(Boolean).join(', ') : ''}${
      ctx.side.resist.always.size ? ' · ' + t('Resistances of the build: {list}.', { list: esc([...ctx.side.resist.always].join(', ')) }) : ''}</p>` : ''}
  </section>`;
}
function simTabEnemy(ctx) {
  const { side, target, v } = ctx;
  const foe = side.foe;
  const foeActs = modeActs(target.enemy);
  const foeSeconds = foeActs.filter((a) => a.q);
  const modeName = (MODES.find(([k]) => k === gameMode()) || MODES[0])[1];
  const toHit = foe.kind === 'a' ? Math.round(hitChance(foe.bonus, side.ac, 20, false).hit * 100) : 0;
  const toFail = foe.kind === 's' ? Math.round(Math.max(0, Math.min(1, (foe.dc - 1 - (side.saves[foe.sv] || 0)) / 20)) * 100) : 0;
  const worked = (parts) => parts.map(([label, n]) => (label === '8' ? '8' : label + ' ' + n)).join(' + ');
  const comps = (list) => list.map(([dice, flat, type]) => [dice, flat ? (dice ? '+ ' : '') + flat : '', type].filter(Boolean).join(' ')).join(' + ');
  const condOf = (m) => (m.cd ? ' · ' + m.cd.name + (m.cd.sv ? ' (' + t('{ab} save, DC {dc}', { ab: m.cd.sv.toUpperCase(), dc: m.cd.dc }) + ')' : '') + ', ' + t('{n} turn(s)', { n: m.cd.turns }) : '');
  const howOf = (m) => (m.kind === 'a' ? t('Attack bonus {b}', { b: signed(m.bonus) }) : m.kind === 's' ? t('{ab} save against DC {dc}', { ab: m.sv.toUpperCase(), dc: m.dc }) + ', '
    + (m.os === 1 ? t('the damage lands either way') : m.os ? t('half on a passed save') : t('nothing on a passed save')) : t('No roll: it always lands'));
  const answers = target.enemy ? foeAnswers(target.enemy) : [];
  const helpers = [0, 1, 2].map((i) => { const e = ENEMY_BY_NAME.get(state.ui['help' + i]); const n = Math.max(1, Math.min(6, Number(state.ui['helpN' + i]) || 1));
    return `<div class="field enemy-field"><span>${t('Helper {n}', { n: i + 1 })}</span>${slotButton('helper-open', `data-i="${i}"`, e ? e.n : '', '', t('— nobody —'))}</div>
      ${e ? `<div class="field ac-field"><span>${t('How many')}</span>${stepper(n, `data-ui="helpN${i}" data-v="1"`, 1, 6)}</div>
      <div class="field enemy-field"><span>${t('It uses')}</span>${slotButton('foe-act-open', `data-h="${i}"`, state.ui['helpA' + i] === 'none' ? '' : helperFoe({ e, a: state.ui['helpA' + i] || '' }).smart ? t('The strongest it can use') : helperFoe({ e, a: state.ui['helpA' + i] || '' }).label, '', t('Nothing: it only takes damage'))}</div>` : ''}`; }).join('');
  const hasWall = [...v.list, ...(v.list.setups || [])].some((x) => x.recipe && x.recipe.later.some((p) => p.when === 'broken'));
  return `<section class="card">
    <h2>${t('The enemy')}</h2>
    <div class="stat-tools">${targetTools()}</div>
    ${target.enemy ? `<h3 class="group">${t('Also in the fight')}</h3>
    <div class="stat-tools foe-tools">${helpers}</div>
    ${ctx.helpers.length ? `<p class="muted">${ctx.helpers.map((h) => `${h.n} × ${esc(h.e.n)} (AC ${enemyTarget(h.e).ac} · HP ${enemyHp(h.e)} · ${esc(helperFoe(h).smart ? t('The strongest it can use') : helperFoe(h).label || t('no attack'))})`).join(' · ')}. ${
      t('A helper does the action chosen for it each turn, or the strongest it can use. A spell with an area is rolled against every enemy; the other attacks go to one enemy at a time.')}</p>
    <div class="stat-tools"><div><span class="lbl">${t('The party strikes first')}</span>${pickButtons('simFocus', state.ui.simFocus || 'main', [['main', esc(target.enemy.n)], ['helpers', t('Its helpers')]])}</div></div>` : ''}` : ''}
    <h3 class="group">${t('What the enemy does on its turn')}</h3>
    <div class="stat-tools foe-tools">
      ${foeActs.length ? `<div class="field enemy-field"><span>${t('With its action, it uses')}</span>${slotButton('foe-act-open', 'data-f="a"', foe.none ? '' : foe.smart ? t('The strongest it can use') : foe.label, '', t('Nothing: it only takes damage'))}</div>` : ''}
      ${foeSeconds.length ? `<div class="field enemy-field"><span>${t('With its bonus action')}</span>${slotButton('foe-act-open', 'data-f="q"', foe.extra ? foe.extra.label : foe.smartBonus ? t('The strongest it can use') : '', '', t('— nothing —'))}</div>` : ''}
      ${foe.spell > 0 && foe.slot && !foe.none && !foe.smart ? `<div class="field ac-field"><span>${t('Cast with a slot of level')}</span>${stepper(foe.slot, `data-ui="foeSlot" data-v="${foe.slot}"`, foe.spell, topSlot(target.enemy))}</div>` : ''}
      ${foe.none || foe.smart ? '' : `<div class="field ac-field"><span>${foe.hits ? t('Times a turn') : t('Melee attacks on the build')}</span>${stepper(foe.attacks, `data-ui="foeAttacks" data-v="${foe.attacks}"`, 0, 8)}</div>
      ${foe.kind === 'a' ? `<div class="field ac-field"><span>${t('Its attack bonus')}</span>${stepper(foe.bonus, `data-ui="foeBonus" data-v="${foe.bonus}"`, -5, 25)}</div>` : ''}
      ${foe.kind === 's' ? `<div class="field ac-field"><span>${t('Its save DC')}</span>${stepper(foe.dc, `data-ui="foeBonus" data-v="${foe.dc}"`, 5, 30)}</div>` : ''}
      ${foe.hits ? '' : `<div class="field ac-field"><span>${t('Damage of each hit')}</span>${stepper(foe.damage, 'data-ui="foeDamage" data-v="10"', 1, 99)}</div>`}`}
      <div class="field ac-field"><span>${t('Movement it spends, in steps of 1.5 m')}</span>${stepper(foe.steps, 'data-ui="foeSteps" data-v="0"', 0, 20)}</div>
      ${hasWall ? `<div class="field"><span>${t('The wall the build raised')}</span><button class="btn tiny${foe.broken ? ' gold' : ''}" data-act="foe-broken">${foe.broken ? t('Is broken at once') : t('Stays whole')}</button></div>` : ''}
    </div>
    ${foe.smart ? `<p class="enemy-line">${t('Each turn, the first of these it can pay for')}: ${foe.smart.map((m) => `<b>${esc(m.label)}</b> ${m.hits.map(comps).filter(Boolean).map(esc).join(' · ')} (${howOf(m)}${
      m.slot ? ', ' + t('level {n} slot', { n: m.slot }) : ''}${m.uses ? ', ' + t('{n} use(s) a fight', { n: m.uses }) : ''}${m.area ? ', ' + t('an area') : ''}${esc(condOf(m))})`).join(' → ')}.${
      foe.slots ? ' ' + t('Its spell slots') + ': ' + Object.keys(foe.slots).map((k) => k + '×' + foe.slots[k]).join(' ') + '.' : ''}${
      foe.smartBonus && (foe.smartBonus.hits.length || foe.smartBonus.heal) ? ' ' + t('With its bonus action') + ': ' + [...foe.smartBonus.hits, ...(foe.smartBonus.heal ? [foe.smartBonus.heal] : [])].map((m) => esc(m.label)).join(', ') + '.' : ''}</p>`
    : foe.hits && !foe.none ? `<p class="enemy-line">${esc(foe.label)}: ${foe.hits.map(comps).map(esc).join(' · ')}.
      ${howOf(foe)}${foe.parts.length ? ' = ' + esc(worked(foe.parts)) + (foe.up ? ' + ' + modeName + ' 2' : '') + '. ' + t('The wiki gives the damage but not this number: it is worked out the way the game does it.')
      : foe.kind === 's' ? '. ' + t('The DC is the one its page gives.') + (foe.up ? ' ' + t('+2 in {mode} mode.', { mode: modeName }) : '') : '.'}${foe.om ? ' ' + t('A miss still deals half the damage.') : ''}${foe.cd ? ' ' + t('It leaves') + esc(condOf(foe)) + '.' : ''}
      ${foe.spell >= 0 ? t('A spell the planner knows: its damage is the one of a level {n} caster{slot}.', { n: target.enemy.lv, slot: foe.slot ? ', ' + t('with a level {n} slot', { n: foe.slot }) : '' }) : ''}
      ${foe.extra ? esc(foe.extra.label) + ': ' + foe.extra.hits.map(comps).map(esc).join(' · ') + esc(condOf(foe.extra)) + '.' : ''}
      ${[foe.slot ? t('It takes a level {n} spell slot', { n: foe.slot }) + (foe.slots ? ' (' + Object.keys(foe.slots).map((k) => k + '×' + foe.slots[k]).join(' ') + ')' : '') : '', foe.uses ? t('{n} use(s) a fight', { n: foe.uses }) : '',
        foe.fallback ? t('then it goes on with {b}', { b: esc(foe.fallback.label) }) : '', foe.waits ? t('its page says it is not there every turn') : '', esc(foe.guess)].filter(Boolean).map((x) => x + '.').join(' ')}${
      target.enemy && target.enemy.mv ? ' ' + t('It moves {n} m a turn.', { n: target.enemy.mv }) : ''}</p>`
  : target.enemy && !foeActs.length ? `<p class="enemy-line">${t('The page of {who} lists nothing to go by: set its attacks by hand.', { who: esc(target.enemy.n) })}</p>` : ''}
    ${!foe.smart && foe.attacks && foe.kind === 'a' ? `<p class="muted">${t('{n}% to hit the build\'s Armour Class of {ac}. A natural 20 is a critical hit.', { n: toHit, ac: side.ac })}</p>` : ''}
    ${!foe.smart && foe.attacks && foe.kind === 's' ? `<p class="muted">${t('The build fails the save {n}% of the time ({ab} {b}).', { n: toFail, ab: foe.sv.toUpperCase(), b: signed(side.saves[foe.sv] || 0) })}</p>` : ''}
    ${foe.attacks || foe.smart ? `<p class="muted">${t('About {n} damage a turn to the build.', { n: (foe.smart ? foeAverage(side, foe.smart[0], foe.smart[0].hits.length) : foeAverage(side, foe, foe.attacks)).toFixed(1) })}${
      foe.smart ? ' (' + esc(foe.smart[0].label) + ')' : ''} ${t('While raging: {list}.', { list: esc([...side.resist.raging].join(', ')) })}</p>` : ''}
    ${target.enemy ? `<h3 class="group">${t('What it answers a hit with')}</h3>
    <div class="stat-tools"><div class="field"><span>${t('Reactions and Legendary Actions')}</span><button class="btn tiny${state.ui.foeReacts === false ? '' : ' gold'}" data-act="foe-reacts">${state.ui.foeReacts === false ? t('Not used') : t('Used, once a round')}</button></div></div>
    ${answers.length ? `<p class="enemy-line">${answers.map((m) => `${esc(m.label)}${m.legend ? ' (Legendary Action)' : ''}: ${m.hits.map(comps).filter(Boolean).map(esc).join(' · ') || t('no damage')}. ${howOf(m)}${m.om ? ', ' + t('half the damage on a miss') : ''}${esc(condOf(m))}${m.as ? '. ' + t('With the numbers of {a}', { a: esc(m.as) }) : ''}${
      m.waits ? '. ' + t('its page says it is not there every turn') : ''}.${m.tr ? ' <em>' + esc(m.tr) + '</em>' : ''}`).join('<br>')}</p>` : `<p class="muted">${t('Its page gives nothing the test can use here, in this difficulty.')}</p>`}` : ''}
    <h3 class="group">${t('How the fight starts')}</h3>
    <div class="stat-tools">
      <div><span class="lbl">${t('Who acts first')}</span>${pickButtons('simFirst', state.ui.simFirst || 'roll', [['roll', t('Initiative, rolled')], ['party', ctx.sides.length > 1 ? t('The party') : t('The build')], ['foes', t('The enemy')]])}</div>
      <div><span class="lbl">${t('Surprised')}</span>${pickButtons('simSurprise', state.ui.simSurprise || '', [['', t('Nobody')], ['foes', t('The enemy')], ['party', ctx.sides.length > 1 ? t('The party') : t('The build')]])}</div>
      ${ctx.sides.length > 1 ? `<div><span class="lbl">${t('An enemy goes for')}</span>${pickButtons('simAim', state.ui.simAim || 'random', [['random', t('Anyone, at random')], ['first', t('The first of the party')], ['weakest', t('Whoever has fewest hit points')]])}</div>` : ''}
    </div>
    <p class="muted">${t('Initiative is a d4 plus the bonus, highest first. Whoever is Surprised takes no action and no reaction in the first round. With no attacks and no movement, the enemy only takes damage.')}</p>
  </section>`;
}
function simTabPlan(ctx) {
  const { side, v, target, chosen, expected } = ctx;
  const who = targetLabel(target);
  const on = side.stats.active || [];
  const reacts = reactOptions(ctx);
  const hits = hitOptions(side);
  const h = simHits(ctx.b);
  const opts = side.stats.options || new Set();
  const hasSmite = (side.stats.gains || []).includes('Divine Smite');
  const smiteNames = { all: t('On every melee hit'), crit: t('On critical hits only') };
  const hasWall = [...v.list, ...(v.list.setups || [])].some((x) => x.recipe && x.recipe.later.some((p) => p.when === 'broken'));
  const rules = [
    on.includes('rage') ? t('Rage (switched on above) is entered with the bonus action, lasts 10 turns and takes a Rage Charge each time; without a charge the build fights without it.') : '',
    on.includes('haste') ? t('Haste (switched on above) is on the build for the first 10 turns, as if someone else cast it; the turn after it ends is lost to Lethargic.') : '',
    side.haste ? t('Haste cast by the build holds its Concentration: another Concentration spell ends it, and leaves the caster Lethargic.') : '',
    on.includes('sneak') ? t('Sneak Attack comes once a turn, on the first attack that hits.') : '',
    side.controls.length ? t('A spell that only leaves a condition (Hold Person, Blindness) goes to the enemy in front, which saves against it; a condition held by Concentration ends with it.') : ''].filter(Boolean);
  return `<section class="card">
    <h2>${t('Plan of turns')}</h2>
    ${memberChips(ctx)}
    <p class="muted">${t('What the build does with its action and its bonus action in each of the first three turns and in the ones after. A spell that is still at work is not cast again; with no slot left, the turn goes to what the build does at will.')}</p>
    ${simPlanHtml(ctx)}
    ${castTools(side.stats, v.list)}
    ${hasSmite || hits.length ? `<h3 class="group">${t('On a hit')}</h3><div class="stat-tools">
      ${hasSmite ? `<div class="field enemy-field"><span>Divine Smite</span>${slotButton('sim-smite-open', '', smiteNames[h.smite] || '', '', t('— never —'))}</div>
        ${h.smite ? `<div class="field"><span>${t('With the spell slot')}</span><button class="btn tiny" data-act="sim-low">${h.low ? t('The lowest left') : t('The highest left')}</button></div>` : ''}` : ''}
      ${hits.length ? `<div class="field enemy-field"><span>${t('Manoeuvre or strike')}</span>${slotButton('sim-hit-open', '', hits.some((x) => x[0] === h.hit) ? h.hit : '', '', t('— none —'))}</div>
        ${hits.some((x) => x[0] === h.hit) ? `<div class="field"><span>${t('How often')}</span><button class="btn tiny" data-act="sim-every">${h.every ? t('On every hit') : t('Once a turn')}</button></div>` : ''}` : ''}
    </div>
    ${hasSmite ? `<p class="muted">${t('Divine Smite takes a spell slot on a melee weapon hit: 2d8 Radiant with a level 1 slot, one more d8 for each level above it (5d8 at most) and one more against Fiends and Undead. The dice are rolled twice on a critical hit.')}</p>` : ''}
    ${hits.length ? `<p class="muted">${t('A manoeuvre takes a Superiority Die when the attack hits; Stunning Strike takes a Ki Point. What the target saves against is the weapon action DC: 8 + proficiency bonus + Strength or Dexterity modifier ({dc}).', { dc: side.weaponDc })}</p>` : ''}` : ''}
    ${ctx.team.on || opts.has('Rally') || opts.has('Evasive Footwork') ? `<h3 class="group">${t('Apart from the attacks')}</h3><div class="stat-tools">
      ${ctx.team.on ? `<div class="field"><span>${t('An ally that is Downed')}</span><button class="btn tiny${h.help ? ' gold' : ''}" data-act="sim-flag" data-k="help">${h.help ? t('Is helped up, with the action') : t('Is left where it fell')}</button></div>` : ''}
      ${opts.has('Rally') ? `<div class="field"><span>Rally</span><button class="btn tiny${h.rally ? ' gold' : ''}" data-act="sim-flag" data-k="rally">${h.rally ? t('Used on whoever is down or at half') : t('Not used')}</button></div>` : ''}
      ${opts.has('Evasive Footwork') ? `<div class="field"><span>Evasive Footwork</span><button class="btn tiny${h.foot ? ' gold' : ''}" data-act="sim-flag" data-k="foot">${h.foot ? t('Every turn') : t('Not used')}</button></div>` : ''}
      ${opts.has("Commander's Strike") && ctx.team.on ? `<div class="field enemy-field"><span>Commander's Strike</span>${slotButton('sim-cmd-open', '', (ctx.sides.find((y) => y.b.id === h.cmd) || {}).name || '', '', t('— not used —'))}</div>` : ''}
    </div>
    <p class="muted">${[ctx.team.on ? t('Help takes the action and leaves the ally with 1 hit point; a healing spell chosen for the bonus action goes to a Downed ally first. A Downed build rolls a death saving throw each turn: three failed and it is dead.') : '',
      opts.has('Rally') ? t('Rally: the bonus action and a Superiority Die for 8 temporary hit points; a Downed ally is back at 1 hit point first.') : '',
      opts.has('Evasive Footwork') ? t('Evasive Footwork: a Superiority Die each turn. The wiki notes that it ends with the build\'s own turn, so it only covers the melee attacks that answer the build during it.') : '',
      opts.has("Commander's Strike") ? t('Commander\'s Strike: one attack of the Attack action, the bonus action and a Superiority Die, each turn; the ally makes a melee weapon attack with its reaction, with the die on its damage.') : ''].filter(Boolean).join(' ')}</p>` : ''}
    ${reacts.length || side.haste || hasWall ? `<h3 class="group">${t('The rest')}</h3><div class="stat-tools">
      ${reacts.length ? `<div class="field"><span>${t('Reaction')}</span>${slotButton('sim-react-open', '', side.react && reacts.some((r) => r[0] === side.react) ? side.react : '', '', t('— none —'))}</div>` : ''}
      ${side.haste ? `<div class="field"><span>${t('The action Haste gives')}</span><button class="btn tiny${side.hasteNow ? ' gold' : ''}" data-act="haste-now">${side.hasteNow ? t('From the turn it is cast') : t('From the turn after')}</button></div>` : ''}
    </div>` : ''}
    ${rules.map((x) => `<p class="muted">${x}</p>`).join('')}
    <p class="turn"><b>${expected.toFixed(1)}</b>${t('expected on average from the action of the later turns against {who}', { who: esc(who) })}${chosen ? ': ' + esc(chosen.text + ' · ' + chosen.how) : v.plan ? ': ' + v.plan.parts.map((x) =>
      `${x.chance != null ? Math.round(x.chance * 100) + '%' : x.n} × ${esc(x.row.name)} (${esc(x.how)})`).join(' + ') + (v.plan.once ? ' + ' + esc(v.plan.once.label) + ' (' + t('once a turn') + ')' : '') : ''}</p>
  </section>`;
}
function simTabResult(ctx) {
  const { side, sides, other, target, hp, can } = ctx;
  const enc = sim.enc;
  const rounds = sim.rounds;
  const over = encOver(enc);
  const won = encWon(enc);
  const mortal = enc.foes.some((f) => isFinite(f.hp));
  const strikes = enc.foes.some((f) => f.move.attacks || f.move.extra);
  const bar = (cls, share, text) => `<div class="hpbar${cls}"><i style="width:${Math.max(0, Math.min(100, share * 100)).toFixed(1)}%"></i><span>${text}</span></div>`;
  const foeBars = enc.foes.filter((f) => isFinite(f.hp)).map((f) => bar(f.dead ? ' down' : '', 1 - f.dealt / f.hp, `${esc(f.name)} · ${t('{left} of {hp} hit points', { left: tenth(Math.max(0, f.hp - f.dealt)), hp: f.hp })}${f.conds.length ? ' · ' + condsText(f) : ''}`)).join('');
  const fallen = (fight) => (fight.dead ? t('dead') : fight.death && fight.death.ok >= 3 ? t('Downed, Stable') : t('Downed: death saving throws {ok} passed, {bad} failed', { ok: (fight.death || {}).ok || 0, bad: (fight.death || {}).bad || 0 }));
  const sideBars = strikes || sides.length > 1 ? enc.fights.map((fight, i) => bar(' mine' + (fight.down ? ' down' : ''), fight.hp / sides[i].hp,
    `${esc(sides[i].name)} · ${fight.down ? fallen(fight) : t('{left} of {hp} hit points', { left: tenth(Math.max(0, fight.hp)), hp: sides[i].hp })}${fight.temp > 0 ? ' + ' + tenth(fight.temp) : ''} · AC ${sides[i].ac}${fight.conds.length ? ' · ' + condsText(fight) : ''}`)).join('') : '';
  const resOf = (s, fight) => {
    const left = fight.left;
    const full = simResources(s.stats);
    return [left.slots.length ? t('Spell slots') + ' ' + left.slots.map((n, i) => `<span class="slot-n${n ? '' : ' out'}" title="${t('Level {n}', { n: i + 1 })}">${i + 1}<i>×${n}</i></span>`).join('') : '',
      left.pactLevel ? esc(t('Pact Magic slots')) + ' <b>' + left.pact + '</b>' : '',
      full.points ? 'Sorcery Points <b>' + left.points + '</b>' : '', full.ki ? 'Ki Points <b>' + left.ki + '</b>' : '',
      full.rage ? 'Rage Charges <b>' + left.rage + '</b>' : '', full.surge ? 'Action Surge <b>' + left.surge + '</b>' : '', full.dice ? 'Superiority Dice <b>' + left.dice + '</b>' : '',
      s.arrow ? esc(s.arrow.name) + ' <b>' + left.arrows + '</b>' : '',
      s.heal && s.heal.kind === 'wind' ? 'Second Wind <b>' + left.wind + '</b>' : '', s.heal && s.heal.kind === 'potion' ? esc(s.heal.name) + ' <b>' + left.potions + '</b>' : ''].filter(Boolean);
  };
  const workOf = (fight) => fight.effects.filter((e) => !e.quiet && e.kind !== 'link').map((e) => esc(e.name) + (isFinite(e.until) ? ' <b>' + t('{n} turn(s) left', { n: Math.max(0, e.until - fight.turn) }) + '</b>' : '') + (e.conc ? ' · ' + t('Concentration') : ''))
    .concat(fight.acuity ? ['Arcane Acuity <b>+' + fight.acuity + '</b>'] : []);
  const res = enc.fights.map((fight, i) => { const r = resOf(sides[i], fight); return r.length ? `<p class="points sim-res"><b>${sides.length > 1 ? esc(sides[i].name) : t('Left to spend')}</b> ${r.join(' · ')}</p>` : ''; }).join('');
  const work = enc.fights.map((fight, i) => { const w = workOf(fight); return w.length ? `<p class="points sim-res"><b>${t('At work')}${sides.length > 1 ? ' · ' + esc(sides[i].name) : ''}</b> ${w.join(' · ')}</p>` : ''; }).join('');
  const totals = rounds.map((x) => x.total);
  const dealt = totals.reduce((a, x) => a + x, 0);
  const box = (label, value, hint) => `<div class="stat"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const solo = sides.length === 1 && enc.foes.length === 1;
  const turn = (x) => `<article class="sim-turn${x.kind === 'foe' ? ' theirs' : ''}"><header><b>${esc(x.title || '')}</b><span>${esc(x.name)}</span><strong>${x.kind === 'foe' && !x.total ? '' : tenth(x.total)}</strong></header>
    ${x.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}${x.lines.length ? `<ul>${x.lines.map(simLine).join('')}</ul>` : ''}</article>`;
  const log = rounds.slice(-SIM_SHOWN).reverse().map((r) => `<div class="sim-round"><h4>${t('Round {n}', { n: r.n })}<strong>${tenth(r.total)}</strong></h4>${r.entries.map(turn).join('')}</div>`).join('');
  const init = enc.init.length && enc.opts.first === 'roll' ? `<p class="muted">${t('Initiative')}: ${enc.init.map((x) => `${esc(x.name)} <b>${x.total}</b>`).join(' · ')}</p>` : '';
  const lost = encLost(enc) && !won;
  return `<section class="card">
      <h2>${t('The fight')}</h2>
      ${foeBars}${sideBars}
      ${won && mortal ? `<p class="sim-down">${solo ? t('{who} falls in turn {n}.', { who: esc(targetLabel(target)), n: rounds.length }) : t('The enemies fall in round {n}.', { n: rounds.length })}</p>` : ''}
      ${lost ? `<p class="sim-down lost">${sides.length > 1 ? t('The party falls in round {n}.', { n: rounds.length }) : t('The build falls in turn {n}.', { n: enc.fights[0].down })}</p>` : ''}
      <div class="row-btns sim-btns">
        <button class="btn primary" data-act="sim-roll" data-n="1"${over || !can ? ' disabled' : ''}>${t('Roll a round')}</button>
        <button class="btn" data-act="sim-roll" data-n="10"${over || !can ? ' disabled' : ''}>${t('Roll 10 rounds')}</button>
        ${mortal ? `<button class="btn" data-act="sim-roll" data-n="kill"${over || !can ? ' disabled' : ''}>${t('Roll until it is over')}</button>` : ''}
        <button class="btn" data-act="sim-rest" data-k="short" title="${t('Pact Magic slots, Ki Points and Action Surge come back.')}">Short Rest</button>
        <button class="btn" data-act="sim-rest" data-k="long" title="${t('Everything comes back.')}">Long Rest</button>
        <button class="btn" data-act="sim-reset"${rounds.length ? '' : ' disabled'}>${t('Start over')}</button>
      </div>
      ${init}${res}${work}
      ${rounds.length ? `<div class="stat-row">${box(t('Rounds'), rounds.length)}${box(t('Total damage'), tenth(dealt))}${box(t('Average a round'), (dealt / rounds.length).toFixed(1))}
        ${box(t('Best round'), tenth(Math.max(...totals)))}${box(t('Worst round'), tenth(Math.min(...totals)))}</div>
        <div class="sim-log">${log}</div>${rounds.length > SIM_SHOWN ? `<p class="muted">${t('The last {n} rounds are shown.', { n: SIM_SHOWN })}</p>` : ''}`
    : `<p class="muted">${t('Nothing rolled yet. A change in the build, the enemy or the plan starts the fight over.')}</p>`}
      <p class="muted">${t('Resistance halves and vulnerability doubles each roll as it is, without rounding, so the rolled average meets the expected one.')}</p>
    </section>
    <section class="card">
      <h2>${t('Many fights, with a chart')}</h2>
      <p class="muted">${sides.length > 1 ? t('Rolls {n} fights with the plans of the party, each from a Long Rest, and shows how they went.', { n: SIM_FIGHTS })
    : t('Rolls {n} fights with the plan above, each from a Long Rest, and sets them next to another build or to the same build with the gear of another act. The other side follows its own plan and switches: to change them, put it on screen with "Swap sides".', { n: SIM_FIGHTS })}</p>
      ${sides.length > 1 ? '' : `<div class="stat-tools">
        <div class="field"><span>${t('Compare with')}</span>${slotButton('sim-b-open', '', other ? other.b.name || t('Unnamed') : '', '', t('— nothing —'))}</div>
        ${other ? `<div><span class="lbl">${t('With the gear of')}</span>${actTabs(other.act, 'sim-b-act')}</div>` : ''}
      </div>`}
      <div class="row-btns sim-btns">
        <button class="btn primary" data-act="sim-fights"${can ? '' : ' disabled'}>${t('Roll {n} fights', { n: SIM_FIGHTS })}</button>
        ${other ? `<button class="btn" data-act="sim-swap">${t('Swap sides')}</button>` : ''}
      </div>
      ${simManyHtml(ctx)}
    </section>`;
}
function renderDamage() {
  const b = curBuild();
  const ctx = simContext();
  const tab = ctx ? simTab() : 'build';
  const scenes = state.ui.scenes || [];
  const cur = scenes.find((s) => s.id === state.ui.scene);
  const who = ctx ? (ctx.team.on ? esc(ctx.team.party.name || t('Unnamed')) + ' (' + ctx.sides.length + ')' : esc(ctx.side.name)) : '';
  const foe = ctx ? esc(targetLabel(ctx.target)) + ctx.helpers.map((h) => ' + ' + h.n + ' × ' + esc(h.e.n)).join('') : '';
  const head = `<section class="card hero"><h1>${t('Damage test')}</h1>
    <p class="muted">${t('Rolls the dice of a fight against an enemy: every attack roll, saving throw and damage die, round after round, with the spell slots and the other resources running out as they are spent. Nothing rolled here is saved.')}</p>
    <div class="stat-tools scene-tools">
      <div class="field enemy-field"><span>${t('Scenario')}</span>${slotButton('scene-open', '', cur ? cur.name : '', '', scenes.length ? t('— choose —') : t('— none saved —'))}</div>
      <label class="field"><span>${t('Name to save it under')}</span><input type="text" data-sim="sceneName" value="${esc(state.ui.sceneName || '')}" placeholder="${esc(ctx ? ctx.side.name + ' × ' + targetLabel(ctx.target) : '')}"></label>
      <button class="btn" data-act="scene-save"${ctx ? '' : ' disabled'}>${t('Save scenario')}</button>
      ${cur ? `<button class="btn" data-act="scene-del">${t('Delete it')}</button>` : ''}
    </div>
    ${ctx ? `<p class="points sim-sum"><b>${who}</b> ${t('against')} <b>${foe}</b> · ${(MODES.find(([k]) => k === gameMode()) || MODES[0])[1]}</p>
    <nav class="secnav sim-tabs" aria-label="${t('Steps of the test')}">${SIM_TABS.map(([k, label], i) => `<button class="${tab === k ? 'on' : ''}" data-act="sim-tab" data-k="${k}">${i + 1} · ${t(label)}</button>`).join('')}</nav>` : ''}</section>`;
  if (!ctx) return `<div class="content wide sim">${head}${simTabBuild(null, b)}<section class="card empty"><h2>${t('Choose a build with at least one level.')}</h2></section></div>`;
  const body = tab === 'enemy' ? simTabEnemy(ctx) : tab === 'plan' ? simTabPlan(ctx) : tab === 'result' ? simTabResult(ctx) : simTabBuild(ctx, b);
  const next = SIM_TABS[SIM_TABS.findIndex(([k]) => k === tab) + 1];
  return `<div class="content wide sim">${head}${body}
    ${next ? `<div class="row-btns sim-next"><button class="btn primary" data-act="sim-tab" data-k="${next[0]}">${t('Next: {step}', { step: t(next[1]) })} →</button></div>` : ''}</div>`;
}

// The name of a scenario is typed: it is kept as it is written, without drawing the page again.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.sim) return;
  state.ui[el.dataset.sim] = el.value;
  save();
});

Object.assign(actions, {
  'sim-tab'(el) { state.ui.simTab = el.dataset.k; return { top: true }; },
  'sim-set'(el) { state.ui[el.dataset.k] = el.dataset.v; },
  'sim-roll'(el) {
    const ctx = simContext();
    if (!ctx) return;
    if (el.dataset.n === 'kill') simRun(ctx, 200, true); else simRun(ctx, Number(el.dataset.n) || 1);
  },
  'sim-fights'() {
    const ctx = simContext();
    if (!ctx) return;
    const run = (sides) => encFights(() => simEncounter(sides, ctx.target, ctx.hp, ctx.helpers), SIM_FIGHTS);
    sim.many = { a: Object.assign(run(ctx.sides), { name: ctx.team.on ? ctx.team.party.name || t('Unnamed') : sideName(ctx.side) }),
      b: ctx.other ? Object.assign(run([ctx.other]), { name: sideName(ctx.other) }) : null };
  },
  'sim-rest'(el) {
    const ctx = simContext();
    if (!ctx) return;
    sim.enc.fights.forEach((fight, i) => {
      const full = sideResources(ctx.sides[i]);
      if (el.dataset.k === 'long') { fight.left = full; fight.used = []; }
      else Object.assign(fight.left, { pact: full.pact, ki: full.ki, surge: full.surge, dice: full.dice, wind: full.wind });
    });
  },
  'sim-reset'() { sim.key = ''; },
  'sim-member'(el) { if (buildById(el.dataset.id)) { state.ui.buildId = el.dataset.id; state.ui.wizard = ''; } },
  'foe-broken'() { state.ui.foeBroken = !state.ui.foeBroken; },
  'foe-reacts'() { state.ui.foeReacts = state.ui.foeReacts === false; },
  'sim-line'(el) { const b = curBuild(); if (b) setHit(b, { line: el.dataset.v }); },
  'sim-ally'() { state.ui.simAlly = state.ui.simAlly === false; },
  'sim-flag'(el) { const b = curBuild(); if (b) setHit(b, { [el.dataset.k]: !simHits(b)[el.dataset.k] }); },
  'sim-cmd-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const allies = ctx.sides.filter((y) => y !== ctx.side && (y.stats.attacks ? y.stats.attacks.rows : []).some((r) => r.slot === 'meleeMain' && !r.thrown));
    openChooser("Commander's Strike", esc(manoeuvreText("Commander's Strike")), [{ label: t('The ally that strikes'), n: 1, min: 0, options: allies.map((y) => [y.name, splitText(y.b), '', '', '']), chosen: allies.filter((y) => y.b.id === simHits(ctx.b).cmd).map((y) => y.name) }],
      (done) => { const y = allies.find((z) => z.name === done[0].chosen[0]); setHit(ctx.b, { cmd: y ? y.b.id : '' }); });
    return false;
  },
  'foe-act-open'(el) {
    const ctx = simContext();
    const second = el.dataset.f === 'q';
    // (for a helper: the action that kind of enemy uses)
    const helper = el.dataset.h != null ? Number(el.dataset.h) : -1;
    const e = ctx && (helper >= 0 ? ENEMY_BY_NAME.get(state.ui['help' + helper]) : ctx.target.enemy);
    const acts = modeActs(e).filter((a) => !!a.q === second);
    if (!acts.length) return false;
    const comps = (list) => list.map(([dice, flat, type]) => [dice, flat ? '+ ' + flat : '', type].filter(Boolean).join(' ')).join(' + ');
    const rows = acts.map((a) => {
      const m = foeMove(a, e);
      const how = m.kind === 'e' ? t('heals itself') : m.kind === 'a' ? t('Attack bonus {b}', { b: signed(m.bonus) }) : m.kind === 's' ? t('{ab} save against DC {dc}', { ab: m.sv.toUpperCase(), dc: m.dc }) + ', ' + (m.os === 1 ? t('the damage lands either way') : m.os ? t('half on a passed save') : t('nothing on a passed save')) : t('No roll: it always lands');
      return [a.n, [how, m.hits.map(comps).filter(Boolean).join(' · '), m.cd ? m.cd.name + ' · ' + t('{n} turn(s)', { n: m.cd.turns }) : ''].filter(Boolean).join(' · '), [m.kind === 'e' ? '' : t('About {n} damage a turn to the build.', { n: foeAverage(ctx.side, m, m.hits.length).toFixed(1) }), m.slot ? t('It takes a level {n} spell slot', { n: m.slot }) : '',
        m.uses ? t('{n} use(s) a fight', { n: m.uses }) : '', m.waits ? t('its page says it is not there every turn') : '', m.guess].filter(Boolean).join(' · '), '', m.melee ? t('In melee') : t('From a distance')];
    }).sort((x, y) => (x[4] === y[4] ? 0 : x[4] === t('In melee') ? -1 : 1));
    const none = second ? t('— nothing —') : t('Nothing: it only takes damage');
    rows.push([none, '', '', '', t('From a distance')]);
    // nothing chosen: it plays the strongest it can, turn by turn
    const best = t('The strongest it can use');
    rows.unshift([best, t('Each turn, the strongest of these that it can pay for: the ones that take a spell slot or have few uses while they last, then the rest. Not the ones its page ties to a condition.'), '', '', t('As the fight goes')]);
    const title = second ? t('With its bonus action') : t('With its action, it uses');
    const mine = helper >= 0 ? simFoe(enemyTarget(e), state.ui['helpA' + helper] ? { foeAct: state.ui['helpA' + helper] } : true) : ctx.side.foe;
    const now = second ? (mine.extra ? mine.extra.label : mine.smartBonus ? best : none) : mine.none ? none : mine.smart ? best : mine.label;
    openChooser(title, t('The actions of its page on bg3.wiki, in the difficulty chosen. The first of the list is what it does when nothing is chosen.'),
      [{ label: title, n: 1, min: 0, options: rows, chosen: [now] }],
      (done) => {
        const name = done[0].chosen[0] === best ? '' : done[0].chosen[0] || '';
        if (helper >= 0) { state.ui['helpA' + helper] = name === none ? 'none' : name; return; }
        if (second) { state.ui.foeAct2 = name === none ? 'none' : name; return; }
        state.ui.foeAct = name === none ? 'none' : name;
        // the numbers set by hand were for the action before
        ['foeAttacks', 'foeBonus', 'foeSlot'].forEach((k) => { delete state.ui[k]; });
      });
    return false;
  },
  'helper-open'(el) {
    const i = Number(el.dataset.i);
    const rows = ENEMIES.map((e) => [e.n, [resText(e).join(', '), simFoe(enemyTarget(e), true).label].filter(Boolean).join(' — '), `AC ${e.ac} · HP ${enemyHp(e)} · ${t('level {n}', { n: e.lv })}`, '', t('Act {n}', { n: e.act })]);
    openChooser(t('Helper {n}', { n: i + 1 }), t('An enemy that stands with the main one. It does what it usually does, every turn.'),
      [{ label: t('Helper {n}', { n: i + 1 }), n: 1, min: 0, options: rows, chosen: state.ui['help' + i] ? [state.ui['help' + i]] : [] }], (done) => { state.ui['help' + i] = done[0].chosen[0] || ''; delete state.ui['helpA' + i]; });
    return false;
  },
  'sim-heal-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const list = healOptions(ctx.side.stats);
    openChooser(t('At half its hit points, the build heals with'), t('It takes the bonus action of that turn. Second Wind comes back on a Short Rest; a spell takes a slot; potions are the ones carried.'),
      [{ label: t('Healing'), n: 1, min: 0, options: list.map((o) => [o.name, o.text, o.facts, o.pic, o.kind === 'potion' ? t('Potions') : t('Of the build')]), chosen: ctx.side.heal ? [ctx.side.heal.name] : [] }],
      (done) => { const o = list.find((x) => x.name === done[0].chosen[0]); (state.ui.simHeals || (state.ui.simHeals = {}))[ctx.b.id] = o ? o.value : ''; });
    return false;
  },
  'haste-now'() { state.ui.hasteNow = state.ui.hasteNow === false; },
  'sim-react-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = reactOptions(ctx);
    openChooser(t('Reaction'), t('One reaction a round, on the enemy\'s turn, when what it answers happens.'), [{ label: t('Reaction'), n: 1, min: 0, options: rows.map((r) => r.slice(1)), chosen: rows.filter((r) => r[0] === ctx.side.react).map((r) => r[1]) }],
      (done) => { const row = rows.find((r) => r[1] === done[0].chosen[0]); (state.ui.simReacts || (state.ui.simReacts = {}))[ctx.b.id] = row ? row[0] : ''; });
    return false;
  },
  'sim-smite-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = [['all', t('On every melee hit'), t('While a spell slot is left: the damage of the first turns is the highest the build has.')], ['crit', t('On critical hits only'), t('The slots are kept for the hits whose dice are rolled twice.')]];
    openChooser('Divine Smite', esc(featureText('Divine Smite') || ''), [{ label: 'Divine Smite', n: 1, min: 0, options: rows.map((r) => [r[1], r[2], '', '', '']), chosen: rows.filter((r) => r[0] === simHits(ctx.b).smite).map((r) => r[1]) }],
      (done) => { const row = rows.find((r) => r[1] === done[0].chosen[0]); setHit(ctx.b, { smite: row ? row[0] : '' }); });
    return false;
  },
  'sim-low'() { const b = curBuild(); if (b) setHit(b, { low: !simHits(b).low }); },
  'sim-every'() { const b = curBuild(); if (b) setHit(b, { every: !simHits(b).every }); },
  'sim-hit-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = hitOptions(ctx.side);
    openChooser(t('Manoeuvre or strike'), t('What the build spends on a weapon attack that hits. One at a time; the others it has are left unused.'),
      [{ label: t('Manoeuvre or strike'), n: 1, min: 0, options: rows.map((r) => [r[0], r[1], r[2], '', '']), chosen: rows.filter((r) => r[0] === simHits(ctx.b).hit).map((r) => r[0]) }],
      (done) => { setHit(ctx.b, { hit: done[0].chosen[0] || '' }); });
    return false;
  },
  'sim-arrow-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = CONSUMABLES.filter((c) => c.t === 'Arrow' && arrowFx(c)).map((c) => [c.n, c.x || '', '', pic(c.i, 'pic small'), '']);
    openChooser(t('Arrows it shoots'), t('The arrows whose effect the test can roll. One goes with each attack of the ranged weapon, while they last.'),
      [{ label: t('Arrows it shoots'), n: 1, min: 0, options: rows, chosen: simHits(ctx.b).arrow ? [simHits(ctx.b).arrow] : [] }], (done) => { setHit(ctx.b, { arrow: done[0].chosen[0] || '' }); });
    return false;
  },
  'sim-arrows'(el) { const b = curBuild(); if (b) setHit(b, { arrows: Math.max(1, Math.min(30, (Number(simHits(b).arrows) || 0) + Number(el.dataset.d))) }); },
  'sim-coat-open'() {
    const ctx = simContext();
    if (!ctx) return false;
    const rows = CONSUMABLES.filter((c) => c.t === 'Coating' && coatFx(c)).map((c) => [c.n, c.cx || c.x || '', c.du || '', pic(c.i, 'pic small'), '']);
    openChooser(t('Coating on the weapon'), t('The coatings whose effect the test can roll. Put on before the fight, for 10 turns.'),
      [{ label: t('Coating on the weapon'), n: 1, min: 0, options: rows, chosen: simHits(ctx.b).coat ? [simHits(ctx.b).coat] : [] }], (done) => { setHit(ctx.b, { coat: done[0].chosen[0] || '' }); });
    return false;
  },
  'sim-build-open'() { simBuildChooser(t('Build'), curBuild(), (id) => { if (id) { state.ui.buildId = id; state.ui.wizard = ''; } }); return false; },
  'sim-party-open'() {
    const list = state.parties.filter((p) => p.members.some((m) => { const x = buildById(m.buildId); return x && charLevel(x); }));
    const names = (p) => [...new Set(p.members.map((m) => buildById(m.buildId)).filter((x) => x && charLevel(x)))];
    const rows = list.map((p, i) => [(p.name || t('Unnamed')) + (list.slice(0, i).some((q) => (q.name || '') === (p.name || '')) ? ' (' + (i + 1) + ')' : ''), names(p).map((x) => x.name || t('Unnamed')).join(' · '), t('{n} builds', { n: names(p).length }), '', '']);
    const cur = list.findIndex((p) => p.id === state.ui.simParty);
    openChooser(t('Party'), t('The parties of the Party Planner. Its builds that have a level fight together, each with its own plan.'), [{ label: t('Party'), n: 1, min: 0, options: rows, chosen: cur >= 0 ? [rows[cur][0]] : [] }],
      (done) => {
        const p = list[rows.findIndex((r) => r[0] === done[0].chosen[0])];
        state.ui.simParty = p ? p.id : '';
        // a member of the party goes on screen, so that the whole party fights
        if (p && !names(p).includes(curBuild())) { state.ui.buildId = names(p)[0].id; state.ui.wizard = ''; }
      });
    return false;
  },
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
    const cur = ctx.side.steps[i][f] || (i === 3 ? (f === 'a' ? atWill(ctx.v) : STEP_DEFAULT[f]) : '');
    const title = [t('Turn {n}', { n: 1 }), t('Turn {n}', { n: 2 }), t('Turn {n}', { n: 3 }), t('From turn 4 on')][i] + ' · ' + (f === 'a' ? t('Action') : f === 'x' ? t('Action on top (Action Surge, Haste)') : t('Bonus action'));
    openChooser(title, f === 'a' ? t('What the action of the turn goes to.') : f === 'x' ? t('What a second action goes to, on the turns the build has one: Action Surge once a Short Rest, Haste while it lasts, a kill with an Elixir of Bloodlust.')
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
  // ----- scenarios: a setup of the test kept by name -----
  'scene-save'() {
    const ctx = simContext();
    if (!ctx) return false;
    const name = String(state.ui.sceneName || '').trim() || ctx.side.name + ' × ' + targetLabel(ctx.target);
    const scenes = state.ui.scenes || (state.ui.scenes = []);
    const per = (map, id) => clone((state.ui[map] || {})[id] == null ? null : (state.ui[map] || {})[id]);
    const scene = { id: (scenes.find((s) => s.name === name) || {}).id || uid(), name, buildId: ctx.b.id,
      ui: Object.fromEntries(SCENE_KEYS.filter((k) => state.ui[k] != null).map((k) => [k, clone(state.ui[k])])),
      per: Object.fromEntries([...ctx.sides, ...(ctx.other ? [ctx.other] : [])].map((s) => [s.b.id, { plan: per('simPlans', s.b.id), react: per('simReacts', s.b.id), heal: per('simHeals', s.b.id), hits: per('simHits', s.b.id) }])) };
    state.ui.scenes = scenes.filter((s) => s.id !== scene.id).concat(scene);
    Object.assign(state.ui, { scene: scene.id, sceneName: name });
    toast(t('Scenario "{name}" saved', { name }));
  },
  'scene-open'() {
    const scenes = state.ui.scenes || [];
    if (!scenes.length) { toast(t('No scenario saved yet: set the test up, give it a name and save it.')); return false; }
    const rows = scenes.map((s) => { const b = buildById(s.buildId); return [s.name, [b ? b.name || t('Unnamed') : t('a build that is gone'), s.ui.target || t('Any enemy'), (MODES.find(([k]) => k === s.ui.mode) || ['', ''])[1]].filter(Boolean).join(' · '), '', '', '']; });
    openChooser(t('Scenario'), t('The setups of the test saved by name: the build or party, the gear, the enemy, the difficulty and the plan of turns.'),
      [{ label: t('Scenario'), n: 1, min: 0, options: rows, chosen: [] }],
      (done) => {
        // (nothing is marked beforehand: choosing the scenario on screen again brings it back as it was saved)
        const s = scenes.find((x) => x.name === done[0].chosen[0]);
        if (!s) return;
        SCENE_KEYS.forEach((k) => { if (k in s.ui) state.ui[k] = clone(s.ui[k]); else delete state.ui[k]; });
        if (buildById(s.buildId)) { state.ui.buildId = s.buildId; state.ui.wizard = ''; } else toast(t('The build of this scenario is gone: it is shown with the build on screen.'));
        Object.keys(s.per || {}).forEach((id) => {
          [['simPlans', 'plan'], ['simReacts', 'react'], ['simHeals', 'heal'], ['simHits', 'hits']].forEach(([map, key]) => {
            const kept = s.per[id][key];
            if (kept == null) { if (state.ui[map]) delete state.ui[map][id]; } else (state.ui[map] || (state.ui[map] = {}))[id] = clone(kept);
          });
        });
        Object.assign(state.ui, { scene: s.id, sceneName: s.name });
      });
    return false;
  },
  async 'scene-del'() {
    const s = (state.ui.scenes || []).find((x) => x.id === state.ui.scene);
    if (!s || !(await ask(t('Delete the scenario "{name}"?', { name: s.name }), t('Delete'), true))) return false;
    state.ui.scenes = state.ui.scenes.filter((x) => x !== s);
    Object.assign(state.ui, { scene: '', sceneName: '' });
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
