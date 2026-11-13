// Places you can step into from the EngSci complex: the cold lab behind Cryogenics, which opens onto the
// Arctic, and (in js/pages/library.js) the shelves of the Wroth Library.
import { h, route, svg } from '../ui/dom.js';
import { page, pageHeader } from '../ui/components.js';
import { discover } from '../ui/delights.js';
import { trail } from './engsci.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function storyPanel(hint) {
  return h('div', { class: 'map-riddle', 'aria-live': 'polite' }, h('p', { class: 'map-riddle-hint' }, hint));
}
const tell = (holder, place, title, ...lines) => holder.replaceChildren(
  h('p', { class: 'map-riddle-place' }, place), h('h3', null, title), ...lines.map((line) => h('p', null, line)));

function gradient(id, stops, { vertical = true } = {}) {
  return svg('linearGradient', { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 },
    stops.map(([offset, colour]) => svg('stop', { offset, 'stop-color': colour })));
}

// ---------- the cold lab ----------
export function renderCryogenics() {
  discover('cryo');
  const story = storyPanel('Four kelvin and falling. There is a heavy door at the back of the lab.');
  const W = 900;
  const H = 520;

  const dewar = (x, height, label) => svg('g', null,
    svg('rect', { x: x - 34, y: 430 - height, width: 68, height, rx: 10, fill: 'url(#steel)', stroke: '#5c6b78', 'stroke-width': 1.5 }),
    svg('rect', { x: x - 20, y: 410 - height, width: 40, height: 24, rx: 4, fill: 'url(#steel)', stroke: '#5c6b78' }),
    svg('path', { d: `M${x - 30} ${445 - height}h60M${x - 30} ${455 - height}h60`, stroke: 'rgba(255, 255, 255, .45)', 'stroke-width': 2 }),
    svg('text', { x, y: 470 - height / 2, class: 'cryo-label' }, label));

  const door = svg('g', { class: 'cryo-door', role: 'button', tabindex: '0', 'aria-label': 'Open the heavy door at the back of the lab' },
    svg('rect', { x: 360, y: 120, width: 180, height: 300, rx: 6, fill: '#5f6c78' }),
    svg('rect', { x: 372, y: 132, width: 156, height: 276, rx: 4, fill: 'url(#door-steel)', class: 'cryo-door-leaf' }),
    [168, 360].map((y) => svg('rect', { x: 366, y, width: 14, height: 30, rx: 3, fill: '#3b4651' })),
    svg('rect', { x: 500, y: 250, width: 12, height: 56, rx: 4, fill: '#2f3a44' }),
    svg('rect', { x: 398, y: 168, width: 104, height: 60, rx: 3, fill: '#f3d23a', stroke: '#2a2a2a', 'stroke-width': 2 }),
    svg('text', { x: 450, y: 192, class: 'cryo-sign' }, 'ARCTIC'),
    svg('text', { x: 450, y: 214, class: 'cryo-sign small' }, 'KEEP CLOSED'),
    // Frost creeping in from the edges of the door.
    svg('path', { d: 'M372 132h156v18c-20 6-44-2-64 6s-56-4-92 4Z', fill: 'rgba(240, 250, 255, .75)' }),
    svg('path', { d: 'M372 408h156v-14c-24-8-50 4-76-4s-50 6-80 0Z', fill: 'rgba(240, 250, 255, .6)' }));

  const scene = svg('svg', { class: 'scene-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The cryogenics lab: tall steel dewars, frosted pipes and a heavy door at the back marked Arctic' },
    svg('defs', null,
      gradient('lab-wall', [['0%', '#c9d8e2'], ['100%', '#8fa6b8']]),
      gradient('lab-floor', [['0%', '#7d8f9d'], ['100%', '#4b5a66']]),
      gradient('steel', [['0%', '#9aa7b2'], ['35%', '#e8eef2'], ['60%', '#b7c3cc'], ['100%', '#7c8a96']], { vertical: false }),
      gradient('door-steel', [['0%', '#8d99a4'], ['45%', '#cfd8df'], ['100%', '#7f8b96']], { vertical: false }),
      gradient('mist', [['0%', 'rgba(255, 255, 255, 0)'], ['100%', 'rgba(235, 245, 255, .85)']])),
    svg('rect', { width: W, height: 430, fill: 'url(#lab-wall)' }),
    svg('rect', { y: 430, width: W, height: 90, fill: 'url(#lab-floor)' }),
    // Pipes along the wall, frosted.
    [70, 92].map((y) => svg('rect', { x: 0, y, width: W, height: 12, fill: 'url(#steel)' })),
    svg('path', { d: 'M0 70h900M0 92h900', stroke: 'rgba(255, 255, 255, .8)', 'stroke-width': 3, 'stroke-dasharray': '30 40 10 60' }),
    door,
    dewar(150, 230, 'LHe'), dewar(250, 180, 'LN₂'), dewar(650, 200, 'LHe'), dewar(760, 250, 'LN₂'),
    // A pressure gauge.
    svg('circle', { cx: 830, cy: 180, r: 26, fill: '#eef3f6', stroke: '#5c6b78', 'stroke-width': 4 }),
    svg('path', { d: 'M830 180l14-10', stroke: '#b23a26', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    svg('text', { x: 830, y: 226, class: 'cryo-label' }, '4.2 K'),
    svg('rect', { y: 400, width: W, height: 70, fill: 'url(#mist)', class: 'cryo-mist' }));

  const open = () => {
    tell(story, 'Cryogenics', 'The door opens', 'A blast of polar air. Snow blows in across the floor of the lab.');
    if (calm()) { window.location.hash = route('/map/arctic'); return; }
    door.querySelector('.cryo-door-leaf').animate([{ transform: 'perspective(600px) rotateY(0deg)' }, { transform: 'perspective(600px) rotateY(-75deg)' }],
      { duration: 1100, easing: 'ease-in', fill: 'forwards' });
    scene.classList.add('blizzard');
    setTimeout(() => { window.location.hash = route('/map/arctic'); }, 1300);
  };
  door.addEventListener('click', open);
  door.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Cryogenics', null]),
    pageHeader({
      eyebrow: 'The north end of the Jenkin Building',
      title: 'Cryogenics',
      intro: 'Four kelvin and falling. Bring a jumper, and do not lick anything. Tap the door at the back.',
      actions: h('a', { class: 'btn', href: route('/map/engsci') }, 'Back to the corridor'),
    }),
    h('div', { class: 'scene-sheet' }, scene),
    story);
}

// ---------- the Arctic ----------
/** A polar bear in profile, walking right. Drawn at the origin, roughly 300 by 170. */
function polarBear() {
  return svg('g', { class: 'bear' },
    svg('ellipse', { cx: 160, cy: 166, rx: 130, ry: 9, fill: 'rgba(80, 110, 140, .25)' }),
    // Far legs, a shade darker.
    svg('path', { d: 'M86 104c-4 18-4 38-2 54 0 5 12 6 14 1 2-16 4-34 8-50ZM214 108c2 18 4 36 4 50 0 5 12 6 13 0 1-16-1-34-4-50Z', fill: 'url(#fur-shade)' }),
    // Body, neck and head in one outline.
    svg('path', { d: 'M38 98c-6-30 20-56 68-60 40-4 84-2 118 6 20 4 30 14 40 22 10 2 20 2 30 8 10 6 16 14 16 22 0 6-6 10-14 10l-8 4c-8 2-16 0-22-6-8-2-16 0-24 6-10 8-30 12-52 12-30 2-60 0-86-4-30-4-62-4-66-20Z', fill: 'url(#fur)' }),
    // Near legs.
    svg('path', { d: 'M60 104c-6 18-8 36-6 52 0 6 16 7 18 1 2-16 6-30 12-46ZM176 112c0 16 2 32 2 46 0 6 16 6 17 0 2-14 2-30-2-48Z', fill: 'url(#fur)' }),
    // Shading along the belly and haunch.
    svg('path', { d: 'M70 118c40 10 100 12 150 2', stroke: 'rgba(120, 150, 180, .35)', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }),
    svg('path', { d: 'M52 80c4-18 22-30 46-32', stroke: 'rgba(120, 150, 180, .3)', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }),
    // Ear, eye and nose.
    svg('path', { d: 'M282 74c-2-6 2-10 7-8 3 2 3 6 0 9Z', fill: '#e6ebef', stroke: 'rgba(90, 110, 130, .5)' }),
    svg('circle', { cx: 300, cy: 84, r: 2.4, fill: '#111' }),
    svg('path', { d: 'M318 94c3 0 5 2 4 5-1 2-4 2-6 1Z', fill: '#111' }),
    svg('path', { d: 'M306 104c4 1 8 0 10-2', stroke: '#6b7480', 'stroke-width': 1.2, fill: 'none' }),
    // Claws.
    [[56, 158], [64, 159], [180, 160], [188, 160]].map(([x, y]) => svg('path', { d: `M${x} ${y}l2 4`, stroke: '#555', 'stroke-width': 1.5 })));
}

/** An emperor penguin, about 60 by 130, facing right. */
function penguin() {
  return svg('g', { class: 'penguin' },
    svg('ellipse', { cx: 32, cy: 128, rx: 22, ry: 4, fill: 'rgba(80, 110, 140, .25)' }),
    svg('path', { d: 'M30 8c16 0 22 16 20 34 8 26 8 60-4 82H18C6 104 6 70 14 42 12 24 16 8 30 8Z', fill: '#1d2128' }),
    svg('path', { d: 'M31 38c14 4 20 34 14 82H22c-8-28-6-62 9-82Z', fill: 'url(#belly)' }),
    svg('path', { d: 'M38 24c9 4 11 14 7 24-5-6-9-14-7-24Z', fill: 'url(#neck-gold)' }),
    svg('path', { d: 'M44 20l16 6-16 4Z', fill: '#1d2128' }),
    svg('path', { d: 'M46 28l12-2', stroke: '#f08a24', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 40, cy: 19, r: 1.6, fill: '#000' }),
    svg('path', { d: 'M16 52c-6 18-6 36 2 50 2-16 4-32 2-50Z', fill: '#121418' }),
    svg('path', { d: 'M20 124h10l-4 4h-8ZM34 124h10l-2 4h-8Z', fill: '#3a3a3a' }));
}

export function renderArctic() {
  discover('arctic');
  const story = storyPanel('The Arctic, through a door in Oxford. Tap the bears or the penguins.');
  const W = 1200;
  const H = 680;
  const place = (node, x, y, scale = 1, flip = false) => svg('g', { transform: `translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})` }, node);

  const bears = svg('g', { class: 'creature', role: 'button', tabindex: '0', 'aria-label': 'Polar bears' },
    place(polarBear(), 520, 420, 1.05), place(polarBear(), 400, 480, 0.6));
  const penguins = svg('g', { class: 'creature', role: 'button', tabindex: '0', 'aria-label': 'Penguins' },
    place(penguin(), 930, 430, 1.25), place(penguin(), 1010, 450, 1.05, true), place(penguin(), 860, 470, 0.95), place(penguin(), 1060, 500, 0.8, true));
  const tellBears = () => tell(story, 'On the sea ice', 'Polar bears',
    'Ursus maritimus, the largest land carnivore. Their fur is not really white: each hair is clear and hollow, and the skin underneath is black.',
    'A mother and her cub, out hunting along the edge of the ice. They can smell a seal from more than a kilometre away, and probably your biscuit too.');
  const tellPenguins = () => tell(story, 'Somewhat lost', 'Emperor penguins',
    'The tallest of all penguins, standing over a metre high. They breed through the Antarctic winter, with the fathers keeping the egg warm on their feet for two months.',
    'They live at the other end of the planet, so these four took a wrong turn in the Lift. Nobody has had the heart to tell them.');
  for (const [node, act] of [[bears, tellBears], [penguins, tellPenguins]]) {
    node.addEventListener('click', act);
    node.addEventListener('keydown', (event) => { if (event.key === 'Enter') act(); });
  }

  const scene = svg('svg', { class: 'scene-svg arctic', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'An Arctic landscape at dusk: aurora, icebergs, sea ice, polar bears and penguins, in falling snow' },
    svg('defs', null,
      gradient('polar-sky', [['0%', '#0d1b3a'], ['45%', '#2f5d8a'], ['75%', '#9fc4d8'], ['100%', '#e6eff3']]),
      gradient('aurora-a', [['0%', 'rgba(80, 255, 170, 0)'], ['50%', 'rgba(80, 255, 170, .55)'], ['100%', 'rgba(150, 90, 255, 0)']]),
      gradient('berg', [['0%', '#ffffff'], ['100%', '#b8d4e4']]),
      gradient('sea', [['0%', '#2c5470'], ['100%', '#173246']]),
      gradient('ice', [['0%', '#f7fbfd'], ['100%', '#cfe0ea']]),
      gradient('fur', [['0%', '#fffdf6'], ['70%', '#f1ede2'], ['100%', '#d3dbe3']]),
      gradient('fur-shade', [['0%', '#e7e4da'], ['100%', '#bfc9d3']]),
      gradient('belly', [['0%', '#fffaf0'], ['100%', '#e6e3d8']], { vertical: false }),
      gradient('neck-gold', [['0%', '#f6b93b'], ['100%', '#fff1c1']]),
      svg('filter', { id: 'soft-blur' }, svg('feGaussianBlur', { stdDeviation: 14 }))),
    svg('rect', { width: W, height: H, fill: 'url(#polar-sky)' }),
    svg('g', { class: 'aurora', filter: 'url(#soft-blur)' },
      svg('path', { d: 'M-50 120C200 40 380 200 600 110S1000 60 1260 150', stroke: 'url(#aurora-a)', 'stroke-width': 70, fill: 'none' }),
      svg('path', { d: 'M-50 200C260 120 500 260 760 170S1080 150 1260 220', stroke: 'url(#aurora-a)', 'stroke-width': 40, fill: 'none', opacity: 0.7 })),
    // Distant icebergs and mountains.
    svg('path', { d: 'M0 360l80-70 60 40 90-90 70 80 60-30 80 70H0Z', fill: 'url(#berg)', opacity: 0.85 }),
    svg('path', { d: 'M760 360l70-110 50 60 70-50 90 100H760Z', fill: 'url(#berg)', opacity: 0.9 }),
    svg('path', { d: 'M820 250l10 40M900 260l-12 40', stroke: 'rgba(150, 190, 215, .6)', 'stroke-width': 3 }),
    svg('rect', { y: 358, width: W, height: 60, fill: 'url(#sea)' }),
    svg('path', { d: 'M0 380h1200M0 398h1200', stroke: 'rgba(255, 255, 255, .12)', 'stroke-width': 2, 'stroke-dasharray': '40 60' }),
    // The sea ice the creatures stand on.
    svg('path', { d: 'M0 410c160-10 300 8 460-2s320-14 480 2 200 4 260 0V680H0Z', fill: 'url(#ice)' }),
    svg('path', { d: 'M60 470c60 6 140 2 200 8M700 520c90 4 200-2 300 6M300 600c120 6 240 2 360 8', stroke: 'rgba(150, 185, 210, .5)', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
    bears,
    penguins,
    // A small sign, planted in the snow.
    svg('g', null,
      svg('path', { d: 'M180 610v-70', stroke: '#6b4a2b', 'stroke-width': 5 }),
      svg('rect', { x: 120, y: 520, width: 120, height: 34, rx: 3, fill: '#8a6038', stroke: '#5b3d21', 'stroke-width': 2 }),
      svg('text', { x: 180, y: 542, class: 'arctic-sign' }, 'OXFORD 3,500 km')),
    svg('g', { class: 'snowfall' }, Array.from({ length: 90 }, (_, index) => svg('circle', {
      cx: (index * 137) % W, cy: (index * 89) % H, r: 1.2 + (index % 4) * 0.7, fill: '#fff', opacity: 0.85,
      style: { animationDuration: `${6 + (index % 7)}s`, animationDelay: `${-(index % 11)}s` },
    }))));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Cryogenics', '/map/cryogenics'], ['The Arctic', null]),
    pageHeader({
      eyebrow: 'Through the door at the back of Cryogenics',
      title: 'The Arctic',
      intro: 'Snow, sea ice, an aurora overhead, and some unexpected neighbours.',
      actions: h('a', { class: 'btn', href: route('/map/cryogenics') }, 'Back through the door'),
    }),
    h('div', { class: 'scene-sheet' }, scene),
    story);
}
