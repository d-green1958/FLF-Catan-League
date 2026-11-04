// Classic Elo: the winner beat each other player. Second and last are treated alike.
import { createElo } from '../elo.js';

export default createElo({ winnerOnly: true });
