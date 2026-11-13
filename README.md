# Bank

A push-your-luck dice game for one phone and a table of friends. Installable as a PWA, works offline.
Live at [bank.keeganwhitacre.com](https://bank.keeganwhitacre.com).

No build step and no dependencies: it's plain HTML, CSS and JavaScript served as static files.

## Project layout

```
index.html            markup only
css/
  base.css            reset, screens, picker previews, setup and game skeleton
  components.css      icons, sheets, overlays, home, mode cards, dice, cards, intensity states
  themes/*.css        one file per theme: dive, sb (Scoreboard), br (Brutalist), term, cas
  ui.css              theme variables, layout, rule strip, heat, toasts, announcements,
                      bust sequence, end screen, settings, Hall of Fame
js/                   plain scripts, loaded in order by index.html (they share globals)
  core.js             icons, helpers, localStorage
  rules.js            ALL game rules, no DOM; also runs in Node for tests
  config.js           settings, preferences, house rules, mode descriptions
  state.js            game state, undo snapshots, save/resume, thin wrappers over rules
  menus.js            theme / mode / setup screens, starting games
  audio.js            synthesized sound effects
  game.js             roll / bank / bust / round flow: calls Rules, then stats + effects
  render.js           draws the game screen
  sheets.js           bottom sheets: doubles, bank, game menu, rules
  overlays.js         bust collapse, round-end sheet, round intros, end screen
  fx.js               flashes, confetti, toasts, announcements
  sabotage.js         Sabotage cards
  dice.js             virtual dice
  settings.js         settings screen, wake lock, reduced motion, chaos deck editor
  groups.js           saved player groups
  hall.js             lifetime stats and the Hall of Fame
  share.js            shareable results image
  roster.js           add / remove players mid-game
  main.js             boot (keep last)
sw.js                 service worker (offline)
tests/rules.test.js   rules tests
```

## Running locally

Any static server works, e.g. `python3 -m http.server` from the repo root, then open
<http://localhost:8000>. (Opening `index.html` straight from disk also works, minus offline support.)

## Tests

```
npm test        # same as: node --test
```

The tests cover `js/rules.js`: scoring, busts, every chaos rule and combinations, Sabotage
cards, Last Man Standing lives and sudden death, round flow, winners and roster changes.
They run on every push via GitHub Actions. If you add a mode or a chaos rule, put the
logic in `rules.js` and add a test for it.

## Deploying

GitHub Pages serves `main`. **Bump `VERSION` at the top of `sw.js` on every deploy**
so installed copies fetch the new files. If you add a new CSS or JS file, add it to the
`SHELL` list in `sw.js` too, or it won't be available offline.

## Data on the phone (localStorage)

| Key | What |
| --- | --- |
| `bank.settings.v2` | theme, mode and options, preferences, house rules, last player names |
| `bank.game.v2` | the game in progress (auto-resumes) plus recent undo history |
| `bank.records.v1` | all-time records (best bank, biggest bust, biggest pot) |
| `bank.lifetime.v1` | per-player lifetime stats and the last 100 games |
| `bank.groups.v1` | saved player groups |
