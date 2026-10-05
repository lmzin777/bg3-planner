// A general-purpose dialog, the backup export/import flow, and "add to build" from the Items and Spells tabs.
'use strict';

// State of the open dialog. `refresh` re-renders its list when a field marked data-dlg changes.
let dlg = {};

function openDialog(html, cls) {
  const box = $('#dialog-box');
  box.className = 'modal-box ' + (cls || '');
  box.innerHTML = html;
  $('#dialog').hidden = false;
  const first = $('input[type="text"], textarea, select, button', box);
  if (first) first.focus();
}
function closeDialog() {
  $('#dialog').hidden = true;
  $('#dialog-box').innerHTML = '';
  dlg = {};
}
$('#dialog').addEventListener('click', (e) => { if (e.target.id === 'dialog') closeDialog(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#dialog').hidden) closeDialog(); });
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.dlg || $('#dialog').hidden) return;
  dlg[el.dataset.dlg] = el.type === 'checkbox' ? el.checked : el.value;
  if (dlg.refresh) dlg.refresh();
});

// ---------- backup: export ----------
const backupData = () => ({ type: 'bg3-planner', version: APP_VERSION, exported: new Date().toISOString(), builds: state.builds, parties: state.parties });

// ---------- backup: import ----------
const withoutId = (o) => JSON.stringify(Object.assign({}, o, { id: '' }));

// Add the builds and parties of a backup to what is already here. Builds that already exist unchanged are not duplicated.
function mergeBackup(data) {
  const idMap = {};
  let added = 0;
  (data.builds || []).forEach((raw) => {
    const b = normalizeBuild(raw);
    const same = state.builds.find((x) => withoutId(x) === withoutId(b));
    if (same) { idMap[b.id] = same.id; return; }
    const old = b.id;
    b.id = uid();
    idMap[old] = b.id;
    state.builds.push(b);
    added++;
  });
  (data.parties || []).forEach((raw) => {
    const p = normalizeParty(raw);
    p.id = uid();
    p.members.forEach((m) => { m.buildId = idMap[m.buildId] || ''; });
    if (!state.parties.some((x) => withoutId(x) === withoutId(p))) state.parties.push(p);
  });
  return added;
}

// Entry point for anything read from a file or pasted: a single build is added, a backup asks how to apply it.
async function importData(data) {
  if (data && data.type === 'bg3-build' && data.build) {
    const b = Object.assign(normalizeBuild(data.build), { id: uid() });
    state.builds.push(b);
    state.ui.buildId = b.id;
    state.ui.tab = 'builds';
    closeDialog();
    toast(t('Build imported: {name}', { name: b.name }));
    save();
    render();
  } else if (data && data.type === 'bg3-planner' && Array.isArray(data.builds)) {
    dlg = { pending: data };
    openDialog(`<h2>${t('Import backup')}</h2>
      <p>${t('This backup has {b} build(s) and {p} party(ies). You have {mine} build(s) now.', { b: data.builds.length, p: (data.parties || []).length, mine: state.builds.length })}</p>
      <div class="choices">
        <button class="choice" data-act="import-merge"><strong>${t('Add to what I have')}</strong><span>${t('Keeps your builds and adds the ones from the backup. Identical builds are not duplicated.')}</span></button>
        <button class="choice" data-act="import-replace"><strong>${t('Replace everything')}</strong><span>${t('Removes your current builds and parties and loads the backup instead.')}</span></button>
      </div>
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button></div>`);
  } else {
    toast(t('File not recognised'));
  }
}

// ---------- add to build, from the reference tabs ----------
const KIND_SLOTS = { head: ['head'], cloak: ['cloak'], chest: ['chest'], gloves: ['gloves'], boots: ['boots'], amulet: ['amulet'], ring: ['ring1', 'ring2'],
  shield: ['meleeOff'], melee: ['meleeMain', 'meleeOff'], ranged: ['rangedMain', 'rangedOff'] };

function addDialog() {
  const b = buildById(dlg.build) || state.builds[0];
  const buildSelect = `<label class="field"><span>${t('Build')}</span><select data-dlg="build">${state.builds.map((x) => opt(x.id, x.name || t('Unnamed'), b.id)).join('')}</select></label>`;
  if (dlg.kind === 'consumable') {
    return `<h2>${t('Add to build')}</h2><p class="muted">${esc(dlg.item.n)}</p>
      ${buildSelect}
      <p class="muted">${t('It goes to the Consumables list of the build.')}</p>
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button><button class="btn primary" data-act="add-confirm">${t('Add to build')}</button></div>`;
  }
  if (dlg.kind === 'item') {
    const it = dlg.item;
    const slots = KIND_SLOTS[it.s].filter((k) => !(k === 'meleeOff' && it.w === 'two') && !(k === 'rangedOff' && it.w !== 'one'));
    if (!slots.includes(dlg.slot)) dlg.slot = slots[0];
    const now = b.gear[dlg.act].slots[dlg.slot].name.trim();
    return `<h2>${t('Add to build')}</h2><p class="muted">${esc(it.n)}</p>
      ${buildSelect}
      <div class="lib-row"><span>${t('Act')}</span>${ACTS.map(([k, l]) => `<button class="chip${dlg.act === k ? ' on' : ''}" data-act="add-set" data-key="act" data-v="${k}">${t(l)}</button>`).join('')}</div>
      <div class="lib-row"><span>${t('Slot')}</span>${slots.map((k) => `<button class="chip${dlg.slot === k ? ' on' : ''}" data-act="add-set" data-key="slot" data-v="${k}">${t(SLOT_LABEL[k])}</button>`).join('')}</div>
      <p class="muted">${now ? t('That slot has {x} now; it will be replaced.', { x: esc(now) }) : t('That slot is empty.')}</p>
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button><button class="btn primary" data-act="add-confirm">${t('Add to build')}</button></div>`;
  }
  const info = levelInfo(b);
  const levels = info.map((x, i) => [String(i), t('Level {n}', { n: i + 1 }) + (x.cls ? ' · ' + x.cls + ' ' + x.n : '')]);
  return `<h2>${t('Add to build')}</h2><p class="muted">${esc(dlg.spell.n)}</p>
    ${buildSelect}
    <label class="field"><span>${t('Level')}</span><select data-dlg="level">${levels.map(([v, l]) => opt(v, l, String(dlg.level))).join('')}</select></label>
    <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button><button class="btn primary" data-act="add-confirm">${t('Add to build')}</button></div>`;
}

Object.assign(actions, {
  'dialog-close'() { closeDialog(); return false; },
  'export-all'() {
    const text = JSON.stringify(backupData());
    dlg = { text };
    openDialog(`<h2>${t('Back up everything')}</h2>
      <p>${t('A backup holds all your builds and parties. Keep it before updating the planner, or to move to another browser or computer.')}</p>
      <div class="choices">
        <button class="choice" data-act="backup-file"><strong>${t('Download backup file')}</strong><span>${t('Saves bg3-planner-backup.json. Load it later with Import.')}</span></button>
        <button class="choice" data-act="backup-copy"><strong>${t('Copy backup as text')}</strong><span>${t('Copies the same content to the clipboard. Paste it into Import, or into a note to keep.')}</span></button>
      </div>
      <label class="field"><span>${t('Backup text (you can also select and copy it by hand)')}</span><textarea id="backup-text" rows="4" readonly>${esc(text)}</textarea></label>
      ${snapshots().length ? `<h3 class="group">${t('Automatic copies')}</h3>
        <p class="muted">${t('The planner keeps a copy a day in this browser, and one before anything that replaces your data.')}</p>${snapshotList()}` : ''}
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Close')}</button></div>`);
    return false;
  },
  'backup-file'() { download('bg3-planner-backup.json', backupData()); return false; },
  async 'backup-copy'() {
    toast((await copyText(dlg.text, $('#backup-text'))) ? t('Backup copied') : t('Press Ctrl+C to copy the selected text'));
    return false;
  },
  import() {
    dlg = { text: '' };
    openDialog(`<h2>${t('Import')}</h2>
      <p>${t('Load a build or a backup exported from this planner, or a share code a friend sent you.')}</p>
      <div class="choices"><button class="choice" data-act="import-file"><strong>${t('Choose a file…')}</strong><span>${t('A .json file saved by Export.')}</span></button></div>
      <label class="field"><span>${t('…or paste a share code or the backup text here')}</span><textarea data-dlg="text" rows="5" placeholder='BG3B2.… / {"type":"bg3-planner", …}'></textarea></label>
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button><button class="btn primary" data-act="import-text">${t('Import pasted text')}</button></div>`);
    return false;
  },
  'import-file'() { $('#file').click(); return false; },
  async 'import-text'() {
    let data = null;
    if (isShareCode(dlg.text)) {
      const build = await readShareCode(dlg.text);
      if (!build) { toast(t('That share code is incomplete or damaged')); return false; }
      data = { type: 'bg3-build', build };
    } else {
      try { data = JSON.parse(dlg.text); } catch (err) { /* reported below */ }
    }
    if (!data) { toast(t('That text is not a valid backup or share code')); return false; }
    importData(data);
    return false;
  },
  'import-merge'() {
    const added = mergeBackup(dlg.pending);
    closeDialog();
    toast(t('{n} build(s) added', { n: added }));
  },
  async 'import-replace'() {
    const data = dlg.pending;
    if (!(await ask(t('Replace all your current builds and parties with the backup? What you have now is kept as an automatic copy.'), t('Replace everything'), true))) return false;
    takeSnapshot();
    state = hydrate({ builds: data.builds, parties: data.parties, ui: state.ui, trash: state.trash });
    closeDialog();
    toast(t('Backup imported'));
  },

  'add-to-build'(el) {
    if (!state.builds.length) { toast(t('Create a build first')); return false; }
    const cur = curBuild() || state.builds[0];
    if (el.dataset.kind === 'item' && CONSUMABLE_BY_NAME.has(norm(el.dataset.n))) dlg = { kind: 'consumable', item: CONSUMABLE_BY_NAME.get(norm(el.dataset.n)), build: cur.id };
    else if (el.dataset.kind === 'item') dlg = { kind: 'item', item: ITEM_BY_NAME.get(norm(el.dataset.n)), build: cur.id, act: state.ui.act, slot: '' };
    else dlg = { kind: 'spell', spell: SPELLS.find((s) => s.n === el.dataset.n), build: cur.id, level: 0 };
    dlg.refresh = () => { $('#dialog-box').innerHTML = addDialog(); };
    openDialog(addDialog());
    return false;
  },
  'add-set'(el) { dlg[el.dataset.key] = el.dataset.v; dlg.refresh(); return false; },
  'add-confirm'() {
    const b = buildById(dlg.build);
    if (!b) return false;
    if (dlg.kind === 'consumable') {
      if (!b.consumables.some((x) => norm(x.name) === norm(dlg.item.n))) b.consumables.push({ name: dlg.item.n, note: '' });
      toast(t('{x} added to {build}', { x: dlg.item.n, build: b.name }));
    } else if (dlg.kind === 'item') {
      const it = dlg.item;
      Object.assign(b.gear[dlg.act].slots[dlg.slot], { name: it.n, rarity: it.r || '', where: [it.l, it.h].filter(Boolean).join(' — '), got: false });
      toast(t('{x} added to {build}', { x: it.n, build: b.name }));
    } else {
      const placed = placeLine(b, { i: +dlg.level, text: (dlg.spell.lv ? 'Spell: ' : 'Cantrip: ') + dlg.spell.n, cls: b.levels[+dlg.level].cls });
      toast(placed ? t('{x} added to {build}', { x: dlg.spell.n, build: b.name }) : t('{build} has no free place to learn {x} with that class', { x: dlg.spell.n, build: b.name }));
    }
    closeDialog();
  },
});
