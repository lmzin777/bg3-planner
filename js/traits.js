// What the character has besides numbers (speed, senses, resistances, advantages, immunities, racial spells),
// gathered from the text of everything the build owns; and the situational bonuses that can be switched on
// to see the numbers with them (Rage, Sneak Attack, Bless, Hunter's Mark, a ring that works only in shadow…).
'use strict';

const DAMAGE_WORDS = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
const splitSentences = (text) => String(text || '').split(/;|\.(?=\s|$)/).map((x) => x.trim()).filter(Boolean);
// Features that are used (an action, a bonus action, a reaction): what they give is there only while they last.
const ACTION_FEATURES = new Set(window.BG3_ACTIONS || []);
// "Advantage against being Charmed" is no condition; "while raging" is.
const SITUATION = /\b(while|when|whenever|after|until|if|as long as|once per)\b/i;

// Every text the build owns at a level and with the gear of an act: [[source, text, kind]].
function ownedTexts(b, act) {
  const c = b.creation;
  const out = [];
  [[c.race, DATA.races[c.race]], [c.subrace, DATA.subraces[c.subrace]]].forEach(([name, d]) => (d && d.features || []).forEach(([n, text]) => out.push([name + ' · ' + n, n + ': ' + text, 'race'])));
  [...new Set(allGains(b))].forEach((g) => { const text = featureText(g); if (text && !SPELL_BY_NAME.has(norm(g))) out.push([g, text, 'feature']); });
  chosenOptions(b).forEach(([name, text]) => { if (text) out.push([name, text, 'choice']); });
  allPicks(b).forEach((p) => {
    const m = /^feat\s*:\s*([^(+]+)/i.exec(p.trim());
    const feat = m && FEATS.find(([name]) => norm(name) === norm(m[1]));
    if (feat) out.push([feat[0], feat[1], 'feat']);
  });
  Object.values(wornItems(b, act)).forEach((it) => liveSentences(it, b).forEach((text) => out.push([it.n, text, 'item'])));
  const actNum = ACTS.findIndex(([k]) => k === act) + 1;
  PERMANENT.forEach((p) => { if ((b.permanent || {})[p.n] && p.a <= actNum) out.push([p.n, p.x, 'permanent']); });
  return out;
}

// Speed, senses, resistances, advantages, immunities and racial spells of the build.
// Each entry is [what, source, conditional]; conditional ones depend on a situation the text describes.
function traitsOf(b, act) {
  const out = { speed: [], senses: [], resist: [], advantage: [], immune: [], spells: [] };
  const c = b.creation;
  const level = charLevel(b);
  const push = (list, what, source, cond) => { if (!list.some((x) => norm(x[0]) === norm(what) && x[1] === source)) list.push([what, source, !!cond]); };
  // base speed: the subrace's when it has one, else the race's
  const base = (DATA.subraces[c.subrace] || {}).speed || (DATA.races[c.race] || {}).speed;
  if (base) out.speed.push([base.split('/')[0].trim(), c.subrace && (DATA.subraces[c.subrace] || {}).speed ? c.subrace : c.race, false]);
  ownedTexts(b, act).forEach(([source, text, kind]) => {
    const used = kind === 'feature' && ACTION_FEATURES.has(source) && !/^Aura of/.test(source);  // an aura is always up
    splitSentences(text).forEach((s) => {
      const cond = used || SITUATION.test(s);
      let m = /movement speed (?:is )?(?:increas\w+|\+)\D{0,12}(\d+(?:\.\d+)?) ?m\b/i.exec(s);
      // the monk's own table says how much Unarmoured Movement gives at each level; Fleet of Foot is in the base speed
      if (m && !/^Fleet of Foot/.test(s) && !/Unarmoured Movement/.test(source)) push(out.speed, '+' + m[1] + ' m', source, cond);
      m = /see in the dark up to (\d+) ?m/i.exec(s);
      if (m) push(out.senses, 'Darkvision ' + m[1] + ' m', source, false);
      else if (/darkvision/i.test(s) && kind !== 'race') push(out.senses, 'Darkvision', source, cond);
      if (/resistan(?:ce|t)\b/i.test(s) && !/ignore|cannot have|reduce[sd]? (?:its|their)/i.test(s)) {
        const types = DAMAGE_WORDS.filter((d) => new RegExp('\\b' + d + '\\b').test(s));
        if (/all damage/i.test(s)) push(out.resist, 'All damage', source, cond);
        else if (/physical damage/i.test(s)) push(out.resist, 'Physical damage', source, cond);
        else types.forEach((d) => push(out.resist, d, source, cond));
      }
      m = /advantage (?:on|against|in) ([^.;]+)/i.exec(s);
      if (m && !/(?:enemies|attackers|foes|creatures) (?:also )?have advantage/i.test(s)) push(out.advantage, m[1].replace(/^being /i, '').trim(), source, cond);
      m = /immun\w* to ([^.;]+)|can(?:'t|not) be (surprised|charmed|frightened|knocked prone|poisoned|put to sleep)/i.exec(s);
      if (m && (m[1] || m[2]).trim().length > 3) push(out.immune, (m[1] || m[2]).trim(), source, cond);
    });
    // "Dancing Lights at level 1, Faerie Fire at level 3": spells a race hands out as the character levels
    if (kind === 'race') for (const m of text.matchAll(/([A-Z][A-Za-z' ]+?) at level (\d+)/g)) out.spells.push([m[1].trim(), source.split(' · ')[1], Number(m[2]) > level, Number(m[2])]);
  });
  // monks move faster without armour: the class table says by how much
  const monk = classLevels(b).Monk;
  const move = monk ? classColumn('Monk', monk, /unarmoured movement/i) : '';
  if (move) push(out.speed, move.split('/')[0].replace(/\s+/g, '').replace('m', ' m'), 'Unarmoured Movement', true);
  if (c.cantrip) out.spells.unshift([c.cantrip, t('Racial cantrip'), false, 1]);
  return out;
}
function traitsCard(b) {
  const at = b.current && b.current < charLevel(b) ? b.current : 0;
  const tr = traitsOf(at ? atLevel(b, at) : b, state.ui.act);
  const chip = ([what, source, cond]) => `<span class="trait${cond ? ' cond' : ''}" title="${esc(source)}">${esc(what)}<i>${esc(source)}</i></span>`;
  const row = (label, list) => (list.length ? `<div class="trait-row"><span class="lbl">${label}</span><div>${list.map(chip).join('')}</div></div>` : '');
  const speed = tr.speed.filter((x) => !x[2]).reduce((a, x) => a + (parseFloat(x[0].replace('+', '')) || 0), 0);
  const body = row(t('Movement speed') + (speed ? ' · ' + speed + ' m' : ''), tr.speed) + row(t('Senses'), tr.senses) + row(t('Resistances'), tr.resist)
    + row(t('Advantage on'), tr.advantage) + row(t('Immunities'), tr.immune)
    + row(t('Racial spells'), tr.spells.map(([n, source, later, lv]) => [n + (lv > 1 ? ' · ' + t('level {n}', { n: lv }) : ''), source, later]));
  return `<section class="card">
    <h2>${t('Traits')}</h2>
    ${body || `<p class="muted">${t('Choose a race and a class to see speed, senses, resistances and advantages here.')}</p>`}
    ${body ? `<p class="muted">${t('Read from the text of the race, class features, choices, feats, permanent bonuses and the gear of the act chosen in Final numbers. In italics: it depends on a situation, or it comes at a later level.')}</p>` : ''}
  </section>`;
}

// ---------- situational bonuses that can be switched on ----------
// What a text gives while it is active: { ac, attack, attackDice, damage, damageDice, saves, savesDice }.
function textEffect(text) {
  const fx = {};
  splitSentences(text).forEach((s) => {
    if (/\beach\b/i.test(s)) return;  // "each duplicate increases…": not one number
    let m = /Armour Class by (\d)|\+(\d) (?:bonus )?to (?:its |your |their )?Armour Class/i.exec(s);
    if (m) fx.ac = Number(m[1] || m[2]);
    m = /(\dd\d+) bonus to Attack Rolls/i.exec(s);
    if (m) { fx.attackDice = m[1]; if (/Attack Rolls and Saving Throws/i.test(s)) fx.savesDice = m[1]; }
    m = /\+(\d) bonus to (?:their )?(Attack Rolls|Armour Class and Saving Throws)/i.exec(s);
    if (m && /Attack/.test(m[2])) { fx.attack = Number(m[1]); if (/Attack Rolls and Damage Rolls/i.test(s)) fx.damage = Number(m[1]); }
    if (m && /Saving/.test(m[2])) fx.saves = Number(m[1]);
    m = /additional (\dd\d+)(?: ([A-Z][a-z]+))? damage/.exec(s);
    if (m) { fx.damageDice = m[1]; fx.damageType = m[2] && m[2] !== 'Weapon' ? m[2] : ''; fx.melee = /^Melee weapon attacks/i.test(s); }
  });
  return Object.keys(fx).length ? fx : null;
}
// Everything the build could switch on, with the gear of an act: [{ key, label, hint, fx, scope }].
// scope says which attacks it touches: 'melee' (and thrown and unarmed), 'ranged', 'finesse' (finesse or ranged), 'heavy'.
function availableToggles(b, act) {
  const out = [];
  const levels = classLevels(b);
  const gains = [...new Set(allGains(b))];
  const pb = profBonus(charLevel(b));
  const add = (key, label, hint, fx, scope) => { if (!out.some((x) => x.key === key)) out.push({ key, label, hint, fx, scope: scope || 'all' }); };
  if (levels.Barbarian) add('rage', 'Rage', featureText('Rage'), { damage: Number(classColumn('Barbarian', levels.Barbarian, /rage damage/i)) || 0 }, 'melee');
  if (levels.Rogue) add('sneak', 'Sneak Attack', featureText('Sneak Attack'), { damageDice: classColumn('Rogue', levels.Rogue, /sneak attack/i) }, 'finesse');
  FEATS.forEach(([name, text]) => {
    if (!/-5 penalty/.test(text) || !hasPick(b, new RegExp('^feat\\s*:\\s*' + escRe(name), 'i'))) return;
    add('feat:' + name, name, text, { attack: -5, damage: 10 }, /ranged/i.test(text.split(';').find((x) => /-5 penalty/.test(x))) ? 'ranged' : 'heavy');
  });
  if (gains.includes("Hexblade's Curse")) add("Hexblade's Curse", "Hexblade's Curse", featureText("Hexblade's Curse"), { damage: pb });
  // spells the build knows and features it has, when their text gives a bonus this planner can add
  const names = [...new Set([...currentSpells(b).map((s) => s.name), ...gains])];
  names.forEach((name) => {
    if (/^(Rage|Sneak Attack|Improved Divine Smite)$/.test(name)) return;
    const text = featureText(name);
    const fx = text && textEffect(text);
    if (fx) add('text:' + name, name, text, fx, fx.melee ? 'melee' : 'all');
  });
  // gear whose bonus depends on the situation
  Object.values(wornItems(b, act)).forEach((it) => itemBonuses(it).filter((x) => x.when === 'situational').forEach((x) => {
    const kind = { ac: 'ac', attack: 'attack', saves: 'saves', spellDc: 'dc', spellAttack: 'spellAttack', initiative: 'initiative' }[x.kind];
    add('item:' + it.n + ':' + x.kind, it.n, x.text, { [kind]: x.n });
  }));
  return out;
}
// The toggles the build has switched on, and the bonuses that are always there but come from a feature's text:
// a Paladin's Aura of Protection (Charisma to saving throws) and Improved Divine Smite (1d8 on melee hits).
function activeEffects(b, act, mods) {
  const on = b.active || [];
  const list = availableToggles(b, act).filter((x) => on.includes(x.key));
  const gains = allGains(b);
  if (gains.includes('Aura of Protection') && mods.cha > 0) list.push({ key: '', label: 'Aura of Protection', fx: { saves: mods.cha }, scope: 'all' });
  if (gains.includes('Improved Divine Smite')) list.push({ key: '', label: 'Improved Divine Smite', fx: textEffect(featureText('Improved Divine Smite')) || {}, scope: 'melee' });
  return list;
}
// Whether an effect of that scope applies to an attack row.
function effectHits(scope, row) {
  const it = row.item;
  const melee = row.slot === 'unarmed' || row.thrown || (it && it.s === 'melee');
  if (scope === 'melee') return melee;
  if (scope === 'ranged') return !!it && it.s === 'ranged' && row.proficient;
  if (scope === 'finesse') return !!it && (it.s === 'ranged' || (it.pp || []).includes('Finesse'));
  if (scope === 'heavy') return !!it && it.s === 'melee' && !row.thrown && row.proficient && (it.w === 'two' || row.twoHands);
  return true;
}
function togglesRow(b) {
  const list = availableToggles(b.current && b.current < charLevel(b) ? atLevel(b, b.current) : b, state.ui.act);
  if (!list.length) return '';
  const on = b.active || [];
  return `<div class="toggles"><span class="lbl">${t('Switch on to see the numbers with it')}</span><div>${list.map((x) =>
    `<button class="chip${on.includes(x.key) ? ' on' : ''}" data-act="toggle-active" data-k="${esc(x.key)}" title="${esc(x.hint || '')}">${esc(x.label)}</button>`).join('')}</div></div>`;
}

Object.assign(actions, {
  'toggle-active'(el) {
    const b = curBuild();
    const i = b.active.indexOf(el.dataset.k);
    if (i >= 0) b.active.splice(i, 1); else b.active.push(el.dataset.k);
  },
});
