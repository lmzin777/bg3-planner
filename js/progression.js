// Level progression: what each class and subclass grants per level (from classes.js), the level table
// of the Build Planner, and the feat and spell pickers that add choices to a level.
'use strict';

const CLASS_DATA = window.BG3_CLASSES || {};
const FEATS = window.BG3_FEATS || [];
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

function levelRows(b) {
  const info = levelInfo(b);
  const seen = {};
  return b.levels.map((l, i) => {
    const x = info[i];
    const firstOfClass = l.cls && !seen[l.cls];
    if (l.cls) seen[l.cls] = true;
    const picks = l.picks.map((p, j) =>
      `<div class="pick"><input type="text" data-path="levels.${i}.picks.${j}" value="${esc(p)}" placeholder="${t('Feature, spell, feat…')}">
        <button class="icon" data-act="wiki" title="${t('Search the wiki')}">↗</button>
        <button class="icon x" data-act="pick-del" data-l="${i}" data-i="${j}" title="${t('Remove')}">×</button></div>`).join('');
    const gains = levelGains(x);
    const subs = Object.keys((CLASS_DATA[l.cls] || {}).subclasses || {}).map(subLabel);
    const subSelect = picksSubclass(x) || l.sub.trim()
      ? `<select class="sub" data-path="levels.${i}.sub" data-rerender aria-label="${t('Subclass')}">${opt('', t('— subclass —'), l.sub)}${subs.map((s) => opt(s, s, l.sub)).join('')}${
        l.sub && !subs.includes(l.sub) ? opt(l.sub, l.sub, l.sub) : ''}</select>` : '';
    return `<div class="lvl${l.sub.trim() ? ' has-sub' : ''}">
      <div class="lvl-n">${i + 1}</div>
      <div class="lvl-cls">
        <select data-path="levels.${i}.cls" data-rerender aria-label="${t('Class for level {n}', { n: i + 1 })}">${opt('', t('— class —'), l.cls)}${CLASSES.map((c) => opt(c, c, l.cls)).join('')}</select>
        <small>${l.cls ? esc(l.cls) + ' ' + x.n : ''}</small>
        ${subSelect}
      </div>
      <div class="lvl-body">
        ${gains.length ? `<p class="lvl-gains"><b>${t('Gains')}</b> ${gains.map(esc).join(' · ')}</p>` : ''}
        <div class="picks${l.picks.some((p) => p.length > 34) ? ' one' : ''}">${picks}
          <div class="pick-btns">
            ${grantsFeat(x) ? `<button class="btn tiny gold" data-act="feat-open" data-l="${i}">${t('+ feat')}</button>` : ''}
            ${l.cls && SPELLS.length ? `<button class="btn tiny" data-act="spell-open" data-l="${i}">${t('+ spell')}</button>` : ''}
            <button class="btn tiny" data-act="pick-add" data-l="${i}">${t('+ choice')}</button>
          </div>
        </div>
      </div>
    </div>${i === 0 || firstOfClass ? classNote(b, i, l.cls) : ''}`;
  }).join('');
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
  </dl></div>`;
}

// ---------- feat picker ----------
// Abilities a feat lets you raise by 1; Ability Improvement is handled as +2 to one or +1 to two.
function featAbilities(name, desc) {
  if (name === 'Ability Improvement') return ABILS.map((a) => a[1]);
  const sentence = (desc.split(';').find((s) => /ability score/i.test(s) && /by 1/i.test(s)) || '');
  if (!sentence) return [];
  const named = ABILS.filter((a) => sentence.includes(a[2])).map((a) => a[1]);
  return named.length ? named : ABILS.map((a) => a[1]);
}
function featList() {
  const q = norm(dlg.q);
  return FEATS.filter(([n, d]) => !q || norm(n).includes(q) || norm(d).includes(q)).map(([n, d]) =>
    `<button class="pick-row" data-act="feat-choose" data-n="${esc(n)}"><b>${esc(n)}</b><small class="fx">${esc(d)}</small></button>`).join('')
    || `<p class="muted">${t('Nothing matches these filters.')}</p>`;
}
function featStep() {
  const s = dlg.step;
  const need = s.name === 'Ability Improvement' ? t('Pick one ability for +2, or two abilities for +1 each.') : t('Pick the ability that gets +1.');
  const ready = s.chosen.length === 1 || (s.name === 'Ability Improvement' && s.chosen.length === 2);
  return `<h2>${esc(s.name)}</h2><p class="muted">${need}</p>
    <div class="lib-row">${s.options.map((ab) => `<button class="chip${s.chosen.includes(ab) ? ' on' : ''}" data-act="feat-ability" data-ab="${ab}">${ab}</button>`).join('')}</div>
    <div class="modal-btns"><button class="btn" data-act="feat-open" data-l="${dlg.level}">${t('← Back')}</button>
      <button class="btn primary" data-act="feat-confirm"${ready ? '' : ' disabled'}>${t('Add feat')}</button></div>`;
}
function addFeat(level, name, bonus) {
  curBuild().levels[level].picks.push('Feat: ' + name + (bonus ? ' (' + bonus + ')' : ''));
  closeDialog();
  toast(t('Added to level {n}: {x}', { n: level + 1, x: name }));
}

// ---------- spell picker ----------
function spellPickerList() {
  const q = norm(dlg.q);
  const list = SPELLS.filter((s) => (!dlg.onlyClass || (s.cl || []).includes(dlg.cls) || (s.lr || []).some(([who]) => who === dlg.sub))
    && (dlg.lv === '' || String(s.lv) === dlg.lv) && (!q || norm(s.n).includes(q) || norm(s.d).includes(q)));
  $('#dlg-count').textContent = t('{n} spells', { n: list.length });
  return list.slice(0, 120).map((s) =>
    `<button class="pick-row" data-act="spell-choose" data-n="${esc(s.n)}">${pic(s.i, 'pic small')}<b>${esc(s.n)}</b>
      <span>${s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip')}${s.sc ? ' · ' + esc(s.sc) : ''}</span>
      <small class="fx">${esc(s.d || '')}</small>
      <small>${esc([s.rg, s.du, s.dm, s.co ? t('Concentration') : ''].filter(Boolean).join(' · '))}</small></button>`).join('')
    || `<p class="muted">${t('Nothing matches these filters.')}</p>`;
}

Object.assign(actions, {
  'feat-open'(el) {
    const level = +el.dataset.l;
    dlg = { kind: 'feat', level, q: '', refresh: () => { $('#dlg-list').innerHTML = featList(); } };
    openDialog(`<h2>${t('Feats')}</h2><p class="muted">${t('Choose the feat for level {n}.', { n: level + 1 })}</p>
      <div class="picker-tools"><input type="text" data-dlg="q" placeholder="${t('Search by name or effect…')}" autocomplete="off"></div>
      <div class="picker-list" id="dlg-list">${featList()}</div>
      <div class="modal-btns"><span></span><button class="btn" data-act="dialog-close">${t('Close')}</button></div>`, 'picker-box');
    return false;
  },
  'feat-choose'(el) {
    const feat = FEATS.find(([n]) => n === el.dataset.n);
    const options = featAbilities(feat[0], feat[1]);
    if (options.length === 1) { addFeat(dlg.level, feat[0], '+1 ' + options[0]); return; }
    if (!options.length) { addFeat(dlg.level, feat[0], ''); return; }
    dlg.step = { name: feat[0], options, chosen: [] };
    $('#dialog-box').innerHTML = featStep();
    return false;
  },
  'feat-ability'(el) {
    const s = dlg.step;
    const max = s.name === 'Ability Improvement' ? 2 : 1;
    const i = s.chosen.indexOf(el.dataset.ab);
    if (i >= 0) s.chosen.splice(i, 1);
    else { if (s.chosen.length >= max) s.chosen.shift(); s.chosen.push(el.dataset.ab); }
    $('#dialog-box').innerHTML = featStep();
    return false;
  },
  'feat-confirm'() {
    const s = dlg.step;
    const bonus = s.name === 'Ability Improvement' && s.chosen.length === 1 ? '+2 ' + s.chosen[0] : s.chosen.map((ab) => '+1 ' + ab).join(', ');
    addFeat(dlg.level, s.name, bonus);
  },
  'spell-open'(el) {
    const level = +el.dataset.l;
    const x = levelInfo(curBuild())[level];
    dlg = { kind: 'spell', level, q: '', lv: '', cls: x.cls, sub: subLabel(x.sub), onlyClass: SPELLS.some((s) => (s.cl || []).includes(x.cls)),
      refresh: () => { $('#dlg-list').innerHTML = spellPickerList(); } };
    openDialog(`<h2>${t('Spells')}</h2><p class="muted">${t('Click a spell to add it to level {n}. You can add several.', { n: level + 1 })}</p>
      <div class="picker-tools"><input type="text" data-dlg="q" placeholder="${t('Search by name or description…')}" autocomplete="off">
        <select data-dlg="lv">${opt('', t('Any level'), '')}${opt('0', t('Cantrip'), '')}${[1, 2, 3, 4, 5, 6].map((n) => opt(String(n), t('Level {n}', { n }), '')).join('')}</select></div>
      <div class="picker-tools"><label class="chk"><input type="checkbox" data-dlg="onlyClass"${dlg.onlyClass ? ' checked' : ''}> ${t('Only {cls} spells', { cls: x.cls })}</label>
        <span class="muted" id="dlg-count"></span></div>
      <div class="picker-list" id="dlg-list"></div>
      <div class="modal-btns"><span></span><button class="btn primary" data-act="dialog-close">${t('Done')}</button></div>`, 'picker-box');
    dlg.refresh();
    return false;
  },
  'spell-choose'(el) {
    const s = SPELLS.find((x) => x.n === el.dataset.n);
    curBuild().levels[dlg.level].picks.push((s.lv ? 'Spell: ' : 'Cantrip: ') + s.n);
    toast(t('Added to level {n}: {x}', { n: dlg.level + 1, x: s.n }));
  },
});
