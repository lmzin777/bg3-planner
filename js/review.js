// Things to check by hand: where the wiki did not say enough about an enemy or a rule and the planner filled
// something in, worked a number out or left an action unused. Each entry can be ticked off and has a field for
// what was seen in the game; the ticks and the notes are kept with the rest of what the browser saves.
// A temporary page, there to be gone through one by one. To take it out: remove this file from index.html, and
// the "review" entries from navHtml() and render() in js/shell.js.
'use strict';

// "2d8 + 5 Slashing · 1d10 + 5 Piercing": one group for each attack of the action.
const hitsText = (hits) => hits.map((h) => h.map(([dice, flat, type]) => [dice, flat ? '+ ' + flat : '', type].filter(Boolean).join(' ')).join(' + ')).filter(Boolean).join(' · ');
// What the planner does not use of an enemy's page, by the reason it is left out.
const UNUSED = [
  ['reaction', 'Reactions the test does not use: {list}.'],
  ['legendary', 'Legendary Actions of Honour mode the test does not use (no damage or condition it can play, or no hit that sets them off): {list}.'],
  ['no cost', 'Listed with damage but with no action cost (triggered, passive or special), not used: {list}.'],
  ['weapon', 'Attacks with a weapon its page does not name, not used: {list}.'],
  ['no page', 'Actions with no page of their own on the wiki, not used: {list}.'],
];
function reviewItems() {
  const numberOf = (a) => (a.k === 'a' ? t('attack bonus {b}', { b: signed(a.b) }) : a.k === 's' ? a.sv.toUpperCase() + ' DC ' + a.dc : t('no roll'));
  const condOf = (a) => (a.cd ? a.cd[0] + ' ' + t('{n} turn(s)', { n: a.cd[1] || 2 }) + (a.cd[2] ? ' (' + a.cd[2].toUpperCase() + ' DC ' + a.cd[3] + ')' : '') : '');
  const items = [
    { key: 'rule:numbers', title: t('Attack bonus and save DC of enemies'), points: [
      t('The wiki gives the damage of an enemy\'s actions, but not its attack bonus. The planner works it out: proficiency bonus + ability modifier + the weapon\'s enchantment.'),
      t('A save DC written on the action\'s page is used as it is. When the page says "caster", it is worked out: 8 + proficiency bonus + spellcasting ability modifier.'),
      t('The ability is the one the action names; else Strength in melee (the higher of Strength and Dexterity with a Finesse weapon), Dexterity at range, the spellcasting ability for spells.')] },
    { key: 'rule:honour', title: t('What Honour mode changes for an enemy'), points: [
      t('The wiki gives +2 to attack rolls and save DCs for Tactician. The planner keeps that +2 in Honour mode.'),
      t('An enemy with no Honour hit points on its page gets its Tactician ones in Honour mode: {list}.', { list: ENEMIES.filter((e) => !e.hp.h && e.hp.t).map((e) => e.n).join(', ') }),
      t('Other changes the wiki mentions for Tactician (Armour Class, resistances, saving throws of some enemies) are not on the pages read, and are not applied.')] },
    { key: 'rule:haste', title: t('Haste on the turn it is cast'), points: [
      t('The wiki says Haste gives "an additional action each turn" and does not single out the turn it is cast. The Damage test lets you choose; it starts with the action counted from that turn.')] },
    { key: 'rule:turn', title: t('What an enemy does in a turn'), points: [
      t('One action and, when one is chosen, one bonus action, on one build. It does not move by itself: the movement it spends is set on the page.'),
      t('It answers a hit once a round with a reaction or, in Honour mode, a Legendary Action of its page, whatever the page says sets it off (being attacked, struck or damaged). The same one each round.'),
      t('A cantrip or spell the planner has in its own list deals the damage of the enemy\'s level and of the slot chosen. Its other spells deal the damage written on their page.')] },
    { key: 'rule:initiative', title: t('Initiative and Surprise'), points: [
      t('Initiative is a d4 plus the bonus (the wiki\'s Initiative page). For an enemy, the bonus its page gives, else its Dexterity modifier. A build goes before an enemy on a tie.'),
      t('Whoever is Surprised takes no action and no reaction in the first round; a Surprised build keeps its bonus action. The wiki\'s condition says "cannot take actions or reactions" and nothing of the bonus action.'),
      t('Assassinate: Initiative gives Advantage against an enemy that has not taken a turn yet; Assassinate: Ambush makes a hit on a Surprised enemy a critical hit; Dread Ambusher adds one weapon attack with 1d8 on the first turn.')] },
    { key: 'rule:conditions', title: t('How long a condition lasts'), points: [
      t('The conditions the test plays, with what their page says: {list}.', { list: Object.keys(CONDITIONS).join(', ') }),
      t('A condition counts down at the end of the turn of whoever has it; one whose page says it ticks at the start of the turn counts down then; one that ticks with its source (Frightened) counts down at the end of the turn of whoever caused it, so 2 turns of it cover one turn of the enemy.'),
      t('A Prone creature stands up at the start of its turn and acts as usual (the wiki\'s Prone page): the condition gives Advantage to the melee attacks made before that.'),
      t('A condition with no duration on the page that inflicts it (a weapon coating) is counted for 2 turns.'),
      t('Being Frightened or Restrained does not stop an enemy here from spending the movement set on the page.')] },
    { key: 'rule:hits', title: t('Divine Smite, manoeuvres and Sneak Attack'), points: [
      t('Divine Smite is used on a hit, by the choice made in the plan (every melee hit, or critical hits only), with the highest or the lowest spell slot left. Its dice and the Superiority Die are rolled twice on a critical hit.'),
      t('A manoeuvre is used once a turn, or on every hit, as chosen. Trip Attack leaves Prone, Menacing Attack Frightened, Goading Attack Goaded (Disadvantage on every attack roll, which the wiki\'s bug note says is what the game does) and Distracting Strike Distracted (Advantage on the next attack roll of an ally); Disarming, Pushing and Manoeuvring Attack only add their die to the damage.'),
      t('Precision Attack is spent on the first weapon attack of the turn, before the roll. Sweeping Attack rolls one attack on every enemy for the Superiority Die alone, and the other attacks of the Attack action follow it: its page does not say whether they do.'),
      t('Commander\'s Strike is given every turn while the dice last: the fighter gives up one attack and the bonus action, the ally strikes with its reaction. Evasive Footwork ends with the build\'s own turn (the wiki\'s note), so it only covers the melee attacks that answer the build during it. Rally goes to an ally that is Downed, else to whoever is at half its hit points.'),
      t('Sneak Attack comes once a turn, on the first attack that hits. It needs Advantage on the attack, or an ally next to the target and no Disadvantage: in a party, a member that stands next to the enemy; for a build alone, the page says whether one is there.')] },
    { key: 'rule:consumables', title: t('Elixirs, arrows and coatings'), points: [
      t('A coating is on the weapon from before the fight, for its 10 turns. A target that passes its save is Inoculated for 2 turns (no new save); one that fails gets the conditions for 2 turns.'),
      t('Arrows the test rolls: {list}. The others (darkness, transposition, knock-back, silence) do nothing here.', { list: CONSUMABLES.filter((c) => c.t === 'Arrow' && arrowFx(c)).map((c) => c.n).join(', ') }),
      t('Coatings the test rolls: {list}.', { list: CONSUMABLES.filter((c) => c.t === 'Coating' && coatFx(c)).map((c) => c.n).join(', ') }),
      t('Of an elixir, the test uses: an ability score set, a die on attack rolls and saving throws, a die on weapon damage, the critical hit number, Initiative, resistances, temporary hit points, one more spell slot, an Armour Class of 16, the action of Bloodlust, Arcane Acuity that never goes below 3 (Battlemage\'s Power). Not used: the spells an elixir lets cast once.'),
      t('Arcane Acuity is +1 to spell attack rolls and to the spell save DC for each turn of it left; a turn goes at the start of each turn and two with every hit taken. Gear that gives it for a number of turns is counted; gear whose text gives no number is not: {list}.',
        { list: ITEMS.filter((it) => effectTexts(it).some((x) => /Arcane Acuity/.test(x) && !/Arcane Acuity for \d turns/.test(x))).map((it) => it.n).join(', ') })] },
    { key: 'rule:party', title: t('A party in the fight'), points: [
      t('Each member stands next to the enemy or away from it: by its weapon, or as set on the page. Bless goes to the caster and the next two members of the party. Aura of Protection reaches the allies in the Paladin\'s own line, as if they stood within its 3 m.'),
      t('An enemy picks whom it strikes by the choice of the page (at random, the first of the party, whoever has fewest hit points); a melee attack goes for those who stand next to it, while any of them is up.'),
      t('A member at 0 hit points is Downed and rolls a death saving throw each turn: a d20 against 10, with only Bless and a Paladin\'s aura added; three failed and it is dead, three passed and it is Stable. Help (the action), a healing spell or Rally bring it back. Enemies do not strike a Downed member here.'),
      t('With several enemies, a spell with an area catches all of them (up to the number its page gives); the attacks go to one enemy at a time, the one in front.')] },
  ];
  ENEMIES.forEach((e) => {
    const points = [];
    const acts = e.acts || [];
    if (!acts.length) points.push(t('Its page lists no action with damage that costs an action or a bonus action: in the Damage test its attacks are set by hand.'));
    if (e.note && /worked out/i.test(e.note)) points.push(e.note);
    acts.filter((a) => a.g).forEach((a) => points.push(t('{a} is not on its page. It is there because {why}. Attack bonus {b}, damage {d}.', { a: a.n, why: a.g, b: signed(a.b), d: hitsText(a.hits) })));
    acts.filter((a) => a.c).forEach((a) => points.push(t('{a}: its page says it can only be used under a condition. The test offers it, but does not check the condition.', { a: a.n })));
    const worked = acts.filter((a) => (a.w || []).length && !a.g);
    if (worked.length) points.push(t('Numbers worked out, not on the wiki: {list}.', { list: worked.map((a) => a.n + ' ' + (a.k === 'a' ? signed(a.b) : 'DC ' + a.dc) + ' (' + a.w.map(([label, n]) => (label === '8' ? '8' : label + ' ' + n)).join(' + ') + ')').join('; ') }));
    const own = acts.filter((a) => a.s && a.k !== 'e' && !SPELL_BY_NAME.has(norm(a.s)));
    if (own.length) points.push(t('Spells of its own, used with the damage of their page, not scaled by level or slot: {list}.', { list: own.map((a) => a.n).join(', ') }));
    const leaves = acts.filter((a) => a.cd);
    if (leaves.length) points.push(t('Conditions its actions leave: {list}.', { list: leaves.map((a) => a.n + ' → ' + condOf(a)).join('; ') }));
    (e.rx || []).forEach((a) => points.push(t('Answers a hit, once a round, with {a}{legend}: {d}, {how}{cond}{as}{sometimes}.', { a: a.n, legend: a.lg ? ' (Legendary Action, Honour mode)' : '', d: hitsText(a.hits) || t('no damage'), how: numberOf(a),
      cond: a.cd ? ', ' + condOf(a) : '', as: a.as ? ', ' + t('with the numbers of {a}', { a: a.as }) : '', sometimes: a.c ? ', ' + t('every part of it counted though its page says some depend on something') : '' })));
    UNUSED.forEach(([why, text]) => { const names = (e.nu || []).filter((x) => x[1] === why).map((x) => x[0]); if (names.length) points.push(t(text, { list: names.join(', ') })); });
    if (!e.hp.t) points.push(t('No Tactician hit points on its page: the Balanced ones are used in every mode.'));
    if (points.length) items.push({ key: 'enemy:' + e.n, title: e.n, sub: t('Act {n}', { n: e.act }) + (e.ty ? ' · ' + e.ty : ''), link: wikiLink(e.n.replace(/ \(.*\)$/, '')), points });
  });
  return items;
}
const reviewLeft = () => { const done = state.ui.reviewed || {}; return reviewItems().filter((x) => !done[x.key]).length; };
function renderReview() {
  const items = reviewItems();
  const done = state.ui.reviewed || {};
  const notes = state.ui.reviewNotes || {};
  const left = items.filter((x) => !done[x.key]).length;
  const written = items.filter((x) => String(notes[x.key] || '').trim()).length;
  return `<div class="content wide review">
    <section class="card hero"><h1>${t('To check')}</h1>
      <p class="muted">${t('Where the wiki did not say enough and the planner worked a number out, filled something in or left an action unused. Go through them one by one against the game or the wiki, and tick each off; write what you saw in the game where it differs. The ticks and the notes stay in this browser. This page is temporary.')}</p>
      <p class="points"><b>${t('{n} of {total} checked', { n: items.length - left, total: items.length })}</b> · ${t('{n} with a note', { n: written })}</p>
      <div class="row-btns"><button class="btn" data-act="review-copy"${written ? '' : ' disabled'}>${t('Copy my notes')}</button></div></section>
    <div class="review-list">${items.map((x) => `<article class="card review-item${done[x.key] ? ' done' : ''}">
      <header><div><h2>${esc(x.title)}</h2>${x.sub ? `<span class="muted">${esc(x.sub)}</span>` : ''}</div>
        ${x.link ? `<a class="icon" href="${x.link}" target="_blank" rel="noopener" title="${t('Open the wiki page')}">↗</a>` : ''}
        <button class="btn tiny${done[x.key] ? ' gold' : ''}" data-act="review-toggle" data-k="${esc(x.key)}">${done[x.key] ? t('Checked') : t('Mark as checked')}</button></header>
      <ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <label class="field review-note"><span>${t('What I saw in the game')}</span><textarea rows="2" data-review="${esc(x.key)}" placeholder="${t('The right number, or what is different')}">${esc(notes[x.key] || '')}</textarea></label></article>`).join('')}</div>
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
