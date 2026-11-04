// One point per win.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat) => (seat.isWinner ? 1 : 0),
});
