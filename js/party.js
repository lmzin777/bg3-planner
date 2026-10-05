// The Party Planner view and the Ready-made builds view.
// The scripts are plain (not modules) so the planner also runs from a file opened directly; they share the global scope.
'use strict';

// ---------- Party Planner ----------
function partyData(p, act) {
  const members = p.members.map((m, i) => ({ i, char: m.char, build: buildById(m.buildId) }));
  const owners = {};
  members.forEach((m) => {
    if (!m.build) return;
    SLOTS.forEach(([k]) => {
      const n = norm(m.build.gear[act].slots[k].name);
      if (n) (owners[n] = owners[n] || new Set()).add(m.i);
    });
  });
  const conflicts = Object.keys(owners).filter((n) => owners[n].size > 1);
  return { members, owners, conflicts };
}
const memberLabel = (m) => (m.char || '').trim() || t('Member {n}', { n: m.i + 1 });

function renderParty() {
  const p = curParty();
  const act = state.ui.partyAct;
  const { members, owners, conflicts } = partyData(p, act);
  const buildOpts = (cur) => opt('', t('— no build —'), cur) + state.builds.map((b) => opt(b.id, b.name || t('Unnamed'), cur)).join('');

  const cards = members.map((m) => {
    const b = m.build;
    return `<div class="member">
      <div class="member-n">${m.i + 1}</div>
      ${field(t('Character'), `members.${m.i}.char`, m.char, t('Who plays this build'), 'list="dl-chars"')}
      <label class="field"><span>${t('Build')}</span><select data-path="members.${m.i}.buildId" data-rerender>${buildOpts(b ? b.id : '')}</select></label>
      ${b ? `<div class="member-info"><div class="split">${esc(splitText(b))}</div>
          <div class="muted">${esc(b.role || t('Role not set'))}</div>
          <div class="abil-line">${esc(abilLine(b))}</div></div>
          <div class="row-btns"><button class="btn primary" data-act="member-open" data-i="${m.i}">${t('Open Build Planner')}</button></div>`
        : `<div class="member-info muted">${t('Pick a saved build or create a new one for this member.')}</div>
          <div class="row-btns"><button class="btn" data-act="member-new" data-i="${m.i}">${t('+ New build')}</button></div>`}
    </div>`;
  }).join('');

  const active = members.filter((m) => m.build);
  const table = active.length
    ? `<div class="table-wrap"><table class="ptable"><thead><tr><th>${t('Slot')}</th>${active.map((m) => `<th data-ml="${m.i}">${esc(memberLabel(m))}</th>`).join('')}</tr></thead>
        <tbody>${SLOTS.map(([k, label]) => `<tr><th>${t(label)}</th>${active.map((m) => {
          const s = m.build.gear[act].slots[k];
          if (!s.name.trim()) return '<td class="nil">—</td>';
          const clash = owners[norm(s.name)].size > 1;
          return `<td class="r-${esc(s.rarity)}${clash ? ' clash' : ''}${s.got ? ' got' : ''}"><span>${esc(s.name)}</span>${clash ? `<em title="${t('Item used by more than one member')}">${t('conflict')}</em>` : ''}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">${t('Assign builds to members to compare their gear side by side.')}</p>`;

  const conflictBox = conflicts.length
    ? `<div class="conflicts"><strong>${t('{n} contested item(s) in this act', { n: conflicts.length })}</strong><ul>${conflicts.map((n) => {
        const who = members.filter((m) => owners[n].has(m.i));
        const name = SLOTS.map(([k]) => who[0].build.gear[act].slots[k].name).find((x) => norm(x) === n);
        return `<li><b>${esc(name)}</b> — ${who.map((m) => esc(memberLabel(m))).join(t(' and '))}</li>`;
      }).join('')}</ul></div>`
    : active.length > 1 ? `<p class="okline">${t('No item is contested between members in this act.')}</p>` : '';

  return `<div class="content wide" data-scope="party">
    <section class="card hero">
      <div class="party-bar">
        <label class="field grow"><span>${t('Party')}</span><select data-change="party-select">${state.parties.map((x) => opt(x.id, x.name || t('Unnamed'), p.id)).join('')}</select></label>
        <button class="btn primary" data-act="party-new">${t('+ New party')}</button>
        <button class="btn" data-act="party-dup">${t('Duplicate')}</button>
        <button class="btn danger" data-act="party-del">${t('Delete')}</button>
      </div>
      <input class="title-input" type="text" data-path="name" value="${esc(p.name)}" placeholder="${t('Party name')}" aria-label="${t('Party name')}">
      <label class="field"><span>${t('Party plan')}</span>
        <textarea data-path="notes" rows="2" placeholder="${t('Who opens combat, who talks to NPCs, who carries what…')}">${esc(p.notes)}</textarea></label>
    </section>

    <div class="members">${cards}</div>

    <section class="card">
      <h2>${t('Party gear')}</h2>
      ${actTabs(act, 'party-act')}
      ${conflictBox}
      ${table}
    </section>

    <section class="card">
      <h2>${t('Item checklist · {act}', { act: t(ACTS.find(([k]) => k === act)[1]) })}</h2>
      ${checklist(active, act)}
    </section>

    ${partyNumbers(members)}
    ${partyRoute(members)}
    ${partySkills(members)}
  </div>`;
}

// Items for the act grouped by location: the text before the first dash in "Location — how".
function checklist(active, act) {
  const groups = {};
  const unknown = t('Location not set');
  active.forEach((m) => SLOTS.forEach(([k, label]) => {
    const s = m.build.gear[act].slots[k];
    if (!s.name.trim()) return;
    const parts = s.where.split(/\s+[—–]\s+/);
    const loc = parts[0].trim() || unknown;
    (groups[loc] = groups[loc] || []).push({ s, k, label, m, how: parts.slice(1).join(' — ') });
  }));
  const locs = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  if (!locs.length) return `<p class="muted">${t('No items listed for this act.')}</p>`;
  const all = locs.flatMap((l) => groups[l]);
  return `<p class="muted">${t('{got} of {total} items obtained. Ticking here also ticks it in the build.', { got: all.filter((x) => x.s.got).length, total: all.length })}</p>
    <div class="check">${locs.map((loc) => `<div class="loc"><h3>${esc(loc)}</h3>${groups[loc].map((x) =>
      `<label class="ck r-${esc(x.s.rarity)}${x.s.got ? ' got' : ''}">
        <input type="checkbox" data-change="got" data-build="${x.m.build.id}" data-slot="${x.k}"${x.s.got ? ' checked' : ''}>
        <span><b>${esc(x.s.name)}</b><small><i data-ml="${x.m.i}">${esc(memberLabel(x.m))}</i> · ${t(x.label)}${x.how ? ' · ' + esc(x.how) : ''}</small></span>
      </label>`).join('')}</div>`).join('')}</div>`;
}

// ---------- Builds: the three pages of the group, side by side ----------
function renderHub() {
  const row = (attrs, name, sub) => `<button class="side-item" ${attrs}><strong>${esc(name)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  const card = (title, text, list, button) => `<article class="card hub-card"><h2>${title}</h2><p class="muted">${text}</p>
    <div class="side-list">${list || `<p class="muted">${t('Nothing here yet.')}</p>`}</div><div class="row-btns">${button}</div></article>`;
  return `<div class="content wide">
    <section class="card hero"><h1>${t('Builds')}</h1><p class="muted">${t('Everything about builds: the ones you make, the parties you put them in, and the ready-made ones to start from.')}</p></section>
    <div class="hub">
      ${card(t('Build Planner'), t('Your builds: character creation, the choices of each level, gear by act and the final numbers.'),
        state.builds.map((b) => row(`data-act="build-select" data-id="${b.id}" data-go="builds"`, b.name || t('Unnamed'), splitText(b))).join(''),
        `<button class="btn primary" data-act="tab" data-tab="builds">${t('Open the Build Planner')}</button><button class="btn" data-act="wiz-new">${t('+ New build, step by step')}</button>`)}
      ${card(t('Party Planner'), t('Four builds side by side: who wears what, who covers which skill, and what is still missing in each act.'),
        state.parties.map((p) => row(`data-act="party-open" data-id="${p.id}"`, p.name || t('Unnamed'), p.members.map((m, i) => memberLabel({ char: m.char, i })).filter((x, i) => p.members[i].buildId || p.members[i].char).join(' · '))).join(''),
        `<button class="btn primary" data-act="tab" data-tab="party">${t('Open the Party Planner')}</button>`)}
      ${card(t('Ready-made builds'), t('Reference builds. "Use as a base" creates a copy in My builds that you can change freely without touching the original.'),
        PRESETS.map((raw) => { const b = normalizeBuild(raw); return row('data-act="tab" data-tab="presets"', b.name, splitText(b)); }).join(''),
        `<button class="btn primary" data-act="tab" data-tab="presets">${t('See ready-made builds')}</button>`)}
    </div>
  </div>`;
}

// ---------- Ready-made builds ----------
function renderPresets() {
  return `<div class="content wide">
    <section class="card hero"><h1>${t('Ready-made builds')}</h1>
      <p class="muted">${t('Reference builds. "Use as a base" creates a copy in My builds that you can change freely without touching the original.')}</p></section>
    <div class="presets">${PRESETS.map((raw, i) => {
      const b = normalizeBuild(raw);
      return `<article class="card preset">
        <h2>${esc(b.name)}</h2>
        <div class="split">${esc(splitText(b))}</div>
        <p>${esc(b.summary)}</p>
        <p class="abil-line">${esc(abilLine(b))}</p>
        ${b.credit ? `<p class="credit">${esc(b.credit)}</p>` : ''}
        <div class="row-btns"><button class="btn primary" data-act="preset-use" data-i="${i}">${t('Use as a base')}</button></div>
      </article>`;
    }).join('')}</div>
  </div>`;
}
