// The Plackett-Luce rating from Weng and Lin (2011), "A Bayesian Approximation Method for Online
// Ranking", the model used by OpenSkill. Every player has an estimated skill (mu) and an uncertainty (sigma).
const START_MU = 25;
const START_SIGMA = 25 / 3;
const BETA = START_SIGMA / 2;
const MIN_SHRINK = 0.0001;

// Skill minus three times the uncertainty starts at 0, so shift and stretch it onto a scale starting at 1000.
const DISPLAY_OFFSET = 1000;
const DISPLAY_SCALE = 40;

const ratingOf = (state, id) => state.get(id) ?? { mu: START_MU, sigma: START_SIGMA };

export default {
  init: () => new Map(),

  apply(state, game) {
    const players = game.seats.map((seat) => ({ id: seat.playerId, place: seat.place, ...ratingOf(state, seat.playerId) }));
    const c = Math.sqrt(players.reduce((sum, p) => sum + p.sigma ** 2 + BETA ** 2, 0));
    const strength = (p) => Math.exp(p.mu / c);

    // For each player q: the total strength of everyone who finished level with or behind them.
    const fieldStrength = new Map(players.map((q) => [
      q.id,
      players.filter((p) => p.place >= q.place).reduce((sum, p) => sum + strength(p), 0),
    ]));
    const tiedWith = (q) => players.filter((p) => p.place === q.place).length;

    const updates = players.map((player) => {
      let omega = 0;
      let delta = 0;
      for (const q of players) {
        if (q.place > player.place) continue;
        const probability = strength(player) / fieldStrength.get(q.id);
        const ties = tiedWith(q);
        omega += q.id === player.id ? (1 - probability) / ties : -probability / ties;
        delta += (probability * (1 - probability)) / ties;
      }
      const variance = player.sigma ** 2;
      const gamma = player.sigma / c;
      return {
        id: player.id,
        mu: player.mu + (variance / c) * omega,
        sigma: Math.sqrt(variance * Math.max(1 - gamma * (variance / c ** 2) * delta, MIN_SHRINK)),
      };
    });
    for (const { id, mu, sigma } of updates) state.set(id, { mu, sigma });
  },

  score(state, playerId) {
    const { mu, sigma } = ratingOf(state, playerId);
    return DISPLAY_OFFSET + DISPLAY_SCALE * (mu - 3 * sigma);
  },
};
