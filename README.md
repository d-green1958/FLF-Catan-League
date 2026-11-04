# FLFOxtan

The league site for the **Fun Lunch Friday Oxford Catan group**, founded on 4 November 2026.

It keeps track of players and games, then ranks everyone 16 different ways so the group can work out which system feels fairest. It is plain HTML, CSS and JavaScript with no build step, and runs on GitHub Pages.

## Run it locally

Browsers will not load the data files from a page opened directly, so start a small local server from this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. If that port is already in use, swap 8000 for another number in both places. To see the site full of data, press **Try the demo**: the players are made up, and your real data is untouched.

Run the tests (needs Node 22 or later, nothing to install):

```bash
node --test
```

## Where everything lives

```text
data/               The databases. Plain JSON that you can read and edit by hand.
  profiles.json       Players
  games.json          Games, with seats listed in turn order
  rating-approaches.json  Every scoring system: description, settings, on or off
  rules.json          Text for the Rules page
  expansions.json     Expansions, scenarios and links to official rulebooks
  colours.json        Player piece colours
  league.json         League settings and the About page text
  demo/               Made-up players and games for demo mode

js/
  main.js             Starts the app and handles page navigation
  data/               Loading and saving (store.js is the only file that does this)
  domain/             League logic, such as finishing places, validation and statistics
  ratings/            The scoring engine
    approaches/         One short file per scoring system
  pages/              One file per page
  forms/              The player and game forms
  ui/                 Shared building blocks, such as tables and charts

css/                  tokens.css holds all colours and sizes, so start there to re-theme
tests/                Tests for the scoring maths, validation, statistics and data files
assets/               The crest and browser icon
```

## How saving works

GitHub Pages only serves files, so the site cannot save to the repo by itself. Data therefore lives in two layers:

1. **Published data:** the JSON files in `data/`, which everyone sees.
2. **Browser draft:** new players and games, saved straight away in that person's browser only.

To publish a draft, go to **Save & share**, download `profiles.json` and `games.json`, replace the copies in `data/`, then commit and push.

This means that **a game logged on one person's laptop is invisible to everyone else until it is committed**, so it works best with one record keeper. For everyone to log games directly, the site would need a small shared database. `js/data/store.js` is the only file that would have to change.

The repo and site are public, so use first names or nicknames in profiles.

## How scoring works

Scores are never stored. Every system replays all the games in date order whenever the page loads, so correcting or back-dating a game automatically fixes every rating after it.

The **Scoring systems** page explains each one, including its weaknesses, and lets anyone try different settings in their own browser. The **Compare all** view on the leaderboard shows where the systems disagree.

| Family | Systems |
|---|---|
| Combined | FLFOxtan Index |
| Simple tallies | Most wins, Adjusted win rate, Wins above expected, League points, Average VP share |
| Elo | Standard, Placement, Table-size, Experience-adjusted, Confidence-weighted, VP-margin, Repeat-decay |
| Penalty ladders | Flat, Strength-weighted |
| Skill with uncertainty | Plackett-Luce |

**Repeat-opponent decay:** each time a pair meets again, their result is multiplied by `2^(−games together ÷ half-life)`. With a half-life of 5, their 6th game counts half as much, their 11th a quarter, and it keeps shrinking. Each pair decays separately, so a new opponent at the same table still counts in full.

### Retire a system

Set `"enabled": false` for it in `data/rating-approaches.json`. Past results are unaffected.

### Add a system

1. Add an entry to `data/rating-approaches.json` with a new `id`.
2. Add `js/ratings/approaches/<id>.js`. Most are only a few lines. For example, here is the whole of Table-size Elo:

   ```js
   import { createElo } from '../elo.js';

   export default createElo({
     gameWeight: (game, params) => game.size / params.referenceTable,
   });
   ```

The site picks it up from there. The test suite checks every system in the catalogue automatically.

## Publish on GitHub Pages

Someone with admin rights on the repo goes to **Settings → Pages → Deploy from a branch**, then chooses the branch and `/ (root)`. The site will appear at `https://d-green1958.github.io/FLF-Catan-League/`.

## Credits

Game facts and rulebook links come from [catan.com](https://www.catan.com/understand-catan/game-rules). The rules summary is written in our own words, and the official rulebooks remain the authority.

The Plackett-Luce system follows Weng and Lin (2011), "A Bayesian Approximation Method for Online Ranking", *Journal of Machine Learning Research*.

FLFOxtan is an independent fan league. It is not affiliated with, sponsored by or endorsed by CATAN GmbH, CATAN Studio or the University of Oxford.
