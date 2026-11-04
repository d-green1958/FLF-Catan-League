import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normaliseGames, normaliseGame } from '../js/domain/games.js';
import { defaultParams, loadApproachModules, rankPlayers, runApproach } from '../js/ratings/engine.js';
import { expectedScore, repeatWeight } from '../js/ratings/elo.js';

const { approaches: catalogue } = JSON.parse(await readFile(new URL('../data/rating-approaches.json', import.meta.url)));
const modules = await loadApproachModules(catalogue);
const entry = (id) => catalogue.find((item) => item.id === id);
const params = (id, overrides = {}) => ({ ...defaultParams(entry(id)), ...overrides });

let nextId = 0;
const game = (vps, { date = '2026-11-06', winner, target = 10 } = {}) => {
  const players = Object.keys(vps);
  nextId += 1;
  return {
    id: `g${String(nextId).padStart(4, '0')}`,
    date,
    vpTarget: target,
    winnerId: winner || players.reduce((a, b) => (vps[b] > vps[a] ? b : a)),
    seats: players.map((playerId, index) => ({ playerId, vp: vps[playerId], colour: ['red', 'blue', 'white', 'orange', 'green', 'brown'][index] })),
  };
};
const run = (id, games, overrides) => runApproach(modules.get(id), normaliseGames(games), params(id, overrides));
const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`);

test('finishing places: the winner is first, and ties on VPs share a place', () => {
  const { seats } = normaliseGame(game({ a: 10, b: 8, c: 8, d: 5 }));
  assert.deepEqual(seats.map((seat) => seat.place), [1, 2, 2, 4]);
});

test('finishing places: a time-called winner tied on VPs still finishes first', () => {
  const { seats } = normaliseGame(game({ a: 7, b: 7, c: 4 }, { winner: 'b' }));
  assert.deepEqual(seats.map((seat) => seat.place), [2, 1, 3]);
});

test('every catalogue entry has a working module that scores a game', () => {
  const games = [game({ a: 10, b: 8, c: 6, d: 4 }), game({ b: 10, c: 9, e: 5 })];
  for (const item of catalogue) {
    const result = run(item.id, games);
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      assert.ok(Number.isFinite(result.scoreOf(id)), `${item.id} gave a bad score for ${id}`);
    }
  }
});

test('in every system, the winner of an even game finishes above the last-placed player', () => {
  const games = [game({ a: 10, b: 8, c: 6, d: 4 })];
  for (const item of catalogue) {
    const result = run(item.id, games);
    assert.ok(result.scoreOf('a') > result.scoreOf('d'), `${item.id}: winner should beat last place`);
  }
});

test('Elo expected score is 0.5 for equals, and about 0.76 with a 200 point lead', () => {
  close(expectedScore(1000, 1000), 0.5);
  close(expectedScore(1200, 1000), 0.7597, 1e-3);
});

test('Placement Elo at an even 4-player table moves +16, +5.33, -5.33, -16', () => {
  const result = run('elo-placement', [game({ a: 10, b: 8, c: 6, d: 4 })]);
  close(result.scoreOf('a'), 1016);
  close(result.scoreOf('b'), 1000 + 16 / 3);
  close(result.scoreOf('c'), 1000 - 16 / 3);
  close(result.scoreOf('d'), 984);
});

test('Standard Elo: the winner gains K/2 and the losers share that loss equally', () => {
  const result = run('elo-standard', [game({ a: 10, b: 8, c: 6, d: 4 })]);
  close(result.scoreOf('a'), 1016);
  for (const id of ['b', 'c', 'd']) close(result.scoreOf(id), 1000 - 16 / 3);
});

test('zero-sum systems conserve total rating over a season', () => {
  const games = [game({ a: 10, b: 8, c: 6, d: 4 }), game({ b: 10, c: 9, d: 1 }), game({ d: 10, a: 8, b: 3, c: 2, e: 1 })];
  for (const id of ['elo-standard', 'elo-placement', 'elo-table-size', 'elo-vp', 'elo-repeat-decay']) {
    const result = run(id, games);
    const total = ['a', 'b', 'c', 'd', 'e'].reduce((sum, player) => sum + result.scoreOf(player), 0);
    close(total, 5000);
  }
});

test('upsets are worth more: beating a stronger player gains more than beating a weaker one', () => {
  const season = [game({ a: 10, b: 3, c: 3 }), game({ a: 10, b: 4, c: 2 }), game({ a: 10, b: 5, c: 1 })];
  const strongA = run('elo-standard', [...season, game({ a: 10, d: 4, e: 3 })]);
  const upset = run('elo-standard', [...season, game({ d: 10, a: 4, e: 3 })]);
  const dGainUpset = upset.scoreOf('d') - 1000;
  const aGainExpected = strongA.scoreOf('a') - run('elo-standard', season).scoreOf('a');
  assert.ok(dGainUpset > aGainExpected);
});

test('Table-size Elo: a 6-player win moves further than a 3-player win', () => {
  const six = run('elo-table-size', [game({ a: 10, b: 8, c: 7, d: 6, e: 5, f: 4 })]);
  const three = run('elo-table-size', [game({ a: 10, b: 8, c: 4 })]);
  close(six.scoreOf('a') - 1000, 16 * 1.5);
  close(three.scoreOf('a') - 1000, 16 * 0.75);
});

test('repeat decay weights halve every half-life and keep falling', () => {
  close(repeatWeight(0, 5), 1);
  close(repeatWeight(5, 5), 0.5);
  close(repeatWeight(10, 5), 0.25);
  assert.ok(repeatWeight(1000, 5) < 1e-50);
  close(repeatWeight(7, 0), 1);
});

test('repeat decay: after many meetings a pair barely moves, but a new opponent counts in full', () => {
  const repeats = Array.from({ length: 60 }, (_, i) =>
    game(i % 2 ? { matt: 10, mark: 8, bo: 4 } : { mark: 10, matt: 8, bo: 4 }, { date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` }));
  const season = run('elo-repeat-decay', repeats);
  const last = season.timeline.at(-1).changes;
  assert.ok(Math.max(...last.map((row) => Math.abs(row.change))) < 0.01, 'the 60th repeat should barely matter');

  const withNewcomer = run('elo-repeat-decay', [...repeats, game({ matt: 10, newbie: 8, other: 4 }, { date: '2026-12-01' })]);
  assert.ok(withNewcomer.timeline.at(-1).changes.find((row) => row.playerId === 'matt').change > 5);
});

test('with decay switched off, the same system matches Placement Elo exactly', () => {
  const games = [game({ a: 10, b: 8, c: 6 }), game({ a: 10, b: 8, c: 6 }), game({ b: 10, a: 8, c: 6 })];
  const decayOff = run('elo-repeat-decay', games, { halfLife: 0 });
  const placement = run('elo-placement', games);
  for (const id of ['a', 'b', 'c']) close(decayOff.scoreOf(id), placement.scoreOf(id));
});

test('flat penalty: winners keep everything, losers lose the same, and scores stop at zero', () => {
  const result = run('penalty-flat', [game({ a: 10, b: 8, c: 2 })]);
  assert.equal(result.scoreOf('a'), 1000);
  assert.equal(result.scoreOf('b'), 975);
  assert.equal(result.scoreOf('c'), 975);
  const many = Array.from({ length: 50 }, () => game({ a: 10, b: 8, c: 2 }));
  assert.equal(run('penalty-flat', many).scoreOf('c'), 0);
});

test('weighted penalty: losing to a strong winner costs less than losing to a weak one', () => {
  const season = Array.from({ length: 6 }, () => game({ strong: 10, weak: 2, x: 3 }));
  const cost = (scenario) => {
    const before = run('penalty-weighted', season).scoreOf('neutral');
    return before - run('penalty-weighted', [...season, scenario]).scoreOf('neutral');
  };
  assert.ok(cost(game({ strong: 10, neutral: 5, y: 4 })) < cost(game({ weak: 10, neutral: 5, y: 4 })));
});

test('weighted penalty: an even game costs exactly the base penalty', () => {
  const result = run('penalty-weighted', [game({ a: 10, b: 8, c: 2 })]);
  close(result.scoreOf('b'), 975);
});

test('Plackett-Luce: results order the players, and uncertainty shrinks with games', () => {
  const module = modules.get('plackett-luce');
  const state = module.init();
  const [played] = normaliseGames([game({ a: 10, b: 8, c: 6, d: 4 })]);
  module.apply(state, played, {});
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => state.get(id));
  assert.ok(a.mu > b.mu && b.mu > c.mu && c.mu > d.mu);
  for (const player of [a, b, c, d]) assert.ok(player.sigma < 25 / 3);
});

test('Plackett-Luce: players who tie on VPs get identical updates', () => {
  const module = modules.get('plackett-luce');
  const state = module.init();
  const [played] = normaliseGames([game({ a: 10, b: 6, c: 6, d: 4 })]);
  module.apply(state, played, {});
  close(state.get('b').mu, state.get('c').mu);
  close(state.get('b').sigma, state.get('c').sigma);
});

test('seat order does not change anyone\'s rating', () => {
  const forward = { id: 'x', date: '2026-11-06', vpTarget: 10, winnerId: 'a', seats: [{ playerId: 'a', vp: 10 }, { playerId: 'b', vp: 8 }, { playerId: 'c', vp: 3 }] };
  const backward = { ...forward, seats: [...forward.seats].reverse() };
  for (const item of catalogue) {
    const one = run(item.id, [forward]);
    const two = run(item.id, [backward]);
    for (const id of ['a', 'b', 'c']) close(one.scoreOf(id), two.scoreOf(id));
  }
});

test('a back-dated game is replayed in date order, whatever order games were logged in', () => {
  const early = game({ a: 10, b: 2, c: 3 }, { date: '2026-11-06' });
  const late = game({ b: 10, a: 2, c: 3 }, { date: '2026-11-20' });
  for (const item of catalogue) {
    close(run(item.id, [early, late]).scoreOf('a'), run(item.id, [late, early]).scoreOf('a'));
  }
});

test('ranking: equal scores share a rank', () => {
  const result = run('wins', [game({ a: 10, b: 8, c: 2 }), game({ b: 10, a: 8, c: 2 })]);
  const ranks = Object.fromEntries(rankPlayers(result, ['a', 'b', 'c']).map((row) => [row.playerId, row.rank]));
  assert.deepEqual(ranks, { a: 1, b: 1, c: 3 });
});
