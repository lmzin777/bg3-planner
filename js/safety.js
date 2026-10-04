// Ways back and ways out: undo for deletes, automatic safety copies, and the share code of a build.
'use strict';

// ---------- recently deleted ----------
function toTrash(kind, data, seats) {
  state.trash.unshift({ kind, at: Date.now(), data: clone(data), seats: seats || [] });
  state.trash = state.trash.slice(0, TRASH_MAX);
}
// Put a deleted build or party back. A build returns to the party seats it had, when they are still free.
function restoreTrash(i) {
  const x = state.trash.splice(i, 1)[0];
  if (!x) return null;
  if (x.kind === 'party') {
    const p = normalizeParty(x.data);
    if (state.parties.some((y) => y.id === p.id)) p.id = uid();
    p.members.forEach((m) => { if (!buildById(m.buildId)) m.buildId = ''; });
    state.parties.push(p);
    state.ui.partyId = p.id;
    return p;
  }
  const b = normalizeBuild(x.data);
  if (buildById(b.id)) b.id = uid();
  state.builds.push(b);
  x.seats.forEach(([partyId, seat]) => {
    const p = state.parties.find((y) => y.id === partyId);
    if (p && p.members[seat] && !p.members[seat].buildId) p.members[seat].buildId = b.id;
  });
  state.ui.buildId = b.id;
  return b;
}
const when = (ms) => new Date(ms).toLocaleString(state.ui.lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function trashDialog() {
  const rows = state.trash.map((x, i) => `<div class="trash-row">
      <div><b>${esc(x.data.name || t('Unnamed'))}</b><small>${x.kind === 'party' ? t('Party') : esc(splitText(normalizeBuild(x.data)))} · ${t('deleted {when}', { when: when(x.at) })}</small></div>
      <button class="btn tiny gold" data-act="trash-restore" data-i="${i}">${t('Restore')}</button>
      <button class="icon x" data-act="trash-drop" data-i="${i}" title="${t('Delete for good')}">×</button>
    </div>`).join('');
  return `<h2>${t('Recently deleted')}</h2>
    <p class="muted">${t('The last {n} builds and parties you deleted are kept here.', { n: TRASH_MAX })}</p>
    ${rows || `<p class="muted">${t('Nothing here.')}</p>`}
    <div class="modal-btns">${state.trash.length ? `<button class="btn danger" data-act="trash-empty">${t('Empty the list')}</button>` : '<span></span>'}
      <button class="btn" data-act="dialog-close">${t('Close')}</button></div>`;
}

// ---------- automatic safety copies ----------
// Kept apart from the main save, so a bad import or a mistake can be rolled back.
const SNAP_KEY = 'bg3planner.snapshots';
const SNAP_MAX = 6;
function snapshots() {
  try { const list = JSON.parse(localStorage.getItem(SNAP_KEY)); return Array.isArray(list) ? list : []; } catch (e) { return []; }
}
function takeSnapshot() {
  if (window.BG3_TEST || !state.builds.length) return;
  try {
    const list = snapshots();
    const same = (x) => JSON.stringify([x.builds, x.parties]) === JSON.stringify([state.builds, state.parties]);
    if (list.length && same(list[0])) return;  // nothing changed since the last copy
    list.unshift({ at: Date.now(), builds: clone(state.builds), parties: clone(state.parties) });
    localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, SNAP_MAX)));
  } catch (e) { /* storage full or unavailable: the planner works without the copies */ }
}
// one copy a day, taken when the planner opens; more are taken before anything that replaces data
(function () {
  const list = snapshots();
  if (!list.length || Date.now() - list[0].at > 20 * 3600 * 1000) takeSnapshot();
})();
const snapshotList = () => snapshots().map((x, i) => `<div class="trash-row">
    <div><b>${when(x.at)}</b><small>${t('{b} build(s), {p} party(ies)', { b: x.builds.length, p: x.parties.length })}</small></div>
    <button class="btn tiny" data-act="snapshot-restore" data-i="${i}">${t('Go back to this')}</button></div>`).join('');

// ---------- share code ----------
// A build as one line of text to paste in a chat: compressed JSON in URL-safe base64, behind a version tag.
const toBase64 = (bytes) => { let s = ''; bytes.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromBase64 = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
const viaStream = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
// Empty fields are left out; normalizeBuild puts them back. Lists keep their length, since position matters in them.
function prune(v) {
  if (Array.isArray(v)) return v.map(prune);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  Object.keys(v).forEach((k) => {
    const x = prune(v[k]);
    const empty = x === '' || x === false || x === 0 || x == null || (Array.isArray(x) ? !x.length : typeof x === 'object' && !Object.keys(x).length);
    if (!empty) o[k] = x;
  });
  return o;
}
const itemWhere = (it) => [it.l, it.h].filter(Boolean).join(' — ');
const gearEntries = (b) => ACTS.flatMap(([k]) => { const g = (b.gear || {})[k] || {}; return [...Object.values(g.slots || {}), ...(g.alts || [])]; });
// What goes into the code: the build without empty fields and without what the item database already knows
// (rarity and where to find an item), which the reader fills back in.
function leanBuild(b) {
  const copy = Object.assign(clone(b), { id: '' });
  gearEntries(copy).forEach((s) => {
    const it = ITEM_BY_NAME.get(norm(s.name));
    if (!it) return;
    if (s.where === itemWhere(it)) delete s.where;
    if (s.rarity === it.r) delete s.rarity;
  });
  const lean = prune(copy);
  lean.elixir = b.elixir || '';  // "no elixir" is a choice, not a missing field
  return lean;
}
function fromLean(data) {
  gearEntries(data).forEach((s) => {
    const it = s && ITEM_BY_NAME.get(norm(s.name));
    if (!it) return;
    if (s.where === undefined) s.where = itemWhere(it);
    if (s.rarity === undefined) s.rarity = it.r;
  });
  return data;
}
// The code ends with a dot, so text typed after it in a chat message is not read as part of it.
async function shareCode(b) {
  const bytes = new TextEncoder().encode(JSON.stringify(leanBuild(b)));
  if (window.CompressionStream) {
    try { return 'BG3B2.' + toBase64(await viaStream(bytes, new CompressionStream('deflate-raw'))) + '.'; } catch (e) { /* fall through to the plain form */ }
  }
  return 'BG3B1.' + toBase64(bytes) + '.';
}
const isShareCode = (text) => /BG3B[12]\.[\w-]{20,}/.test(String(text));
// The build inside a share code, or null when the text is not one or is damaged.
// Line breaks a chat app put inside the code are ignored.
async function readShareCode(text) {
  const m = /BG3B([12])\.([\w\s-]+?)\.(?![\w-])/.exec(String(text)) || /BG3B([12])\.([\w-]+)/.exec(String(text));
  if (!m) return null;
  try {
    let bytes = fromBase64(m[2].replace(/\s+/g, ''));
    if (m[1] === '2') bytes = await viaStream(bytes, new DecompressionStream('deflate-raw'));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data === 'object' ? fromLean(data) : null;
  } catch (e) { return null; }
}
// Once the planner is published at a web address, a share code can travel as a link: the address plus #b=CODE.
const HOSTED = /^https?:$/.test(location.protocol) && !/^(localhost$|127\.|\[::1\]$)/.test(location.hostname);
const shareLink = (code) => location.origin + location.pathname + '#b=' + code;
// Opening such a link offers to add the build, and clears the code from the address.
async function importFromAddress() {
  const m = /^#b=(.+)$/.exec(location.hash);
  if (!m || window.BG3_TEST) return;
  const build = await readShareCode(decodeURIComponent(m[1]));
  history.replaceState(null, '', location.pathname + location.search);
  if (!build) { toast(t('That share code is incomplete or damaged')); return; }
  if (await ask(t('Add the shared build "{name}" to your builds?', { name: normalizeBuild(build).name }), t('Add'))) importData({ type: 'bg3-build', build });
}
async function copyText(text, area) {
  if (area) area.select();
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    // no clipboard permission: the text stays selected so Ctrl+C works
    return !!(document.execCommand && document.execCommand('copy'));
  }
}

Object.assign(actions, {
  'undo-delete'() {
    const x = restoreTrash(0);
    $('#toast').classList.remove('on');
    if (!x) return false;
    toast(t('Restored: {name}', { name: x.name }));
  },
  'trash-open'() { openDialog(trashDialog()); return false; },
  'trash-restore'(el) {
    const x = restoreTrash(+el.dataset.i);
    closeDialog();
    if (x) toast(t('Restored: {name}', { name: x.name }));
  },
  'trash-drop'(el) {
    state.trash.splice(+el.dataset.i, 1);
    if (state.trash.length) $('#dialog-box').innerHTML = trashDialog(); else closeDialog();
  },
  async 'trash-empty'() {
    if (!(await ask(t('Remove these {n} deleted builds and parties for good?', { n: state.trash.length }), t('Empty the list'), true))) return false;
    state.trash = [];
    closeDialog();
  },
  async 'snapshot-restore'(el) {
    const x = snapshots()[+el.dataset.i];
    if (!x || !(await ask(t('Go back to the copy of {when}? What you have now is kept as a new copy first.', { when: when(x.at) }), t('Go back'), true))) return false;
    takeSnapshot();
    state = hydrate({ builds: x.builds, parties: x.parties, ui: state.ui, trash: state.trash });
    closeDialog();
    toast(t('Went back to the copy of {when}', { when: when(x.at) }));
  },
  async 'build-share'() {
    const b = curBuild();
    closeExport();
    if (!b) return false;
    const code = await shareCode(b);
    dlg = { text: code };
    openDialog(`<h2>${t('Share code')}</h2>
      <p>${t('Send this text to a friend. They paste it into Import and get a copy of "{name}".', { name: esc(b.name) })}</p>
      <textarea id="share-text" rows="5" readonly>${esc(code)}</textarea>
      <p class="muted">${t('{n} characters', { n: code.length })}</p>
      <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Close')}</button>
        ${HOSTED ? `<button class="btn" data-act="share-link" title="${t('A link that opens this planner and offers to add the build')}">${t('Copy link')}</button>` : ''}
        <button class="btn primary" data-act="share-copy">${t('Copy')}</button></div>`);
    return false;
  },
  async 'share-link'() {
    toast((await copyText(shareLink(dlg.text))) ? t('Link copied') : t('Could not copy the link'));
    return false;
  },
  async 'share-copy'() {
    toast((await copyText(dlg.text, $('#share-text'))) ? t('Share code copied') : t('Press Ctrl+C to copy the selected text'));
    return false;
  },
});
