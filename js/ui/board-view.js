// Draws a board as an SVG: coloured tiles, number tokens with their dots, and starting settlements.
// The same drawing is used read-only (game details) and interactively (the board editor).
import { GEOMETRY, pips, terrainOf } from '../domain/board.js';
import { svg } from './dom.js';

const PAD = 0.25;

/** The outline of one hex, scaled about its centre (1 = touching its neighbours). */
const hexPoints = (hex, scale = 1) => hex.corners
  .map((corner) => `${hex.x + (corner.x - hex.x) * scale},${hex.y + (corner.y - hex.y) * scale}`).join(' ');

function token(hex, number) {
  const hot = number === 6 || number === 8;
  const dots = pips(number);
  return svg('g', { class: 'bv-token', 'pointer-events': 'none' },
    svg('circle', { cx: hex.x, cy: hex.y, r: 0.36, class: 'bv-token-disc' }),
    svg('text', { x: hex.x, y: hex.y + 0.07, class: `bv-number ${hot ? 'hot' : ''}`.trim() }, number),
    Array.from({ length: dots }, (_, index) => svg('circle', {
      cx: hex.x + (index - (dots - 1) / 2) * 0.075, cy: hex.y + 0.2, r: 0.026, class: `bv-pip ${hot ? 'hot' : ''}`.trim(),
    })));
}

/** A settlement: a little house in the player's colour. */
function settlement(vertex, colour) {
  const { x, y } = vertex;
  const s = 0.17;
  const d = `M${x - s} ${y + s * 0.8}V${y - s * 0.2}L${x} ${y - s * 1.1}L${x + s} ${y - s * 0.2}V${y + s * 0.8}Z`;
  return svg('path', { d, class: 'bv-settlement', fill: colour, 'pointer-events': 'none' });
}

/**
 * board:   { tiles, numbers, starts } where tiles may contain ' ' and numbers 0 for blanks
 * options: colourOf(playerId) -> hex colour
 *          onHex(index), onCorner(index)   make tiles or corners tappable
 *          showCorners                      draw tappable dots on every corner
 *          flagged                          tile indexes to outline as "please check"
 *          label                            accessible description
 */
export function boardView(board, { colourOf = () => '#888', onHex, onCorner, showCorners = false, flagged = [], label = 'Catan board' } = {}) {
  const { width, height, hexes, vertices } = GEOMETRY;
  const root = svg('svg', {
    class: `board-view ${onHex || onCorner ? 'interactive' : ''}`.trim(),
    viewBox: `${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`,
    role: 'img',
    'aria-label': label,
  });

  root.append(svg('polygon', {
    class: 'bv-sea',
    points: [[width / 2, -PAD * 0.6], [width + PAD * 0.6, height * 0.25], [width + PAD * 0.6, height * 0.75], [width / 2, height + PAD * 0.6], [-PAD * 0.6, height * 0.75], [-PAD * 0.6, height * 0.25]].map((p) => p.join(',')).join(' '),
  }));

  for (const hex of hexes) {
    const terrain = terrainOf(board.tiles[hex.index]);
    const tile = svg('polygon', {
      points: hexPoints(hex, 0.96),
      class: `bv-hex ${terrain ? '' : 'blank'} ${flagged.includes(hex.index) ? 'flagged' : ''}`.replace(/\s+/g, ' ').trim(),
      fill: terrain?.colour ?? 'transparent',
    });
    if (onHex) {
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', `Tile ${hex.index + 1}: ${terrain?.name ?? 'empty'}${board.numbers[hex.index] ? `, ${board.numbers[hex.index]}` : ''}`);
      tile.addEventListener('click', () => onHex(hex.index));
      tile.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onHex(hex.index); } });
    }
    root.append(tile);
    if (board.numbers[hex.index]) root.append(token(hex, board.numbers[hex.index]));
  }

  const owner = new Map(Object.entries(board.starts ?? {}).flatMap(([playerId, corners]) => corners.map((corner) => [corner, playerId])));
  for (const vertex of vertices) {
    const playerId = owner.get(vertex.index);
    if (playerId) root.append(settlement(vertex, colourOf(playerId)));
    if (onCorner && showCorners) {
      if (!playerId) root.append(svg('circle', { cx: vertex.x, cy: vertex.y, r: 0.075, class: 'bv-corner', 'pointer-events': 'none' }));
      const hit = svg('circle', { cx: vertex.x, cy: vertex.y, r: 0.24, class: 'bv-corner-hit', role: 'button', 'aria-label': `Corner ${vertex.index + 1}` });
      hit.addEventListener('click', () => onCorner(vertex.index));
      root.append(hit);
    }
  }
  return root;
}
