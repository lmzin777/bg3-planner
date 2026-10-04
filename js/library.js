// The item picker of the gear slots and the Items and Spells reference tabs.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- item picker ----------
const SLOT_KINDS = { head: ['head'], cloak: ['cloak'], chest: ['chest'], gloves: ['gloves'], boots: ['boots'], amulet: ['amulet'], ring1: ['ring'], ring2: ['ring'],
  meleeMain: ['melee'], meleeOff: ['melee', 'shield'], rangedMain: ['ranged'], rangedOff: ['ranged'] };
const RARITY_RANK = { legendary: 5, veryrare: 4, rare: 3, uncommon: 2, common: 1, '': 0 };
const PICKER_MAX = 150;
let picker = null;

function pickerItems() {
  const kinds = SLOT_KINDS[picker.slot] || [];
  const actNum = ACTS.findIndex(([k]) => k === picker.act) + 1;
  const q = norm(picker.q);
  const usable = picker.usable || picker.mode !== 'all';  // recommendations only make sense for what the build can use
  return ITEMS.filter((it) => kinds.includes(it.s)
    && !(picker.slot === 'meleeOff' && usable && !canOffHand(it, curBuild()))
    && !(picker.slot === 'meleeOff' && it.s === 'melee' && it.w === 'two')
    && !(picker.slot === 'rangedOff' && it.w !== 'one')
    && (!q || norm(it.n).includes(q))
    && (!picker.type || it.t === picker.type)
    && (!usable || canUse(it, picker.prof))
    && (!picker.byAct || !it.a || it.a <= actNum))
    .sort((a, b) => RARITY_RANK[b.r] - RARITY_RANK[a.r] || a.n.localeCompare(b.n));
}
function pickerList() {
  const all = pickerItems();
  const ranked = picker.mode === 'all' ? null : recommend(curBuild(), picker.slot, picker.act, picker.mode, all);
  const list = ranked ? ranked.map((r) => r.it) : all;
  const why = ranked ? new Map(ranked.map((r) => [r.it, r])) : null;
  // every row says what the item changes against what is in the slot now
  const cmp = recommendBase(curBuild(), picker.act);
  const current = wornItems(curBuild(), picker.act)[picker.slot];
  const versus = (it) => (it === current ? '' : deltaText(why && why.get(it) ? why.get(it).delta : gearDelta(curBuild(), picker.act, picker.slot, it, cmp.base, cmp.p.style, cmp.p.level)));
  const rows = list.slice(0, PICKER_MAX).map((it, i) => {
    const ok = canUse(it, picker.prof);
    const where = [it.a ? t('Act {n}', { n: it.a }) : t('Any act'), [it.l, it.h].filter(Boolean).join(' — ')].filter(Boolean).join(' · ');
    const effect = (it.ps || []).map((p) => p[1] || p[0]).join(' ') || it.x || '';
    const r = why && why.get(it);
    const who = picker.taken[norm(it.n)];
    if (!picker.versus.has(it)) picker.versus.set(it, versus(it));
    const vs = picker.versus.get(it);
    return `<button class="pick-row r-${it.r}${ok ? '' : ' no'}" data-act="picker-choose" data-n="${esc(it.n)}">
      ${pic(it.i, 'pic small')}<b>${r ? `<i class="rank">${i + 1}</i>` : ''}${esc(it.n)}</b><span>${esc([it.t, it.d].filter(Boolean).join(' · '))}${ok ? '' : ` · <em>${t('not proficient')}</em>`}${
        who ? ` · <em>${t('worn by {who}', { who: esc(who) })}</em>` : ''}</span>
      ${r ? `<small class="why">${r.reasons.map(esc).join(' · ')}</small>` : ''}
      ${it === current ? `<small class="delta">${t('in this slot now')}</small>` : vs ? `<small class="delta">${current ? t('Against {x}: {d}', { x: esc(current.n), d: esc(vs) }) : t('With it on: {d}', { d: esc(vs) })}</small>` : ''}
      ${effect ? `<small class="fx">${esc(effect)}</small>` : ''}<small>${esc(where)}</small></button>`;
  }).join('');
  $('#picker-count').textContent = t('{n} items', { n: list.length }) + (list.length > PICKER_MAX ? ' · ' + t('showing the first {n}, type to narrow it down', { n: PICKER_MAX }) : '');
  $('#picker-list').innerHTML = rows || `<p class="muted">${ranked ? t('Nothing in this slot stands out for that goal. Try another goal or "All".') : t('No items match. Try turning off a filter.')}</p>`;
  $$('#picker-box [data-mode]').forEach((el) => el.classList.toggle('on', el.dataset.mode === picker.mode));
}
function openPicker(path, slot) {
  const b = curBuild();
  picker = { path, slot, act: state.ui.act, q: '', type: '', usable: true, byAct: true, mode: 'all', prof: proficiencies(b, state.ui.act), taken: partyTaken(b, state.ui.act), versus: new Map() };
  const kinds = SLOT_KINDS[slot] || [];
  const types = [...new Set(ITEMS.filter((it) => kinds.includes(it.s)).map((it) => it.t))].sort();
  const actLabel = t(ACTS.find(([k]) => k === picker.act)[1]);
  $('#picker-box').innerHTML = `
    <h2>${t('Items · {slot}', { slot: t(SLOT_LABEL[slot] || '') })}</h2>
    <p class="muted">${t('This build is proficient with: {list}', { list: esc(profText(picker.prof)) })}</p>
    <div class="lib-row modes"><span>${t('Show')}</span>
      <button class="chip on" data-act="picker-mode" data-mode="all">${t('All')}</button>
      ${Object.keys(GOALS).map((g) => `<button class="chip" data-act="picker-mode" data-mode="${g}">${t(GOAL_LABEL[g])}</button>`).join('')}
    </div>
    <p class="muted">${t('Recommendations read this build as: {profile}', { profile: esc(profileText(buildProfile(b, picker.act))) })}</p>
    <div class="picker-tools">
      <input type="text" data-picker="q" placeholder="${t('Search by name…')}" autocomplete="off">
      ${types.length > 1 ? `<select data-picker="type">${opt('', t('All types'), '')}${types.map((x) => opt(x, x, '')).join('')}</select>` : ''}
    </div>
    <div class="picker-tools">
      <label class="chk"><input type="checkbox" data-picker="usable" checked> ${t('Only what this build can use')}</label>
      <label class="chk"><input type="checkbox" data-picker="byAct" checked> ${t('Only found up to {act}', { act: actLabel })}</label>
      <span class="muted" id="picker-count"></span>
    </div>
    <div class="picker-list" id="picker-list"></div>
    <div class="modal-btns">
      <span class="muted">${t('Item data from bg3.wiki, {date}', { date: window.BG3_ITEMS_DATE || '' })}</span>
      <button class="btn" data-act="picker-close">${t('Close')}</button>
    </div>`;
  pickerList();
  $('#picker').hidden = false;
  $('#picker-box [data-picker="q"]').focus();
}
function closePicker() {
  $('#picker').hidden = true;
  picker = null;
}
$('#picker').addEventListener('click', (e) => { if (e.target.id === 'picker') closePicker(); });


// ---------- reference tabs: Items and Spells ----------
// Filters are kept in state.ui.lib so they survive a reload. Typing re-renders only the results and the counters.
const PAGE = 60;
const LIB_DEFAULTS = {
  items: { q: '', kind: '', type: '', tag: '', rar: [], act: '', build: '', sort: 'rarity', dir: 'desc', view: 'cards', limit: PAGE },
  spells: { q: '', lv: [], cls: '', origin: 'class', school: '', cost: '', dmg: '', save: '', conc: false, ritual: false, sort: 'level', dir: 'asc', view: 'cards', limit: PAGE },
};
// Keys that are presentation, not filters: they do not count as an active filter and "Clear filters" leaves them alone.
const LIB_VIEW_KEYS = ['sort', 'dir', 'view', 'limit'];
function libState(tab) {
  const defaults = LIB_DEFAULTS[tab];
  if (!defaults) return undefined;
  const all = state.ui.lib || (state.ui.lib = {});
  if (!all[tab]) all[tab] = clone(defaults);
  Object.keys(defaults).forEach((k) => { if (!(k in all[tab])) all[tab][k] = clone(defaults[k]); });
  return all[tab];
}
const lib = { get items() { return libState('items'); }, get spells() { return libState('spells'); } };
Object.keys(LIB_DEFAULTS).forEach((tab) => { libState(tab).limit = PAGE; });

const KINDS = [['head', 'Head'], ['cloak', 'Cloak'], ['chest', 'Armour'], ['gloves', 'Gloves'], ['boots', 'Boots'], ['amulet', 'Amulet'], ['ring', 'Ring'],
  ['shield', 'Shield'], ['melee', 'Melee weapon'], ['ranged', 'Ranged weapon'], ['consumable', 'Consumable']];
// The Items tab lists consumables next to the equipment; they take no gear slot, so the pickers never see them.
const LIB_ITEMS = ITEMS.concat(CONSUMABLES.map((c) => ({ n: c.n, s: 'consumable', t: c.t + 's', r: c.r, a: 0, h: c.h, x: c.x, i: c.i, pr: c.pr, du: c.du })));
// Where a spell comes from: a class list, a subclass or race, an item, or none of those (follow-up actions of other spells).
const ORIGINS_OF_SPELLS = [['class', 'Class spells'], ['feature', 'Subclass and race'], ['item', 'From items'], ['other', 'Follow-up actions']];
SPELLS.forEach((s) => { s.og = (s.cl || []).length ? 'class' : (s.lr || []).length || s.ft ? 'feature' : s.it ? 'item' : 'other'; });
const COSTS = [['action', 'Action'], ['bonus', 'Bonus action'], ['reaction', 'Reaction']];
const DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder', 'Healing'];
const SAVES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const wikiLink = (title) => 'https://bg3.wiki/wiki/' + encodeURIComponent(String(title).replace(/ /g, '_'));
const rarityLabel = (r) => t((RARITIES.find(([v]) => v === r) || ['', ''])[1]);

// One test per filter key, so a facet count can leave its own key out.
const LIB_TESTS = {
  items: {
    kind: (it, f) => !f.kind || it.s === f.kind,
    type: (it, f) => !f.type || it.t === f.type,
    rar: (it, f) => !f.rar.length || f.rar.includes(it.r),
    act: (it, f) => !f.act || String(it.a) === f.act,
    tag: (it, f) => !f.tag || (it.g || []).includes(f.tag),
    build: (it, f, ctx) => !ctx.prof || (it.s !== 'consumable' && canUse(it, ctx.prof)),
    q: (it, f, ctx) => !ctx.q || norm(it.n).includes(ctx.q) || norm(it.x).includes(ctx.q) || (it.ps || []).some((p) => norm(p[0]).includes(ctx.q) || norm(p[1]).includes(ctx.q)),
  },
  spells: {
    lv: (s, f) => !f.lv.length || f.lv.includes(String(s.lv)),
    cls: (s, f) => !f.cls || (s.cl || []).includes(f.cls),
    school: (s, f) => !f.school || s.sc === f.school,
    cost: (s, f) => !f.cost || s.a === f.cost,
    dmg: (s, f) => !f.dmg || (s.dm || '').includes(f.dmg),
    save: (s, f) => !f.save || s.sv === f.save,
    conc: (s, f) => !f.conc || !!s.co,
    ritual: (s, f) => !f.ritual || !!s.ri,
    origin: (s, f) => !f.origin || s.og === f.origin,
    q: (s, f, ctx) => !ctx.q || norm(s.n).includes(ctx.q) || norm(s.d).includes(ctx.q) || norm(s.xd).includes(ctx.q) || norm(s.dm).includes(ctx.q),
  },
};
// The values a record has for each chip group, used to count what a chip would show.
const LIB_FACETS = {
  kind: (it) => [it.s], rar: (it) => [it.r], act: (it) => [String(it.a)],
  lv: (s) => [String(s.lv)], cls: (s) => s.cl || [], origin: (s) => [s.og],
};
// Sort keys: a function returns the value to compare; null means by name. Ties always fall back to the name.
const LIB_SORTS = {
  items: [['rarity', 'Rarity', 'desc', (it) => RARITY_RANK[it.r] || 0], ['name', 'Name', 'asc', null], ['act', 'Act', 'asc', (it, sign) => it.a || (sign > 0 ? 9 : 0)],
    ['type', 'Type', 'asc', (it) => it.t], ['price', 'Price', 'desc', (it) => Number(it.pr) || 0], ['weight', 'Weight', 'asc', (it) => Number(it.wt) || 0]],
  spells: [['level', 'Level', 'asc', (s) => s.lv], ['name', 'Name', 'asc', null], ['school', 'School', 'asc', (s) => s.sc || '']],
};

function libList(tab, skipKey) {
  const f = libState(tab);
  const b = tab === 'items' ? buildById(f.build) : null;
  const ctx = { q: norm(f.q), prof: b ? proficiencies(b) : null };
  const tests = Object.entries(LIB_TESTS[tab]).filter(([k]) => k !== skipKey).map(([, fn]) => fn);
  return (tab === 'items' ? LIB_ITEMS : SPELLS).filter((x) => tests.every((fn) => fn(x, f, ctx)));
}
function libSorted(tab) {
  const f = libState(tab);
  const sort = LIB_SORTS[tab].find(([k]) => k === f.sort) || LIB_SORTS[tab][0];
  const get = sort[3];
  const sign = f.dir === 'desc' ? -1 : 1;
  return libList(tab).sort((a, b) => {
    if (!get) return a.n.localeCompare(b.n) * sign;
    const x = get(a, sign);
    const y = get(b, sign);
    return (x < y ? -1 : x > y ? 1 : 0) * sign || a.n.localeCompare(b.n);
  });
}
function libCounts(tab, key) {
  const counts = { '': 0 };
  libList(tab, key).forEach((x) => { counts['']++; LIB_FACETS[key](x).forEach((v) => { counts[v] = (counts[v] || 0) + 1; }); });
  return counts;
}
const libActive = (tab) => {
  const f = libState(tab);
  return Object.keys(LIB_DEFAULTS[tab]).filter((k) => !LIB_VIEW_KEYS.includes(k) && JSON.stringify(f[k]) !== JSON.stringify(LIB_DEFAULTS[tab][k])).length;
};

const libChips = (key, options, cur) => options.map(([v, label]) =>
  `<button class="chip${(Array.isArray(cur) ? cur.includes(v) : cur === v) ? ' on' : ''}" data-act="lib-chip" data-key="${key}" data-v="${esc(v)}">${esc(label)}${LIB_FACETS[key] ? '<i></i>' : ''}</button>`).join('');
const libSelect = (key, options, cur, label) =>
  `<label class="field"><span>${label}</span><select data-lib="${key}">${options.map(([v, l]) => opt(v, l, cur)).join('')}</select></label>`;
const libCheck = (key, cur, label) => `<label class="chk"><input type="checkbox" data-lib="${key}"${cur ? ' checked' : ''}> ${label}</label>`;
const libSortBox = (tab) => {
  const f = libState(tab);
  return `<label class="field"><span>${t('Sort by')}</span><span class="with-btn"><select data-lib="sort">${LIB_SORTS[tab].map(([k, l]) => opt(k, t(l), f.sort)).join('')}</select>
    <button class="icon txt dir" data-act="lib-dir" title="${t('Switch between ascending and descending')}">${f.dir === 'desc' ? '↓ ' + t('Descending') : '↑ ' + t('Ascending')}</button></span></label>`;
};
const tag = (text, cls) => (text ? `<span class="${cls || ''}">${esc(text)}</span>` : '');

// Pictures are loaded from the wiki; the databases store the path under this prefix.
const IMAGE_BASE = 'https://bg3.wiki/w/images/';
// With tools/download_images.py run, pictures come from img/; a missing file falls back to the wiki.
const localImage = (path) => 'img/' + encodeURIComponent(decodeURIComponent(path.split('/').pop()).replace(/[^\w.\-'() ]/g, '_'));
const pic = (path, cls) => (path
  ? `<img class="${cls || 'pic'}" src="${window.BG3_IMAGES_LOCAL ? localImage(path) : IMAGE_BASE + esc(path)}" alt="" loading="lazy"${
    window.BG3_IMAGES_LOCAL ? ` onerror="this.onerror=null;this.src='${IMAGE_BASE}${esc(path).replace(/'/g, '%27')}'"` : ''}>`
  : `<span class="${cls || 'pic'} none"></span>`);
const ITEM_BY_NAME = new Map(ITEMS.map((it) => [norm(it.n), it]));
// A labelled fact, e.g. "Range 18 m".
const fact = (label, value, cls) => (value ? `<span class="${cls || ''}"><i>${label}</i>${esc(value)}</span>` : '');
const line = (label, value) => (value ? `<p class="more"><b>${label}</b> ${esc(value)}</p>` : '');

function itemCard(it) {
  const where = [it.l, it.h].filter(Boolean).join(' — ');
  const hands = it.w === 'two' ? t('Two-handed') : it.w === 'versatile' ? t('Versatile') : '';
  return `<article class="lib-card r-${it.r}">
    <header>${pic(it.i)}<div><h3>${esc(it.n)}</h3><div class="sub">${esc([it.t, rarityLabel(it.r)].filter(Boolean).join(' · '))}</div></div>
      <button class="icon txt" data-act="add-to-build" data-kind="item" data-n="${esc(it.n)}" title="${t('Put this item in a slot of one of your builds')}">${t('+ Build')}</button>
      <a class="icon" href="${wikiLink(it.n)}" target="_blank" rel="noopener" title="${t('Open the wiki page')}">↗</a></header>
    <div class="tags">${isWeapon(it) ? fact(t('Damage'), it.d, 'dmg') : tag(it.d, 'dmg')}${fact(t('Two-handed'), it.vd)}${fact(t('Enchantment'), it.en)}${tag(hands)}${
      (it.pp || []).map((x) => tag(x)).join('')}${tag(it.p ? t('Needs {p} proficiency', { p: it.p }) : '')}${tag(it.sd ? t('Stealth disadvantage') : '', 'warn')}</div>
    ${it.du ? `<div class="tags">${fact(t('Lasts'), it.du)}</div>` : ''}
    ${(it.g || []).length ? `<div class="tags effects">${it.g.map((k) => `<span>${t(TAG_LABEL[k])}</span>`).join('')}</div>` : ''}
    ${it.x ? `<p>${esc(it.x)}</p>` : ''}
    ${(it.ps || []).length ? `<ul class="fx">${it.ps.map(([n, text]) => `<li><b>${esc(n)}</b>${text ? ' ' + esc(text) : ''}</li>`).join('')}</ul>` : ''}
    ${line(t('Also'), it.sp)}${line(t('Weapon actions'), (it.wa || []).join(', '))}
    <footer><b>${it.a ? t('Act {n}', { n: it.a }) : t('Any act')}</b>${where ? ' · ' + esc(where) : ''}
      <div class="meta">${[it.wt ? it.wt + ' kg' : '', it.pr ? t('{n} gold', { n: it.pr }) : ''].filter(Boolean).join(' · ')}</div></footer>
  </article>`;
}

function spellCard(s) {
  const learn = (s.lr || []).map(([who, lv]) => `${who} ${lv}`).join(', ');
  const conds = (s.cn || []).map(([n, dur, save]) => {
    const extra = [dur, save ? t('{ab} save', { ab: save }) : ''].filter(Boolean).join(', ');
    return n + (extra ? ' (' + extra + ')' : '');
  }).join(', ');
  return `<article class="lib-card sp">
    <header>${pic(s.i)}<div><h3>${esc(s.n)}</h3><div class="sub">${s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip')}${s.sc ? ' · ' + esc(s.sc) : ''}${
      s.og !== 'class' ? ' · ' + t((ORIGINS_OF_SPELLS.find(([v]) => v === s.og) || ['', ''])[1]) : ''}</div></div>
      <button class="icon txt" data-act="add-to-build" data-kind="spell" data-n="${esc(s.n)}" title="${t('Add this spell to a level of one of your builds')}">${t('+ Build')}</button>
      <a class="icon" href="${wikiLink(s.p || s.n)}" target="_blank" rel="noopener" title="${t('Open the wiki page')}">↗</a></header>
    <div class="tags">${tag(t((COSTS.find(([v]) => v === s.a) || ['', ''])[1]))}${fact(t('Range'), s.rg)}${fact(t('Area'), s.ao)}${fact(t('Lasts'), s.du)}${fact(t('Damage'), s.dm, 'dmg')}${
      fact(t('Save'), s.sv)}${tag(s.at ? t('Attack roll') : '')}${tag(s.co ? t('Concentration') : '', 'gold')}${tag(s.ri ? t('Ritual') : '', 'gold')}${fact(t('Recharge'), s.rc)}${
      tag(s.vb ? t('Verbal') : '')}${tag(s.sb ? t('Scroll') : '')}</div>
    ${s.d ? `<p>${esc(s.d)}</p>` : ''}${s.xd ? `<p>${esc(s.xd)}</p>` : ''}
    ${line(t('On a successful save'), s.os)}${line(t('Applies'), conds)}${line(t('Creates'), s.ar)}${line(t('Summons'), s.sm)}${line(t('At higher levels'), s.hl)}
    <footer>${[learn ? `<b>${t('Learned by')}</b> ${esc(learn)}` : '', s.ft ? `<b>${t('Feats and features')}</b> ${esc(s.ft)}` : '', s.it ? `<b>${t('Granted by items')}</b> ${esc(s.it)}` : ''].filter(Boolean).join('<br>')}</footer>
  </article>`;
}

// "Show more" clicks itself when it scrolls into view, so the list keeps growing as you read.
const moreObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting && !e.target.hidden)) { libState(state.ui.tab).limit += PAGE; libRefresh(); }
}, { rootMargin: '300px' }) : null;

// Fill the results, the chip counters and the active-filter count for the open reference tab.
function libRefresh() {
  const tab = state.ui.tab;
  const f = libState(tab);
  const box = $('#lib-results');
  if (!f || !box) return;
  const list = libSorted(tab);
  const card = tab === 'items' ? itemCard : spellCard;
  $('#lib-count').textContent = t('{n} of {total} shown', { n: Math.min(list.length, f.limit), total: list.length });
  box.className = 'lib-grid' + (f.view === 'compact' ? ' compact' : '');
  box.innerHTML = list.slice(0, f.limit).map(card).join('') || `<p class="muted">${t('Nothing matches these filters.')}</p>`;
  const counts = {};
  $$('[data-act="lib-chip"]').forEach((el) => {
    const key = el.dataset.key;
    if (!LIB_FACETS[key]) return;
    counts[key] = counts[key] || libCounts(tab, key);
    const n = counts[key][el.dataset.v] || 0;
    el.querySelector('i').textContent = n;
    el.classList.toggle('zero', !n && !el.classList.contains('on'));
  });
  const active = libActive(tab);
  const reset = $('#lib-reset');
  reset.textContent = t('Clear filters') + (active ? ` (${active})` : '');
  reset.disabled = !active;
  const more = $('#lib-more');
  more.hidden = list.length <= f.limit;
  if (moreObserver) { moreObserver.disconnect(); moreObserver.observe(more); }
}
const libShell = (tab, title, sub, filters) => {
  const f = libState(tab);
  return `<div class="content wide lib">
    <section class="card hero"><h1>${title}</h1><p class="muted">${sub}</p>${filters}
      <div class="lib-foot">
        <span class="muted" id="lib-count"></span>
        <span class="lib-view">${libChips('view', [['cards', t('Cards')], ['compact', t('Compact')]], f.view)}</span>
        <button class="btn tiny" id="lib-reset" data-act="lib-reset">${t('Clear filters')}</button>
      </div>
    </section>
    <div class="lib-grid" id="lib-results"></div>
    <button class="btn" id="lib-more" data-act="lib-more" hidden>${t('Show more')}</button>
  </div>`;
};

function renderItems() {
  const f = lib.items;
  if (!ITEMS.length) return `<div class="content wide"><section class="card empty"><h2>${t('The item database is missing.')}</h2><p class="muted">py tools/update_items.py</p></section></div>`;
  const types = [...new Set(LIB_ITEMS.filter((it) => !f.kind || it.s === f.kind).map((it) => it.t))].sort();
  return libShell('items', t('Items'), t('{n} items and {c} consumables · data from bg3.wiki, {date}', { n: ITEMS.length, c: CONSUMABLES.length, date: window.BG3_ITEMS_DATE || '' }), `
    <input type="search" class="lib-search" data-lib="q" value="${esc(f.q)}" placeholder="${t('Search by name or effect…  ( / )')}">
    <div class="lib-row"><span>${t('Slot')}</span>${libChips('kind', [['', t('All')], ...KINDS.map(([v, l]) => [v, t(l)])], f.kind)}</div>
    <div class="lib-row"><span>${t('Rarity')}</span>${libChips('rar', RARITIES.slice(1).map(([v, l]) => [v, t(l)]), f.rar)}</div>
    <div class="lib-row"><span>${t('Found in')}</span>${libChips('act', [['', t('All')], ...ACTS.map(([, l], i) => [String(i + 1), t(l)]), ['0', t('Any act')]], f.act)}</div>
    <div class="lib-selects">
      ${libSelect('type', [['', t('All types')], ...types.map((x) => [x, x])], f.type, t('Type'))}
      ${libSelect('tag', [['', t('Any effect')], ...Object.keys(TAG_LABEL).map((k) => [k, t(TAG_LABEL[k])])], f.tag, t('Effect'))}
      ${libSelect('build', [['', t('Everything')], ...state.builds.map((b) => [b.id, b.name || t('Unnamed')])], f.build, t('Only what a build can use'))}
      ${libSortBox('items')}
    </div>`);
}
function renderSpells() {
  const f = lib.spells;
  if (!SPELLS.length) return `<div class="content wide"><section class="card empty"><h2>${t('The spell database is missing.')}</h2><p class="muted">py tools/update_spells.py</p></section></div>`;
  const schools = [...new Set(SPELLS.map((s) => s.sc).filter(Boolean))].sort();
  const casters = CLASSES.filter((c) => SPELLS.some((s) => (s.cl || []).includes(c)));
  return libShell('spells', t('Spells'), t('{n} spells · data from bg3.wiki, {date}', { n: SPELLS.length, date: window.BG3_SPELLS_DATE || '' }), `
    <input type="search" class="lib-search" data-lib="q" value="${esc(f.q)}" placeholder="${t('Search by name or description…  ( / )')}">
    <div class="lib-row"><span>${t('Level')}</span>${libChips('lv', [['0', t('Cantrip')], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), String(n)])], f.lv)}</div>
    <div class="lib-row"><span>${t('Class')}</span>${libChips('cls', [['', t('All')], ...casters.map((c) => [c, c])], f.cls)}</div>
    <div class="lib-row"><span>${t('Comes from')}</span>${libChips('origin', [['', t('All')], ...ORIGINS_OF_SPELLS.map(([v, l]) => [v, t(l)])], f.origin)}</div>
    <div class="lib-selects">
      ${libSelect('school', [['', t('All schools')], ...schools.map((x) => [x, x])], f.school, t('School'))}
      ${libSelect('cost', [['', t('Any')], ...COSTS.map(([v, l]) => [v, t(l)])], f.cost, t('Casting cost'))}
      ${libSelect('dmg', [['', t('Any')], ...DAMAGE_TYPES.filter((x) => SPELLS.some((s) => (s.dm || '').includes(x))).map((x) => [x, x])], f.dmg, t('Damage type'))}
      ${libSelect('save', [['', t('Any')], ...SAVES.map((x) => [x, x])], f.save, t('Saving throw'))}
      ${libSortBox('spells')}
    </div>
    <div class="lib-checks">${libCheck('conc', f.conc, t('Concentration'))}${libCheck('ritual', f.ritual, t('Ritual'))}</div>`);
}
