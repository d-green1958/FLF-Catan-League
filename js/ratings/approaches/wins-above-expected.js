// Wins, minus the 1-in-N share that chance would give you at a table of N.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat, game) => (seat.isWinner ? 1 : 0) - 1 / game.size,
});
