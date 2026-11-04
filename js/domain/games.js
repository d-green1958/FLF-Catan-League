// Turns a stored game into the richer form the rest of the app uses.

/** Oldest first. Ratings replay games in this order, so a back-dated game slots into its correct place. */
export function sortGames(games) {
  return [...games].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.time || '').localeCompare(b.time || '')
    || a.id.localeCompare(b.id));
}

/**
 * Adds to each seat:
 *   isWinner  - did this player win?
 *   place     - finishing place. The winner is 1st; everyone else is ordered by VPs, and ties share a place.
 *   turnOrder - 1 for the player who went first.
 */
export function normaliseGame(game) {
  const seats = game.seats.map((seat, index) => ({
    ...seat,
    isWinner: seat.playerId === game.winnerId,
    turnOrder: index + 1,
  }));

  const finishing = [...seats].sort((a, b) => (b.isWinner - a.isWinner) || (b.vp - a.vp));
  finishing.forEach((seat, index) => {
    const previous = finishing[index - 1];
    const tied = previous && !previous.isWinner && previous.vp === seat.vp;
    seat.place = tied ? previous.place : index + 1;
  });

  return { ...game, seats, size: seats.length, expansions: game.expansions || [] };
}

export function normaliseGames(games) {
  return sortGames(games).map(normaliseGame);
}

export function winnerSeat(game) {
  return game.seats.find((seat) => seat.isWinner);
}
