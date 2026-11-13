// Inside the Engineering Science complex, reached from the Jenkin and Thom buildings on the Map.
//
// The floor plan runs north to south: Cryogenics, then Room 11 on the left alongside both the Wroth Library
// and the Wallace Room, then the Dead Zone, then Hølder-bygningen, then the Lift up to the Thom
// Building, whose 8th floor is the Penthouse. The Penthouse opens onto a night sky that stays put.
// Every room has something to say, and a secret (see js/ui/delights.js).
import { h, route, svg } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { page, pageHeader } from '../ui/components.js';
import { toast } from '../ui/feedback.js';
import { SECRETS, discover, foundSecrets } from '../ui/delights.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Remembered between visits, until the page is reloaded.
let biscuits = 7;
let room11Visits = 0;

const WHITEBOARD = [
  'pips(n) = 6 − |7 − n|',
  '∇ · B = 0',
  'ρ(∂u/∂t + u · ∇u) = −∇p + μ∇²u + f',
  'P(two sixes) = 1/36',
  'E[cards per roll] = Σ pips / 36',
  'Re = ρuL / μ',
  'σ = Eε (until it is not)',
  'Q = ṁ c_p ΔT',
  'P = ½ ρ A U³ C_p',
  'C_p ≤ 16/27 (sorry)',
  'lim (lunch → 0) productivity = ?',
  'wood ⊗ sheep = ∅',
];

function overlay(className, content, duration) {
  const layer = h('div', { class: `delight ${className}`, 'aria-hidden': 'true' }, content);
  document.body.append(layer);
  setTimeout(() => layer.remove(), duration);
  return layer;
}

/** The navigation trail at the top of each map page, so home is always one tap away. */
export function trail(...steps) {
  return h('nav', { class: 'crumbs', 'aria-label': 'Where you are' },
    h('a', { href: route('/') }, icon('hex', 'sm'), 'Home'),
    steps.map(([label, path]) => [h('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '›'),
      path ? h('a', { href: route(path) }, label) : h('span', { 'aria-current': 'page' }, label)]));
}

/** The panel under each plan, where rooms tell their story. */
function panel(hint) {
  return h('div', { class: 'map-riddle', 'aria-live': 'polite' }, h('p', { class: 'map-riddle-hint' }, hint));
}
const say = (holder, place, title, ...lines) => holder.replaceChildren(
  h('p', { class: 'map-riddle-place' }, place),
  h('h3', null, title),
  ...lines.map((line) => (typeof line === 'string' ? h('p', null, line) : line)));

// One ride up in ten, the Lift remembers it has a basement.
const DROP_CHANCE = 0.1;

/**
 * The slow, shaky, doubtful ride. Calls arrive(where) at the end, with where = 'up', 'down' or 'lower'
 * (the vault). Going up, it sometimes drops to Lower Ground instead. 'express' is the ride from the vault
 * straight to the top.
 */
export function rideLift(direction, arrive) {
  discover('lift');
  const drops = direction === 'up' && Math.random() < DROP_CHANCE;
  const destination = drops ? 'lower' : direction;
  if (calm()) {
    toast(drops ? 'The Lift goes down instead. Lower Ground.' : direction === 'express' ? 'The Lift shoots to the top.' : 'The Lift arrives, eventually.');
    arrive(destination);
    return;
  }
  const scripts = {
    up: [['G', 'Doors closing…'], ['G', 'Doors closing…'], ['1', 'Going up.'], ['1', 'Still floor 1.'], ['1', 'The Lift is reconsidering its life choices.'], ['2', 'Progress.'], ['1', 'Wait, what?'], ['4', 'Skipping a few.'], ['G', 'Thom Building. You are somehow on the ground floor.']],
    lower: [['G', 'Doors closing…'], ['1', 'Going up.'], ['G', 'Going… down?'], ['LG', 'This floor is not on any plan.'], ['LG', 'Lower Ground. The doors open onto something glittering.']],
    down: [['8', 'Doors closing…'], ['7', 'Going down.'], ['7', 'Still 7.'], ['4', 'Brief freefall. All part of the service.'], ['3', 'Recalculating.'], ['1', 'Nearly there.'], ['G', 'Ground. You have survived the Lift.']],
    express: [['LG', 'Hold on to your resources.'], ['1', ''], ['3', ''], ['5', ''], ['7', 'WHOOSH'], ['8', 'Penthouse. That was quick.']],
  };
  const script = scripts[drops ? 'lower' : direction];
  const step = direction === 'express' ? 230 : 560;
  const floor = h('b', { class: 'lift-floor' }, script[0][0]);
  const message = h('p', { class: 'lift-message' }, script[0][1]);
  const cabin = overlay(`lift-ride ${direction === 'express' ? 'express' : ''} ${drops ? 'dropping' : ''}`.replace(/\s+/g, ' ').trim(), h('div', { class: 'lift-cabin' },
    h('div', { class: 'lift-display' }, h('span', null, direction === 'down' || drops ? '▼' : '▲'), floor),
    message,
    h('div', { class: 'lift-doors' }, h('span'), h('span'))), script.length * step + 1400);
  script.forEach(([value, words], index) => setTimeout(() => {
    floor.textContent = value;
    if (words) message.textContent = words;
    if (index === script.length - 1) cabin.classList.add('arrived');
  }, index * step));
  setTimeout(() => arrive(destination), script.length * step + 500);
}

/** Where each ride ends up. */
const GO = { up: '/map/thom', down: '/map/engsci', lower: '/map/lower-ground', express: '/map/thom/penthouse' };
const rideTo = (direction) => rideLift(direction, (where) => { window.location.hash = route(GO[where]); });

// ---------- the floor plan ----------
// Plain rectangles, drawn like an architect's plan: [x, y, width, height]. North is up.
const ROOMS = [
  { id: 'cryo', name: 'Cryogenics', box: [50, 92, 500, 118] },
  { id: 'room11', name: 'Room 11', box: [50, 210, 210, 250] },
  { id: 'library', name: 'Wroth Library', box: [260, 210, 290, 125] },
  { id: 'wallace', name: 'Wallace Room', box: [260, 335, 290, 125] },
  { id: 'deadzone', name: 'The Dead Zone', box: [50, 460, 500, 86] },
  { id: 'holder', name: 'Hølder-bygningen', box: [50, 546, 500, 134] },
  { id: 'lift', name: 'The Lift', box: [255, 680, 90, 80] },
];

// Doors: a gap in a wall and the arc it swings through. [x, y, width, side] where side is the direction it opens.
const DOORS = [
  [300, 210, 30, 'up'], [58, 460, 30, 'up'], [515, 460, 30, 'up'], [515, 335, 30, 'up'],
  [285, 546, 30, 'up'], [285, 680, 30, 'up'],
];

const desk = (x, y, rotate = 0) => svg('g', { transform: `translate(${x} ${y}) rotate(${rotate})`, class: 'plan-furniture' },
  svg('rect', { x: -22, y: -12, width: 44, height: 24 }),
  svg('circle', { cx: 0, cy: 22, r: 7 }));

function furniture(room) {
  const [x, y, width, height] = room.box;
  switch (room.id) {
    case 'cryo': return svg('g', { class: 'plan-furniture' },
      [0, 1, 2, 3].map((i) => svg('circle', { cx: x + 70 + i * 52, cy: y + 62, r: 18 })),
      [0, 1, 2, 3].map((i) => svg('circle', { cx: x + 70 + i * 52, cy: y + 62, r: 9, class: 'inner' })),
      svg('rect', { x: x + 330, y: y + 14, width: 156, height: 26 }),
      svg('rect', { x: x + 330, y: y + 78, width: 156, height: 26 }),
      svg('text', { x: x + 408, y: y + 66, class: 'plan-tag' }, '4 K'));
    case 'room11': return svg('g', null,
      svg('rect', { x: x + 8, y: y + 18, width: 6, height: 110, class: 'plan-board' }),
      [0, 1, 2, 3].flatMap((row) => [desk(x + 70, y + 66 + row * 44), desk(x + 150, y + 66 + row * 44)]));
    case 'library': return svg('g', { class: 'plan-furniture' },
      [0, 1, 2, 3].map((i) => svg('rect', { x: x + 16, y: y + 50 + i * 16, width: 120, height: 7 })),
      svg('rect', { x: x + 170, y: y + 54, width: 96, height: 46 }),
      [0, 1, 2].map((i) => svg('circle', { cx: x + 186 + i * 32, cy: y + 46, r: 6 })),
      [0, 1, 2].map((i) => svg('circle', { cx: x + 186 + i * 32, cy: y + 108, r: 6 })));
    case 'wallace': return svg('g', { class: 'plan-furniture' },
      svg('rect', { x: x + 50, y: y + 48, width: 190, height: 40, rx: 0 }),
      [0, 1, 2, 3, 4].map((i) => svg('circle', { cx: x + 70 + i * 38, cy: y + 38, r: 6 })),
      [0, 1, 2, 3, 4].map((i) => svg('circle', { cx: x + 70 + i * 38, cy: y + 98, r: 6 })),
      svg('circle', { cx: x + 145, cy: y + 68, r: 9, class: 'inner' }));
    case 'deadzone': return svg('rect', { x, y, width, height, class: 'plan-hatch', fill: 'url(#hatch)' });
    case 'holder': return svg('g', null,
      [0, 1, 2, 3, 4, 5].map((i) => desk(x + 60 + i * 76, y + 82)));
    case 'lift': return svg('path', { d: `M${x + 10} ${y + 10}L${x + width - 10} ${y + height - 10}M${x + width - 10} ${y + 10}L${x + 10} ${y + height - 10}`, class: 'plan-lift-x' });
    default: return null;
  }
}

function roomShape(room, onTap) {
  const [x, y, width, height] = room.box;
  const found = foundSecrets().has(room.id);
  const labelY = { room11: y + 28, cryo: y + 28, library: y + 30, wallace: y + 28, deadzone: y + height / 2 + 6, holder: y + 38, lift: y + height + 22 }[room.id];
  const group = svg('g', { class: `plan-room room-${room.id} ${found ? 'found' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-label': room.name },
    svg('rect', { x, y, width, height, class: 'plan-floor' }),
    furniture(room),
    svg('text', { x: room.id === 'room11' ? x + 120 : x + width / 2, y: labelY, class: `plan-name ${room.id === 'holder' ? 'danish' : ''}`.trim() }, room.name),
    found && svg('circle', { cx: x + width - 14, cy: y + 14, r: 6, class: 'plan-found' }));
  group.addEventListener('click', () => onTap(room));
  group.addEventListener('keydown', (event) => { if (event.key === 'Enter') onTap(room); });
  return group;
}

function door([x, y, width, side]) {
  if (side === 'right-wall') {
    // A door in a vertical wall, opening into the room to its right.
    return svg('g', { class: 'plan-door' },
      svg('rect', { x: x - 10, y, width: 14, height: width, class: 'plan-door-gap' }),
      svg('path', { d: `M${x - 3} ${y}h${width}M${x - 3} ${y}a${width} ${width} 0 0 1 ${width} ${width}` }));
  }
  return svg('g', { class: 'plan-door' },
    svg('rect', { x, y: y - 7, width, height: 14, class: 'plan-door-gap' }),
    svg('path', { d: `M${x} ${y}v${-width}M${x} ${y - width}a${width} ${width} 0 0 1 ${width} ${width}` }));
}

export function renderEngSci() {
  const story = panel('Tap a room. Every one of them has something to say.');
  const inside = SECRETS.filter((secret) => secret.inside === 'engsci');
  const found = foundSecrets();

  const tap = (room) => {
    switch (room.id) {
      case 'cryo':
        say(story, 'The northern edge', 'Cryogenics', 'Four kelvin and falling. Bring a jumper, and do not lick anything.', 'Tea left on the bench freezes in under a minute, which at least stops it going cold.');
        discover('cryo');
        if (!calm()) overlay('frost', null, 3200);
        break;
      case 'library':
        say(story, 'South of the cold, beside Room 11', 'Wroth Library', 'Shhh.', 'A room of books, desks and very quiet keyboards. Trading is permitted, but only by whispering.');
        discover('library');
        if (!calm()) overlay('shhh', h('span', null, 'Shhh.'), 1800);
        break;
      case 'wallace': {
        biscuits = Math.max(0, biscuits - 1);
        if (biscuits === 0) {
          say(story, 'Below the library', 'Wallace Room', 'The plate is empty. Someone ate the last biscuit.', 'The prime suspect is the robber, who was seen nearby holding seven of something.');
          discover('wallace');
        } else {
          say(story, 'Below the library', 'Wallace Room', `A seminar is in progress. Biscuits on the plate: ${biscuits}.`, 'You take one. Nobody notices. Yet.');
        }
        break;
      }
      case 'room11': {
        room11Visits += 1;
        const board = WHITEBOARD[(room11Visits - 1) % WHITEBOARD.length];
        say(story, 'The big office on the left', 'Room 11',
          'Rows of desks, a whiteboard that is never quite clean, and a lot of quiet typing. Today the board reads:',
          h('p', { class: 'whiteboard' }, board),
          room11Visits >= 11 ? 'Visit eleven. Room 11 goes up to eleven.' : `Visits: ${room11Visits}.`);
        if (room11Visits >= 11) discover('room11');
        break;
      }
      case 'deadzone':
        say(story, 'Between the old and the Danish', 'The Dead Zone', 'No signal. No wifi. No messages. No distractions.', 'Possibly the best place in Oxford to play Catan.');
        discover('deadzone');
        if (!calm()) overlay('no-signal', h('div', null, h('b', null, 'Signal lost'), h('span', null, 'Just kidding. The Dead Zone only eats phone signal.')), 2600);
        break;
      case 'holder':
        say(story, 'South of the Dead Zone', 'Hølder-bygningen', 'Velkommen til Hølder-bygningen! Her bygger vi bosættelser, veje og byer.', '(Welcome to the Holder building! Here we build settlements, roads and cities.)');
        discover('holder');
        break;
      case 'lift':
        say(story, 'The southern end', 'The Lift', 'It goes up to the Thom Building. In theory.');
        rideTo('up');
        break;
      default:
    }
  };

  const plan = svg('svg', { class: 'plan-svg', viewBox: '0 0 600 830', role: 'img', 'aria-label': 'Floor plan of the Engineering Science complex. North is at the top.' },
    svg('defs', null,
      svg('pattern', { id: 'hatch', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        svg('path', { d: 'M0 0v12', stroke: 'rgba(30, 30, 30, .18)', 'stroke-width': 3 })),
      svg('pattern', { id: 'grid', width: 20, height: 20, patternUnits: 'userSpaceOnUse' },
        svg('path', { d: 'M20 0H0V20', fill: 'none', stroke: 'rgba(60, 90, 140, .08)', 'stroke-width': 1 }))),
    svg('rect', { x: 0, y: 0, width: 600, height: 830, class: 'plan-paper' }),
    svg('rect', { x: 0, y: 0, width: 600, height: 830, fill: 'url(#grid)' }),
    svg('text', { x: 50, y: 50, class: 'plan-title' }, 'ENGINEERING SCIENCE · GROUND FLOOR'),
    svg('text', { x: 50, y: 72, class: 'plan-subtitle' }, 'Jenkin Building and what lies south of it. Not to scale.'),
    ROOMS.map((room) => roomShape(room, tap)),
    // The Jenkin Building's outer walls, drawn over the rooms.
    svg('rect', { x: 50, y: 92, width: 500, height: 368, class: 'plan-outer' }),
    svg('text', { x: 566, y: 276, class: 'plan-building-name', transform: 'rotate(90 566 276)' }, 'JENKIN BUILDING'),
    DOORS.map(door),
    svg('path', { d: 'M300 790v8', class: 'plan-arrow' }),
    svg('text', { x: 300, y: 812, class: 'plan-subtitle centre' }, 'to the Thom Building, if the lift allows'),
    svg('g', { transform: 'translate(540 52)' },
      svg('path', { d: 'M0 -20l7 18h-14Z', fill: '#b23a26' }), svg('text', { x: 0, y: 14, class: 'plan-north' }, 'N')));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', null]),
    pageHeader({
      eyebrow: 'Parks Road',
      title: 'The EngSci complex',
      intro: `North is at the top. Tap any room. ${inside.filter((secret) => found.has(secret.id)).length} of ${inside.length} secrets found in here.`,
      actions: [
        h('a', { class: 'btn', href: route('/map') }, icon('map'), 'Back to the Map'),
        h('a', { class: 'btn', href: route('/map/thom') }, 'Thom Building (by stairs)'),
      ],
    }),
    h('div', { class: 'plan-sheet' }, plan),
    story);
}

// ---------- the Thom Building ----------
export function renderThom() {
  const story = panel('Tap a floor. The best is at the top.');
  const floors = [
    { id: 'penthouse', name: 'Floor 8: The Penthouse' },
    ...['A meeting room nobody booked', 'Offices with a view', 'Labs, humming', 'More offices', 'Labs', 'Offices', 'Printers, mostly jammed']
      .map((note, index) => ({ id: `floor-${7 - index}`, name: `Floor ${7 - index}`, note })),
    { id: 'ground', name: 'Ground floor', note: 'Lift lobby. You arrive here, eventually.' },
  ];
  const tap = (floor) => {
    if (floor.id === 'penthouse') {
      window.location.hash = route('/map/thom/penthouse');
    } else if (floor.id === 'ground') {
      say(story, 'Ground floor', 'The lift lobby', 'The lift will take you back down to the rest of the complex, in its own time.',
        h('button', { class: 'btn sm', type: 'button', onClick: () => rideTo('down') }, 'Take the Lift down'));
    } else {
      say(story, 'The Thom Building', floor.name, `${floor.note}. Nothing much to see here, which is exactly what a secret would want you to think. Keep climbing: the Penthouse is on 8.`);
    }
  };

  const tower = svg('svg', { class: 'plan-svg thom-svg', viewBox: '0 0 400 800', role: 'img', 'aria-label': 'The Thom Building, floor by floor, with the Penthouse on the 8th floor' },
    svg('rect', { x: 0, y: 0, width: 400, height: 800, class: 'plan-paper' }),
    svg('text', { x: 200, y: 52, class: 'plan-title centre' }, 'THOM BUILDING · SECTION'),
    floors.map((floor, index) => {
      const y = 90 + index * 66;
      const isPenthouse = floor.id === 'penthouse';
      const found = isPenthouse && foundSecrets().has('penthouse');
      const group = svg('g', { class: `plan-room ${isPenthouse ? 'penthouse' : ''} ${found ? 'found' : ''}`.replace(/\s+/g, ' ').trim(), role: 'button', tabindex: '0', 'aria-label': floor.name },
        svg('rect', { x: 90, y, width: 220, height: 66, class: 'plan-floor' }),
        [0, 1, 2, 3, 4].map((window) => svg('rect', { x: 102 + window * 40, y: y + 12, width: 26, height: 22, class: 'plan-window' })),
        svg('text', { x: 200, y: y + 54, class: 'plan-floor-name' }, floor.name));
      group.addEventListener('click', () => tap(floor));
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter') tap(floor); });
      return group;
    }),
    svg('rect', { x: 90, y: 90, width: 220, height: 66 * floors.length, class: 'plan-outer' }),
    svg('rect', { x: 310, y: 90, width: 30, height: 66 * floors.length, class: 'plan-shaft' }),
    svg('text', { x: 325, y: 420, class: 'plan-building-name', transform: 'rotate(90 325 420)' }, 'THE LIFT'));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Thom Building', null]),
    pageHeader({
      eyebrow: 'The tallest tower in the complex',
      title: 'The Thom Building',
      intro: 'Floor by floor, with the Penthouse on the 8th floor. Tap a floor.',
      actions: [
        h('button', { class: 'btn', type: 'button', onClick: () => rideTo('down') }, 'Lift down to the complex'),
        h('a', { class: 'btn', href: route('/map') }, icon('map'), 'Back to the Map'),
      ],
    }),
    h('div', { class: 'plan-sheet thom-sheet' }, tower),
    story);
}

// ---------- the view from the Penthouse ----------
// Deep-sky images from NASA's image library (images.nasa.gov), credited below the sky.
export const SKY_IMAGES = [
  { file: 'andromeda', name: 'Andromeda Galaxy', at: [250, 190], size: 250, credit: 'NASA/JPL/California Institute of Technology', source: 'https://images.nasa.gov/details/PIA04921' },
  { file: 'pillars', name: 'Pillars of Creation', at: [1340, 600], size: 190, credit: 'NASA, ESA and the Hubble Heritage Team', source: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000842' },
  { file: 'carina', name: 'Cosmic Cliffs, Carina Nebula', at: [820, 150], size: 230, credit: 'NASA, ESA, CSA, STScI', source: 'https://images.nasa.gov/details/carina_nebula' },
  { file: 'crab', name: 'Crab Nebula', at: [1180, 300], size: 170, credit: 'NASA/ESA/JPL/Arizona State University', source: 'https://images.nasa.gov/details/PIA03606' },
  { file: 'whirlpool', name: 'Whirlpool Galaxy', at: [140, 560], size: 170, credit: 'NASA, ESA (Hubble), via NASA Goddard', source: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001935' },
  { file: 'orion', name: 'Orion Nebula', at: [560, 470], size: 170, credit: 'ESA/NASA/JPL-Caltech', source: 'https://images.nasa.gov/details/PIA25434' },
];

// Constellation figures: stars as [x, y] (a rough likeness, not a star atlas), lines as pairs of star indexes.
const CONSTELLATIONS = [
  { name: 'Orion', at: [690, 300], scale: 1.6, stars: [[0, 0], [60, 4], [30, -18], [18, 48], [30, 46], [42, 43], [8, 96], [62, 92]], lines: [[0, 2], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7]] },
  { name: 'The Plough', at: [430, 70], scale: 1.5, stars: [[0, 0], [4, 26], [40, 32], [38, 10], [64, 4], [88, 0], [116, 12]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  { name: 'Cassiopeia', at: [1010, 60], scale: 1.4, stars: [[0, 0], [20, 28], [42, 12], [62, 30], [84, 4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'Cygnus', at: [1400, 80], scale: 1.4, stars: [[40, 0], [40, 40], [40, 100], [0, 46], [80, 34]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  { name: 'Lyra', at: [1290, 140], scale: 1.4, stars: [[0, 0], [10, 18], [22, 16], [16, 40], [28, 38]], lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]] },
  { name: 'Scorpius', at: [1000, 470], scale: 1.4, stars: [[-10, -12], [0, 0], [8, -14], [14, 10], [30, 30], [36, 52], [40, 76], [52, 92], [70, 96], [84, 86], [80, 70]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]] },
  { name: 'Leo', at: [80, 300], scale: 1.4, stars: [[0, 60], [2, 36], [12, 18], [30, 10], [40, 20], [70, 60], [110, 50], [80, 40]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 1]] },
  { name: 'Crux', at: [1480, 400], scale: 1.6, stars: [[10, 0], [10, 40], [0, 18], [24, 16]], lines: [[0, 1], [2, 3]] },
  { name: 'Gemini', at: [870, 380], scale: 1.3, stars: [[0, 0], [18, 6], [4, 30], [22, 34], [6, 62], [26, 66]], lines: [[0, 2], [2, 4], [1, 3], [3, 5], [0, 1]] },
  { name: 'Pegasus', at: [1150, 160], scale: 1.4, stars: [[0, 0], [50, 4], [54, 50], [2, 46], [-30, 60]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]] },
  { name: 'Taurus', at: [430, 300], scale: 1.4, stars: [[0, 0], [14, 10], [28, 18], [40, 10], [54, 0], [-20, -24], [70, -22]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [4, 6]] },
  { name: 'Draco', at: [600, 40], scale: 1.3, stars: [[0, 0], [16, 8], [30, 2], [50, 14], [56, 36], [80, 44], [104, 34], [120, 50]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
  { name: 'Aquila', at: [1460, 230], scale: 1.4, stars: [[0, 0], [8, -8], [-8, 8], [-30, -10], [30, 20]], lines: [[1, 0], [0, 2], [0, 3], [0, 4]] },
  { name: 'Corona Borealis', at: [180, 420], scale: 1.4, stars: [[0, 0], [10, 10], [24, 14], [38, 12], [48, 4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'Ursa Minor', at: [270, 40], scale: 1.2, stars: [[0, 0], [18, 8], [34, 14], [50, 20], [56, 38], [76, 40], [72, 22]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
];

// A new constellation, named for Ryan. It spells the name out in stars, and it stays in the sky for good.
const RYAN = {
  name: 'Ryan',
  at: [700, 640],
  scale: 2.2,
  stars: [[0, 40], [0, 0], [16, 0], [22, 9], [16, 18], [0, 18], [22, 40], [32, 0], [42, 18], [52, 0], [42, 40], [60, 40], [70, 0], [80, 40], [64.5, 24], [75.5, 24], [90, 40], [90, 0], [110, 40], [110, 0]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8], [8, 9], [8, 10], [11, 12], [12, 13], [14, 15], [16, 17], [17, 18], [18, 19]],
};

/** A repeatable sequence of numbers, so the stars are in the same places on every visit. */
function seeded(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

function figure(constellation, className) {
  const [ox, oy] = constellation.at;
  const point = ([x, y]) => [ox + x * constellation.scale, oy + y * constellation.scale];
  const stars = constellation.stars.map(point);
  const top = Math.min(...stars.map(([, y]) => y));
  const left = Math.min(...stars.map(([x]) => x));
  const right = Math.max(...stars.map(([x]) => x));
  return svg('g', { class: className },
    constellation.lines.map(([a, b]) => svg('line', { x1: stars[a][0], y1: stars[a][1], x2: stars[b][0], y2: stars[b][1], class: 'sky-line' })),
    stars.map(([x, y], index) => svg('circle', { cx: x, cy: y, r: index % 3 === 0 ? 3 : 2.3, class: 'sky-star' })),
    svg('text', { x: (left + right) / 2, y: top - 14, class: 'sky-name' }, constellation.name));
}

export function renderPenthouse() {
  discover('penthouse');
  const random = seeded(8);
  const W = 1600;
  const H = 1000;
  const lightbox = (image) => {
    const box = h('dialog', { class: 'sky-lightbox', 'aria-label': image.name, onClose: () => box.remove(), onClick: (event) => { if (event.target === box) box.close(); } },
      h('img', { src: `assets/sky/${image.file}.jpg`, alt: image.name }),
      h('p', null, h('b', null, image.name), ` · ${image.credit}. `, h('a', { class: 'link', href: image.source, target: '_blank', rel: 'noopener' }, 'Source')),
      h('button', { class: 'btn sm', type: 'button', onClick: () => box.close() }, 'Close'));
    document.body.append(box);
    box.showModal();
  };

  const sky = svg('svg', { class: 'sky-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The night sky from the Penthouse: galaxies, nebulae, constellations, and Ryan' },
    svg('defs', null,
      svg('linearGradient', { id: 'sky-fade', x1: 0, y1: 0, x2: 0, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': '#03050d' }),
        svg('stop', { offset: '62%', 'stop-color': '#0b1636' }),
        svg('stop', { offset: '100%', 'stop-color': '#2b2a4a' })),
      svg('radialGradient', { id: 'soft-edge' },
        svg('stop', { offset: '55%', 'stop-color': '#fff' }),
        svg('stop', { offset: '100%', 'stop-color': '#000' })),
      svg('mask', { id: 'soft-mask', maskContentUnits: 'objectBoundingBox' }, svg('rect', { width: 1, height: 1, fill: 'url(#soft-edge)' })),
      svg('filter', { id: 'milky', x: '-20%', y: '-20%', width: '140%', height: '140%' },
        svg('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.012, numOctaves: 4, seed: 3 }),
        svg('feColorMatrix', { values: '0 0 0 0 0.75  0 0 0 0 0.78  0 0 0 0 0.95  0 0 0 1.4 -0.55' }),
        svg('feGaussianBlur', { stdDeviation: 2 }))),
    svg('rect', { width: W, height: H, fill: 'url(#sky-fade)' }),
    // The Milky Way, a faint band across the sky.
    svg('rect', { x: -200, y: 300, width: 2000, height: 260, filter: 'url(#milky)', transform: `rotate(-18 ${W / 2} ${H / 2})`, opacity: 0.55 }),
    // Hundreds of background stars, always in the same places.
    svg('g', null, Array.from({ length: 700 }, () => {
      const size = random() ** 3 * 2.2 + 0.4;
      return svg('circle', { cx: random() * W, cy: random() * (H - 120), r: size, class: random() < 0.12 ? 'sky-dot twinkle' : 'sky-dot', style: { animationDelay: `${(random() * 4).toFixed(2)}s` } });
    })),
    SKY_IMAGES.map((image) => {
      const [cx, cy] = image.at;
      const group = svg('g', { class: 'sky-object', role: 'button', tabindex: '0', 'aria-label': `${image.name}. Open the full picture.` },
        svg('image', { href: `assets/sky/${image.file}.jpg`, x: cx - image.size / 2, y: cy - image.size / 2, width: image.size, height: image.size, preserveAspectRatio: 'xMidYMid slice', mask: 'url(#soft-mask)' }),
        svg('text', { x: cx, y: cy + image.size / 2 + 6, class: 'sky-object-name' }, image.name));
      group.addEventListener('click', () => lightbox(image));
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter') lightbox(image); });
      return group;
    }),
    CONSTELLATIONS.map((constellation) => figure(constellation, 'sky-figure')),
    figure(RYAN, 'sky-figure ryan'),
    svg('text', { x: 700 + 55 * 2.2, y: 640 + 40 * 2.2 + 30, class: 'sky-ryan-note' }, 'the newest constellation in the sky, and it is staying'),
    // Oxford's skyline from the 8th floor: spires, the Radcliffe Camera's dome and Tom Tower.
    svg('path', { class: 'sky-skyline', d: `M0 ${H}V900h60v-30h40v40h50v-70l12-40 12 40v70h60v-20h70v-30q40-60 80 0v30h50v-60l6-50 6 50v60h80v-40h40l20-30 20 30h40v50h90v-110l10-60 10 60v110h70v-30h60v40h60l14-90 14 90h70v-50h90v30h60v-60q30-40 60 0v60h80v-20h60v40h80V${H}Z` }),
    Array.from({ length: 60 }, () => svg('rect', { x: random() * W, y: 905 + random() * 80, width: 4, height: 6, class: 'sky-window' })));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Thom Building', '/map/thom'], ['The Penthouse', null]),
    pageHeader({
      eyebrow: 'Thom Building · Floor 8',
      title: 'The view from the Penthouse',
      intro: 'The best view in Oxford, after dark. Tap a galaxy or nebula to see it in full. Somewhere up there is Ryan.',
      actions: h('a', { class: 'btn', href: route('/map/thom') }, 'Back down the tower'),
    }),
    h('div', { class: 'sky-sheet' }, h('div', { class: 'sky-scroll', tabindex: '0', 'aria-label': 'The night sky. Scroll sideways on a small screen.' }, sky)),
    h('section', { class: 'sky-credits' },
      h('h2', null, 'In the sky tonight'),
      h('ul', null, SKY_IMAGES.map((image) => h('li', null,
        h('button', { class: 'link-btn', type: 'button', onClick: () => lightbox(image) }, image.name),
        ` · ${image.credit} · `,
        h('a', { class: 'link', href: image.source, target: '_blank', rel: 'noopener' }, 'NASA image library')))),
      h('p', { class: 'field-hint' }, `Images from NASA's image library (images.nasa.gov), shown with credit. Constellation figures are drawn as rough likenesses, plus ${CONSTELLATIONS.length} classics and one newcomer.`)));
}

// ---------- Lower Ground: the vault the Lift does not admit to ----------
const HOARD = [
  { name: 'Brick', colour: '#c4613a', note: 'Enough for every road in Oxford, twice.' },
  { name: 'Lumber', colour: '#3d6b35', note: 'A forest, neatly stacked.' },
  { name: 'Wool', colour: '#9cc45a', note: 'Every sheep that was ever traded, and their cousins.' },
  { name: 'Grain', colour: '#e3b23c', note: 'Sheaves to the ceiling. Somebody has been hoarding.' },
  { name: 'Ore', colour: '#8c9199', note: 'Mountains of it, in a basement.' },
  { name: 'Gold', colour: '#d3ae58', note: 'For the settler who has everything.' },
  { name: 'Development cards', colour: '#6b4fa0', note: 'All knights. Every single one.' },
  { name: 'Wood for sheep', colour: '#b98a5a', note: 'A signed trade agreement. The only one in existence.' },
];

/** A pile of hexagons in one colour, stacked like a heap of resource cards. */
function pile(colour) {
  const hexes = [[30, 70], [62, 70], [94, 70], [46, 44], [78, 44], [62, 18]];
  return svg('svg', { viewBox: '0 0 124 100', class: 'hoard-pile', 'aria-hidden': 'true' },
    hexes.map(([x, y]) => svg('path', { d: `M${x} ${y - 18}l15.6 9v18L${x} ${y + 18}l-15.6-9v-18Z`, fill: colour, stroke: 'rgba(0, 0, 0, .35)', 'stroke-width': 2 })));
}

export function renderLowerGround() {
  discover('vault');
  const harvest = h('button', { class: 'btn gold harvest-btn', type: 'button' }, 'Harvest resources');
  const cards = HOARD.map((item) => h('div', { class: 'hoard-card' },
    pile(item.colour),
    h('b', null, item.name, h('span', { class: 'hoard-count' }, ' × ∞')),
    h('span', null, item.note)));
  harvest.addEventListener('click', () => {
    harvest.disabled = true;
    harvest.textContent = 'Harvesting…';
    toast('+∞ of everything. The Lift is waiting, and it looks excited.', 'good');
    if (!calm()) {
      cards.forEach((card, index) => card.querySelector('.hoard-pile').animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: `translate(${(Math.random() - 0.5) * 80}px, -70vh) scale(.4) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 0 },
      ], { duration: 900, delay: index * 70, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }));
    }
    setTimeout(() => rideTo('express'), calm() ? 300 : 1500);
  });

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Lower Ground', null]),
    pageHeader({
      eyebrow: 'The Lift · Lower Ground',
      title: 'The vault',
      intro: 'This floor is not on any plan. Every resource a settler could dream of, in endless supply, and nobody guarding it.',
    }),
    h('section', { class: 'vault' },
      h('div', { class: 'hoard' }, cards),
      h('div', { class: 'vault-acts' }, harvest,
        h('p', null, 'Harvest everything, and the Lift will take you straight to the top. Probably.'))));
}
