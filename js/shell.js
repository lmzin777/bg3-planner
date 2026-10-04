// Page rendering, import/export of files and the confirmation dialog.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- render ----------
function render() {
  document.documentElement.lang = state.ui.lang;
  // Static text in index.html carries its English string in data-i18n / data-i18n-title.
  $('#version').textContent = 'v' + APP_VERSION;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.ui.tab));
  $$('#langs button').forEach((b) => b.classList.toggle('on', b.dataset.lang === state.ui.lang));
  const views = { party: renderParty, presets: renderPresets, items: renderItems, spells: renderSpells };
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

// Keep dependent creation fields consistent after one of them changes.
function creationChanged(b, path) {
  const c = b.creation;
  if (path === 'creation.origin') {
    const locked = (ORIGINS.find((o) => o[0] === c.origin) || [])[1];
    if (locked) {
      Object.assign(c, locked);
      toast(locked.race ? t("{name}'s race and background filled in", { name: c.origin }) : t('Background set to {bg}', { bg: locked.background }));
    }
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
