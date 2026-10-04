// Live lookups on bg3.wiki for the Wiki button and name suggestions.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- bg3.wiki ----------
const WIKI_API = 'https://bg3.wiki/w/api.php';
const cut = (text, n) => (text.length > n ? text.slice(0, n - 1).trimEnd() + '…' : text);
const wikiGet = (params) =>
  fetch(WIKI_API + '?' + new URLSearchParams(Object.assign({ format: 'json', origin: '*' }, params)))
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
const wikiSuggest = (text, limit) => wikiGet({ action: 'opensearch', search: text, limit: limit || 8, namespace: 0 }).then((d) => d[1] || []);
async function wikiPage(title) {
  const d = await wikiGet({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: 1, titles: title });
  const p = Object.values((d.query && d.query.pages) || {})[0];
  return p && p.revisions ? { title: p.title, text: p.revisions[0].slots.main['*'] } : null;
}
// Value of a page-template parameter ("| key = value"), which may span several lines.
function wikiField(text, key) {
  const m = new RegExp('^\\|\\s*' + key + '\\s*=[ \\t]*(.*(?:\\n(?!\\s*\\||\\s*\\}\\}).*)*)', 'm').exec(text);
  return m ? m[1].trim() : '';
}
// Wikitext to plain text: {{CharLink|Omeluum}} becomes "Omeluum", [[a|b]] becomes "b".
function wikiClean(text) {
  let prev;
  text = text.replace(/(\w)\{\{/g, '$1 {{');
  do {
    prev = text;
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|').map((x) => x.trim());
      const args = parts.slice(1).filter((x) => !/^[\w ]+=/.test(x));
      if (/^temp ?hp$/i.test(parts[0])) return (args[0] || '') + ' temporary hit points';
      if (/damage/i.test(parts[0]) && args.length > 1) return args.slice(0, 2).join(' ');
      return args[0] || parts[0].replace(/([a-z])([A-Z])/g, '$1 $2');
    });
  } while (text !== prev);
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*\*+\s*/gm, '')
    .replace(/\s*\n\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim();
}
async function wikiItem(name) {
  let page = await wikiPage(name);
  if (!page) {
    const hit = (await wikiSuggest(name, 1))[0];
    if (hit) page = await wikiPage(hit);
  }
  if (!page) return null;
  const f = (k) => wikiClean(wikiField(page.text, k));
  const sources = ['', '2', '3']
    .map((n) => [f('where to find' + n + ' location'), f('where to find' + n)].filter(Boolean).join(' — '))
    .filter(Boolean);
  const rarity = norm(wikiField(page.text, 'rarity')).replace(/\s+/g, '');
  return {
    title: page.title,
    rarity: RARITIES.some(([v]) => v && v === rarity) ? rarity : '',
    where: cut(sources.join(' · or: '), 260),
    desc: cut(f('description'), 240),
  };
}
let suggestTimer = 0;
const suggestCache = {};
function suggest(el) {
  const q = norm(el.value);
  clearTimeout(suggestTimer);
  if (q.length < 3) return;
  suggestTimer = setTimeout(async () => {
    try {
      const list = suggestCache[q] || (suggestCache[q] = await wikiSuggest(q));
      $('#dl-wiki').innerHTML = list.map((x) => `<option value="${esc(x)}">`).join('');
    } catch (err) { /* offline: the field keeps working as free text */ }
  }, 220);
}
