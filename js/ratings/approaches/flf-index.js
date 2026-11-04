// Placement Elo + bigger tables count for more + repeat pairings decay + confidence adjustment.
import { createElo, withConfidence } from '../elo.js';

export default createElo({
  gameWeight: (game, params) => game.size / params.referenceTable,
  repeatDecay: true,
  display: (rating, params, games) => withConfidence(rating, params.start, games, params.confidenceGames),
});
