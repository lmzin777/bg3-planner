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
// With `only`, just what that one level says.
function chosenOf(b, cls, group, only) {
  const info = levelInfo(b);
  const prefix = prefixRe(group.name);
  const out = [];
  b.levels.forEach((l, i) => {
    if (info[i].cls !== cls || (only != null && i !== only)) return;
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

// ---------- the choices of a level, as selects ----------
// A level shows one select for each thing it lets the build choose: its guided choices, its feat, its Expertise.
// The lines of the level those selects stand for ("Fighting Style: Archery") are not shown as text; a line beyond
// what the level grants stays as text, to be removed by hand.
// { choices: [{ c, lines: [index], entries: [{ value, note, raw }] }], feat: { j, name, rest } | null,
//   expertise: { j, values } | null, owned: Set of line indexes }
function levelSlots(b, i) {
  const l = b.levels[i];
  const x = levelInfo(b)[i];
  const out = { choices: [], feat: null, expertise: null, owned: new Set() };
  if (!l.cls) return out;
  levelChoices(x).forEach((c) => {
    const g = c.group;
    const prefix = prefixRe(g.name);
    const slot = { c, lines: [], entries: [] };
    l.picks.forEach((p, j) => {
      const text = p.trim();
      if (out.owned.has(j) || slot.entries.length >= c.n) return;
      const bare = !g.join && g.options.find((o) => norm(o[0]) === norm(text.replace(/\(.*$/, '')));
      if (!prefix.test(text) && !bare) return;
      out.owned.add(j);
      slot.lines.push(j);
      if (bare && !prefix.test(text)) { slot.entries.push({ value: bare[0], note: '', raw: p }); return; }
      const rest = text.replace(prefix, '').trim();
      const named = g.options.map((o) => [o[0], rest.search(namesRe(o[0]))]).filter((y) => y[1] >= 0).sort((p1, p2) => p1[1] - p2[1]).map((y) => y[0]);
      if (g.join && named.length) named.forEach((value) => slot.entries.push({ value, note: '' }));
      else slot.entries.push({ value: named[0] || '', note: named[0] ? rest.replace(new RegExp(escRe(named[0]), 'i'), '').replace(/^[\s:,;-]+/, '').trim() : rest, raw: p });
    });
    out.choices.push(slot);
  });
  if (grantsFeat(x)) {
    const j = l.picks.findIndex((p, k) => !out.owned.has(k) && /^feats?\s*:/i.test(p.trim()));
    out.feat = { j, name: '', rest: '' };
    if (j >= 0) {
      out.owned.add(j);
      const text = l.picks[j].trim().replace(/^feats?\s*:\s*/i, '');
      const name = FEATS.map((f) => f[0]).filter((n) => new RegExp('^' + escRe(n) + '(?![a-z])', 'i').test(text)).sort((p, q) => q.length - p.length)[0];
      Object.assign(out.feat, { name: name || '', rest: name ? text.slice(name.length).trim() : text });
    }
  }
  if (grantsExpertise(x)) {
    const j = l.picks.findIndex((p, k) => !out.owned.has(k) && /^expertise\b/i.test(p.trim()));
    out.expertise = { j, values: [] };
    if (j >= 0) {
      out.owned.add(j);
      l.picks[j].trim().replace(/^expertise\s*:?\s*/i, '').split(/\s*(?:\+|,|&|\band\b)\s*/i).forEach((s) => {
        const skill = ALL_SKILLS.find((k) => norm(k) === norm(s));
        if (skill && !out.expertise.values.includes(skill)) out.expertise.values.push(skill);
      });
    }
  }
  // the cantrips and spells the level teaches, and the one known spell a level up may swap for another
  const learn = spellsAtLevel(x);
  if (learn && (learn.cantrips || learn.spells || learn.replace) && SPELLS.some((s) => (s.cl || []).includes(learn.list))) {
    const sp = out.spells = { learn, cantrip: [], spell: [], lines: { cantrip: [], spell: [] }, swap: learn.replace ? { j: -1, old: '', name: '' } : null };
    l.picks.forEach((p, j) => {
      const m = out.owned.has(j) ? null : /^(spell|cantrip)s?\s*:\s*([^(]+?)\s*(?:\((.*)\))?\s*$/i.exec(p.trim());
      if (!m) return;
      const known = SPELL_BY_NAME.get(norm(m[2]));
      const name = known ? known.n : m[2].trim();
      const rep = /replaces\s+(.+)/i.exec(m[3] || '');
      if (rep) {
        if (sp.swap && sp.swap.j < 0) { Object.assign(sp.swap, { j, old: rep[1].trim(), name }); out.owned.add(j); }
        return;
      }
      const kind = (known ? !known.lv : /^cantrip/i.test(m[1])) ? 'cantrip' : 'spell';
      if (sp[kind].length >= (kind === 'cantrip' ? learn.cantrips : learn.spells)) return;
      sp[kind].push(name);
      sp.lines[kind].push(j);
      out.owned.add(j);
    });
  }
  return out;
}
// The part of an option's description that matters to the build: the sentences that say what it gives.
// A sentence of pure flavour is left out when there is something concrete to show; the tooltip keeps it all.
const GAIN_WORDS = /\b(?:gains?|proficien\w*|expertise|resistan\w*|(?:dis)?advantage|bonus|cantrips?|learn\w*|immun\w*|damage|saving throws?|armour class|attack rolls?|hit points?|darkvision|movement|speed|actions?|can(?:'t|not)?|once per|recharge\w*)\b|[+-]\s?\d|\dd\d|\d\s?m\b/i;
function gainText(desc) {
  const parts = String(desc || '').split(/(?<=[.;])\s+/).map((s) => s.trim()).filter(Boolean);
  const gains = parts.filter((s) => GAIN_WORDS.test(s));
  return gains.length && gains.length < parts.length ? gains.join(' ') : parts.join(' ');
}
// A choice shown as a button: what is chosen, with its picture, and a caret. `act` opens the list of options.
const slotButton = (act, attrs, value, img, empty) => `<button class="pslot" data-act="${act}"${attrs ? ' ' + attrs : ''}>${img || ''}<b>${
  value ? esc(value) : empty || t('— choose —')}</b><i>▾</i></button>`;
// A spell as a row of a list of options: name, description, facts, picture and, when asked, its level as heading.
const spellRow = (s, grouped) => [s.n, s.d || '', spellMeta(s), pic(s.i, 'pic small'), grouped && s.lv ? t('Level {n}', { n: s.lv }) : ''];
// The cantrip a High Elf or High Half-Elf picks at creation, as a slot with its picture and what it does.
function raceCantripField(b) {
  if (!raceCantrips(b).length) return '';
  const name = b.creation.cantrip;
  const s = SPELL_BY_NAME.get(norm(name));
  return `<div class="lslot race-cantrip${name ? '' : ' open'}"><span class="lslot-l">${t('Racial cantrip')}</span>${
    slotButton('race-cantrip-open', '', name, s ? pic(s.i, 'pic small') : '')}${s ? `<small>${esc([spellMeta(s), s.d].filter(Boolean).join(' — '))}</small>` : ''}</div>`;
}
const spellMeta = (s) => [s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip'), s.sc, s.rg, s.du, s.dm, s.co ? t('Concentration') : ''].filter(Boolean).join(' · ');
// The spells a level may pick from, by name within each spell level: { cantrips, reach (spells up to the level it
// can cast), school (those of the subclass's schools), bound (how many picks are held to the schools), order }.
// Spells the class already knows elsewhere are left out, so nothing is learned twice.
function levelSpellLists(b, i, sp) {
  const x = levelInfo(b)[i];
  const learn = sp.learn;
  const sub = subLabel(x.sub);
  const max = maxSpellLevel(b, i);
  const every = levelGains(x).some((g) => /magical secrets/i.test(g));  // Magical Secrets takes spells from every class
  const arcanum = levelGains(x).some((g) => /mystic arcanum/i.test(g));  // the spell a Warlock learns at 11 is a level 6 one
  const here = new Set([...sp.cantrip, ...sp.spell, sp.swap ? sp.swap.name : ''].map(norm));
  // known through the class, or through the race, a bonus cantrip or a feat (those carry no class)
  const known = new Set(currentSpells(b).filter((y) => y.cls === x.cls || !y.cls).map((y) => norm(y.name)));
  const pool = SPELLS.filter((s) => (every ? (s.cl || []).length : (s.cl || []).includes(learn.list) || (s.lr || []).some(([who]) => who === sub))
    && (here.has(norm(s.n)) || !known.has(norm(s.n)))).sort((p, q) => p.lv - q.lv || p.n.localeCompare(q.n));
  const reach = pool.filter((s) => (arcanum ? s.lv === 6 : s.lv && (max <= 0 || s.lv <= max)));
  const inSchool = (s) => !learn.schools || learn.schools.includes(s.sc);
  const off = (name) => { const s = SPELL_BY_NAME.get(norm(name)); return s && !inSchool(s) ? 1 : 0; };
  return { arcanum, cantrips: pool.filter((s) => !s.lv), reach, school: reach.filter(inSchool), bound: learn.schools ? learn.spells - (learn.any || 0) : learn.spells,
    // Eldritch Knights and Arcane Tricksters: spells of their schools first, the free picks last
    order: (names) => (learn.schools ? names.slice().sort((p, q) => off(p) - off(q)) : names) };
}
// The choices of a level, as cells of a grid. An empty one is marked in gold.
function slotCells(b, i, slots) {
  const x = levelInfo(b)[i];
  // every choice looks the same: what is chosen, on a button that opens the list of options
  const button = (act, attrs, value, img, empty) => slotButton(act, `data-l="${i}"${attrs ? ' ' + attrs : ''}`, value, img, empty);
  // under the button, what the chosen option gives; the tooltip has its whole description
  const cell = (label, control, text, open, full) => `<div class="lslot${open ? ' open' : ''}"><span class="lslot-l">${esc(label)}</span>${control}${
    text ? `<small${full && full !== text ? ` title="${esc(full)}"` : ''}>${esc(text)}</small>` : ''}</div>`;
  const out = [];
  slots.choices.forEach(({ c, entries }) => {
    const g = c.group;
    for (let k = 0; k < c.n; k++) {
      const e = entries[k] || { value: '', note: '' };
      const o = g.options.find((y) => y[0] === e.value);
      const spell = SPELL_BY_NAME.get(norm(e.value));  // a bonus cantrip shows its picture like any other spell
      out.push(cell(g.name + (c.n > 1 ? ' ' + (k + 1) : ''), button('choice-open', `data-g="${c.i}"`, e.value, spell ? pic(spell.i, 'pic small') : ''),
        [e.note, o && gainText(o[1])].filter(Boolean).join(' · '), !e.value, o ? o[1] : ''));
    }
  });
  if (slots.feat) {
    const f = slots.feat;
    const feat = FEATS.find(([n]) => n === f.name);
    const hasParts = feat && featParts(feat[0], feat[1], b).length;
    out.push(cell(t('Feat'), `<span class="lslot-row">${button('feat-open', '', f.name || f.rest)}${
      hasParts ? `<button class="btn tiny${f.rest ? '' : ' gold'}" data-act="feat-options" data-l="${i}">${t('options')}</button>` : ''}</span>`,
      feat ? [f.rest, feat[1]].filter(Boolean).join(' · ') : '', !f.name && !f.rest));
  }
  if (slots.expertise) {
    const mine = slots.expertise.values;
    const lacking = expertiseOptions(b, mine).length < 2;
    for (let k = 0; k < 2; k++) {
      out.push(cell('Expertise ' + (k + 1), button('expertise-open', '', mine[k] || ''),
        lacking ? t('Only skills the build is proficient in. Choose them in Character creation first.') : '', !mine[k]));
    }
  }
  if (slots.spells) {
    const sp = slots.spells;
    const learn = sp.learn;
    const lists = levelSpellLists(b, i, sp);
    const about = (name) => { const s = SPELL_BY_NAME.get(norm(name)); return s ? [spellMeta(s), s.d].filter(Boolean).join(' — ') : ''; };
    const image = (name) => { const s = SPELL_BY_NAME.get(norm(name)); return s ? pic(s.i, 'pic small') : ''; };
    const spellCell = (label, kind, value) => cell(label, button('spells-open', `data-k="${kind}"`, value, image(value)), about(value), !value);
    for (let k = 0; k < learn.cantrips; k++) out.push(spellCell('Cantrip' + (learn.cantrips > 1 ? ' ' + (k + 1) : ''), 'cantrip', sp.cantrip[k] || ''));
    const chosen = lists.order(sp.spell);
    for (let k = 0; k < learn.spells; k++) {
      out.push(spellCell((lists.arcanum ? 'Mystic Arcanum' : 'Spell') + (learn.spells > 1 ? ' ' + (k + 1) : '') + (learn.schools ? ' · ' + (k >= lists.bound ? t('any school') : learn.schools.join(' / ')) : ''), 'spell', chosen[k] || ''));
    }
    if (sp.swap && swapOlds(b, i, sp).length) {
      out.push(cell(t('Replace a known spell (optional)'),
        button('swap-open', '', sp.swap.name ? sp.swap.old + ' → ' + sp.swap.name : '', image(sp.swap.name), t('— no swap —')), about(sp.swap.name), false));
    }
  }
  return out.join('');
}
// The skills a level may take Expertise in: the ones the build is proficient in and has no Expertise in yet.
function expertiseOptions(b, mine) {
  const st = skillState(b);
  const picked = pickedSkills(b);
  const have = expertiseSkills(b);
  return ALL_SKILLS.filter((s) => (st.granted[s] || st.chosen.includes(s) || picked.has(s)) && (mine.includes(s) || !have.has(s)));
}
// The spells of the class learned before this level and still known: the ones a level up may swap out.
function swapOlds(b, i, sp) {
  const cls = levelInfo(b)[i].cls;
  const olds = currentSpells(b).filter((y) => y.cls === cls && !y.cantrip && y.level < i).map((y) => y.name);
  if (sp.swap.old && !olds.includes(sp.swap.old)) olds.unshift(sp.swap.old);
  return olds;
}
// Writes what was chosen for one choice of a level back into its lines. `values` are the names chosen.
function writeSlot(b, i, kind, values, g) {
  const l = b.levels[i];
  const slots = levelSlots(b, i);
  const put = (lines, fresh) => {
    const at = lines.length ? Math.min(...lines) : l.picks.length;
    lines.slice().sort((p, q) => q - p).forEach((j) => l.picks.splice(j, 1));
    l.picks.splice(at, 0, ...fresh);
  };
  if (kind === 'choice') {
    const slot = slots.choices.find((s) => s.c.i === g);
    if (!slot) return;
    const group = slot.c.group;
    const vals = values.map((v, k) => [v, k]).filter(([v, k]) => v && (group.repeat || values.indexOf(v) === k));
    put(slot.lines, group.join ? (vals.length ? [group.name + ': ' + vals.map((y) => y[0]).join(group.join)] : [])
      // a choice left as it was keeps its line, with whatever was noted on it
      : vals.map(([v]) => { const e = slot.entries.find((y) => y.value === v && y.raw); return e ? e.raw : group.name + ': ' + v; }));
  } else if (kind === 'feat' && slots.feat) {
    const feat = FEATS.find(([n]) => n === values[0]);
    put(slots.feat.j >= 0 ? [slots.feat.j] : [], feat ? [featParts(feat[0], feat[1], b).length ? 'Feat: ' + feat[0] : featText(feat[0], feat[1], [])] : []);
  } else if (kind === 'expertise' && slots.expertise) {
    const vals = [...new Set(values.filter(Boolean))];
    put(slots.expertise.j >= 0 ? [slots.expertise.j] : [], vals.length ? ['Expertise: ' + vals.join(' + ')] : []);
  } else if ((kind === 'cantrip' || kind === 'spell') && slots.spells) {
    put(slots.spells.lines[kind], [...new Set(values.filter(Boolean))].map((v) => (kind === 'cantrip' ? 'Cantrip: ' : 'Spell: ') + v));
  } else if (kind === 'swap' && slots.spells && slots.spells.swap) {
    // values: the known spell to forget, and the one learned in its place
    put(slots.spells.swap.j >= 0 ? [slots.spells.swap.j] : [], values[0] && values[1] ? ['Spell: ' + values[1] + ' (replaces ' + values[0] + ')'] : []);
  }
}
// The choices inside the feat of a level (which ability, which skills…), written into its line when confirmed.
function openFeatOptions(level) {
  const b = curBuild();
  const f = levelSlots(b, level).feat;
  const feat = f && FEATS.find(([n]) => n === f.name);
  if (!feat) return;
  // what this feat already chose must not count as taken while choosing again
  const probe = clone(b);
  probe.levels[level].picks[f.j] = 'Feat: ' + feat[0];
  const parts = featParts(feat[0], feat[1], probe);
  if (!parts.length) return;
  openChooser(feat[0], esc(feat[1]), parts, (done) => {
    const now = curBuild();
    const cur = levelSlots(now, level).feat;
    const text = featText(feat[0], feat[1], done);
    if (cur && cur.j >= 0) now.levels[level].picks[cur.j] = text; else now.levels[level].picks.push(text);
  });
}
// ---------- one source of truth ----------
// Every number reads the lines of the levels, so a line must be a choice its level really grants. Whatever is
// not (left behind by a change of class, written by an older version) is first offered a place in another level
// of the same class that has room for it — the choices follow the class when its levels shift — and otherwise
// becomes a note of the level: shown, never counted.
const featsTaken = (b) => b.levels.map((l, level) => ({ level, name: (levelSlots(b, level).feat || {}).name || '' })).filter((y) => y.name);
function placeLine(b, x) {
  const info = levelInfo(b);
  const text = x.text;
  const levelsOf = (cls) => info.map((y, k) => k).filter((k) => info[k].cls === cls);
  const m = /^(?:prepared\s+)?(spell|cantrip)s?\s*:\s*([^(]+?)\s*(?:\((.*)\))?\s*$/i.exec(text);
  if (m) {
    const s = SPELL_BY_NAME.get(norm(m[2]));
    // a line with an alternative or a remark ("… (optional)") is a note, not a decision
    if (!s || !x.cls || m[3]) return false;
    if (currentSpells(b).some((y) => y.cls === x.cls && norm(y.name) === norm(s.n))) return true;  // known already: nothing to add
    const kind = s.lv ? 'spell' : 'cantrip';
    const j = levelsOf(x.cls).find((k) => {
      const sp = levelSlots(b, k).spells;
      if (!sp || sp[kind].length >= (s.lv ? sp.learn.spells : sp.learn.cantrips)) return false;
      const lists = levelSpellLists(b, k, sp);
      return (s.lv ? lists.reach : lists.cantrips).some((y) => y.n === s.n);
    });
    if (j != null) { b.levels[j].picks.push((s.lv ? 'Spell: ' : 'Cantrip: ') + s.n); return true; }
    if (!s.lv || !PREPARES.includes(x.cls)) return false;
    // a class that prepares does not learn spells level by level: the line was a spell it plans to keep ready
    if (!(x.cls === 'Wizard' ? scrollOptions(b) : preparedOptions(b, x.cls)).some((y) => y.n === s.n)) return false;
    if (x.cls === 'Wizard') { if (!b.scrolls.includes(s.n)) b.scrolls.push(s.n); } else { const list = b.prepared[x.cls] || (b.prepared[x.cls] = []); if (!list.includes(s.n)) list.push(s.n); }
    return true;
  }
  let j;
  if (/^feats?\s*:/i.test(text)) {
    const all = info.map((y, k) => k).filter((k) => info[k].cls);
    j = [...all.filter((k) => info[k].cls === x.cls), ...all].find((k) => { const f = levelSlots(b, k).feat; return f && f.j < 0; });
  } else if (/^expertise\b/i.test(text)) {
    j = levelsOf(x.cls).find((k) => { const e = levelSlots(b, k).expertise; return e && e.j < 0; });
  } else {
    const group = CHOICES.find((g) => prefixRe(g.name).test(text));
    if (group) j = levelsOf(x.cls).find((k) => levelSlots(b, k).choices.some((sl) => sl.c.group.name === group.name && sl.entries.length < sl.c.n));
  }
  if (j == null) return false;
  b.levels[j].picks.push(text);
  return true;
}
// Returns how many lines it had to move.
function tidyBuild(b) {
  b.prepared = b.prepared || {};
  b.scrolls = b.scrolls || [];
  const loose = [];
  b.levels.forEach((l, i) => {
    l.notes = l.notes || [];
    if (!l.picks.length) return;
    const owned = levelSlots(b, i).owned;
    if (owned.size === l.picks.length) return;
    l.picks.forEach((p, j) => { if (!owned.has(j) && p.trim()) loose.push({ i, text: p.trim(), cls: l.cls }); });
    l.picks = l.picks.filter((p, j) => owned.has(j));
  });
  // a line that only names what the class gives by itself ("Extra Attack", "Sneak Attack 2d6") says nothing new
  const given = {};
  const automatic = (x) => {
    if (!x.cls) return false;
    const names = given[x.cls] || (given[x.cls] = new Set(levelInfo(b).filter((y) => y.cls === x.cls).flatMap(levelGains).map(norm)));
    const spell = /^(?:prepared\s+)?(?:spell|cantrip)s?\s*:\s*([^(]+?)\s*$/i.exec(x.text);
    if (spell && names.has(norm(spell[1]))) return true;  // a spell the subclass keeps always prepared
    const bare = x.text.replace(/\s+\d+d\d+$/, '');
    return (names.has(norm(bare)) || FEATURES[bare] != null) && !/^(?:feat|spell|cantrip|expertise|subclass|fighting style)s?$/i.test(bare);
  };
  loose.forEach((x) => { if (!placeLine(b, x) && !automatic(x)) b.levels[x.i].notes.push(x.text); });
  // prepared and scroll spells are kept only while they can be prepared or copied
  const levels = classLevels(b);
  Object.keys(b.prepared).forEach((cls) => {
    const ok = levels[cls] && PREPARES.includes(cls) ? new Set(preparedOptions(b, cls).map((s) => s.n)) : new Set();
    b.prepared[cls] = [...new Set(b.prepared[cls])].filter((n) => ok.has(n));
    if (!b.prepared[cls].length) delete b.prepared[cls];
  });
  if (b.scrolls.length) { const ok = new Set(levels.Wizard ? scrollOptions(b).map((s) => s.n) : []); b.scrolls = [...new Set(b.scrolls)].filter((n) => ok.has(n)); }
  return loose.length;
}
const tidyAll = () => (state && state.builds ? state.builds.reduce((n, b) => n + tidyBuild(b), 0) : 0);

// ---------- prepared spells ----------
const bySpellLevel = (p, q) => p.lv - q.lv || p.n.localeCompare(q.n);
// What a preparing class may keep ready: for a Wizard the spells it has learned; for the others any spell of
// their list they have slots for, except the ones the subclass keeps always prepared.
function preparedOptions(b, cls) {
  const info = levelInfo(b);
  const last = info.map((y) => y.cls).lastIndexOf(cls);
  if (last < 0) return [];
  if (cls === 'Wizard') return currentSpells(b).filter((y) => y.cls === 'Wizard' && !y.cantrip).map((y) => SPELL_BY_NAME.get(norm(y.name))).filter(Boolean).sort(bySpellLevel);
  const max = maxSpellLevel(b, last);
  const sub = subLabel(info[last].sub);
  const always = new Set(info.filter((y) => y.cls === cls).flatMap(levelGains).map(norm));
  return SPELLS.filter((s) => s.lv && s.lv <= max && ((s.cl || []).includes(cls) || (s.lr || []).some(([who]) => who === sub)) && !always.has(norm(s.n))).sort(bySpellLevel);
}
// Wizard spells that can be copied from a scroll: of a level the Wizard has slots for, not learned by levelling.
function scrollOptions(b) {
  const last = levelInfo(b).map((y) => y.cls).lastIndexOf('Wizard');
  if (last < 0) return [];
  const max = maxSpellLevel(b, last);
  const learned = new Set(currentSpells(b).filter((y) => y.cls === 'Wizard' && !y.scroll).map((y) => norm(y.name)));
  return SPELLS.filter((s) => s.lv && s.lv <= max && (s.cl || []).includes('Wizard') && !learned.has(norm(s.n))).sort(bySpellLevel);
}
// How many spells the class prepares: its level plus the modifier of its spellcasting ability, at least 1.
const preparedMax = (b, cls) => ((finalStats(b, state.ui.act || 'act1').casting.find((c) => c.cls === cls) || {}).prepared || 0);
// The buttons of the Spellbook card that open those lists.
function preparedSlots(b) {
  const levels = classLevels(b);
  const cell = (label, act, attrs, value, open) => `<div class="lslot${open ? ' open' : ''}"><span class="lslot-l">${label}</span>${slotButton(act, attrs, value)}</div>`;
  return PREPARES.filter((cls) => levels[cls] && preparedOptions(b, cls).length + (cls === 'Wizard' ? scrollOptions(b).length : 0)).map((cls) => {
    const n = ((b.prepared || {})[cls] || []).length;
    return cell(`${cls} · ${t('Prepared spells')}`, 'prepared-open', `data-c="${cls}"`, t('{n} of {max}', { n, max: preparedMax(b, cls) }), !n)
      + (cls === 'Wizard' ? cell(`Wizard · ${t('Learned from scrolls')}`, 'scrolls-open', '', String((b.scrolls || []).length), false) : '');
  }).join('');
}

// ---------- the chooser: a dialog that picks n options out of one or more lists ----------
// dlg.parts = [{ label, n, min, options: [[name, description]], chosen: [], off: [names that cannot be taken] }]
function chooserList() {
  const q = norm(dlg.q);
  return dlg.parts.map((p, i) => {
    // an option is [name, description, facts, picture, group]; the last three are optional
    let group = '';
    const rows = p.options.filter(([n, d]) => !q || norm(n).includes(q) || norm(d).includes(q)).map(([n, d, facts, img, grp]) => {
      const off = (p.off || []).includes(n);
      const head = grp && grp !== group ? `<h5 class="choose-sub">${esc(grp)}</h5>` : '';
      group = grp || group;
      return `${head}<button class="pick-row${off ? ' no' : ''}" data-act="choose-toggle" data-p="${i}" data-n="${esc(n)}"${off ? ' disabled' : ''}>
        ${img || ''}<b>${esc(n)}</b>${off ? `<span><em>${t('already chosen')}</em></span>` : facts ? `<span>${esc(facts)}</span>` : ''}${d ? `<small class="fx">${esc(d)}</small>` : ''}</button>`;
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
      <button class="btn primary" id="choose-ok" data-act="choose-confirm" disabled>${t('Confirm')}</button></div>`, 'picker-box');
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
  const spells = (test) => SPELLS.filter(test).map((s) => spellRow(s));
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
      options: FEAT_OPTIONS[name].map((x) => { const s = SPELL_BY_NAME.get(norm(x)); return s ? spellRow(s) : [x, '']; }) });
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
const raceCantrips = (b) => { const d = [DATA.races[b.creation.race], DATA.subraces[b.creation.subrace]].find((x) => x && x.cantrip);
  return d ? SPELLS.filter((s) => s.lv === 0 && (s.cl || []).includes(d.cantrip)).map((s) => s.n) : []; };

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
  'feat-options'(el) { openFeatOptions(+el.dataset.l); return false; },
  'note-del'(el) { curBuild().levels[+el.dataset.l].notes.splice(+el.dataset.i, 1); },
  'notes-clear'() { curBuild().levels.forEach((l) => { l.notes = []; }); },
  // the spells a class keeps prepared: any of its list, up to its level plus the ability modifier
  'prepared-open'(el) {
    const cls = el.dataset.c;
    const b = curBuild();
    const max = preparedMax(b, cls);
    openChooser(`${cls} · ${t('Prepared spells')}`, cls === 'Wizard' ? t('A Wizard prepares from the spells it has learned.') : t('Spells the subclass keeps always prepared are not listed: they do not use a place.'),
      [{ label: t('Prepared spells'), n: max, min: 0, options: preparedOptions(b, cls).map((s) => spellRow(s, true)), chosen: ((b.prepared || {})[cls] || []).slice(0, max) }],
      (done) => { const now = curBuild(); now.prepared[cls] = done[0].chosen.slice(); });
    return false;
  },
  'scrolls-open'() {
    const b = curBuild();
    const options = scrollOptions(b);
    openChooser(`Wizard · ${t('Learned from scrolls')}`, t('Wizard spells copied from scrolls, on top of the ones learned level by level.'),
      [{ label: t('Learned from scrolls'), n: Math.max(1, options.length), min: 0, options: options.map((s) => spellRow(s, true)), chosen: (b.scrolls || []).slice() }],
      (done) => { curBuild().scrolls = done[0].chosen.slice(); });
    return false;
  },
  // the class of a level: each class with the level it would reach there and what that level gives
  'class-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const cur = b.levels[level].cls;
    const rows = CLASSES.map((c) => {
      const n = b.levels.slice(0, level).filter((y) => y.cls === c).length + 1;
      const gains = ((CLASS_DATA[c] || { levels: {} }).levels[n] || []).join(' · ');
      const multi = n === 1 && level > 0 && CLASS_PROF[c].multi.length ? t('Proficiencies gained') + ': ' + profNames(CLASS_PROF[c].multi) : '';
      return [c, [gains, multi].filter(Boolean).join(' — '), `${c} ${n} · d${HIT_DIE[c]}`];
    });
    openChooser(t('Class for level {n}', { n: level + 1 }), t('Each class shows the level it would reach here and what that level gives.'),
      [{ label: t('Class'), n: 1, min: 0, options: rows, chosen: cur ? [cur] : [] }], (done) => {
        const l = curBuild().levels[level];
        const v = done[0].chosen[0] || '';
        // another class: the subclass and the choices of the one it had no longer apply
        if (l.cls !== v) Object.assign(l, { cls: v, sub: '', picks: [] });
      });
    return false;
  },
  'sub-open'(el) {
    const level = +el.dataset.l;
    const l = curBuild().levels[level];
    const d = CLASS_DATA[l.cls];
    if (!d) return false;
    const rows = Object.keys(d.subclasses).map((name) => [subLabel(name), (d.subclasses[name][d.subclassLevel] || []).join(' · ')]);
    openChooser(`${l.cls} · ${t('Subclass')}`, t('What each subclass gives at {cls} level {n}.', { cls: l.cls, n: d.subclassLevel }),
      [{ label: t('Subclass'), n: 1, min: 0, options: rows, chosen: l.sub ? [l.sub] : [] }], (done) => { curBuild().levels[level].sub = done[0].chosen[0] || ''; });
    return false;
  },
  'race-cantrip-open'() {
    const b = curBuild();
    const rows = raceCantrips(b).map((n) => SPELL_BY_NAME.get(norm(n))).filter(Boolean).map((s) => spellRow(s));
    openChooser(t('Racial cantrip'), '', [{ label: t('Cantrip'), n: 1, min: 0, options: rows, chosen: b.creation.cantrip ? [b.creation.cantrip] : [] }],
      (done) => { curBuild().creation.cantrip = done[0].chosen[0] || ''; });
    return false;
  },
  'elixir-open'() {
    const b = curBuild();
    const rows = CONSUMABLES.filter((c) => c.t === 'Elixir').map((c) => [c.n, c.x || '', elixirAbility(c.n) ? t('changes the numbers') : '', pic(c.i, 'pic small')]);
    openChooser(t('Elixir kept active'), '', [{ label: t('Elixir kept active'), n: 1, min: 0, options: rows, chosen: b.elixir ? [b.elixir] : [] }],
      (done) => { curBuild().elixir = done[0].chosen[0] || ''; });
    return false;
  },
  // a guided choice of a level (fighting style, manoeuvres, invocations…): every pick of it in one list
  'choice-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const info = levelInfo(b);
    const x = info[level];
    const slot = levelSlots(b, level).choices.find((s) => s.c.i === +el.dataset.g);
    if (!slot) return false;
    const g = slot.c.group;
    const mine = slot.entries.map((e) => e.value).filter(Boolean);
    const merged = classChoices(b, x.cls).find((y) => y.name === g.name) || g;
    // what the other levels of the class already took cannot be taken again
    const off = g.repeat ? [] : info.flatMap((y, j) => (j !== level && y.cls === x.cls ? chosenOf(b, x.cls, merged, j) : []));
    openChooser(`${x.cls} ${x.n} · ${g.name}`, '', [{ label: g.name, n: slot.c.n, min: 0, off, chosen: mine.slice(),
      options: g.options.filter((o) => !o[2] || o[2] <= x.n || mine.includes(o[0])).map((o) => {
        const s = SPELL_BY_NAME.get(norm(o[0]));
        return s ? [o[0], o[1] || s.d || '', spellMeta(s), pic(s.i, 'pic small')] : [o[0], o[1]];
      }) }],
    (done) => writeSlot(curBuild(), level, 'choice', done[0].chosen, slot.c.i));
    return false;
  },
  'feat-open'(el) {
    const level = +el.dataset.l;
    const f = levelSlots(curBuild(), level).feat;
    if (!f) return false;
    const off = featsTaken(curBuild()).filter((y) => y.level !== level && y.name !== 'Ability Improvement').map((y) => y.name);
    openChooser(t('Feats'), t('Choose the feat for level {n}.', { n: level + 1 }),
      [{ label: t('Feat'), n: 1, min: 0, off, options: FEATS.map(([n, d]) => [n, d]), chosen: f.name ? [f.name] : [] }], (done) => {
        const name = done[0].chosen[0] || '';
        if (name === f.name) return;
        writeSlot(curBuild(), level, 'feat', [name]);
        if (name) openFeatOptions(level);  // the feat's own choices follow at once
      });
    return false;
  },
  'expertise-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const x = levelInfo(b)[level];
    const ex = levelSlots(b, level).expertise;
    if (!ex) return false;
    const options = expertiseOptions(b, ex.values);
    openChooser(`${x.cls} ${x.n} · Expertise`, options.length < 2 ? t('Only skills the build is proficient in. Choose them in Character creation first.') : esc(featureText('Expertise')),
      [{ label: 'Expertise', n: 2, min: 0, options: options.map((s) => [s, '']), chosen: ex.values.slice() }],
      (done) => writeSlot(curBuild(), level, 'expertise', done[0].chosen));
    return false;
  },
  // a level up may trade one known spell for another: which one goes, which one comes
  'swap-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const x = levelInfo(b)[level];
    const sp = levelSlots(b, level).spells;
    if (!sp || !sp.swap) return false;
    const lists = levelSpellLists(b, level, sp);
    const row = (s) => spellRow(s, true);
    const olds = swapOlds(b, level, sp).map((n) => SPELL_BY_NAME.get(norm(n)) || { n, d: '', lv: 0 });
    openChooser(`${x.cls} ${x.n} · ${t('Replace a known spell (optional)')}`, t('Choose both, or leave both empty to keep every spell.'), [
      { label: t('Spell to forget'), n: 1, min: 0, options: olds.map((s) => (s.lv ? row(s) : [s.n, ''])), chosen: sp.swap.old ? [sp.swap.old] : [] },
      { label: t('Spell to learn instead'), n: 1, min: 0, options: lists.reach.filter((s) => !sp.spell.includes(s.n)).map(row), chosen: sp.swap.name ? [sp.swap.name] : [] },
    ], (done) => writeSlot(curBuild(), level, 'swap', [done[0].chosen[0] || '', done[1].chosen[0] || '']));
    return false;
  },
  // every cantrip and spell of a level is chosen in one list, with what is already chosen marked
  'spells-open'(el) {
    const level = +el.dataset.l;
    const b = curBuild();
    const x = levelInfo(b)[level];
    const sp = levelSlots(b, level).spells;
    if (!sp) return false;
    const learn = sp.learn;
    const lists = levelSpellLists(b, level, sp);
    const part = (key, label, n, list, chosen) => ({ key, label, n, min: 0, options: list.map((s) => spellRow(s, true)), chosen });
    const parts = [];
    if (learn.cantrips) parts.push(part('cantrip', 'Cantrips', learn.cantrips, lists.cantrips, sp.cantrip.slice()));
    const chosen = lists.order(sp.spell);
    if (learn.spells && learn.schools) {
      if (lists.bound) parts.push(part('spell', 'Spells · ' + learn.schools.join(' / '), lists.bound, lists.school, chosen.slice(0, lists.bound)));
      if (learn.any) parts.push(part('spell', 'Spells · ' + t('any school'), learn.any, lists.reach, chosen.slice(lists.bound)));
    } else if (learn.spells) parts.push(part('spell', 'Spells', learn.spells, lists.reach, chosen.slice()));
    if (!parts.length) return false;
    openChooser(`${x.cls} ${x.n} · ${parts.length > 1 || !learn.cantrips ? 'Spells' : 'Cantrips'}`,
      t('Click the ones this level learns; click again to take one back. What the class already knows is not listed.'), parts, (done) => {
        ['cantrip', 'spell'].forEach((kind) => {
          const mine = done.filter((p) => p.key === kind);
          if (mine.length) writeSlot(curBuild(), level, kind, mine.flatMap((p) => p.chosen));
        });
      });
    // start at the list of the slot that was clicked
    const head = $$('#dlg-list .choose-head')[Math.max(0, parts.findIndex((p) => p.key === el.dataset.k))];
    if (head && head !== $('#dlg-list .choose-head')) head.scrollIntoView({ block: 'start' });
    return false;
  },
  'choose-toggle'(el) {
    const p = dlg.parts[+el.dataset.p];
    const i = p.chosen.indexOf(el.dataset.n);
    if (i >= 0) p.chosen.splice(i, 1);
    else { if (p.chosen.length >= p.n) p.chosen.shift(); p.chosen.push(el.dataset.n); }
    chooserSync();
    // one choice out of one list needs no second click
    if (dlg.parts.length === 1 && p.n === 1 && p.chosen.length === 1) return actions['choose-confirm']();
    return false;
  },
  'choose-confirm'() {
    const done = dlg.done;
    const parts = dlg.parts;
    closeDialog();
    done(parts);
  },
});
