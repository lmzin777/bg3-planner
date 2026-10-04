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

// With `only`, just that level's row (the step-by-step creation shows level 1 alone).
function levelRows(b, only) {
  const info = levelInfo(b);
  const seen = {};
  const current = b.current && b.current < charLevel(b) ? b.current : 0;
  return b.levels.map((l, i) => {
    const x = info[i];
    const firstOfClass = l.cls && !seen[l.cls];
    if (l.cls) seen[l.cls] = true;
    // the choices the level grants are selects; every other line is free text
    const slots = levelSlots(b, i);
    const cells = slotCells(b, i, slots);
    const free = l.picks.filter((p, j) => !slots.owned.has(j));
    const fill = l.cls && i < b.levels.length - 1 && !b.levels[i + 1].cls
      ? `<button class="btn tiny fill" data-act="fill-down" data-l="${i}" title="${t('Use {cls} for the empty levels below', { cls: l.cls })}">↓ ${t('same class below')}</button>` : '';
    const picks = l.picks.map((p, j) => slots.owned.has(j) ? '' :
      `<div class="pick"><input type="text" data-path="levels.${i}.picks.${j}" value="${esc(p)}" placeholder="${t('Feature, spell, feat…')}">
        <button class="icon" data-act="wiki" title="${t('Search the wiki')}">↗</button>
        <button class="icon x" data-act="pick-del" data-l="${i}" data-i="${j}" title="${t('Remove')}">×</button></div>`).join('');
    const gains = levelGains(x);
    const numbers = levelNumbers(x);
    const subs = Object.keys((CLASS_DATA[l.cls] || {}).subclasses || {}).map(subLabel);
    const subSelect = picksSubclass(x) || l.sub.trim()
      ? `<select class="sub" data-path="levels.${i}.sub" data-rerender aria-label="${t('Subclass')}">${opt('', t('— subclass —'), l.sub)}${subs.map((s) => opt(s, s, l.sub)).join('')}${
        l.sub && !subs.includes(l.sub) ? opt(l.sub, l.sub, l.sub) : ''}</select>` : '';
    // each gain opens its description; the ones the wiki describes carry it as a tooltip too
    const gain = (g) => { const text = featureText(g); return `<button class="gain${text ? '' : ' plain'}" data-act="gain-info" data-n="${esc(g)}"${text ? ` title="${esc(text)}"` : ''}>${esc(g)}</button>`; };
    return `<div class="lvl${l.sub.trim() ? ' has-sub' : ''}${current === i + 1 ? ' cur' : ''}${current && i + 1 > current ? ' later' : ''}">
      <div class="lvl-n">${i + 1}${current === i + 1 ? `<small>${t('now')}</small>` : ''}</div>
      <div class="lvl-cls">
        <select data-path="levels.${i}.cls" data-rerender aria-label="${t('Class for level {n}', { n: i + 1 })}">${opt('', t('— class —'), l.cls)}${CLASSES.map((c) => opt(c, c, l.cls)).join('')}</select>
        <small>${l.cls ? esc(l.cls) + ' ' + x.n : ''}</small>
        ${subSelect}
        ${fill}
      </div>
      <div class="lvl-body">
        ${gains.length ? `<p class="lvl-gains"><b>${t('Gains')}</b> ${gains.map(gain).join('')}</p>` : ''}
        ${numbers.length ? `<p class="lvl-nums"><b>${t('Now')}</b> ${numbers.map(esc).join(' · ')}</p>` : ''}
        ${cells ? `<div class="lslots">${cells}</div>` : ''}
        <div class="picks${free.some((p) => p.length > 34) ? ' one' : ''}">${picks}
          <div class="pick-btns">
            ${l.cls && SPELLS.length ? spellButton(l, x, i) : ''}
            <button class="btn tiny" data-act="pick-add" data-l="${i}" title="${t('A line of free text: a reminder, a feature to keep in mind…')}">${t('+ note')}</button>
          </div>
        </div>
      </div>
    </div>${i === 0 || firstOfClass ? classNote(b, i, l.cls) : ''}`;
  }).filter((row, i) => only == null || i === only).join('');
}

// "+ spell · 1/3": what the level has chosen out of the spells and cantrips it teaches; gold while short.
function spellButton(l, x, i) {
  const learn = spellsAtLevel(x);
  const need = learn ? learn.spells + learn.cantrips : 0;
  const have = l.picks.filter((p) => /^(spell|cantrip)s?\s*:/i.test(p.trim()) && !/\(replaces /i.test(p)).length;  // a swap is not a new spell
  // a class with no spell list of its own (a Fighter who is not an Eldritch Knight) has nothing to pick here
  if (!learn || !SPELLS.some((s) => (s.cl || []).includes(learn.list))) return '';
  const hint = need ? [learn.cantrips ? t('{n} cantrip(s)', { n: learn.cantrips }) : '', learn.spells ? t('{n} spell(s)', { n: learn.spells }) : ''].filter(Boolean).join(' + ') : '';
  return `<button class="btn tiny${need && have < need ? ' gold' : ''}" data-act="spell-open" data-l="${i}"${hint ? ` title="${t('This level teaches {x}', { x: hint })}"` : ''}>${t('+ spell')}${need ? ` · ${have}/${need}` : ''}</button>`;
}

// How many new cantrips or spells a level may hold, or null when the class is free to add: classes that prepare
// from their whole list, and the Wizard, who also learns spells from scrolls.
function spellCap(info, learn, cantrip) {
  if (!learn) return null;
  if (SPELL_PICKS[info.sub]) return cantrip ? learn.cantrips : learn.spells;
  const cols = (CLASS_DATA[info.cls] || {}).cols || [];
  if (cantrip) return cols.some((c) => /cantrips known/i.test(c)) ? learn.cantrips : null;
  return info.cls !== 'Wizard' && cols.some((c) => /spells known/i.test(c)) ? learn.spells : null;
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
// ---------- spell picker ----------
function spellPickerList() {
  const q = norm(dlg.q);
  const tooHigh = (s) => dlg.max > 0 && s.lv > dlg.max;
  const offSchool = (s) => !!dlg.schools && s.lv > 0 && !dlg.schools.includes(s.sc);
  const list = SPELLS.filter((s) => (!dlg.onlyClass || (s.cl || []).includes(dlg.list) || (s.lr || []).some(([who]) => who === dlg.sub))
    && (!dlg.reach || !tooHigh(s)) && (!dlg.school || !offSchool(s))
    && (dlg.lv === '' || String(s.lv) === dlg.lv) && (!q || norm(s.n).includes(q) || norm(s.d).includes(q)));
  $('#dlg-count').textContent = t('{n} spells', { n: list.length });
  spellPickerKnown();
  return list.slice(0, 120).map((s) =>
    `<button class="pick-row${tooHigh(s) ? ' no' : ''}" data-act="spell-choose" data-n="${esc(s.n)}">${pic(s.i, 'pic small')}<b>${esc(s.n)}</b>
      <span>${s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip')}${s.sc ? ' · ' + esc(s.sc) : ''}${tooHigh(s) ? ` · <em>${t('above what this level can learn')}</em>` : ''}${
        offSchool(s) ? ` · <em>${t('uses a free pick: outside {schools}', { schools: dlg.schools.join(', ') })}</em>` : ''}</span>
      <small class="fx">${esc(s.d || '')}</small>
      <small>${esc([s.rg, s.du, s.dm, s.co ? t('Concentration') : ''].filter(Boolean).join(' · '))}</small></button>`).join('')
    || `<p class="muted">${t('Nothing matches these filters.')}</p>`;
}
// How many cantrips and spells of this class the build has chosen, against what the class allows.
function spellPickerKnown() {
  const k = knownSpells(curBuild()).find((x) => x.cls === dlg.cls);
  const el = $('#dlg-known');
  if (!el) return;
  const b = curBuild();
  const learn = spellsAtLevel(levelInfo(b)[dlg.level]);
  const here = b.levels[dlg.level].picks.filter((p) => /^(spell|cantrip)s?\s*:/i.test(p.trim()) && !/\(replaces /i.test(p)).length;
  const teaches = learn && learn.spells + learn.cantrips ? t('This level teaches {x}', { x: [learn.cantrips ? t('{n} cantrip(s)', { n: learn.cantrips }) : '', learn.spells ? t('{n} spell(s)', { n: learn.spells }) : ''].filter(Boolean).join(' + ') })
    + (learn.any ? ' ' + t('({n} of them free of the school limit)', { n: learn.any }) : '') + ' · ' + t('{n} chosen here', { n: here }) + '<br>' : '';
  el.innerHTML = teaches + (k ? [k.maxCantrips ? `<b class="${k.cantrips > k.maxCantrips ? 'warn' : ''}">${t('{n} of {max} cantrips', { n: k.cantrips, max: k.maxCantrips })}</b>` : '',
    k.maxSpells ? `<b class="${k.spells > k.maxSpells ? 'warn' : ''}">${t('{n} of {max} spells', { n: k.spells, max: k.maxSpells })}</b>` : ''].filter(Boolean).join(' · ') + ' ' + t('chosen for {cls} so far', { cls: k.label })
    + (k.schools ? ` · <b class="${k.offSchool > k.maxAny ? 'warn' : ''}">${t('{n} of {max} free picks used', { n: k.offSchool, max: k.maxAny })}</b>` : '') : '');
  const swap = $('#dlg-replace');
  if (swap) swap.innerHTML = opt('', t('— nothing: learn a new spell —'), dlg.replace) + spellSwapOptions().map((n) => opt(n, n, dlg.replace)).join('');
}
// Spells of this class learned at earlier levels and still known: the ones a level up may swap out.
const spellSwapOptions = () => currentSpells(curBuild()).filter((x) => x.cls === dlg.cls && !x.cantrip && x.level < dlg.level).map((x) => x.name);

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
  'spell-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const x = levelInfo(b)[level];
    const max = maxSpellLevel(b, level);
    const learn = spellsAtLevel(x) || { list: x.cls };
    dlg = { kind: 'spell', level, q: '', lv: '', cls: x.cls, sub: subLabel(x.sub), list: learn.list, schools: learn.schools, school: !!learn.schools, replace: '', max, reach: max > 0,
      onlyClass: SPELLS.some((s) => (s.cl || []).includes(learn.list)),
      refresh: () => { $('#dlg-list').innerHTML = spellPickerList(); } };
    openDialog(`<h2>${t('Spells')}</h2><p class="muted">${t('Click a spell to add it to level {n}. You can add several.', { n: level + 1 })}</p>
      <div class="picker-tools"><input type="text" data-dlg="q" placeholder="${t('Search by name or description…')}" autocomplete="off">
        <select data-dlg="lv">${opt('', t('Any level'), '')}${opt('0', t('Cantrip'), '')}${[1, 2, 3, 4, 5, 6].map((n) => opt(String(n), t('Level {n}', { n }), '')).join('')}</select></div>
      <div class="picker-tools"><label class="chk"><input type="checkbox" data-dlg="onlyClass"${dlg.onlyClass ? ' checked' : ''}> ${t('Only {cls} spells', { cls: learn.list })}</label>
        ${max > 0 ? `<label class="chk"><input type="checkbox" data-dlg="reach" checked> ${t('Only up to spell level {n}, the most {cls} {lv} can learn', { n: max, cls: x.cls, lv: x.n })}</label>` : ''}
        ${learn.schools ? `<label class="chk"><input type="checkbox" data-dlg="school" checked> ${t('Only {schools}', { schools: learn.schools.join(', ') })}</label>` : ''}
        <span class="muted" id="dlg-count"></span></div>
      ${learn.replace ? `<div class="picker-tools"><label class="field"><span>${t('The next spell replaces a known one (allowed once per level up)')}</span><select data-dlg="replace" id="dlg-replace"></select></label></div>` : ''}
      <p class="points" id="dlg-known"></p>
      <div class="picker-list" id="dlg-list"></div>
      <div class="modal-btns"><span></span><button class="btn primary" data-act="dialog-close">${t('Done')}</button></div>`, 'picker-box');
    dlg.refresh();
    return false;
  },
  'spell-choose'(el) {
    const s = SPELLS.find((x) => x.n === el.dataset.n);
    const swap = s.lv && dlg.replace ? ' (replaces ' + dlg.replace + ')' : '';
    // a level cannot hold more new cantrips or spells than it teaches
    const b = curBuild();
    const learn = spellsAtLevel(levelInfo(b)[dlg.level]);
    const cap = swap ? null : spellCap(levelInfo(b)[dlg.level], learn, !s.lv);
    if (cap != null && spellPicks(b).filter((p) => p.level === dlg.level && !p.replaces && p.cantrip === !s.lv).length >= cap) {
      toast(!s.lv ? (cap ? t('This level already has its {max} cantrip(s). Remove one to change it.', { max: cap }) : t('This level learns no new cantrips.'))
        : cap ? t('This level already has its {max} spell(s). Remove one to change it.', { max: cap })
          : learn.replace ? t('This level learns no new spells. To change one, choose above the known spell it replaces.') : t('This level learns no new spells.'));
      return false;
    }
    curBuild().levels[dlg.level].picks.push((s.lv ? 'Spell: ' : 'Cantrip: ') + s.n + swap);
    toast(swap ? t('Level {n}: {x} replaces {y}', { n: dlg.level + 1, x: s.n, y: dlg.replace }) : t('Added to level {n}: {x}', { n: dlg.level + 1, x: s.n }));
    if (swap) dlg.replace = '';
    spellPickerKnown();
  },
});
