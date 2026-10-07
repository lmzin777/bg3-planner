// Actions behind every button, the event listeners, and the first render. Loaded last.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- actions ----------
// An action returns false to skip the save + re-render, or { focus, top } hints for after it.
// ---------- undo ----------
// Every change to a build keeps the build as it was before, so that the last change can be taken back, one after
// the other (kept while the page is open). A run of typing in one field is one step.
const UNDO_MAX = 40;
const undoStack = [];  // [{ id, json }], the latest last
let undoTyping = '';   // the field being typed in
const buildJson = (b) => (b ? JSON.stringify(b) : '');
function undoPush(id, json) {
  const last = undoStack[undoStack.length - 1];
  if (!json || (last && last.id === id && last.json === json)) return;
  undoStack.push({ id, json });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}
const undoCount = (b) => (b ? undoStack.filter((x) => x.id === b.id).length : 0);
const UNDO_ACTS = ['build-undo', 'undo-levels'];

Object.assign(actions, {
  tab(el) {
    state.ui.tab = el.dataset.tab;
    state.ui.fromParty = false;
    if (el.dataset.tab === 'updates') state.ui.seenVersion = APP_VERSION;
    // an entry of the Items or Spells menu opens the list on just that slot or level; the group itself, on all of it
    const only = el.dataset.kind != null ? ['items', 'kind', el.dataset.kind] : el.dataset.lv != null ? ['spells', 'lv', el.dataset.lv ? [el.dataset.lv] : []] : null;
    if (only) {
      const f = libState(only[0]);
      Object.keys(LIB_DEFAULTS[only[0]]).forEach((k) => { if (!LIB_VIEW_KEYS.includes(k)) f[k] = clone(LIB_DEFAULTS[only[0]][k]); });
      f[only[1]] = only[2];
      f.limit = PAGE;
    }
    // the menu it came from closes
    const group = el.closest('.nav-group');
    navShut = group ? [...group.parentNode.children].indexOf(group) : -1;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  },
  lang(el) { state.ui.lang = el.dataset.lang; },
  'build-select'(el) { state.ui.buildId = el.dataset.id; state.ui.fromParty = false; state.ui.wizard = ''; if (el.dataset.go) state.ui.tab = el.dataset.go; },
  'party-open'(el) { state.ui.partyId = el.dataset.id; state.ui.tab = 'party'; },
  'build-new'() { const b = blankBuild(); state.builds.push(b); state.ui.buildId = b.id; state.ui.tab = 'builds'; state.ui.wizard = ''; },
  'build-dup'() {
    const b = curBuild();
    if (!b) return;
    const c = Object.assign(clone(b), { id: uid(), name: t('{name} (copy)', { name: b.name }) });
    delete c.presetId;
    state.builds.push(c);
    state.ui.buildId = c.id;
    toast(t('Build duplicated'));
  },
  async 'build-del'() {
    const b = curBuild();
    if (!b || !(await ask(t('Delete the build "{name}"? You can bring it back from "Recently deleted".', { name: b.name }), t('Delete build'), true))) return false;
    const seats = [];
    state.parties.forEach((p) => p.members.forEach((m, i) => { if (m.buildId === b.id) { m.buildId = ''; seats.push([p.id, i]); } }));
    toTrash('build', b, seats);
    state.builds = state.builds.filter((x) => x.id !== b.id);
    state.ui.buildId = state.builds[0] ? state.builds[0].id : '';
    toast(t('Build deleted: {name}', { name: b.name }), { label: t('Undo'), act: 'undo-delete' });
  },
  'export-open'() {
    const b = curBuild();
    if (!b) return false;
    $('#export-name').textContent = b.name || t('Unnamed');
    $('#export-modal').hidden = false;
    $('#export-modal .choice').focus();
    return false;
  },
  'export-close'() { closeExport(); return false; },
  'build-export'() {
    const b = curBuild();
    closeExport();
    if (b) download(slug(b.name) + '.json', { type: 'bg3-build', build: b });
    return false;
  },
  'build-pdf'() {
    const b = curBuild();
    closeExport();
    if (!b) return false;
    $('#sheet').innerHTML = sheetHtml(b);
    $('#sheet-wrap').hidden = false;
    document.body.classList.add('sheet-open');
    $('#sheet-wrap').scrollTop = 0;
    return false;
  },
  'sheet-print'() {
    const b = curBuild();
    const title = document.title;
    // Browsers suggest the page title as the PDF file name.
    if (b) document.title = b.name + ' — ' + splitText(b);
    window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
    window.print();
    return false;
  },
  'sheet-close'() { closeSheet(); return false; },
  'lib-chip'(el) {
    const f = libState(state.ui.tab);
    const key = el.dataset.key;
    const v = el.dataset.v;
    if (Array.isArray(f[key])) { const i = f[key].indexOf(v); if (i >= 0) f[key].splice(i, 1); else f[key].push(v); }
    else f[key] = f[key] === v && key !== 'view' ? '' : v;
    if (key === 'kind') f.type = '';
    f.limit = PAGE;
  },
  'lib-dir'() { const f = libState(state.ui.tab); f.dir = f.dir === 'desc' ? 'asc' : 'desc'; f.limit = PAGE; },
  'lib-more'() { libState(state.ui.tab).limit += PAGE; libRefresh(); return false; },
  'lib-reset'() {
    const tab = state.ui.tab;
    const f = libState(tab);
    Object.keys(LIB_DEFAULTS[tab]).forEach((k) => { if (!LIB_VIEW_KEYS.includes(k)) f[k] = clone(LIB_DEFAULTS[tab][k]); });
    f.limit = PAGE;
  },
  'picker-open'(el) { openPicker(el.dataset.fill, el.dataset.slot); return false; },
  'picker-close'() { closePicker(); return false; },
  'picker-mode'(el) { picker.mode = el.dataset.mode; pickerList(); return false; },
  'picker-choose'(el) {
    const b = curBuild();
    const it = el.dataset.custom ? null : ITEMS.find((x) => x.n === el.dataset.n);
    const { path, slot } = picker;
    closePicker();
    if (!it && !el.dataset.custom) return false;
    let obj = getPath(b, path);
    // a new alternative is made by the item chosen for it
    const alt = /^gear\.(\w+)\.alts\.\d+$/.exec(path);
    if (!obj && alt) { obj = { slot, name: '', where: '', note: '' }; b.gear[alt[1]].alts.push(obj); }
    if (!obj) return false;
    const name = it ? it.n : el.dataset.n;
    if ('got' in obj && obj.name !== name) obj.got = false;
    obj.name = name;
    if ('rarity' in obj) obj.rarity = it ? it.r : '';
    if ('where' in obj) obj.where = it ? [it.l, it.h].filter(Boolean).join(' — ') : '';
  },
  'slot-clear'(el) { const obj = getPath(curBuild(), el.dataset.fill); if (obj) Object.assign(obj, blankSlot()); },
  // a new alternative: the slot first, then the items of that slot
  'alt-new-open'() {
    const act = state.ui.act;
    openChooser(t('Alternative for this act'), t('Choose the slot; the items for it open next.'),
      [{ label: t('Slot'), n: 1, options: SLOTS.map(([k, label]) => [t(label), '']) }], (done) => {
        const slot = (SLOTS.find(([k, label]) => t(label) === done[0].chosen[0]) || [])[0];
        if (slot) openPicker(`gear.${act}.alts.${curBuild().gear[act].alts.length}`, slot);
      });
    return false;
  },
  // setup items and consumables: one list to tick from, with what is already chosen at the top
  'list-open'(el) {
    const b = curBuild();
    const key = el.dataset.list;
    const have = b[key].map((x) => x.name.trim()).filter(Boolean).map((n) => (listInfo(n, key) || { n }).n);
    const mine = new Set(have.map(norm));
    const kinds = key === 'consumables' ? ['Elixir', 'Potion', 'Coating', 'Arrow', 'Grenade'] : KINDS.map((k) => k[0]);
    const all = key === 'consumables'
      ? CONSUMABLES.slice().sort((x, y) => kinds.indexOf(x.t) - kinds.indexOf(y.t) || x.n.localeCompare(y.n))
        .map((c) => [c.n, c.x || '', [c.du, c.uc].filter(Boolean).join(' · '), pic(c.i, 'pic small'), c.t + 's', c.r])
      : ITEMS.slice().sort((x, y) => kinds.indexOf(x.s) - kinds.indexOf(y.s) || RARITY_RANK[y.r] - RARITY_RANK[x.r] || x.n.localeCompare(y.n))
        .map((it) => [it.n, itemEffect(it), [it.t, it.d, it.a ? t('Act {n}', { n: it.a }) : ''].filter(Boolean).join(' · '), pic(it.i, 'pic small'), t((KINDS.find((k) => k[0] === it.s) || ['', ''])[1]), it.r]);
    const chosen = have.map((n) => { const info = listInfo(n, key); const o = all.find((x) => x[0] === n); return o ? [o[0], o[1], o[2], o[3], t('Chosen'), o[5]] : [n, info ? info.fx : '', info ? info.kind : '', pic(info ? info.i : '', 'pic small'), t('Chosen'), info ? info.r : '']; });
    const options = [...chosen, ...all.filter((x) => !mine.has(norm(x[0])))];
    openChooser(t(key === 'consumables' ? 'Consumables' : 'Setup items'),
      key === 'consumables' ? t('Tick the elixirs, potions, coatings, arrows and grenades the build uses. A name that is not in the list can be typed in the search and added as it is.')
        : t('Tick the items the build puts on or uses before a fight for what they leave behind. A name that is not in the list can be typed in the search and added as it is.'),
      [{ label: t(key === 'consumables' ? 'Consumables' : 'Items'), n: options.length + 99, min: 0, free: true, custom: true, cap: 150, options, chosen: have.slice() }], (done) => {
        const old = new Map(b[key].map((x) => [norm(x.name), x]));
        b[key] = done[0].chosen.map((n) => ({ name: n, note: old.has(norm(n)) ? old.get(norm(n)).note : '' }));
      });
    return false;
  },
  'open-source'() { const b = curBuild(); if (b && /^https?:\/\//i.test(b.source.trim())) window.open(b.source.trim(), '_blank', 'noopener'); return false; },
  wiki(el) {
    if (el.dataset.n) window.open(wikiUrl(el.dataset.n), '_blank', 'noopener');
    return false;
  },
  async 'wiki-fill'(el) {
    const obj = getPath(curBuild(), el.dataset.fill);
    if (!obj || !obj.name.trim()) return false;
    toast(t('Checking bg3.wiki…'));
    let info;
    try { info = await wikiItem(obj.name.trim()); } catch (err) { toast(t('Could not reach the wiki. Check your connection.')); return false; }
    if (!info) { toast(t('Could not find "{name}" on the wiki', { name: obj.name.trim() })); return false; }
    obj.name = info.title;
    if ('rarity' in obj) {
      if (info.rarity) obj.rarity = info.rarity;
      if (!obj.note.trim() && info.desc) obj.note = info.desc;
    }
    if ('where' in obj) {
      const keep = obj.where.trim() && info.where && obj.where.trim() !== info.where
        && !(await ask(t('Replace the current location with the wiki text?') + '\n\n' + info.where, t('Replace')));
      if (info.where && !keep) obj.where = info.where;
    } else if (!obj.note.trim()) {
      obj.note = info.desc || info.where;
    }
    toast(t('Filled from the wiki: {name}', { name: info.title }));
  },
  bonus(el) {
    const c = curBuild().creation;
    const key = el.dataset.n === '2' ? 'plus2' : 'plus1';
    const other = key === 'plus2' ? 'plus1' : 'plus2';
    c[key] = c[key] === el.dataset.ab ? '' : el.dataset.ab;
    if (c[key] && c[other] === c[key]) c[other] = '';
  },
  'creation-open'(el) {
    const key = el.dataset.k;
    const b = curBuild();
    const title = { origin: 'Origin', race: 'Race', subrace: 'Subrace', background: 'Background' }[key];
    openChooser(t(title), '', [{ label: t(title), n: 1, min: 0, options: creationOptions(b, key), chosen: b.creation[key] ? [b.creation[key]] : [] }], (done) => {
      const now = curBuild();
      const before = now.creation[key];
      now.creation[key] = done[0].chosen[0] || '';
      creationChanged(now, 'creation.' + key, before);
    });
    return false;
  },
  // the − and + of a number: a base ability score, a manual bonus, the enemy Armour Class
  step(el) {
    const clamp = (n) => Math.max(+el.dataset.min, Math.min(+el.dataset.max, n));
    const d = +el.dataset.d;
    if (el.dataset.ui) { const now = state.ui[el.dataset.ui]; state.ui[el.dataset.ui] = clamp((now == null || now === '' ? +el.dataset.v || 0 : Number(now)) + d); return; }
    const b = curBuild();
    setPath(b, el.dataset.path, clamp((Number(getPath(b, el.dataset.path)) || 0) + d));
  },
  'abil-reset'() { Object.assign(curBuild().creation, { abilities: blankBuild().creation.abilities, plus2: '', plus1: '' }); },
  // the class of a level goes down to the empty levels right below it
  'fill-down'(el) {
    const b = curBuild();
    const i = +el.dataset.l;
    for (let k = i + 1; k < b.levels.length && !b.levels[k].cls; k++) b.levels[k].cls = b.levels[i].cls;
    toast(t('{cls} for the empty levels below', { cls: b.levels[i].cls }), { label: t('Undo'), act: 'undo-levels' });
  },
  // a level is taken back, and the ones after it with it: levels go in order, and the level of a class counts the ones before
  async 'level-clear'(el) {
    const b = curBuild();
    const i = +el.dataset.l;
    const gone = b.levels.slice(i).filter((l) => l.cls);
    const chosen = gone.some((l) => l.sub || l.picks.length || (l.notes || []).length);
    if (chosen && !(await ask(gone.length > 1 ? t('Remove level {n} and the {m} level(s) after it, with what was chosen in them?', { n: i + 1, m: gone.length - 1 })
      : t('Remove level {n}, with what was chosen in it?', { n: i + 1 }), t('Remove'), true))) return false;
    const blank = blankBuild().levels[0];
    for (let k = i; k < b.levels.length; k++) b.levels[k] = clone(blank);
    if (b.current > i) b.current = 0;
    toast(gone.length > 1 ? t('Levels {a} to {b} removed', { a: i + 1, b: i + gone.length }) : t('Level {n} removed', { n: i + 1 }), { label: t('Undo'), act: 'undo-levels' });
  },
  'undo-levels'() { return actions['build-undo'](); },
  // the last change to the build that is open is taken back
  'build-undo'() {
    const b = curBuild();
    if (!b) return false;
    let k = undoStack.length - 1;
    while (k >= 0 && undoStack[k].id !== b.id) k--;
    if (k < 0) { toast(t('Nothing to undo')); return false; }
    const was = JSON.parse(undoStack.splice(k, 1)[0].json);
    Object.keys(b).forEach((key) => delete b[key]);
    Object.assign(b, was);
    undoTyping = '';
    toast(t('Last change undone'));
  },
  skill(el) {
    const c = curBuild().creation;
    const list = skillList(c.skills);
    const i = list.indexOf(el.dataset.s);
    if (i >= 0) list.splice(i, 1);
    else if (skillState(curBuild()).canAdd(el.dataset.s)) list.push(el.dataset.s);
    else return false;
    c.skills = list.join(', ');
  },
  act(el) { state.ui.act = el.dataset.k; },
  'sec-toggle'(el) { const closed = state.ui.closed || (state.ui.closed = {}); closed[el.dataset.s] = !closed[el.dataset.s]; },
  // jump to a section of the build page, opening it when it was folded
  'sec-go'(el) {
    const key = el.dataset.s;
    const was = (state.ui.closed || {})[key];
    if (was) { state.ui.closed[key] = false; save(); render(); }
    const target = $('#sec-' + key);
    if (target) target.scrollIntoView({ block: 'start' });
    return false;
  },
  // an origin character's own class and ability scores, as the game sets them by default
  async 'origin-defaults'() {
    const b = curBuild();
    const o = DATA.origins[b.creation.origin];
    if (!o || !o.cls) return false;
    const first = b.levels[0];
    if (first.cls && first.cls !== o.cls && !(await ask(t('Level 1 is {cls} now. Change it to {x}? The choices of that level are cleared.', { cls: first.cls, x: o.cls }), t('Change')))) return false;
    if (first.cls !== o.cls) Object.assign(first, { cls: o.cls, sub: '', picks: [] });
    if ((CLASS_DATA[o.cls] || {}).subclassLevel === 1 && o.sub) first.sub = subLabel(matchSubclass(o.cls, o.sub) || o.sub);
    if (o.abilities) Object.assign(b.creation, { abilities: Object.assign({}, o.abilities), plus2: o.plus2, plus1: o.plus1 });
    toast(t("{name}'s class and abilities applied", { name: b.creation.origin }));
  },
  'wiz-levels'() {
    const b = curBuild();
    const next = b.levels.findIndex((l, i) => i > 0 && levelPending(b, i).length);
    state.ui.wizard = startingClass(b) ? 'lv:' + ((next < 0 ? 1 : next) + 1) : 'class';
    state.ui.wizardFor = b.id;
    return { top: true };
  },
  // the level the numbers are shown at; the last level means "the finished build"
  'stat-level'(el) { const b = curBuild(); const n = +el.dataset.n; b.current = n >= charLevel(b) ? 0 : n; },
  async 'gear-copy-prev'() {
    const b = curBuild();
    const idx = ACTS.findIndex(([k]) => k === state.ui.act);
    const cur = b.gear[state.ui.act];
    if (SLOTS.some(([k]) => cur.slots[k].name.trim()) && !(await ask(t("Replace this act's gear with the previous act's?"), t('Replace')))) return false;
    cur.slots = clone(b.gear[ACTS[idx - 1][0]].slots);
  },
  async 'gear-clear'() {
    if (!(await ask(t('Clear every slot and alternative in this act?'), t('Clear act'), true))) return false;
    curBuild().gear[state.ui.act] = blankAct();
  },
  'alt-del'(el) { curBuild().gear[state.ui.act].alts.splice(+el.dataset.i, 1); },
  'list-del'(el) { curBuild()[el.dataset.list].splice(+el.dataset.i, 1); },
  'back-party'() { state.ui.tab = 'party'; state.ui.fromParty = false; },

  'party-act'(el) { state.ui.partyAct = el.dataset.k; },
  'party-new'() { const p = blankParty(); state.parties.push(p); state.ui.partyId = p.id; },
  'party-dup'() {
    const p = curParty();
    const c = Object.assign(clone(p), { id: uid(), name: t('{name} (copy)', { name: p.name }) });
    state.parties.push(c);
    state.ui.partyId = c.id;
    toast(t('Party duplicated'));
  },
  async 'party-del'() {
    const p = curParty();
    if (!(await ask(t('Delete the party "{name}"? Your builds stay saved.', { name: p.name }), t('Delete party'), true))) return false;
    toTrash('party', p);
    state.parties = state.parties.filter((x) => x.id !== p.id);
    toast(t('Party deleted: {name}', { name: p.name }), { label: t('Undo'), act: 'undo-delete' });
    if (!state.parties.length) state.parties.push(blankParty(t('My party')));
    state.ui.partyId = state.parties[0].id;
  },
  'member-open'(el) {
    const m = curParty().members[+el.dataset.i];
    state.ui.buildId = m.buildId;
    state.ui.act = state.ui.partyAct;
    state.ui.tab = 'builds';
    state.ui.fromParty = true;
    return { top: true };
  },
  'member-new'(el) {
    const m = curParty().members[+el.dataset.i];
    const b = blankBuild();
    if (m.char.trim()) {
      b.name = t("{name}'s build", { name: m.char.trim() });
      b.creation.origin = m.char.trim();
      fixCreation(b.creation);
      creationChanged(b, 'creation.origin');
    }
    state.builds.push(b);
    m.buildId = b.id;
    toast(t('Build created — open the Build Planner to fill it in'));
  },
  'preset-use'(el) {
    const b = Object.assign(normalizeBuild(clone(PRESETS[+el.dataset.i])), { id: uid() });
    state.builds.push(b);
    state.ui.buildId = b.id;
    state.ui.tab = 'builds';
    toast(t('Copy added to your builds'));
    return { top: true };
  },
});

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.closest('[inert]')) return;  // a shut level row takes no action
  const fn = actions[el.dataset.act];
  if (!fn) return;
  // (the build as it is before the action, kept for "Undo" when the action changes it)
  const open = curBuild();
  const before = buildJson(open);
  const res = await fn(el);
  if (open && !UNDO_ACTS.includes(el.dataset.act) && buildById(open.id) === open && buildJson(open) !== before) { undoPush(open.id, before); undoTyping = ''; }
  if (res === false) return;
  save();
  render();
  if (res && res.focus) { const f = $(res.focus); if (f) f.focus(); }
  if (res && res.top) window.scrollTo(0, 0);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (picker && el.dataset && el.dataset.picker) {
    picker[el.dataset.picker] = el.type === 'checkbox' ? el.checked : el.value;
    pickerList();
    return;
  }
  if (el.dataset && el.dataset.lib && libState(state.ui.tab)) {
    const tab = state.ui.tab;
    const f = libState(tab);
    f[el.dataset.lib] = el.type === 'checkbox' ? el.checked : el.value;
    f.limit = PAGE;
    save();
    if (el.dataset.lib === 'sort') {  // each sort key starts in its natural direction
      f.dir = (LIB_SORTS[tab].find(([k]) => k === f.sort) || [])[2] || 'asc';
      render();
    } else libRefresh();
    return;
  }
  if (el.dataset && el.dataset.ui) {  // a setting of the view, such as the enemy Armour Class the attacks are measured against
    state.ui[el.dataset.ui] = Number(el.value) || 0;
    save();
    refreshDerived();
    return;
  }
  if (!el.dataset || !el.dataset.path) return;
  const scope = el.closest('[data-scope]');
  const inParty = scope && scope.dataset.scope === 'party';
  const target = inParty ? curParty() : curBuild();
  if (!target) return;
  const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  const before = getPath(target, el.dataset.path);
  if (!inParty) {
    // a run of typing in one field is one step to undo; a tick or a list is one each time
    const key = /^(text|number|search|url)$/.test(el.type) || el.tagName === 'TEXTAREA' ? target.id + ':' + el.dataset.path : '';
    if (!key || key !== undoTyping) undoPush(target.id, buildJson(target));
    undoTyping = key;
  }
  setPath(target, el.dataset.path, value);
  if (!inParty && el.dataset.path.startsWith('creation.')) creationChanged(target, el.dataset.path, before);
  save();
  if (el.hasAttribute('data-rerender')) render();
  else refreshDerived();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'file') {
    const f = el.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { importData(JSON.parse(r.result)); } catch (err) { toast(t('Could not read the file')); } };
    r.readAsText(f);
    el.value = '';
    return;
  }
  const kind = el.dataset && el.dataset.change;
  if (kind === 'party-select') state.ui.partyId = el.value;
  else if (kind === 'got') {
    const b = buildById(el.dataset.build);
    if (b) b.gear[state.ui.partyAct].slots[el.dataset.slot].got = el.checked;
  } else return;
  save();
  render();
});

// builds saved by older versions: a copy is kept, then every line finds its place or becomes a note
takeSnapshot();
if (tidyAll()) save();
render();
importFromAddress();

// Ctrl+Z takes the last change to the open build back, when nothing is being typed and no dialog is open
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || state.ui.tab !== 'builds') return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || $$('.modal').some((m) => !m.hidden)) return;
  e.preventDefault();
  if (actions['build-undo']() !== false) { save(); render(); }
});
