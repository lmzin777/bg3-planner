// The Build Planner view: build header, character creation, skills, level rows and gear by act.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- Build Planner ----------
function renderBuilds() {
  const b = curBuild();
  const dis = b ? '' : ' disabled';
  const list = state.builds.map((x) => {
    const pending = buildIssues(x).filter((i) => i.level === 'warn').length;
    return `<button class="side-item${b && x.id === b.id ? ' on' : ''}" data-act="build-select" data-id="${x.id}">
      <strong data-d="side-name-${x.id}">${esc(x.name || t('Unnamed'))}</strong>
      <small data-d="side-split-${x.id}">${esc(splitText(x))}</small>
      ${pending ? `<i class="badge" title="${t('{n} thing(s) to review in the build check', { n: pending })}">${pending}</i>` : ''}
    </button>`;
  }).join('');
  return `<div class="layout">
    <aside class="side">
      <div class="side-actions">
        <button class="btn primary wide" data-act="wiz-new" title="${t('Create a character one choice at a time, as in the game')}">${t('+ New build, step by step')}</button>
        <button class="btn wide" data-act="build-new">${t('+ New blank build')}</button>
        <button class="btn" data-act="build-dup"${dis}>${t('Duplicate')}</button>
        <button class="btn" data-act="export-open"${dis}>${t('Export')}</button>
        <button class="btn danger wide" data-act="build-del"${dis}>${t('Delete this build')}</button>
      </div>
      <h3>${t('My builds')}</h3>
      <div class="side-list">${list || `<p class="muted">${t('No builds yet.')}</p>`}</div>
      ${state.trash.length ? `<button class="btn tiny wide" data-act="trash-open">${t('Recently deleted ({n})', { n: state.trash.length })}</button>` : ''}
      <p class="hint">${t('To start a variation, duplicate a build and edit the copy. Everything is saved automatically in this browser.')}</p>
    </aside>
    <div class="content" data-scope="build">${b ? (state.ui.wizard && state.ui.wizardFor === b.id ? wizardView(b) : buildEditor(b)) : emptyBuilds()}</div>
  </div>`;
}

const emptyBuilds = () => `<section class="card empty"><h2>${t('No build selected')}</h2>
  <p>${t('Create a blank build or start from a ready-made one.')}</p>
  <div class="row-btns"><button class="btn primary" data-act="build-new">${t('+ New blank build')}</button>
  <button class="btn" data-act="tab" data-tab="presets">${t('See ready-made builds')}</button></div></section>`;

// The sections of the build page, in order: [key, title, short name for the menu]. The menu at the top jumps to them, and each can be folded.
const SECTIONS = [['overview', 'Overview', 'Overview'], ['check', 'Build check', 'Check'], ['creation', 'Character creation', 'Creation'], ['levels', 'Level progression', 'Levels'],
  ['numbers', 'Final numbers', 'Numbers'], ['traits', 'Traits', 'Traits'], ['spells', 'Spellbook', 'Spellbook'], ['permanent', 'Permanent bonuses', 'Permanent'], ['gear', 'Gear by act', 'Gear'],
  ['extras', 'Setup items and consumables', 'Consumables'], ['notes', 'Variants and notes', 'Notes']];
// One section: an anchor for the menu and a caret on its title that folds it. A folded section is not worked out at all.
function sec(key, body) {
  const title = t(SECTIONS.find((x) => x[0] === key)[1]);
  const caret = (open) => `<button class="caret" data-act="sec-toggle" data-s="${key}" title="${open ? t('Fold this section') : t('Open this section')}">${open ? '▾' : '▸'}</button>`;
  if ((state.ui.closed || {})[key]) return `<section class="card closed" id="sec-${key}"><h2>${caret(false)}${title}</h2></section>`;
  const html = body();
  if (!html) return '';
  const tagged = html.replace('<section class="card', `<section id="sec-${key}" class="card`);
  return /<h2>/.test(tagged) ? tagged.replace('<h2>', `<h2>${caret(true)}`) : tagged.replace(/(<section[^>]*>)/, `$1<h2>${caret(true)}${title}</h2>`);
}
const sectionNav = () => `<nav class="secnav" aria-label="${t('Sections of the build')}">${SECTIONS.map(([key, title, short]) =>
  `<button data-act="sec-go" data-s="${key}" title="${t(title)}"${(state.ui.closed || {})[key] ? ' class="off"' : ''}>${t(short)}</button>`).join('')}</nav>`;

function buildEditor(b) {
  const c = b.creation;
  const subs = RACES[c.race] || [];
  const choose = t('— choose —');
  return `
    ${state.ui.fromParty ? `<button class="btn back" data-act="back-party">${t('← Back to the party')}</button>` : ''}
    ${sectionNav()}
    <section class="card hero" id="sec-overview">
      <input class="title-input" type="text" data-path="name" value="${esc(b.name)}" placeholder="${t('Build name')}" aria-label="${t('Build name')}">
      <div class="split" data-d="split">${esc(splitText(b))}</div>
      <div class="grid g2">
        ${field(t('Party role'), 'role', b.role, t('e.g. ranged damage, support, control'))}
        <label class="field"><span>${t('Reference guide / video')}</span>
          <span class="with-btn"><input type="text" data-path="source" value="${esc(b.source)}" placeholder="https://…">
          <button class="icon" data-act="open-source" title="${t('Open link')}">↗</button></span></label>
      </div>
      <label class="field"><span>${t('Build concept')}</span>
        <textarea data-path="summary" rows="3" placeholder="${t('How the build plays, its strengths, what it needs to work…')}">${esc(b.summary)}</textarea></label>
      ${b.credit ? `<p class="credit">${t('Based on: {x}', { x: esc(b.credit) })}</p>` : ''}
    </section>

    <div id="sec-check">${checkCard(b)}</div>

    ${sec('creation', () => `<section class="card">
      <div class="check-head"><h2>${t('Character creation')}</h2><span></span>
        <button class="btn tiny" data-act="wiz-open">${t('Do it step by step')}</button></div>
      <div class="grid g4">
        ${creationField(t('Origin'), 'origin', c.origin, choose)}
        ${creationField(t('Race'), 'race', c.race, choose)}
        ${subs.length || c.subrace ? creationField(t('Subrace'), 'subrace', c.subrace, choose) : `<div class="field"><span>${t('Subrace')}</span><span class="pslot off"><b>${t('No subrace')}</b></span></div>`}
        ${creationField(t('Background'), 'background', c.background, choose)}
      </div>
      ${raceCantripField(b)}
      ${creationInfo(b)}
      <h3 class="group">${t('Ability scores')}</h3>
      ${abilitiesBlock(b)}
      <h3 class="group">${t('Skills')}</h3>
      ${skillsPicker(b)}
      <h3 class="group">${t('Equipment proficiencies')}</h3>
      <p class="points">${esc(profText(proficiencies(b)))}<br><span class="muted">${t('Worked out from the classes, subclasses, race and armour feats of this build. The item browser filters by it, and adds what the gear of the act grants.')}</span></p>
    </section>`)}

    ${sec('levels', () => `<section class="card">
      <div class="check-head"><h2>${t('Level progression')}</h2><span>${b.levels.some((l) => (l.notes || []).length)
        ? `<button class="btn tiny" data-act="notes-clear">${t('Remove the {n} line(s) that do not count', { n: b.levels.reduce((a, l) => a + (l.notes || []).length, 0) })}</button>` : ''}</span>
        <button class="btn tiny" data-act="wiz-levels">${t('Level up step by step')}</button></div>
      <div class="levels">${levelRows(b)}</div>
    </section>`)}

    ${sec('numbers', () => statsCard(b))}

    ${sec('traits', () => traitsCard(b))}

    ${sec('spells', () => spellbookCard(b))}

    ${sec('permanent', () => permanentCard(b))}

    ${sec('gear', () => `<section class="card">
      <h2>${t('Gear by act')}</h2>
      ${actTabs(state.ui.act, 'act', (k) => actProgress(b, k))}
      ${gearAct(b, state.ui.act)}
    </section>`)}

    ${sec('extras', () => `<section class="card">
      <div class="grid g2">
        <div><h2>${t('Setup items')}</h2>${simpleList(b, 'setup', t('Item'), t('What it is for / where to get it'))}</div>
        <div><h2>${t('Consumables')}</h2>${simpleList(b, 'consumables', t('Elixir, potion, arrow…'), t('Note'), 'consumable')}</div>
      </div>
    </section>`)}

    ${sec('notes', () => `<section class="card">
      <div class="grid g2">
        <label class="field"><span class="h">${t('Variants')}</span>
          <textarea data-path="variants" rows="9" placeholder="${t('Other level splits, feat swaps, themed versions…')}">${esc(b.variants)}</textarea></label>
        <label class="field"><span class="h">${t('Notes and tricks')}</span>
          <textarea data-path="notes" rows="9" placeholder="${t('Combat rotation, interactions, reminders…')}">${esc(b.notes)}</textarea></label>
      </div>
    </section>`)}`;
}

// Origin, race, subrace or background: what is chosen on a button that opens the list with what each option gives.
const creationField = (label, key, value, empty) => `<div class="field"><span>${label}</span>${slotButton('creation-open', `data-k="${key}"`, value, '', empty)}</div>`;
// What a race or subrace gives, as one line of text for a list of options.
function raceSummary(d) {
  return [d.speed ? t('Speed') + ' ' + d.speed : '', (d.prof || []).length ? t('Proficiencies') + ': ' + d.prof.join(', ') : '',
    (d.skills || []).length || d.skillPick ? t('Skills') + ': ' + [...(d.skills || []), d.skillPick ? t('one skill of your choice') : ''].filter(Boolean).join(', ') : '',
    (d.spells || []).length ? t('Spells') + ': ' + d.spells.map(([n, lv]) => n + ' (' + t('level {n}', { n: lv }) + ')').join(', ') : '',
    d.cantrip ? t('Cantrip') + ': ' + t('one from the {cls} list', { cls: d.cantrip }) : '',
    ...(d.features || []).map(([n, text]) => n + ': ' + text)].filter(Boolean).join(' · ');
}
// The options of one of those four lists: [name, what it gives, a short fact].
function creationOptions(b, key) {
  if (key === 'origin') return ORIGINS.map(([name]) => { const o = DATA.origins[name] || {}; return [name, o.text || '', o.cls ? t('Default class') + ': ' + o.cls : '']; });
  if (key === 'race') return Object.keys(RACES).map((name) => [name, raceSummary(DATA.races[name] || {})]);
  if (key === 'subrace') return (RACES[b.creation.race] || []).map((name) => [name, raceSummary(DATA.subraces[name] || {})]);
  return Object.keys(BACKGROUNDS).map((name) => [name, (DATA.backgrounds[name].text || '') + (name === 'Haunted One' ? ' ' + t('Haunted One (Dark Urge only)') + '.' : ''), BACKGROUNDS[name].join(', ')]);
}

// The six ability cards with the points spent and a way back to the start.
const abilitiesBlock = (b) => `<div class="abils">${ABILS.map(([ab, short, name]) => abilCard(b, ab, short, name)).join('')}</div>
  <div class="points-row"><p class="points" data-d="points">${pointsText(b)}</p>
    <button class="btn tiny" data-act="abil-reset">${t('Reset scores')}</button></div>`;
function abilCard(b, ab, short, name) {
  const f = finalOf(b, ab);
  const base = Number(b.creation.abilities[ab]) || 8;
  const used = pointsUsed(b);
  const cost = (POINT_COST[base + 1] || 0) - (POINT_COST[base] || 0);
  const short27 = used != null && base < 15 && used + cost > 27;  // the next point does not fit in the 27
  return `<div class="abil">
    <div class="abil-name">${short}<small>${t(name)}</small></div>
    <div class="abil-final"><b data-d="final-${ab}">${f}</b><i data-d="mod-${ab}">${modText(f)}</i></div>
    <div class="abil-base">${t('base')} ${stepper(base, `data-path="creation.abilities.${ab}"`, 8, 15,
      { off: short27, title: base >= 15 ? '' : short27 ? t('Not enough points left') : t('Costs {n} point(s)', { n: cost }) })}</div>
    <div class="bonus">
      <button class="${b.creation.plus2 === ab ? 'on' : ''}" data-act="bonus" data-ab="${ab}" data-n="2">+2</button>
      <button class="${b.creation.plus1 === ab ? 'on' : ''}" data-act="bonus" data-ab="${ab}" data-n="1">+1</button>
    </div>
  </div>`;
}
function pointsText(b) {
  const p = pointsUsed(b);
  if (p == null) return t('Point buy: base scores must be between 8 and 15.');
  return t('Point buy: <b class="{c}">{p} / 27</b> points used', { c: p === 27 ? 'ok' : 'warn', p })
    + (p > 27 ? t(' — over the limit') : p < 27 ? t(' — {n} left', { n: 27 - p }) : '');
}

const startingClass = (b) => (b.levels.find((l) => l.cls) || {}).cls || '';
// Skills granted outright by the background, race and subrace, as {skill: where it comes from}.
function grantedSkills(b) {
  const c = b.creation;
  const out = {};
  (BACKGROUNDS[c.background] || []).forEach((x) => { out[x] = c.background; });
  ((DATA.races[c.race] || {}).skills || []).forEach((x) => { out[x] = out[x] || c.race; });
  ((DATA.subraces[c.subrace] || {}).skills || []).forEach((x) => { out[x] = out[x] || c.subrace; });
  return out;
}
const profNames = (list) => list.map((x) => (x === SIMPLE ? t('Simple weapons') : x === MARTIAL ? t('Martial weapons') : x)).join(', ');

// Cards under the creation selectors that explain what each choice grants.
function creationInfo(b) {
  const c = b.creation;
  const row = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '');
  const card = (kind, title, body, empty) =>
    `<div class="info${title ? '' : ' none'}"><h4>${kind}</h4>${title ? `<strong>${esc(title)}</strong>${body}` : `<p class="muted">${empty}</p>`}</div>`;
  const traits = (d) => `<dl>${row(t('Speed'), esc(d.speed || ''))}${row(t('Proficiencies'), esc((d.prof || []).join(', ')))}${
    row(t('Skills'), esc([...(d.skills || []), d.skillPick ? t('one skill of your choice') : ''].filter(Boolean).join(', ')))}${
    row(t('Spells'), esc((d.spells || []).map(([n, lv]) => n + ' (' + t('level {n}', { n: lv }) + ')').join(', ')))}${
    row(t('Cantrip'), d.cantrip ? t('one from the {cls} list', { cls: d.cantrip }) : '')}</dl>${
    d.features ? `<ul>${d.features.map(([n, text]) => `<li><b>${esc(n)}</b> ${esc(text)}</li>`).join('')}</ul>` : ''}${
    d.note ? `<p class="muted">${esc(d.note)}</p>` : ''}`;
  const origin = DATA.origins[c.origin];
  const race = DATA.races[c.race];
  const sub = DATA.subraces[c.subrace];
  const bg = BACKGROUNDS[c.background];
  return `<div class="info-cards">
    ${card(t('Origin'), origin ? c.origin : '', origin ? `<p>${esc(origin.text)}</p>${origin.cls ? `<dl>${row(t('Default class'), esc(origin.cls + (origin.sub ? ' · ' + origin.sub : '')))}${
      origin.abilities ? row(t('Default abilities'), esc(ABILS.map(([k, short]) => origin.abilities[k] + (origin.plus2 === k ? 2 : origin.plus1 === k ? 1 : 0) + ' ' + short).join(' · '))) : ''}</dl>
      <button class="btn tiny" data-act="origin-defaults">${t("Use {name}'s class and abilities", { name: esc(c.origin) })}</button>` : ''}` : '', t('Choose an origin to see what it fixes.'))}
    ${card(t('Race'), race ? c.race : '', race ? traits(race) + `<p class="muted">${t('Every race: +2 to one ability and +1 to another, your choice.')}</p>` : '', t('Choose a race to see what it grants.'))}
    ${card(t('Subrace'), sub ? c.subrace : '', sub ? traits(sub) : '', (RACES[c.race] || []).length ? t('Choose a subrace to see what it adds.') : race ? t('This race has no subraces.') : t('Choose a race first.'))}
    ${card(t('Background'), bg ? c.background : '', bg ? `<p>${esc(DATA.backgrounds[c.background].text || '')}</p><dl>${row(t('Skills'), esc(bg.join(', ')))}</dl><p class="muted">${t('The background also decides which deeds earn Inspiration.')}</p>` : '', t('Choose a background to see its skills.'))}
  </div>`;
}

// ---------- skills ----------
// The creation screen shows skill bonuses for a level 1 character, when the proficiency bonus is +2.
const PROF_BONUS = 2;
const signed = (n) => (n >= 0 ? '+' : '') + n;
const skillAbility = (x) => { const g = SKILLS.find(([, list]) => list.includes(x)); return g ? g[0].toLowerCase() : ''; };
const abilityMod = (b, ab) => Math.floor((finalOf(b, ab) - 10) / 2);

// Skill proficiencies a class gives when it is added by multiclassing (the wiki's Classes page).
const MULTI_SKILLS = Object.fromEntries(Object.keys(DATA.classes).filter((c) => DATA.classes[c].multiSkills).map((c) => [c, DATA.classes[c].multiSkills]));
// Everything the skill section needs: what is chosen or granted, what is still missing above, and the pick limits.
function skillState(b) {
  const c = b.creation;
  const cls = startingClass(b);
  const ci = DATA.classes[cls];
  const granted = grantedSkills(b);
  const chosen = skillList(c.skills).filter((x) => !granted[x]);
  const onList = (x) => !!ci && (ci.skills === 'any' || ci.skills.includes(x));
  const human = !!(DATA.races[c.race] || {}).skillPick;  // a race that picks one more skill, of any kind: Human
  // classes added later that bring skill picks from their own list
  const multi = [...new Set(b.levels.map((l) => l.cls).filter(Boolean))].filter((k) => k !== cls && MULTI_SKILLS[k]);
  const multiPicks = multi.reduce((a, k) => a + MULTI_SKILLS[k], 0);
  const onMulti = (x) => multi.some((k) => DATA.classes[k].skills === 'any' || DATA.classes[k].skills.includes(x));
  const missing = [];
  if (!DATA.races[c.race]) missing.push(t('Race'));
  else if ((RACES[c.race] || []).length && !c.subrace) missing.push(t('Subrace'));
  if (!BACKGROUNDS[c.background]) missing.push(t('Background'));
  if (!ci) missing.push(t('the class of level 1, in Level progression'));
  const max = ci ? ci.pick + (human ? 1 : 0) + multiPicks : 0;
  const offList = chosen.filter((x) => !onList(x));
  const offAll = offList.filter((x) => !onMulti(x)).length;
  // A skill can be added while picks remain. Outside the starting class list, it has to fit a multiclass
  // pick (from that class's list) or the Human's extra pick (any skill).
  const canAdd = (x) => !missing.length && chosen.length < max
    && (onList(x) || (onMulti(x) && offList.length < multiPicks + (human ? 1 : 0)) || (human && offAll < 1));
  return { cls, ci, granted, chosen, onList: (x) => onList(x) || onMulti(x), human, missing, max, canAdd, multi };
}
const skillBonus = (b, st, x) => abilityMod(b, skillAbility(x)) + (st.granted[x] || st.chosen.includes(x) ? PROF_BONUS : 0);

// Skills grouped by ability, each with its level 1 bonus. Granted skills are locked on; the rest can be picked
// only after race, background and starting class are set, from the class list and up to the class limit.
function skillsPicker(b) {
  const st = skillState(b);
  const chip = (x) => {
    const bonus = `<i data-d="sk-${esc(x)}">${signed(skillBonus(b, st, x))}</i>`;
    if (st.granted[x]) return `<span class="chip bg" title="${esc(t('Granted by {source}', { source: st.granted[x] }))}">${esc(x)}${bonus}</span>`;
    const on = st.chosen.includes(x);
    const usable = on ? !st.missing.length : st.canAdd(x);
    const why = st.missing.length ? '' : !st.onList(x) && !(st.human && !on) ? t('Not on the {cls} skill list', { cls: st.cls }) : !on && !usable ? t('No picks left') : '';
    return `<button class="chip${on ? ' on' : ''}" data-act="skill" data-s="${esc(x)}"${usable ? '' : ' disabled'}${why ? ` title="${esc(why)}"` : ''}>${esc(x)}${bonus}</button>`;
  };
  const extra = st.chosen.filter((x) => !ALL_SKILLS.includes(x));
  const grantedText = Object.keys(st.granted).map((x) => `${x} (${st.granted[x]})`).join(', ');
  const status = st.missing.length
    ? `<p class="skill-lock">${t('Skills unlock once you choose: {list}', { list: st.missing.join(', ') })}</p>`
    : `<p class="points"><b class="${st.chosen.length > st.max ? 'warn' : st.chosen.length === st.max ? 'ok' : ''}">${t('{n} of {max} chosen', { n: st.chosen.length, max: st.max })}</b>${
      t(' · {cls} picks {pick} from its list', { cls: st.cls, pick: st.ci.pick })}${st.human ? t(' · {race} adds 1 of any skill', { race: b.creation.race }) : ''}${
      st.multi.map((k) => t(' · multiclassing into {cls} adds {n} from its list', { cls: k, n: MULTI_SKILLS[k] })).join('')}</p>`;
  return `${status}
    <div class="skill-groups${st.missing.length ? ' locked' : ''}">
      ${SKILLS.map(([ab, list]) => `<div class="skill-group"><span>${ab} <i data-d="skab-${ab}">${signed(abilityMod(b, ab.toLowerCase()))}</i></span>${list.map(chip).join('')}</div>`).join('')}
      ${extra.length ? `<div class="skill-group"><span>${t('Other')}</span>${extra.map(chip).join('')}</div>` : ''}
    </div>
    ${grantedText ? `<p class="points">${t('Granted: {list}', { list: esc(grantedText) })}</p>` : ''}
    <p class="muted">${t('The number is the bonus to checks with that skill at level 1: the ability modifier, plus the +2 proficiency bonus when you are proficient. Expertise is chosen in the level table, at the levels that grant it.')}</p>`;
}

const wikiButtons = (fillPath) =>
  `<button class="icon txt" data-act="wiki-fill" data-fill="${fillPath}" title="${t('Fill from bg3.wiki')}">Wiki</button>
   <button class="icon" data-act="wiki" title="${t('Open the wiki page')}">↗</button>`;
const browseButton = (fillPath, slot) => (ITEMS.length
  ? `<button class="icon txt" data-act="picker-open" data-fill="${fillPath}" data-slot="${slot}" title="${t('Browse the items this build can use in this slot')}">${t('Browse')}</button>` : '');
// A name field. With a slot it suggests items of that slot from the local database while typing;
// without one (setup items, consumables) it suggests page names from the wiki.
const nameInput = (path, value, ph, cls, slot) => (slot && (slot !== 'consumable' || CONSUMABLES.length)
  ? `<input type="text" class="${cls || ''}" autocomplete="off" data-suggest="${slot}" data-path="${path}" value="${esc(value)}" placeholder="${ph}">`
  : `<input type="text" class="${cls || ''} wiki-name" list="dl-wiki" autocomplete="off" data-path="${path}" value="${esc(value)}" placeholder="${ph}">`);

function gearAct(b, act) {
  const g = b.gear[act];
  const idx = ACTS.findIndex(([k]) => k === act);
  const groups = SLOT_GROUPS.map(([title, slots]) =>
    `<h3 class="group">${t(title)}</h3><div class="slots">${slots.map(([k, label]) => slotCard(g.slots[k], `gear.${act}.slots.${k}`, label)).join('')}</div>`).join('');
  const alts = g.alts.map((a, i) =>
    `<div class="alt">
      <select data-path="gear.${act}.alts.${i}.slot" data-rerender aria-label="${t('Slot')}">${SLOTS.map(([k, label]) => opt(k, t(label), a.slot)).join('')}</select>
      <span class="with-btn">${nameInput(`gear.${act}.alts.${i}.name`, a.name, t('Item name'), '', a.slot)}${browseButton(`gear.${act}.alts.${i}`, a.slot)}${wikiButtons(`gear.${act}.alts.${i}`)}</span>
      <textarea rows="1" data-path="gear.${act}.alts.${i}.where" placeholder="${t('Location — how to get it')}">${esc(a.where)}</textarea>
      <textarea rows="1" data-path="gear.${act}.alts.${i}.note" placeholder="${t('When to use it')}">${esc(a.note)}</textarea>
      <button class="icon x" data-act="alt-del" data-i="${i}" title="${t('Remove')}">×</button>
    </div>`).join('');
  return `<div class="gear-tools">
      ${idx > 0 ? `<button class="btn tiny" data-act="gear-copy-prev">${t('Copy gear from {act}', { act: t(ACTS[idx - 1][1]) })}</button>` : ''}
      <button class="btn tiny" data-act="gear-clear">${t('Clear this act')}</button>
      <span class="muted">${t('<em>Browse</em> lists the items this build can use in a slot. <em>Wiki</em> pulls rarity and location for a name you typed. "Where to find" uses the format <em>Location — how to get it</em>.')}</span>
    </div>
    ${groups}
    <h3 class="group">${t('Alternatives for this act')}</h3>
    <p class="muted">${t('Backup options for a slot: what to wear until you get the main item, or the swap for a variant of the build.')}</p>
    <div class="alts">${alts || `<p class="muted">${t('No alternatives yet.')}</p>`}</div>
    <button class="btn tiny" data-act="alt-add">${t('+ alternative')}</button>`;
}

function slotCard(s, path, label) {
  const known = ITEM_BY_NAME.get(norm(s.name));
  return `<div class="slot r-${esc(s.rarity)}${s.got ? ' got' : ''}">
    <div class="slot-head">
      ${known ? pic(known.i, 'pic small') : ''}<span class="slot-label">${t(label)}</span>
      <select class="rar" data-path="${path}.rarity" data-rerender aria-label="${t('Rarity')}">${RARITIES.map(([v, l]) => opt(v, t(l), s.rarity)).join('')}</select>
      <label class="chk" title="${t('Tick once you have the item')}"><input type="checkbox" data-path="${path}.got" data-rerender${s.got ? ' checked' : ''}> ${t('obtained')}</label>
    </div>
    <span class="with-btn">${nameInput(path + '.name', s.name, t('Item name'), 'item', path.split('.').pop())}${browseButton(path, path.split('.').pop())}${wikiButtons(path)}</span>
    <textarea rows="1" data-path="${path}.where" placeholder="${t('Location — how to get it')}">${esc(s.where)}</textarea>
    <textarea rows="1" data-path="${path}.note" placeholder="${t('Note (optional)')}">${esc(s.note)}</textarea>
  </div>`;
}

function simpleList(b, key, phName, phNote, suggest) {
  const rows = b[key].map((x, i) => {
    const known = suggest === 'consumable' ? CONSUMABLE_BY_NAME.get(norm(x.name)) : null;
    return `<div class="li"><span class="with-btn">${nameInput(`${key}.${i}.name`, x.name, phName, '', suggest)}${wikiButtons(`${key}.${i}`)}</span>
      <textarea rows="1" data-path="${key}.${i}.note" placeholder="${phNote}">${esc(x.note)}</textarea>
      <button class="icon x" data-act="list-del" data-list="${key}" data-i="${i}" title="${t('Remove')}">×</button>
      ${known ? `<p class="li-fx">${pic(known.i, 'pic small')}<span><b>${esc(known.t)}</b> · ${esc(known.x)}${known.du ? ' · ' + esc(known.du) : ''}</span></p>` : ''}</div>`;
  }).join('');
  return `<div class="list">${rows}</div><button class="btn tiny" data-act="list-add" data-list="${key}">${t('+ add')}</button>`;
}
