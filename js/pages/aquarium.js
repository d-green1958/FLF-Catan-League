// Floor 3 of the Thom Building: a fish tank, and a game. Tap fish to catch them before time runs out.
// Small, quick fish are worth more. The best score is kept in this browser.
import * as storage from '../data/browser-storage.js';
import { h, route, svg } from '../ui/dom.js';
import { page, pageHeader } from '../ui/components.js';
import { discover } from '../ui/delights.js';
import { trail } from './engsci.js';

const W = 1000;
const H = 560;
const ROUND_SECONDS = 30;
const BEST_KEY = 'flfoxtan.aquarium-best';
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Each kind of fish: its size, speed, points, and how to draw it facing right at the origin.
const KINDS = [
  {
    name: 'Clownfish', points: 2, speed: 1.3, size: 1, draw: () => [
      svg('path', { d: 'M-34 0c6-14 26-18 44-12 10 4 18 8 22 12-4 4-12 8-22 12-18 6-38 2-44-12Z', fill: '#f07a1a' }),
      svg('path', { d: 'M-34 0l-14-12 4 12-4 12Z', fill: '#f07a1a', stroke: '#1d1d1d', 'stroke-width': 1.5 }),
      svg('path', { d: 'M-14-15c4 10 4 20 0 30M8-13c4 8 4 18 0 26', stroke: '#fff', 'stroke-width': 6, fill: 'none' }),
      svg('path', { d: 'M-14-15c4 10 4 20 0 30M8-13c4 8 4 18 0 26', stroke: '#1d1d1d', 'stroke-width': 1, fill: 'none', opacity: 0.6 }),
      svg('circle', { cx: 22, cy: -3, r: 2.6, fill: '#111' })],
  },
  {
    name: 'Blue tang', points: 3, speed: 1.6, size: 1.1, draw: () => [
      svg('path', { d: 'M-30 0c4-18 30-24 50-14 8 4 14 9 16 14-2 5-8 10-16 14-20 10-46 4-50-14Z', fill: '#2156c9' }),
      svg('path', { d: 'M-30 0l-16-14 2 14-2 14Z', fill: '#f2c21b' }),
      svg('path', { d: 'M-20-6c14-10 30-8 38 2-10-4-24-2-30 8-4-4-6-8-8-10Z', fill: '#0c1a3a' }),
      svg('circle', { cx: 24, cy: -4, r: 2.6, fill: '#111' })],
  },
  {
    name: 'Goldfish', points: 1, speed: 0.9, size: 1.15, draw: () => [
      svg('path', { d: 'M-24 0c4-14 22-18 38-12 8 3 14 8 16 12-2 4-8 9-16 12-16 6-34 2-38-12Z', fill: 'url(#gold-scale)' }),
      svg('path', { d: 'M-24 0c-10-14-24-18-30-14 6 6 8 10 6 14 2 4 0 8-6 14 6 4 20 0 30-14Z', fill: '#f5a637', opacity: 0.85 }),
      svg('path', { d: 'M-4-12c4-8 12-10 16-6Z', fill: '#f5a637' }),
      svg('circle', { cx: 20, cy: -3, r: 2.6, fill: '#111' })],
  },
  {
    name: 'Neon tetra', points: 5, speed: 2.6, size: 0.6, draw: () => [
      svg('path', { d: 'M-24 0c4-8 20-10 34-6 6 2 10 4 12 6-2 2-6 4-12 6-14 4-30 2-34-6Z', fill: '#c8cfd6' }),
      svg('path', { d: 'M-20-2h34', stroke: '#26c6ff', 'stroke-width': 3 }),
      svg('path', { d: 'M-22 3h20', stroke: '#e0322b', 'stroke-width': 3 }),
      svg('path', { d: 'M-24 0l-8-6 2 6-2 6Z', fill: '#c8cfd6' }),
      svg('circle', { cx: 15, cy: -1, r: 1.8, fill: '#111' })],
  },
  {
    name: 'Angelfish', points: 2, speed: 1, size: 1.2, draw: () => [
      svg('path', { d: 'M-16 0c0-10 10-18 24-16l-6-26 22 30c4 4 6 8 6 12s-2 8-6 12l-22 30 6-26c-14 2-24-6-24-16Z', fill: '#e6e8e2' }),
      svg('path', { d: 'M-4-14v28M8-20v40', stroke: '#2a2a2a', 'stroke-width': 3, opacity: 0.8 }),
      svg('path', { d: 'M-16 0l-12-8 2 8-2 8Z', fill: '#e6e8e2' }),
      svg('circle', { cx: 22, cy: -2, r: 2.4, fill: '#111' })],
  },
];

function tankScenery() {
  return [
    svg('defs', null,
      svg('linearGradient', { id: 'water', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#5fb3c9' }), svg('stop', { offset: '100%', 'stop-color': '#0f4a63' })),
      svg('linearGradient', { id: 'sand', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#e6cf9c' }), svg('stop', { offset: '100%', 'stop-color': '#b99a62' })),
      svg('linearGradient', { id: 'gold-scale', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#ffc04d' }), svg('stop', { offset: '100%', 'stop-color': '#e2761b' })),
      svg('linearGradient', { id: 'glass-shine', x1: 0, y1: 0, x2: 1, y2: 0 }, svg('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0 }), svg('stop', { offset: '50%', 'stop-color': '#fff', 'stop-opacity': 0.14 }), svg('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 }))),
    svg('rect', { width: W, height: H, fill: 'url(#water)' }),
    // Light rippling down from the surface.
    svg('g', { class: 'caustics', opacity: 0.18 }, [120, 300, 480, 660, 840].map((x) => svg('path', { d: `M${x} 0l60 ${H}h-30l-50-${H}Z`, fill: '#fff' }))),
    // Sand, rocks and swaying weed.
    svg('path', { d: `M0 ${H - 70}c140-20 260 10 400-4s300-24 600 2V${H}H0Z`, fill: 'url(#sand)' }),
    svg('path', { d: `M160 ${H - 60}c10-30 50-36 70-10 6 8 4 12 0 16Z M760 ${H - 56}c16-26 60-24 74 2Z`, fill: '#6f6a62' }),
    [80, 210, 520, 700, 900].map((x, index) => svg('path', {
      d: `M${x} ${H - 60}c-14-60 18-110-6-170 24 50-6 110 14 170Z`, fill: index % 2 ? '#2f7d4a' : '#3d9a5a', class: 'weed', style: { animationDelay: `${index * -0.7}s` },
    })),
    // A treasure chest, half buried.
    svg('g', null,
      svg('rect', { x: 600, y: H - 82, width: 70, height: 36, rx: 4, fill: '#7a4a22', stroke: '#3b2410', 'stroke-width': 2 }),
      svg('path', { d: `M600 ${H - 82}c0-20 70-20 70 0Z`, fill: '#8a5a2a', stroke: '#3b2410', 'stroke-width': 2 }),
      svg('rect', { x: 628, y: H - 76, width: 14, height: 12, fill: '#d3ae58' })),
    svg('g', { class: 'bubbles' }, Array.from({ length: 18 }, (_, index) => svg('circle', {
      cx: 180 + ((index * 53) % 640), cy: H - 70, r: 2 + (index % 4), fill: 'none', stroke: 'rgba(255, 255, 255, .7)', 'stroke-width': 1.5,
      style: { animationDuration: `${4 + (index % 5)}s`, animationDelay: `${-(index % 7)}s` },
    }))),
  ];
}

export function renderAquarium() {
  discover('aquarium');
  const fishLayer = svg('g');
  const splashes = svg('g');
  const tank = svg('svg', { class: 'tank-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A fish tank with clownfish, blue tangs, goldfish, neon tetras and angelfish swimming among weed and rocks' },
    tankScenery(), fishLayer, splashes, svg('rect', { width: W, height: H, fill: 'url(#glass-shine)', 'pointer-events': 'none' }));

  const scoreText = h('b', null, '0');
  const timeText = h('b', null, String(ROUND_SECONDS));
  const best = () => storage.read(BEST_KEY, 0);
  const bestText = h('b', null, String(best()));
  const startButton = h('button', { class: 'btn gold', type: 'button' }, 'Start: 30 seconds');
  const message = h('p', { class: 'tank-message' }, 'Tap Start, then tap fish to catch them. Neon tetras are small and quick, and worth the most.');

  let fish = [];
  let playing = false;
  let score = 0;
  let endsAt = 0;

  function spawn() {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const goingRight = Math.random() < 0.5;
    const body = svg('g', { class: 'fish' }, kind.draw());
    const holder = svg('g', { role: 'button', 'aria-label': kind.name }, body);
    const one = {
      kind, holder, body,
      x: goingRight ? -60 : W + 60,
      y: 80 + Math.random() * (H - 200),
      vx: (goingRight ? 1 : -1) * kind.speed * (1.4 + Math.random()),
      phase: Math.random() * Math.PI * 2,
      wobble: 6 + Math.random() * 12,
    };
    const catchIt = (event) => {
      event.stopPropagation();
      if (!playing) { message.textContent = `That is a ${kind.name.toLowerCase()}. Tap Start to begin catching.`; return; }
      score += kind.points;
      scoreText.textContent = String(score);
      const splash = svg('circle', { cx: one.x, cy: one.y, r: 8, class: 'splash' });
      splashes.append(splash);
      setTimeout(() => splash.remove(), 600);
      one.caught = true;
      holder.remove();
      fish = fish.filter((other) => other !== one);
      spawn();
    };
    holder.addEventListener('pointerdown', catchIt);
    fishLayer.append(holder);
    fish.push(one);
    draw(one);
  }

  function draw(one) {
    const facing = one.vx > 0 ? 1 : -1;
    const y = one.y + Math.sin(one.phase) * one.wobble;
    one.holder.setAttribute('transform', `translate(${one.x} ${y}) scale(${facing * one.kind.size} ${one.kind.size})`);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(48, now - last) / 16;
    last = now;
    for (const one of [...fish]) {
      if (!calm()) {
        one.x += one.vx * dt;
        one.phase += 0.04 * dt;
      }
      // Turn round at the glass, now and then dart.
      if (one.x > W + 80 || one.x < -80) {
        one.vx = -one.vx;
        one.y = 80 + Math.random() * (H - 200);
      }
      if (Math.random() < 0.002) one.vx *= -1;
      draw(one);
    }
    if (playing) {
      const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
      timeText.textContent = String(left);
      if (left === 0) finish();
    }
    if (tank.isConnected || now - started < 1500) requestAnimationFrame(frame);
  }
  const started = performance.now();

  function finish() {
    playing = false;
    startButton.disabled = false;
    startButton.textContent = 'Play again';
    const previous = best();
    if (score > previous) {
      storage.write(BEST_KEY, score);
      bestText.textContent = String(score);
      message.textContent = `Time! ${score} points, a new best on this device.`;
    } else {
      message.textContent = `Time! ${score} points. Your best here is ${previous}.`;
    }
  }

  startButton.addEventListener('click', () => {
    score = 0;
    scoreText.textContent = '0';
    playing = true;
    endsAt = performance.now() + ROUND_SECONDS * 1000;
    startButton.disabled = true;
    message.textContent = 'Go! Tap the fish.';
  });

  for (let i = 0; i < 9; i += 1) spawn();
  // Spread the first fish across the tank rather than lining them up at the edges.
  fish.forEach((one) => { one.x = 60 + Math.random() * (W - 120); draw(one); });
  requestAnimationFrame(frame);

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Thom Building', '/map/thom'], ['Floor 3', null]),
    pageHeader({
      eyebrow: 'Thom Building · Floor 3',
      title: 'The Aquarium',
      intro: 'A large tank, humming quietly in the corner of the third floor. Nobody is quite sure who feeds them.',
      actions: h('a', { class: 'btn', href: route('/map/thom') }, 'Back to the stairs'),
    }),
    h('div', { class: 'tank-bar' },
      startButton,
      h('span', null, 'Score ', scoreText),
      h('span', null, 'Time ', timeText),
      h('span', null, 'Best ', bestText)),
    h('div', { class: 'tank-frame' }, tank),
    message,
    h('ul', { class: 'tank-key' }, KINDS.map((kind) => h('li', null, `${kind.name}: ${kind.points} ${kind.points === 1 ? 'point' : 'points'}`))));
}
