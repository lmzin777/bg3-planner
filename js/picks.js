// Guided choices: what each level lets the build choose (fighting styles, invocations, metamagic, manoeuvres…),
// the dialog that picks them, the choices inside feats, the racial cantrip and the permanent bonuses.
// A choice is stored as a line of the level, "Fighting Style: Archery", so builds stay readable as text.
'use strict';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namesRe = (name) => new RegExp('(^|[^a-z])' + escRe(name) + '([^a-z]|$)', 'i');
const prefixRe = (name) => new RegExp('^' + escRe(name) + 's?\\s*:', 'i');

// The choices a build level opens: [{ group, i (its index in CHOICES), n }], from its class and the build's subclass of it.
function levelChoices(info) {
  return CHOICES.map((group, i) => ({ group, i, n: group.at[info.n] || 0 }))
    .filter((x) => x.n && (x.group.owner === info.cls || (info.sub && x.group.owner === info.sub)));
}
// Every choice one class of the build has to make by its last level there, merged by name (a Champion's second
// fighting style adds to the Fighter's first): [{ name, need, options, join, repeat }].
function classChoices(b, cls) {
  const info = levelInfo(b);
  const n = info.filter((x) => x.cls === cls).length;
  const sub = (info.find((x) => x.cls === cls && x.sub) || {}).sub;
  const out = {};
  CHOICES.filter((c) => c.owner === cls || (sub && c.owner === sub)).forEach((c) => {
    const need = Object.keys(c.at).reduce((a, lv) => a + (Number(lv) <= n ? c.at[lv] : 0), 0);
    if (!need) return;
    const g = out[c.name] || (out[c.name] = { name: c.name, need: 0, options: [], join: c.join, repeat: c.repeat });
    g.need += need;
    c.options.forEach((o) => { if (!g.options.some((x) => x[0] === o[0])) g.options.push(o); });
  });
  return Object.values(out);
}
// What the levels of a class already say about a choice: the option names, with "?" for a line that
// carries the prefix but names nothing the planner knows ("Manoeuvres: your choice").
function chosenOf(b, cls, group) {
  const info = levelInfo(b);
  const prefix = prefixRe(group.name);
  const out = [];
  b.levels.forEach((l, i) => {
    if (info[i].cls !== cls) return;
    l.picks.forEach((p) => {
      const text = p.trim();
      if (prefix.test(text)) {
        const named = group.options.map((o) => o[0]).filter((name) => namesRe(name).test(text.replace(prefix, '')));
        if (group.repeat || !named.length) out.push(named[0] || '?');
        else named.forEach((x) => { if (!out.includes(x)) out.push(x); });
      } else if (!group.join) {
        // a bare option name written as a choice of its own ("Riposte")
        const o = group.options.find((x) => norm(x[0]) === norm(text.replace(/\(.*$/, '')));
        if (o && !out.includes(o[0])) out.push(o[0]);
      }
    });
  });
  return out;
}
// The options the build has taken, with their descriptions, for rules that read them (a Favoured Enemy
// that grants a skill or heavy armour): [[name, description]].
function chosenOptions(b) {
  const out = [];
  Object.keys(classLevels(b)).forEach((cls) => classChoices(b, cls).forEach((g) => {
    chosenOf(b, cls, g).forEach((name) => { const o = g.options.find((x) => x[0] === name); if (o) out.push([o[0], o[1] || '', g.name]); });
  }));
  return out;
}

// ---------- the chooser: a dialog that picks n options out of one or more lists ----------
// dlg.parts = [{ label, n, min, options: [[name, description]], chosen: [], off: [names that cannot be taken] }]
function chooserList() {
  const q = norm(dlg.q);
  return dlg.parts.map((p, i) => {
    const rows = p.options.filter(([n, d]) => !q || norm(n).includes(q) || norm(d).includes(q)).map(([n, d]) => {
      const off = (p.off || []).includes(n);
      return `<button class="pick-row${off ? ' no' : ''}" data-act="choose-toggle" data-p="${i}" data-n="${esc(n)}"${off ? ' disabled' : ''}>
        <b>${esc(n)}</b>${off ? `<span><em>${t('already chosen')}</em></span>` : ''}${d ? `<small class="fx">${esc(d)}</small>` : ''}</button>`;
    }).join('');
    return `<h4 class="choose-head">${esc(p.label)} <span data-count="${i}"></span></h4>
      <div class="${p.options.every((o) => !o[1]) ? 'choose-grid' : ''}">${rows || `<p class="muted">${t('Nothing matches these filters.')}</p>`}</div>`;
  }).join('');
}
function chooserSync() {
  dlg.parts.forEach((p, i) => { const el = $(`[data-count="${i}"]`); if (el) el.textContent = t('{n} of {max}', { n: p.chosen.length, max: p.n }); });
  $$('#dlg-list [data-act="choose-toggle"]').forEach((el) => el.classList.toggle('on', dlg.parts[+el.dataset.p].chosen.includes(el.dataset.n)));
  const ok = $('#choose-ok');
  if (ok) ok.disabled = !dlg.parts.every((p) => p.chosen.length >= (p.min == null ? p.n : p.min));
}
function openChooser(title, hint, parts, done) {
  dlg = { kind: 'choose', q: '', parts, done, refresh: () => { $('#dlg-list').innerHTML = chooserList(); chooserSync(); } };
  parts.forEach((p) => { p.chosen = p.chosen || []; });
  openDialog(`<h2>${esc(title)}</h2>${hint ? `<p class="muted">${hint}</p>` : ''}
    ${parts.some((p) => p.options.length > 12) ? `<div class="picker-tools"><input type="text" data-dlg="q" placeholder="${t('Search by name or effect…')}" autocomplete="off"></div>` : ''}
    <div class="picker-list" id="dlg-list">${chooserList()}</div>
    <div class="modal-btns"><button class="btn" data-act="dialog-close">${t('Cancel')}</button>
      <button class="btn primary" id="choose-ok" data-act="choose-confirm" disabled>${t('Add')}</button></div>`, 'picker-box');
  chooserSync();
}

// ---------- feats: the choices inside them ----------
// The lists a feat asks to choose from, on top of the feat itself.
function featParts(name, desc, b) {
  const parts = [];
  const abilities = featAbilities(name, desc);
  if (name === 'Ability Improvement') parts.push({ key: 'ability', label: t('Abilities: one for +2, or two for +1 each'), n: 2, min: 1, options: abilities.map((a) => [a, '']) });
  else if (abilities.length > 1) parts.push({ key: 'ability', label: t('Ability that gets +1'), n: 1, options: abilities.map((a) => [a, '']) });
  const prof = proficiencies(b);
  const st = skillState(b);
  const known = new Set([...Object.keys(st.granted), ...st.chosen, ...pickedSkills(b)]);
  const spells = (test) => SPELLS.filter(test).map((s) => [s.n, s.d || '']);
  const magic = /^Magic Initiate: (\w+)$/.exec(name);
  if (name === 'Skilled') parts.push({ label: t('Skills'), n: 3, options: ALL_SKILLS.filter((x) => !known.has(x)).map((x) => [x, '']) });
  if (name === 'Weapon Master') {
    parts.push({ label: t('Weapon types'), n: 4, options: WEAPON_TYPES.filter((w) => !canUse({ s: 'melee', t: w, c: (ITEMS.find((it) => it.t === w) || {}).c }, prof)).sort().map((w) => [w, '']) });
  }
  if (magic) {
    parts.push({ label: t('{cls} cantrips', { cls: magic[1] }), n: 2, options: spells((s) => s.lv === 0 && (s.cl || []).includes(magic[1])) });
    parts.push({ label: t('{cls} level 1 spell', { cls: magic[1] }), n: 1, options: spells((s) => s.lv === 1 && (s.cl || []).includes(magic[1])) });
  }
  if (name === 'Martial Adept') parts.push({ label: t('Manoeuvres'), n: 2, options: (CHOICES.find((c) => c.name === 'Manoeuvre') || { options: [] }).options.map((o) => [o[0], o[1]]) });
  if (name === 'Ritual Caster') parts.push({ label: t('Ritual spells'), n: 2, options: spells((s) => s.ri && (s.cl || []).length) });
  if (FEAT_OPTIONS[name]) {
    parts.push({ label: name === 'Elemental Adept' ? t('Damage type') : t('Cantrip'), n: 1,
      options: FEAT_OPTIONS[name].map((x) => [x, (SPELL_BY_NAME.get(norm(x)) || {}).d || '']) });
  }
  // a build that already has everything a list offers (every weapon type, say) has nothing to pick there
  parts.forEach((p) => { p.n = Math.min(p.n, p.options.length); if (p.min != null) p.min = Math.min(p.min, p.n); });
  return parts.filter((p) => p.options.length);
}
// "Feat: Weapon Master (+1 STR; Longbows, Rapiers, Scimitars, Tridents)"
function featText(name, desc, parts) {
  const bits = [];
  const fixed = featAbilities(name, desc);
  const ability = parts.find((p) => p.key === 'ability');
  if (ability) bits.push(name === 'Ability Improvement' && ability.chosen.length === 1 ? '+2 ' + ability.chosen[0] : ability.chosen.map((a) => '+1 ' + a).join(', '));
  else if (fixed.length === 1) bits.push('+1 ' + fixed[0]);
  parts.filter((p) => p.key !== 'ability').forEach((p) => bits.push(p.chosen.join(', ')));
  return 'Feat: ' + name + (bits.length ? ' (' + bits.join('; ') + ')' : '');
}

// ---------- racial cantrip ----------
// High Elves and High Half-Elves learn one Wizard cantrip at creation.
const raceCantrips = (b) => ([DATA.races[b.creation.race], DATA.subraces[b.creation.subrace]].some((d) => d && (d.features || []).some((f) => f[0] === 'Cantrip'))
  ? SPELLS.filter((s) => s.lv === 0 && (s.cl || []).includes('Wizard')).map((s) => s.n) : []);

// ---------- permanent bonuses ----------
// What a permanent bonus does to the numbers, read from its text: an ability of choice, a named ability,
// an optional extra ("and optionally +1 to Charisma"), or a bonus to every saving throw.
function permanentEffect(p) {
  if (p.fx) return p.fx;
  const fx = { choice: 0, fixed: [], optional: null, saves: 0 };
  const text = p.x || '';
  let m = /\+(\d) to an? (?:chosen )?ability score/i.exec(text);
  if (m) fx.choice = Number(m[1]);
  m = new RegExp('optionally \\+(\\d) to (' + ABILITY_WORDS + ')', 'i').exec(text);
  if (m) fx.optional = { ab: abilityKey(m[2]), n: Number(m[1]) };
  for (const x of text.matchAll(new RegExp('\\+(\\d) (' + ABILITY_WORDS + ')\\b(?! saving)', 'gi'))) fx.fixed.push({ ab: abilityKey(x[2]), n: Number(x[1]) });
  m = /\+(\d) bonus to all Saving Throws/i.exec(text);
  if (m) fx.saves = Number(m[1]);
  p.fx = fx;
  return fx;
}
const changesNumbers = (p) => { const fx = permanentEffect(p); return !!(fx.choice || fx.fixed.length || fx.saves); };
// The bonuses the build plans, up to an act: { abilities: {str: [[n, name]]}, saves: [[name, n]] }.
function permanentBonuses(b, act) {
  const actNum = act ? ACTS.findIndex(([k]) => k === act) + 1 : 3;
  const out = { abilities: Object.fromEntries(ABILITY_KEYS.map((k) => [k, []])), saves: [] };
  PERMANENT.forEach((p) => {
    const mine = (b.permanent || {})[p.n];
    if (!mine || !mine.on || p.a > actNum) return;
    const fx = permanentEffect(p);
    if (fx.choice && mine.ab) out.abilities[mine.ab].push([fx.choice, p.n]);
    fx.fixed.forEach((f) => out.abilities[f.ab].push([f.n, p.n]));
    if (fx.optional && mine.extra) out.abilities[fx.optional.ab].push([fx.optional.n, p.n]);
    if (fx.saves) out.saves.push([p.n, fx.saves]);
  });
  return out;
}
function permanentCard(b) {
  if (!PERMANENT.length) return '';
  const mine = b.permanent || {};
  const planned = PERMANENT.filter((p) => mine[p.n] && mine[p.n].on);
  const open = !!state.ui.permOpen;
  const row = (p) => {
    const i = PERMANENT.indexOf(p);
    const m = mine[p.n];
    const fx = permanentEffect(p);
    return `<div class="perm${m ? ' on' : ''}${m && m.got ? ' got' : ''}">
      <label class="chk"><input type="checkbox" data-perm="on" data-i="${i}"${m ? ' checked' : ''}> <b>${esc(p.n)}</b>${changesNumbers(p) ? ` <i class="perm-tag">${t('changes the numbers')}</i>` : ''}</label>
      <p>${esc(p.x)}</p>
      ${m ? `<div class="perm-opts">
        ${fx.choice ? `<label class="field"><span>${t('Ability it goes to')}</span><select data-perm="ab" data-i="${i}">${opt('', t('— choose —'), m.ab)}${ABILS.map(([k, short]) => opt(k, short, m.ab)).join('')}</select></label>` : ''}
        ${fx.optional ? `<label class="chk"><input type="checkbox" data-perm="extra" data-i="${i}"${m.extra ? ' checked' : ''}> ${t('also +{n} {ab}', { n: fx.optional.n, ab: abilityShort(fx.optional.ab) })}</label>` : ''}
        <label class="chk"><input type="checkbox" data-perm="got" data-i="${i}"${m.got ? ' checked' : ''}> ${t('obtained')}</label>
      </div><p class="muted">${esc(p.h)}</p>` : ''}
    </div>`;
  };
  return `<section class="card">
    <div class="check-head"><h2>${t('Permanent bonuses')}</h2>
      <span>${planned.length ? planned.map((p) => `<span class="chip-s${mine[p.n].got ? ' got' : ''}">${esc(p.n)}</span>`).join('') : `<span class="muted">${t('Rewards that stay with the character for the whole game, such as the +1 ability from Auntie Ethel.')}</span>`}</span>
      <button class="btn tiny" data-act="perm-toggle">${open ? t('Hide') : t('Choose')}</button></div>
    ${open ? ACTS.map(([, label], ai) => `<h3 class="group">${t(label)}</h3><div class="perms">${PERMANENT.filter((p) => p.a === ai + 1).map(row).join('')}</div>`).join('')
      + `<p class="muted">${t('Tick what this build plans to get. The ones that change an ability or the saving throws enter Final numbers from their act on; the rest are a checklist. Until ticked as obtained they also show in the party route.')}</p>` : ''}
  </section>`;
}
document.addEventListener('change', (e) => {
  const el = e.target;
  const b = curBuild();
  if (!el.dataset || !el.dataset.perm || !b) return;
  const p = PERMANENT[+el.dataset.i];
  const kind = el.dataset.perm;
  if (kind === 'on') { if (el.checked) b.permanent[p.n] = { on: true, ab: '', extra: false, got: false }; else delete b.permanent[p.n]; }
  else if (b.permanent[p.n]) b.permanent[p.n][kind] = kind === 'ab' ? el.value : el.checked;
  save();
  render();
});

Object.assign(actions, {
  'perm-toggle'() { state.ui.permOpen = !state.ui.permOpen; },
  'choice-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const x = levelInfo(b)[level];
    const group = CHOICES[+el.dataset.g];
    const merged = classChoices(b, x.cls).find((g) => g.name === group.name) || group;
    const taken = chosenOf(b, x.cls, merged);
    const part = { label: t('Choose {n}', { n: group.at[x.n] }), n: group.at[x.n], min: 1, off: group.repeat ? [] : taken,
      options: group.options.filter((o) => !o[2] || o[2] <= x.n).map((o) => [o[0], o[1]]) };
    openChooser(group.name, t('{cls} level {n} · {have} of {need} chosen so far', { cls: x.cls, n: x.n, have: taken.length, need: merged.need }), [part], (parts) => {
      const chosen = parts[0].chosen;
      const lines = group.join ? [group.name + ': ' + chosen.join(group.join)] : chosen.map((name) => group.name + ': ' + name);
      curBuild().levels[level].picks.push(...lines);
      toast(t('Added to level {n}: {x}', { n: level + 1, x: chosen.join(', ') }));
    });
    return false;
  },
  'choose-toggle'(el) {
    const p = dlg.parts[+el.dataset.p];
    const i = p.chosen.indexOf(el.dataset.n);
    if (i >= 0) p.chosen.splice(i, 1);
    else { if (p.chosen.length >= p.n) p.chosen.shift(); p.chosen.push(el.dataset.n); }
    chooserSync();
    return false;
  },
  'choose-confirm'() {
    const done = dlg.done;
    const parts = dlg.parts;
    closeDialog();
    done(parts);
  },
});
