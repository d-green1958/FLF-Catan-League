import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { normaliseGames } from '../js/domain/games.js';
import { validateDataset, validateGame, validatePlayer } from '../js/domain/validate.js';
import { colourStats, headToHead, pairStats, playerSummary, records, turnOrderStats } from '../js/domain/stats.js';

const load = async (path) => JSON.parse(await readFile(new URL(`../data/${path}`, import.meta.url)));
const { colours } = await load('colours.json');
const { settings } = await load('league.json');
const profiles = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));
const context = { profiles, colours, settings };

const validGame = (changes = {}) => ({
  id: 'g1',
  date: '2026-11-06',
  vpTarget: 10,
  winnerId: 'a',
  seats: [
    { playerId: 'a', colour: 'red', vp: 10 },
    { playerId: 'b', colour: 'blue', vp: 8 },
    { playerId: 'c', colour: 'white', vp: 6 },
  ],
  ...changes,
});
const errorsFor = (changes) => validateGame(validGame(changes), context);

test('a normal game is valid', () => assert.deepEqual(errorsFor({}), []));

test('game validation catches each kind of bad entry', () => {
  const seat = (playerId, colour, vp) => ({ playerId, colour, vp });
  const cases = [
    [{ date: '' }, /date/],
    [{ date: '2026-13-45' }, /date/],
    [{ seats: [seat('a', 'red', 10), seat('b', 'blue', 5)] }, /3 to 6/],
    [{ seats: [seat('a', 'red', 10), seat('a', 'blue', 5), seat('c', 'white', 3)] }, /only sit once/],
    [{ seats: [seat('a', 'red', 10), seat('b', 'red', 5), seat('c', 'white', 3)] }, /colour can only/],
    [{ seats: [seat('a', 'red', 10), seat('nobody', 'blue', 5), seat('c', 'white', 3)] }, /not registered/],
    [{ seats: [seat('a', 'red', 10), seat('b', 'purple', 5), seat('c', 'white', 3)] }, /not recognised/],
    [{ seats: [seat('a', 'red', 10), seat('b', 'blue', 2.5), seat('c', 'white', 3)] }, /whole number/],
    [{ winnerId: 'd' }, /Choose the winner/],
    [{ winnerId: 'b' }, /fewer VPs/],
    [{ vpTarget: 12 }, /not reached the target/],
    [{ vpTarget: 1 }, /target between/],
    [{ longestRoute: 'd' }, /Longest Route/],
    [{ largestArmy: 'd' }, /Largest Army/],
  ];
  for (const [changes, expected] of cases) {
    assert.ok(errorsFor(changes).some((error) => expected.test(error)), `${JSON.stringify(changes)} should match ${expected}`);
  }
});

test('a winner below the target is allowed only when the game ended early', () => {
  assert.deepEqual(errorsFor({ vpTarget: 12, endedEarly: true }), []);
});

test('player validation needs a unique name, ignoring case', () => {
  assert.deepEqual(validatePlayer({ id: 'z', name: 'Zed' }, profiles), []);
  assert.match(validatePlayer({ id: 'z', name: '  ' }, profiles)[0], /Add a name/);
  assert.match(validatePlayer({ id: 'z', name: 'a' }, profiles)[0], /already a player/);
  assert.deepEqual(validatePlayer({ id: 'a', name: 'A' }, profiles), [], 'a player can keep their own name');
});

test('statistics add up for a small season', () => {
  const games = normaliseGames([
    validGame({ id: 'g1' }),
    validGame({ id: 'g2', date: '2026-11-13', winnerId: 'b', seats: [{ playerId: 'b', colour: 'red', vp: 10 }, { playerId: 'a', colour: 'blue', vp: 6 }, { playerId: 'd', colour: 'white', vp: 2 }] }),
  ]);

  assert.deepEqual(
    (({ games: g, wins, losses, averageVp }) => ({ g, wins, losses, averageVp }))(playerSummary(games, 'a')),
    { g: 2, wins: 1, losses: 1, averageVp: 8 },
  );

  const rivalry = headToHead(games, 'a', 5).find((row) => row.playerId === 'b');
  assert.deepEqual([rivalry.games, rivalry.wins, rivalry.theirWins], [2, 1, 1]);

  assert.equal(colourStats(games, colours).find((colour) => colour.id === 'red').wins, 2);
  assert.equal(colourStats(games, colours, 'a').find((colour) => colour.id === 'red').games, 1);

  const first = turnOrderStats(games)[0];
  assert.deepEqual([first.position, first.games, first.wins, first.winRate], [1, 2, 2, 1]);
  assert.ok(Math.abs(first.expectedRate - 1 / 3) < 1e-9);

  const pair = pairStats(games, 5).find((row) => row.key === 'a|b');
  assert.equal(pair.games, 2);
  assert.ok(Math.abs(pair.influence - 2 ** (-2 / 5)) < 1e-9);

  const titles = Object.fromEntries(records(games, profiles).map((record) => [record.title, record.value]));
  assert.equal(titles['Most games played'], '2 games');
  assert.equal(titles['Biggest winning margin'], '4 VP');
});

test('records are empty until there is a game', () => assert.deepEqual(records([], profiles), []));

test('the real league data is valid', async () => {
  const [{ profiles: live }, { games }] = await Promise.all([load('profiles.json'), load('games.json')]);
  assert.deepEqual(validateDataset({ profiles: live, games }, { colours, settings }), []);
});

test('the demo data is valid', async () => {
  const [{ profiles: demoPlayers }, { games }] = await Promise.all([load('demo/profiles.json'), load('demo/games.json')]);
  assert.deepEqual(validateDataset({ profiles: demoPlayers, games }, { colours, settings }), []);
  assert.ok(games.length >= 30);
});

test('every approach in the catalogue belongs to a family and has a module file', async () => {
  const { families, approaches } = await load('rating-approaches.json');
  for (const approach of approaches) {
    assert.ok(families.some((family) => family.id === approach.family), `${approach.id} has an unknown family`);
    await access(new URL(`../js/ratings/approaches/${approach.id}.js`, import.meta.url));
  }
  assert.ok(approaches.some((approach) => approach.id === settings.defaultApproach), 'the default approach must exist');
});
