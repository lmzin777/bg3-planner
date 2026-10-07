// The page of updates: what changed in each version, the recent and important things only, newest first.
// A new version adds its entry at the top (a test checks that the first entry is the version of the planner).
// The menu marks the page as "new" until it is opened in the version that is running.
'use strict';

// [version, date, what it was about, [what changed]]
const UPDATES = [
  ['4.7', '2026-10-06', 'Enemies closer to the wiki, and nothing left to check', [
    'Attack bonuses and save DCs of enemies: the spellcasting ability comes from the creature\'s page; when the page gives none, from a page of the same creature, from its class, or from what the game falls back on. Some numbers changed with it: Owlbear Mate, the Myrmidons, Steel Watcher Titan, Black Gauntlet, Minotaur, Goblin Booyahg, Vengeful Cambion.',
    'Tactician hit points are worked out (Balanced × 1.3) for the few pages that give none; the Damage test marks them with an asterisk.',
    'Gerringothe Thorm: her Coin Armour falls one piece for each 100 damage dealt to her, and her Coin Whips go with it; in Honour mode each piece is answered with Sublimation.',
    'The Bulette of Honour mode starts with Diamond Scales: 100 temporary hit points, a hit under 15 damage does nothing while they last, and Shredding Scales goes when they do.',
    'The Spectator of Honour mode uses Ocular Nightmare only after five hits taken.',
    'A poison on a weapon (Basic Poison, Drow Poison, Malice) lasts until the target passes the save, not for 2 turns.',
    '"To check" has nothing left to tick: every point was settled by the wiki and is explained there.',
    'This page of updates.']],
  ['4.6', '2026-10-06', 'A notice when the site is updated', [
    'When a newer version of the site is out, a notice shows at the bottom right with a button that loads it. Builds and parties stay as they are.']],
  ['4.5', '2026-10-06', 'Creation step by step, and items chosen from lists with pictures', [
    'The step by step is now the creation of the character only, as in the game: the choices of level 1 come right after the class, and after Skills comes the Summary, which leads to the Build Planner.',
    'Levels 2 to 12 are chosen in the Build Planner: "Level up step by step" walks through them one at a time.',
    'Gear slots, alternatives, Setup items and Consumables are chosen from a list with the picture of each item and what it does. No more typed names, and no more "+ add".']],
  ['4.4', '2026-10-06', 'A home page', [
    'A Home page, opened from the menu or from the name of the planner at the top.',
    'What is under the pointer stands out, on every button, row and card.']],
  ['4.3', '2026-10-06', 'Enemies that play as their pages say', [
    'Legendary Resistance and Magic Resistance are played.',
    'An enemy with no action chosen uses the strongest one it can pay for; an action with an area catches the whole line; from Tactician up it finishes off whoever is Downed.',
    'The Armour Class, ability scores and resistances a page gives for Tactician are used.',
    'The level the build fights at is chosen on the page, and the build\'s immunities count.']],
  ['4.2', '2026-10-06', '"To check" gone over against the wiki', [
    'The list of things to check went from 92 points to 27: what the wiki answers was applied instead of asked.']],
  ['4.1', '2026-10-06', 'The Damage test in rounds', [
    'A fight in rounds by Initiative: one build or a whole party against an enemy and its helpers, with Surprise and conditions.',
    'Divine Smite, the Battle Master\'s manoeuvres, Sneak Attack once a turn, elixirs, arrows and coatings.',
    'Downed members roll death saving throws and can be helped up; enemies use their reactions and Legendary Actions.',
    'Three hundred fights at once with a chart, and scenarios that can be saved.',
    'A first visit starts with no builds, and the Build check is always in view, each entry leading to where it is settled.']],
  ['3.x', '2026-10-05', 'The first Damage test', [
    'The damage of a turn with spells, higher spell slots and Metamagic; then a plan of turns, effects that last, the enemy\'s turn and reactions.',
    'The menu in groups, and a page for Builds.']],
  ['2.x', '2026-10-05', 'Choices as the game grants them', [
    'Every choice of a level is a selector that says what each option gives, and only the choices a level grants count.',
    'Every data file read again from the wiki, and the ready-made builds completed from their guide.']],
  ['1.x', '2026-10-04', 'The first planner', [
    'Character creation, levels, gear by act and final numbers; the Build check, the share code, spells by level and the step-by-step creation.']],
];

function renderUpdates() {
  return `<div class="content wide updates">
    <section class="card hero"><h1>${t('Updates')}</h1>
      <p class="muted">${t('What changed in the planner, the recent and important things only, newest first. The version that is running is at the top of the page, beside the name.')}</p></section>
    <div class="review-list">${UPDATES.map(([v, date, title, list]) => `<article class="card upd${v === APP_VERSION ? ' now' : ''}">
      <header><h2><b>v${v}</b> ${esc(t(title))}</h2><span class="muted">${date}${v === APP_VERSION ? ' · ' + t('this version') : ''}</span></header>
      <ul>${list.map((x) => `<li>${esc(t(x))}</li>`).join('')}</ul></article>`).join('')}</div>
  </div>`;
}
