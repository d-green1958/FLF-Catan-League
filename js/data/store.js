// The single place the app reads and changes players and games.
//
// A static site cannot write to its own repo, so data lives in two layers:
//   1. Published data: the JSON files in data/, which everyone sees.
//   2. Browser draft:  additions, edits and deletions made in this browser, kept in localStorage.
// The app shows (1) with (2) applied on top. Exporting from the Save & share page and committing the
// files moves the draft into the published layer. To move to a shared database later, this is the
// only file that needs to change.
import * as storage from './browser-storage.js';

const LIVE_DRAFT = 'flfoxtan.draft';
const DEMO_DRAFT = 'flfoxtan.demo-draft';
const MODE_KEY = 'flfoxtan.mode';
const COLLECTIONS = ['profiles', 'games'];

const emptyDraft = () => ({ profiles: { saved: {}, deleted: [] }, games: { saved: {}, deleted: [] } });

const listeners = new Set();
let reference = null;
let mode = 'live';
let published = { profiles: [], games: [] };
let draft = emptyDraft();

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

async function loadPublished() {
  const folder = mode === 'demo' ? 'data/demo' : 'data';
  const [profiles, games] = await Promise.all([fetchJson(`${folder}/profiles.json`), fetchJson(`${folder}/games.json`)]);
  published = { profiles: profiles.profiles, games: games.games };
  draft = storage.read(draftKey(), emptyDraft());
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
    const [league, colours, expansions, rules, approaches] = await Promise.all(
      ['league', 'colours', 'expansions', 'rules', 'rating-approaches'].map((name) => fetchJson(`data/${name}.json`)),
    );
    reference = {
      league,
      colours: colours.colours,
      expansions,
      rules,
      approaches: approaches.approaches,
      families: approaches.families,
    };
    mode = storage.read(MODE_KEY) === 'demo' ? 'demo' : 'live';
    await loadPublished();
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reference: () => reference,
  mode: () => mode,
  profiles: () => merged('profiles'),
  games: () => merged('games'),
  player: (id) => merged('profiles').find((player) => player.id === id),
  game: (id) => merged('games').find((game) => game.id === id),

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
    for (const collection of COLLECTIONS) {
      const byId = new Map(published[collection].map((item) => [item.id, JSON.stringify(item)]));
      const changed = Object.values(draft[collection].saved).filter((item) => byId.get(item.id) !== JSON.stringify(item));
      const deleted = draft[collection].deleted.filter((id) => byId.has(id));
      summary[collection] = {
        added: changed.filter((item) => !byId.has(item.id)).length,
        edited: changed.filter((item) => byId.has(item.id)).length,
        deleted: deleted.length,
      };
      total += changed.length + deleted.length;
    }
    return { ...summary, total };
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
