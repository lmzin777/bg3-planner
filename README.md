# BG3 Planner

A build and party planner for Baldur's Gate 3. Plain HTML, CSS and JavaScript: no build step, no server,
no account. Everything you make is saved in your own browser.

## Use it

Open `index.html` in a browser. To send it to someone as one file, use `dist/BG3-Planner.html`.

Your builds stay in the browser you made them in. Use **Backup** to keep a copy, and **Export** to send a
build to someone else.

## Work on it

- `index.html` loads the data files (`items.js`, `spells.js`, `classes.js`…) and then the scripts in `js/`.
- `index.html?test` runs the checks in `tests/tests.js` without touching saved builds; the tab title shows the result.
- `tools/` holds the Python scripts that read the game data from [bg3.wiki](https://bg3.wiki) (`py tools/update_items.py` and the others),
  the ones that check it (`verify_classes.py`, `verify_choices.py`, `verify_fields.py`) and `make_single_file.py`, which rebuilds `dist/`.
- The interface is written in English; `i18n.js` holds the Portuguese (Brazil) translation. Game terms are never translated.

## Where the content comes from

- Game data and pictures are read from [bg3.wiki](https://bg3.wiki), whose content is published under CC BY-NC-SA 4.0 or CC BY-SA 4.0.
  Baldur's Gate 3 and its assets belong to Larian Studios and Wizards of the Coast.
- The ready-made builds follow Morgana Evelyn's Honour Mode Party Template.

This is a fan project, not affiliated with any of them.
