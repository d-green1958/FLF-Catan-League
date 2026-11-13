# FLFOxtan

The league site for the **Fun Lunch Friday Oxford Catan group**, founded on 4 November 2026.

It keeps track of players and games, then ranks everyone 16 different ways so the group can work out which system feels fairest. It is plain HTML, CSS and JavaScript with no build step, and runs on GitHub Pages.

For a plain-language overview of how everything fits together, start with [BRIEFING.md](BRIEFING.md).

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
  games.json          Games, with seats listed in turn order, and optionally the board
  activity.json       Everything added, edited and removed, and by whom (written by the Action)
  profile-options.json  The resources and play styles offered on a profile
  rating-approaches.json  Every scoring system: description, settings, on or off
  rules.json          Text for the Rules page
  expansions.json     Expansions, scenarios and links to official rulebooks
  colours.json        Player piece colours
  league.json         League settings and the About page text
  demo/               Made-up players and games for demo mode

js/
  main.js             Starts the app and handles page navigation
  data/               Loading and saving (store.js), and sending changes to GitHub (access.js)
  domain/             League logic, such as finishing places, validation and submissions
  ratings/            The scoring engine
    approaches/         One short file per scoring system
  pages/              One file per page
  forms/              The player and game forms, and the prompt that sends them (send-dialog.js)
  ui/                 Shared building blocks, such as tables and charts

css/                  tokens.css holds all colours, fonts and sizes (taken from the crest), so start there to re-theme
scripts/              The script the Action runs, and those that set the admin code and passwords
.github/workflows/    The Actions that save submissions and publish the site
tests/                Tests for the scoring maths, validation, submissions and data files
assets/               The crest and browser icon
```

## Who can change what

Anyone can view the site without an account. **Anyone with a free GitHub account or the group password** can register players and log games, and these go live without waiting for approval. Apart from the personal details on a profile (below), they cannot change or remove anything already in the league.

**Admins** are whoever knows the admin code. They check the **Review** page, which lists everything added, edited and removed, and by whom, and can edit or remove anything spurious.

After someone saves a player or game, the site asks for their name and the group password, then sends it straight away. **Remember me on this device** is ticked by default, so each phone asks only once (**Forget** clears it, and changing the group password makes every device ask again). **Use a GitHub account instead** opens GitHub with the issue filled in. Admins who have entered the code are not asked at all, once `set-admin-access.js` has been run.

Anyone can also edit the personal details on a profile: photo, nickname, signature move, about, favourite colour and resource, and play style. The log says who changed what, and an admin can change it back. A name, joining date, retirement or deletion needs the admin code.

### How changes show up so quickly

Saving to the repo and republishing the site takes about 40 seconds, because GitHub queues the Action and then the deploy. A submission exists as a GitHub issue within a second, so the site also reads recent issues and applies them on top of the published data, using the same `processSubmission()` check as the Action (`js/domain/live-issues.js`). The Action's commit is still the permanent record, and an issue it refuses stops being shown.

- **Group password or admin code:** the site opens the issue itself, so the result shows as soon as GitHub replies, usually within a second or two.
- **GitHub account:** the site checks when the person comes back to its tab, then every 5 seconds for a minute.
- **Everyone else:** the site checks when a page is opened or looked at again, at most once a minute, and an open tab picks up published data every 30 seconds.

GitHub allows 60 of these checks an hour per network without a login, so they are rationed. If that runs out, the site just waits for the published data, and nothing breaks.

### Photos

The browser crops a chosen picture to a small square and re-encodes it, which also removes hidden details such as location. It is stored as text in `data/profiles.json`, at most 4,000 characters, so one fits in a GitHub link. Only JPEG and WebP are accepted, and the Action checks this too. Photos are public, and stay in the repo's history even after being removed.

### Boards and openings

A game can record its board: the 19 tiles, the number tokens and, optionally, where each player put their first two settlements. It is stored with the game as `board: { tiles, numbers, starts }` (the format is described at the top of `js/domain/board.js`). From it the site works out each player's opening strength: the dots (pips) under every number their settlements touch, split by resource. Insights then compares winners with everyone else.

- **Entering it:** in the game form, open **The board and openings**. Tap a terrain, then the tiles that have it, then the numbers, then everyone's settlements. The editor counts what is left and moves on by itself.
- **From a photo:** **Read from a photo** reads the tiles from a picture taken on the phone. You line up a hexagon outline with the board (drag, then size, rotate and tilt), and each tile's colour is matched against the six terrains, using the fact that the box holds exactly 4 forests, 4 pastures, 4 fields, 3 hills, 3 mountains and 1 desert (`js/domain/board-photo.js`). The photo never leaves the device. Tiles it is unsure of are outlined in red to check. Number tokens and settlements are tapped in by hand.
- **Later:** anyone can add the board to a game that has none, from the game's details. Changing a board that is already there needs the admin code, like any other correction.
- **Limits:** base-game boards only (19 tiles), not the 5–6 player extension or Seafarers.

### Set or change the admin code

```bash
node scripts/set-admin-code.js
```

Type the code at the hidden prompt, using at least 12 characters and ideally four or more random words. Then commit and push `data/league.json`. Changing the code stops the old one working, so do this if it leaks or when an admin leaves.

Your code is never published: the repo holds only a public key made from it. The browser uses the code to sign an admin's changes, and the Action checks the signature. Because the public key is public, someone could try guessing the code on their own computer, so a long code matters. Signatures expire after an hour, so an old one copied from an issue cannot be reused later.

### Add without a GitHub account

People who know the group password can add without a GitHub account, by choosing **No** when the site asks and entering their name and the password. The site opens the GitHub issue for them using a token belonging to the repo owner, so those issues appear under the owner's account. The typed name is shown on the site, marked "(group password)". GitHub has not verified it, so anyone with the password could type any name.

To turn this on, the repo owner creates the token, because a fine-grained token can only reach repos its owner controls:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Set **Repository access** to **Only select repositories** and choose this repo.
3. Under **Repository permissions**, set **Issues** to **Read and write**. Give it nothing else.
4. Set an expiry date, and note it. The group password stops working when the token expires.

Then run this and commit and push `data/league.json`:

```bash
node scripts/set-group-password.js
```

It asks for the new password, which must differ from the admin code, and the token, at hidden prompts. Only the token encrypted with the password goes in the file.

The encrypted token is in the public repo, so someone could try guessing the password on their own computer, and a long password matters. Anyone who gets the token could open, edit, close and comment on issues in this repo under the owner's name, but could not change code or data other than by adding entries as usual, and could not remove anything.

If the password leaks, or when someone leaves the group, **delete the token on GitHub first**, because anyone who already has it can keep using it even after the password changes. Then create a new token and run the script again.

To turn the route off completely, delete the token and set both `"groupAccess": null` and `"adminAccess": null` in `data/league.json`.

### Let admins send without being asked

The admin code proves to the Action that a change is allowed, which it checks against the public key. But the change travels in a GitHub issue, and opening an issue takes a GitHub login. So that admins need nothing but the code, run this after setting both the code and the group password, then commit and push `data/league.json`:

```bash
node scripts/set-admin-access.js
```

It asks for the group password and the admin code at hidden prompts. It uses the password to open the token, so you do not need the token itself, and stores a second copy encrypted with the admin code.

Changing the admin code or the group password clears this copy, and the script tells you to run this again. If the admin code leaks, treat it like a leaked password: delete the token on GitHub first, because the old code still opens the copy in the Git history.

## How results get saved

Everything stays on GitHub, with no other services. A static site cannot write to its repo or tell who is using it, so GitHub does both of those jobs:

1. Saving a player or game asks how to send it. With a GitHub account, GitHub opens with an issue already filled in and the person presses the green button to create it. With the group password or the admin code, the site opens the issue for them.
2. The [League submission](.github/workflows/league-submission.yml) Action checks the details, using [`js/domain/submission.js`](js/domain/submission.js). If all is well, it commits to the `data` folder, then republishes the site.
3. The issue closes with a confirmation. If there is a problem, the issue explains it and nothing changes.

The change shows in the person's own browser straight away, and for everyone else as described in [How changes show up so quickly](#how-changes-show-up-so-quickly). A notice at the top of the page shows anything not yet sent, or refused and why, and clears by itself once the change is live. Corrections and removals work the same way, with the admin's signature in the issue. Ordinary issues are ignored.

The repo and site are public, so use first names or nicknames in profiles. Names and GitHub usernames stay in the Git history, on the issues and in the activity log after an entry is removed.

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

## The Map and the easter eggs

**The Map** (`#/map`, `js/pages/map.js`) is an old-style chart of Oxford with every player walking about on it:
- **Quarter:** each player keeps to the quarter of their favourite resource (brick in Jericho, lumber in Christ Church Meadow, wool on Port Meadow, grain in Marston, ore at the Castle). If their profile has none, it uses the resource their recorded openings lean on.
- **Rank:** the higher a player ranks on the chosen scoring system, the closer they stand to the Radcliffe Camera, which the leader holds.
- **Others:** newcomers wait at the station, retired players are in the Ashmolean, and the winner of the latest game wears a crown.
- **Replay the league:** steps through every game so you can watch everyone move.

There are 16 secrets around the site, all harmless and all quieter for anyone whose device asks for reduced motion. The Map has a riddle for each, at a landmark, and marks the ones this browser has found. The answers are at the top of `js/ui/delights.js`, for anyone who would rather not find them the fun way.

## Credits

Game facts and rulebook links come from [catan.com](https://www.catan.com/understand-catan/game-rules). The rules summary is written in our own words, and the official rulebooks remain the authority.

The Plackett-Luce system follows Weng and Lin (2011), "A Bayesian Approximation Method for Online Ranking", *Journal of Machine Learning Research*.

FLFOxtan is an independent fan league. It is not affiliated with, sponsored by or endorsed by CATAN GmbH, CATAN Studio or the University of Oxford.
