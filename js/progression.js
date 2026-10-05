// Level progression: what each class and subclass grants per level (from classes.js), the level table
// of the Build Planner, and the feat, spell and Expertise pickers that add choices to a level.
'use strict';

const CLASS_DATA = window.BG3_CLASSES || {};
const FEATS = window.BG3_FEATS || [];
const FEATURES = window.BG3_FEATURES || {};
const SPELL_BY_NAME = new Map(SPELLS.map((s) => [norm(s.n), s]));
// Entries of the class table that only announce a choice; the planner shows controls for them instead.
const GENERIC_GAIN = /^(feats?|choose a subclass|subclass features?)$/i;
const SUB_NOISE = new Set(['of', 'the', 'way', 'oath', 'college', 'circle', 'domain', 'school', 'magic', 'sorcery', 'bloodline', 'subclass']);
// "Giant (barbarian subclass)" is how the wiki names the page; show it as "Giant".
const subLabel = (name) => name.replace(/\s*\([^)]*subclass\)$/i, '');

// The subclass of the class that a free-text name refers to ("Vengeance Paladin" is "Oath of Vengeance").
function matchSubclass(cls, text) {
  const subs = Object.keys((CLASS_DATA[cls] || {}).subclasses || {});
  const want = norm(text);
  if (!want) return '';
  const exact = subs.find((s) => norm(s) === want || norm(subLabel(s)) === want);
  if (exact) return exact;
  const words = want.split(/[^a-z']+/).filter((w) => w && !SUB_NOISE.has(w) && w !== norm(cls));
  let best = '';
  let bestScore = 0;
  subs.forEach((s) => {
    const have = norm(subLabel(s)).split(/[^a-z']+/);
    const score = words.filter((w) => have.includes(w)).length;
    if (score > bestScore) { best = s; bestScore = score; }
  });
  return best;
}

// For each of the 12 levels: its class, the level within that class, and the subclass the build uses for it.
function levelInfo(b) {
  const count = {};
  const subText = {};
  b.levels.forEach((l) => { if (l.cls && l.sub.trim()) subText[l.cls] = l.sub.trim(); });
  return b.levels.map((l) => {
    if (!l.cls) return { cls: '', n: 0, sub: '' };
    count[l.cls] = (count[l.cls] || 0) + 1;
    return { cls: l.cls, n: count[l.cls], sub: matchSubclass(l.cls, subText[l.cls]) };
  });
}

// Features the level grants on its own: from the class table and, once a subclass is set, from the subclass.
function levelGains(info) {
  const d = CLASS_DATA[info.cls];
  if (!d) return [];
  const out = (d.levels[info.n] || []).filter((g) => !GENERIC_GAIN.test(g));
  if (info.sub) (d.subclasses[info.sub][info.n] || []).forEach((g) => { if (!out.includes(g)) out.push(g); });
  return out;
}
const grantsFeat = (info) => ((CLASS_DATA[info.cls] || { levels: {} }).levels[info.n] || []).some((g) => /^feats?$/i.test(g));
const picksSubclass = (info) => !!CLASS_DATA[info.cls] && CLASS_DATA[info.cls].subclassLevel === info.n;
const grantsExpertise = (info) => levelGains(info).some((g) => /^expertise\b/i.test(g));

// What a feature does: its description from the wiki, else that of the spell or feat of the same name.
function featureText(name) {
  // the wiki files every class's Spellcasting under one page; say what it means instead of quoting one class
  if (/^spellcasting$/i.test(name)) return t('This class casts spells from its own list, using spell slots. The cantrips and spells it learns are chosen level by level.');
  const base = name.replace(/\s*\([^)]*\)$/, '').replace(/: \d+$/, '');
  const spell = SPELL_BY_NAME.get(norm(name)) || SPELL_BY_NAME.get(norm(base));
  const feat = FEATS.find(([n]) => n === name);
  return FEATURES[name] || FEATURES[base] || (spell && spell.d) || (feat && feat[1]) || '';
}
const slotsText = (row) => { const r = (row || []).slice(); while (r.length && !r[r.length - 1]) r.pop(); return r.join(' / '); };
// The numbers of the class table that change at this class level: "Rage Charges 3", "Spell slots 4 / 2".
function levelNumbers(info) {
  const d = CLASS_DATA[info.cls];
  if (!d) return [];
  const out = [];
  const now = (d.table || {})[info.n] || [];
  const before = (d.table || {})[info.n - 1] || [];
  (d.cols || []).forEach((col, i) => { if (now[i] && now[i] !== before[i]) out.push(col + ' ' + now[i]); });
  let slots = (d.slots || {})[info.n];
  let prev = (d.slots || {})[info.n - 1];
  // Eldritch Knights and Arcane Tricksters count a third of their level towards the shared slot table
  if (!slots && CAST_SUBCLASS[info.sub] && info.sub !== 'Way of the Four Elements' && info.n >= 3) {
    slots = ESL_SLOTS[Math.ceil(info.n / 3)];
    prev = info.n > 3 ? ESL_SLOTS[Math.ceil((info.n - 1) / 3)] : null;
  }
  if (slots && slots.some(Boolean) && JSON.stringify(slots) !== JSON.stringify(prev)) {
    if (info.cls === 'Warlock') { const i = slots.findIndex((x) => x > 0); out.push(t('Pact slots: {n} of level {lv}', { n: slots[i], lv: i + 1 })); } else out.push(t('Spell slots') + ' ' + slotsText(slots));
  }
  return out;
}

// The subclass select of a level, where the class picks its subclass or the level already names one.
function subclassSelect(l, x, i) {
  if (!picksSubclass(x) && !l.sub.trim()) return '';
  return slotButton('sub-open', `data-l="${i}"`, l.sub, '', t('— subclass —'));
}
// What a level chooses: one select per choice it grants. Lines of text that are not one of those choices (kept
// from ready-made builds and older versions) show under them and can only be edited or removed.
function levelChoicesBlock(b, i, withSub) {
  const l = b.levels[i];
  const x = levelInfo(b)[i];
  const slots = levelSlots(b, i);
  const sub = withSub ? subclassSelect(l, x, i) : '';
  const cells = (sub ? `<div class="lslot${l.sub.trim() ? '' : ' open'}"><span class="lslot-l">${t('Subclass')}</span>${sub}</div>` : '') + slotCells(b, i, slots);
  const free = l.picks.map((p, j) => slots.owned.has(j) ? '' :
    `<div class="pick"><input type="text" data-path="levels.${i}.picks.${j}" value="${esc(p)}" aria-label="${t('Note')}">
      <button class="icon" data-act="wiki" title="${t('Search the wiki')}">↗</button>
      <button class="icon x" data-act="pick-del" data-l="${i}" data-i="${j}" title="${t('Remove')}">×</button></div>`).join('');
  return (cells ? `<div class="lslots">${cells}</div>` : '')
    + (free ? `<div class="picks${l.picks.some((p, j) => !slots.owned.has(j) && p.length > 34) ? ' one' : ''}">${free}</div>` : '');
}

// With `only`, just that level's row (the step-by-step creation shows level 1 alone).
function levelRows(b, only) {
  const info = levelInfo(b);
  const seen = {};
  const current = b.current && b.current < charLevel(b) ? b.current : 0;
  return b.levels.map((l, i) => {
    const x = info[i];
    const firstOfClass = l.cls && !seen[l.cls];
    if (l.cls) seen[l.cls] = true;
    const fill = l.cls && i < b.levels.length - 1 && !b.levels[i + 1].cls
      ? `<button class="btn tiny fill" data-act="fill-down" data-l="${i}" title="${t('Use {cls} for the empty levels below', { cls: l.cls })}">↓ ${t('same class below')}</button>` : '';
    const gains = levelGains(x);
    const numbers = levelNumbers(x);
    const subSelect = subclassSelect(l, x, i);
    // each gain opens its description; the ones the wiki describes carry it as a tooltip too
    const gain = (g) => { const text = featureText(g); return `<button class="gain${text ? '' : ' plain'}" data-act="gain-info" data-n="${esc(g)}"${text ? ` title="${esc(text)}"` : ''}>${esc(g)}</button>`; };
    return `<div class="lvl${l.sub.trim() ? ' has-sub' : ''}${current === i + 1 ? ' cur' : ''}${current && i + 1 > current ? ' later' : ''}">
      <div class="lvl-n">${i + 1}${current === i + 1 ? `<small>${t('now')}</small>` : ''}</div>
      <div class="lvl-cls">
        ${slotButton('class-open', `data-l="${i}"`, l.cls, '', t('— class —'))}
        <small>${l.cls ? esc(l.cls) + ' ' + x.n : ''}</small>
        ${subSelect}
        ${fill}
      </div>
      <div class="lvl-body">
        ${gains.length ? `<p class="lvl-gains"><b>${t('Gains')}</b> ${gains.map(gain).join('')}</p>` : ''}
        ${numbers.length ? `<p class="lvl-nums"><b>${t('Now')}</b> ${numbers.map(esc).join(' · ')}</p>` : ''}
        ${levelChoicesBlock(b, i)}
      </div>
    </div>${i === 0 || firstOfClass ? classNote(b, i, l.cls) : ''}`;
  }).filter((row, i) => only == null || i === only).join('');
}

// Shown under the first level of each class: what that class grants there.
function classNote(b, i, cls) {
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const first = b.levels.findIndex((l) => l.cls);
  if (i === 0 && first !== 0) return `<div class="lvl-note none"><p class="muted">${t('Pick the class for level 1 to see its saving throws, proficiencies and skill choices.')}</p></div>`;
  const ci = DATA.classes[cls];
  const p = CLASS_PROF[cls];
  if (!ci || !p) return '';
  if (i === first) {
    return `<div class="lvl-note"><h4>${t('Starting class · {cls}', { cls })}</h4><dl>
      ${row(t('Saving throws'), ci.saves.map((x) => t(x)).join(', '))}
      ${row(t('Proficiencies'), esc(profNames(p.start)))}
      ${row(t('Skills'), t('Choose {n} from: {list}', { n: ci.pick, list: ci.skills === 'any' ? t('any skill') : esc(ci.skills.join(', ')) }))}
      ${row(t('Hit points'), t('{first} at level 1, then {next} per level, plus the Constitution modifier', { first: HIT_DIE[cls], next: HIT_DIE[cls] / 2 + 1 }))}
    </dl></div>`;
  }
  return `<div class="lvl-note"><h4>${t('Multiclass · {cls}', { cls })}</h4><dl>
    ${row(t('Proficiencies gained'), p.multi.length ? esc(profNames(p.multi)) : t('none'))}
    ${MULTI_SKILLS[cls] ? row(t('Skills'), t('Choose {n} from: {list}', { n: MULTI_SKILLS[cls], list: ci.skills === 'any' ? t('any skill') : esc(ci.skills.join(', ')) })) : ''}
    ${row(t('Hit points'), t('{next} per level, plus the Constitution modifier', { next: HIT_DIE[cls] / 2 + 1 }))}
  </dl></div>`;
}

// ---------- feats ----------
// Abilities a feat lets you raise by 1; Ability Improvement is handled as +2 to one or +1 to two.
function featAbilities(name, desc) {
  if (name === 'Ability Improvement') return ABILS.map((a) => a[1]);
  const sentence = (desc.split(';').find((s) => /ability score/i.test(s) && /by 1/i.test(s)) || '');
  if (!sentence) return [];
  const named = ABILS.filter((a) => sentence.includes(a[2])).map((a) => a[1]);
  return named.length ? named : ABILS.map((a) => a[1]);
}
Object.assign(actions, {
  'gain-info'(el) {
    const name = el.dataset.n;
    const text = featureText(name);
    openDialog(`<h2>${esc(name)}</h2>
      <p>${text ? esc(text) : `<span class="muted">${t('The wiki has no short description for this one. Open its page for the details.')}</span>`}</p>
      <div class="modal-btns"><a class="btn" href="${wikiUrl(name)}" target="_blank" rel="noopener">${t('Open the wiki page')} ↗</a>
        <button class="btn primary" data-act="dialog-close">${t('Close')}</button></div>`);
    return false;
  },
});
