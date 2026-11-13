// The Wroth Library's reading room, drawn as one detailed scene you can zoom into and pan around:
// a tall bookcase of leather and cloth bindings above a long oak table with green banker's lamps, chairs,
// a rug, a window onto the Radcliffe Camera and a cat asleep on a chair. Tap a book to open it.
// One of them has sand in it.
import { h, route, svg } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { page, pageHeader } from '../ui/components.js';
import { discover } from '../ui/delights.js';
import { trail } from './engsci.js';
import { BOOKS } from './library-books.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Leather bindings, and a few cloth ones for the modern books.
const LEATHER = ['#5e1a14', '#1d3a28', '#1a2846', '#7a4e14', '#43284a', '#2a2622', '#6e3418', '#2a4848', '#521a28', '#3a4419', '#22304a', '#5f4024'];
const CLOTH = ['#9b8c6c', '#3f5b6e', '#7d3b2f', '#5a6b4a', '#c2a46a', '#2f3b4c'];

/** A repeatable number from a string, so every book keeps its own size and colour. */
function hash(text, salt = '') {
  let value = 2166136261;
  for (const char of text + salt) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

// ---------- the scene ----------
const SCENE_W = 1400;
const CASE_X = 60;
const CASE_W = 1280;
const SHELF_TOP = 70;
const SHELF_GAP = 250;
const SHELVES = 5;

const spineWidth = (title) => Math.round(Math.max(36, Math.min(66, 26 + title.length * 1.05)));

function defs() {
  const stop = (offset, colour, opacity = 1) => svg('stop', { offset, 'stop-color': colour, 'stop-opacity': opacity });
  return svg('defs', null,
    // Wood grain: stretched noise, tinted brown.
    svg('filter', { id: 'wood-grain', x: 0, y: 0, width: '100%', height: '100%' },
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.004 0.18', numOctaves: 3, seed: 4 }),
      svg('feColorMatrix', { values: '0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0 0.11  0 0 0 0.55 0' })),
    // Fine leather grain, laid over the books.
    svg('filter', { id: 'leather-grain', x: 0, y: 0, width: '100%', height: '100%' },
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: 1.4, numOctaves: 2, seed: 9 }),
      svg('feColorMatrix', { values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.6' })),
    svg('linearGradient', { id: 'spine-shade', x1: 0, y1: 0, x2: 1, y2: 0 },
      stop('0%', '#000', 0.55), stop('18%', '#fff', 0.16), stop('42%', '#fff', 0.05), stop('80%', '#000', 0.2), stop('100%', '#000', 0.6)),
    svg('linearGradient', { id: 'gilt', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#fff1bf'), stop('45%', '#d9ad4f'), stop('100%', '#8f6a22')),
    svg('linearGradient', { id: 'band', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#fff', 0.3), stop('50%', '#000', 0), stop('100%', '#000', 0.45)),
    svg('linearGradient', { id: 'shelf-face', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#8a5a32'), stop('100%', '#4e2f17')),
    svg('linearGradient', { id: 'shelf-shadow', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#000', 0.7), stop('100%', '#000', 0)),
    svg('linearGradient', { id: 'case-back', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#1c120a'), stop('100%', '#2c1a0e')),
    svg('linearGradient', { id: 'brass', x1: 0, y1: 0, x2: 1, y2: 0 }, stop('0%', '#7a5a1e'), stop('40%', '#f0d58a'), stop('70%', '#b8913c'), stop('100%', '#6a4c16')),
    svg('linearGradient', { id: 'oak-top', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#a9733f'), stop('100%', '#6e4320')),
    svg('linearGradient', { id: 'green-glass', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#3f8f5f'), stop('60%', '#1d5a38'), stop('100%', '#0f3a22')),
    svg('linearGradient', { id: 'window-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#7fa8c8'), stop('100%', '#f1d6a8')),
    svg('radialGradient', { id: 'lamp-light', cx: '50%', cy: '0%', r: '80%' }, stop('0%', '#ffd98a', 0.75), stop('100%', '#ffd98a', 0)),
    svg('radialGradient', { id: 'room-light', cx: '50%', cy: '0%', r: '90%' }, stop('0%', '#ffcf80', 0.16), stop('70%', '#000', 0), stop('100%', '#000', 0.55)),
    svg('linearGradient', { id: 'fur', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#e2953f'), stop('100%', '#b0641f')));
}

/** One book: binding, shading, raised bands, a dark title label with gilt lettering, and the author. */
function book([title, author], x, baseline, onOpen) {
  const seed = hash(title);
  const modern = hash(author, 'cloth') < 0.32;
  const height = 158 + Math.round(seed * 58);
  const width = spineWidth(title);
  const colour = modern ? CLOTH[Math.floor(hash(author) * CLOTH.length)] : LEATHER[Math.floor(hash(author) * LEATHER.length)];
  const y = baseline - height;
  const labelTop = y + 34;
  const labelHeight = height - 74;
  // Fit the title down the label: smaller type for long titles.
  const size = Math.max(9, Math.min(width * 0.36, (labelHeight - 10) / (title.length * 0.5), 17));
  const cx = x + width / 2;
  const group = svg('g', { class: 'shelf-book', role: 'button', tabindex: '0', 'aria-label': `${title} by ${author}` },
    svg('rect', { x, y, width, height, rx: modern ? 1.5 : 3, fill: colour }),
    svg('rect', { x, y, width, height, rx: modern ? 1.5 : 3, fill: 'url(#spine-shade)' }),
    // Raised bands across the spine, on the leather books.
    !modern && [y + 16, y + 26, baseline - 26, baseline - 16].map((bandY) => svg('rect', { x: x + 1, y: bandY, width: width - 2, height: 5, fill: 'url(#band)' })),
    !modern && [y + 16, baseline - 16].map((lineY) => svg('path', { d: `M${x + 4} ${lineY + 7}h${width - 8}`, stroke: 'url(#gilt)', 'stroke-width': 0.8 })),
    // The title label.
    svg('rect', { x: x + 5, y: labelTop, width: width - 10, height: labelHeight, rx: 1, fill: modern ? 'rgba(0, 0, 0, .12)' : 'rgba(10, 6, 2, .42)' }),
    !modern && svg('rect', { x: x + 6.5, y: labelTop + 1.5, width: width - 13, height: labelHeight - 3, fill: 'none', stroke: 'url(#gilt)', 'stroke-width': 0.7 }),
    svg('text', {
      x: cx, y: labelTop + labelHeight / 2, class: `spine-title ${modern ? 'modern' : ''}`.trim(),
      'font-size': size.toFixed(1), transform: `rotate(-90 ${cx} ${labelTop + labelHeight / 2})`,
    }, title),
    svg('text', { x: cx, y: baseline - 4, class: 'spine-author', 'font-size': Math.min(8, width * 0.17).toFixed(1) }, author.split(/[ ,&]+/).filter(Boolean).at(-1)));
  group.addEventListener('click', () => onOpen());
  group.addEventListener('keydown', (event) => { if (event.key === 'Enter') onOpen(); });
  return group;
}

function bookcase(onOpen) {
  // Fill the shelves in order, moving down a shelf when one is full.
  const ends = [];
  const placed = [];
  let row = 0;
  let cursor = CASE_X + 44;
  for (const entry of BOOKS) {
    const width = spineWidth(entry[0]);
    if (cursor + width > CASE_X + CASE_W - 70 && row < SHELVES - 1) { ends[row] = cursor; row += 1; cursor = CASE_X + 44; }
    const baseline = SHELF_TOP + (row + 1) * SHELF_GAP - 18;
    placed.push(book(entry, cursor, baseline, () => onOpen(entry)));
    cursor += width + 1 + (hash(entry[0], 'gap') < 0.12 ? 3 : 0);
  }
  ends[row] = cursor;
  const bookend = (x, baseline) => svg('g', null,
    svg('path', { d: `M${x} ${baseline}v-92l18-10v102Z`, fill: 'url(#brass)' }),
    svg('path', { d: `M${x - 6} ${baseline}h30`, stroke: '#5a4012', 'stroke-width': 3 }));

  return svg('g', null,
    // The case itself: back panel, sides, top and the shelves.
    svg('rect', { x: CASE_X, y: SHELF_TOP - 40, width: CASE_W, height: SHELVES * SHELF_GAP + 60, fill: 'url(#case-back)' }),
    svg('rect', { x: CASE_X, y: SHELF_TOP - 40, width: CASE_W, height: SHELVES * SHELF_GAP + 60, filter: 'url(#wood-grain)', opacity: 0.6 }),
    placed,
    ends.map((end, index) => bookend(end + 4, SHELF_TOP + (index + 1) * SHELF_GAP - 18)),
    Array.from({ length: SHELVES }, (_, index) => {
      const shelfY = SHELF_TOP + (index + 1) * SHELF_GAP - 18;
      return svg('g', { 'pointer-events': 'none' },
        svg('rect', { x: CASE_X, y: shelfY, width: CASE_W, height: 26, fill: 'url(#shelf-face)' }),
        svg('rect', { x: CASE_X, y: shelfY, width: CASE_W, height: 26, filter: 'url(#wood-grain)', opacity: 0.8 }),
        svg('path', { d: `M${CASE_X} ${shelfY}h${CASE_W}`, stroke: '#c48d55', 'stroke-width': 2, opacity: 0.6 }),
        // Each shelf throws a soft shadow onto the back of the case just below it.
        svg('rect', { x: CASE_X, y: shelfY + 26, width: CASE_W, height: 36, fill: 'url(#shelf-shadow)', opacity: 0.6 }));
    }),
    // A crown moulding, the uprights and a brass plate.
    svg('rect', { x: CASE_X - 20, y: SHELF_TOP - 64, width: CASE_W + 40, height: 30, fill: 'url(#shelf-face)' }),
    svg('rect', { x: CASE_X - 20, y: SHELF_TOP - 64, width: CASE_W + 40, height: 30, filter: 'url(#wood-grain)' }),
    [CASE_X - 20, CASE_X + CASE_W - 6].map((x) => svg('g', null,
      svg('rect', { x, y: SHELF_TOP - 40, width: 26, height: SHELVES * SHELF_GAP + 50, fill: 'url(#shelf-face)' }),
      svg('rect', { x, y: SHELF_TOP - 40, width: 26, height: SHELVES * SHELF_GAP + 50, filter: 'url(#wood-grain)' }))),
    svg('rect', { x: SCENE_W / 2 - 90, y: SHELF_TOP - 58, width: 180, height: 20, rx: 2, fill: 'url(#brass)' }),
    svg('text', { x: SCENE_W / 2, y: SHELF_TOP - 44, class: 'case-plate' }, 'WROTH LIBRARY'));
}

function readingArea(top) {
  const lamp = (x) => svg('g', null,
    svg('ellipse', { cx: x, cy: top + 176, rx: 120, ry: 26, fill: 'url(#lamp-light)', class: 'lamp-pool' }),
    svg('path', { d: `M${x - 26} ${top + 176}h52l-8-10h-36Z`, fill: 'url(#brass)' }),
    svg('rect', { x: x - 3, y: top + 120, width: 6, height: 48, fill: 'url(#brass)' }),
    svg('path', { d: `M${x - 52} ${top + 122}c4-26 100-26 104 0Z`, fill: 'url(#green-glass)' }),
    svg('path', { d: `M${x - 50} ${top + 122}h100`, stroke: '#ffe7a6', 'stroke-width': 4, class: 'lamp-glow' }),
    svg('path', { d: `M${x - 30} ${top + 104}c10-6 40-6 54 0`, stroke: 'rgba(255, 255, 255, .35)', 'stroke-width': 3, fill: 'none' }));
  const chair = (x, flip = false) => svg('g', { transform: `translate(${x} ${top}) scale(${flip ? -1 : 1} 1)` },
    svg('path', { d: 'M-38 300v-150c0-12 76-12 76 0v150', fill: 'none', stroke: '#4a2c14', 'stroke-width': 10, 'stroke-linecap': 'round' }),
    [-22, -8, 8, 22].map((dx) => svg('path', { d: `M${dx} 156v84`, stroke: '#5a3618', 'stroke-width': 6, 'stroke-linecap': 'round' })),
    svg('rect', { x: -46, y: 236, width: 92, height: 16, rx: 5, fill: 'url(#oak-top)' }),
    svg('path', { d: 'M-38 252v74M38 252v74', stroke: '#3e2410', 'stroke-width': 8, 'stroke-linecap': 'round' }));
  return svg('g', null,
    // Panelled wall and floorboards.
    svg('rect', { x: 0, y: top, width: SCENE_W, height: 420, fill: '#3a2514' }),
    svg('rect', { x: 0, y: top, width: SCENE_W, height: 420, filter: 'url(#wood-grain)', opacity: 0.5 }),
    [0, 1, 2, 3, 4].map((index) => svg('rect', { x: 40 + index * 220, y: top + 26, width: 180, height: 120, rx: 3, fill: 'none', stroke: 'rgba(255, 215, 150, .12)', 'stroke-width': 3 })),
    svg('rect', { x: 0, y: top + 300, width: SCENE_W, height: 120, fill: '#2a190c' }),
    Array.from({ length: 12 }, (_, index) => svg('path', { d: `M0 ${top + 310 + index * 10}h${SCENE_W}`, stroke: 'rgba(0, 0, 0, .25)' })),
    // The window, onto the Radcliffe Camera.
    svg('g', null,
      svg('rect', { x: 1150, y: top + 20, width: 190, height: 230, rx: 95, fill: 'url(#window-sky)' }),
      svg('path', { d: `M1180 ${top + 250}v-64h130v64ZM1200 ${top + 186}a45 45 0 0 1 90 0Z`, fill: 'rgba(110, 90, 70, .55)' }),
      svg('path', { d: `M1245 ${top + 140}v-16`, stroke: 'rgba(110, 90, 70, .55)', 'stroke-width': 5 }),
      svg('rect', { x: 1150, y: top + 20, width: 190, height: 230, rx: 95, fill: 'none', stroke: '#5a3618', 'stroke-width': 12 }),
      svg('path', { d: `M1245 ${top + 20}v230M1150 ${top + 130}h190`, stroke: '#5a3618', 'stroke-width': 7 })),
    // The rug.
    svg('path', { d: `M140 ${top + 410}l90-80h940l90 80Z`, fill: '#6e2420' }),
    svg('path', { d: `M190 ${top + 402}l66-60h888l66 60Z`, fill: 'none', stroke: '#c8964e', 'stroke-width': 4 }),
    [420, 700, 980].map((x) => svg('path', { d: `M${x - 40} ${top + 372}l40-18 40 18-40 18Z`, fill: '#c8964e', opacity: 0.85 })),
    chair(330), chair(560), chair(840, true), chair(1070, true),
    // The cat, asleep on a chair.
    svg('g', { class: 'library-cat' },
      svg('path', { d: `M796 ${top + 238}c0-22 22-36 48-36 22 0 38 12 42 26 6 14 2 20-6 22h-80c-3 0-4-6-4-12Z`, fill: 'url(#fur)' }),
      svg('path', { d: `M874 ${top + 212}l9-14 3 17ZM858 ${top + 207}l4-15 8 14Z`, fill: '#c97a2c' }),
      svg('path', { d: `M816 ${top + 226}c12 8 30 8 44 0M832 ${top + 214}c6 4 14 4 20 0`, stroke: '#8a4a14', 'stroke-width': 2.4, fill: 'none' }),
      svg('path', { d: `M796 ${top + 246}c-18 0-26 8-20 18`, stroke: '#c97a2c', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' })),
    // The long oak table with lamps and open books.
    svg('rect', { x: 200, y: top + 176, width: 1000, height: 30, rx: 4, fill: 'url(#oak-top)' }),
    svg('rect', { x: 200, y: top + 176, width: 1000, height: 30, rx: 4, filter: 'url(#wood-grain)', opacity: 0.7 }),
    svg('path', { d: `M250 ${top + 206}v100M1150 ${top + 206}v100M266 ${top + 206}v94M1134 ${top + 206}v94`, stroke: '#3e2410', 'stroke-width': 14 }),
    svg('path', { d: `M470 ${top + 174}l52-10 52 10ZM860 ${top + 174}l48-9 48 9Z`, fill: '#f2e6c8', stroke: '#b39d74' }),
    lamp(360), lamp(700), lamp(1040));
}

// ---------- the open book ----------
function openBook([title, author, year, blurb]) {
  const isDune = title === 'Dune';
  const dialog = h('dialog', { class: 'open-book', 'aria-label': title, onClose: () => dialog.remove(), onClick: (event) => { if (event.target === dialog) dialog.close(); } },
    h('div', { class: 'book-spread' },
      h('div', { class: 'book-page left' },
        h('p', { class: 'book-ornament', 'aria-hidden': 'true' }, '❦'),
        h('h2', null, title),
        h('p', { class: 'book-author' }, author),
        h('p', { class: 'book-year' }, year),
        h('p', { class: 'book-stamp' }, 'Wroth Library')),
      h('div', { class: 'book-page right' },
        h('p', null, blurb),
        isDune && h('p', { class: 'book-sand' }, 'A fine trickle of sand runs out from between the pages.'),
        h('div', { class: 'book-actions' },
          isDune && h('a', { class: 'btn sm gold', href: route('/map/arrakis'), onClick: () => dialog.close() }, 'Follow the sand'),
          h('button', { class: 'btn sm', type: 'button', onClick: () => dialog.close() }, 'Close the book')),
        // Pencilled faintly in the margin, for anyone who looks closely.
        isDune && h('span', { class: 'marginalia' }, 'lisanalgaib2026'))));
  document.body.append(dialog);
  dialog.showModal();
  if (isDune) {
    discover('dune');
    if (!calm()) {
      document.body.classList.add('quake');
      setTimeout(() => document.body.classList.remove('quake'), 900);
    }
  }
}

// ---------- zooming and panning ----------
function zoomable(content) {
  const stage = h('div', { class: 'zoom-stage' }, content);
  const viewport = h('div', { class: 'zoom-viewport', tabindex: '0', 'aria-label': 'The reading room. Pinch or scroll to zoom, drag to look around.' }, stage);
  const view = { scale: 1, x: 0, y: 0 };
  const MAX = 6;

  const clamp = () => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    view.scale = Math.max(1, Math.min(MAX, view.scale));
    const contentHeight = stage.offsetHeight * view.scale;
    view.x = Math.min(0, Math.max(width - width * view.scale, view.x));
    view.y = Math.min(0, Math.max(Math.min(0, height - contentHeight), view.y));
  };
  const apply = () => { clamp(); stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`; };
  const zoomAt = (factor, cx, cy) => {
    const next = Math.max(1, Math.min(MAX, view.scale * factor));
    const ratio = next / view.scale;
    view.x = cx - (cx - view.x) * ratio;
    view.y = cy - (cy - view.y) * ratio;
    view.scale = next;
    apply();
  };
  const local = (event) => {
    const box = viewport.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const point = local(event);
    zoomAt(Math.exp(-event.deltaY * 0.0015), point.x, point.y);
  }, { passive: false });

  // Drag with one finger or the mouse; pinch with two fingers. A tap that does not move still opens a book.
  const pointers = new Map();
  let moved = false;
  let last = null;
  let travel = 0;
  viewport.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) { moved = false; travel = 0; }
    last = null;
  });
  const onMove = (event) => {
    // Once the page is left, stop listening.
    if (!viewport.isConnected) { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); return; }
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 1) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      travel += Math.abs(dx) + Math.abs(dy);
      if (travel > 6) moved = true;
      view.x += dx;
      view.y += dy;
      apply();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (last) zoomAt(distance / last, (a.x + b.x) / 2, (a.y + b.y) / 2);
      last = distance;
      moved = true;
    }
  };
  const release = (event) => { pointers.delete(event.pointerId); if (pointers.size < 2) last = null; };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  // Swallow the click that ends a drag, so dragging across a book does not open it.
  viewport.addEventListener('click', (event) => { if (moved) { event.stopPropagation(); event.preventDefault(); } }, true);

  const centre = () => ({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
  const controls = h('div', { class: 'zoom-controls' },
    h('button', { class: 'zoom-btn', type: 'button', 'aria-label': 'Zoom in', onClick: () => { const c = centre(); zoomAt(1.4, c.x, c.y); } }, icon('plus')),
    h('button', { class: 'zoom-btn', type: 'button', 'aria-label': 'Zoom out', onClick: () => { const c = centre(); zoomAt(1 / 1.4, c.x, c.y); } }, '−'),
    h('button', { class: 'zoom-btn wide', type: 'button', onClick: () => { Object.assign(view, { scale: 1, x: 0, y: 0 }); apply(); } }, 'Reset'));
  return h('div', { class: 'zoom-wrap' }, viewport, controls);
}

export function renderLibrary() {
  discover('library');
  const sceneHeight = SHELF_TOP + SHELVES * SHELF_GAP + 440;
  const scene = svg('svg', { class: 'library-scene', viewBox: `0 0 ${SCENE_W} ${sceneHeight}`, role: 'img', 'aria-label': `The Wroth Library: ${BOOKS.length} books on a tall wooden bookcase above a reading table with green lamps` },
    defs(),
    svg('rect', { width: SCENE_W, height: sceneHeight, fill: '#24170c' }),
    bookcase(openBook),
    // Leather grain over the whole case, and a warm light from above.
    svg('rect', { x: CASE_X, y: SHELF_TOP - 40, width: CASE_W, height: SHELVES * SHELF_GAP + 20, filter: 'url(#leather-grain)', opacity: 0.35, 'pointer-events': 'none' }),
    readingArea(SHELF_TOP + SHELVES * SHELF_GAP + 20),
    svg('rect', { width: SCENE_W, height: sceneHeight, fill: 'url(#room-light)', 'pointer-events': 'none' }));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Wroth Library', null]),
    pageHeader({
      eyebrow: 'Through its only door, from the Wallace Room',
      title: 'The Wroth Library',
      intro: `A quiet reading room with ${BOOKS.length} books. Pinch or scroll to zoom, drag to look along the shelves, and tap a book to open it.`,
      actions: h('a', { class: 'btn', href: route('/map/engsci') }, 'Back to the complex'),
    }),
    zoomable(scene));
}
