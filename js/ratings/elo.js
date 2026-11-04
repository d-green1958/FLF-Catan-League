// The shared Elo engine. Each Elo-family approach is a short file that switches these options on or off.
//
// How a game is scored: the table is broken into two-player "virtual matches". Each match compares the
// expected result (from the current ratings) with what really happened, and moves both ratings accordingly.
// K is divided by (players - 1), so one player's total swing stays similar at any table size.

export const expectedScore = (rating, opponent) => 1 / (1 + 10 ** ((opponent - rating) / 400));

/** The exponential decay: 1 for a first meeting, 0.5 after one half-life, 0.25 after two, and so on. */
export const repeatWeight = (timesMet, halfLife) => (halfLife > 0 ? 2 ** (-timesMet / halfLife) : 1);

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Whoever finished higher wins the virtual match. Same place is a draw. */
export const placementResult = (a, b) => {
  if (a.place === b.place) return 0.5;
  return a.place < b.place ? 1 : 0;
};

/** A virtual result based on the VP gap as a share of the target: 0.5 for level, 1 for a full-target gap. */
export const vpMarginResult = (a, b, game) => Math.min(1, Math.max(0, 0.5 + (a.vp - b.vp) / (2 * game.vpTarget)));

/** Pulls a rating towards the start until a player has enough games to back it up. */
export const withConfidence = (rating, start, games, confidenceGames) => {
  if (confidenceGames <= 0) return rating;
  return start + (rating - start) * (games / (games + confidenceGames));
};

export function createElo({
  winnerOnly = false,          // true: only winner v each loser. false: every pair at the table.
  result = placementResult,    // what counts as the result of a virtual match
  kFor = (gamesPlayed, params) => params.k, // a player's K, which may depend on their experience
  gameWeight = () => 1,        // multiplies the whole game, e.g. by table size
  repeatDecay = false,         // true: repeat pairings count for less, using params.halfLife
  display = (rating) => rating, // turns the hidden rating into the shown score
} = {}) {
  return {
    init: () => ({ ratings: new Map(), played: new Map(), met: new Map() }),

    apply(state, game, params) {
      const ratingOf = (id) => state.ratings.get(id) ?? params.start;
      const changes = new Map(game.seats.map((seat) => [seat.playerId, 0]));
      const opponents = game.size - 1;
      const weightOfGame = gameWeight(game, params);

      for (let i = 0; i < game.seats.length; i += 1) {
        for (let j = i + 1; j < game.seats.length; j += 1) {
          const [a, b] = [game.seats[i], game.seats[j]];
          const key = pairKey(a.playerId, b.playerId);
          const timesMet = state.met.get(key) || 0;

          if (!winnerOnly || a.isWinner || b.isWinner) {
            const surprise = result(a, b, game) - expectedScore(ratingOf(a.playerId), ratingOf(b.playerId));
            const weight = weightOfGame * (repeatDecay ? repeatWeight(timesMet, params.halfLife) : 1);
            const kA = kFor(state.played.get(a.playerId) || 0, params);
            const kB = kFor(state.played.get(b.playerId) || 0, params);
            changes.set(a.playerId, changes.get(a.playerId) + (kA * weight * surprise) / opponents);
            changes.set(b.playerId, changes.get(b.playerId) - (kB * weight * surprise) / opponents);
          }
          state.met.set(key, timesMet + 1);
        }
      }

      // Everyone updates together, so seat order cannot change the result.
      for (const [id, change] of changes) {
        state.ratings.set(id, ratingOf(id) + change);
        state.played.set(id, (state.played.get(id) || 0) + 1);
      }
    },

    score(state, playerId, params) {
      const rating = state.ratings.get(playerId) ?? params.start;
      return display(rating, params, state.played.get(playerId) || 0);
    },
  };
}
