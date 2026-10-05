// The spellbook: everything the character can cast, in one place — what each class chose, what a subclass
// keeps always prepared, what the race, the feats and the gear of the act grant — with the ability each
// group casts with, its spell save DC and its spell attack bonus.
'use strict';

// Ability of the classes that have one for spells (the wiki's Spells page lists Monk and Barbarian too).
const CLASS_CAST = Object.assign({ Monk: 'wis', Barbarian: 'cha' }, CAST_ABILITY);
// Spells from items, scrolls and most feats use the ability of the class the character most recently took a
// first level in; a fighter or rogue without a casting subclass does not change it. Intelligence by default.
function itemCastAbility(b) {
  const info = levelInfo(b);
  const seen = new Set();
  let ability = 'int';
  info.forEach((x) => {
    if (!x.cls || seen.has(x.cls)) return;
    seen.add(x.cls);
    const sub = (info.find((y) => y.cls === x.cls && y.sub) || {}).sub;
    const own = CLASS_CAST[x.cls] || CAST_SUBCLASS[sub];
    if (own) ability = own;
  });
  return ability;
}

// The spells a class has without choosing them: the ones its subclass lists level by level (domain, oath, circle
// spells). A Warlock's patron only adds its spells to the list to choose from ("Expanded Spell List").
const alwaysPrepared = (b, cls) => (cls === 'Warlock' ? [] : [...new Set(levelInfo(b).filter((x) => x.cls === cls).flatMap(levelGains))].filter((g) => SPELL_BY_NAME.has(norm(g))));
// Groups of spells: [{ title, ability, dc, attack, note, spells: [{ name, sp (the spell record), source }] }].
function spellbook(b, act, stats) {
  const info = levelInfo(b);
  const level = charLevel(b);
  const mods = stats.mods;
  const groups = [];
  const group = (title, ability, note) => {
    let g = groups.find((x) => x.title === title);
    if (!g) {
      const cast = stats.casting.find((c) => c.label === title);
      g = { title, ability, note: note || '', spells: [], dc: cast ? cast.dc : ability ? 8 + stats.pb + mods[ability] : 0, attack: cast ? cast.attack : ability ? stats.pb + mods[ability] : 0 };
      groups.push(g);
    }
    return g;
  };
  const taken = new Set();
  const put = (g, name, source) => {
    const sp = SPELL_BY_NAME.get(norm(name));
    const key = norm(sp ? sp.n : name);
    if (taken.has(g.title + '|' + key)) return;
    taken.add(g.title + '|' + key);
    g.spells.push({ name: sp ? sp.n : name, sp, source });
  };
  const levels = classLevels(b);
  const current = currentSpells(b);
  // 1. each class: what it chose, then what its features keep always prepared
  Object.keys(levels).forEach((cls) => {
    const caster = casters(b).find((c) => c.cls === cls);
    const sub = (info.find((x) => x.cls === cls && x.sub) || {}).sub;
    const title = caster ? caster.label || caster.sub || cls : cls;
    const ability = caster ? caster.ab : CLASS_CAST[cls] || itemCastAbility(b);
    const chosen = current.filter((x) => x.cls === cls);
    const granted = alwaysPrepared(b, cls);
    const bonus = b.levels.filter((l, i) => info[i].cls === cls).flatMap((l) => l.picks).map((p) => /^bonus cantrip\s*:\s*(.+)$/i.exec(p.trim())).filter(Boolean).map((m) => m[1].trim());
    const ready = PREPARES.includes(cls) ? (b.prepared || {})[cls] || [] : [];
    if (!chosen.length && !granted.length && !bonus.length && !ready.length) return;
    const prepared = stats.casting.find((c) => c.label === (caster && (caster.sub || caster.cls)));
    const g = group(caster ? caster.sub || cls : cls, ability, prepared && prepared.prepared ? t('prepares {n} of its spells at a time', { n: prepared.prepared }) : '');
    chosen.forEach((x) => put(g, x.name, (x.scroll ? t('learned from a scroll') : t('chosen')) + (ready.includes(x.name) ? ' · ' + t('prepared') : '')));
    ready.forEach((name) => put(g, name, t('prepared')));
    bonus.forEach((name) => put(g, name, t('bonus cantrip')));
    granted.forEach((name) => put(g, name, t('always prepared · {sub}', { sub: sub ? subLabel(sub) : cls })));
  });
  // 2. the race
  const c = b.creation;
  [[c.race, DATA.races[c.race]], [c.subrace, DATA.subraces[c.subrace]]].forEach(([name, d]) => {
    if (!d) return;
    const ability = d.spellAbility ? abilityKey(d.spellAbility) : d.cantrip ? CAST_ABILITY[d.cantrip] : '';
    (d.spells || []).filter(([, lv]) => lv <= level).forEach(([spell, lv]) => put(group(name, ability), spell, lv > 1 ? t('from level {n}', { n: lv }) : t('racial')));
    if (d.cantrip && c.cantrip) put(group(name, ability), c.cantrip, t('Racial cantrip'));
  });
  // 3. feats
  allPicks(b).forEach((p) => {
    const m = /^feat\s*:\s*([^(]+?)\s*\((.+)\)\s*$/i.exec(p.trim());
    if (!m) return;
    const magic = /^Magic Initiate: (\w+)/i.exec(m[1]);
    m[2].split(/[,;]/).map((x) => x.trim()).filter((x) => SPELL_BY_NAME.has(norm(x)))
      .forEach((name) => put(group(t('Feats'), magic ? CAST_ABILITY[magic[1]] : itemCastAbility(b)), name, m[1]));
  });
  // 4. the gear of the act
  Object.values(wornItems(b, act)).forEach((it) => {
    const names = String(it.sp || '').split(';').map((x) => x.trim().split(': ').pop()).filter((x) => SPELL_BY_NAME.has(norm(x)));
    SPELLS.forEach((s) => { if (s.it && s.it.split(', ').includes(it.n)) names.push(s.n); });
    [...new Set(names)].forEach((name) => put(group(t('Gear'), itemCastAbility(b)), name, it.n));
  });
  groups.forEach((g) => g.spells.sort((x, y) => ((x.sp || {}).lv || 0) - ((y.sp || {}).lv || 0) || x.name.localeCompare(y.name)));
  return groups.filter((g) => g.spells.length);
}
// Every spell of the spellbook once, for the printed sheet.
const allSpells = (b, act, stats) => { const seen = new Set(); return spellbook(b, act, stats).flatMap((g) => g.spells).filter((x) => x.sp && !seen.has(x.sp.n) && seen.add(x.sp.n)).map((x) => x.sp); };

function spellbookCard(b) {
  const at = b.current && b.current < charLevel(b) ? b.current : 0;
  const view = at ? atLevel(b, at) : b;
  if (!charLevel(view)) return '';
  const stats = finalStats(b, state.ui.act, at ? { level: at } : null);
  const groups = spellbook(view, state.ui.act, stats);
  const slots = stats.slots.length ? `<b>${t('Spell slots')}</b> ${stats.slots.map((n, i) => `<span class="slot-n" title="${t('Level {n}', { n: i + 1 })}">${i + 1}<i>×${n}</i></span>`).join('')}` : '';
  const pact = stats.pact ? `<b>${t('Pact Magic slots')}</b> ${t('{n} of level {lv}, back on a Short Rest', { n: stats.pact.n, lv: stats.pact.level })}` : '';
  const row = (x) => {
    const s = x.sp;
    const facts = s ? [s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip'), s.rg, s.du, s.dm, s.co ? t('Concentration') : '', s.ah ? t('Bonus action on a hit') : '', s.rc].filter(Boolean).join(' · ') : '';
    return `<div class="sb-row"${s ? ` title="${esc(s.d || '')}"` : ''}>${s ? pic(s.i, 'pic small') : '<span class="pic small none"></span>'}
      <b>${esc(x.name)}</b><small>${esc(facts)}</small><i>${esc(x.source)}</i></div>`;
  };
  const prep = preparedSlots(b);
  return `<section class="card">
    <h2>${t('Spellbook')}</h2>
    ${prep ? `<div class="lslots prep">${prep}</div>` : ''}
    ${groups.length ? `${slots || pact ? `<p class="points">${[slots, pact].filter(Boolean).join(' · ')}</p>` : ''}
      ${groups.map((g) => `<div class="sb-group"><h3 class="group">${esc(g.title)}${g.ability ? ` <span>${abilityShort(g.ability)} ${signed(stats.mods[g.ability])} · ${t('Spell save DC')} ${g.dc} · ${t('Spell attack')} ${signed(g.attack)}</span>` : ''}</h3>
        ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}<div class="sb-list">${g.spells.map(row).join('')}</div></div>`).join('')}
      <p class="muted">${t('Chosen spells come from the level table; always prepared ones from the subclass; the rest from the race, feats and the gear of the act chosen in Final numbers. Spells from gear and most feats use the ability of the class most recently started.')}</p>`
      : `<p class="muted">${t('No spells yet. Spells chosen in the level table, and the ones the race, subclass, feats and gear grant, show here.')}</p>`}
  </section>`;
}
