// Elo where the size of the victory point gap sets the result of each virtual match.
import { createElo, vpMarginResult } from '../elo.js';

export default createElo({ result: vpMarginResult });
