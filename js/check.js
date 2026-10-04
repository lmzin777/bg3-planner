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

// [{ level: 'warn' | 'note', where, text }] - 'warn' is something to fix or choose, 'note' is worth a look.
function buildIssues(b) {
  const out = [];
  const add = (level, where, text) => { if (!out.some((x) => x.where === where && x.text === text)) out.push({ level, where, text }); };
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
  if (!level) add('warn', progression, t('No class chosen yet'));
  else {
    if (level < 12) add('note', progression, t('{n} of 12 levels have a class', { n: level }));
    const last = b.levels.reduce((a, l, i) => (l.cls ? i : a), -1);
    b.levels.forEach((l, i) => { if (!l.cls && i < last) add('warn', progression, t('Level {n} has no class, but later levels do', { n: i + 1 })); });
    const levels = classLevels(b);
    Object.keys(levels).forEach((cls) => {
      const d = CLASS_DATA[cls];
      if (d && d.subclassLevel && levels[cls] >= d.subclassLevel && !info.some((x) => x.cls === cls && x.sub)) {
        add('warn', progression, t('{cls}: subclass not chosen (it is picked at {cls} level {n})', { cls, n: d.subclassLevel }));
      }
    });
    // choices the class makes while levelling: fighting style, invocations, metamagic, manoeuvres…
    Object.keys(levels).forEach((cls) => classChoices(b, cls).forEach((g) => {
      const have = chosenOf(b, cls, g).length;
      if (have < g.need) add('warn', progression, t('{cls}: {name} — {have} of {need} chosen', { cls, name: g.name, have, need: g.need }));
    }));
    b.levels.forEach((l, i) => {
      const x = info[i];
      if (!x.cls) return;
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
  ABILS.forEach(([ab, short]) => {
    if (Number((c.extra || {})[ab]) && ACTS.some(([act]) => abilityScores(b, act).sources[ab].length)) {
      add('note', numbers, t('{ab} has a manual bonus and is also changed by gear or the elixir: make sure it is not counted twice', { ab: short }));
    }
  });
  PERMANENT.forEach((p) => {
    const mine = (b.permanent || {})[p.n];
    if (mine && permanentEffect(p).choice && !mine.ab) add('warn', t('Permanent bonuses'), t('{name}: choose the ability it goes to', { name: p.n }));
  });
  if (b.elixir && !CONSUMABLE_BY_NAME.has(norm(b.elixir))) add('note', numbers, t('The elixir "{x}" is not in the database, so it changes no number', { x: b.elixir }));
  return out;
}

function checkLive(b) {
  const issues = buildIssues(b);
  const warns = issues.filter((x) => x.level === 'warn');
  const notes = issues.filter((x) => x.level === 'note');
  const open = state.ui.checkOpen !== false;
  const groups = [];
  issues.forEach((x) => { let g = groups.find((y) => y[0] === x.where); if (!g) groups.push(g = [x.where, []]); g[1].push(x); });
  const head = !issues.length ? `<span class="okline">${t('Nothing pending: every choice is made and the gear fits the build.')}</span>`
    : [warns.length ? `<b class="warn">${t('{n} to review', { n: warns.length })}</b>` : '', notes.length ? `<span class="muted">${t('{n} note(s)', { n: notes.length })}</span>` : ''].filter(Boolean).join(' · ');
  return `<div class="check-head"><h2>${t('Build check')}</h2><span>${head}</span>
      ${issues.length ? `<button class="btn tiny" data-act="check-toggle">${open ? t('Hide') : t('Show')}</button>` : ''}</div>
    ${issues.length && open ? `<div class="issues">${groups.map(([where, list]) => `<div><h4>${esc(where)}</h4><ul>${list.map((x) => `<li class="${x.level}">${esc(x.text)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}`;
}
const checkCard = (b) => `<section class="card check" id="check-live">${checkLive(b)}</section>`;

Object.assign(actions, {
  'check-toggle'() { state.ui.checkOpen = state.ui.checkOpen === false; },
});
