// Placement Elo, where bigger tables move ratings further.
import { createElo } from '../elo.js';

export default createElo({
  gameWeight: (game, params) => game.size / params.referenceTable,
});
