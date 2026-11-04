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
  data/               Loading and saving (store.js), and admin tools (access.js)
  domain/             League logic, such as finishing places, validation and submissions
  ratings/            The scoring engine
    approaches/         One short file per scoring system
  pages/              One file per page
  forms/              The player and game forms
  ui/                 Shared building blocks, such as tables and charts

css/                  tokens.css holds all colours and sizes, so start there to re-theme
scripts/              The script the League submission Action runs
.github/workflows/    The Actions that save submissions and publish the site
tests/                Tests for the scoring maths, validation, submissions and data files
assets/               The crest and browser icon
```

## Who can change what

Anyone can view the site, and players do not need an account. Only **league admins** can register players or log and correct games. Admins are the GitHub usernames in `data/league.json`. To add one, edit that list and commit it.

## How results get saved

Everything stays on GitHub, with no other services or passwords. A static site cannot write to its repo or tell who is using it, so GitHub does both of those jobs:

1. An admin switches on **I am a league admin** on the Admin page, which shows the editing tools in that browser. This only reveals buttons, and grants no access by itself.
2. Logging a game opens GitHub with an issue already filled in, and the admin presses **Submit**. The admin needs to be signed in to GitHub.
3. The [League submission](.github/workflows/league-submission.yml) Action checks the username and the details, using [`js/domain/submission.js`](js/domain/submission.js). If all is well, it commits to `data/profiles.json` and `data/games.json`, then republishes the site.
4. The issue closes with a confirmation. If there is a problem, the issue explains it and nothing changes.

The change shows in the admin's own browser straight away, and for everyone else once the site has republished. If someone who is not an admin opens a submission, it is closed with a polite note and nothing changes. Ordinary issues are ignored.

The repo and site are public, so use first names or nicknames in profiles. Names also stay in the Git history after a player is deleted.

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

The repo owner goes to **Settings → Pages → Build and deployment → Source** and chooses **GitHub Actions**. After that, the [Deploy site](.github/workflows/deploy-site.yml) Action publishes every push to the default branch, along with every league submission. The site will appear at `https://d-green1958.github.io/FLF-Catan-League/`.

League data is read from and written to the repo's default branch. If the default branch changes, the Actions need to be on the new one too.

## Credits

Game facts and rulebook links come from [catan.com](https://www.catan.com/understand-catan/game-rules). The rules summary is written in our own words, and the official rulebooks remain the authority.

The Plackett-Luce system follows Weng and Lin (2011), "A Bayesian Approximation Method for Online Ranking", *Journal of Machine Learning Research*.

FLFOxtan is an independent fan league. It is not affiliated with, sponsored by or endorsed by CATAN GmbH, CATAN Studio or the University of Oxford.
