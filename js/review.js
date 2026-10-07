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
  ['weapon', 'Attacks with a weapon its page does not name, not used: {list}.', false],
  ['no page', 'Actions with no page of their own on the wiki, not used: {list}.', false],
];
// Where the spellcasting ability of an enemy was taken from, when its page gives none: [ability, why, of what].
const castingWhy = ([key, why, of]) => t('Spellcasting ability {ab}: {why}.', { ab: key.toUpperCase(), why:
  why === 'kin' ? t('the one on the page of {x}', { x: of }) : why === 'class' ? t('the one of its class, {x}', { x: of })
    : why === 'default' ? t('what the game falls back on, for a {x}', { x: of }) : t('its highest of Intelligence, Wisdom and Charisma') });
// Every entry: { key, title, sub, link, ask: what to check in the game, info: what needs no checking }.
function reviewItems() {
  const numberOf = (a) => (a.k === 'a' ? t('attack bonus {b}', { b: signed(a.b) }) : a.k === 's' ? a.sv.toUpperCase() + ' DC ' + a.dc : t('no roll'));
  const condOf = (a) => (a.cd ? a.cd[0] + ' ' + t('{n} turn(s)', { n: a.cd[1] || 2 }) + (a.cd[2] ? ' (' + a.cd[2].toUpperCase() + ' DC ' + a.cd[3] + ')' : '') : '');
  const parts = (a) => a.n + ' ' + (a.k === 'a' ? signed(a.b) : 'DC ' + a.dc) + ' (' + a.w.map(([label, n]) => (label === '8' ? '8' : label + ' ' + n)).join(' + ') + ')';
  const guessed = ENEMIES.flatMap((e) => [...(e.acts || []), ...(e.rx || [])].filter((a) => a.wf));
  const items = [
    { key: 'rule:numbers', title: t('Attack bonus and save DC of enemies'), ask: [], info: [
      t('The wiki says how an attack roll is made (d20 + ability modifier + proficiency bonus, and the weapon\'s enchantment) and how a save DC is (8 + proficiency bonus + ability modifier), but not the attack bonus of each enemy. The planner works it out from the enemy\'s page: its proficiency bonus, its ability scores, its weapon.'),
      t('A save DC written on the action\'s page is used as it is.'),
      t('When the page of an action does not name the ability it goes by: Strength in melee with a weapon that is not Finesse; the higher of Strength and Dexterity with a Finesse weapon, or with none; Dexterity at range. An attack roll that names neither melee nor range (a charge) goes by the creature\'s casting ability, which is the ability the game gives its natural attacks.'),
      t('For a spell or a "caster" DC, the spellcasting ability of the creature\'s page. When the page gives none, in this order: the one a page of the same creature gives; the one of the class its page names, as in the tabletop rules (Wizard Intelligence, Cleric and Druid Wisdom, Paladin and Warlock Charisma); Intelligence for a Beast, a Construct, an Elemental or a Monstrosity, which is what the game falls back on (the wiki says so on the pages of Crushing Flight and of the myrmidons\' actions); else the highest of Intelligence, Wisdom and Charisma, as the tabletop stat blocks of hags, mind flayers and undead lords do.'),
      // (one line for each enemy a number was worked out for, with what its spellcasting ability was taken from)
      ...ENEMIES.map((e) => [e, [...(e.acts || []), ...(e.rx || [])].filter((a) => a.wf && !a.g)]).filter(([, list]) => list.length).map(([e, list]) => e.n + ': ' + list.map(parts).join('; ') + '.' + (e.ca ? ' ' + castingWhy(e.ca) : ''))] },
    { key: 'rule:honour', title: t('What Honour mode changes for an enemy'), ask: [], info: [
      t('The wiki\'s Difficulty page lists Honour mode with the Character Power, the Enemy Loadouts and the Additional Combat Mechanics of Tactician. So the +2 to attack rolls and save DCs holds in Honour mode, and so do the Tactician hit points; a page that gives Honour hit points of its own has them used ({list}).', { list: ENEMIES.filter((e) => e.hp.h).map((e) => e.n).join(', ') }),
      t('A page with no Tactician hit points gets Balanced × 1.3, rounded down, which is what most pages that give both show (the Difficulty page\'s own example: 67 becomes 87). Bosses may have more, and theirs are on their pages. Worked out for: {list}.', { list: ENEMIES.filter((e) => e.hpw).map((e) => e.n + ' ' + e.hp.t).join(', ') }),
      t('What a page gives of its own for Tactician and for Honour mode is applied: Armour Class, ability scores (and with them the numbers of its attacks), resistances, passives, Extra Attack, Legendary Resistances. Enemies with such numbers: {list}.', { list: ENEMIES.filter((e) => e.tm || e.hm).map((e) => e.n).join(', ') })] },
    { key: 'rule:haste', title: t('Haste on the turn it is cast'), ask: [], info: [
      t('Haste costs an action to cast (its page), and the Hastened condition gives one more action each turn from the moment it is on. The Damage test counts that action already on the turn of the cast; the page lets you count it from the turn after instead. In Honour mode the action on top cannot use Extra Attack (the condition\'s page).')] },
    { key: 'rule:consumables', title: t('Elixirs, arrows and coatings'), ask: [], info: [
      t('What a coating leaves on a target lasts as its page says. Until the target passes the save, rolled again at the end of each of its turns: {until}. For a number of turns: {turns}.', {
        until: CONSUMABLES.filter((c) => c.t === 'Coating' && (coatFx(c) || {}).conds && coatFx(c).until).map((c) => c.n + ' (' + coatFx(c).conds.join(', ') + ')').join('; '),
        turns: CONSUMABLES.filter((c) => c.t === 'Coating' && (coatFx(c) || {}).conds && !coatFx(c).until).map((c) => c.n + ' (' + coatFx(c).conds.join(', ') + ', ' + coatFx(c).turns + ')').join('; ') }),
      t('A coating is on the weapon from before the fight, for its 10 turns. A target that passes its save is Inoculated for 2 turns, as the coating\'s page says.'),
      t('Arrows the test rolls: {list}. The others (darkness, transposition, knock-back, silence) do nothing here.', { list: CONSUMABLES.filter((c) => c.t === 'Arrow' && arrowFx(c)).map((c) => c.n).join(', ') }),
      t('Coatings the test rolls: {list}.', { list: CONSUMABLES.filter((c) => c.t === 'Coating' && coatFx(c)).map((c) => c.n).join(', ') }),
      t('Of an elixir, the test uses: an ability score set, a die on attack rolls and saving throws, a die on weapon damage, the critical hit number, Initiative, resistances, temporary hit points, one more spell slot, an Armour Class of 16, the action of Bloodlust, Arcane Acuity that never goes below 3 (Battlemage\'s Power). Not used: the spells an elixir lets cast once.'),
      t('Arcane Acuity is +1 to spell attack rolls and to the spell save DC for each turn of it left; a turn goes at the start of each turn and two with every hit taken. Gear gives 2 turns of it each time: the items whose text leaves the number out have it on the page of their passive.')] },
    { key: 'rule:turn', title: t('What an enemy does in a turn'), ask: [], info: [
      t('One action and one bonus action. With nothing chosen for it, the strongest of its actions that it can pay for that turn (spell slots and limited uses first, while they last), and never one its page ties to a condition. It does not move by itself: the movement it spends is set on the page.'),
      t('An action with an area catches every member of the party that stands in the same line as the one it is aimed at.'),
      t('From Tactician up it tries to finish off whoever it downs, as the wiki\'s Difficulty page says: one blow on a Downed member, which is a failed death saving throw, and then it turns to someone else.'),
      t('Its passives are played as their pages give them: Magic Resistance (Advantage on saves against spells), Evasion, Alert (never Surprised), Vampire Regeneration (unless Radiant damage reached it), Tenacity, Githyanki Parry (once a round).'),
      t('Legendary Resistance adds 10 to a failed save when that turns it into a passed one, three times; the general one not on a natural 1 or 20 (its page\'s bug note), "Incapacitation" only against what takes actions away.'),
      t('It answers a hit once a round. A Legendary Action is used once a round and comes back at the start of the next, and not by a creature that is Stunned, incapacitated or Restrained (the wiki\'s Legendary action page). What sets each one off is given under its enemy, in the words of its page.'),
      t('That page names three exceptions. One is played: Gerringothe Thorm answers once for each piece of armour destroyed. Two are not: W\'wargaz may use his twice a round, Raphael once for each soul pillar left.'),
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
    acts.filter((a) => a.gr).forEach((a) => info.push(t('{a}: its page gives the damage as a range in the text ({range}); the test rolls it as {dice}.', { a: a.n, range: a.gr, dice: hitsText(a.hits) })));
    if (e.note) info.push(e.note);
    acts.filter((a) => a.g).forEach((a) => info.push(t('{a} is not on its page. It is there because {why}. Attack bonus {b}, damage {d}.', { a: a.n, why: a.g, b: signed(a.b), d: hitsText(a.hits) })));
    acts.filter((a) => a.gw).forEach((a) => info.push(t('{a}: its page does not name the weapon of this attack. {weapon} is used: {why}. {n}, damage {d}.', { a: a.n, weapon: a.gw[0], why: a.gw[1], n: numberOf(a), d: hitsText(a.hits) })));
    acts.filter((a) => a.c).forEach((a) => info.push(t('{a}: its page says it can only be used under a condition. The test offers it, but does not check the condition.', { a: a.n })));
    const own = acts.filter((a) => a.s && a.k !== 'e' && !SPELL_BY_NAME.has(norm(a.s)));
    if (own.length) info.push(t('Spells of its own, used with the damage of their page, not scaled by level or slot: {list}.', { list: own.map((a) => a.n).join(', ') }));
    (e.rx || []).forEach((a) => {
      const text = t('Answers a hit, once a round, with {a}{legend}: {d}, {how}{cond}.', { a: a.n, legend: a.lg ? ' (Legendary Action, Honour mode)' : '', d: hitsText(a.hits) || t('no damage'), how: numberOf(a), cond: a.cd ? ', ' + condOf(a) : '' })
        + (a.tr ? ' ' + t('Its page: "{x}"', { x: a.tr }) : '')
        // what it waits for, when the test plays that
        + (a.wt && e.tp ? ' ' + t('It has it only while the temporary hit points of {name} last.', { name: e.tp.n }) : '')
        + (a.af ? ' ' + t('It waits for {n} hits taken, and counts again once it is used.', { n: a.af }) : '')
        + (a.ev ? ' ' + t('Not a hit: each piece of armour that falls sets it off, on whoever stands next to it, as often as pieces fall.') : '');
      // to check: one whose numbers are borrowed from its own attack, or that waits for more than the hit
      if (/^Main Hand Attack/.test(a.as || '')) info.push(text + ' ' + t('The page gives it no numbers: one attack of {a} is rolled.', { a: a.as }));
      else if (a.c) info.push(text + ' ' + t('The test uses it from the first hit, with every part of it, without what the page says it waits for.'));
      else info.push(text + (a.as ? ' ' + t('With the numbers of {a}', { a: a.as }) + '.' : ''));
    });
    UNUSED.forEach(([why, text, check]) => { const names = (e.nu || []).filter((x) => x[1] === why).map((x) => x[0]); if (names.length) (check ? ask : info).push(t(text, { list: names.join(', ') })); });
    if (e.hpw) info.push(t('No Tactician hit points on its page: Balanced × 1.3, rounded down, gives {n}.', { n: e.hp.t }));
    if (e.tp) info.push(t('From {mode} mode up it starts with {name}: {n} temporary hit points.', { mode: { b: 'Balanced', t: 'Tactician', h: 'Honour' }[e.tp.md], name: e.tp.n, n: e.tp.hp })
      + (e.tp.min ? ' ' + t('While they last, a hit of less than {n} damage does nothing to it.', { n: e.tp.min }) : ''));
    acts.filter((a) => a.ud).forEach((a) => info.push(t('{a} is gone once {n} damage is dealt to it, as its page says.', { a: a.n, n: a.ud })));
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
      ${items.length ? '' : `<p class="okline">${t('Nothing is left to check: every point was gone through, and each was settled by the wiki or by a rule that is written out below, with where it comes from.')}</p>`}
      <p class="muted"${items.length ? '' : ' hidden'}>${t('Where the wiki did not say enough and the planner guessed. Go through them one by one against the game, and tick each off; write what you saw where it differs. The ticks and the notes stay in this browser. What comes from the wiki as it is, or is a choice of the test, is at the end and asks for nothing. This page is temporary.')}</p>
      ${items.length ? `<p class="points"><b>${t('{n} of {total} checked', { n: items.length - left, total: items.length })}</b> · ${t('{n} with a note', { n: written })}</p>
      <div class="row-btns"><button class="btn" data-act="review-copy"${written ? '' : ' disabled'}>${t('Copy my notes')}</button></div>` : ''}</section>
    <div class="review-list">${items.map((x) => `<article class="card review-item${done[x.key] ? ' done' : ''}">
      ${head(x, `<button class="btn tiny${done[x.key] ? ' gold' : ''}" data-act="review-toggle" data-k="${esc(x.key)}">${done[x.key] ? t('Checked') : t('Mark as checked')}</button>`)}
      <ul>${x.ask.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      ${x.info.length ? `<p class="review-also">${t('From the wiki or a choice of the test, with nothing to check:')}</p><ul class="review-info">${x.info.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <label class="field review-note"><span>${t('What I saw in the game')}</span><textarea rows="2" data-review="${esc(x.key)}" placeholder="${t('The right number, or what is different')}">${esc(notes[x.key] || '')}</textarea></label></article>`).join('')}</div>
    <details class="card review-rest"${items.length ? '' : ' open'}><summary>${t('Nothing to check: what the test takes from the wiki as it is, and how it plays ({n})', { n: rest.length })}</summary>
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
