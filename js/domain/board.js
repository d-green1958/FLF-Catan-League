// The base-game board: 19 hexes in rows of 3, 4, 5, 4 and 3, and the 54 corners where settlements go.
//
// A game can store its board as:
//   board: {
//     tiles:   "FPGHMD…"  19 letters, left to right along each row, top row first (see TERRAINS)
//     numbers: [5, 2, …]  19 numbers in the same order, 0 on the desert
//     starts:  { playerId: [corner, corner] }  optional: each player's starting settlements (corners 0–53)
//   }
// The same geometry is used to draw the board, to check it and to work out who started on what.

export const HEX_ROWS = [3, 4, 5, 4, 3];
export const HEX_COUNT = 19;
export const MAX_STARTS = 2;

export const TERRAINS = [
  { code: 'F', id: 'forest', name: 'Forest', resource: 'lumber', count: 4, colour: '#3d6b35' },
  { code: 'P', id: 'pasture', name: 'Pasture', resource: 'wool', count: 4, colour: '#9cc45a' },
  { code: 'G', id: 'fields', name: 'Fields', resource: 'grain', count: 4, colour: '#e3b23c' },
  { code: 'H', id: 'hills', name: 'Hills', resource: 'brick', count: 3, colour: '#c4613a' },
  { code: 'M', id: 'mountains', name: 'Mountains', resource: 'ore', count: 3, colour: '#8c9199' },
  { code: 'D', id: 'desert', name: 'Desert', resource: null, count: 1, colour: '#e8d5a5' },
];
export const RESOURCES = ['lumber', 'wool', 'grain', 'brick', 'ore'];
export const RESOURCE_NAMES = { lumber: 'Lumber', wool: 'Wool', grain: 'Grain', brick: 'Brick', ore: 'Ore' };
export const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

export const terrainOf = (code) => TERRAINS.find((terrain) => terrain.code === code) ?? null;

/** How many of the 36 possible dice rolls produce this number: the dots printed under it. */
export const pips = (number) => (number >= 2 && number <= 12 && number !== 7 ? 6 - Math.abs(7 - number) : 0);

// ---------- geometry ----------
// Pointy-topped hexes with corners 1 unit from the centre. Everything else is worked out from this.
const WIDTH = Math.sqrt(3);
const round = (value) => Math.round(value * 1000) / 1000;

function buildGeometry() {
  const hexes = [];
  HEX_ROWS.forEach((count, row) => {
    const startX = ((5 - count) * WIDTH) / 2;
    for (let column = 0; column < count; column += 1) {
      hexes.push({ index: hexes.length, row, x: startX + column * WIDTH + WIDTH / 2, y: row * 1.5 + 1 });
    }
  });

  const cornersOf = (hex) => Array.from({ length: 6 }, (_, k) => {
    const angle = (Math.PI / 180) * (60 * k - 90);
    return { x: round(hex.x + Math.cos(angle)), y: round(hex.y + Math.sin(angle)) };
  });

  const byKey = new Map();
  for (const hex of hexes) {
    hex.corners = cornersOf(hex);
    for (const corner of hex.corners) {
      const key = `${corner.x},${corner.y}`;
      if (!byKey.has(key)) byKey.set(key, { x: corner.x, y: corner.y, hexes: [] });
      byKey.get(key).hexes.push(hex.index);
    }
  }
  // Corners are numbered top to bottom, then left to right, so the numbering never changes.
  const vertices = [...byKey.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  vertices.forEach((vertex, index) => { vertex.index = index; });
  for (const vertex of vertices) {
    vertex.neighbours = vertices
      .filter((other) => other !== vertex && Math.hypot(other.x - vertex.x, other.y - vertex.y) < 1.01)
      .map((other) => other.index);
  }
  return { hexes, vertices, width: 5 * WIDTH, height: 8 };
}

export const GEOMETRY = buildGeometry();
export const VERTEX_COUNT = GEOMETRY.vertices.length;

// ---------- shape and rules ----------
const isCorner = (value) => Number.isInteger(value) && value >= 0 && value < VERTEX_COUNT;

/** The structure a stored board must have. Used by the submission check, which trusts nothing. */
export function isBoardShape(board) {
  if (board === null || typeof board !== 'object' || Array.isArray(board)) return false;
  const keys = Object.keys(board);
  if (!keys.every((key) => ['tiles', 'numbers', 'starts'].includes(key))) return false;
  if (typeof board.tiles !== 'string' || !/^[FPGHMD]{19}$/.test(board.tiles)) return false;
  if (!Array.isArray(board.numbers) || board.numbers.length !== HEX_COUNT) return false;
  if (!board.numbers.every((number) => Number.isInteger(number) && number >= 0 && number <= 12)) return false;
  if (board.starts === undefined) return true;
  const { starts } = board;
  if (starts === null || typeof starts !== 'object' || Array.isArray(starts)) return false;
  return Object.entries(starts).every(([playerId, corners]) =>
    /^[a-z0-9][a-z0-9-]{0,80}$/.test(playerId)
    && Array.isArray(corners) && corners.length >= 1 && corners.length <= MAX_STARTS && corners.every(isCorner));
}

const sameList = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((value, index) => value === [...b].sort((x, y) => x - y)[index]);

/** Plain-English problems with a board, given the players in the game. An empty list means it is fine. */
export function validateBoard(board, playerIds = []) {
  if (!isBoardShape(board)) return ['The board is not in the expected format.'];
  const errors = [];
  for (const terrain of TERRAINS) {
    const found = [...board.tiles].filter((code) => code === terrain.code).length;
    if (found !== terrain.count) errors.push(`The board needs ${terrain.count} ${terrain.name.toLowerCase()} tiles, not ${found}.`);
  }
  const desertWithNumber = [...board.tiles].some((code, index) => code === 'D' && board.numbers[index] !== 0);
  if (desertWithNumber) errors.push('The desert has no number token.');
  const tokens = board.numbers.filter((number, index) => board.tiles[index] !== 'D');
  if (!sameList(tokens, NUMBER_TOKENS)) {
    errors.push('The number tokens should be one 2, one 12 and two each of 3, 4, 5, 6, 8, 9, 10 and 11, one on every tile except the desert.');
  }

  const starts = board.starts ?? {};
  const used = new Map();
  for (const [playerId, corners] of Object.entries(starts)) {
    if (!playerIds.includes(playerId)) errors.push('A starting settlement belongs to someone who is not in this game.');
    for (const corner of corners) {
      if (used.has(corner)) errors.push('Two starting settlements are on the same corner.');
      used.set(corner, playerId);
    }
  }
  const crowded = [...used.keys()].some((corner) => GEOMETRY.vertices[corner].neighbours.some((other) => used.has(other)));
  if (crowded) errors.push('Two starting settlements are next to each other, which the distance rule does not allow.');
  return [...new Set(errors)];
}

// ---------- what a board tells us ----------

/** The resources and pips a single corner produces. */
export function cornerYield(board, corner) {
  return GEOMETRY.vertices[corner].hexes.map((hex) => ({
    hex,
    resource: terrainOf(board.tiles[hex])?.resource ?? null,
    number: board.numbers[hex],
    pips: pips(board.numbers[hex]),
  }));
}

/**
 * What a player's starting settlements produce:
 *   byResource  pips for each resource
 *   total       all their pips: the expected number of resource cards per 36 rolls
 *   variety     how many of the five resources they touch
 *   numbers     the numbers they sit on
 */
export function openingFor(board, playerId) {
  const corners = board?.starts?.[playerId];
  if (!corners?.length) return null;
  const byResource = Object.fromEntries(RESOURCES.map((resource) => [resource, 0]));
  const numbers = [];
  for (const corner of corners) {
    for (const { resource, number, pips: count } of cornerYield(board, corner)) {
      if (!resource) continue;
      byResource[resource] += count;
      numbers.push(number);
    }
  }
  const total = RESOURCES.reduce((sum, resource) => sum + byResource[resource], 0);
  const variety = RESOURCES.filter((resource) => byResource[resource] > 0).length;
  return { byResource, total, variety, numbers: numbers.sort((a, b) => a - b), corners: corners.length };
}

/** The resource a player leaned on most, or null if their opening is unknown. */
export function mainResource(opening) {
  if (!opening) return null;
  return RESOURCES.reduce((best, resource) => (opening.byResource[resource] > opening.byResource[best] ? resource : best), RESOURCES[0]);
}

/** Games whose board records a full opening (two settlements) for every player. */
export const hasFullOpenings = (game) => Boolean(game.board?.starts)
  && game.seats.every((seat) => (game.board.starts[seat.playerId]?.length ?? 0) === MAX_STARTS);

/**
 * League-wide opening statistics, from games where everyone's opening was recorded.
 *   games            how many games count
 *   strongestWon     how often the player with the most pips won (ties share it)
 *   winnerPips, otherPips   average starting pips of winners and of everyone else
 *   resources        per resource: average pips for winners and for everyone else
 *   players          per player: games counted, average pips, the resource they most often lean on
 */
export function openingStats(games) {
  const counted = games.filter(hasFullOpenings);
  let strongestWon = 0;
  const winners = [];
  const others = [];
  const perPlayer = new Map();
  for (const game of counted) {
    const rows = game.seats.map((seat) => ({ seat, opening: openingFor(game.board, seat.playerId) }));
    const best = Math.max(...rows.map((row) => row.opening.total));
    const winnerRow = rows.find((row) => row.seat.playerId === game.winnerId);
    if (winnerRow && winnerRow.opening.total === best) strongestWon += 1;
    for (const row of rows) {
      (row.seat.playerId === game.winnerId ? winners : others).push(row.opening);
      const entry = perPlayer.get(row.seat.playerId) ?? { games: 0, pips: 0, leanings: {} };
      entry.games += 1;
      entry.pips += row.opening.total;
      const lean = mainResource(row.opening);
      entry.leanings[lean] = (entry.leanings[lean] ?? 0) + 1;
      perPlayer.set(row.seat.playerId, entry);
    }
  }
  const average = (list, pick) => (list.length ? list.reduce((sum, item) => sum + pick(item), 0) / list.length : 0);
  return {
    games: counted.length,
    strongestWon,
    winnerPips: average(winners, (opening) => opening.total),
    otherPips: average(others, (opening) => opening.total),
    winnerVariety: average(winners, (opening) => opening.variety),
    otherVariety: average(others, (opening) => opening.variety),
    resources: RESOURCES.map((resource) => ({
      resource,
      winners: average(winners, (opening) => opening.byResource[resource]),
      others: average(others, (opening) => opening.byResource[resource]),
    })),
    players: [...perPlayer.entries()].map(([playerId, entry]) => ({
      playerId,
      games: entry.games,
      averagePips: entry.pips / entry.games,
      favourite: Object.entries(entry.leanings).sort((a, b) => b[1] - a[1])[0][0],
    })).sort((a, b) => b.averagePips - a.averagePips),
  };
}
