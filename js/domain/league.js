// Brings stored data and the scoring systems together into one snapshot for the pages to display.
// Rebuilt whenever a player, game or setting changes.
import { store } from '../data/store.js';
import { settings } from '../data/settings.js';
import { normaliseGames } from './games.js';
import { playerSummary } from './stats.js';
import { defaultParams, rankPlayers, runApproach } from '../ratings/engine.js';

let modules = new Map();
let cached = null;
const clearCache = () => { cached = null; };
store.subscribe(clearCache);
settings.subscribe(clearCache);

export function useApproachModules(loaded) {
  modules = loaded;
  clearCache();
}

export function paramsFor(entry) {
  return { ...defaultParams(entry), ...(settings.get('paramOverrides')[entry.id] || {}) };
}

export function isEnabled(entry) {
  return settings.get('enabledOverrides')[entry.id] ?? entry.enabled;
}

export function getLeague() {
  if (cached) return cached;

  const reference = store.reference();
  const profiles = store.profiles();
  const games = normaliseGames(store.games());
  const runs = new Map();
  for (const entry of reference.approaches) {
    if (modules.has(entry.id)) runs.set(entry.id, runApproach(modules.get(entry.id), games, paramsFor(entry)));
  }

  const summaries = new Map(profiles.map((player) => [player.id, playerSummary(games, player.id)]));
  const approaches = reference.approaches.filter((entry) => runs.has(entry.id) && isEnabled(entry));

  cached = { reference, profiles, games, runs, summaries, approaches };
  return cached;
}

/** The system on show: the viewer's last choice if it is still enabled, otherwise the league default. */
export function selectedApproach(league) {
  const chosen = league.approaches.find((entry) => entry.id === settings.get('approachId'));
  const fallback = league.approaches.find((entry) => entry.id === league.reference.league.settings.defaultApproach);
  return chosen || fallback || league.approaches[0];
}

/** Everyone who has played, ranked by one system. Players with no games are not ranked. */
export function leaderboard(league, approachId, { includeRetired = false } = {}) {
  const run = league.runs.get(approachId);
  const eligible = league.profiles
    .filter((player) => league.summaries.get(player.id).games > 0)
    .filter((player) => includeRetired || player.active !== false);
  const ranked = rankPlayers(run, eligible.map((player) => player.id));
  const provisional = league.reference.league.settings.provisionalGames;

  return ranked.map((row) => {
    const summary = league.summaries.get(row.playerId);
    return {
      ...row,
      player: league.profiles.find((player) => player.id === row.playerId),
      summary,
      provisional: summary.games < provisional,
      lastChange: latestChange(run, row.playerId),
    };
  });
}

function latestChange(run, playerId) {
  for (let i = run.timeline.length - 1; i >= 0; i -= 1) {
    const change = run.timeline[i].changes.find((row) => row.playerId === playerId);
    if (change) return change.change;
  }
  return 0;
}

export function nameOf(league, playerId) {
  return league.profiles.find((player) => player.id === playerId)?.name ?? 'Unknown player';
}
