// Page rendering, import/export of files and the confirmation dialog.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- the menu ----------
// Three groups with what is inside each, and the damage test. Clicking a group opens all of it (every item, every
// spell, the three build pages side by side); an entry of its menu opens just that part.
let navShut = -1;  // the group whose menu was just used: it stays shut until the pointer moves to another
function navHtml() {
  const tab = state.ui.tab;
  const kind = lib.items.kind;
  const lv = lib.spells.lv;
  const entry = (label, attrs, on) => `<button class="${on ? 'on' : ''}" data-act="tab" ${attrs}>${esc(label)}</button>`;
  const groups = [
    [t('Builds'), 'data-tab="hub"', ['hub', 'builds', 'party', 'presets'].includes(tab), [
      entry(t('Build Planner'), 'data-tab="builds"', tab === 'builds'), entry(t('Party Planner'), 'data-tab="party"', tab === 'party'), entry(t('Ready-made builds'), 'data-tab="presets"', tab === 'presets')]],
    [t('Items'), 'data-tab="items" data-kind=""', tab === 'items', [entry(t('All items'), 'data-tab="items" data-kind=""', tab === 'items' && !kind),
      ...KINDS.map(([v, l]) => entry(t(l), `data-tab="items" data-kind="${v}"`, tab === 'items' && kind === v))]],
    [t('Spells'), 'data-tab="spells" data-lv=""', tab === 'spells', [entry(t('All spells'), 'data-tab="spells" data-lv=""', tab === 'spells' && !lv.length),
      ...[0, 1, 2, 3, 4, 5, 6].map((n) => entry(n ? t('Level {n}', { n }) : t('Cantrips'), `data-tab="spells" data-lv="${n}"`, tab === 'spells' && lv.length === 1 && lv[0] === String(n)))]],
  ];
  return groups.map(([label, attrs, on, entries], i) => `<div class="nav-group${navShut === i ? ' shut' : ''}">
      <button class="nav-top${on ? ' on' : ''}" data-act="tab" ${attrs} aria-haspopup="true">${esc(label)}<i>▾</i></button>
      <div class="nav-menu">${entries.join('')}</div></div>`).join('')
    + `<button class="nav-top${tab === 'damage' ? ' on' : ''}" data-act="tab" data-tab="damage">${t('Damage test')}</button>`
    // temporary: the list of things to check by hand (js/review.js)
    + `<button class="nav-top${tab === 'review' ? ' on' : ''}" data-act="tab" data-tab="review">${t('To check')}<i class="count">${reviewLeft()}</i></button>`;
}
// a menu that was just used opens again once the pointer goes to another group or leaves the menu
(() => {
  const open = (e) => {
    const g = e.type === 'mouseleave' ? null : e.target.closest('.nav-group');
    if (navShut < 0 || (g && [...g.parentNode.children].indexOf(g) === navShut)) return;
    navShut = -1;
    $$('#tabs .shut').forEach((x) => x.classList.remove('shut'));
  };
  $('#tabs').addEventListener('mouseover', open);
  $('#tabs').addEventListener('mouseleave', open);
})();

// ---------- render ----------
function render() {
  document.documentElement.lang = state.ui.lang;
  // Static text in index.html carries its English string in data-i18n / data-i18n-title.
  $('#version').textContent = 'v' + APP_VERSION;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $('#tabs').innerHTML = navHtml();
  $$('#langs button').forEach((b) => b.classList.toggle('on', b.dataset.lang === state.ui.lang));
  const views = { hub: renderHub, party: renderParty, presets: renderPresets, items: renderItems, spells: renderSpells, damage: renderDamage, review: renderReview };
  $('#app').innerHTML = (views[state.ui.tab] || renderBuilds)();
  // the section menu sticks below the header, which is sticky itself on wide screens
  const top = $('.top');
  document.documentElement.style.setProperty('--top-h', (getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0) + 'px');
  libRefresh();
}

// Update only the computed bits, without recreating fields (keeps focus while typing).
function refreshDerived() {
  if (state.ui.tab === 'party') {
    const p = curParty();
    const o = $('[data-change="party-select"] option:checked');
    if (o) o.textContent = p.name || t('Unnamed');
    p.members.forEach((m, i) => $$(`[data-ml="${i}"]`).forEach((el) => { el.textContent = memberLabel({ char: m.char, i }); }));
    return;
  }
  const b = curBuild();
  if (state.ui.tab !== 'builds' || !b) return;
  const set = (key, html) => { const el = $(`[data-d="${key}"]`); if (el) el.innerHTML = html; };
  set('split', esc(splitText(b)));
  set('side-name-' + b.id, esc(b.name || t('Unnamed')));
  set('side-split-' + b.id, esc(splitText(b)));
  ABILS.forEach(([ab]) => { const f = finalOf(b, ab); set('final-' + ab, f); set('mod-' + ab, modText(f)); });
  set('points', pointsText(b));
  const live = $('#stats-live');
  if (live) live.innerHTML = statsLive(b);
  const check = $('#check-live');
  if (check) check.innerHTML = checkLive(b);
  const st = skillState(b);
  ALL_SKILLS.forEach((x) => set('sk-' + x, signed(skillBonus(b, st, x))));
  SKILLS.forEach(([ab]) => set('skab-' + ab, signed(abilityMod(b, ab.toLowerCase()))));
}

// Keep dependent creation fields consistent after one of them changes. `before` is what the field held.
function creationChanged(b, path, before) {
  const c = b.creation;
  const lockOf = (name) => (ORIGINS.find((o) => o[0] === name) || [])[1];
  if (path === 'creation.origin') {
    // what the previous origin had fixed leaves with it: race, subrace, background, and its default
    // class and ability scores when they were not touched since
    const old = before && before !== c.origin ? lockOf(before) : null;
    if (old) {
      Object.keys(old).forEach((k) => { if (c[k] === old[k]) c[k] = ''; });
      if (!c.race) c.cantrip = '';
      const d = DATA.origins[before] || {};
      if (d.abilities && ABILS.every(([ab]) => Number(c.abilities[ab]) === d.abilities[ab]) && c.plus2 === d.plus2 && c.plus1 === d.plus1) {
        Object.assign(c, { abilities: blankBuild().creation.abilities, plus2: '', plus1: '' });
      }
      const first = b.levels[0];
      if (d.cls && first.cls === d.cls && !first.picks.length && b.levels.slice(1).every((l) => !l.cls)) Object.assign(first, { cls: '', sub: '' });
    }
    const locked = lockOf(c.origin);
    if (locked) {
      Object.assign(c, locked);
      toast(locked.race ? t("{name}'s race and background filled in", { name: c.origin }) : t('Background set to {bg}', { bg: locked.background }));
    } else if (old) toast(t("{name}'s choices cleared", { name: before }));
  }
  // an origin character with another race, subrace or background is no longer that character
  const field = /^creation\.(race|subrace|background)$/.exec(path);
  const fixed = field && lockOf(c.origin);
  if (fixed && fixed[field[1]] != null && c[field[1]] !== fixed[field[1]]) {
    toast(t('No longer {name}: the origin is now Custom', { name: c.origin }));
    c.origin = ORIGINS[0][0];
  }
  if (path === 'creation.race' && !(RACES[c.race] || []).includes(c.subrace)) c.subrace = '';
}

// ---------- import / export ----------
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'build';

// ---------- confirmation ----------
// Own dialog instead of confirm(): embedded browsers block native dialogs and return false at once.
function ask(message, okLabel, danger) {
  return new Promise((resolve) => {
    const m = $('#modal');
    const ok = $('#modal-ok');
    $('#modal-msg').textContent = message;
    ok.textContent = okLabel || t('Confirm');
    ok.className = 'btn ' + (danger ? 'danger solid' : 'primary');
    m.hidden = false;
    const done = (v) => {
      m.hidden = true;
      m.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onClick = (e) => {
      if (e.target === m || e.target.closest('#modal-cancel')) done(false);
      else if (e.target.closest('#modal-ok')) done(true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    m.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    $('#modal-cancel').focus();
  });
}
