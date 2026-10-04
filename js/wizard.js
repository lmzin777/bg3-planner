// Step-by-step character creation, in the order of the game's own screen: origin, race, subrace, class,
// subclass, background, abilities, skills, the choices of level 1, and a summary. It edits the same build
// the full planner shows; leaving it at any point keeps what was chosen.
'use strict';

// [key, title, hint, applies(b)]
const WIZ_STEPS = [
  ['origin', 'Origin', 'A custom character, or one of the origin characters with a fixed race and background.', () => true],
  ['race', 'Race', 'The race sets movement speed, some proficiencies and features.', () => true],
  ['subrace', 'Subrace', 'What the subrace adds on top of the race.', (b) => (RACES[b.creation.race] || []).length > 0],
  ['class', 'Class', 'The class of level 1. It decides the saving throws, the starting proficiencies and the skill list.', () => true],
  ['subclass', 'Subclass', 'This class chooses its subclass at level 1.', (b) => (CLASS_DATA[startingClass(b)] || {}).subclassLevel === 1],
  ['background', 'Background', 'The background grants two skills.', () => true],
  ['abilities', 'Abilities', 'Spend 27 points, then give +2 to one ability and +1 to another.', () => true],
  ['skills', 'Skills', 'Skills granted by the choices so far are locked on; pick the rest from the class list.', () => true],
  ['level1', 'Level 1 choices', 'What the class chooses at level 1: fighting style, cantrips, spells and the like.', (b) => !!startingClass(b)],
  ['done', 'Summary', 'What is set and what is still open. The other 11 levels and the gear are planned in the Build Planner.', () => true],
];
const wizSteps = (b) => WIZ_STEPS.filter((s) => s[3](b));
// Whether a step has what it asks for, to mark it in the step bar.
function wizDone(b, key) {
  const c = b.creation;
  const st = skillState(b);
  if (key === 'origin') return !!c.origin;
  if (key === 'race') return !!DATA.races[c.race];
  if (key === 'subrace') return !!c.subrace;
  if (key === 'class') return !!startingClass(b);
  if (key === 'subclass') return !!levelInfo(b)[0].sub;
  if (key === 'background') return !!BACKGROUNDS[c.background];
  if (key === 'abilities') return pointsUsed(b) === 27 && !!c.plus2 && !!c.plus1;
  if (key === 'skills') return !st.missing.length && st.chosen.length >= st.max;
  if (key === 'level1') {
    const x = levelInfo(b)[0];
    const learn = spellsAtLevel(x) || { spells: 0, cantrips: 0 };
    const picks = b.levels[0].picks;
    return levelChoices(x).every((ch) => chosenOf(b, x.cls, classChoices(b, x.cls).find((g) => g.name === ch.group.name) || ch.group).length >= ch.n)
      && picks.filter((p) => /^(spell|cantrip)s?\s*:/i.test(p.trim())).length >= learn.spells + learn.cantrips
      && (!grantsExpertise(x) || picks.some((p) => /^expertise\b/i.test(p.trim()))) && (!raceCantrips(b).length || !!c.cantrip);
  }
  return !buildIssues(b).some((x) => x.level === 'warn' && x.where === t('Character creation'));
}

const wizCard = (path, value, on, title, body) =>
  `<button class="wiz-card${on ? ' on' : ''}" data-act="wiz-set" data-path="${path}" data-v="${esc(value)}"><strong>${esc(title)}</strong>${body}</button>`;
const wizList = (items) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
const wizTraits = (d) => wizList([d.speed ? t('Speed') + ' ' + esc(d.speed) : '', (d.prof || []).length ? t('Proficiencies') + ': ' + esc(d.prof.join(', ')) : '',
  (d.skills || []).length || d.skillNote ? t('Skills') + ': ' + esc([...(d.skills || []), d.skillNote].filter(Boolean).join(', ')) : '',
  ...(d.features || []).map(([n, text]) => `<b>${esc(n)}</b> ${esc(text)}`), d.note ? esc(d.note) : ''].filter(Boolean));

function wizBody(b, key) {
  const c = b.creation;
  if (key === 'origin') {
    return `<div class="wiz-cards">${ORIGINS.map(([name]) => wizCard('creation.origin', name, c.origin === name, name,
      `<small>${esc((DATA.origins[name] || {}).text || '')}</small>${(DATA.origins[name] || {}).cls ? `<small>${t('Default class')}: ${esc(DATA.origins[name].cls)}</small>` : ''}`)).join('')}</div>`;
  }
  if (key === 'race') {
    return `<div class="wiz-cards">${Object.keys(RACES).map((name) => wizCard('creation.race', name, c.race === name, name, wizTraits(DATA.races[name] || {}))).join('')}</div>
      <p class="muted">${t('Every race: +2 to one ability and +1 to another, your choice.')}</p>`;
  }
  if (key === 'subrace') {
    return `<div class="wiz-cards">${(RACES[c.race] || []).map((name) => wizCard('creation.subrace', name, c.subrace === name, name, wizTraits(DATA.subraces[name] || {}))).join('')}</div>
      ${raceCantrips(b).length ? `<div class="grid g4">${selectField(t('Racial cantrip'), 'creation.cantrip', c.cantrip, raceCantrips(b), t('— choose —'), 'data-rerender')}</div>` : ''}`;
  }
  if (key === 'class') {
    return `<div class="wiz-cards">${CLASSES.map((name) => {
      const ci = DATA.classes[name];
      const gains = ((CLASS_DATA[name] || { levels: {} }).levels[1] || []).filter((g) => !GENERIC_GAIN.test(g));
      return wizCard('class', name, startingClass(b) === name, name, wizList([
        t('Hit points') + ': ' + t('{first} at level 1, then {next} per level, plus the Constitution modifier', { first: HIT_DIE[name], next: HIT_DIE[name] / 2 + 1 }),
        t('Saving throws') + ': ' + ci.saves.map((x) => t(x)).join(', '),
        t('Proficiencies') + ': ' + esc(profNames(CLASS_PROF[name].start)),
        t('Skills') + ': ' + t('Choose {n} from: {list}', { n: ci.pick, list: ci.skills === 'any' ? t('any skill') : esc(ci.skills.join(', ')) }),
        gains.length ? `<b>${t('Level 1')}</b> ${esc(gains.join(' · '))}` : '']));
    }).join('')}</div>`;
  }
  if (key === 'subclass') {
    const cls = startingClass(b);
    const cur = levelInfo(b)[0].sub;
    return `<div class="wiz-cards">${Object.keys(CLASS_DATA[cls].subclasses).map((name) => {
      const gains = CLASS_DATA[cls].subclasses[name][1] || [];
      return wizCard('subclass', subLabel(name), cur === name, subLabel(name), wizList(gains.map((g) => `<b>${esc(g)}</b> ${esc(featureText(g))}`)));
    }).join('')}</div>`;
  }
  if (key === 'background') {
    return `<div class="wiz-cards">${Object.keys(BACKGROUNDS).map((name) => wizCard('creation.background', name, c.background === name, name,
      `<small>${esc(DATA.backgrounds[name] || '')}</small><small>${t('Skills')}: ${esc(BACKGROUNDS[name].join(', '))}</small>`)).join('')}</div>`;
  }
  if (key === 'abilities') {
    return `<div class="abils">${ABILS.map(([ab, short, name]) => abilCard(b, ab, short, name)).join('')}</div>
      <p class="points" data-d="points">${pointsText(b)}</p>
      <p class="muted">${t('Base scores go from 8 to 15. The +2 and +1 buttons are the bonuses every race gives.')}</p>`;
  }
  if (key === 'skills') return skillsPicker(b);
  if (key === 'level1') {
    return `<div class="levels">${levelRows(b, 0)}</div>
      ${raceCantrips(b).length ? `<div class="grid g4">${selectField(t('Racial cantrip'), 'creation.cantrip', c.cantrip, raceCantrips(b), t('— choose —'), 'data-rerender')}</div>` : ''}`;
  }
  const s = finalStats(b, 'act1', { level: 1 });
  return `<label class="field"><span>${t('Build name')}</span><input type="text" data-path="name" value="${esc(b.name)}"></label>
    <dl class="wiz-sum">${[[t('Origin'), c.origin], [t('Race'), raceText(c)], [t('Class'), splitText(atLevel(b, 1))], [t('Background'), c.background],
      [t('Abilities'), abilLine(b)], [t('Skills'), [...Object.keys(skillState(b).granted), ...skillState(b).chosen].join(', ')],
      [t('Hit points'), s.level ? s.hp : ''], [t('Armour Class'), s.level ? s.ac.act1 : '']].filter((x) => String(x[1]).trim())
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div id="check-live" class="check">${checkLive(b)}</div>`;
}

function wizardView(b) {
  const steps = wizSteps(b);
  let i = steps.findIndex((s) => s[0] === state.ui.wizard);
  if (i < 0) i = 0;
  const [key, title, hint] = steps[i];
  return `<section class="card hero wiz">
    <div class="wiz-bar">${steps.map((s, k) => `<button class="${k === i ? 'on' : ''}${wizDone(b, s[0]) ? ' done' : ''}" data-act="wiz-go" data-s="${s[0]}"><i>${k + 1}</i>${t(s[1])}</button>`).join('')}</div>
    <h1>${t(title)}</h1><p class="muted">${t(hint)}</p>
    ${wizBody(b, key)}
    <div class="modal-btns wiz-nav">
      <button class="btn" data-act="wiz-close">${t('Leave the step by step')}</button>
      <span>${i > 0 ? `<button class="btn" data-act="wiz-go" data-s="${steps[i - 1][0]}">${t('← Back')}</button>` : ''}
        ${i < steps.length - 1 ? `<button class="btn primary" data-act="wiz-go" data-s="${steps[i + 1][0]}">${t('Next')} →</button>`
          : `<button class="btn primary" data-act="wiz-close">${t('Open in the Build Planner')}</button>`}</span>
    </div>
  </section>`;
}

Object.assign(actions, {
  'wiz-new'() {
    const b = blankBuild();
    state.builds.push(b);
    state.ui.buildId = b.id;
    state.ui.tab = 'builds';
    state.ui.wizard = 'origin';
    state.ui.wizardFor = b.id;
    return { top: true };
  },
  'wiz-open'() { state.ui.wizard = 'origin'; state.ui.wizardFor = curBuild().id; return { top: true }; },
  'wiz-go'(el) { state.ui.wizard = el.dataset.s; return { top: true }; },
  'wiz-close'() { state.ui.wizard = ''; return { top: true }; },
  'wiz-set'(el) {
    const b = curBuild();
    const path = el.dataset.path;
    const v = el.dataset.v;
    if (path === 'class') {
      // a new starting class: its level 1 choices and its subclass no longer apply
      if (b.levels[0].cls !== v) Object.assign(b.levels[0], { cls: v, sub: '', picks: [] });
    } else if (path === 'subclass') b.levels[0].sub = v;
    else { setPath(b, path, v); creationChanged(b, path); }
  },
});
