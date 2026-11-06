// Plain statistics worked out from normalised games. Nothing here touches the page.
import { repeatWeight, pairKey } from '../ratings/elo.js';
import { winnerSeat } from './games.js';

const share = (part, whole) => (whole ? part / whole : 0);

function gamesFor(games, playerId) {
  return games.filter((game) => game.seats.some((seat) => seat.playerId === playerId));
}

export function playerSummary(games, playerId) {
  const played = gamesFor(games, playerId);
  const seats = played.map((game) => game.seats.find((seat) => seat.playerId === playerId));
  const wins = seats.filter((seat) => seat.isWinner).length;
  return {
    games: played.length,
    wins,
    losses: played.length - wins,
    winRate: share(wins, played.length),
    averageVp: share(seats.reduce((sum, seat) => sum + seat.vp, 0), played.length),
    averagePlace: share(seats.reduce((sum, seat) => sum + seat.place, 0), played.length),
    longestRoutes: played.filter((game) => game.longestRoute === playerId).length,
    largestArmies: played.filter((game) => game.largestArmy === playerId).length,
    lastPlayed: played.at(-1)?.date ?? null,
  };
}

/** Each opponent a player has met: how many games together, and who won them. */
export function headToHead(games, playerId, halfLife) {
  const rows = new Map();
  for (const game of gamesFor(games, playerId)) {
    const winner = winnerSeat(game)?.playerId;
    for (const seat of game.seats) {
      if (seat.playerId === playerId) continue;
      const row = rows.get(seat.playerId) || { playerId: seat.playerId, games: 0, wins: 0, theirWins: 0 };
      row.games += 1;
      if (winner === playerId) row.wins += 1;
      if (winner === seat.playerId) row.theirWins += 1;
      rows.set(seat.playerId, row);
    }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, influence: repeatWeight(row.games, halfLife) }))
    .sort((a, b) => b.games - a.games);
}

/** How often each colour was played and won with. Pass a player id to limit it to one player. */
export function colourStats(games, colours, playerId = null) {
  return colours.map((colour) => {
    const seats = games.flatMap((game) => game.seats)
      .filter((seat) => seat.colour === colour.id && (!playerId || seat.playerId === playerId));
    const wins = seats.filter((seat) => seat.isWinner).length;
    return { ...colour, games: seats.length, wins, winRate: share(wins, seats.length) };
  });
}

/** Does going first help? Also gives the win rate you would expect by chance, given the table sizes. */
export function turnOrderStats(games) {
  const positions = new Map();
  for (const game of games) {
    for (const seat of game.seats) {
      const row = positions.get(seat.turnOrder) || { position: seat.turnOrder, games: 0, wins: 0, expectedWins: 0 };
      row.games += 1;
      row.expectedWins += 1 / game.size;
      if (seat.isWinner) row.wins += 1;
      positions.set(seat.turnOrder, row);
    }
  }
  return [...positions.values()]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ ...row, winRate: share(row.wins, row.games), expectedRate: share(row.expectedWins, row.games) }));
}

export function tableSizeStats(games) {
  const counts = new Map();
  for (const game of games) counts.set(game.size, (counts.get(game.size) || 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, games: count }));
}

export function expansionStats(games, catalogue) {
  const options = [catalogue.base, ...catalogue.expansions, ...catalogue.extras];
  const usesOnlyBase = games.filter((game) => game.expansions.length === 0).length;
  return options
    .map((option) => ({
      id: option.id,
      name: option.id === 'base' ? 'Base game only' : option.name,
      games: option.id === 'base' ? usesOnlyBase : games.filter((game) => game.expansions.includes(option.id)).length,
    }))
    .filter((row) => row.games > 0)
    .sort((a, b) => b.games - a.games);
}

/** How many games each pair has shared, and how much their next game together would count. */
export function pairStats(games, halfLife) {
  const pairs = new Map();
  for (const game of games) {
    for (let i = 0; i < game.seats.length; i += 1) {
      for (let j = i + 1; j < game.seats.length; j += 1) {
        const [a, b] = [game.seats[i].playerId, game.seats[j].playerId];
        const key = pairKey(a, b);
        const row = pairs.get(key) || { key, players: a < b ? [a, b] : [b, a], games: 0 };
        row.games += 1;
        pairs.set(key, row);
      }
    }
  }
  return [...pairs.values()]
    .map((row) => ({ ...row, influence: repeatWeight(row.games, halfLife) }))
    .sort((a, b) => b.games - a.games);
}

function longestWinStreak(games, playerId) {
  let best = 0;
  let current = 0;
  for (const game of gamesFor(games, playerId)) {
    current = winnerSeat(game)?.playerId === playerId ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** Everything on a player's profile beyond the headline numbers. Games must be in date order. */
export function playerDetails(games, playerId) {
  const played = gamesFor(games, playerId);
  const seats = played.map((game) => ({ game, seat: game.seats.find((seat) => seat.playerId === playerId) }));

  const tally = (keyOf) => {
    const rows = new Map();
    for (const { game, seat } of seats) {
      const key = keyOf(game, seat);
      const row = rows.get(key) || { key, games: 0, wins: 0 };
      row.games += 1;
      if (seat.isWinner) row.wins += 1;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => a.key - b.key).map((row) => ({ ...row, winRate: share(row.wins, row.games) }));
  };

  const margins = seats.filter(({ seat }) => seat.isWinner).map(({ game, seat }) =>
    seat.vp - Math.max(...game.seats.filter((other) => other.playerId !== playerId).map((other) => other.vp)));

  let streak = 0;
  const latestWon = seats.at(-1)?.seat.isWinner ?? false;
  for (const { seat } of [...seats].reverse()) {
    if (seat.isWinner !== latestWon) break;
    streak += 1;
  }

  const opponents = headToHead(games, playerId, 1);
  const mostBy = (key) => opponents.reduce((top, row) => (row[key] > (top?.[key] ?? 0) ? row : top), null);

  return {
    finishes: tally((game, seat) => seat.place),
    byTableSize: tally((game) => game.size),
    byTurnOrder: tally((game, seat) => seat.turnOrder),
    recentForm: seats.slice(-5).map(({ game, seat }) => ({ gameId: game.id, date: game.date, won: seat.isWinner, place: seat.place, size: game.size, vp: seat.vp })),
    streak: { won: latestWon, length: streak },
    longestWinStreak: longestWinStreak(games, playerId),
    bestScore: Math.max(0, ...seats.map(({ seat }) => seat.vp)),
    biggestWin: Math.max(0, ...margins),
    nemesis: mostBy('theirWins'),
    favouriteOpponent: mostBy('wins'),
  };
}

const MILESTONES = [
  { title: 'First win', detail: 'Won a league game', earned: (s) => s.wins >= 1 },
  { title: 'Hat-trick', detail: 'Won three games in a row', earned: (s, d) => d.longestWinStreak >= 3 },
  { title: 'Regular', detail: 'Played 10 games', earned: (s) => s.games >= 10 },
  { title: 'Veteran', detail: 'Played 25 games', earned: (s) => s.games >= 25 },
  { title: 'Ten wins', detail: 'Won 10 games', earned: (s) => s.wins >= 10 },
  { title: 'Landslide', detail: 'Won by 5 VP or more', earned: (s, d) => d.biggestWin >= 5 },
  { title: 'Road warrior', detail: 'Held Longest Route in 5 games', earned: (s) => s.longestRoutes >= 5 },
  { title: 'Warlord', detail: 'Held Largest Army in 5 games', earned: (s) => s.largestArmies >= 5 },
];

export const milestonesEarned = (summary, details) => MILESTONES.filter((milestone) => milestone.earned(summary, details));

/** The trophy cabinet. Each record is null until there is a game to base it on. */
export function records(games, profiles) {
  if (!games.length || !profiles.length) return [];

  const best = (rows, valueOf) => rows.reduce((top, row) => (valueOf(row) > valueOf(top) ? row : top), rows[0]);
  const summaries = profiles.map((player) => ({ player, ...playerSummary(games, player.id), streak: longestWinStreak(games, player.id) }));
  const entries = [];

  const addPlayerRecord = (title, key, unit) => {
    const top = best(summaries, (row) => row[key]);
    if (top[key] > 0) entries.push({ title, playerId: top.player.id, value: `${top[key]} ${unit}${top[key] === 1 ? '' : 's'}` });
  };
  addPlayerRecord('Most wins', 'wins', 'win');
  addPlayerRecord('Most games played', 'games', 'game');
  addPlayerRecord('Longest win streak', 'streak', 'win');
  addPlayerRecord('Longest Route specialist', 'longestRoutes', 'game');
  addPlayerRecord('Largest Army specialist', 'largestArmies', 'game');

  const margins = games.map((game) => {
    const winner = winnerSeat(game);
    const runnerUp = Math.max(...game.seats.filter((seat) => !seat.isWinner).map((seat) => seat.vp));
    return { game, winner, margin: winner.vp - runnerUp };
  });
  const biggest = best(margins, (row) => row.margin);
  entries.push({ title: 'Biggest winning margin', playerId: biggest.winner.playerId, value: `${biggest.margin} VP`, gameId: biggest.game.id });

  const topScore = best(margins, (row) => row.winner.vp);
  entries.push({ title: 'Highest winning score', playerId: topScore.winner.playerId, value: `${topScore.winner.vp} VP`, gameId: topScore.game.id });

  return entries;
}
