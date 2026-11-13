// Small surprises for the curious. None of them change any data, and all of them respect "reduce motion".
//
//   Tap the crest              roll two dice. A 7 sends the robber across the screen.
//   Log a game                 hexagon confetti in the five resource colours.
//   Konami code, or "seafarers" in the games search     Seafarers mode: waves behind the page.
//   "wood for sheep" in the games search                the eternal question, answered.
//   Tap a profile picture five times                    a sheep wanders past.
//   A lunchtime proverb at the foot of the menu, different on every visit.
import { h, svg } from './dom.js';
import { toast } from './feedback.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RESOURCE_COLOURS = ['#3d6b35', '#9cc45a', '#e3b23c', '#c4613a', '#8c9199'];

export const PROVERBS = [
  'Never trade with the leader.',
  'The robber always knows.',
  'Ore today, gone tomorrow.',
  'Sheep happens.',
  'Eight is great, until it is not.',
  'A road to nowhere is still a road.',
  'Seven: the number that tests friendships.',
  'Brick is the new gold.',
  'Nobody has wood for sheep.',
  'Lunch ends; grudges do not.',
  'Build first, apologise later.',
  'The desert is quiet. Too quiet.',
];
export const proverb = () => PROVERBS[Math.floor(Math.random() * PROVERBS.length)];

function layer(className) {
  const element = h('div', { class: `delight ${className}`, 'aria-hidden': 'true' });
  document.body.append(element);
  return element;
}

// ---------- dice and the robber ----------
const PIP_SPOTS = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};
const die = (value, red) => svg('svg', { viewBox: '0 0 100 100', class: 'die' },
  svg('rect', { x: 4, y: 4, width: 92, height: 92, rx: 18, fill: red ? '#c8342b' : '#f6ecd2', stroke: '#3b2a12', 'stroke-width': 4 }),
  PIP_SPOTS[value].map(([x, y]) => svg('circle', { cx: x, cy: y, r: 9, fill: red ? '#f6ecd2' : '#2a2418' })));

function robberWalk() {
  const robber = layer('robber');
  robber.append(svg('svg', { viewBox: '0 0 60 100', width: 54, height: 90 },
    svg('ellipse', { cx: 30, cy: 94, rx: 22, ry: 5, fill: 'rgba(0,0,0,.25)' }),
    svg('path', { d: 'M30 6a13 13 0 0 1 9 22c7 4 11 13 11 24 0 9-3 17-6 24h6v12H10V76h6c-3-7-6-15-6-24 0-11 4-20 11-24a13 13 0 0 1 9-22Z', fill: '#2a2a2e' }),
    svg('circle', { cx: 25, cy: 18, r: 2.2, fill: '#ffd76a' }),
    svg('circle', { cx: 34, cy: 18, r: 2.2, fill: '#ffd76a' })));
  const width = window.innerWidth + 120;
  robber.animate([
    { transform: 'translateX(-90px) rotate(-4deg)' }, { transform: `translateX(${width * 0.25}px) rotate(4deg)` },
    { transform: `translateX(${width * 0.5}px) rotate(-4deg)` }, { transform: `translateX(${width * 0.75}px) rotate(4deg)` },
    { transform: `translateX(${width}px) rotate(-4deg)` },
  ], { duration: 3200, easing: 'linear' }).finished.then(() => robber.remove());
}

let rolling = false;
export function rollDice() {
  if (rolling) return;
  rolling = true;
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  const total = a + b;
  const finish = () => {
    rolling = false;
    if (total === 7) {
      toast('Seven! The robber is on the move.', 'warn');
      if (!calm()) robberWalk();
    } else {
      toast(total === 2 || total === 12 ? `${total}. Bold of you to build there.` : `You rolled ${total}.`);
    }
  };
  if (calm()) { finish(); return; }
  const tray = layer('dice-tray');
  tray.append(die(a, false), die(b, true));
  [...tray.children].forEach((element, index) => element.animate([
    { transform: `translate(${index ? 160 : -160}px, -220px) rotate(${index ? 400 : -380}deg) scale(.6)`, opacity: 0 },
    { transform: `translate(${index ? -14 : 14}px, 18px) rotate(${index ? -30 : 25}deg) scale(1.05)`, opacity: 1, offset: 0.65 },
    { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
  ], { duration: 750, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
  setTimeout(() => {
    tray.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 700, fill: 'forwards' }).finished.then(() => tray.remove());
    finish();
  }, 800);
}

// ---------- confetti ----------
export function confetti() {
  if (calm()) return;
  const sky = layer('confetti');
  const width = window.innerWidth;
  for (let i = 0; i < 70; i += 1) {
    const size = 8 + Math.random() * 9;
    const bit = h('span', { class: 'confetti-bit', style: { width: `${size}px`, height: `${size * 1.15}px`, background: RESOURCE_COLOURS[i % 5], left: `${Math.random() * width}px` } });
    sky.append(bit);
    const drift = (Math.random() - 0.5) * 220;
    bit.animate([
      { transform: 'translate(0, -30px) rotate(0deg)', opacity: 1 },
      { transform: `translate(${drift}px, ${window.innerHeight + 40}px) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: 0.9 },
    ], { duration: 1500 + Math.random() * 1300, delay: Math.random() * 350, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'forwards' });
  }
  setTimeout(() => sky.remove(), 3400);
}

// ---------- a sheep ----------
export function sheep() {
  toast('Baa.');
  if (calm()) return;
  const flock = layer('sheep');
  flock.append(svg('svg', { viewBox: '0 0 120 90', width: 96, height: 72 },
    svg('ellipse', { cx: 60, cy: 86, rx: 34, ry: 4, fill: 'rgba(0,0,0,.2)' }),
    [[40, 40], [58, 32], [76, 40], [48, 52], [70, 52], [60, 44]].map(([cx, cy]) => svg('circle', { cx, cy, r: 17, fill: '#fbf8ef', stroke: '#d9d2bf', 'stroke-width': 2 })),
    svg('ellipse', { cx: 96, cy: 42, rx: 12, ry: 10, fill: '#2a2418' }),
    svg('circle', { cx: 99, cy: 39, r: 2, fill: '#fff' }),
    [42, 52, 68, 78].map((x) => svg('rect', { x, y: 62, width: 5, height: 20, rx: 2, fill: '#2a2418' }))));
  const width = window.innerWidth + 120;
  flock.animate(Array.from({ length: 11 }, (_, step) => ({
    transform: `translate(${-100 + (width * step) / 10}px, ${step % 2 ? -14 : 0}px)`,
  })), { duration: 3600, easing: 'linear' }).finished.then(() => flock.remove());
}

// ---------- Seafarers mode ----------
export function toggleSeafarers() {
  const on = document.documentElement.classList.toggle('seafarers');
  toast(on ? 'Seafarers mode. Mind the pirates.' : 'Back on dry land.');
}

/** Messages hidden in the games search box. */
export function searchSecrets(text) {
  const query = text.trim().toLowerCase();
  if (query === 'seafarers') toggleSeafarers();
  if (/wood\s*(for|4)\s*sheep/.test(query)) toast('Nobody has wood for sheep. Nobody has ever had wood for sheep.');
}

/** Counts quick taps, and calls back after the given number. */
export function onTaps(element, count, callback) {
  let taps = 0;
  let timer = null;
  element.addEventListener('click', () => {
    taps += 1;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 900);
    if (taps >= count) { taps = 0; callback(); }
  });
  return element;
}

/** Sets up the site-wide ones: the crest, the Konami code and a note for anyone reading the console. */
export function installDelights() {
  document.querySelector('.brand .mark')?.addEventListener('click', (event) => {
    event.preventDefault();
    rollDice();
  });
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let position = 0;
  window.addEventListener('keydown', (event) => {
    position = event.key === code[position] ? position + 1 : (event.key === code[0] ? 1 : 0);
    if (position === code.length) { position = 0; toggleSeafarers(); }
  });
  console.log('%c⬢ FLFOxtan', 'font: 700 20px Georgia, serif; color: #d3ae58; background: #0f1f36; padding: 6px 12px; border-radius: 6px;');
  console.log('Looking under the hood? Everything is plain HTML, CSS and JavaScript in the repo. Try tapping the crest, or the Konami code.');
}
