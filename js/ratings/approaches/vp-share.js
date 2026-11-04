// Average share of the victory point target reached, capped at 100% per game.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat, game) => Math.min(1, seat.vp / game.vpTarget),
  finish: (total, games) => (games > 0 ? total / games : 0),
});
