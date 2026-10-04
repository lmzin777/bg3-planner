// Suggestions under an item field while typing: matching items from the local database for that slot.
// Picking one fills the name, rarity and where to find it. The Browse button stays as the full list.
'use strict';

const SUGGEST_MAX = 8;
const suggestBox = document.createElement('div');
suggestBox.className = 'suggest';
suggestBox.hidden = true;
document.body.appendChild(suggestBox);
let suggestFor = null;  // the input the box belongs to

function suggestItems(slot, text) {
  const q = norm(text);
  if (q.length < 2) return [];
  if (slot === 'consumable') {
    return CONSUMABLES.filter((c) => norm(c.n).includes(q) && norm(c.n) !== q)
      .sort((a, b) => (norm(b.n).startsWith(q) - norm(a.n).startsWith(q)) || a.n.localeCompare(b.n)).slice(0, SUGGEST_MAX);
  }
  const kinds = SLOT_KINDS[slot] || [];
  return ITEMS.filter((it) => kinds.includes(it.s) && norm(it.n).includes(q) && norm(it.n) !== q)
    // names that start with what was typed come first, then the rarer items
    .sort((a, b) => (norm(b.n).startsWith(q) - norm(a.n).startsWith(q)) || RARITY_RANK[b.r] - RARITY_RANK[a.r] || a.n.localeCompare(b.n))
    .slice(0, SUGGEST_MAX);
}
function hideSuggest() {
  suggestBox.hidden = true;
  suggestFor = null;
}
function showSuggest(input) {
  const list = suggestItems(input.dataset.suggest, input.value);
  if (!list.length) { hideSuggest(); return; }
  suggestFor = input;
  const consumable = input.dataset.suggest === 'consumable';
  suggestBox.innerHTML = list.map((it, i) =>
    `<button class="pick-row r-${it.r}${i === 0 ? ' first' : ''}" data-n="${esc(it.n)}">${pic(it.i, 'pic small')}<b>${esc(it.n)}</b>
      <span>${esc([it.t, it.d].filter(Boolean).join(' · '))}</span>
      <small>${esc(consumable ? it.x : [it.a ? t('Act {n}', { n: it.a }) : t('Any act'), it.l].filter(Boolean).join(' · '))}</small></button>`).join('')
    + `<p class="muted">${t('Enter picks the first one · Esc closes')}</p>`;
  const r = input.getBoundingClientRect();
  suggestBox.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 380)) + 'px';
  suggestBox.style.top = (r.bottom + window.scrollY + 4) + 'px';
  suggestBox.hidden = false;
}
function chooseSuggestion(name) {
  const input = suggestFor;
  const it = input && input.dataset.suggest === 'consumable' ? CONSUMABLE_BY_NAME.get(norm(name)) : ITEM_BY_NAME.get(norm(name));
  hideSuggest();
  if (!input || !it) return;
  const obj = getPath(curBuild(), input.dataset.path.replace(/\.name$/, ''));
  if (!obj) return;
  obj.name = it.n;
  if ('rarity' in obj) obj.rarity = it.r || '';
  if ('where' in obj) obj.where = [it.l, it.h].filter(Boolean).join(' — ');
  save();
  render();
}

document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.suggest) showSuggest(e.target); });
document.addEventListener('focusin', (e) => { if (e.target.dataset && e.target.dataset.suggest && e.target.value.trim()) showSuggest(e.target); });
// mousedown rather than click, so the choice lands before the field loses focus
suggestBox.addEventListener('mousedown', (e) => {
  const row = e.target.closest('[data-n]');
  if (row) { e.preventDefault(); chooseSuggestion(row.dataset.n); }
});
document.addEventListener('keydown', (e) => {
  if (suggestBox.hidden || e.target !== suggestFor) return;
  if (e.key === 'Escape') hideSuggest();
  else if (e.key === 'Enter') { e.preventDefault(); chooseSuggestion($('[data-n]', suggestBox).dataset.n); }
});
document.addEventListener('focusout', (e) => { if (e.target === suggestFor) setTimeout(() => { if (document.activeElement !== suggestFor) hideSuggest(); }, 120); });
window.addEventListener('resize', hideSuggest);
