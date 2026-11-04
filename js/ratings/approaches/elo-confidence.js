// Placement Elo, with the shown score pulled towards the start until a player has enough games.
import { createElo, withConfidence } from '../elo.js';

export default createElo({
  display: (rating, params, games) => withConfidence(rating, params.start, games, params.confidenceGames),
});
