// Working out the tiles from a photo of the board. The photo never leaves the device.
//
// The person lines up a hexagon outline with the board on their photo, and the page measures the colour of
// each tile (in a ring around the middle, so the number token does not get in the way). This file then
// decides which terrain each colour is. It knows the board holds exactly 4 forests, 4 pastures, 4 fields,
// 3 hills, 3 mountains and 1 desert, so it assigns all 19 tiles together rather than one at a time, and it
// adjusts its idea of each terrain's colour to the photo's lighting. The result is a starting point that the
// person checks and corrects by tapping, never something saved unseen.
import { HEX_COUNT, TERRAINS } from './board.js';

// Typical colours of each terrain in a photo of the board, before adjusting for lighting.
const TYPICAL = { F: '#3e5a2e', P: '#94b84c', G: '#d8a733', H: '#b3573a', M: '#80838a', D: '#d6c08e' };

const hexToRgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });

/** CIE Lab, where distances roughly match how different two colours look. */
export function rgbToLab({ r, g, b }) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

// Brightness varies a lot across a photo, so it counts for less than hue does.
const distance = (p, q) => 0.35 * (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

/** The cheapest way to pair each row with a different column (the Hungarian algorithm). Returns the column for each row. */
export function cheapestAssignment(cost) {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const match = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let row = 1; row <= n; row += 1) {
    match[0] = row;
    let column0 = 0;
    const minimum = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = match[column0];
      let delta = Infinity;
      let column1 = 0;
      for (let column = 1; column <= n; column += 1) {
        if (used[column]) continue;
        const reduced = cost[row0 - 1][column - 1] - u[row0] - v[column];
        if (reduced < minimum[column]) { minimum[column] = reduced; way[column] = column0; }
        if (minimum[column] < delta) { delta = minimum[column]; column1 = column; }
      }
      for (let column = 0; column <= n; column += 1) {
        if (used[column]) { u[match[column]] += delta; v[column] -= delta; } else { minimum[column] -= delta; }
      }
      column0 = column1;
    } while (match[column0] !== 0);
    do {
      const column1 = way[column0];
      match[column0] = match[column1];
      column0 = column1;
    } while (column0);
  }
  const result = new Array(n);
  for (let column = 1; column <= n; column += 1) result[match[column] - 1] = column - 1;
  return result;
}

/**
 * Decides the terrain of each of the 19 tiles from its measured colour ({ r, g, b }, in board order).
 * Returns the tiles as a board string, and a confidence from 0 to 1 for each tile, so unsure ones can be
 * pointed out for checking.
 */
export function classifyTiles(samples) {
  if (samples.length !== HEX_COUNT) throw new Error(`Expected ${HEX_COUNT} tile colours.`);
  const colours = samples.map(rgbToLab);
  const typical = Object.fromEntries(TERRAINS.map((terrain) => [terrain.code, rgbToLab(hexToRgb(TYPICAL[terrain.code]))]));
  let centres = { ...typical };
  // One slot per tile in the box: four forest slots, three hills slots and so on.
  const slots = TERRAINS.flatMap((terrain) => Array.from({ length: terrain.count }, () => terrain.code));

  let codes = [];
  for (let round = 0; round < 8; round += 1) {
    const cost = colours.map((colour) => slots.map((code) => distance(colour, centres[code])));
    const next = cheapestAssignment(cost).map((slot) => slots[slot]);
    const settled = next.join('') === codes.join('');
    codes = next;
    if (settled) break;
    // Move each terrain's colour towards what was actually seen, keeping some of the typical colour so that
    // one odd tile cannot drag a whole terrain off course.
    centres = Object.fromEntries(TERRAINS.map((terrain) => {
      const seen = colours.filter((_, index) => codes[index] === terrain.code);
      const mean = (key) => seen.reduce((sum, colour) => sum + colour[key], 0) / seen.length;
      const keep = 0.3;
      return [terrain.code, {
        L: keep * typical[terrain.code].L + (1 - keep) * mean('L'),
        a: keep * typical[terrain.code].a + (1 - keep) * mean('a'),
        b: keep * typical[terrain.code].b + (1 - keep) * mean('b'),
      }];
    }));
  }

  // Confident means the chosen terrain is clearly closer than the next best one.
  const confidence = colours.map((colour, index) => {
    const ranked = TERRAINS.map((terrain) => ({ code: terrain.code, cost: distance(colour, centres[terrain.code]) }))
      .sort((a, b) => a.cost - b.cost);
    const chosen = ranked.find((entry) => entry.code === codes[index]).cost;
    const rival = ranked.find((entry) => entry.code !== codes[index]).cost;
    return Math.max(0, Math.min(1, (rival - chosen) / (rival + 1e-9)));
  });
  return { tiles: codes.join(''), confidence };
}
