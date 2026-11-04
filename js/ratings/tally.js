// The shared engine for simple running totals (wins, league points, penalties).
// Each approach says what a seat adds to the total, and how to turn the total into a score.

export function createTally({
  add,                                     // (seat, game, params) => amount to add to this player's total
  finish = (total) => total,               // (total, gamesPlayed, params) => the score shown
}) {
  return {
    init: () => ({ totals: new Map(), played: new Map() }),

    apply(state, game, params) {
      for (const seat of game.seats) {
        state.totals.set(seat.playerId, (state.totals.get(seat.playerId) || 0) + add(seat, game, params));
        state.played.set(seat.playerId, (state.played.get(seat.playerId) || 0) + 1);
      }
    },

    score(state, playerId, params) {
      return finish(state.totals.get(playerId) || 0, state.played.get(playerId) || 0, params);
    },
  };
}
