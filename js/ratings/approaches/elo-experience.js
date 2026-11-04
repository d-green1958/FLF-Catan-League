// Placement Elo with a higher K while a player is new.
import { createElo } from '../elo.js';

export default createElo({
  kFor: (gamesPlayed, params) => (gamesPlayed < params.establishedGames ? params.kNew : params.kEstablished),
});
