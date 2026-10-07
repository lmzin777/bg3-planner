// The build check: every choice still to make and everything that does not add up, in one list.
'use strict';

// Items other members of a party carry in an act, as {item name: who}. Common gear is not unique, so it is left out.
function partyTaken(b, act) {
  const out = {};
  const parties = state.parties.filter((p) => p.members.some((m) => m.buildId === b.id));
  // the party on screen comes first, so its names win when the build sits in several parties
  parties.sort((x, y) => (y.id === state.ui.partyId) - (x.id === state.ui.partyId)).forEach((p) => p.members.forEach((m, i) => {
    const other = m.buildId !== b.id && buildById(m.buildId);
    if (!other) return;
    Object.values(wornItems(other, act)).forEach((it) => {
      if (it.r !== 'common' && !out[norm(it.n)]) out[norm(it.n)] = memberLabel({ char: m.char, i }) + (parties.length > 1 ? ' (' + p.name + ')' : '');
    });
  }));
  return out;
}

// What one level still has to choose, as short texts: the class, the subclass, a feat and its options,
// Expertise, the choices the level opens, and the spells and cantrips it teaches.
function levelPending(b, i) {
  const l = b.levels[i];
  const x = levelInfo(b)[i];
  if (!l.cls) return [t('class not chosen')];
  const out = [];
  if (picksSubclass(x) && !x.sub) out.push(t('subclass not chosen'));
  if (grantsFeat(x) && !l.picks.some((p) => /^feat\b/i.test(p.trim()))) out.push(t('feat not chosen'));
  l.picks.forEach((p) => {
    const m = /^feat\s*:\s*([^(+]+?)\s*$/i.exec(p.trim());
    const feat = m && FEATS.find(([name]) => norm(name) === norm(m[1]));
    if (feat && featParts(feat[0], feat[1], b).length) out.push(t('{feat}: options not chosen', { feat: feat[0] }));
  });
  const expert = levelSlots(b, i).expertise;
  if (expert && expert.values.length < 2) out.push(expert.j < 0 ? t('Expertise not chosen') : 'Expertise: ' + t('{n} of {max}', { n: expert.values.length, max: 2 }));
  levelChoices(x).forEach((c) => {
    const have = chosenOf(b, x.cls, c.group, i).length;
    if (have < c.n) out.push(c.group.name + ': ' + t('{n} of {max}', { n: have, max: c.n }));
  });
  // counted slot by slot: a spare spell line does not stand in for a cantrip that is still to choose
  const sp = levelSlots(b, i).spells;
  const need = sp ? sp.learn.spells + sp.learn.cantrips : 0;
  const have = sp ? sp.spell.length + sp.cantrip.length : 0;
  if (have < need) out.push(t('spells and cantrips: {n} of {max}', { n: have, max: need }));
  return out;
}

// [{ level: 'warn' | 'note', where, text, go }] - 'warn' is something to fix or choose, 'note' is worth a look.
// `go` says where in the build it is settled: { s: the section, l: the level (from 0), a: the act of the gear }.
function buildIssues(b) {
  const out = [];
  let go = { s: 'creation' };
  const add = (level, where, text) => { if (!out.some((x) => x.where === where && x.text === text)) out.push({ level, where, text, go }); };
  const c = b.creation;
  const info = levelInfo(b);
  const level = charLevel(b);

  const creation = t('Character creation');
  if (!DATA.races[c.race]) add('warn', creation, t('Race not chosen'));
  else if ((RACES[c.race] || []).length && !c.subrace) add('warn', creation, t('Subrace not chosen'));
  if (!BACKGROUNDS[c.background]) add('warn', creation, t('Background not chosen'));
  const points = pointsUsed(b);
  if (points == null) add('warn', creation, t('Base ability scores must be between 8 and 15'));
  else if (points > 27) add('warn', creation, t('Point buy is {n} over the 27 points', { n: points - 27 }));
  else if (points < 27) add('warn', creation, t('{n} point(s) of point buy left to spend', { n: 27 - points }));
  if (!c.plus2 || !c.plus1) add('warn', creation, t('The +2 and +1 ability bonuses are not both assigned'));
  if (raceCantrips(b).length && !c.cantrip) add('warn', creation, t('Racial cantrip not chosen'));
  const st = skillState(b);
  if (!st.missing.length) {
    if (st.chosen.length > st.max) add('warn', creation, t('{n} skill(s) more than the build can choose', { n: st.chosen.length - st.max }));
    else if (st.chosen.length < st.max) add('warn', creation, t('{n} skill pick(s) left', { n: st.max - st.chosen.length }));
  }

  const progression = t('Level progression');
  go = { s: 'levels' };
  if (!level) add('warn', progression, t('No class chosen yet'));
  else {
    if (level < 12) add('note', progression, t('{n} of 12 levels have a class', { n: level }));
    const last = b.levels.reduce((a, l, i) => (l.cls ? i : a), -1);
    b.levels.forEach((l, i) => { go = { s: 'levels', l: i }; if (!l.cls && i < last) add('warn', progression, t('Level {n} has no class, but later levels do', { n: i + 1 })); });
    go = { s: 'levels' };
    const levels = classLevels(b);
    Object.keys(levels).forEach((cls) => {
      const d = CLASS_DATA[cls];
      if (d && d.subclassLevel && levels[cls] >= d.subclassLevel && !info.some((x) => x.cls === cls && x.sub)) {
        // (the way there is the level at which the class picks it)
        const at = info.findIndex((x) => x.cls === cls && x.n === d.subclassLevel);
        go = at >= 0 ? { s: 'levels', l: at } : { s: 'levels' };
        add('warn', progression, t('{cls}: subclass not chosen (it is picked at {cls} level {n})', { cls, n: d.subclassLevel }));
      }
    });
    // choices the class makes while levelling: fighting style, invocations, metamagic, manoeuvres…
    Object.keys(levels).forEach((cls) => classChoices(b, cls).forEach((g) => {
      const have = chosenOf(b, cls, g).length;
      // (the way there is the first level of the class that still has one of them to choose)
      const at = have < g.need ? b.levels.findIndex((l, i) => info[i].cls === cls && levelPending(b, i).some((x) => x.indexOf(g.name + ':') === 0)) : -1;
      go = at >= 0 ? { s: 'levels', l: at } : { s: 'levels' };
      if (have < g.need) add('warn', progression, t('{cls}: {name} — {have} of {need} chosen', { cls, name: g.name, have, need: g.need }));
    }));
    b.levels.forEach((l, i) => {
      const x = info[i];
      if (!x.cls) return;
      go = { s: 'levels', l: i };
      const n = i + 1;
      if (grantsFeat(x) && !l.picks.some((p) => /^feat\b/i.test(p.trim()))) add('warn', progression, t('Level {n}: feat not chosen', { n }));
      // a feat that asks for more (an ability, skills, spells…) written without them
      l.picks.forEach((p) => {
        const m = /^feat\s*:\s*([^(+]+?)\s*$/i.exec(p.trim());
        const feat = m && FEATS.find(([name]) => norm(name) === norm(m[1]));
        if (feat && featParts(feat[0], feat[1], b).length) add('warn', progression, t('Level {n}: {feat} — its options are not chosen', { n, feat: feat[0] }));
      });
      if (grantsExpertise(x) && !l.picks.some((p) => /^expertise\b/i.test(p.trim()))) add('warn', progression, t('Level {n}: Expertise not chosen', { n }));
      const max = maxSpellLevel(b, i);
      l.picks.forEach((p) => {
        const m = /^spells?\s*:\s*([^(]+)/i.exec(p.trim());
        const s = m && SPELL_BY_NAME.get(norm(m[1]));
        // spells a subclass, race or item hands out do not go through the class's own progression
        if (s && max > 0 && s.lv > max && (s.cl || []).includes(x.cls)) {
          add('warn', progression, t('Level {n}: {spell} is a level {lv} spell, and {cls} {k} learns up to level {max}', { n, spell: s.n, lv: s.lv, cls: x.cls, k: x.n, max }));
        }
      });
    });
    // the same feat twice is not possible in the game (Ability Improvement is)
    go = { s: 'levels' };
    const feats = featsTaken(b).filter((y) => y.name !== 'Ability Improvement');
    feats.forEach((y, k) => { const first = feats.findIndex((z) => z.name === y.name); go = { s: 'levels', l: y.level }; if (first < k) add('warn', progression, t('{feat} is taken twice, at levels {a} and {b}', { feat: y.name, a: feats[first].level + 1, b: y.level + 1 })); });
    go = { s: 'spells' };
    Object.keys(b.prepared || {}).forEach((cls) => { const max = preparedMax(b, cls); if (b.prepared[cls].length > max) add('warn', progression, t('{cls}: {n} spells prepared, it can prepare {max}', { cls, n: b.prepared[cls].length, max })); });
    go = { s: 'levels' };
    const loose = b.levels.reduce((a, l) => a + (l.notes || []).length, 0);
    if (loose) add('note', progression, t('{n} line(s) in the levels are not a choice of their level and do not count', { n: loose }));
    // notes, not errors: a spell granted by race or feat may be written among the choices, and a planner
    // does not have to list every spell a wizard will learn
    knownSpells(b).forEach((k) => {
      if (k.maxCantrips && k.cantrips > k.maxCantrips) add('note', progression, t('{cls}: {n} cantrips chosen, the class knows {max} at this level', { cls: k.label, n: k.cantrips, max: k.maxCantrips }));
      else if (k.cantrips < k.maxCantrips) add('note', progression, t('{cls}: {n} of {max} cantrips chosen', { cls: k.label, n: k.cantrips, max: k.maxCantrips }));
      if (k.maxSpells && k.spells > k.maxSpells && !PREPARES.includes(k.cls)) add('note', progression, t('{cls}: {n} spells chosen, the class knows {max} at this level', { cls: k.label, n: k.spells, max: k.maxSpells }));
      else if (k.spells < k.maxSpells) add('note', progression, t('{cls}: {n} of {max} spells chosen', { cls: k.label, n: k.spells, max: k.maxSpells }));
      if (k.schools && k.offSchool > k.maxAny) add('warn', progression, t('{cls}: {n} spells outside {schools}, and only {max} may be', { cls: k.label, n: k.offSchool, schools: k.schools.join(' / '), max: k.maxAny }));
    });
  }

  ACTS.forEach(([act, label], ai) => {
    const where = t('Gear · {act}', { act: t(label) });
    go = { s: 'gear', a: act };
    const worn = wornItems(b, act);
    const prof = proficiencies(b, act);
    const taken = partyTaken(b, act);
    Object.entries(worn).forEach(([slot, it]) => {
      if (!(SLOT_KINDS[slot] || []).includes(it.s)) add('warn', where, t('{item} does not go in the {slot} slot', { item: it.n, slot: t(SLOT_LABEL[slot]) }));
      // armour without proficiency cripples the character; a weapon only loses its proficiency bonus,
      // and some are carried just for their passive effect
      else if (level && !canUse(it, prof)) add(isWeapon(it) ? 'note' : 'warn', where, t('{item}: the build is not proficient with {what}', { item: it.n, what: isWeapon(it) ? it.t : it.p }));
      const fit = itemFit(it, b);
      if (!fit.ok) add('note', where, t('{item}: its effects are for {x}, which this build is not', { item: it.n, x: fit.missing.join(', ') }));
      if (it.a > ai + 1) add('warn', where, t('{item} is only found in Act {n}', { item: it.n, n: it.a }));
      if (taken[norm(it.n)]) add('warn', where, t('{item} is also worn by {who}', { item: it.n, who: taken[norm(it.n)] }));
    });
    [['meleeMain', 'meleeOff'], ['rangedMain', 'rangedOff']].forEach(([main, off]) => {
      if (worn[main] && worn[off] && worn[main].w === 'two') add('warn', where, t('{item} needs both hands, so the off-hand item cannot be used with it', { item: worn[main].n }));
      else if (worn[off] && isWeapon(worn[off]) && !canOffHand(worn[off], b)) add('warn', where, t('{item} in the off hand needs the Light property or the Dual Wielder feat', { item: worn[off].n }));
    });
    if (worn.ring1 && worn.ring1 === worn.ring2) add('warn', where, t('{item} is in both ring slots', { item: worn.ring1.n }));
  });

  const numbers = t('Final numbers');
  go = { s: 'numbers' };
  ABILS.forEach(([ab, short]) => {
    if (Number((c.extra || {})[ab]) && ACTS.some(([act]) => abilityScores(b, act).sources[ab].length)) {
      add('note', numbers, t('{ab} has a manual bonus and is also changed by gear or the elixir: make sure it is not counted twice', { ab: short }));
    }
  });
  go = { s: 'permanent' };
  PERMANENT.forEach((p) => {
    const mine = (b.permanent || {})[p.n];
    if (mine && permanentEffect(p).choice && !mine.ab) add('warn', t('Permanent bonuses'), t('{name}: choose the ability it goes to', { name: p.n }));
  });
  go = { s: 'numbers' };
  if (b.elixir && !CONSUMABLE_BY_NAME.has(norm(b.elixir))) add('note', numbers, t('The elixir "{x}" is not in the database, so it changes no number', { x: b.elixir }));
  return out;
}

function checkLive(b) {
  const issues = buildIssues(b);
  const warns = issues.filter((x) => x.level === 'warn');
  const notes = issues.filter((x) => x.level === 'note');
  const groups = [];
  issues.forEach((x) => { let g = groups.find((y) => y[0] === x.where); if (!g) groups.push(g = [x.where, []]); g[1].push(x); });
  const head = !issues.length ? `<span class="okline">${t('Nothing pending: every choice is made and the gear fits the build.')}</span>`
    : [warns.length ? `<b class="warn">${t('{n} to review', { n: warns.length })}</b>` : '', notes.length ? `<span class="muted">${t('{n} note(s)', { n: notes.length })}</span>` : ''].filter(Boolean).join(' · ');
  // every entry is a way to where it is settled: its section, its level, the gear of its act
  const link = (x, text, cls) => `<button class="${cls}" data-act="check-go" data-s="${x.go.s}"${x.go.l != null ? ` data-l="${x.go.l}"` : ''}${x.go.a ? ` data-a="${x.go.a}"` : ''} title="${t('Go there to settle it')}">${text}</button>`;
  return `<div class="check-head"><h2>${t('Build check')}</h2><span>${head}</span></div>
    ${issues.length ? `<div class="issues">${groups.map(([where, list]) => `<div><h4>${link({ go: { s: list[0].go.s, a: list[0].go.a } }, esc(where) + ' <i>→</i>', 'issue-where')}</h4>
      <ul>${list.map((x) => `<li class="${x.level}">${link(x, esc(x.text) + ' <i>→</i>', 'issue')}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}`;
}
const checkCard = (b) => `<section class="card check" id="check-live">${checkLive(b)}</section>`;
// On a screen with no room for the check at the side, a button that follows the page: how much is pending, and the
// whole list at a click (kept open or shut for as long as the page is).
let checkOpen = false;
function checkFab(b) {
  const warns = buildIssues(b).filter((x) => x.level === 'warn').length;
  return `<div class="check-fab" id="check-fab">
    ${checkOpen ? `<div class="check-pop card">${checkLive(b)}</div>` : ''}
    <button class="check-fab-btn${warns ? '' : ' ok'}" data-act="check-fab" aria-expanded="${checkOpen}" title="${t('What is still to choose or to review in this build')}">${t('Build check')} <b>${warns || '✓'}</b></button></div>`;
}

Object.assign(actions, {
  // from an entry of the check to where it is settled: the section is opened, the gear is set to the act, and the
  // level (or the section) comes into view, lit for a moment
  'check-fab'() { checkOpen = !checkOpen; },
  'check-go'(el) {
    checkOpen = false;
    const key = el.dataset.s;
    (state.ui.closed || (state.ui.closed = {}))[key] = false;
    if (el.dataset.a) state.ui.act = el.dataset.a;
    save();
    render();
    const sec = $('#sec-' + key);
    const row = sec && el.dataset.l != null ? sec.querySelectorAll('.lvl')[Number(el.dataset.l)] : null;
    const target = row || sec;
    if (!target) return false;
    target.scrollIntoView({ block: row ? 'center' : 'start' });
    target.classList.add('lit');
    setTimeout(() => target.classList.remove('lit'), 1800);
    return false;
  },
});
