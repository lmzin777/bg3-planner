// Home: what the planner is and the ways into it. The page a first visit lands on; the name at the top of the
// page and the first entry of the menu lead back to it.
'use strict';

function renderHome() {
  const cur = curBuild();
  const mine = cur ? [cur, ...state.builds.filter((b) => b !== cur)].slice(0, 4) : [];
  const parties = state.parties.filter((p) => p.members.some((m) => buildById(m.buildId)));
  const cantrips = SPELLS.filter((s) => !s.lv).length;
  const row = (attrs, name, sub) => `<button class="side-item" ${attrs}><strong>${esc(name)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  // one way in: its name (which opens it too), what it is for, what it holds, and the buttons to its parts
  const area = (attrs, title, text, facts, buttons) => `<article class="card home-card">
    <h2><button class="home-title" data-act="tab" ${attrs}>${title}<i>→</i></button></h2>
    <p class="muted">${text}</p>
    <p class="home-facts">${facts.filter(Boolean).map((f) => `<span>${f}</span>`).join('')}</p>
    <div class="row-btns">${buttons}</div></article>`;
  const go = (attrs, label, primary) => `<button class="btn${primary ? ' primary' : ''}" data-act="tab" ${attrs}>${label}</button>`;
  return `<div class="content wide home">
    <section class="card hero home-hero">
      <h1>BG3 <span>Planner</span></h1>
      <p class="lead">${t('Plan a Baldur\'s Gate 3 character from level 1 to 12, put a party of four together, look up every item and spell, and roll a fight before you play it.')}</p>
      <div class="row-btns">
        <button class="btn primary" data-act="wiz-new">${t('+ New build, step by step')}</button>
        ${go('data-tab="presets"', t('Start from a ready-made build'))}
        ${cur ? `<button class="btn" data-act="build-select" data-id="${cur.id}" data-go="builds">${t('Go on with {name}', { name: esc(cur.name || t('Unnamed')) })}</button>` : ''}
      </div>
    </section>
    ${mine.length ? `<section class="card"><h2>${t('Your builds')}</h2>
      <div class="side-list home-list">${mine.map((b) => row(`data-act="build-select" data-id="${b.id}" data-go="builds"`, b.name || t('Unnamed'), splitText(b))).join('')}</div>
      ${state.builds.length > mine.length ? `<p class="muted">${t('And {n} more, in the Build Planner.', { n: state.builds.length - mine.length })}</p>` : ''}</section>` : ''}
    <div class="home-grid">
      ${area('data-tab="hub"', t('Builds'), t('Character creation, the choices of each level, gear by act and the final numbers; four builds side by side as a party; and builds ready to copy.'),
        [t('{n} of yours', { n: state.builds.length }), parties.length ? t('{n} parties', { n: parties.length }) : '', t('{n} ready-made', { n: PRESETS.length })],
        go('data-tab="builds"', t('Build Planner'), true) + go('data-tab="party"', t('Party Planner')) + go('data-tab="presets"', t('Ready-made builds')))}
      ${area('data-tab="items" data-kind=""', t('Items'), t('Every weapon, armour, accessory and consumable of the game, with what it does, its rarity, the act it is found in and where.'),
        [t('{n} items', { n: LIB_ITEMS.length })], go('data-tab="items" data-kind=""', t('Browse the items'), true))}
      ${area('data-tab="spells" data-lv=""', t('Spells'), t('Every cantrip and spell, with its damage, saving throw, range, who learns it and what a higher slot adds.'),
        [t('{n} spells', { n: SPELLS.length - cantrips }), t('{n} cantrips', { n: cantrips })], go('data-tab="spells" data-lv=""', t('Browse the spells'), true))}
      ${area('data-tab="damage"', t('Damage test'), t('Rolls a fight, die by die: a build or a whole party against an enemy of the game, in Balanced, Tactician or Honour mode, round after round or three hundred fights at once.'),
        [t('{n} enemies', { n: ENEMIES.length }), t('3 difficulties')], go('data-tab="damage"', t('Open the Damage test'), true))}
    </div>
    <section class="card home-notes">
      <h2>${t('Good to know')}</h2>
      <ul>
        <li>${t('Everything you do is saved by itself, in this browser only. "Backup", at the top, saves a file with every build and party; "Import" brings one back, here or on another computer.')}</li>
        <li>${t('A build can be sent to someone else as a link or as a short code: "Export", in the Build Planner.')}</li>
        <li>${t('The names of the game (classes, spells, items, conditions) stay in English, as in the game. The rest of the page is in English or in Portuguese: EN / PT-BR, at the top.')}</li>
      </ul>
      ${dataDatesNote()}
    </section>
  </div>`;
}
