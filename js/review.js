// Things to check by hand: where the wiki did not say enough about an enemy or a rule and the planner filled
// something in or guessed. Each entry can be ticked off and has a field for what was seen in the game; the ticks
// and the notes are kept with the rest of what the browser saves. What comes from the wiki as it is, or is a choice
// of the test with nothing to verify, is kept apart, at the end, and asks for no tick.
// A temporary page, there to be gone through one by one. To take it out: remove this file from index.html, and
// the "review" entries from navHtml() and render() in js/shell.js.
'use strict';

// "2d8 + 5 Slashing · 1d10 + 5 Piercing": one group for each attack of the action.
const hitsText = (hits) => hits.map((h) => h.map(([dice, flat, type]) => [dice, flat ? '+ ' + flat : '', type].filter(Boolean).join(' ')).join(' + ')).filter(Boolean).join(' · ');
// What the planner does not use of an enemy's page, by the reason it is left out: [reason, text, to check].
const UNUSED = [
  ['reaction', 'Reactions the test does not use: {list}.', false],
  ['legendary', 'Legendary Actions of Honour mode the test does not use (no damage or condition it can play, or no hit that sets them off): {list}.', false],
  ['no cost', 'Listed with damage but with no action cost (triggered, passive or special), not used: {list}.', false],
  ['weapon', 'Attacks with a weapon its page does not name, not used: {list}.', true],
  ['no page', 'Actions with no page of their own on the wiki, not used: {list}.', true],
];
// Every entry: { key, title, sub, link, ask: what to check in the game, info: what needs no checking }.
function reviewItems() {
  const numberOf = (a) => (a.k === 'a' ? t('attack bonus {b}', { b: signed(a.b) }) : a.k === 's' ? a.sv.toUpperCase() + ' DC ' + a.dc : t('no roll'));
  const condOf = (a) => (a.cd ? a.cd[0] + ' ' + t('{n} turn(s)', { n: a.cd[1] || 2 }) + (a.cd[2] ? ' (' + a.cd[2].toUpperCase() + ' DC ' + a.cd[3] + ')' : '') : '');
  const parts = (a) => a.n + ' ' + (a.k === 'a' ? signed(a.b) : 'DC ' + a.dc) + ' (' + a.w.map(([label, n]) => (label === '8' ? '8' : label + ' ' + n)).join(' + ') + ')';
  const guessed = ENEMIES.flatMap((e) => [...(e.acts || []), ...(e.rx || [])].filter((a) => a.wf));
  const items = [
    { key: 'rule:numbers', title: t('Attack bonus and save DC of enemies'), ask: [
      t('When the page of an action does not name the ability it goes by, the planner takes Strength in melee (Dexterity when it is higher), Dexterity at range and, for a spell or a "caster" DC of an enemy whose page gives no spellcasting ability, the highest of Intelligence, Wisdom and Charisma. That rule is the part to check; it gave the {n} numbers below.', { n: guessed.length }),
      // (one line for each enemy the rule was used for: a number or two of them checked in the game settles the rule)
      ...ENEMIES.map((e) => [e, [...(e.acts || []), ...(e.rx || [])].filter((a) => a.wf && !a.g)]).filter(([, list]) => list.length).map(([e, list]) => e.n + ': ' + list.map(parts).join('; ') + '.')],
    info: [
      t('The wiki says how an attack roll is made (d20 + ability modifier + proficiency bonus, and the weapon\'s enchantment) and how a save DC is (8 + proficiency bonus + ability modifier), but not the attack bonus of each enemy. The planner works it out from the enemy\'s page: its proficiency bonus, its ability scores, its weapon.'),
      t('A save DC written on the action\'s page is used as it is.')] },
    { key: 'rule:honour', title: t('What Honour mode changes for an enemy'), ask: [
      t('The wiki gives +2 to attack rolls and save DCs for Tactician; its Honour section does not say it again. The planner keeps that +2 in Honour mode.'),
      t('{n} enemies have no Honour hit points on their page and get their Tactician ones in Honour mode. The few pages that give both (the goblins) give more in Honour than in Tactician.', { n: ENEMIES.filter((e) => !e.hp.h && e.hp.t).length }),
      t('The wiki says that in Tactician some enemies get more than that (Armour Class, resistances, saving throws, extra attacks) without giving it on the enemy pages. Only what a page lists is applied.')], info: [] },
    { key: 'rule:haste', title: t('Haste on the turn it is cast'), ask: [
      t('The wiki says Haste gives "an additional action each turn" and does not single out the turn it is cast. The Damage test lets you choose; it starts with the action counted from that turn.')], info: [] },
    { key: 'rule:consumables', title: t('Elixirs, arrows and coatings'), ask: [
      t('A coating\'s page gives the saving throw and what a failed one brings, but not for how long. The test counts 2 turns: {list}.', { list: CONSUMABLES.filter((c) => c.t === 'Coating' && (coatFx(c) || {}).conds).map((c) => c.n + ' (' + coatFx(c).conds.join(', ') + ')').join('; ') })],
    info: [
      t('A coating is on the weapon from before the fight, for its 10 turns. A target that passes its save is Inoculated for 2 turns, as the coating\'s page says.'),
      t('Arrows the test rolls: {list}. The others (darkness, transposition, knock-back, silence) do nothing here.', { list: CONSUMABLES.filter((c) => c.t === 'Arrow' && arrowFx(c)).map((c) => c.n).join(', ') }),
      t('Coatings the test rolls: {list}.', { list: CONSUMABLES.filter((c) => c.t === 'Coating' && coatFx(c)).map((c) => c.n).join(', ') }),
      t('Of an elixir, the test uses: an ability score set, a die on attack rolls and saving throws, a die on weapon damage, the critical hit number, Initiative, resistances, temporary hit points, one more spell slot, an Armour Class of 16, the action of Bloodlust, Arcane Acuity that never goes below 3 (Battlemage\'s Power). Not used: the spells an elixir lets cast once.'),
      t('Arcane Acuity is +1 to spell attack rolls and to the spell save DC for each turn of it left; a turn goes at the start of each turn and two with every hit taken. Gear gives 2 turns of it each time: the items whose text leaves the number out have it on the page of their passive.')] },
    { key: 'rule:turn', title: t('What an enemy does in a turn'), ask: [], info: [
      t('One action and, when one is chosen, one bonus action, on one build. It does not move by itself: the movement it spends is set on the page.'),
      t('It answers a hit once a round. A Legendary Action is used once a round and comes back at the start of the next, and not by a creature that is Stunned, incapacitated or Restrained (the wiki\'s Legendary action page). What sets each one off is given under its enemy, in the words of its page.'),
      t('That page names three exceptions the test does not play: W\'wargaz may use his twice a round, Gerringothe Thorm once for each piece of armour destroyed, Raphael once for each soul pillar left.'),
      t('A cantrip or spell the planner has in its own list deals the damage of the enemy\'s level and of the slot chosen. Its other spells deal the damage written on their page.')] },
    { key: 'rule:initiative', title: t('Initiative and Surprise'), ask: [], info: [
      t('Initiative is a d4 plus the bonus; on a tie, the higher Dexterity score goes first (the wiki\'s Initiative page). For an enemy, the bonus its page gives, else its Dexterity modifier.'),
      t('Whoever is Surprised takes no action and no reaction in the first round, as the condition\'s page says; it says nothing of the bonus action, which a Surprised build keeps.'),
      t('Assassinate: Initiative gives Advantage against an enemy that has not taken a turn yet; Assassinate: Ambush makes a hit on a Surprised enemy a critical hit; Dread Ambusher adds one weapon attack with 1d8 on the first turn.')] },
    { key: 'rule:conditions', title: t('How long a condition lasts'), ask: [], info: [
      t('The conditions the test plays, with what their page says: {list}.', { list: Object.keys(CONDITIONS).join(', ') }),
      t('When each counts down is on its page: at the end of the turn of whoever has it; at the start of the turn when the page says so; or on the turn of whoever caused it (Frightened), so that 2 turns of it cover one turn of the enemy.'),
      t('A Prone creature stands up at the start of its turn and acts as usual (the wiki\'s Prone page): the condition gives Advantage to the melee attacks made before that.'),
      t('An enemy that cannot move (Frightened, Restrained, held) sets off nothing that waits for it to move: Booming Blade, Spike Growth.')] },
    { key: 'rule:hits', title: t('Divine Smite, manoeuvres and Sneak Attack'), ask: [], info: [
      t('Divine Smite is used on a hit, by the choice made in the plan (every melee hit, or critical hits only), with the highest or the lowest spell slot left. Its dice and the Superiority Die are rolled twice on a critical hit.'),
      t('A manoeuvre is used once a turn, or on every hit, as chosen. Trip Attack leaves Prone, Menacing Attack Frightened, Goading Attack Goaded (Disadvantage on every attack roll, which the wiki\'s bug note says is what the game does) and Distracting Strike Distracted (Advantage on the next attack roll of an ally); Disarming, Pushing and Manoeuvring Attack only add their die to the damage.'),
      t('Sweeping Attack rolls one attack on every enemy for the Superiority Die alone, and the other attacks of the Attack action follow it: any attack with a weapon attack roll that costs an action sets off Extra Attack (the wiki\'s Extra Attack page). Precision Attack is spent on the first weapon attack of the turn.'),
      t('In Honour mode the action a kill gives with an Elixir of Bloodlust, like the one of Haste, is a single attack: only Action Surge lets an action on top use Extra Attack there (the same page).'),
      t('Commander\'s Strike is given every turn while the dice last: the fighter gives up one attack and the bonus action, the ally strikes with its reaction. Evasive Footwork ends with the build\'s own turn (the wiki\'s note), so it only covers the melee attacks that answer the build during it. Rally goes to an ally that is Downed, else to whoever is at half its hit points.'),
      t('Sneak Attack comes once a turn, on the first attack that hits. It needs Advantage on the attack, or an ally next to the target and no Disadvantage: in a party, a member that stands next to the enemy; for a build alone, the page says whether one is there.')] },
    { key: 'rule:party', title: t('A party in the fight'), ask: [], info: [
      t('Each member stands next to the enemy or away from it: by its weapon, or as set on the page. Bless goes to the caster and the next two members of the party. Aura of Protection reaches the allies in the Paladin\'s own line, as if they stood within its 3 m.'),
      t('An enemy picks whom it strikes by the choice of the page (at random, the first of the party, whoever has fewest hit points); a melee attack goes for those who stand next to it, while any of them is up.'),
      t('A member at 0 hit points is Downed and rolls a death saving throw each turn: a d20 against 10, with only Bless and a Paladin\'s aura added; three failed and it is dead, three passed and it is Stable. Help (the action), a healing spell or Rally bring it back. Enemies do not strike a Downed member here.'),
      t('With several enemies, a spell with an area catches all of them (up to the number its page gives); the attacks go to one enemy at a time, the one in front.')] },
  ];
  ENEMIES.forEach((e) => {
    const ask = [];
    const info = [];
    const acts = e.acts || [];
    if (!acts.length) info.push(t('Its page lists no action that deals damage and costs an action or a bonus action: in the Damage test its attacks are set by hand.'));
    if (e.note && /worked out/i.test(e.note)) ask.push(e.note);
    acts.filter((a) => a.g).forEach((a) => ask.push(t('{a} is not on its page. It is there because {why}. Attack bonus {b}, damage {d}.', { a: a.n, why: a.g, b: signed(a.b), d: hitsText(a.hits) })));
    acts.filter((a) => a.gw).forEach((a) => ask.push(t('{a}: its page does not name the weapon of this attack. {weapon} is used: {why}. {n}, damage {d}.', { a: a.n, weapon: a.gw[0], why: a.gw[1], n: numberOf(a), d: hitsText(a.hits) })));
    acts.filter((a) => a.c).forEach((a) => info.push(t('{a}: its page says it can only be used under a condition. The test offers it, but does not check the condition.', { a: a.n })));
    const own = acts.filter((a) => a.s && a.k !== 'e' && !SPELL_BY_NAME.has(norm(a.s)));
    if (own.length) info.push(t('Spells of its own, used with the damage of their page, not scaled by level or slot: {list}.', { list: own.map((a) => a.n).join(', ') }));
    (e.rx || []).forEach((a) => {
      const text = t('Answers a hit, once a round, with {a}{legend}: {d}, {how}{cond}.', { a: a.n, legend: a.lg ? ' (Legendary Action, Honour mode)' : '', d: hitsText(a.hits) || t('no damage'), how: numberOf(a), cond: a.cd ? ', ' + condOf(a) : '' })
        + (a.tr ? ' ' + t('Its page: "{x}"', { x: a.tr }) : '');
      // to check: one whose numbers are borrowed from its own attack, or that waits for more than the hit
      if (/^Main Hand Attack/.test(a.as || '')) ask.push(text + ' ' + t('The page gives it no numbers: one attack of {a} is rolled.', { a: a.as }));
      else if (a.c) ask.push(text + ' ' + t('The test uses it from the first hit, with every part of it, without what the page says it waits for.'));
      else info.push(text + (a.as ? ' ' + t('With the numbers of {a}', { a: a.as }) + '.' : ''));
    });
    UNUSED.forEach(([why, text, check]) => { const names = (e.nu || []).filter((x) => x[1] === why).map((x) => x[0]); if (names.length) (check ? ask : info).push(t(text, { list: names.join(', ') })); });
    if (!e.hp.t) ask.push(t('No Tactician hit points on its page: the Balanced ones are used in every mode.'));
    if (ask.length || info.length) items.push({ key: 'enemy:' + e.n, title: e.n, sub: t('Act {n}', { n: e.act }) + (e.ty ? ' · ' + e.ty : ''), link: wikiLink(e.n.replace(/ \(.*\)$/, '')), ask, info });
  });
  return items;
}
const reviewLeft = () => { const done = state.ui.reviewed || {}; return reviewItems().filter((x) => x.ask.length && !done[x.key]).length; };
function renderReview() {
  const all = reviewItems();
  const items = all.filter((x) => x.ask.length);
  const rest = all.filter((x) => !x.ask.length);
  const done = state.ui.reviewed || {};
  const notes = state.ui.reviewNotes || {};
  const left = items.filter((x) => !done[x.key]).length;
  const written = all.filter((x) => String(notes[x.key] || '').trim()).length;
  const head = (x, button) => `<header><div><h2>${esc(x.title)}</h2>${x.sub ? `<span class="muted">${esc(x.sub)}</span>` : ''}</div>
    ${x.link ? `<a class="icon" href="${x.link}" target="_blank" rel="noopener" title="${t('Open the wiki page')}">↗</a>` : ''}${button}</header>`;
  return `<div class="content wide review">
    <section class="card hero"><h1>${t('To check')}</h1>
      <p class="muted">${t('Where the wiki did not say enough and the planner guessed. Go through them one by one against the game, and tick each off; write what you saw where it differs. The ticks and the notes stay in this browser. What comes from the wiki as it is, or is a choice of the test, is at the end and asks for nothing. This page is temporary.')}</p>
      <p class="points"><b>${t('{n} of {total} checked', { n: items.length - left, total: items.length })}</b> · ${t('{n} with a note', { n: written })}</p>
      <div class="row-btns"><button class="btn" data-act="review-copy"${written ? '' : ' disabled'}>${t('Copy my notes')}</button></div></section>
    <div class="review-list">${items.map((x) => `<article class="card review-item${done[x.key] ? ' done' : ''}">
      ${head(x, `<button class="btn tiny${done[x.key] ? ' gold' : ''}" data-act="review-toggle" data-k="${esc(x.key)}">${done[x.key] ? t('Checked') : t('Mark as checked')}</button>`)}
      <ul>${x.ask.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      ${x.info.length ? `<p class="review-also">${t('From the wiki or a choice of the test, with nothing to check:')}</p><ul class="review-info">${x.info.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <label class="field review-note"><span>${t('What I saw in the game')}</span><textarea rows="2" data-review="${esc(x.key)}" placeholder="${t('The right number, or what is different')}">${esc(notes[x.key] || '')}</textarea></label></article>`).join('')}</div>
    <details class="card review-rest"><summary>${t('Nothing to check: what the test takes from the wiki as it is, and how it plays ({n})', { n: rest.length })}</summary>
      <div class="review-list">${rest.map((x) => `<article class="review-item plain">${head(x, '')}<ul class="review-info">${x.info.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></article>`).join('')}</div></details>
  </div>`;
}
// A note is typed: it is kept as it is written, without drawing the page again.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.review) return;
  (state.ui.reviewNotes || (state.ui.reviewNotes = {}))[el.dataset.review] = el.value;
  save();
});

Object.assign(actions, {
  'review-toggle'(el) { const done = state.ui.reviewed || (state.ui.reviewed = {}); done[el.dataset.k] = !done[el.dataset.k]; },
  // every note with the entry it belongs to, as text to paste somewhere else
  async 'review-copy'() {
    const notes = state.ui.reviewNotes || {};
    const text = reviewItems().filter((x) => String(notes[x.key] || '').trim()).map((x) => x.title + ': ' + String(notes[x.key]).trim()).join('\n');
    toast((await copyText(text)) ? t('Notes copied') : t('Could not copy the notes'));
    return false;
  },
});
