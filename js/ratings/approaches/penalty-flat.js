// Start with a pot of points and lose the same amount for every defeat.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat, game, params) => (seat.isWinner ? 0 : -params.penalty),
  finish: (total, games, params) => Math.max(0, params.start + total),
});
