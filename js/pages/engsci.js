// Inside the Engineering Science complex, reached from the Jenkin and Thom buildings on the Map.
//
// The floor plan runs north to south: Cryogenics, then the Wroth Library and the Wallace Room with Room 11
// alongside both, then the Dead Zone, then Hølder-bygningen, then the Terrible Lift up to the Thom Building.
// Every room has something to say, and a secret (see js/ui/delights.js).
import { h, route, svg } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { page, pageHeader } from '../ui/components.js';
import { toast } from '../ui/feedback.js';
import { SECRETS, discover, foundSecrets } from '../ui/delights.js';

const INK = '#3b2a17';
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

/** The slow, shaky, doubtful ride. Calls arrive() at the end. */
export function rideLift(direction, arrive) {
  discover('lift');
  if (calm()) { toast('The lift arrives, eventually.'); arrive(); return; }
  const floor = h('b', { class: 'lift-floor' }, direction === 'up' ? 'G' : '9');
  const message = h('p', { class: 'lift-message' }, 'Doors closing…');
  const cabin = overlay('lift-ride', h('div', { class: 'lift-cabin' },
    h('div', { class: 'lift-display' }, h('span', null, direction === 'up' ? '▲' : '▼'), floor),
    message,
    h('div', { class: 'lift-doors' }, h('span'), h('span'))), 6400);
  const script = direction === 'up'
    ? [['G', 'Doors closing…'], ['G', 'Doors closing…'], ['1', 'Going up.'], ['1', 'Still floor 1.'], ['1', 'The lift is reconsidering its life choices.'], ['2', 'Progress.'], ['1', 'Wait, what?'], ['4', 'Skipping a few.'], ['7', 'Nearly there.'], ['T', 'Thom Building. Mind the gap.']]
    : [['9', 'Doors closing…'], ['8', 'Going down.'], ['8', 'Still 8.'], ['5', 'Brief freefall. All part of the service.'], ['3', 'Recalculating.'], ['1', 'Nearly there.'], ['G', 'Ground. You have survived the lift.']];
  script.forEach(([value, words], index) => setTimeout(() => {
    floor.textContent = value;
    message.textContent = words;
    if (index === script.length - 1) cabin.classList.add('arrived');
  }, index * 560));
  setTimeout(arrive, script.length * 560 + 500);
}

// ---------- the floor plan ----------
const ROOMS = [
  { id: 'cryo', name: 'Cryogenics', box: [60, 96, 480, 116] },
  { id: 'library', name: 'Wroth Library', box: [60, 212, 300, 116] },
  { id: 'wallace', name: 'Wallace Room', box: [60, 328, 300, 116] },
  { id: 'room11', name: 'Room 11', box: [360, 212, 180, 232] },
  { id: 'deadzone', name: 'The Dead Zone', box: [60, 460, 480, 92] },
  { id: 'holder', name: 'Hølder-bygningen', box: [60, 568, 480, 112] },
  { id: 'lift', name: 'The Terrible Lift', box: [250, 704, 100, 82] },
];

function roomShape(room, onTap) {
  const [x, y, width, height] = room.box;
  const found = foundSecrets().has(room.id);
  const group = svg('g', { class: `plan-room room-${room.id} ${found ? 'found' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-label': room.name },
    svg('rect', { x, y, width, height, rx: 4, class: 'plan-floor' }),
    room.id === 'deadzone' && svg('rect', { x, y, width, height, class: 'plan-hatch', fill: 'url(#hatch)' }),
    room.id === 'cryo' && [[120, 140], [260, 170], [420, 132], [480, 186], [180, 190]].map(([fx, fy]) => svg('text', { x: fx, y: fy, class: 'plan-flake' }, '❄︎')),
    room.id === 'library' && [0, 1, 2, 3, 4, 5].map((index) => svg('rect', { x: x + 22 + index * 44, y: y + 70, width: 30, height: 30, class: 'plan-shelf' })),
    room.id === 'room11' && [svg('rect', { x: x + 26, y: y + 30, width: width - 52, height: 70, class: 'plan-board' }), svg('text', { x: x + width / 2, y: y + 72, class: 'plan-board-text' }, 'E = mc²')],
    room.id === 'lift' && svg('path', { d: `M${x + 50} ${y + 18}l-12 14h24Z M${x + 50} ${y + 64}l-12 -14h24Z`, fill: INK }),
    svg('text', { x: x + width / 2, y: y + (room.id === 'lift' ? height + 22 : room.id === 'library' ? 44 : height / 2 + 7), class: `plan-name ${room.id === 'holder' ? 'danish' : ''}`.trim() }, room.name),
    found && svg('circle', { cx: x + width - 16, cy: y + 16, r: 7, class: 'plan-found' }));
  group.addEventListener('click', () => onTap(room));
  group.addEventListener('keydown', (event) => { if (event.key === 'Enter') onTap(room); });
  return group;
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
        say(story, 'Just south of the cold', 'Wroth Library', 'Shhh.', 'A room of books, desks and very quiet keyboards. Trading is permitted, but only by whispering.');
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
        say(story, 'Alongside the Library and the Wallace Room', 'Room 11',
          'The whiteboard has been cleaned and filled again. Today it reads:',
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
        say(story, 'The southern end', 'The Terrible Lift', 'It goes up to the Thom Building. In theory.');
        rideLift('up', () => { window.location.hash = route('/map/thom'); });
        break;
      default:
    }
  };

  const plan = svg('svg', { class: 'plan-svg', viewBox: '0 0 600 860', role: 'img', 'aria-label': 'Floor plan of the Engineering Science complex. North is at the top.' },
    svg('defs', null,
      svg('pattern', { id: 'hatch', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        svg('path', { d: 'M0 0v12', stroke: 'rgba(59, 42, 23, .25)', 'stroke-width': 3 }))),
    svg('rect', { x: 0, y: 0, width: 600, height: 860, class: 'plan-paper' }),
    svg('rect', { x: 14, y: 14, width: 572, height: 832, fill: 'none', stroke: INK, 'stroke-width': 2.2 }),
    svg('text', { x: 300, y: 56, class: 'plan-title' }, 'The Engineering Science Complex'),
    svg('text', { x: 300, y: 78, class: 'plan-subtitle' }, 'a plan of the Jenkin Building and what lies south of it'),
    // The Jenkin Building around the first three rooms.
    svg('rect', { x: 50, y: 88, width: 500, height: 364, class: 'plan-building' }),
    svg('text', { x: 556, y: 270, class: 'plan-building-name', transform: 'rotate(90 556 270)' }, 'JENKIN BUILDING'),
    ROOMS.map((room) => roomShape(room, tap)),
    svg('path', { d: 'M300 786v34', stroke: INK, 'stroke-width': 1.6, 'stroke-dasharray': '4 4' }),
    svg('text', { x: 300, y: 838, class: 'plan-subtitle' }, 'up to the Thom Building, if the lift allows'),
    svg('g', { transform: 'translate(540 50)' },
      svg('path', { d: 'M0 -22l7 20h-14Z', fill: '#8b2a1d' }), svg('text', { x: 0, y: 14, class: 'plan-north' }, 'N')));

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
    { id: 'penthouse', name: 'The Penthouse', note: 'Top floor' },
    ...Array.from({ length: 8 }, (_, index) => ({ id: `floor-${8 - index}`, name: `Floor ${8 - index}`, note: ['Offices', 'Labs', 'More offices', 'A meeting room nobody booked', 'Offices with a view', 'Labs, humming', 'Offices', 'Printers, mostly jammed'][index] })),
    { id: 'ground', name: 'Ground floor', note: 'Lift lobby. You arrive here, eventually.' },
  ];
  const tap = (floor) => {
    if (floor.id === 'penthouse') {
      say(story, 'The very top of the Thom Building', 'The Penthouse',
        'The highest settlement in Oxford. From up here you can see the Radcliffe Camera, Port Meadow and, on a clear day, someone being robbed of their sheep.',
        'Whoever reaches the Penthouse may claim the best view of any game in the realm.');
      discover('penthouse');
      if (!calm()) overlay('night-view', h('div', { class: 'night-sky' }, Array.from({ length: 40 }, () => h('span', { style: { left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%`, animationDelay: `${Math.random() * 2}s` } }))), 3400);
    } else if (floor.id === 'ground') {
      say(story, 'Ground floor', 'The lift lobby', 'The lift will take you back down to the rest of the complex, in its own time.',
        h('button', { class: 'btn sm', type: 'button', onClick: () => rideLift('down', () => { window.location.hash = route('/map/engsci'); }) }, 'Take the Terrible Lift down'));
    } else {
      say(story, 'The Thom Building', floor.name, `${floor.note}. Nothing much to see here, which is exactly what a secret would want you to think. (It is not here. Keep climbing.)`);
    }
  };

  const tower = svg('svg', { class: 'plan-svg thom-svg', viewBox: '0 0 400 860', role: 'img', 'aria-label': 'The Thom Building, floor by floor, with the Penthouse at the top' },
    svg('rect', { x: 0, y: 0, width: 400, height: 860, class: 'plan-paper' }),
    svg('rect', { x: 14, y: 14, width: 372, height: 832, fill: 'none', stroke: INK, 'stroke-width': 2.2 }),
    svg('text', { x: 200, y: 56, class: 'plan-title' }, 'The Thom Building'),
    svg('path', { d: 'M110 140l90-50 90 50Z', fill: '#d3ae58', stroke: INK, 'stroke-width': 2 }),
    floors.map((floor, index) => {
      const y = 140 + index * 66;
      const isPenthouse = floor.id === 'penthouse';
      const found = isPenthouse && foundSecrets().has('penthouse');
      const group = svg('g', { class: `plan-room ${isPenthouse ? 'penthouse' : ''} ${found ? 'found' : ''}`.replace(/\s+/g, ' ').trim(), role: 'button', tabindex: '0', 'aria-label': floor.name },
        svg('rect', { x: 110, y, width: 180, height: 66, class: 'plan-floor' }),
        [0, 1, 2, 3].map((window) => svg('rect', { x: 124 + window * 40, y: y + 14, width: 26, height: 20, class: 'plan-window' })),
        svg('text', { x: 200, y: y + 54, class: 'plan-floor-name' }, floor.name));
      group.addEventListener('click', () => tap(floor));
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter') tap(floor); });
      return group;
    }),
    svg('rect', { x: 290, y: 140, width: 26, height: 660, class: 'plan-shaft' }),
    svg('text', { x: 303, y: 470, class: 'plan-building-name', transform: 'rotate(90 303 470)' }, 'THE TERRIBLE LIFT'));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Thom Building', null]),
    pageHeader({
      eyebrow: 'The tallest tower in the complex',
      title: 'The Thom Building',
      intro: 'Floor by floor, with the Penthouse at the top. Tap a floor.',
      actions: [
        h('button', { class: 'btn', type: 'button', onClick: () => rideLift('down', () => { window.location.hash = route('/map/engsci'); }) }, 'Lift down to the complex'),
        h('a', { class: 'btn', href: route('/map') }, icon('map'), 'Back to the Map'),
      ],
    }),
    h('div', { class: 'plan-sheet thom-sheet' }, tower),
    story);
}
