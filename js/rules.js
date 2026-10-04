// Game rules: what a build is proficient with.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- equipment proficiencies ----------
// What a class grants as the starting class and when added later by multiclassing (from the class pages on bg3.wiki).
const LIGHT = 'Light Armour', MEDIUM = 'Medium Armour', HEAVY = 'Heavy Armour', SHIELDS = 'Shields', SIMPLE = 'Simple', MARTIAL = 'Martial';
const CLASS_PROF = Object.fromEntries(Object.keys(DATA.classes).map((c) => [c, { start: DATA.classes[c].start, multi: DATA.classes[c].multi }]));
// Subclasses that add proficiencies, matched against the free-text subclass field.
const SUBCLASS_PROF = [
  ['Cleric', /life|nature/i, [HEAVY]],
  ['Cleric', /tempest|war/i, [HEAVY, MARTIAL]],
  ['Cleric', /death/i, [MARTIAL]],
  ['Bard', /sword/i, [MEDIUM, 'Scimitars']],
  ['Bard', /valou?r/i, [MEDIUM, SHIELDS, MARTIAL]],
  ['Warlock', /hexblade/i, [MEDIUM, SHIELDS, MARTIAL]],
  ['Wizard', /bladesing/i, [LIGHT, 'Daggers', 'Longswords', 'Rapiers', 'Scimitars', 'Shortswords', 'Sickles']],
];
// Feats and features written in the level choices that add armour proficiency.
const PICK_PROF = [
  [/ranger knight/i, [HEAVY]],
  [/lightly armou?red/i, [LIGHT]],
  [/moderately armou?red/i, [MEDIUM, SHIELDS]],
  [/heavily armou?red/i, [HEAVY]],
];

// ---------- items made for someone in particular ----------
// Some effects only work for a race, a class feature or a mark the wearer carries: "A githyanki wearing this
// amulet…", "When you inspire an ally using Bardic Inspiration…", "If the wearer bears the Absolute's Brand…".
// Each rule is [what the sentence must say, who it is for, whether a build is that].
const RACE_WORDS_NEED = { githyanki: 'Githyanki', drow: 'Drow', dwarf: 'Dwarf', dwarves: 'Dwarf', gnome: 'Gnome', gnomes: 'Gnome', halfling: 'Halfling', halflings: 'Halfling',
  elf: 'Elf', elves: 'Elf', tiefling: 'Tiefling', tieflings: 'Tiefling', dragonborn: 'Dragonborn', human: 'Human', humans: 'Human', 'half-orc': 'Half-Orc', 'half-orcs': 'Half-Orc' };
const RACE_NEED = Object.keys(RACE_WORDS_NEED).join('|');
// the sentence is about the wearer, not about who is being attacked ("against githyanki", "attacking Gnomes")
const RACE_WEARER = [
  new RegExp('\\b(?:an? )?(' + RACE_NEED + ') (?:wearing|holding|wielding|throws|casts)\\b', 'i'),
  new RegExp('\\b(?:wielded|worn|thrown) by an? (' + RACE_NEED + ')\\b', 'i'),
  new RegExp('^(' + RACE_NEED + ')(?: and (' + RACE_NEED + '))? (?:also )?(?:gain|are granted)\\b', 'i'),
  new RegExp('\\byour (' + RACE_NEED + ') breath', 'i'),
];
// A half-drow counts as Drow for these effects, as the game tags both.
const isRace = (b, race) => b.creation.race === race || (race === 'Drow' && b.creation.subrace === 'Drow Half-Elf');
const hasClass = (b, cls) => b.levels.some((l) => l.cls === cls);
const FEATURE_NEED = [
  // gear of creatures the party never plays: Steel Watchers, gnolls, the Apostle of Myrkul
  [/not usable by humanoids|can only be (?:used|wielded|equipped|worn) by|only use?able by/i, 'no playable character', () => false],
  [/Bardic Inspiration/i, 'Bard', (b) => hasClass(b, 'Bard')],
  [/Wild Shape/i, 'Druid', (b) => hasClass(b, 'Druid')],
  [/\bRag(?:e|ing)\b/, 'Barbarian', (b) => hasClass(b, 'Barbarian')],
  [/\bSneak Attack\b/i, 'Rogue', (b) => hasClass(b, 'Rogue')],
  [/\bSorcery Points?\b|\bsrcpnt\b/i, 'Sorcerer', (b) => hasClass(b, 'Sorcerer')],
  [/\bKi\b/, 'Monk', (b) => hasClass(b, 'Monk')],
  [/Channel Oath|your Smites?\b|Smite spells/i, 'Paladin', (b) => hasClass(b, 'Paladin') || b.levels.some((l) => l.picks.some((p) => /smite/i.test(p)))],
  [/bound to an Eldritch Knight or is a Warlock/i, 'Eldritch Knight or Warlock', (b) => hasClass(b, 'Warlock') || b.levels.some((l) => /eldritch knight/i.test(l.sub))],
  [/Absolute's Brand/i, "the Absolute's Brand", (b) => !!(b.permanent || {})['Brand of the Absolute']],
];
// What one sentence of an item asks of its wearer: { label, met(b) }, or null when it works for anyone.
function sentenceNeed(s) {
  for (const re of RACE_WEARER) {
    const m = re.exec(s);
    if (m) { const races = [m[1], m[2]].filter(Boolean).map((x) => RACE_WORDS_NEED[x.toLowerCase()]); return { label: races.join(' / '), met: (b) => races.some((r) => isRace(b, r)) }; }
  }
  const rule = FEATURE_NEED.find(([re]) => re.test(s));
  return rule ? { label: rule[1], met: rule[2] } : null;
}
// Every effect sentence of an item with what it asks: [{ text, need }]. Worked out once per item.
// An effect is read as a whole: once one of its sentences names who it is for, the sentences after it
// belong to the same condition ("…has Advantage on Intelligence Saving Throws. Aberrations also have
// Disadvantage on Attack Rolls against them."). A line saying the item's powers "only function if" covers it all.
function itemSentences(it) {
  if (it.nd) return it.nd;
  const split = (text) => String(text || '').split(/\.(?=\s|$)/).map((x) => x.trim()).filter(Boolean);
  const effects = [...String(it.sp || '').split(';'), ...(it.ps || []).map((p) => p[1] || '')];
  const out = [];
  let whole = null;
  effects.forEach((effect) => {
    let gate = null;
    split(effect).forEach((text) => {
      const need = /persists while/i.test(text) ? null : sentenceNeed(text);
      if (need) gate = need;
      if (need && /only function/i.test(text)) whole = need;
      out.push({ text, need: gate });
    });
  });
  if (whole) out.forEach((x) => { x.need = x.need || whole; });
  it.nd = out;
  return out;
}
// How an item suits a build: `ok` is false when every effect it has is for someone the build is not (or it
// cannot be used by a playable character at all); `missing` names who the effects that do not work are for.
function itemFit(it, b) {
  const list = itemSentences(it);
  const dead = list.filter((x) => x.need && !x.need.met(b));
  const missing = [...new Set(dead.map((x) => x.need.label))];
  const barred = dead.some((x) => x.need.label === 'no playable character');
  return { ok: !barred && (!dead.length || dead.length < list.length), missing };
}
const suits = (it, b) => itemFit(it, b).ok;
// The effect text of an item that works for this build.
const liveSentences = (it, b) => itemSentences(it).filter((x) => !x.need || x.need.met(b)).map((x) => x.text);

const WEAPON_TYPES = [...new Set(ITEMS.filter((it) => it.s === 'melee' || it.s === 'ranged').map((it) => it.t))];
const effectTexts = (it) => [it.sp || '', ...(it.ps || []).map((p) => p[1] || '')];
// The item of each gear slot in an act, as {slot: item}. `swap` replaces slots to answer "what if I wore this".
function wornItems(b, act, swap) {
  const out = {};
  SLOTS.forEach(([k]) => { const it = swap && k in swap ? swap[k] : ITEM_BY_NAME.get(norm(b.gear[act].slots[k].name)); if (it) out[k] = it; });
  return out;
}
// Proficiency an item grants by its own text: with itself ("considered Proficient with this armour while
// wearing it") or with weapon types ("You gain Proficiency with Longbows and Shortbows").
function itemProfGrant(it) {
  if (it.pg !== undefined) return it.pg;
  let self = false;
  const types = [];
  effectTexts(it).forEach((text) => text.split(/;|\.(?=\s|$)/).forEach((sentence) => {
    if (/considered proficient with this/i.test(sentence)) self = true;
    else if (/gain proficiency with/i.test(sentence)) WEAPON_TYPES.forEach((w) => { if (norm(sentence).includes(norm(w))) types.push(w); });
  }));
  it.pg = self || types.length ? { self, types } : null;
  return it.pg;
}
// The off hand takes Light weapons only, unless the build has the Dual Wielder feat.
const canOffHand = (it, b) => it.s === 'shield' || (it.w !== 'two' && ((it.pp || []).includes('Light') || b.levels.some((l) => l.picks.some((p) => /dual wielder/i.test(p)))));
// Everything the build is proficient with, as a Set of armour categories, weapon categories and weapon types.
// With an act, what the gear of that act grants is included too.
function proficiencies(b, act, swap) {
  const set = new Set();
  const add = (list) => (list || []).forEach((x) => set.add(x));
  const first = (b.levels.find((l) => l.cls) || {}).cls;
  const seen = new Set();
  b.levels.forEach((l) => {
    if (l.cls && !seen.has(l.cls)) {
      seen.add(l.cls);
      const c = CLASS_PROF[l.cls];
      if (c) add(l.cls === first ? c.start : c.multi);
    }
    SUBCLASS_PROF.forEach(([cls, re, list]) => { if (l.cls === cls && re.test(l.sub)) add(list); });
    l.picks.forEach((p) => {
      PICK_PROF.forEach(([re, list]) => { if (re.test(p)) add(list); });
      // "Feat: Weapon Master (Longbows, Rapiers, ...)" names the weapon types it adds
      if (/weapon master/i.test(p)) WEAPON_TYPES.forEach((w) => { if (norm(p).includes(norm(w)) || norm(p).includes(norm(w.replace(/s$/, '')))) set.add(w); });
    });
  });
  add((DATA.races[b.creation.race] || {}).prof);
  add((DATA.subraces[b.creation.subrace] || {}).prof);
  if (act) Object.values(wornItems(b, act, swap)).forEach((it) => add((itemProfGrant(it) || {}).types));
  // options that grant armour by their own text ("Proficiency with Heavy Armour" of the Ranger Knight)
  chosenOptions(b).forEach(([, text]) => [LIGHT, MEDIUM, HEAVY, SHIELDS].forEach((x) => { if (new RegExp('proficien[^.]*' + x, 'i').test(text)) set.add(x); }));
  return set;
}
const isWeapon = (it) => it.s === 'melee' || it.s === 'ranged';
const canUse = (it, prof) => (itemProfGrant(it) || {}).self
  || (isWeapon(it) ? prof.has(it.t) || prof.has(it.c === 'simple' ? SIMPLE : MARTIAL) : !it.p || prof.has(it.p));
function profText(prof) {
  const armour = [LIGHT, MEDIUM, HEAVY, SHIELDS].filter((x) => prof.has(x));
  const weapons = [];
  if (prof.has(SIMPLE)) weapons.push(t('Simple weapons'));
  if (prof.has(MARTIAL)) weapons.push(t('Martial weapons'));
  [...prof].filter((x) => ![LIGHT, MEDIUM, HEAVY, SHIELDS, SIMPLE, MARTIAL].includes(x)).sort().forEach((x) => {
    const it = ITEMS.find((i) => i.t === x);
    if (!it || !prof.has(it.c === 'simple' ? SIMPLE : MARTIAL)) weapons.push(x);
  });
  return (armour.length ? armour.join(', ') : t('no armour')) + ' · ' + (weapons.length ? weapons.join(', ') : t('no weapons'));
}
