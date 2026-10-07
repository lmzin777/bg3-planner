// Constants, helpers, translation, the data model and saved state. Loaded first; every other script builds on it.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

const APP_VERSION = '4.6';
const STORE_KEY = 'bg3planner.v1';
const PRESETS = window.BG3_PRESETS || [];
const I18N = window.BG3_I18N || {};
const ITEMS = window.BG3_ITEMS || [];
const SPELLS = window.BG3_SPELLS || [];
const CONSUMABLES = window.BG3_CONSUMABLES || [];
const CHOICES = window.BG3_CHOICES || [];
const FEAT_OPTIONS = window.BG3_FEAT_OPTIONS || {};
const PERMANENT = window.BG3_PERMANENT || [];
const SPELL_PICKS = window.BG3_SPELL_PICKS || {};
const DATA = window.BG3_DATA || { races: {}, subraces: {}, raceOrder: {}, backgrounds: {}, origins: {}, classes: {} };

// UI text is written in English and passed through t(); other languages live in i18n.js.
// Game terms (classes, races, skills, backgrounds, item names) stay in English in every language.
const CLASSES = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const ABILS = [['str', 'STR', 'Strength'], ['dex', 'DEX', 'Dexterity'], ['con', 'CON', 'Constitution'], ['int', 'INT', 'Intelligence'], ['wis', 'WIS', 'Wisdom'], ['cha', 'CHA', 'Charisma']];
const ACTS = [['act1', 'Act 1'], ['act2', 'Act 2'], ['act3', 'Act 3']];
const SLOT_GROUPS = [
  ['Armour', [['head', 'Head'], ['cloak', 'Cloak'], ['chest', 'Armour'], ['gloves', 'Gloves'], ['boots', 'Boots']]],
  ['Accessories', [['amulet', 'Amulet'], ['ring1', 'Ring 1'], ['ring2', 'Ring 2']]],
  ['Weapons', [['meleeMain', 'Melee · main hand'], ['meleeOff', 'Melee · off-hand'], ['rangedMain', 'Ranged · main hand'], ['rangedOff', 'Ranged · off-hand']]],
];
const SLOTS = SLOT_GROUPS.flatMap((g) => g[1]);
const SLOT_LABEL = Object.fromEntries(SLOTS);
const RARITIES = [['', 'Rarity'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['veryrare', 'Very rare'], ['legendary', 'Legendary']];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PARTY_SIZE = 4;
const TRASH_MAX = 15;
// Creation data comes from gamedata.js, which tools/update_gamedata.py builds from the wiki.
// Hit die per class: the first level of the character gets the full die, later levels half of it plus one.
const HIT_DIE = Object.fromEntries(CLASSES.map((c) => [c, ((DATA.classes[c] || {}).hp || [8])[0]]));
// Origin characters lock race and background; a custom character and the Dark Urge leave the race free.
const ORIGINS = Object.keys(DATA.origins).map((name) => { const o = DATA.origins[name]; return [name, o.race ? { race: o.race, subrace: o.subrace || '', background: o.background } : o.background ? { background: o.background } : null]; });
// {race: [subraces]} and {background: [its two skills]}, in the order the game lists them.
const RACES = Object.assign({}, DATA.raceOrder);
const BACKGROUNDS = Object.fromEntries(Object.keys(DATA.backgrounds).map((k) => [k, DATA.backgrounds[k].skills]));
const SKILLS = [
  ['STR', ['Athletics']],
  ['DEX', ['Acrobatics', 'Sleight of Hand', 'Stealth']],
  ['INT', ['Arcana', 'History', 'Investigation', 'Nature', 'Religion']],
  ['WIS', ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival']],
  ['CHA', ['Deception', 'Intimidation', 'Performance', 'Persuasion']],
];
const ALL_SKILLS = SKILLS.flatMap((g) => g[1]);

// ---------- helpers ----------
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').trim().toLowerCase();
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  ks.reduce((a, k) => a[k], o)[last] = v;
};
const wikiUrl = (text) => {
  const q = String(text || '')
    .replace(/^(Feat|Spells?|Cantrips?|Fighting Style|Favoured Enemy|Natural Explorer|Expertise|Metamagic|Subclass)\s*:\s*/i, '')
    .replace(/\s*\(.*$/, '')
    .trim();
  return 'https://bg3.wiki/w/index.php?search=' + encodeURIComponent(q);
};
const skillList = (text) => [...new Set(String(text || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)
  .map((x) => ALL_SKILLS.find((s) => norm(s) === norm(x)) || x))];

const CONSUMABLE_BY_NAME = new Map(CONSUMABLES.map((c) => [norm(c.n), c]));
// An elixir that sets an ability score ("increase your Strength to 21"), as { ab, to }; null for any other.
function elixirAbility(name) {
  const c = CONSUMABLE_BY_NAME.get(norm(name));
  if (!c || c.t !== 'Elixir') return null;
  const m = new RegExp('increase your (' + ABILS.map((a) => a[2]).join('|') + ') to (\\d+)', 'i').exec(c.x || '');
  return m ? { ab: ABILS.find((a) => norm(a[2]) === norm(m[1]))[0], to: Number(m[2]) } : null;
}

let state = null;
// Each script adds its button handlers here; main.js dispatches clicks to them.
const actions = {};

// Translate a UI string. The English text is the key; {name} placeholders are filled from vars.
function t(s, vars) {
  const dict = state && I18N[state.ui.lang];
  const out = (dict && dict[s]) || s;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '')) : out;
}

// ---------- data model ----------
const blankSlot = () => ({ name: '', rarity: '', where: '', note: '', got: false });
const blankAct = () => ({ slots: Object.fromEntries(SLOTS.map(([k]) => [k, blankSlot()])), alts: [] });

function blankBuild() {
  return {
    id: uid(),
    name: t('New build'),
    role: '',
    source: '',
    credit: '',
    summary: '',
    creation: { origin: '', race: '', subrace: '', background: '', skills: '', cantrip: '', abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, plus2: '', plus1: '', extra: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } },
    // picks: the choices the level grants, one line each; notes: lines that are not one of them and do not count
    levels: Array.from({ length: 12 }, () => ({ cls: '', sub: '', picks: [], notes: [] })),
    gear: Object.fromEntries(ACTS.map(([k]) => [k, blankAct()])),
    setup: [],
    consumables: [],
    elixir: '',
    // spells kept prepared by the classes that prepare, as {class: [names]}, and Wizard spells learned from scrolls
    prepared: {},
    scrolls: [],
    // permanent bonuses the build plans to get, as {name: { on, ab (the ability it was put on), extra, got }}
    permanent: {},
    // the level the character is at in the playthrough; 0 means "show the finished build"
    current: 0,
    // situational bonuses switched on in Final numbers (Rage, Bless, a ring that works only in shadow…)
    active: [],
    variants: '',
    notes: '',
  };
}

// Map free text from older saves ("human", "High Elf" typed as the race) onto the game's names.
function fixCreation(c) {
  const canon = (v, list) => list.find((x) => norm(x) === norm(v)) || String(v || '').trim();
  c.origin = /^(tav|custom)\b/i.test(c.origin) ? ORIGINS[0][0] : canon(c.origin, ORIGINS.map((o) => o[0]));
  c.background = canon(c.background, Object.keys(BACKGROUNDS));
  const parent = Object.keys(RACES).find((r) => RACES[r].some((s) => norm(s) === norm(c.race)));
  if (parent) { c.subrace = c.race; c.race = parent; }
  c.race = canon(c.race, Object.keys(RACES));
  c.subrace = canon(c.subrace, RACES[c.race] || []);
  c.skills = skillList(c.skills).join(', ');
  c.extra = Object.assign({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, c.extra);
}

// Fill in whatever is missing, so lean presets and imported files are accepted.
function normalizeBuild(src) {
  const b = blankBuild();
  const s = src || {};
  ['id', 'name', 'role', 'source', 'credit', 'summary', 'variants', 'notes', 'presetId'].forEach((k) => {
    if (typeof s[k] === 'string' && (k !== 'id' || s[k])) b[k] = s[k];
  });
  if (s.creation) {
    Object.assign(b.creation, s.creation, { abilities: Object.assign(b.creation.abilities, s.creation.abilities || {}) });
  }
  fixCreation(b.creation);
  if (Array.isArray(s.levels)) {
    b.levels = b.levels.map((l, i) => {
      const x = s.levels[i] || {};
      return { cls: x.cls || '', sub: x.sub || '', picks: Array.isArray(x.picks) ? x.picks.map(String) : [], notes: Array.isArray(x.notes) ? x.notes.map(String) : [] };
    });
  }
  ACTS.forEach(([k]) => {
    const a = (s.gear && s.gear[k]) || {};
    SLOTS.forEach(([sk]) => Object.assign(b.gear[k].slots[sk], (a.slots && a.slots[sk]) || {}));
    b.gear[k].alts = Array.isArray(a.alts) ? a.alts.map((x) => ({ slot: x.slot || 'head', name: x.name || '', where: x.where || '', note: x.note || '' })) : [];
  });
  ['setup', 'consumables'].forEach((k) => {
    b[k] = Array.isArray(s[k]) ? s[k].map((x) => ({ name: String(x.name || '').trim(), note: x.note || '' })).filter((x) => x.name) : [];
  });
  if (s.permanent && typeof s.permanent === 'object') {
    Object.keys(s.permanent).forEach((k) => { const v = s.permanent[k]; if (v && v.on) b.permanent[k] = { on: true, ab: v.ab || '', extra: !!v.extra, got: !!v.got }; });
  }
  if (s.prepared && typeof s.prepared === 'object') Object.keys(s.prepared).forEach((k) => { if (Array.isArray(s.prepared[k])) b.prepared[k] = s.prepared[k].map(String); });
  if (Array.isArray(s.scrolls)) b.scrolls = s.scrolls.map(String);
  b.current = Math.max(0, Math.min(12, Number(s.current) || 0));
  b.active = Array.isArray(s.active) ? s.active.map(String) : [];
  // The elixir the build keeps active. Builds saved before this field existed take the strongest
  // ability elixir from their consumables list, which is what those builds were planned around.
  if (typeof s.elixir === 'string') b.elixir = s.elixir;
  else {
    const best = b.consumables.map((x) => [x.name.trim(), elixirAbility(x.name)]).filter((x) => x[1]).sort((x, y) => y[1].to - x[1].to)[0];
    b.elixir = best ? CONSUMABLE_BY_NAME.get(norm(best[0])).n : '';
  }
  return b;
}

function blankParty(name) {
  return { id: uid(), name: name || t('New party'), notes: '', members: Array.from({ length: PARTY_SIZE }, () => ({ char: '', buildId: '' })) };
}
function normalizeParty(src) {
  const p = blankParty(src && src.name);
  if (src && src.id) p.id = src.id;
  if (src && typeof src.notes === 'string') p.notes = src.notes;
  p.members = p.members.map((m, i) => Object.assign(m, (src && src.members && src.members[i]) || {}));
  return p;
}

// A first visit starts with nothing in My builds: the ready-made builds are there to be copied, and none is
// until whoever visits asks for it. `seed` puts the first of them in, for the test page to have something to work on.
function fresh(seed) {
  const builds = seed && PRESETS.length ? [Object.assign(normalizeBuild(clone(PRESETS[0])), { id: uid() })] : [];
  const party = blankParty(t('My party'));
  if (builds[0]) party.members[0] = { char: builds[0].creation.origin || '', buildId: builds[0].id };
  return hydrate(Object.assign({ builds, parties: [party] }, seed ? {} : { ui: { tab: 'home' } }));
}
function hydrate(s) {
  const st = { builds: (s.builds || []).map(normalizeBuild), parties: (s.parties || []).map(normalizeParty),
    // builds and parties deleted recently, newest first, so a delete can be undone
    trash: (Array.isArray(s.trash) ? s.trash : []).filter((x) => x && x.data).slice(0, TRASH_MAX),
    ui: Object.assign({ tab: 'builds', act: 'act1', partyAct: 'act1', lang: 'en' }, s.ui || {}) };
  if (!st.parties.length) st.parties.push(blankParty(t('My party')));
  if (!st.builds.some((b) => b.id === st.ui.buildId)) st.ui.buildId = st.builds[0] ? st.builds[0].id : '';
  if (!st.parties.some((p) => p.id === st.ui.partyId)) st.ui.partyId = st.parties[0].id;
  return st;
}
function load() {
  if (window.BG3_TEST) return fresh(true);  // the test page never reads or writes saved data
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const s = raw && JSON.parse(raw);
    if (s && Array.isArray(s.builds)) return hydrate(s);
  } catch (e) { /* storage unavailable or corrupted: start from the default */ }
  return fresh();
}

state = load();
let saveTimer = 0;
function save() {
  // every change goes through here: first each line of each level is checked to be a choice that level grants
  if (typeof tidyAll === 'function') tidyAll();
  if (window.BG3_TEST) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      flashSaved(t('Saved'));
    } catch (e) {
      flashSaved(t('Could not save in this browser — use Export'));
    }
  }, 250);
}
function flashSaved(msg) {
  const el = $('#saved');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => el.classList.remove('on'), 1400);
}
// A short message at the bottom. With `action` ({ label, act }) it carries a button and stays longer.
function toast(msg, action) {
  const el = $('#toast');
  el.textContent = msg;
  if (action) el.insertAdjacentHTML('beforeend', ` <button class="btn tiny" data-act="${esc(action.act)}">${esc(action.label)}</button>`);
  el.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), action ? 8000 : 2600);
}

const curBuild = () => state.builds.find((b) => b.id === state.ui.buildId) || null;
const curParty = () => state.parties.find((p) => p.id === state.ui.partyId) || state.parties[0];
const buildById = (id) => state.builds.find((b) => b.id === id) || null;

// ---------- derived ----------
function splitText(b) {
  const order = [];
  const info = {};
  b.levels.forEach((l) => {
    if (!l.cls) return;
    if (!info[l.cls]) { info[l.cls] = { n: 0, sub: '' }; order.push(l.cls); }
    info[l.cls].n++;
    if (l.sub.trim()) info[l.cls].sub = l.sub.trim();
  });
  if (!order.length) return t('Levels not set yet');
  return order.map((c) => info[c].n + ' ' + (info[c].sub || c)).join(' / ');
}
const bonusOf = (b, ab) => (b.creation.plus2 === ab ? 2 : 0) + (b.creation.plus1 === ab ? 1 : 0);
const finalOf = (b, ab) => (Number(b.creation.abilities[ab]) || 0) + bonusOf(b, ab);
const modText = (score) => { const m = Math.floor((score - 10) / 2); return (m >= 0 ? '+' : '') + m; };
function pointsUsed(b) {
  let total = 0;
  for (const [ab] of ABILS) {
    const c = POINT_COST[Number(b.creation.abilities[ab])];
    if (c == null) return null;
    total += c;
  }
  return total;
}
const abilLine = (b) => ABILS.map(([ab, short]) => finalOf(b, ab) + ' ' + short).join(' · ');
const raceText = (c) => [c.race, c.subrace].filter(Boolean).join(' · ');
function actProgress(b, act) {
  const filled = SLOTS.filter(([k]) => b.gear[act].slots[k].name.trim());
  return { total: filled.length, got: filled.filter(([k]) => b.gear[act].slots[k].got).length };
}

// ---------- small render pieces ----------
// A number changed by a − and a + button. `target` is the attribute saying what it changes (data-path or data-ui);
// `up` can switch the + off and give it a tooltip.
const stepper = (value, target, min, max, up) => `<span class="stepper">
  <button data-act="step" ${target} data-d="-1" data-min="${min}" data-max="${max}"${value <= min ? ' disabled' : ''} aria-label="${t('Decrease')}">−</button><b>${value}</b>
  <button data-act="step" ${target} data-d="1" data-min="${min}" data-max="${max}"${value >= max || (up && up.off) ? ' disabled' : ''} aria-label="${t('Increase')}"${up && up.title ? ` title="${up.title}"` : ''}>+</button></span>`;
const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
const field = (label, path, value, ph, extra) =>
  `<label class="field"><span>${label}</span><input type="text" data-path="${path}" value="${esc(value)}" placeholder="${esc(ph || '')}" ${extra || ''}></label>`;
// Dropdown over a fixed list. A saved value that is not in the list is kept as an extra option.
const selectField = (label, path, cur, options, empty, attrs) => {
  const known = options.some((o) => (Array.isArray(o) ? o[0] : o) === cur);
  return `<label class="field"><span>${label}</span><select data-path="${path}" ${attrs || ''}>${opt('', empty, cur)}${
    options.map((o) => (Array.isArray(o) ? opt(o[0], o[1], cur) : opt(o, o, cur))).join('')}${
    cur && !known ? opt(cur, cur, cur) : ''}</select></label>`;
};
const actTabs = (cur, action, progressOf) =>
  `<div class="acts">${ACTS.map(([k, label]) => {
    const p = progressOf ? progressOf(k) : null;
    return `<button class="${k === cur ? 'on' : ''}" data-act="${action}" data-k="${k}">${t(label)}${p ? `<small>${p.got}/${p.total}</small>` : ''}</button>`;
  }).join('')}</div>`;
