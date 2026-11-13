// The Map of Oxtan: an old-style chart of Oxford with every settler walking about on it, and a riddle
// for each of the site's secrets.
//
// Where a settler stands comes from the league:
//   - Each keeps to the quarter of their favourite resource (from their profile, or failing that the resource
//     their openings lean on): brick in Jericho, lumber in Christ Church Meadow, wool on Port Meadow, grain in
//     Marston and ore at the Castle. Anyone with no favourite gathers at the Covered Market.
//   - The higher their rank, the closer they stand to the Radcliffe Camera. The leader holds it.
//   - Newcomers wait at the station, and retired players are kept in the Ashmolean.
// The history slider replays the league game by game, and everyone walks to where they stood at the time.
import { getLeague, selectedApproach } from '../domain/league.js';
import { mainResource, openingFor } from '../domain/board.js';
import { scoreHistory } from '../ratings/engine.js';
import { h, route, svg } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { page, pageHeader } from '../ui/components.js';
import { SECRETS, discover, foundSecrets, onTaps, secretPlace } from '../ui/delights.js';
import { formatDate } from '../ui/format.js';
import { trail } from './engsci.js';

const W = 1000;
const H = 700;
const INK = '#3b2a17';

const PLACES = {
  radcliffe: { name: 'Radcliffe Camera', x: 545, y: 342, kind: 'dome', label: [0, -28, 'middle'] },
  bodleian: { name: 'Bodleian', x: 472, y: 322, kind: 'hall', label: [0, 29, 'middle'] },
  sheldonian: { name: 'Sheldonian', x: 470, y: 250, kind: 'temple', label: [30, -40, 'middle'] },
  sighs: { name: 'Bridge of Sighs', x: 612, y: 296, kind: 'bridge', label: [0, 37, 'middle'] },
  carfax: { name: 'Carfax', x: 410, y: 392, kind: 'tower', label: [-20, -27, 'middle'] },
  market: { name: 'Covered Market', x: 488, y: 396, kind: 'market', label: [-19, 23, 'end'] },
  christchurch: { name: 'Christ Church', x: 418, y: 456, kind: 'tower', label: [60, 31, 'middle'] },
  folly: { name: 'Folly Bridge', x: 440, y: 526, kind: 'bridge', label: [-40, 27, 'middle'] },
  meadow: { name: 'Christ Church Meadow', x: 548, y: 498, kind: 'trees', label: null },
  schools: { name: 'Examination Schools', x: 622, y: 400, kind: 'hall', label: [0, 29, 'middle'] },
  magdalen: { name: 'Magdalen Tower', x: 700, y: 388, kind: 'tower', label: [40, -47, 'middle'] },
  botanic: { name: 'Botanic Garden', x: 748, y: 448, kind: 'trees', label: [0, 40, 'middle'] },
  ashmolean: { name: 'Ashmolean', x: 362, y: 300, kind: 'temple', label: [-19, 21, 'end'] },
  pittrivers: { name: 'Pitt Rivers', x: 575, y: 222, kind: 'hall', label: [0, 29, 'middle'] },
  // The Engineering Science complex on Parks Road. Both buildings open a map of their own.
  jenkin: { name: 'Jenkin Building', x: 590, y: 108, kind: 'hall', link: '/map/engsci', label: [20, 22, 'start'] },
  thom: { name: 'Thom Building', x: 590, y: 170, kind: 'tall', link: '/map/thom', label: [-60, 23, 'middle'] },
  maths: { name: 'Mathematical Institute', x: 360, y: 168, kind: 'hall', label: [-20, -38, 'middle'] },
  parks: { name: 'University Parks', short: 'The Parks', x: 648, y: 214, kind: 'trees', label: [-10, 40, 'middle'] },
  jericho: { name: 'Jericho', x: 330, y: 222, kind: 'houses', label: null },
  portmeadow: { name: 'Port Meadow', x: 250, y: 150, kind: 'meadow', label: null },
  marston: { name: 'Marston', x: 850, y: 214, kind: 'fields', label: null },
  castle: { name: 'Oxford Castle', x: 272, y: 410, kind: 'castle', label: [-20, -17, 'middle'] },
  station: { name: 'Station', x: 262, y: 345, kind: 'station', label: [-20, -18, 'middle'] },
  otmoor: { name: 'Otmoor', x: 900, y: 92, kind: 'dragon' },
  ringroad: { name: 'The Ring Road', x: 70, y: 420, kind: 'none' },
  compass: { name: 'Compass', x: 880, y: 590, kind: 'none' },
};
for (const [key, place] of Object.entries(PLACES)) place.key = key;

// Each resource's quarter of the city.
const QUARTERS = { brick: 'jericho', lumber: 'meadow', wool: 'portmeadow', grain: 'marston', ore: 'castle' };
const QUARTER_NAMES = { brick: 'Jericho brickworks', lumber: 'Christ Church woods', wool: 'the flocks of Port Meadow', grain: 'the fields of Marston', ore: 'the Castle quarries' };

// Remembered between redraws, so the map stays unfolded and the slider keeps its place.
let unfolded = false;
let step = null;
let player = null;

/** A stable number from a string, used to spread people out the same way every time. */
function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

/** Where everyone stands after the first n games. */
function positions(league, approach, n) {
  const run = league.runs.get(approach.id);
  const played = league.games.slice(0, n);
  const lastGame = played.at(-1);
  const scored = league.profiles.map((profile) => {
    const history = scoreHistory(run, profile.id);
    return { profile, score: n > 0 ? history[n - 1] : null, games: played.filter((game) => game.seats.some((seat) => seat.playerId === profile.id)) };
  });
  const ranked = scored.filter((row) => row.score !== null && row.profile.active !== false).sort((a, b) => b.score - a.score);
  const throne = PLACES.radcliffe;

  return scored.map((row) => {
    const { profile } = row;
    const rank = ranked.indexOf(row) + 1;
    const leaning = (() => {
      if (QUARTERS[profile.favouriteResource]) return profile.favouriteResource;
      const counts = {};
      for (const game of row.games) {
        const lean = mainResource(game.board ? openingFor(game.board, profile.id) : null);
        if (lean) counts[lean] = (counts[lean] ?? 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    })();
    let home;
    let where;
    if (profile.active === false) {
      home = PLACES.ashmolean; where = 'retired to the Ashmolean';
    } else if (!row.games.length) {
      home = PLACES.station; where = 'just off the train';
    } else {
      const quarter = PLACES[QUARTERS[leaning] ?? 'market'];
      const pull = ranked.length > 1 ? (rank === 1 ? 1 : 0.8 * (1 - (rank - 1) / (ranked.length - 1))) : 1;
      home = { x: quarter.x + (throne.x - quarter.x) * pull, y: quarter.y + (throne.y - quarter.y) * pull };
      where = rank === 1 ? 'holds the Radcliffe Camera' : `${rank}${['th', 'st', 'nd', 'rd'][rank % 10 > 3 || [11, 12, 13].includes(rank % 100) ? 0 : rank % 10]}, from ${QUARTER_NAMES[leaning] ?? 'the Covered Market'}`;
    }
    const angle = hash(profile.id) * Math.PI * 2;
    const spread = rank === 1 ? 0 : 14 + hash(`${profile.id}!`) * 14;
    return {
      profile,
      rank,
      where,
      crowned: lastGame?.winnerId === profile.id,
      home: { x: home.x + Math.cos(angle) * spread, y: home.y + Math.sin(angle) * spread },
    };
  });
}

// ---------- drawing the map ----------
const text = (x, y, value, className, extra = {}) => svg('text', { x, y, class: className, ...extra }, value);

function landmark(place) {
  const { x, y, kind } = place;
  const ink = { stroke: INK, 'stroke-width': 1.6, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  const fill = { fill: '#e9d9b0', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' };
  const shapes = {
    dome: [svg('rect', { x: x - 14, y: y - 4, width: 28, height: 12, ...fill }), svg('path', { d: `M${x - 13} ${y - 4}a13 13 0 0 1 26 0Z`, ...fill }), svg('path', { d: `M${x} ${y - 17}v-6M${x - 8} ${y + 8}v-12M${x + 8} ${y + 8}v-12M${x} ${y + 8}v-12`, ...ink })],
    tall: [svg('path', { d: `M${x - 9} ${y + 12}V${y - 26}h18V${y + 12}Z`, ...fill }), svg('path', { d: `M${x - 9} ${y - 26}h18l-3-8h-12Z`, fill: '#d3ae58', stroke: INK, 'stroke-width': 1.4 }), svg('path', { d: `M${x - 5} ${y - 18}h10M${x - 5} ${y - 10}h10M${x - 5} ${y - 2}h10M${x - 5} ${y + 6}h10`, ...ink })],
    tower: [svg('path', { d: `M${x - 6} ${y + 10}V${y - 10}h12V${y + 10}Z`, ...fill }), svg('path', { d: `M${x - 7} ${y - 10}l7-12 7 12`, ...fill }), svg('path', { d: `M${x - 2} ${y + 10}v-6h4v6`, ...ink })],
    temple: [svg('path', { d: `M${x - 15} ${y - 5}L${x} ${y - 15}L${x + 15} ${y - 5}Z`, ...fill }), svg('rect', { x: x - 14, y: y - 5, width: 28, height: 14, ...fill }), svg('path', { d: `M${x - 8} ${y - 3}v10M${x - 3} ${y - 3}v10M${x + 3} ${y - 3}v10M${x + 8} ${y - 3}v10`, ...ink })],
    hall: [svg('rect', { x: x - 16, y: y - 7, width: 32, height: 15, ...fill }), svg('path', { d: `M${x - 16} ${y - 7}l4-6h24l4 6M${x - 9} ${y + 8}v-7M${x} ${y + 8}v-7M${x + 9} ${y + 8}v-7`, ...ink })],
    bridge: [svg('path', { d: `M${x - 16} ${y + 6}h32M${x - 16} ${y - 2}h32M${x - 10} ${y + 6}a10 8 0 0 1 20 0`, ...ink })],
    market: [svg('rect', { x: x - 12, y: y - 4, width: 24, height: 12, ...fill }), svg('path', { d: `M${x - 15} ${y - 4}l3-6h24l3 6Z`, fill: '#b44a35', stroke: INK, 'stroke-width': 1.4 })],
    castle: [svg('path', { d: `M${x - 22} ${y + 12}q22-16 44 0Z`, fill: '#cdbb8a', stroke: INK, 'stroke-width': 1.4 }), svg('path', { d: `M${x - 10} ${y + 4}V${y - 12}h4v4h4v-4h4v4h4v-4h4V${y + 4}`, ...fill })],
    station: [svg('rect', { x: x - 14, y: y - 6, width: 28, height: 12, ...fill }), svg('path', { d: `M${x + 6} ${y - 6}v-7h4v7M${x - 24} ${y + 10}h48M${x - 24} ${y + 13}h48`, ...ink })],
    trees: [[-12, 2], [0, -4], [12, 3], [-4, 8], [8, 10]].map(([dx, dy]) => [svg('path', { d: `M${x + dx} ${y + dy + 9}v-5`, ...ink }), svg('circle', { cx: x + dx, cy: y + dy, r: 6, fill: '#7f9a55', stroke: INK, 'stroke-width': 1.2 })]),
    houses: [[-14, 0], [0, -4], [14, 1]].map(([dx, dy]) => svg('path', { d: `M${x + dx - 6} ${y + dy + 8}v-9l6-6 6 6v9Z`, fill: '#c98a5e', stroke: INK, 'stroke-width': 1.3 })),
    meadow: [[-30, 0], [-12, 10], [8, -6], [26, 6], [-22, -14], [18, -18]].map(([dx, dy]) => svg('path', { d: `M${x + dx - 4} ${y + dy}l2-6 2 6 2-7 2 7`, ...ink })),
    fields: [0, 1, 2, 3].map((row) => svg('path', { d: `M${x - 34} ${y - 12 + row * 8}h68`, stroke: '#a77b2a', 'stroke-width': 1.4, 'stroke-dasharray': '3 3' })),
    dragon: [svg('path', { d: 'M10 60c20-4 34-14 46-30l8 14 14-26 6 22 20-30 2 34c10 4 20 4 32-2-6 10-18 16-32 16l8 14-22-6-12 16-6-16c-16 6-32 6-48 2l-16 10 6-16Z', fill: '#5d2a1c', opacity: 0.8, transform: `translate(${x - 70} ${y - 40}) scale(.85)` })],
    none: [],
  };
  // label: where the name goes, as [dx, dy, anchor] from the drawing (chosen so no name sits on a road or
  // river). Leave it out for just below the drawing; null means the district name does the job.
  const [dx, dy, anchor] = place.label === undefined ? [0, 26, 'middle'] : place.label ?? [];
  const group = svg('g', { class: `map-landmark ${place.link ? 'map-door' : ''}`.trim() }, shapes[kind],
    kind !== 'none' && place.label !== null && text(x + dx, y + dy, place.short ?? place.name, 'map-label', { 'text-anchor': anchor, 'data-place': place.key, 'data-x': x, 'data-y': y }));
  if (place.link) {
    // A building you can go into.
    group.setAttribute('role', 'link');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', `Go into the ${place.name}`);
    const enter = () => { window.location.hash = route(place.link); };
    group.addEventListener('click', enter);
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter') enter(); });
  }
  return group;
}

function compassRose(onSpin) {
  const { x, y } = PLACES.compass;
  const rose = svg('g', { class: 'map-compass', role: 'button', 'aria-label': 'Compass rose', tabindex: '0' },
    svg('circle', { cx: 0, cy: 0, r: 46, fill: 'none', stroke: INK, 'stroke-width': 1.2 }),
    svg('circle', { cx: 0, cy: 0, r: 40, fill: 'none', stroke: INK, 'stroke-width': 0.6, 'stroke-dasharray': '2 3' }),
    [0, 90, 180, 270].map((angle) => svg('path', { d: 'M0 -44 L7 0 L0 6 L-7 0Z', fill: angle === 0 ? '#8b2a1d' : INK, transform: `rotate(${angle})` })),
    [45, 135, 225, 315].map((angle) => svg('path', { d: 'M0 -28 L4 0 L0 4 L-4 0Z', fill: '#a58a55', transform: `rotate(${angle})` })),
    svg('circle', { cx: 0, cy: 0, r: 4, fill: '#d3ae58', stroke: INK }),
    text(0, -52, 'N', 'map-compass-n'));
  const holder = svg('g', { transform: `translate(${x} ${y})` }, rose);
  onTaps(rose, 3, onSpin);
  return holder;
}

function backdrop() {
  return [
    svg('defs', null,
      svg('filter', { id: 'paper-grain' },
        svg('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 7, result: 'noise' }),
        svg('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.18 0' }),
        svg('feComposite', { in2: 'SourceGraphic', operator: 'in' })),
      svg('radialGradient', { id: 'paper-burn', cx: '50%', cy: '50%', r: '70%' },
        svg('stop', { offset: '55%', 'stop-color': '#000', 'stop-opacity': 0 }),
        svg('stop', { offset: '100%', 'stop-color': '#5a3410', 'stop-opacity': 0.55 })),
      svg('linearGradient', { id: 'paper-tone', x1: 0, y1: 0, x2: 1, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': '#f1e2bb' }),
        svg('stop', { offset: '100%', 'stop-color': '#e3cc98' })),
      svg('path', { id: 'isis-path', d: 'M120 20C170 90 190 160 230 230S290 330 320 420S380 520 440 530S560 590 620 640S700 690 760 700' }),
      svg('path', { id: 'cherwell-path', d: 'M800 20C760 90 720 150 690 230S650 320 700 380S690 460 640 520S600 600 612 632' })),
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#paper-tone)' }),
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#e8d6a8', filter: 'url(#paper-grain)' }),
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#paper-burn)' }),
    // Fold lines, as if the map has lived in a pocket.
    svg('path', { d: `M${W / 3} 0V${H}M${(2 * W) / 3} 0V${H}M0 ${H / 2}H${W}`, stroke: 'rgba(90, 60, 20, .14)', 'stroke-width': 2 }),
    svg('rect', { x: 14, y: 14, width: W - 28, height: H - 28, fill: 'none', stroke: INK, 'stroke-width': 2.4 }),
    svg('rect', { x: 22, y: 22, width: W - 44, height: H - 44, fill: 'none', stroke: INK, 'stroke-width': 0.8 }),
  ];
}

function cityLayer() {
  const road = (d, name, at) => [
    svg('path', { d, class: 'map-road' }),
    name && text(at[0], at[1], name, 'map-road-label', { transform: `rotate(${at[2] ?? 0} ${at[0]} ${at[1]})` }),
  ];
  return svg('g', null,
    // The Ring Road, beyond which lie dragons.
    svg('ellipse', { cx: 500, cy: 360, rx: 440, ry: 310, class: 'map-ring' }),
    text(78, 450, 'The Ring Road', 'map-road-label', { transform: 'rotate(-78 78 450)' }),
    // Rivers, drawn twice for a soft inked edge.
    svg('use', { href: '#isis-path', class: 'map-river-edge' }), svg('use', { href: '#isis-path', class: 'map-river' }),
    svg('use', { href: '#cherwell-path', class: 'map-river-edge' }), svg('use', { href: '#cherwell-path', class: 'map-river' }),
    svg('text', { class: 'map-water-label' }, svg('textPath', { href: '#isis-path', startOffset: '18%' }, 'River Isis')),
    svg('text', { class: 'map-water-label' }, svg('textPath', { href: '#cherwell-path', startOffset: '10%' }, 'River Cherwell')),
    road('M410 392L425 300L440 230', 'St Giles', [416, 330, -82]),
    road('M440 230L405 120L385 30', 'Woodstock Road', [419, 182, -73]),
    road('M440 230L505 120L525 30', 'Banbury Road', [516, 92, -70]),
    road('M410 392L622 386L700 388L790 376', 'High Street', [570, 380, -1]),
    road('M428 280L600 276', 'Broad Street', [545, 270, 0]),
    road('M410 392L438 526L446 640', 'St Aldates', [430, 610, -88]),
    road('M410 392L352 396L262 345L120 330', 'Park End', [300, 356, 25]),
    road('M700 388L800 452L910 470', 'Iffley Road', [800, 442, 30]),
    text(292, 96, 'PORT MEADOW', 'map-district'),
    text(345, 262, 'JERICHO', 'map-district'),
    text(852, 262, 'MARSTON', 'map-district'),
    text(560, 466, 'THE MEADOW', 'map-district'),
    text(190, 476, 'CASTLE QUARTER', 'map-district'),
    // A few sheep on Port Meadow, because of course.
    [[230, 178], [282, 184], [292, 134]].map(([x, y]) => svg('g', { transform: `translate(${x} ${y})` },
      svg('ellipse', { cx: 0, cy: 0, rx: 7, ry: 5, fill: '#fbf6e8', stroke: INK, 'stroke-width': 1 }),
      svg('circle', { cx: 7, cy: -1, r: 2.6, fill: INK }))),
    Object.values(PLACES).map(landmark));
}

function cartouche(n, total, games) {
  const date = n > 0 ? formatDate(games[n - 1].date) : 'before the first game';
  return svg('g', { class: 'map-cartouche', transform: 'translate(0 528)' },
    svg('path', { d: 'M36 36h300v86H36Z', fill: 'rgba(241, 226, 187, .85)', stroke: INK, 'stroke-width': 1.4 }),
    svg('path', { d: 'M42 42h288v74H42Z', fill: 'none', stroke: INK, 'stroke-width': 0.6 }),
    text(186, 74, 'The Realm of Oxtan', 'map-title'),
    text(186, 96, 'a true chart of the city, its settlers and its secrets', 'map-subtitle'),
    text(186, 112, total ? `as it stood after game ${n} of ${total}, ${date}` : 'as yet unsettled', 'map-subtitle'));
}

function scaleBar() {
  return svg('g', { transform: `translate(420 ${H - 44})` },
    svg('path', { d: 'M0 0h160M0 -5v10M80 -4v8M160 -5v10', stroke: INK, 'stroke-width': 1.6 }),
    svg('rect', { x: 0, y: -3, width: 40, height: 6, fill: INK }), svg('rect', { x: 80, y: -3, width: 40, height: 6, fill: INK }),
    text(80, 22, 'one league = ten victory points', 'map-subtitle'));
}

// ---------- the settlers ----------
function walkerFor(spot, colours) {
  const colour = colours.find((entry) => entry.id === spot.profile.favouriteColour)?.hex ?? '#7a5a3a';
  const initial = spot.profile.name.trim().slice(0, 1).toUpperCase();
  const crown = svg('path', { d: 'M-9 -14l3-8 6 5 6-5 3 8Z', fill: '#d3ae58', stroke: INK, 'stroke-width': 1, class: 'map-crown' });
  const body = svg('g', { class: 'map-walker' },
    svg('title', null, `${spot.profile.name}: ${spot.where}`),
    svg('circle', { r: 10, fill: colour, stroke: INK, 'stroke-width': 1.6 }),
    text(0, 4, initial, 'map-walker-initial', { fill: colour === '#f4f3ee' ? INK : '#fffaf0' }),
    text(0, 25, spot.profile.name, 'map-walker-name'),
    crown);
  crown.style.display = spot.crowned ? '' : 'none';
  return { body, crown };
}

function footprint(layer, from, to, left) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const side = left ? -3 : 3;
  const x = (from.x + to.x) / 2 - Math.sin(angle) * side;
  const y = (from.y + to.y) / 2 + Math.cos(angle) * side;
  const print = svg('ellipse', { cx: x, cy: y, rx: 2.6, ry: 1.5, class: 'map-foot', transform: `rotate(${(angle * 180) / Math.PI} ${x} ${y})` });
  layer.append(print);
  setTimeout(() => print.remove(), 5200);
}

/**
 * The chart with everyone walking about on it. Returns the SVG, and place(n) to move everyone to where they
 * stood after n games. under and over are extra layers drawn below and above the settlers. A viewBox crops it.
 */
export function livingMap(league, approach, { calm = false, under = [], over = [], viewBox = `0 0 ${W} ${H}`, label = 'An illustrated map of Oxford with each player marked on it' } = {}) {
  const feet = svg('g', { class: 'map-feet' });
  const people = svg('g');
  const map = svg('svg', { class: 'map-svg', viewBox, role: 'img', 'aria-label': label },
    backdrop(), cityLayer(), under, feet, people, over);

  // Each settler walks to their place, then potters about it, leaving footprints that fade.
  const walkers = new Map();
  function place(n) {
    for (const spot of positions(league, approach, n)) {
      let walker = walkers.get(spot.profile.id);
      if (!walker) {
        const { body, crown } = walkerFor(spot, league.reference.colours);
        walker = { body, crown, pos: { ...spot.home }, target: { ...spot.home }, left: false };
        body.style.transform = `translate(${spot.home.x}px, ${spot.home.y}px)`;
        people.append(body);
        walkers.set(spot.profile.id, walker);
      }
      walker.home = spot.home;
      walker.target = { ...spot.home };
      walker.crown.style.display = spot.crowned ? '' : 'none';
      walker.body.querySelector('title').textContent = `${spot.profile.name}: ${spot.where}`;
      if (calm) {
        walker.pos = { ...spot.home };
        walker.body.style.transform = `translate(${spot.home.x}px, ${spot.home.y}px)`;
      }
    }
  }

  let seen = false;
  let waited = 0;
  const ticker = calm ? null : setInterval(() => {
    // Stop once the map has been taken off the page, or if it never arrived on it.
    if (map.isConnected) seen = true;
    else if (seen || (waited += 1) > 20) { clearInterval(ticker); return; }
    for (const walker of walkers.values()) {
      const dx = walker.target.x - walker.pos.x;
      const dy = walker.target.y - walker.pos.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 3) {
        const angle = Math.random() * Math.PI * 2;
        const reach = 4 + Math.random() * 12;
        walker.target = { x: walker.home.x + Math.cos(angle) * reach, y: walker.home.y + Math.sin(angle) * reach };
        continue;
      }
      const stride = Math.min(distance, distance > 40 ? 22 : 7);
      const next = { x: walker.pos.x + (dx / distance) * stride, y: walker.pos.y + (dy / distance) * stride };
      footprint(feet, walker.pos, next, walker.left);
      walker.left = !walker.left;
      walker.pos = next;
      walker.body.style.transform = `translate(${next.x}px, ${next.y}px)`;
    }
  }, 380);

  return { map, place };
}

export function renderMap() {
  const league = getLeague();
  const approach = selectedApproach(league);
  const total = league.games.length;
  if (step === null || step > total) step = total;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const found = foundSecrets();

  const header = pageHeader({
    eyebrow: 'Here be settlers',
    title: 'The Map',
    intro: `Every settler walks the realm. The higher their rank on ${approach.name}, the closer they stand to the Radcliffe Camera, and each keeps to the quarter of their favourite resource. The red seals hide the site's secrets: ${found.size} of ${SECRETS.length} found in this browser.`,
  });

  const seals = svg('g');
  const riddle = h('div', { class: 'map-riddle', 'aria-live': 'polite' },
    h('p', { class: 'map-riddle-hint' }, 'Tap a red seal to read its riddle.'));
  const cartoucheHolder = svg('g');

  const showSecret = (secret) => {
    const isFound = foundSecrets().has(secret.id);
    riddle.replaceChildren(
      h('p', { class: 'map-riddle-place' }, PLACES[secret.place].name),
      h('h3', null, isFound ? `${secret.title} (found)` : secret.title),
      h('p', null, secret.riddle));
  };

  const addSeal = (place, dx, isFound, label, onOpen) => {
    const seal = svg('g', {
      class: `map-seal ${isFound ? 'found' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-label': label,
      transform: `translate(${place.x + dx} ${place.y - 18})`,
    },
    svg('circle', { r: 9 }),
    svg('path', { d: 'M0 -5l4.3 2.5v5L0 5l-4.3-2.5v-5Z', class: 'map-seal-mark' }));
    seal.addEventListener('click', onOpen);
    seal.addEventListener('keydown', (event) => { if (event.key === 'Enter') onOpen(); });
    seals.append(seal);
  };
  for (const secret of SECRETS.filter((item) => !item.inside)) {
    const place = PLACES[secret.place];
    const isFound = found.has(secret.id);
    addSeal(place, secret.place === 'compass' ? 40 : 16, isFound, `${place.name}: ${isFound ? secret.title : 'an unsolved riddle'}`, () => showSecret(secret));
  }
  for (const [building, link, title] of [['jenkin', '/map/engsci', 'The Engineering Science complex'], ['thom', '/map/thom', 'The Thom Building']]) {
    const inside = SECRETS.filter((item) => item.place === building);
    const count = inside.filter((item) => found.has(item.id)).length;
    addSeal(PLACES[building], 18, count === inside.length, `${PLACES[building].name}: ${count} of ${inside.length} secrets found`, () => {
      riddle.replaceChildren(
        h('p', { class: 'map-riddle-place' }, PLACES[building].name),
        h('h3', null, title),
        h('p', null, `${inside.length === 1 ? 'One secret waits' : `${inside.length} secrets wait`} inside (${count} found). Tap the building to go in.`),
        h('a', { class: 'btn sm map-enter', href: route(link) }, icon('map', 'sm'), 'Go inside'));
    });
  }

  const compass = compassRose(() => {
    const rose = compass.firstChild;
    if (!calm) rose.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(1080deg)' }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.2,1)' });
    discover('compass');
    riddle.replaceChildren(
      h('p', { class: 'map-riddle-place' }, 'The compass rose'),
      h('h3', null, 'The Hidden Hex'),
      h('p', null, 'Every hex on the board is worth exactly the same until the dice say otherwise. Every settler is equal until lunch begins. Well spun.'));
  });

  const { map, place: placeSettlers } = livingMap(league, approach, { calm, under: [scaleBar(), compass, cartoucheHolder], over: [seals] });
  const place = (n) => {
    cartoucheHolder.replaceChildren(cartouche(n, total, league.games));
    placeSettlers(n);
  };

  // The history slider: drag it, or press play to watch the league unfold.
  const label = h('span', { class: 'map-step' });
  const slider = h('input', {
    type: 'range', min: 0, max: total, step: 1, value: step, 'aria-label': 'Show the map after this many games',
    onInput: (event) => { step = Number(event.target.value); update(); },
  });
  const playButton = h('button', { class: 'btn sm', type: 'button' }, icon('clock', 'sm'), 'Replay the league');
  function update() {
    slider.value = step;
    label.textContent = total ? `After game ${step} of ${total}` : 'No games yet';
    place(step);
  }
  playButton.addEventListener('click', () => {
    clearInterval(player);
    step = 0;
    update();
    player = setInterval(() => {
      if (!map.isConnected || step >= total) { clearInterval(player); return; }
      step += 1;
      update();
    }, calm ? 600 : 1400);
  });

  update();

  // The map starts folded. Unfolding it is remembered until the page is reloaded.
  const sheet = h('div', { class: 'map-sheet' },
    h('div', { class: 'map-scroll', tabindex: '0', 'aria-label': 'The map. Scroll sideways on a small screen.' }, map),
    !unfolded && h('button', {
      class: 'map-cover', type: 'button',
      onClick: (event) => {
        unfolded = true;
        event.currentTarget.remove();
        if (!calm) {
          const opening = map.animate([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, easing: 'cubic-bezier(.6, 0, .2, 1)' });
          // Never leave the map hidden, even if a browser stalls the animation.
          setTimeout(() => { if (opening.playState !== 'finished') opening.finish(); }, 1600);
        }
        const scroller = sheet.querySelector('.map-scroll');
        scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
      },
    }, h('span', { class: 'map-cover-title' }, 'The Realm of Oxtan'), h('span', null, 'Tap to unfold the map')));

  const list = h('details', { class: 'map-secrets' },
    h('summary', null, `All the riddles (${found.size} of ${SECRETS.length} found)`),
    h('ol', null, SECRETS.map((secret) => h('li', { class: found.has(secret.id) ? 'found' : null },
      h('b', null, found.has(secret.id) ? secret.title : '???'), ` · ${secretPlace(secret, PLACES)}. `, secret.riddle))));

  queueMicrotask(() => {
    const scroller = sheet.querySelector('.map-scroll');
    if (scroller && unfolded) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  });

  return page(
    trail(['The Map', null]),
    header,
    h('div', { class: 'map-controls' }, playButton, slider, label),
    sheet,
    riddle,
    list,
    h('p', { class: 'field-hint' }, 'Found secrets are remembered in this browser only. ', h('a', { class: 'link', href: route('/') }, 'Back home')));
}
