// The numbers of the finished character: abilities with feats, proficiency bonus, hit points, initiative,
// armour class per act and skill bonuses. Also the party's skill coverage and collection route.
'use strict';

const ABILITY_KEYS = ABILS.map((a) => a[0]);
const charLevel = (b) => b.levels.filter((l) => l.cls).length;
const profBonus = (level) => 2 + Math.floor((Math.max(level, 1) - 1) / 4);
const allPicks = (b) => b.levels.flatMap((l) => l.picks);
const hasPick = (b, re) => allPicks(b).some((p) => re.test(p));

// Ability increases written in feat choices, e.g. "Feat: Ability Improvement (+2 DEX)" or "Feat: Tavern Brawler +1 CON".
function featBonuses(b) {
  const out = Object.fromEntries(ABILITY_KEYS.map((k) => [k, 0]));
  allPicks(b).filter((p) => /^feat\b/i.test(p.trim())).forEach((p) => {
    for (const m of p.matchAll(/\+\s*(\d)\s*(STR|DEX|CON|INT|WIS|CHA)\b/gi)) out[m[2].toLowerCase()] += Number(m[1]);
  });
  return out;
}
// Final score: creation score plus feats, capped at 20 as the game does, plus whatever gear or elixirs add on top.
function finalAbility(b, ab, feats) {
  const other = Number((b.creation.extra || {})[ab]) || 0;
  return Math.min(20, finalOf(b, ab) + (feats || featBonuses(b))[ab]) + other;
}
const modOf = (score) => Math.floor((score - 10) / 2);

// Skills with Expertise, from choices such as "Expertise: Athletics + Stealth".
function expertiseSkills(b) {
  const out = new Set();
  allPicks(b).forEach((p) => {
    const m = /^expertise\s*:?\s*(.+)$/i.exec(p.trim());
    if (m) m[1].split(/\s*(?:\+|,|&|\band\b)\s*/i).forEach((x) => { const s = ALL_SKILLS.find((k) => norm(k) === norm(x)); if (s) out.add(s); });
  });
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
  return hp;
}

// What an item adds to Armour Class by its own text, and when: always, only in the off hand,
// only while unarmoured, or only in some situation (which the planner lists but does not count).
function itemAcBonus(it) {
  const texts = [it.sp || '', ...(it.ps || []).map((p) => p[1] || '')];
  for (const text of texts) {
    for (const sentence of text.split(/;|\.(?=\s|$)/)) {
      const m = /Armour Class \+(\d)|\+(\d)(?: bonus)? to (?:your |their |the wearer's )?Armour Class|Armour Class increases by (\d)/i.exec(sentence);
      if (!m) continue;
      const when = /off-?hand/i.test(sentence) ? 'offhand'
        : /not wearing armour/i.test(sentence) ? 'unarmoured'
          : /\b(while|when|after|until|if|against|as long as)\b/i.test(sentence) ? 'situational' : 'always';
      return { n: Number(m[1] || m[2] || m[3]), when, text: sentence.trim() };
    }
  }
  return null;
}
const ARMOUR_TYPES = ['Light Armour', 'Medium Armour', 'Heavy Armour'];

// Armour Class with the gear of one act, following the formulas on the wiki's Armour Class page:
// armour (with Dexterity as its type allows) or the best unarmoured formula the build has, plus the shield,
// plus every item that always adds AC, plus Defence and Dual Wielder. `swap` replaces slots ({slot: item})
// to answer "what if I wore this instead". Spells and situational bonuses are reported apart, not added.
function armourClassInfo(b, act, mods, swap) {
  const slots = b.gear[act].slots;
  const worn = {};
  SLOTS.forEach(([k]) => { const it = swap && k in swap ? swap[k] : ITEM_BY_NAME.get(norm(slots[k].name)); if (it) worn[k] = it; });
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
  if (armoured && hasPick(b, /fighting style.*defence/i)) parts.push(['Defence', 1]);
  const dual = worn.meleeMain && worn.meleeOff && worn.meleeMain.s === 'melee' && worn.meleeOff.s === 'melee';
  if (dual && hasPick(b, /dual wielder/i)) parts.push(['Dual Wielder', 1]);
  const total = parts.reduce((a, p) => a + p[1], 0);
  // Mage Armour is a spell, so it is shown as "would be" rather than counted
  const mage = !armoured && hasPick(b, /mage armour/i) ? 13 + mods.dex + (total - baseSum) : 0;
  return { total, parts, situational, mage: mage > total ? mage : 0 };
}
const armourClass = (b, act, mods, swap) => armourClassInfo(b, act, mods, swap).total;

// Everything the "Final numbers" card and the PDF sheet show.
function finalStats(b) {
  const level = charLevel(b);
  const feats = featBonuses(b);
  const scores = Object.fromEntries(ABILITY_KEYS.map((k) => [k, finalAbility(b, k, feats)]));
  const mods = Object.fromEntries(ABILITY_KEYS.map((k) => [k, modOf(scores[k])]));
  const pb = profBonus(level);
  const st = skillState(b);
  const expert = expertiseSkills(b);
  const skills = ALL_SKILLS.map((x) => {
    const proficient = !!st.granted[x] || st.chosen.includes(x) || expert.has(x);
    return { name: x, ability: skillAbility(x), proficient, expert: expert.has(x), bonus: mods[skillAbility(x)] + (proficient ? pb : 0) + (expert.has(x) ? pb : 0) };
  });
  return {
    level, feats, scores, mods, pb, skills,
    hp: hitPoints(b, mods.con),
    initiative: mods.dex + (hasPick(b, /^feat\b.*\balert\b/i) ? 5 : 0),
    ac: Object.fromEntries(ACTS.map(([k]) => [k, armourClass(b, k, mods)])),
    acInfo: Object.fromEntries(ACTS.map(([k]) => [k, armourClassInfo(b, k, mods)])),
  };
}

function statsLive(b) {
  const s = finalStats(b);
  if (!s.level) return `<p class="muted">${t('Set at least the class of level 1 to see the final numbers.')}</p>`;
  // AC shows how it adds up; spells and situational bonuses are named but not counted
  const acBox = (label, info) => `<div class="stat ac"><span>${label}</span><b>${info.total}</b>
    <small>${info.parts.map(([n, v]) => esc(v + ' ' + n)).join(' + ')}</small>
    ${info.mage ? `<small class="extra">${t('{n} with Mage Armour', { n: info.mage })}</small>` : ''}
    ${info.situational.map((x) => `<small class="extra">${esc(x)}</small>`).join('')}</div>`;
  const box = (label, value, hint) => `<div class="stat"><span>${label}</span><b>${value}</b>${hint ? `<small>${hint}</small>` : ''}</div>`;
  return `<div class="stat-row">
      ${box(t('Level'), s.level)}${box(t('Proficiency bonus'), signed(s.pb))}${box(t('Hit points'), s.hp)}${box(t('Initiative'), signed(s.initiative))}
      ${ACTS.map(([k, l]) => acBox(t('AC · {act}', { act: t(l) }), s.acInfo[k])).join('')}
    </div>
    <div class="abils final">${ABILS.map(([ab, short]) => `<div class="abil"><div class="abil-name">${short}</div>
      <div class="abil-final"><b>${s.scores[ab]}</b><i>${signed(s.mods[ab])}</i></div>
      <small>${finalOf(b, ab)}${s.feats[ab] ? ' ' + t('+{n} feats', { n: s.feats[ab] }) : ''}</small></div>`).join('')}</div>
    <div class="skill-final">${s.skills.map((k) => `<span class="${k.proficient ? 'prof' : ''}${k.expert ? ' expert' : ''}" title="${k.expert ? t('Expertise') : k.proficient ? t('Proficient') : ''}">
      ${esc(k.name)} <b>${signed(k.bonus)}</b></span>`).join('')}</div>
    <p class="muted">${t('Skills in gold are proficient, with a star they have Expertise. AC follows the game formula for the gear of each act; spells and conditional bonuses are listed but not added. Hit points count class, Constitution, Tough and Gold Dwarf.')}</p>`;
}
function statsCard(b) {
  const extra = b.creation.extra || {};
  return `<section class="card">
    <h2>${t('Final numbers')}</h2>
    <div id="stats-live">${statsLive(b)}</div>
    <h3 class="group">${t('Other ability bonuses (gear, elixirs)')}</h3>
    <div class="extra-row">${ABILS.map(([ab, short]) => `<label>${short} <input type="number" min="-10" max="20" data-path="creation.extra.${ab}" value="${esc(extra[ab] || 0)}"></label>`).join('')}</div>
  </section>`;
}

// ---------- party ----------
// For each skill, every member's bonus, with the best one highlighted.
function partySkills(members) {
  const active = members.filter((m) => m.build);
  if (!active.length) return '';
  const stats = active.map((m) => finalStats(m.build));
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
