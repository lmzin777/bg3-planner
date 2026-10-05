// The printable sheet used to export a build as PDF.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- PDF sheet ----------
function sheetHtml(b) {
  const c = b.creation;
  const meta = [[t('Origin'), c.origin], [t('Race'), raceText(c)], [t('Background'), c.background], [t('Skills'), c.skills], [t('Racial cantrip'), c.cantrip || ''],
    [t('From background'), (BACKGROUNDS[c.background] || []).join(', ')], [t('Party role'), b.role]]
    .filter((x) => String(x[1]).trim())
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  const traits = [DATA.races[c.race], DATA.subraces[c.subrace]].flatMap((d) => (d && d.features) || [])
    .map(([n, text]) => `<li><b>${esc(n)}</b> — ${esc(text)}</li>`).join('');
  const abils = ABILS.map(([ab, short]) => {
    const f = finalOf(b, ab);
    const bonus = bonusOf(b, ab);
    return `<div class="sh-abil"><span>${short}</span><b>${f}</b><i>${modText(f)}</i><small>${bonus ? `${t('base')} ${f - bonus} +${bonus}` : '&nbsp;'}</small></div>`;
  }).join('');
  // the numbers use the gear of the last act that has any
  const lastAct = ACTS.map(([k]) => k).reverse().find((k) => SLOTS.some(([sk]) => b.gear[k].slots[sk].name.trim())) || 'act3';
  const fin = finalStats(b, lastAct);
  const signedParts = (total, parts) => signed(total) + (parts.length > 1 ? ' (' + partsText(parts) + ')' : '');
  const numbers = fin.level ? `<section><h2>${t('Final numbers')} <small>${t('with the gear of {act}', { act: t(ACTS.find(([k]) => k === lastAct)[1]) })}</small></h2>
      <dl class="sh-meta">${[[t('Level'), fin.level], [t('Proficiency bonus'), signed(fin.pb)], [t('Hit points'), fin.hp], [t('Initiative'), signed(fin.initiative)],
        ...ACTS.map(([k, l]) => [t('AC · {act}', { act: t(l) }), fin.ac[k]]), [t('Abilities'), ABILS.map(([ab, short]) => fin.scores[ab] + ' ' + short).join(' · ')],
        [t('Saving throws'), fin.saves.map((k) => k.short + ' ' + signed(k.bonus) + (k.proficient ? '●' : '')).join(' · ')],
        ...(b.elixir ? [[t('Elixir kept active'), esc(b.elixir)]] : []),
        ...(PERMANENT.some((p) => (b.permanent || {})[p.n]) ? [[t('Permanent bonuses'), PERMANENT.filter((p) => (b.permanent || {})[p.n]).map((p) => esc(p.n)
          + (b.permanent[p.n].ab ? ' (' + abilityShort(b.permanent[p.n].ab) + ')' : '') + (b.permanent[p.n].got ? ' ✓' : '')).join(' · ')]] : []),
        ...fin.attacks.rows.map((r) => [esc(r.name), t('Attack') + ' ' + signedParts(r.attackTotal, r.attack) + ' · ' + t('Damage') + ' ' + esc(damageText(r)) + ' ' + esc(r.type)]),
        ...fin.casting.map((c) => [esc(c.label) + ' (' + abilityShort(c.ability) + ')', t('Spell save DC') + ' ' + c.dc + ' · ' + t('Spell attack') + ' ' + signed(c.attack)]),
        ...(fin.slots.length ? [[t('Spell slots'), fin.slots.map((n, i) => t('Level {n}', { n: i + 1 }) + ' ×' + n).join(' · ')]] : []),
        ...(fin.pact ? [[t('Pact Magic slots'), t('{n} of level {lv}, back on a Short Rest', { n: fin.pact.n, lv: fin.pact.level })]] : []),
        ...(fin.resources.length ? [[t('Class resources'), fin.resources.map(([n, v]) => esc(n) + ' ' + esc(v)).join(' · ')]] : [])]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="sh-skills">${fin.skills.map((k) => `<span class="${k.proficient ? 'prof' : ''}">${esc(k.name)} <b>${signed(k.bonus)}</b>${k.expert ? '★' : ''}</span>`).join(' · ')}</p></section>` : '';
  const known = allSpells(b, lastAct, fin);
  const spells = known.length ? `<section><h2>${t('Spells')}</h2><ul>${known.map((s) => `<li><b>${esc(s.n)}</b> — ${s.lv ? t('Level {n}', { n: s.lv }) : t('Cantrip')}${
    [s.rg, s.du, spellDmg(s), s.co ? t('Concentration') : ''].filter(Boolean).map((x) => ' · ' + esc(x)).join('')}. ${esc(s.d || '')}</li>`).join('')}</ul></section>` : '';
  const count = {};
  const linfo = levelInfo(b);
  const levels = b.levels.map((l, i) => {
    if (l.cls) count[l.cls] = (count[l.cls] || 0) + 1;
    const picks = l.picks.filter((p) => p.trim()).map(esc).join(' · ');
    if (!l.cls && !picks) return '';
    const gains = [...levelGains(linfo[i]), ...levelNumbers(linfo[i])].map(esc).join(' · ');
    return `<tr><td class="n">${i + 1}</td><td class="cls">${l.cls ? esc(l.cls) + ' ' + count[l.cls] : '—'}${l.sub.trim() ? `<b>${esc(l.sub)}</b>` : ''}</td><td>${picks}${gains ? `<div class="sh-gains">${gains}</div>` : ''}</td></tr>`;
  }).join('');
  const acts = ACTS.map(([k, label]) => {
    const g = b.gear[k];
    const rows = SLOTS.filter(([sk]) => g.slots[sk].name.trim()).map(([sk, sl]) => {
      const x = g.slots[sk];
      const known = ITEM_BY_NAME.get(norm(x.name));
      return `<tr><td class="slot-n">${t(sl)}</td><td class="it r-${esc(x.rarity)}">${known && known.i ? pic(known.i, 'pic small') : ''}${x.got ? '<span class="tick">✓</span> ' : ''}${esc(x.name)}</td><td>${esc(x.where)}</td><td>${esc(x.note)}</td></tr>`;
    }).join('');
    const alts = g.alts.filter((a) => a.name.trim()).map((a) =>
      `<li><b>${t(SLOT_LABEL[a.slot] || '')}:</b> ${esc(a.name)}${a.where.trim() ? ' — ' + esc(a.where) : ''}${a.note.trim() ? ` <i>(${esc(a.note)})</i>` : ''}</li>`).join('');
    if (!rows && !alts) return '';
    return `<section class="sh-act"><h2>${t('Gear · {act}', { act: t(label) })}</h2>
      ${rows ? `<table><thead><tr><th>${t('Slot')}</th><th>${t('Item')}</th><th>${t('Where to find')}</th><th>${t('Note')}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      ${alts ? `<h3>${t('Alternatives')}</h3><ul>${alts}</ul>` : ''}</section>`;
  }).join('');
  const list = (title, arr) => {
    const li = arr.filter((x) => x.name.trim()).map((x) => `<li><b>${esc(x.name)}</b>${x.note.trim() ? ' — ' + esc(x.note) : ''}</li>`).join('');
    return li ? `<section><h2>${title}</h2><ul>${li}</ul></section>` : '';
  };
  const block = (title, text) => (text.trim() ? `<section><h2>${title}</h2><p class="pre">${esc(text.trim())}</p></section>` : '');
  return `<header class="sh-head">
      <h1>${esc(b.name || t('Unnamed'))}</h1>
      <p class="sh-split">${esc(splitText(b))}</p>
      ${b.summary.trim() ? `<p class="pre">${esc(b.summary.trim())}</p>` : ''}
      ${b.source.trim() ? `<p class="sh-src">${t('Reference: {x}', { x: esc(b.source.trim()) })}</p>` : ''}
    </header>
    <section><h2>${t('Character creation')}</h2>
      ${meta ? `<dl class="sh-meta">${meta}</dl>` : ''}
      <div class="sh-abils">${abils}</div>
      ${traits ? `<h3>${t('Race features')}</h3><ul>${traits}</ul>` : ''}</section>
    ${levels ? `<section><h2>${t('Level progression')}</h2><table class="sh-levels"><tbody>${levels}</tbody></table></section>` : ''}
    ${numbers}${spells}
    ${acts}
    <div class="sh-two">${list(t('Setup items'), b.setup)}${list(t('Consumables'), b.consumables)}</div>
    ${block(t('Variants'), b.variants)}
    ${block(t('Notes and tricks'), b.notes)}
    <footer class="sh-foot">${b.credit ? t('Based on: {x}', { x: esc(b.credit) }) + ' · ' : ''}BG3 Planner</footer>`;
}
function closeSheet() {
  $('#sheet-wrap').hidden = true;
  document.body.classList.remove('sheet-open');
}
const closeExport = () => { $('#export-modal').hidden = true; };
document.addEventListener('keydown', (e) => {
  const search = $('.lib-search');
  if (e.key === '/' && search && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    search.focus();
    search.select();
    return;
  }
  if (e.key !== 'Escape') return;
  if (!$('#picker').hidden) closePicker();
  else if (!$('#export-modal').hidden) closeExport();
  else if (!$('#sheet-wrap').hidden) closeSheet();
});
$('#export-modal').addEventListener('click', (e) => { if (e.target.id === 'export-modal') closeExport(); });
