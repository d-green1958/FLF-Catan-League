# FLFOxtan briefing

A plain-language overview of the league site: what it does, how people use it, how it works underneath, and what needs looking after. For commands and setup steps, see the [README](README.md).

## In one paragraph

FLFOxtan is the website for the Fun Lunch Friday Oxford Catan group, founded on 4 November 2026. People register as players and log the games they play. The site then ranks everyone in 16 different ways, so the group can decide which system feels fairest. It lives entirely on GitHub, with no other services and no accounts to create. GitHub stores the data and publishes the site, and a small automated step on GitHub checks every change before saving it.

Live site: <https://d-green1958.github.io/FLF-Catan-League/>

## What is on the site

| Page | What it shows |
|---|---|
| **Leaderboard** | Rankings under the chosen scoring system, plus **Compare all** to see where the systems disagree |
| **Games** | Every game logged, and the form to log a new one |
| **Players** | Everyone registered. Each profile has a photo, signature move, play style and other details, plus stats: record, form, streaks, nemesis, where they finish, win rate by table size and turn order, rating over time and honours |
| **Insights** | League-wide patterns, such as whether going first helps, colour win rates and league records |
| **Scoring systems** | How each of the 16 systems works, its weaknesses, and settings anyone can try in their own browser |
| **Rules** | A summary of the Catan rules and the league's own rules |
| **About** | What the group is and when it meets |
| **Review** | Everything added, edited and removed, and by whom, where admins can correct or remove anything |

**Try the demo**, on the Review page, fills the site with made-up players and games for exploring. It never touches the real data.

## Who can do what

| Person | Can |
|---|---|
| **Anyone** | View everything. No account needed |
| **Anyone with the group password or a free GitHub account** | Register players, log games, and edit the personal details on any profile: photo, nickname, signature move, about, favourite colour and resource, play style |
| **Admins (anyone with the admin code)** | Also change names and joining dates, retire players, correct games, and remove anything |

Everything goes live without waiting for approval. Admins check the **Review** page afterwards and tidy up anything spurious. The log records who did what, so an unwanted edit can be found and reversed.

## Adding something

1. Fill in the form and save. To log a game, tap the players in turn order, type each score and press **Log game**. Time, place, expansions, target and notes are tucked under **More details**. To add several players at once, use **Register several** (a list of names) or **Save and add another**.
2. The first time, the site asks for **your name and the group password**, with **Remember me on this device** ticked. After that, this device sends straight away and never asks again. **Forget** (at the bottom of the sidebar, or under **More** on a phone) clears it.
   - **Use a GitHub account instead:** a GitHub page opens with everything filled in. Press the green button, then come back to the site.
   - **Not now:** the change stays in your browser, with a notice at the top of every page to send or discard it later.
3. Admins who have entered the admin code are not asked anything. Their changes go straight in.

If the league refuses something, the notice at the top of the site says why. Common reasons are a name that is already taken, or a change that needs the admin code.

## How fast changes appear

| Who | When they see the change |
|---|---|
| The person who sent it, with the group password or admin code | As soon as GitHub replies, usually within a second or two |
| The person who sent it, with a GitHub account | Within about 5 seconds of pressing the green button and switching back to the site |
| Anyone else opening the site, or returning to its tab | Straight away, at most one check a minute |
| Anyone else with the site already open and untouched | About a minute |

**Why it works like this:** permanently saving and republishing takes GitHub about 40 seconds. The site gets around that by reading each submission directly from GitHub the moment it exists, and applying the same checks the permanent save uses. GitHub limits how often browsers without a login can check (60 times an hour per network), so other people's open tabs check less often.

## How it works underneath

```text
 Browser                          GitHub
 ───────                          ──────
 Form saved ──► GitHub issue ───► League submission Action
     │          (the request)        checks it, commits to data/,
     │                               closes the issue with a reply
     │                                        │
     └── reads recent issues ◄────────────────┤
         and shows them at once               ▼
                                   Deploy Action republishes the site
```

- **The data** is a set of plain JSON files in `data/`: players, games, the activity log, and reference lists such as colours, expansions and scoring systems. They can be read and edited by hand.
- **Each change is a GitHub issue.** Every submission becomes an issue whose title starts with `[League]`. A GitHub Action checks it and commits it to the data files, then closes the issue with a reply. Ordinary issues are ignored.
- **One gatekeeper.** The site and the Action share the same checking code (`js/domain/submission.js`), so they always agree on what is allowed.
- **Ratings are never stored.** Every system replays all games in date order each time a page loads, so correcting or back-dating a game fixes every rating after it.
- **No build step.** It is plain HTML, CSS and JavaScript, so any file can be edited directly.

## Security in brief

- **Admin code:** never stored anywhere. The repo holds only a public key made from it. The browser uses the code to sign an admin's changes, and the Action checks the signature. Signatures expire after an hour.
- **Group password:** it unlocks a GitHub token, stored in the repo in encrypted form. The token belongs to the repo owner and is limited to opening issues on this repo. The Action applies the same checks to these submissions, so the password grants no extra rights. With **Remember me** ticked, the unlocked token stays in that browser's storage, so anyone using that device can add to the league. Untick it on a shared computer. Changing the group password makes every remembered device ask again.
- **Admin access to the token:** a second encrypted copy of the token opens with the admin code, so admins need only the code.
- **Without the code**, a submission can only add, or edit the personal details on a profile. It cannot remove anything, change names or touch games already logged. One submission can add at most 25 things.
- **Photos** are shrunk and re-encoded in the browser, which strips hidden details such as location. Only JPEG and WebP pictures are accepted, and the Action checks this too.
- **Everything is public:** the site, the repo, the issues and the activity log. Names, photos and GitHub usernames stay in the Git history even after removal, so first names or nicknames are best.

## Looking after it

| Task | When | How |
|---|---|---|
| **Renew the GitHub token** | Before its expiry date, which the repo owner set when creating it | Create a new token, then run `set-group-password.js` and `set-admin-access.js` ([README](README.md#add-without-a-github-account)). When the token expires, the group password and the admins' direct sending stop working, though GitHub accounts still work |
| **Change the admin code** | If it leaks or an admin leaves | Delete the token on GitHub first, then run `set-admin-code.js`, create a new token, and run the two scripts above |
| **Change the group password** | If it leaks or someone leaves the group | Delete the token on GitHub first, then create a new one and run `set-group-password.js` and `set-admin-access.js` |
| **Undo vandalism** | Whenever spotted | An admin unlocks Review, then edits or removes the item. Its history stays in the log |
| **Retire or add a scoring system** | Whenever the group decides | Edit `data/rating-approaches.json`, and for a new system add one short file ([README](README.md#add-a-system)) |
| **Add profile options** | Whenever wanted | Add resources or play styles to `data/profile-options.json` |
| **Edit the About text or league settings** | Whenever wanted | Edit `data/league.json` |

All the scripts ask for secrets at hidden prompts. Type them yourself, and never paste them into chats, issues or commits. After running a script, commit and push `data/league.json`.

## Known limits

- **Anyone with a GitHub account can edit any profile's personal details**, including the photo, and the change shows until an admin reverses it. Limiting profile edits to the group password is a small change if this becomes a problem.
- **The GitHub-account route always needs one press of the green button on GitHub.** GitHub does not let a website submit for someone.
- **A big batch with several photos may go through GitHub in more than one submission**, because a GitHub link has a size limit. The site sends what fits and offers to send the rest. The group password route has much more room.
- **Names typed with the group password are not verified**, so they are marked "(group password)" on Review.
- **If GitHub's check limit runs out** on a shared network, changes from other people show up in about a minute instead of straight away. Nothing breaks.

## Where to look

| For | See |
|---|---|
| Setup, scripts and commands | [README.md](README.md) |
| Rules for Claude working in this repo | [CLAUDE.md](CLAUDE.md) |
| What the Action does with a submission | [.github/workflows/league-submission.yml](.github/workflows/league-submission.yml) |
| The rules every change must pass | [js/domain/submission.js](js/domain/submission.js) and [js/domain/validate.js](js/domain/validate.js) |
| How changes show up early | [js/domain/live-issues.js](js/domain/live-issues.js) |
| The scoring systems | [data/rating-approaches.json](data/rating-approaches.json) and [js/ratings/approaches/](js/ratings/approaches/) |
| Who added what | The **Review** page, or [data/activity.json](data/activity.json) |
