// The single place the app reads and changes players and games.
//
// A static site cannot write to its own repo, so data lives in two layers:
//   1. Published data: the JSON files in data/, which everyone sees.
//   2. Browser draft:  someone's additions, edits and deletions, kept in localStorage until they go live.
// The app shows (1) with (2) applied on top. See js/forms/send-dialog.js for how a draft gets sent, and
// js/domain/submission.js for how the repo accepts it. Once a change is live it drops out of the draft.
// Submissions too recent to be published yet count as published: see js/domain/live-issues.js.
import * as storage from './browser-storage.js';
import { applyRecentIssues, compactIssue, isRecentIssue } from '../domain/live-issues.js';
import { isPersonalEdit } from '../domain/validate.js';

const LIVE_DRAFT = 'flfoxtan.draft';
const DEMO_DRAFT = 'flfoxtan.demo-draft';
const MODE_KEY = 'flfoxtan.mode';
const ISSUES_KEY = 'flfoxtan.recent-issues';
const COLLECTIONS = ['profiles', 'games'];
// GitHub allows 60 checks an hour per network without a login, so these are rationed, and refused checks wait.
const ISSUE_CHECK_GAP_MS = 60 * 1000;
const ISSUE_CHECK_RETRY_MS = 5 * 60 * 1000;

const emptyDraft = () => ({ profiles: { saved: {}, deleted: [] }, games: { saved: {}, deleted: [] } });

const listeners = new Set();
let reference = null;
let mode = 'live';
let files = { profiles: [], games: [], activity: [] };
let published = files;
let recentIssues = [];
let outcomes = [];
let nextIssueCheck = 0;
let issueCheckAllowedAfter = 0;
let draft = emptyDraft();

/** "fresh" skips the web cache, as GitHub Pages can otherwise serve a file up to ten minutes old. */
async function fetchJson(path, { fresh = false } = {}) {
  const response = await fetch(fresh ? `${path}?t=${Date.now()}` : path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

async function loadPublished() {
  const folder = mode === 'demo' ? 'data/demo' : 'data';
  const [profiles, games, activity] = await Promise.all(
    ['profiles', 'games', 'activity'].map((name) => fetchJson(`${folder}/${name}.json`, { fresh: true })),
  );
  files = { profiles: profiles.profiles, games: games.games, activity: activity.activity };
  draft = storage.read(draftKey(), emptyDraft());
  await rebuildPublished();
}

/** Works out what counts as published: the files, plus any submissions too recent to be in them yet. */
async function rebuildPublished() {
  if (mode === 'demo') {
    published = files;
    outcomes = [];
  } else {
    recentIssues = recentIssues.filter((issue) => isRecentIssue(issue));
    const { outcomes: results, ...data } = await applyRecentIssues(files, recentIssues, reference);
    published = data;
    outcomes = results;
  }
  clearPublishedFromDraft();
}

function rememberIssues(issues) {
  const byNumber = new Map(recentIssues.map((issue) => [issue.number, issue]));
  for (const issue of issues) byNumber.set(issue.number, issue);
  recentIssues = [...byNumber.values()].filter((issue) => isRecentIssue(issue));
  storage.write(ISSUES_KEY, recentIssues);
}

/**
 * Once a change is live, it no longer belongs in the draft. Without this, an old local copy would
 * keep hiding any later correction made by another admin.
 */
function clearPublishedFromDraft() {
  for (const collection of COLLECTIONS) {
    const byId = new Map(published[collection].map((item) => [item.id, JSON.stringify(item)]));
    for (const item of Object.values(draft[collection].saved)) {
      if (byId.get(item.id) === JSON.stringify(item)) delete draft[collection].saved[item.id];
    }
    draft[collection].deleted = draft[collection].deleted.filter((id) => byId.has(id));
  }
  storage.write(draftKey(), draft);
}

const draftKey = () => (mode === 'demo' ? DEMO_DRAFT : LIVE_DRAFT);
const announce = () => listeners.forEach((listener) => listener());
const persist = () => { storage.write(draftKey(), draft); announce(); };

function merged(collection) {
  const { saved, deleted } = draft[collection];
  const publishedIds = new Set(published[collection].map((item) => item.id));
  return [
    ...published[collection].filter((item) => !deleted.includes(item.id)).map((item) => saved[item.id] || item),
    ...Object.values(saved).filter((item) => !publishedIds.has(item.id)),
  ];
}

function saveItem(collection, item) {
  draft[collection].saved[item.id] = item;
  draft[collection].deleted = draft[collection].deleted.filter((id) => id !== item.id);
  persist();
}

function deleteItem(collection, id) {
  delete draft[collection].saved[id];
  if (published[collection].some((item) => item.id === id)) draft[collection].deleted.push(id);
  persist();
}

function slugify(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
}

/** Readable ids (like "ada" or "ada-2") make games.json easier to read by hand. */
function newPlayerId(name) {
  const taken = new Set(store.profiles().map((player) => player.id));
  const base = slugify(name);
  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;
  return id;
}

function newGameId(date) {
  const taken = new Set(store.games().map((game) => game.id));
  let id;
  do {
    id = `${date}-${Math.random().toString(16).slice(2, 6)}`;
  } while (taken.has(id));
  return id;
}

/** Puts the file header and a sensible structure back around the data for download. */
function exportDocument(collection) {
  const notes = {
    profiles: 'Registered players. Export from the Save & share page, or edit by hand. This repo is public, so use first names or nicknames.',
    games: 'Every league game. Seats are listed in turn order, so the first seat is the player who went first. Ratings are never stored: they are recalculated from this file.',
  };
  const items = merged(collection);
  const sorted = collection === 'games'
    ? [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    : items;
  return { _readme: notes[collection], [collection]: sorted };
}

export const store = {
  async init() {
    const [league, colours, expansions, rules, approaches, profileOptions] = await Promise.all(
      ['league', 'colours', 'expansions', 'rules', 'rating-approaches', 'profile-options'].map((name) => fetchJson(`data/${name}.json`)),
    );
    reference = {
      league,
      colours: colours.colours,
      expansions,
      rules,
      profileOptions,
      approaches: approaches.approaches,
      families: approaches.families,
    };
    mode = storage.read(MODE_KEY) === 'demo' ? 'demo' : 'live';
    recentIssues = storage.read(ISSUES_KEY, []);
    await loadPublished();
  },

  /** Checks for newly published data, and only redraws the page if there is some. */
  async reloadPublished() {
    const before = JSON.stringify([published, outcomes]);
    await loadPublished();
    if (JSON.stringify([published, outcomes]) !== before) announce();
  },

  /** Adds an issue this browser has just opened, so its result shows at once. */
  async addIssue(issue) {
    rememberIssues([compactIssue(issue)]);
    await rebuildPublished();
    announce();
  },

  /** Asks GitHub for new submissions. Rationed unless "now" is set. A failure just means waiting for the next deploy. */
  async checkIssues({ now = false } = {}) {
    const time = Date.now();
    if (mode === 'demo' || time < issueCheckAllowedAfter || (!now && time < nextIssueCheck)) return;
    nextIssueCheck = time + ISSUE_CHECK_GAP_MS;
    const { owner, name } = reference.league.repository;
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${name}/issues?state=all&per_page=20&sort=created&direction=desc`, { cache: 'no-cache' });
      if (!response.ok) {
        issueCheckAllowedAfter = time + ISSUE_CHECK_RETRY_MS;
        return;
      }
      const before = JSON.stringify(recentIssues);
      rememberIssues((await response.json()).map(compactIssue));
      if (JSON.stringify(recentIssues) === before) return;
      const shown = JSON.stringify([published, outcomes]);
      await rebuildPublished();
      if (JSON.stringify([published, outcomes]) !== shown) announce();
    } catch {
      issueCheckAllowedAfter = time + ISSUE_CHECK_GAP_MS;
    }
  },

  /** What happened to the submission containing this text, if GitHub has it yet. */
  issueOutcome: (text) => outcomes.findLast((outcome) => outcome.body.includes(text)),

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Redraws the page when something outside the store changes what it should show. */
  refresh: announce,

  reference: () => reference,
  mode: () => mode,
  profiles: () => merged('profiles'),
  games: () => merged('games'),
  player: (id) => merged('profiles').find((player) => player.id === id),
  game: (id) => merged('games').find((game) => game.id === id),

  /** Everything added, edited and removed, newest first. */
  activity: () => [...published.activity].reverse(),
  /** Who most recently added this item. */
  additionFor: (type, id) => published.activity.findLast((entry) => entry.action === 'added' && entry.type === type && entry.id === id),

  savePlayer(player) {
    const saved = { ...player, id: player.id || newPlayerId(player.name) };
    saveItem('profiles', saved);
    return saved;
  },

  /** Players with game history cannot be deleted, as that would break those games. Retire them instead. */
  canDeletePlayer: (id) => !merged('games').some((game) => game.seats.some((seat) => seat.playerId === id)),
  deletePlayer: (id) => deleteItem('profiles', id),

  saveGame(game) {
    const saved = { ...game, id: game.id || newGameId(game.date) };
    saveItem('games', saved);
    return saved;
  },
  deleteGame: (id) => deleteItem('games', id),

  /** What is in this browser's draft but not yet in the published files. */
  pendingChanges() {
    const summary = {};
    let total = 0;
    let needsCode = false;
    for (const collection of COLLECTIONS) {
      const originals = new Map(published[collection].map((item) => [item.id, item]));
      const byId = new Map(published[collection].map((item) => [item.id, JSON.stringify(item)]));
      const changed = Object.values(draft[collection].saved).filter((item) => byId.get(item.id) !== JSON.stringify(item));
      const deleted = draft[collection].deleted.filter((id) => byId.has(id));
      summary[collection] = {
        added: changed.filter((item) => !byId.has(item.id)).length,
        edited: changed.filter((item) => byId.has(item.id)).length,
        deleted: deleted.length,
      };
      total += changed.length + deleted.length;
      // Anyone can edit the personal details on a profile. Other changes to what is live need the admin code.
      const edits = changed.filter((item) => byId.has(item.id));
      const allowed = (item) => collection === 'profiles' && isPersonalEdit(originals.get(item.id), item);
      if (deleted.length || !edits.every(allowed)) needsCode = true;
    }
    return { ...summary, total, needsCode };
  },

  /** The waiting changes themselves, in the format used by js/domain/submission.js. */
  pendingPayload() {
    const payload = {};
    for (const collection of COLLECTIONS) {
      const byId = new Map(published[collection].map((item) => [item.id, JSON.stringify(item)]));
      payload[collection] = {
        saved: Object.values(draft[collection].saved).filter((item) => byId.get(item.id) !== JSON.stringify(item)),
        deleted: draft[collection].deleted.filter((id) => byId.has(id)),
      };
    }
    return payload;
  },

  exportJson: (collection) => `${JSON.stringify(exportDocument(collection), null, 2)}\n`,

  backupJson: () => `${JSON.stringify({ profiles: merged('profiles'), games: merged('games') }, null, 2)}\n`,

  /** Brings in a backup or a data file. Items are matched by id; matching items are replaced. */
  importData({ profiles = [], games = [] }) {
    for (const player of profiles) draft.profiles.saved[player.id] = player;
    for (const game of games) draft.games.saved[game.id] = game;
    draft.profiles.deleted = draft.profiles.deleted.filter((id) => !profiles.some((player) => player.id === id));
    draft.games.deleted = draft.games.deleted.filter((id) => !games.some((game) => game.id === id));
    persist();
  },

  discardDraft() {
    draft = emptyDraft();
    storage.remove(draftKey());
    announce();
  },

  async enterDemo() {
    mode = 'demo';
    storage.write(MODE_KEY, 'demo');
    await loadPublished();
    announce();
  },

  /** Leaving demo mode clears everything done inside it. Real data is never touched. */
  async exitDemo() {
    storage.remove(DEMO_DRAFT);
    mode = 'live';
    storage.remove(MODE_KEY);
    await loadPublished();
    announce();
  },
};
