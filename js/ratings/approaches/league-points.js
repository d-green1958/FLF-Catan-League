// Fixed points for each finishing place, like a racing championship.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat, game, params) => [params.first, params.second, params.third, params.fourth][seat.place - 1] ?? 0,
});
