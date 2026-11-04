// Win rate, with a few imaginary average games added so that small samples stay near average.
import { createTally } from '../tally.js';

export default createTally({
  add: (seat) => (seat.isWinner ? 1 : 0),
  finish: (wins, games, params) => {
    const totalGames = games + params.priorGames;
    return totalGames > 0 ? (wins + params.priorGames * params.priorRate) / totalGames : 0;
  },
});
