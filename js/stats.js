// The numbers of the finished character: abilities with feats, gear and elixir, proficiency bonus, hit points,
// initiative, saving throws, armour class per act, attacks, spellcasting, spell slots, class resources and
// skill bonuses. Also the party's skill coverage and collection route.
'use strict';

const ABILITY_KEYS = ABILS.map((a) => a[0]);
const ABILITY_WORDS = ABILS.map((a) => a[2]).join('|');
const abilityKey = (word) => ABILS.find((a) => norm(a[2]) === norm(word))[0];
const abilityShort = (ab) => ABILS.find((a) => a[0] === ab)[1];
const charLevel = (b) => b.levels.filter((l) => l.cls).length;
const profBonus = (level) => 2 + Math.floor((Math.max(level, 1) - 1) / 4);
const allPicks = (b) => b.levels.flatMap((l) => l.picks);
const hasPick = (b, re) => allPicks(b).some((p) => re.test(p));
// Fighting styles the build took. A choice may name alternatives ("Defence (or Archery)"); only the first counts.
const fightingStyles = (b) => allPicks(b).map((p) => /^fighting style\s*:\s*(.+)$/i.exec(p.trim())).filter(Boolean)
  .map((m) => norm(m[1].split(/\(|,|\/|\bor\b/i)[0]));
const hasStyle = (b, re) => fightingStyles(b).some((s) => re.test(s));
const modOf = (score) => Math.floor((score - 10) / 2);
const classLevels = (b) => { const out = {}; b.levels.forEach((l) => { if (l.cls) out[l.cls] = (out[l.cls] || 0) + 1; }); return out; };
// Every feature the classes and subclasses of the build grant, over all its levels.
const allGains = (b) => levelInfo(b).flatMap(levelGains);

// ---------- what items do, read from their text ----------
const sentencesOf = (it) => effectTexts(it).flatMap((text) => text.split(/;|\.(?=\s|$)/)).map((x) => x.trim()).filter(Boolean);
const CONDITIONAL = /\b(while|when|whenever|after|until|if|against|as long as|for every|once per|each time)\b/i;
const RACE_WORDS = [[/\bgnomes?\b/i, 'Gnome'], [/\bhalflings?\b/i, 'Halfling'], [/\bdwar(?:f|ves)\b/i, 'Dwarf']];

// Ability scores an item changes: { ab, kind: 'set' | 'add', n, cap, races }.
// "Set the wearer's Strength to 23" · "Constitution +2 (up to 20)" · "increase your Dexterity by 2, to a maximum of 20".
function itemAbilityEffects(it) {
  if (it.ae) return it.ae;
  const out = [];
  sentencesOf(it).forEach((s) => {
    const races = RACE_WORDS.filter(([re]) => re.test(s)).map(([, race]) => race);
    let m = new RegExp("(?:sets?|increases?) (?:the wearer's |your )?(" + ABILITY_WORDS + ')(?: score)? to (\\d+)', 'i').exec(s);
    if (m) { out.push({ ab: abilityKey(m[1]), kind: 'set', n: Number(m[2]) }); return; }
    m = new RegExp('increase your (' + ABILITY_WORDS + ') by (\\d), to a maximum of (\\d+)', 'i').exec(s);
    if (m) { out.push({ ab: abilityKey(m[1]), kind: 'add', n: Number(m[2]), cap: Number(m[3]) }); return; }
    if (races.length) {
      m = new RegExp('\\+(\\d) (?:to )?(' + ABILITY_WORDS + ')', 'i').exec(s);
      if (m) out.push({ ab: abilityKey(m[2]), kind: 'add', n: Number(m[1]), cap: 0, races });
      return;
    }
    for (const x of s.matchAll(new RegExp('\\b(' + ABILITY_WORDS + ') ([+-]\\d)(?:\\s*[(,]\\s*up to (\\d+))?', 'gi'))) {
      out.push({ ab: abilityKey(x[1]), kind: 'add', n: Number(x[2]), cap: Number(x[3]) || 0 });
    }
  });
  it.ae = out;
  return out;
}

// Flat bonuses an item gives by its own text, and when: always, only in the off hand, only while
// unarmoured, or only in some situation (which the planner lists but does not count).
// Kinds: ac, spellDc, spellAttack, initiative, attack, saves.
function itemBonuses(it) {
  if (it.bo) return it.bo;
  const out = [];
  sentencesOf(it).forEach((s) => {
    const when = /off-?hand/i.test(s) ? 'offhand' : /not wearing armour/i.test(s) ? 'unarmoured' : CONDITIONAL.test(s) ? 'situational' : 'always';
    const push = (kind, n) => { if (!out.some((x) => x.kind === kind)) out.push({ kind, n: Number(n), when, text: s }); };
    const m = /\+(\d)(?: bonus)? to ([^.;]*)/i.exec(s);
    if (m) {
      const tail = m[2];
      if (/armour class/i.test(tail)) push('ac', m[1]);
      if (/spell save dc/i.test(tail)) push('spellDc', m[1]);
      if (/spell attack/i.test(tail)) push('spellAttack', m[1]);
      if (/initiative/i.test(tail)) push('initiative', m[1]);
      if (/(?<!spell )attack rolls?/i.test(tail)) push('attack', m[1]);
      if (/saving throws/i.test(tail) && !new RegExp('(' + ABILITY_WORDS + ') saving throws', 'i').test(tail)) push('saves', m[1]);
    }
    const ac = /Armour Class \+(\d)|Armour Class increases by (\d)/i.exec(s);
    if (ac) push('ac', ac[1] || ac[2]);
  });
  it.bo = out;
  return out;
}
const itemAcBonus = (it) => itemBonuses(it).find((x) => x.kind === 'ac') || null;
// The always-on bonuses of one kind from everything worn: { n, parts: [[item, n]], situational: [text] }.
function gearBonus(worn, kind) {
  const out = { n: 0, parts: [], situational: [] };
  Object.values(worn).forEach((it) => {
    const x = itemBonuses(it).find((y) => y.kind === kind);
    if (!x) return;
    if (x.when === 'always') { out.n += x.n; out.parts.push([it.n, x.n]); } else out.situational.push(it.n + ': ' + x.text);
  });
  return out;
}
// "Performance +1" and "Strength Saving Throws +1": a named skill or saving throw an item raises.
function namedBonus(worn, name) {
  const re = new RegExp('(?:^|\\b)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\+(\\d)\\b', 'i');
  let n = 0;
  Object.values(worn).forEach((it) => sentencesOf(it).forEach((s) => { const m = !CONDITIONAL.test(s) && re.exec(s); if (m) n += Number(m[1]); }));
  return n;
}

// ---------- abilities ----------
// Ability increases written in feat choices, e.g. "Feat: Ability Improvement (+2 DEX)" or "Feat: Tavern Brawler +1 CON".
function featBonuses(b) {
  const out = Object.fromEntries(ABILITY_KEYS.map((k) => [k, 0]));
  allPicks(b).filter((p) => /^feat\b/i.test(p.trim())).forEach((p) => {
    for (const m of p.matchAll(/\+\s*(\d)\s*(STR|DEX|CON|INT|WIS|CHA)\b/gi)) out[m[2].toLowerCase()] += Number(m[1]);
  });
  return out;
}
// Creation score plus feats (capped at 20, as the game does) plus the manual "other bonuses".
function finalAbility(b, ab, feats) {
  const other = Number((b.creation.extra || {})[ab]) || 0;
  return Math.min(20, finalOf(b, ab) + (feats || featBonuses(b))[ab]) + other;
}
// Scores with the gear of an act and the build's elixir on top: { scores, mods, sources, feats }.
// Items that add go first, up to their own cap; an item or elixir that sets a score only raises it.
function abilityScores(b, act, swap) {
  const feats = featBonuses(b);
  const worn = act ? wornItems(b, act, swap) : {};
  const elixir = elixirAbility(b.elixir);
  const perm = permanentBonuses(b, act);
  const scores = {};
  const sources = {};
  ABILITY_KEYS.forEach((ab) => {
    let v = finalAbility(b, ab, feats);
    const src = [];
    perm.abilities[ab].forEach(([n, name]) => { v += n; src.push(signed(n) + ' ' + name); });
    const effects = [...new Set(Object.values(worn))].flatMap((it) => itemAbilityEffects(it)
      .filter((e) => e.ab === ab && (!e.races || e.races.includes(b.creation.race))).map((e) => [e, it.n]));
    effects.filter(([e]) => e.kind === 'add').forEach(([e, name]) => {
      const next = e.n < 0 || !e.cap ? v + e.n : Math.max(v, Math.min(v + e.n, e.cap));
      if (next !== v) { src.push(signed(next - v) + ' ' + name); v = next; }
    });
    const sets = effects.filter(([e]) => e.kind === 'set').map(([e, name]) => [e.n, name]);
    if (elixir && elixir.ab === ab) sets.push([elixir.to, b.elixir]);
    sets.sort((x, y) => y[0] - x[0]);
    if (sets.length && sets[0][0] > v) { v = sets[0][0]; src.push(t('{n} from {x}', { n: v, x: sets[0][1] })); }
    scores[ab] = v;
    sources[ab] = src;
  });
  return { scores, sources, feats, mods: Object.fromEntries(ABILITY_KEYS.map((k) => [k, modOf(scores[k])])) };
}

// Skills with Expertise, from choices such as "Expertise: Athletics + Stealth".
function expertiseSkills(b) {
  const out = new Set();
  allPicks(b).forEach((p) => {
    const m = /^expertise\s*:?\s*(.+)$/i.exec(p.trim());
    if (m) m[1].split(/\s*(?:\+|,|&|\band\b)\s*/i).forEach((x) => { const s = ALL_SKILLS.find((k) => norm(k) === norm(x)); if (s) out.add(s); });
  });
  if (b.creation.subrace === 'Rock Gnome') out.add('History');
  return out;
}
// Skill proficiencies written as a level choice: "Skills: Arcana, History" or "Feat: Skilled (Arcana, History, Insight)".
function pickedSkills(b) {
  const out = new Set();
  allPicks(b).forEach((p) => {
    const m = /^(?:skills?|proficienc(?:y|ies))\s*:\s*(.+)$/i.exec(p.trim()) || /^feat\s*:\s*skilled\b(.*)$/i.exec(p.trim());
    if (m) ALL_SKILLS.forEach((k) => { if (new RegExp('\\b' + k + '\\b', 'i').test(m[1])) out.add(k); });
  });
  // options that grant a skill by their own text: a Favoured Enemy, an Eldritch Invocation
  chosenOptions(b).forEach(([, text]) => { if (/proficien/i.test(text)) ALL_SKILLS.forEach((k) => { if (new RegExp('\\b' + k + '\\b').test(text)) out.add(k); }); });
  return out;
}

function hitPoints(b, con) {
  let hp = 0;
  let first = true;
  b.levels.forEach((l) => {
    const die = HIT_DIE[l.cls];
    if (!die) return;
    hp += (first ? die : die / 2 + 1) + con;
    first = false;
  });
  const level = charLevel(b);
  if (hasPick(b, /^feat\b.*\btough\b/i)) hp += 2 * level;
  if (b.creation.subrace === 'Gold Dwarf') hp += level;
  // Draconic Resilience: one more hit point per Sorcerer level
  const info = levelInfo(b);
  if (info.some((x) => x.sub === 'Draconic Bloodline')) hp += info.filter((x) => x.cls === 'Sorcerer').length;
  return hp;
}

// ---------- armour class ----------
const ARMOUR_TYPES = ['Light Armour', 'Medium Armour', 'Heavy Armour'];

// Armour Class with the gear of one act, following the formulas on the wiki's Armour Class page:
// armour (with Dexterity as its type allows) or the best unarmoured formula the build has, plus the shield,
// plus every item that always adds AC, plus Defence and Dual Wielder. `swap` replaces slots ({slot: item})
// to answer "what if I wore this instead". Spells and situational bonuses are reported apart, not added.
function armourClassInfo(b, act, mods, swap) {
  if (!mods || swap) mods = abilityScores(b, act, swap).mods;  // a swapped item may itself change Dexterity
  const worn = wornItems(b, act, swap);
  const chest = worn.chest;
  const base = chest && /^AC (\d+)/.exec(chest.d || '');
  const armoured = !!base && ARMOUR_TYPES.includes(chest.t);
  const shield = worn.meleeOff && worn.meleeOff.s === 'shield' ? worn.meleeOff : null;
  const classes = new Set(b.levels.map((l) => l.cls));
  const parts = [];
  if (armoured && chest.t === 'Heavy Armour') parts.push([chest.n, Number(base[1])]);
  else if (armoured && chest.t === 'Medium Armour') {
    const fullDex = (chest.ps || []).some((p) => /full Dexterity/i.test(p[1]));
    const cap = hasPick(b, /medium armour master/i) ? 3 : 2;
    parts.push([chest.n, Number(base[1])], ['DEX', fullDex ? mods.dex : Math.min(mods.dex, cap)]);
  } else if (armoured) parts.push([chest.n, Number(base[1])], ['DEX', mods.dex]);
  else {
    // unarmoured: the game uses whichever available formula gives the most
    const formulas = [[[t('Unarmoured'), 10], ['DEX', mods.dex]]];
    if (classes.has('Barbarian')) formulas.push([[t('Unarmoured Defence'), 10], ['DEX', mods.dex], ['CON', mods.con]]);
    if (classes.has('Monk') && !shield) formulas.push([[t('Unarmoured Defence'), 10], ['DEX', mods.dex], ['WIS', mods.wis]]);
    if (levelInfo(b).some((x) => x.sub === 'Draconic Bloodline')) formulas.push([['Draconic Resilience', 13], ['DEX', mods.dex]]);
    const sum = (f) => f.reduce((a, p) => a + p[1], 0);
    parts.push(...formulas.sort((x, y) => sum(y) - sum(x))[0]);
  }
  const baseSum = parts.reduce((a, p) => a + p[1], 0);
  if (shield) parts.push([shield.n, Number(shield.ab) || 2]);
  const situational = [];
  Object.entries(worn).forEach(([slot, it]) => {
    const bonus = itemAcBonus(it);
    if (!bonus || it === shield) return;
    if (bonus.when === 'always' || (bonus.when === 'offhand' && slot === 'meleeOff') || (bonus.when === 'unarmoured' && !armoured && !shield)) parts.push([it.n, bonus.n]);
    else if (bonus.when === 'situational') situational.push(it.n + ': ' + bonus.text);
  });
  if (armoured && hasStyle(b, /defen[cs]e/)) parts.push(['Defence', 1]);
  const dual = worn.meleeMain && worn.meleeOff && worn.meleeMain.s === 'melee' && worn.meleeOff.s === 'melee';
  if (dual && hasPick(b, /dual wielder/i)) parts.push(['Dual Wielder', 1]);
  const total = parts.reduce((a, p) => a + p[1], 0);
  // Mage Armour is a spell, so it is shown as "would be" rather than counted
  const mage = !armoured && hasPick(b, /mage armour/i) ? 13 + mods.dex + (total - baseSum) : 0;
  return { total, parts, situational, mage: mage > total ? mage : 0 };
}
const armourClass = (b, act, mods, swap) => armourClassInfo(b, act, mods, swap).total;

// ---------- attacks ----------
// The average roll of a dice text: "2d6" is 7, a flat "1" is 1.
const avgDice = (text) => { const m = /(\d+)d(\d+)/.exec(text || ''); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : Number(text) || 0; };
const WEAPON_SLOTS = ['meleeMain', 'meleeOff', 'rangedMain', 'rangedOff'];
// "1d8 + 1 Slashing" as { dice, flat, type }; the flat part is the weapon's enchantment.
function parseDamage(text) {
  const m = /(\d+d\d+)(?:\s*\+\s*(\d+))?\s*(.*)$/.exec(text || '');
  return m ? { dice: m[1], flat: Number(m[2]) || 0, type: m[3].trim() } : null;
}
// Attack bonus and damage of each weapon worn in an act, and of the unarmed strike for those who fight with it.
// Rules from the wiki's Attacks, Enchantment and Fighting style pages: ability modifier (Strength for melee,
// Dexterity for ranged, the higher of the two for Finesse), proficiency bonus when proficient, the enchantment,
// Archery +2 to ranged attack rolls, Duelling +2 damage, and the off hand adding its modifier only with
// Two-Weapon Fighting. Extra damage that depends on the situation is listed apart.
function attackRows(b, act, ab, pb, swap) {
  const worn = wornItems(b, act, swap);
  const prof = proficiencies(b, act, swap);
  const info = levelInfo(b);
  const monk = info.filter((x) => x.cls === 'Monk').length;
  const brawler = hasPick(b, /tavern brawler/i);
  const martial = monk ? classColumn('Monk', monk, /martial arts/i) : '';
  const mods = ab.mods;
  const pact = hasPick(b, /pact of the blade/i) || info.some((x) => x.sub === 'The Hexblade');
  const twf = hasStyle(b, /two-weapon/);
  const gearAttack = gearBonus(worn, 'attack');
  const rows = [];
  WEAPON_SLOTS.forEach((slot) => {
    const it = worn[slot];
    if (!it || !isWeapon(it)) return;
    const off = slot === 'meleeOff' || slot === 'rangedOff';
    const proficient = canUse(it, prof) || (pact && slot === 'meleeMain');
    // Monk weapons: any weapon the monk is proficient with that is neither Heavy nor Two-Handed. They may use Dexterity.
    const monkWeapon = monk && it.s === 'melee' && proficient && it.w !== 'two' && !(it.pp || []).includes('Heavy');
    let key = it.s === 'ranged' ? 'dex' : ((it.pp || []).includes('Finesse') || monkWeapon) && mods.dex > mods.str ? 'dex' : 'str';
    // a bound pact weapon attacks with Charisma
    if (pact && slot === 'meleeMain' && mods.cha > mods[key]) key = 'cha';
    const enchant = Number(String(it.en || '').replace('+', '')) || 0;
    const attack = [[abilityShort(key), mods[key]]];
    if (proficient) attack.push([t('Proficiency'), pb]);
    if (enchant) attack.push([t('Enchantment'), enchant]);
    if (it.s === 'ranged' && hasStyle(b, /archery/)) attack.push(['Archery', 2]);
    gearAttack.parts.forEach((p) => attack.push(p));
    // a versatile weapon with the other hand free is held in both hands
    const twoHands = it.w === 'versatile' && slot === 'meleeMain' && !worn.meleeOff && it.vd;
    const dmg = parseDamage(twoHands ? it.vd : it.d) || { dice: '', flat: 0, type: '' };
    let type = dmg.type || (parseDamage(it.d) || {}).type || '';
    // Deft Strikes: a monk weapon rolls the Martial Arts die when that is more than its own
    if (monkWeapon && avgDice(martial) > avgDice(dmg.dice)) { dmg.dice = martial; type = 'Bludgeoning'; }
    const damage = [];
    if (!off || twf || mods[key] < 0) damage.push([abilityShort(key), mods[key]]);
    if (dmg.flat) damage.push([t('Enchantment'), dmg.flat]);
    const otherWeapon = worn.meleeOff && worn.meleeOff.s === 'melee';
    if (slot === 'meleeMain' && it.w !== 'two' && !twoHands && !otherWeapon && hasStyle(b, /duell?ing/)) damage.push(['Duelling', 2]);
    sentencesOf(it).forEach((s) => {
      const m = new RegExp('additional damage equal to your (' + ABILITY_WORDS + ') modifier', 'i').exec(s);
      if (m && !CONDITIONAL.test(s)) damage.push([abilityShort(abilityKey(m[1])) + ' · ' + it.n, mods[abilityKey(m[1])]]);
    });
    rows.push({ slot, name: it.n, item: it, proficient, twoHands: !!twoHands, attack, attackTotal: attack.reduce((a, p) => a + p[1], 0),
      dice: dmg.dice, type, damage, damageTotal: damage.reduce((a, p) => a + p[1], 0) });
    // thrown, for builds that throw: Strength on the attack roll, the weapon's melee damage, and Tavern Brawler
    // adding Strength once more to both (the wiki's Attacks and Throw pages)
    if (brawler && it.s === 'melee' && (it.pp || []).includes('Thrown')) {
      const dkey = (it.pp || []).includes('Finesse') && mods.dex > mods.str ? 'dex' : 'str';
      const base = parseDamage(it.d) || dmg;
      const tAttack = [['STR', mods.str]].concat(proficient ? [[t('Proficiency'), pb]] : [], enchant ? [[t('Enchantment'), enchant]] : [], [['Tavern Brawler', mods.str]], gearAttack.parts);
      const tDamage = [[abilityShort(dkey), mods[dkey]]].concat(base.flat ? [[t('Enchantment'), base.flat]] : [], [['Tavern Brawler', mods.str]]);
      rows.push({ slot, thrown: true, name: it.n + ' · ' + t('thrown'), item: it, proficient, attack: tAttack, attackTotal: tAttack.reduce((a, p) => a + p[1], 0),
        dice: base.dice, type: base.type || type, damage: tDamage, damageTotal: tDamage.reduce((a, p) => a + p[1], 0) });
    }
  });
  // unarmed strike, for monks and Tavern Brawler builds
  if (monk || brawler) {
    const key = monk && mods.dex > mods.str ? 'dex' : 'str';
    const attack = [[abilityShort(key), mods[key]], [t('Proficiency'), pb]];
    const damage = [[abilityShort(key), mods[key]]];
    if (brawler) { attack.push(['Tavern Brawler', mods.str]); damage.push(['Tavern Brawler', mods.str]); }
    const die = martial;
    rows.push({ slot: 'unarmed', name: t('Unarmed strike'), proficient: true, attack, attackTotal: attack.reduce((a, p) => a + p[1], 0),
      dice: die || '1', type: 'Bludgeoning', damage, damageTotal: damage.reduce((a, p) => a + p[1], 0) });
  }
  return { rows, extras: [], situational: gearAttack.situational };
}

// ---------- a turn of attacks ----------
// The lowest natural roll that is a critical hit: 20, less one for each effect that says "the number you need
// to roll a Critical Hit is reduced by 1" without tying it to a situation or to spells (these stack).
function critThreshold(b, worn, gains) {
  const texts = [...new Set(gains)].map(featureText);
  allPicks(b).forEach((p) => { const m = /^feat\s*:\s*([^(+]+)/i.exec(p.trim()); const feat = m && FEATS.find(([n]) => norm(n) === norm(m[1])); if (feat) texts.push(feat[1]); });
  Object.values(worn).forEach((it) => texts.push(...effectTexts(it)));
  const elixir = CONSUMABLE_BY_NAME.get(norm(b.elixir));
  if (elixir) texts.push(elixir.x);
  let n = 20;
  texts.forEach((text) => String(text || '').split(/;|\.(?=\s|$)/).forEach((s) => {
    const m = /(?:number you need to roll (?:to land )?a Critical Hit(?: while attacking)? is reduced by|reduce the number you need to roll (?:to land )?a Critical Hit(?: while attacking)? by) (\d)/i.exec(s);
    if (m && !/\b(?:when|if|against|until|spell|obscured|after)\b/i.test(s.replace(/while attacking/i, ''))) n -= Number(m[1]);
  }));
  return Math.max(2, n);
}
// Gear that gives Advantage on every attack roll, whatever the situation (the Risky Ring).
const gearAdvantage = (worn) => Object.values(worn).some((it) => sentencesOf(it).some((s) =>
  /^(?:you |the wearer )?(?:gains?|ha(?:ve|s)) advantage on (?:all )?attack rolls\b/i.test(s) && !/\b(?:against|when|while|if|until|after)\b/i.test(s)));
// The chance of an attack with this bonus to hit that Armour Class, and to crit: a natural 1 always misses,
// a roll at or above the critical threshold always hits. With Advantage, the better of two rolls counts.
function hitChance(bonus, ac, crit, advantage) {
  let hits = 0;
  for (let roll = 2; roll < crit; roll++) if (roll + bonus >= ac) hits++;
  const pc = (21 - crit) / 20;
  const any = (hits + 21 - crit) / 20;
  return advantage ? { hit: 1 - (1 - any) ** 2, crit: 1 - (1 - pc) ** 2 } : { hit: any, crit: pc };
}
// What a turn of attacks is worth on average against an Armour Class: the Attack action (with Extra Attack)
// with the main attack, plus the bonus action — the off-hand weapon, or a monk's Flurry of Blows.
// A critical hit rolls every damage die twice.
function turnPlan(stats, style, ac) {
  const main = mainAttack(stats, style);
  if (!main) return null;
  const gains = stats.gains;
  const extra = gains.includes('Improved Extra Attack') ? 3
    : gains.includes('Extra Attack') || (gains.includes('Deepened Pact') && stats.pactBlade && main.slot === 'meleeMain') ? 2 : 1;
  const one = (row) => {
    const bonus = row.attackTotal + (row.attackDice || []).reduce((a, d) => a + avgDice(d), 0);
    const p = hitChance(bonus, ac, stats.crit, stats.advantage);
    const dice = avgDice(row.dice) + (row.extraDice || []).reduce((a, d) => a + avgDice(d[0]), 0);
    return { p, each: p.hit * (dice + row.damageTotal) + p.crit * dice };
  };
  const parts = [Object.assign({ row: main, n: extra, how: t('Attack action') }, one(main))];
  const off = stats.attacks.rows.find((r) => !r.thrown && r.slot === (main.slot === 'rangedMain' ? 'rangedOff' : main.slot === 'meleeMain' ? 'meleeOff' : ''));
  if (main.slot === 'unarmed' && stats.monk) parts.push(Object.assign({ row: main, n: 2, how: 'Flurry of Blows' }, one(main)));
  else if (off && !main.thrown) parts.push(Object.assign({ row: off, n: 1, how: t('bonus action') }, one(off)));
  return { ac, parts, total: parts.reduce((a, x) => a + x.n * x.each, 0) };
}

// ---------- spellcasting ----------
// The value of a column of the class table at a class level ("Ki Points" of a Monk 6).
function classColumn(cls, n, re) {
  const d = CLASS_DATA[cls] || {};
  const i = (d.cols || []).findIndex((c) => re.test(c));
  return i < 0 ? '' : ((d.table || {})[n] || [])[i] || '';
}
// Spellcasting ability per class and per casting subclass (the wiki's Spells page), and how much each class
// level counts towards spell slots: full casters 1, half casters 1/2, one-third casters 1/3. Warlocks have Pact Magic.
const CAST_ABILITY = { Bard: 'cha', Cleric: 'wis', Druid: 'wis', Sorcerer: 'cha', Warlock: 'cha', Wizard: 'int', Paladin: 'cha', Ranger: 'wis' };
const CAST_SUBCLASS = { 'Eldritch Knight': 'int', 'Arcane Trickster': 'int', 'Way of the Four Elements': 'wis' };
const PREPARES = ['Cleric', 'Druid', 'Paladin', 'Wizard'];
function casters(b) {
  const levels = classLevels(b);
  const subs = {};
  levelInfo(b).forEach((x) => { if (x.sub) subs[x.cls] = x.sub; });
  const out = [];
  Object.keys(levels).forEach((cls) => {
    const n = levels[cls];
    const sub = subs[cls] || '';
    if (['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard'].includes(cls)) out.push({ cls, n, ab: CAST_ABILITY[cls], frac: 1, own: true });
    else if (cls === 'Warlock') out.push({ cls, n, ab: 'cha', frac: 0, pact: true });
    else if ((cls === 'Paladin' || cls === 'Ranger') && n >= 2) out.push({ cls, n, ab: CAST_ABILITY[cls], frac: 1 / 2, own: true });
    else if (CAST_SUBCLASS[sub] && n >= 3) out.push({ cls, n, sub: subLabel(sub), ab: CAST_SUBCLASS[sub], frac: sub === 'Way of the Four Elements' ? 0 : 1 / 3 });
  });
  return out;
}
const ESL_SLOTS = (CLASS_DATA.Wizard || {}).slots || {};
// Spell slots per spell level. One spellcasting class uses its own table; several add up to an effective
// spellcaster level (rounded down) that reads the shared table. Warlock levels never count: see pactSlots.
function spellSlots(b) {
  const list = casters(b).filter((c) => c.frac);
  if (!list.length) return [];
  let row;
  if (list.length === 1) {
    const c = list[0];
    row = c.own ? (CLASS_DATA[c.cls].slots || {})[c.n] : ESL_SLOTS[Math.ceil(c.n / 3)];
  } else row = ESL_SLOTS[Math.floor(list.reduce((a, c) => a + c.n * c.frac, 0) + 1e-9)];
  row = (row || []).slice();
  while (row.length && !row[row.length - 1]) row.pop();
  return row;
}
// Pact Magic: { n, level } - all slots are of the highest level the warlock can cast.
function pactSlots(b) {
  const n = classLevels(b).Warlock;
  const row = n ? (CLASS_DATA.Warlock.slots || {})[n] || [] : [];
  const i = row.findIndex((x) => x > 0);
  return i < 0 ? null : { n: row[i], level: i + 1 };
}
// The highest spell level the class of a build level can learn at that point, or 0 when the planner cannot tell.
function maxSpellLevel(b, i) {
  const x = levelInfo(b)[i];
  if (!x || !x.cls) return 0;
  const d = CLASS_DATA[x.cls] || {};
  const top = (row) => { let n = 0; (row || []).forEach((v, k) => { if (v > 0) n = k + 1; }); return n; };
  if (d.slots && Object.keys(d.slots).length) return top(d.slots[x.n]);
  if (CAST_SUBCLASS[x.sub] && x.sub !== 'Way of the Four Elements') return x.n >= 3 ? top(ESL_SLOTS[Math.ceil(x.n / 3)]) : 0;
  return 0;
}
// Numbers that grow with class level: the columns of each class table (except spells and cantrips known)
// and counters a subclass states as "Name: N", keeping the latest value.
function classResources(b) {
  const out = [];
  const levels = classLevels(b);
  Object.keys(levels).forEach((cls) => {
    const d = CLASS_DATA[cls] || {};
    (d.cols || []).forEach((col, i) => {
      const v = ((d.table || {})[levels[cls]] || [])[i];
      if (v && !/cantrips|spells (known|learned)/i.test(col)) out.push([col, v]);
    });
  });
  const counters = {};
  allGains(b).forEach((g) => { const m = /^(.+): (\d+)$/.exec(g); if (m) counters[m[1]] = m[2]; });
  Object.keys(counters).forEach((k) => out.push([k, counters[k]]));
  return out;
}
// Spells and cantrips written in the levels: [{ name, cantrip, level (row), cls, replaces }].
// "Spell: Misty Step (replaces Sleep)" learns one and gives up another, as the game allows at a level up.
function spellPicks(b) {
  const info = levelInfo(b);
  const out = [];
  b.levels.forEach((l, i) => l.picks.forEach((p) => {
    const m = /^(spell|cantrip)s?\s*:\s*([^(]+?)\s*(?:\((.*)\))?\s*$/i.exec(p.trim());
    if (!m) return;
    const rep = /replaces\s+(.+)/i.exec(m[3] || '');
    out.push({ name: m[2].trim(), cantrip: /^cantrip/i.test(m[1]), level: i, cls: info[i].cls, replaces: rep ? rep[1].trim() : '' });
  }));
  return out;
}
// The spells the build knows in the end: what was learned, minus what was swapped out later, plus the cantrips
// and spells that come with the race, a subclass choice or a feat.
function currentSpells(b) {
  const out = [];
  spellPicks(b).forEach((p) => {
    if (p.replaces) { const i = out.findIndex((x) => norm(x.name) === norm(p.replaces) && x.cls === p.cls); if (i >= 0) out.splice(i, 1); }
    out.push({ name: p.name, cantrip: p.cantrip, cls: p.cls, level: p.level });
  });
  const extra = (name, source) => { const s = SPELL_BY_NAME.get(norm(name)); if (s && !out.some((x) => norm(x.name) === norm(name))) out.push({ name: s.n, cantrip: !s.lv, cls: '', source }); };
  if (b.creation.cantrip) extra(b.creation.cantrip, b.creation.subrace || b.creation.race);
  allPicks(b).forEach((p) => {
    const m = /^(bonus cantrip|feat)\s*:\s*(.+)$/i.exec(p.trim());
    if (m) m[2].split(/[(),;]/).forEach((x) => extra(x.trim(), /^feat/i.test(m[1]) ? 'Feat' : 'Bonus Cantrip'));
  });
  return out;
}
// What a build level teaches its class: { cantrips, spells, any, list (whose spell list), schools, replace }.
// Classes read their table ("Spells Known" grows by one); Eldritch Knights and Arcane Tricksters borrow the
// Wizard list, limited to two schools except for the picks marked as free.
function spellsAtLevel(info) {
  if (!info || !info.cls) return null;
  const borrowed = SPELL_PICKS[info.sub];
  if (borrowed) {
    const at = borrowed.at[info.n] || {};
    return { cantrips: at.cantrips || 0, spells: (at.school || 0) + (at.any || 0), any: at.any || 0, list: borrowed.list, schools: borrowed.schools, replace: info.n > 3 };
  }
  const grow = (re) => (Number(classColumn(info.cls, info.n, re)) || 0) - (info.n > 1 ? Number(classColumn(info.cls, info.n - 1, re)) || 0 : 0);
  const swaps = (CLASS_DATA[info.cls].cols || []).some((c) => /spells known/i.test(c));
  return { cantrips: grow(/cantrips known/i), spells: grow(/spells (known|learned)/i), any: 0, list: info.cls, schools: null,
    replace: swaps && info.n > 1 && (Number(classColumn(info.cls, info.n - 1, /spells known/i)) || 0) > 0 };
}
// How many cantrips and spells each class lets the build know, next to how many it has chosen in that class's levels.
// For the borrowed lists it also counts the spells outside the subclass's schools against the free picks.
function knownSpells(b) {
  const levels = classLevels(b);
  const info = levelInfo(b);
  const current = currentSpells(b);
  return Object.keys(levels).map((cls) => {
    const sub = (info.find((x) => x.cls === cls && x.sub) || {}).sub;
    const borrowed = SPELL_PICKS[sub];
    const mine = current.filter((x) => x.cls === cls);
    const sum = (k) => Object.keys(borrowed.at).reduce((a, lv) => a + (Number(lv) <= levels[cls] ? borrowed.at[lv][k] || 0 : 0), 0);
    const out = { cls, label: borrowed ? subLabel(sub) : cls, cantrips: mine.filter((x) => x.cantrip).length, spells: mine.filter((x) => !x.cantrip).length,
      maxCantrips: borrowed ? sum('cantrips') : Number(classColumn(cls, levels[cls], /cantrips known/i)) || 0,
      maxSpells: borrowed ? sum('school') + sum('any') : Number(classColumn(cls, levels[cls], /spells (known|learned)/i)) || 0 };
    if (borrowed) {
      out.schools = borrowed.schools;
      out.maxAny = sum('any');
      out.offSchool = mine.filter((x) => !x.cantrip && SPELL_BY_NAME.get(norm(x.name)) && !borrowed.schools.includes(SPELL_BY_NAME.get(norm(x.name)).sc)).length;
    }
    return out;
  }).filter((x) => x.maxCantrips || x.maxSpells);
}

// ---------- everything together ----------
// The build as it stands at an earlier level: the rows after it are blank.
const atLevel = (b, level) => Object.assign({}, b, { levels: b.levels.map((l, i) => (i < level ? l : { cls: '', sub: '', picks: [] })) });
// Everything the "Final numbers" card and the PDF sheet show, with the gear of one act.
// opts.level looks at the build at that level instead of the last one; opts.swap replaces gear slots.
function finalStats(b, act, opts) {
  act = act || 'act3';
  const swap = (opts && opts.swap) || null;
  if (opts && opts.level && opts.level < 12) b = atLevel(b, opts.level);
  const level = charLevel(b);
  const ab = abilityScores(b, act, swap);
  const { scores, mods, feats } = ab;
  const pb = profBonus(level);
  const worn = wornItems(b, act, swap);
  const gains = level ? allGains(b) : [];
  const st = skillState(b);
  const expert = expertiseSkills(b);
  const picked = pickedSkills(b);
  // half the proficiency bonus, rounded down, on checks without proficiency: every skill for a Bard's
  // Jack of All Trades, the physical ones for a Champion's Remarkable Athlete
  const jack = gains.includes('Jack of All Trades') ? Math.floor(pb / 2) : 0;
  const athlete = gains.some((g) => /^Remarkable Athlete: Proficiency/.test(g)) ? Math.floor(pb / 2) : 0;
  const physical = ['Athletics', 'Acrobatics', 'Sleight of Hand', 'Stealth'];
  const skills = ALL_SKILLS.map((x) => {
    const proficient = !!st.granted[x] || st.chosen.includes(x) || expert.has(x) || picked.has(x);
    const half = Math.max(jack, physical.includes(x) ? athlete : 0);
    const bonus = mods[skillAbility(x)] + (proficient ? pb : half) + (expert.has(x) ? pb : 0) + namedBonus(worn, x);
    return { name: x, ability: skillAbility(x), proficient, expert: expert.has(x), bonus };
  });
  // saving throws: proficiency comes from the first class only, and from the Resilient feat
  const first = DATA.classes[startingClass(b)];
  const allSaves = gearBonus(worn, 'saves');
  const permSaves = permanentBonuses(b, act).saves.reduce((a, p) => a + p[1], 0);
  const saves = ABILS.map(([key, short, name]) => {
    const proficient = (!!first && first.saves.includes(name)) || hasPick(b, new RegExp('resilient.*' + short, 'i'));
    return { key, short, proficient, bonus: mods[key] + (proficient ? pb : 0) + allSaves.n + permSaves + namedBonus(worn, name + ' Saving Throws') };
  });
  // initiative: Dexterity, Alert, features that say "+N to Initiative", and gear
  const initiative = [['DEX', mods.dex]];
  if (hasPick(b, /^feat\b.*\balert\b/i)) initiative.push(['Alert', 5]);
  [...new Set(gains)].forEach((g) => { const m = /\+(\d) (?:bonus )?to Initiative/i.exec(featureText(g)); if (m) initiative.push([g, Number(m[1])]); });
  gearBonus(worn, 'initiative').parts.forEach((p) => initiative.push(p));
  const dc = gearBonus(worn, 'spellDc');
  const sa = gearBonus(worn, 'spellAttack');
  const levels = classLevels(b);
  const casting = casters(b).map((c) => ({
    label: c.sub || c.cls, ability: c.ab, dc: 8 + pb + mods[c.ab] + dc.n, attack: pb + mods[c.ab] + sa.n,
    prepared: PREPARES.includes(c.cls) ? Math.max(1, mods[c.ab] + levels[c.cls]) : 0,
  }));
  const acInfo = Object.fromEntries(ACTS.map(([k]) => [k, armourClassInfo(b, k, k === act && !swap ? mods : null, k === act ? swap : null)]));
  const attacks = level ? attackRows(b, act, ab, pb, swap) : { rows: [], extras: [], situational: [] };
  // what is switched on, and what a feature's text always gives, on top of everything above
  const savesDice = [];
  const on = b.active || [];
  (level ? activeEffects(b, act, mods) : []).forEach((x) => {
    const fx = x.fx;
    if (fx.ac) { acInfo[act].parts.push([x.label, fx.ac]); acInfo[act].total += fx.ac; }
    if (fx.saves) saves.forEach((k) => { k.bonus += fx.saves; });
    if (fx.savesDice) savesDice.push(fx.savesDice);
    if (fx.initiative) initiative.push([x.label, fx.initiative]);
    if (fx.dc) casting.forEach((c) => { c.dc += fx.dc; });
    if (fx.spellAttack) casting.forEach((c) => { c.attack += fx.spellAttack; });
    attacks.rows.forEach((r) => {
      if (!effectHits(x.scope, r)) return;
      if (fx.attack) { r.attack.push([x.label, fx.attack]); r.attackTotal += fx.attack; }
      if (fx.attackDice) (r.attackDice = r.attackDice || []).push(fx.attackDice);
      if (fx.damage) { r.damage.push([x.label, fx.damage]); r.damageTotal += fx.damage; }
      if (fx.damageDice) (r.extraDice = r.extraDice || []).push([fx.damageDice, fx.damageType || '', x.label]);
    });
  });
  return {
    act, level, feats, scores, mods, sources: ab.sources, pb, skills, saves, savesDice,
    gains, crit: level ? critThreshold(b, worn, gains) : 20, advantage: on.includes('adv') || gearAdvantage(worn),
    monk: !!classLevels(b).Monk, pactBlade: hasPick(b, /pact of the blade/i) || levelInfo(b).some((x) => x.sub === 'The Hexblade'),
    hp: hitPoints(b, mods.con),
    initiative: initiative.reduce((a, p) => a + p[1], 0), initiativeParts: initiative,
    ac: Object.fromEntries(ACTS.map(([k]) => [k, acInfo[k].total])), acInfo,
    attacks,
    casting, castingGear: [...dc.parts, ...sa.parts.filter((p) => !dc.parts.some((q) => q[0] === p[0] && q[1] === p[1]))], castingSituational: [...dc.situational, ...sa.situational],
    slots: spellSlots(b), pact: pactSlots(b), resources: classResources(b), known: knownSpells(b),
  };
}

const partsText = (parts) => parts.map(([n, v]) => esc((v < 0 ? '−' + Math.abs(v) : v) + ' ' + n)).join(' + ');
// What the level after the current one brings, in one line.
function nextLevelText(b) {
  const i = b.current;
  const x = levelInfo(b)[i];
  if (!b.current || !x || !x.cls) return '';
  const bits = [...levelGains(x), ...levelNumbers(x)];
  if (picksSubclass(x)) bits.unshift(t('subclass'));
  if (grantsFeat(x)) bits.push(t('feat'));
  levelChoices(x).forEach((c) => { if (!bits.some((g) => norm(g).startsWith(norm(c.group.name)))) bits.push(c.group.name + (c.n > 1 ? ' ×' + c.n : '')); });
  return `<p class="next-lvl"><b>${t('Next: level {n} · {cls} {k}', { n: i + 1, cls: x.cls, k: x.n })}</b> ${bits.length ? esc(bits.join(' · ')) : t('nothing new besides hit points')}</p>`;
}
function statsLive(b) {
  const total = charLevel(b);
  const at = b.current && b.current < total ? b.current : 0;
  const s = finalStats(b, state.ui.act, at ? { level: at } : null);
  if (!s.level) return `<p class="muted">${t('Set at least the class of level 1 to see the final numbers.')}</p>`;
  // AC shows how it adds up; spells and situational bonuses are named but not counted
  const acBox = (label, info) => `<div class="stat ac"><span>${label}</span><b>${info.total}</b>
    <small>${partsText(info.parts)}</small>
    ${info.mage ? `<small class="extra">${t('{n} with Mage Armour', { n: info.mage })}</small>` : ''}
    ${info.situational.map((x) => `<small class="extra">${esc(x)}</small>`).join('')}</div>`;
  const box = (label, value, hint) => `<div class="stat"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const ac = Number(state.ui.targetAc) || 16;
  const turn = turnPlan(s, buildProfile(at ? atLevel(b, at) : b, state.ui.act).style, ac);
  const chance = (r) => { const p = hitChance(r.attackTotal + (r.attackDice || []).reduce((a, d) => a + avgDice(d), 0), ac, s.crit, s.advantage); return t('{hit}% to hit AC {ac} · {crit}% critical', { hit: Math.round(p.hit * 100), ac, crit: Math.round(p.crit * 100) }); };
  const attacks = s.attacks.rows.map((r) => `<div class="atk">
      <div class="atk-name">${r.item ? pic(r.item.i, 'pic small') : ''}<b>${esc(r.name)}</b><small>${r.slot === 'unarmed' ? '' : t(SLOT_LABEL[r.slot])}${r.proficient ? '' : ` · <em>${t('not proficient')}</em>`}</small></div>
      <div class="atk-num"><span>${t('Attack')}</span><b>${signed(r.attackTotal)}${(r.attackDice || []).map((d) => ' + ' + esc(d)).join('')}</b><small>${partsText(r.attack)}<br>${chance(r)}</small></div>
      <div class="atk-num"><span>${t('Damage')}</span><b>${esc(damageText(r))}</b><small>${esc(r.type)}${r.damage.length ? ' · ' + partsText(r.damage) : ''}${
        (r.extraDice || []).map((d) => ' · ' + esc(d[0] + (d[1] ? ' ' + d[1] : '') + ' ' + d[2])).join('')}</small></div>
    </div>`).join('');
  const casting = s.casting.map((c) => `<div class="atk">
      <div class="atk-name"><b>${esc(c.label)}</b><small>${abilityShort(c.ability)} ${signed(s.mods[c.ability])}</small></div>
      <div class="atk-num"><span>${t('Spell save DC')}</span><b>${c.dc}</b></div>
      <div class="atk-num"><span>${t('Spell attack')}</span><b>${signed(c.attack)}</b>${c.prepared ? `<small>${t('{n} prepared spells', { n: c.prepared })}</small>` : ''}</div>
    </div>`).join('');
  const slots = s.slots.length ? `<p class="points"><b>${t('Spell slots')}</b> ${s.slots.map((n, i) => `<span class="slot-n" title="${t('Level {n}', { n: i + 1 })}">${i + 1}<i>×${n}</i></span>`).join('')}</p>` : '';
  const pact = s.pact ? `<p class="points"><b>${t('Pact Magic slots')}</b> ${t('{n} of level {lv}, back on a Short Rest', { n: s.pact.n, lv: s.pact.level })}</p>` : '';
  const known = s.known.map((k) => `${esc(k.label)}: ${[k.maxCantrips ? t('{n} of {max} cantrips', { n: k.cantrips, max: k.maxCantrips }) : '', k.maxSpells ? t('{n} of {max} spells', { n: k.spells, max: k.maxSpells }) : ''].filter(Boolean).join(', ')}`).join(' · ');
  return `${nextLevelText(b)}<div class="stat-row">
      ${box(t('Level'), s.level, at ? esc(splitText(atLevel(b, at))) : '')}${box(t('Proficiency bonus'), signed(s.pb))}${box(t('Hit points'), s.hp)}${box(t('Initiative'), signed(s.initiative), s.initiativeParts.length > 1 ? partsText(s.initiativeParts) : '')}
      ${ACTS.map(([k, l]) => acBox(t('AC · {act}', { act: t(l) }), s.acInfo[k])).join('')}
    </div>
    <div class="abils final">${ABILS.map(([ab, short]) => `<div class="abil"><div class="abil-name">${short}</div>
      <div class="abil-final"><b>${s.scores[ab]}</b><i>${signed(s.mods[ab])}</i></div>
      <small>${finalOf(b, ab)}${s.feats[ab] ? ' ' + t('+{n} feats', { n: s.feats[ab] }) : ''}${s.sources[ab].map((x) => '<br>' + esc(x)).join('')}</small></div>`).join('')}</div>
    <h3 class="group">${t('Saving throws')}</h3>
    <div class="skill-final">${s.saves.map((k) => `<span class="${k.proficient ? 'prof' : ''}" title="${k.proficient ? t('Proficient') : ''}">${k.short} <b>${signed(k.bonus)}${s.savesDice.map((d) => ' + ' + esc(d)).join('')}</b></span>`).join('')}</div>
    ${attacks ? `<h3 class="group">${t('Attacks')}</h3><div class="atks">${attacks}</div>
      ${turn ? `<p class="turn"><b>${turn.total.toFixed(1)}</b>${t('average damage in a turn against AC {ac}', { ac })}: ${turn.parts.map((x) => `${x.n} × ${esc(x.row.name)} (${esc(x.how)}, ${x.each.toFixed(1)} ${t('each')})`).join(' + ')}${
        s.advantage ? ' · ' + t('with Advantage') : ''}${s.crit < 20 ? ' · ' + t('critical hit on {n} or more', { n: s.crit }) : ''}</p>` : ''}
      ${s.attacks.extras.length ? `<p class="muted">${t('On top, when it applies: {list}', { list: esc(s.attacks.extras.join(' · ')) })}</p>` : ''}
      ${s.attacks.situational.map((x) => `<p class="muted">${esc(x)}</p>`).join('')}` : ''}
    ${casting ? `<h3 class="group">${t('Spellcasting')}</h3><div class="atks">${casting}</div>${slots}${pact}
      ${known ? `<p class="points"><b>${t('Chosen in the level table')}</b> ${known}</p>` : ''}
      ${s.castingGear.length ? `<p class="muted">${t('Gear included: {list}', { list: partsText(s.castingGear) })}</p>` : ''}
      ${s.castingSituational.map((x) => `<p class="muted">${esc(x)}</p>`).join('')}` : ''}
    ${s.resources.length ? `<h3 class="group">${t('Class resources')}</h3><div class="res">${s.resources.map(([n, v]) => `<span>${esc(n)} <b>${esc(v)}</b></span>`).join('')}</div>` : ''}
    <h3 class="group">${t('Skills')}</h3>
    <div class="skill-final">${s.skills.map((k) => `<span class="${k.proficient ? 'prof' : ''}${k.expert ? ' expert' : ''}" title="${k.expert ? t('Expertise') : k.proficient ? t('Proficient') : ''}">
      ${esc(k.name)} <b>${signed(k.bonus)}</b></span>`).join('')}</div>
    <p class="muted">${t('In gold: proficient; with a star: Expertise. Everything is for the level and the gear of the act chosen above. Armour Class, attacks and spell numbers follow the game formulas; bonuses that depend on the situation are listed, not added.')}</p>`;
}
function statsCard(b) {
  const extra = b.creation.extra || {};
  const elixirs = CONSUMABLES.filter((c) => c.t === 'Elixir');
  return `<section class="card">
    <h2>${t('Final numbers')}</h2>
    <div class="stat-tools">
      <div><span class="lbl">${t('At level')}</span><div class="acts lvls">${Array.from({ length: charLevel(b) }, (x, i) => i + 1).map((n) =>
        `<button class="${(b.current && b.current < charLevel(b) ? b.current : charLevel(b)) === n ? 'on' : ''}" data-act="stat-level" data-n="${n}">${n}</button>`).join('')}</div></div>
      <div><span class="lbl">${t('With the gear of')}</span>${actTabs(state.ui.act, 'act')}</div>
      <div class="field ac-field"><span>${t('Enemy Armour Class')}</span>${stepper(Number(state.ui.targetAc) || 16, 'data-ui="targetAc" data-v="16"', 5, 30)}</div>
      ${elixirs.length ? `<div class="field"><span>${t('Elixir kept active')}</span>${slotButton('elixir-open', '', b.elixir,
        CONSUMABLE_BY_NAME.get(norm(b.elixir)) ? pic(CONSUMABLE_BY_NAME.get(norm(b.elixir)).i, 'pic small') : '', t('— none —'))}</div>` : ''}
    </div>
    ${b.elixir && CONSUMABLE_BY_NAME.get(norm(b.elixir)) ? `<p class="muted">${esc(CONSUMABLE_BY_NAME.get(norm(b.elixir)).x)}</p>` : ''}
    ${togglesRow(b)}
    <div id="stats-live">${statsLive(b)}</div>
    <h3 class="group">${t('Other ability bonuses')}</h3>
    <p class="muted">${t('Only for what the planner does not read by itself. Gear in the slots and the elixir above are already counted.')}</p>
    <div class="extra-row">${ABILS.map(([ab, short]) => `<span>${short} ${stepper(Number(extra[ab]) || 0, `data-path="creation.extra.${ab}"`, -10, 20)}</span>`).join('')}</div>
  </section>`;
}

// ---------- party ----------
// A member's numbers in the Party Planner: with the gear of the act on screen, at the level the build is marked at.
const memberStats = (b) => finalStats(b, state.ui.partyAct, b.current ? { level: b.current } : null);
// The attack the build leans on: the unarmed strike, a thrown weapon, the ranged main hand or the melee main hand.
function mainAttack(s, style) {
  const rows = s.attacks.rows;
  const want = style === 'unarmed' ? (r) => r.slot === 'unarmed' : style === 'thrown' ? (r) => r.thrown : style === 'ranged' ? (r) => r.slot === 'rangedMain' : (r) => r.slot === 'meleeMain' && !r.thrown;
  return rows.find(want) || rows.find((r) => r.slot === 'meleeMain' && !r.thrown) || rows[0] || null;
}
const avgDamage = (r) => (r ? avgDice(r.dice) + r.damageTotal + (r.extraDice || []).reduce((a, d) => a + avgDice(d[0]), 0) : 0);
// "1d8 + 1d6 + 4": the weapon die, the dice switched on, and the flat part.
const damageText = (r) => [r.dice, ...(r.extraDice || []).map((d) => d[0])].filter(Boolean).join(' + ') + (r.damageTotal ? ' ' + (r.damageTotal > 0 ? '+ ' : '− ') + Math.abs(r.damageTotal) : '');
// Level, hit points, armour class, initiative, main attack and spell save DC of every member, side by side.
function partyNumbers(members) {
  const active = members.filter((m) => m.build && charLevel(m.build));
  if (!active.length) return '';
  const stats = active.map((m) => memberStats(m.build));
  const act = state.ui.partyAct;
  const attacks = active.map((m, i) => mainAttack(stats[i], buildProfile(m.build, act).style));
  const rows = [
    [t('Level'), stats.map((s) => s.level), false],
    [t('Hit points'), stats.map((s) => s.hp), true],
    [t('Armour Class'), stats.map((s) => s.ac[act]), true],
    [t('Initiative'), stats.map((s) => s.initiative), true, signed],
    [t('Main attack'), attacks.map((r) => (r ? r.attackTotal : null)), true, signed, attacks.map((r) => (r ? r.name : ''))],
    [t('Damage per hit'), attacks.map((r) => (r ? avgDamage(r) : null)), true, (v) => v.toFixed(1), attacks.map((r) => (r ? damageText(r) : ''))],
    [t('Spell save DC'), stats.map((s) => (s.casting.length ? Math.max(...s.casting.map((c) => c.dc)) : null)), true],
    ...ABILS.map(([key, short]) => [t('{ab} save', { ab: short }), stats.map((s) => s.saves.find((k) => k.key === key).bonus), true, signed]),
  ];
  return `<section class="card">
    <h2>${t('Party numbers')}</h2>
    <p class="muted">${t('Each member at the level marked in their build (the last one when none is marked), with the gear of this act. The best of each row is highlighted.')}</p>
    <div class="table-wrap"><table class="ptable skills"><thead><tr><th></th>${active.map((m) => `<th data-ml="${m.i}">${esc(memberLabel(m))}</th>`).join('')}</tr></thead><tbody>${
      rows.map(([label, vals, best, fmt, notes]) => {
        const top = best ? Math.max(...vals.filter((v) => v != null)) : null;
        return `<tr><th>${label}</th>${vals.map((v, i) => `<td class="${v != null && v === top ? 'best' : ''}">${v == null ? '—' : (fmt ? fmt(v) : v)}${notes && notes[i] ? `<small>${esc(notes[i])}</small>` : ''}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div>
  </section>`;
}
// For each skill, every member's bonus, with the best one highlighted.
function partySkills(members) {
  const active = members.filter((m) => m.build);
  if (!active.length) return '';
  const stats = active.map((m) => memberStats(m.build));
  const rows = ALL_SKILLS.map((x, i) => {
    const vals = stats.map((s) => s.skills[i]);
    const best = Math.max(...vals.map((v) => v.bonus));
    return `<tr><th>${esc(x)} <small>${skillAbility(x).toUpperCase()}</small></th>${vals.map((v) =>
      `<td class="${v.bonus === best ? 'best' : ''}${v.proficient ? ' prof' : ''}">${signed(v.bonus)}${v.expert ? ' ★' : ''}</td>`).join('')}</tr>`;
  }).join('');
  const uncovered = ALL_SKILLS.filter((x, i) => !stats.some((s) => s.skills[i].proficient));
  return `<section class="card">
    <h2>${t('Skill coverage')}</h2>
    <p class="muted">${t('Bonus of each member at their final level. The best in the party is highlighted; gold means proficient.')}</p>
    <div class="table-wrap"><table class="ptable skills"><thead><tr><th>${t('Skill')}</th>${active.map((m) => `<th data-ml="${m.i}">${esc(memberLabel(m))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    ${uncovered.length ? `<p class="points"><b class="warn">${t('Nobody is proficient in: {list}', { list: uncovered.join(', ') })}</b></p>` : `<p class="okline">${t('Every skill has at least one proficient member.')}</p>`}
  </section>`;
}

// Everything still to collect, across the three acts, grouped by act and place.
function partyRoute(members) {
  const active = members.filter((m) => m.build);
  const acts = ACTS.map(([act, label]) => {
    const groups = {};
    active.forEach((m) => SLOTS.forEach(([k, slotLabel]) => {
      const s = m.build.gear[act].slots[k];
      // an item kept from an earlier act is collected only once
      if (!s.name.trim() || s.got || ACTS.slice(0, ACTS.findIndex(([a]) => a === act)).some(([a]) => norm(m.build.gear[a].slots[k].name) === norm(s.name))) return;
      const parts = s.where.split(/\s+[—–]\s+/);
      const loc = parts[0].trim() || t('Location not set');
      (groups[loc] = groups[loc] || []).push(`<li><b class="r-${esc(s.rarity)}">${esc(s.name)}</b> <small><i data-ml="${m.i}">${esc(memberLabel(m))}</i> · ${t(slotLabel)}${parts[1] ? ' · ' + esc(parts.slice(1).join(' — ')) : ''}</small></li>`);
    }));
    const actNum = ACTS.findIndex(([a]) => a === act) + 1;
    active.forEach((m) => PERMANENT.filter((p) => p.a === actNum && (m.build.permanent || {})[p.n] && !m.build.permanent[p.n].got).forEach((p) => {
      const loc = t('Permanent bonuses');
      (groups[loc] = groups[loc] || []).push(`<li><b>${esc(p.n)}</b> <small><i data-ml="${m.i}">${esc(memberLabel(m))}</i> · ${esc(p.h)}</small></li>`);
    }));
    const locs = Object.keys(groups).sort((a, c) => a.localeCompare(c));
    return locs.length ? `<div class="route-act"><h3>${t(label)}</h3>${locs.map((loc) => `<div class="loc"><h4>${esc(loc)}</h4><ul>${groups[loc].join('')}</ul></div>`).join('')}</div>` : '';
  }).join('');
  if (!active.length) return '';
  return `<section class="card">
    <h2>${t('Collection route')}</h2>
    <p class="muted">${t('What is still to be picked up, in play order. Items already marked as obtained, or carried over from an earlier act, are left out.')}</p>
    ${acts ? `<div class="route">${acts}</div>` : `<p class="okline">${t('Nothing left to collect.')}</p>`}
  </section>`;
}
