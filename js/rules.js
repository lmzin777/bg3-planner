// Game rules: what a build is proficient with.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- equipment proficiencies ----------
// What a class grants as the starting class and when added later by multiclassing (from the class pages on bg3.wiki).
const LIGHT = 'Light Armour', MEDIUM = 'Medium Armour', HEAVY = 'Heavy Armour', SHIELDS = 'Shields', SIMPLE = 'Simple', MARTIAL = 'Martial';
const CLASS_PROF = {
  Barbarian: { start: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL], multi: [SHIELDS, SIMPLE, MARTIAL] },
  Bard: { start: [LIGHT, SIMPLE, 'Hand Crossbows', 'Rapiers', 'Longswords', 'Shortswords'], multi: [LIGHT] },
  Cleric: { start: [LIGHT, MEDIUM, SHIELDS, SIMPLE, 'Flails', 'Morningstars'], multi: [LIGHT, MEDIUM, SHIELDS, 'Flails', 'Morningstars'] },
  Druid: { start: [LIGHT, MEDIUM, SHIELDS, 'Clubs', 'Daggers', 'Javelins', 'Maces', 'Quarterstaves', 'Scimitars', 'Sickles', 'Spears'], multi: [LIGHT, MEDIUM, SHIELDS] },
  Fighter: { start: [LIGHT, MEDIUM, HEAVY, SHIELDS, SIMPLE, MARTIAL], multi: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL] },
  Monk: { start: [SIMPLE, 'Shortswords'], multi: [SIMPLE, 'Shortswords'] },
  Paladin: { start: [LIGHT, MEDIUM, HEAVY, SHIELDS, SIMPLE, MARTIAL], multi: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL] },
  Ranger: { start: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL], multi: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL] },
  Rogue: { start: [LIGHT, SIMPLE, 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'], multi: [LIGHT] },
  Sorcerer: { start: ['Daggers', 'Quarterstaves', 'Light Crossbows'], multi: [] },
  Warlock: { start: [LIGHT, SIMPLE], multi: [LIGHT, SIMPLE] },
  Wizard: { start: ['Daggers', 'Quarterstaves', 'Light Crossbows'], multi: [] },
};
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

const WEAPON_TYPES = [...new Set(ITEMS.filter((it) => it.s === 'melee' || it.s === 'ranged').map((it) => it.t))];
// The off hand takes Light weapons only, unless the build has the Dual Wielder feat.
const canOffHand = (it, b) => it.s === 'shield' || (it.w !== 'two' && ((it.pp || []).includes('Light') || b.levels.some((l) => l.picks.some((p) => /dual wielder/i.test(p)))));
// Everything the build is proficient with, as a Set of armour categories, weapon categories and weapon types.
function proficiencies(b) {
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
  return set;
}
const isWeapon = (it) => it.s === 'melee' || it.s === 'ranged';
const canUse = (it, prof) => (isWeapon(it) ? prof.has(it.t) || prof.has(it.c === 'simple' ? SIMPLE : MARTIAL) : !it.p || prof.has(it.p));
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
