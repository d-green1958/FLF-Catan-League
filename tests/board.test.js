import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GEOMETRY, NUMBER_TOKENS, TERRAINS, VERTEX_COUNT, cornerYield, hasFullOpenings, isBoardShape, openingFor, openingStats, pips, validateBoard,
} from '../js/domain/board.js';
import { cheapestAssignment, classifyTiles } from '../js/domain/board-photo.js';
import { buildIssueLink, processSubmission } from '../js/domain/submission.js';
import { createAdminKey } from '../js/domain/admin-key.js';

// A valid layout, written out row by row from the top.
const LAYOUT = {
  tiles: 'MPF' + 'GHPH' + 'GFDFM' + 'FMGP' + 'HGP',
  numbers: [10, 2, 9, 12, 6, 4, 10, 9, 11, 0, 3, 8, 8, 3, 4, 5, 5, 6, 11],
};

test('the board has the 19 hexes, 54 corners and 72 edges of the real thing', () => {
  assert.equal(GEOMETRY.hexes.length, 19);
  assert.equal(VERTEX_COUNT, 54);
  const edges = GEOMETRY.vertices.reduce((sum, vertex) => sum + vertex.neighbours.length, 0) / 2;
  assert.equal(edges, 72);
  // Every corner touches one, two or three tiles, and the middle tile has six neighbouring corners shared with others.
  assert.ok(GEOMETRY.vertices.every((vertex) => vertex.hexes.length >= 1 && vertex.hexes.length <= 3));
});

test('pips are the dots under each number', () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(pips), [1, 2, 3, 4, 5, 0, 5, 4, 3, 2, 1]);
  assert.equal(NUMBER_TOKENS.reduce((sum, number) => sum + pips(number), 0), 58);
});

test('a correct board passes, and each kind of mistake is caught', () => {
  assert.deepEqual(validateBoard(LAYOUT), []);
  const swapped = { ...LAYOUT, tiles: 'D' + LAYOUT.tiles.slice(1) };
  assert.match(validateBoard(swapped).join(' '), /mountains tiles|desert/);
  const badNumbers = { ...LAYOUT, numbers: LAYOUT.numbers.map((number) => (number === 2 ? 6 : number)) };
  assert.match(validateBoard(badNumbers).join(' '), /number tokens/);
  assert.deepEqual(validateBoard({ tiles: 'X', numbers: [] }), ['The board is not in the expected format.']);
});

test('starting settlements must belong to players in the game and obey the distance rule', () => {
  const [a, b] = [0, GEOMETRY.vertices[0].neighbours[0]];
  assert.deepEqual(validateBoard({ ...LAYOUT, starts: { ann: [0, 30] } }, ['ann']), []);
  assert.match(validateBoard({ ...LAYOUT, starts: { ann: [0, 30] } }, ['bob']).join(' '), /not in this game/);
  assert.match(validateBoard({ ...LAYOUT, starts: { ann: [a, b] } }, ['ann']).join(' '), /distance rule/);
  assert.match(validateBoard({ ...LAYOUT, starts: { ann: [5], bob: [5] } }, ['ann', 'bob']).join(' '), /same corner/);
  assert.equal(isBoardShape({ ...LAYOUT, starts: { ann: [1, 2, 3] } }), false);
  assert.equal(isBoardShape({ ...LAYOUT, extra: true }), false);
});

test('an opening adds up the pips of every tile its settlements touch', () => {
  const corner = GEOMETRY.vertices.findIndex((vertex) => vertex.hexes.length === 3);
  const expected = cornerYield(LAYOUT, corner).reduce((sum, tile) => sum + tile.pips, 0);
  const opening = openingFor({ ...LAYOUT, starts: { ann: [corner] } }, 'ann');
  assert.equal(opening.total, expected);
  assert.equal(Object.values(opening.byResource).reduce((sum, value) => sum + value, 0), expected);
  assert.equal(openingFor(LAYOUT, 'ann'), null);
});

test('opening statistics only count games where everyone\'s opening is known', () => {
  const strong = GEOMETRY.vertices.map((vertex, index) => ({ index, total: cornerYield(LAYOUT, index).reduce((sum, tile) => sum + tile.pips, 0) }))
    .sort((x, y) => y.total - x.total);
  // Two non-touching corners each: the winner gets the best ones.
  const pick = (count, taken) => {
    const chosen = [];
    for (const { index } of strong) {
      if (chosen.length === count) break;
      const clash = [...taken, ...chosen].some((other) => other === index || GEOMETRY.vertices[index].neighbours.includes(other));
      if (!clash) chosen.push(index);
    }
    return chosen;
  };
  const ann = pick(2, []);
  const bob = pick(2, ann);
  const cat = pick(2, [...ann, ...bob]);
  const seats = [{ playerId: 'ann' }, { playerId: 'bob' }, { playerId: 'cat' }];
  const full = { winnerId: 'ann', seats, board: { ...LAYOUT, starts: { ann, bob, cat } } };
  const partial = { winnerId: 'bob', seats, board: { ...LAYOUT, starts: { ann } } };
  assert.equal(hasFullOpenings(full), true);
  assert.equal(hasFullOpenings(partial), false);
  const stats = openingStats([full, partial, { winnerId: 'ann', seats }]);
  assert.equal(stats.games, 1);
  assert.equal(stats.strongestWon, 1);
  assert.ok(stats.winnerPips > stats.otherPips);
  assert.equal(stats.players[0].playerId, 'ann');
});

test('the cheapest assignment finds the best pairing', () => {
  assert.deepEqual(cheapestAssignment([[4, 1, 3], [2, 0, 5], [3, 2, 2]]), [1, 0, 2]);
});

// A small seeded random generator, so the photo tests are repeatable.
function random(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}
const shuffle = (list, rand) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
// How each terrain tends to look in a real photo: not quite the typical colour the classifier starts from.
const PHOTO_COLOURS = { F: [52, 84, 40], P: [140, 176, 78], G: [214, 160, 52], H: [170, 82, 58], M: [118, 122, 128], D: [206, 186, 140] };

test('the photo reader recovers the tiles under different lighting', () => {
  const lightings = [
    { name: 'daylight', gain: [1, 1, 1], offset: 0 },
    { name: 'warm indoor light', gain: [1.12, 1.0, 0.78], offset: 0 },
    { name: 'dim and cool', gain: [0.7, 0.76, 0.86], offset: 0 },
    { name: 'washed out', gain: [0.85, 0.85, 0.85], offset: 40 },
  ];
  for (const [round, lighting] of lightings.entries()) {
    const rand = random(round + 7);
    const tiles = shuffle(TERRAINS.flatMap((terrain) => Array(terrain.count).fill(terrain.code)), rand);
    const samples = tiles.map((code) => {
      const [r, g, b] = PHOTO_COLOURS[code].map((value, channel) => {
        const noisy = value * lighting.gain[channel] + lighting.offset + (rand() - 0.5) * 22;
        return Math.max(0, Math.min(255, Math.round(noisy)));
      });
      return { r, g, b };
    });
    const result = classifyTiles(samples);
    const correct = [...result.tiles].filter((code, index) => code === tiles[index]).length;
    assert.ok(correct >= 18, `${lighting.name}: ${correct} of 19 right`);
    assert.equal(result.confidence.length, 19);
  }
});

test('anyone can add the board to an earlier game, but not change one that has a board', async () => {
  const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
  const league = { ...(await load('league.json')), adminKey: await createAdminKey('a test code that is long enough') };
  const { colours } = await load('colours.json');
  const expansions = await load('expansions.json');
  const profiles = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), active: true }));
  const game = {
    id: 'g-1', date: '2026-11-06', expansions: [], vpTarget: 10, winnerId: 'a',
    seats: [{ playerId: 'a', colour: 'red', vp: 10 }, { playerId: 'b', colour: 'blue', vp: 8 }, { playerId: 'c', colour: 'white', vp: 6 }],
  };
  const send = (saved, games) => processSubmission({
    body: new URL(buildIssueLink(league.repository, { profiles: { saved: [], deleted: [] }, games: { saved, deleted: [] } }).url).searchParams.get('body'),
    author: 'someone', issue: 9, profiles, games, activity: [], league, colours, expansions,
  });
  const withBoard = { ...game, board: { ...LAYOUT, starts: { a: [0, 30] } } };
  const added = await send([withBoard], [game]);
  assert.equal(added.status, 'applied', added.message);
  assert.deepEqual(added.games[0].board.starts, { a: [0, 30] });

  const changed = await send([{ ...withBoard, board: { ...LAYOUT } }], [withBoard]);
  assert.equal(changed.status, 'needs-code');

  const sneaky = await send([{ ...withBoard, winnerId: 'b', seats: [{ playerId: 'a', colour: 'red', vp: 8 }, { playerId: 'b', colour: 'blue', vp: 10 }, game.seats[2]] }], [game]);
  assert.equal(sneaky.status, 'needs-code');

  const broken = await send([{ ...game, board: { ...LAYOUT, numbers: Array(19).fill(6) } }], [game]);
  assert.equal(broken.status, 'rejected');
});
