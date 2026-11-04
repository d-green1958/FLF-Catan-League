// A penalty ladder. Losing to a stronger winner costs less, and losing to a weaker winner costs more.
// Strength comes from a Standard Elo rating that runs in the background.
import { createElo, expectedScore, pairKey, repeatWeight } from '../elo.js';

const backgroundElo = createElo({ winnerOnly: true });
const ELO_START = 1000;

export default {
  // decided: how many games each pair has played where one of the two won.
  init: () => ({ points: new Map(), elo: backgroundElo.init(), decided: new Map() }),

  apply(state, game, params) {
    const eloParams = { start: ELO_START, k: params.k };
    const winner = game.seats.find((seat) => seat.isWinner);
    const winnerRating = backgroundElo.score(state.elo, winner.playerId, eloParams);

    for (const seat of game.seats) {
      if (seat.isWinner) continue;
      const rating = backgroundElo.score(state.elo, seat.playerId, eloParams);
      const key = pairKey(seat.playerId, winner.playerId);
      const timesMet = state.decided.get(key) || 0;
      const penalty = params.penalty * 2 * expectedScore(rating, winnerRating) * repeatWeight(timesMet, params.halfLife);
      state.points.set(seat.playerId, (state.points.get(seat.playerId) ?? params.start) - penalty);
      state.decided.set(key, timesMet + 1);
    }
    backgroundElo.apply(state.elo, game, eloParams);
  },

  score: (state, playerId, params) => Math.max(0, state.points.get(playerId) ?? params.start),
};
