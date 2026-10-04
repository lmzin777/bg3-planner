// Actions behind every button, the event listeners, and the first render. Loaded last.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- actions ----------
// An action returns false to skip the save + re-render, or { focus, top } hints for after it.
Object.assign(actions, {
  tab(el) { state.ui.tab = el.dataset.tab; state.ui.fromParty = false; },
  lang(el) { state.ui.lang = el.dataset.lang; },
  'build-select'(el) { state.ui.buildId = el.dataset.id; state.ui.fromParty = false; },
  'build-new'() { const b = blankBuild(); state.builds.push(b); state.ui.buildId = b.id; state.ui.tab = 'builds'; },
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
    const it = ITEMS.find((x) => x.n === el.dataset.n);
    const obj = getPath(curBuild(), picker.path);
    closePicker();
    if (!it || !obj) return false;
    obj.name = it.n;
    if ('rarity' in obj) obj.rarity = it.r;
    if ('where' in obj) obj.where = [it.l, it.h].filter(Boolean).join(' — ');
  },
  async 'preset-reset'() {
    const b = curBuild();
    const preset = PRESETS.find((p) => p.presetId && p.presetId === b.presetId);
    if (!preset || !(await ask(t('Replace "{name}" with the ready-made version? Your changes to this build are lost.', { name: b.name }), t('Reset build'), true))) return false;
    takeSnapshot();
    const fresh = Object.assign(normalizeBuild(clone(preset)), { id: b.id });
    state.builds[state.builds.indexOf(b)] = fresh;
    toast(t('Build reset to the ready-made version'));
  },
  'open-source'() { const b = curBuild(); if (b && /^https?:\/\//i.test(b.source.trim())) window.open(b.source.trim(), '_blank', 'noopener'); return false; },
  wiki(el) {
    const input = $('input[type="text"]', el.closest('.with-btn, .pick'));
    if (input && input.value.trim()) window.open(wikiUrl(input.value), '_blank', 'noopener');
    return false;
  },
  async 'wiki-fill'(el) {
    const obj = getPath(curBuild(), el.dataset.fill);
    if (!obj || !obj.name.trim()) { toast(t('Type the item name first')); return false; }
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
  skill(el) {
    const c = curBuild().creation;
    const list = skillList(c.skills);
    const i = list.indexOf(el.dataset.s);
    if (i >= 0) list.splice(i, 1);
    else if (skillState(curBuild()).canAdd(el.dataset.s)) list.push(el.dataset.s);
    else return false;
    c.skills = list.join(', ');
  },
  'pick-add'(el) { const l = +el.dataset.l; curBuild().levels[l].picks.push(''); return { focus: `[data-path="levels.${l}.picks.${curBuild().levels[l].picks.length - 1}"]` }; },
  'pick-del'(el) { curBuild().levels[+el.dataset.l].picks.splice(+el.dataset.i, 1); },
  act(el) { state.ui.act = el.dataset.k; },
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
  'alt-add'() {
    const a = curBuild().gear[state.ui.act].alts;
    a.push({ slot: 'head', name: '', where: '', note: '' });
    return { focus: `[data-path="gear.${state.ui.act}.alts.${a.length - 1}.name"]` };
  },
  'alt-del'(el) { curBuild().gear[state.ui.act].alts.splice(+el.dataset.i, 1); },
  'list-add'(el) { const k = el.dataset.list; curBuild()[k].push({ name: '', note: '' }); return { focus: `[data-path="${k}.${curBuild()[k].length - 1}.name"]` }; },
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
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  const res = await fn(el);
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
  if (!el.dataset || !el.dataset.path) return;
  const scope = el.closest('[data-scope]');
  const inParty = scope && scope.dataset.scope === 'party';
  const target = inParty ? curParty() : curBuild();
  if (!target) return;
  const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  setPath(target, el.dataset.path, value);
  if (!inParty && el.dataset.path.startsWith('creation.')) creationChanged(target, el.dataset.path);
  save();
  if (el.classList.contains('wiki-name')) suggest(el);
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

render();
