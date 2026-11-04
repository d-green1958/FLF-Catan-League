// Runs scoring systems over the games. Scores are never stored: they are replayed from the game
// history, so correcting or back-dating a game automatically fixes every rating after it.

/** Loads each approach's file from js/ratings/approaches/, matched by its id in rating-approaches.json. */
export async function loadApproachModules(catalogue) {
  const modules = new Map();
  await Promise.all(catalogue.map(async (entry) => {
    modules.set(entry.id, (await import(`./approaches/${entry.id}.js`)).default);
  }));
  return modules;
}

export function defaultParams(entry) {
  return Object.fromEntries((entry.parameters || []).map((param) => [param.key, param.value]));
}

/**
 * Replays the games in order through one scoring system.
 * Returns the final score function, plus what changed for each player in each game.
 */
export function runApproach(approach, games, params) {
  const state = approach.init(params);
  const timeline = games.map((game) => {
    const before = new Map(game.seats.map((seat) => [seat.playerId, approach.score(state, seat.playerId, params)]));
    approach.apply(state, game, params);
    const changes = game.seats.map((seat) => {
      const after = approach.score(state, seat.playerId, params);
      return { playerId: seat.playerId, before: before.get(seat.playerId), after, change: after - before.get(seat.playerId) };
    });
    return { gameId: game.id, date: game.date, changes };
  });
  return { timeline, scoreOf: (playerId) => approach.score(state, playerId, params) };
}

/** A player's score after every game in the league, or null before they first played. Used by charts. */
export function scoreHistory(run, playerId) {
  let current = null;
  return run.timeline.map((entry) => {
    const change = entry.changes.find((row) => row.playerId === playerId);
    if (change) current = change.after;
    return current;
  });
}

/** Sorts players by score. Equal scores share a rank. */
export function rankPlayers(run, playerIds) {
  const rows = playerIds
    .map((playerId) => ({ playerId, score: run.scoreOf(playerId) }))
    .sort((a, b) => b.score - a.score);
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank = previous && Math.abs(previous.score - row.score) < 1e-9 ? previous.rank : index + 1;
  });
  return rows;
}
