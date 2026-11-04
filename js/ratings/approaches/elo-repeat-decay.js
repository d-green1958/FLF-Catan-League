// Placement Elo, where each pairing counts exponentially less every time they meet again.
import { createElo } from '../elo.js';

export default createElo({ repeatDecay: true });
