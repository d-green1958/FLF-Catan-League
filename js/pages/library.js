// The Wroth Library's reading room: a wall of books, a long table with chairs, green banker's lamps, a rug,
// a window onto the Radcliffe Camera and a cat asleep on a chair. Tap a book to open it. One of them has sand in it.
import { h, route, svg } from '../ui/dom.js';
import { page, pageHeader } from '../ui/components.js';
import { toast } from '../ui/feedback.js';
import { discover } from '../ui/delights.js';
import { trail } from './engsci.js';
import { BOOKS } from './library-books.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Leather and cloth bindings.
const BINDINGS = ['#6e1f1a', '#1f3d2b', '#1c2b4a', '#8a5a16', '#4a2c4f', '#2d2a26', '#7a3b1b', '#2f4f4f', '#5b1d2c', '#3e4a1e', '#24304a', '#6b4a2b'];

/** A repeatable number from a string, so every book keeps its own size and colour. */
function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

/** Something stirs beneath the shelves. */
function sandworm() {
  discover('dune');
  toast('The shelves tremble. Something vast moves beneath the sand.');
  if (calm()) return;
  const desert = h('div', { class: 'delight dune-desert', 'aria-hidden': 'true' },
    svg('svg', { viewBox: '0 0 1000 600', preserveAspectRatio: 'xMidYMax slice', class: 'dune-art' },
      svg('defs', null,
        svg('linearGradient', { id: 'dune-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#f2c48a', 'stop-opacity': 0 }), svg('stop', { offset: '100%', 'stop-color': '#e9a35a', 'stop-opacity': 0.55 })),
        svg('linearGradient', { id: 'dune-sand', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#e2a95f' }), svg('stop', { offset: '100%', 'stop-color': '#b9773a' })),
        svg('linearGradient', { id: 'worm-skin', x1: 0, y1: 0, x2: 1, y2: 0 }, svg('stop', { offset: '0%', 'stop-color': '#5a4632' }), svg('stop', { offset: '50%', 'stop-color': '#8c7458' }), svg('stop', { offset: '100%', 'stop-color': '#4e3d2b' }))),
      svg('rect', { width: 1000, height: 600, fill: 'url(#dune-sky)' }),
      svg('g', { class: 'worm' },
        svg('path', { d: 'M380 640C380 380 440 240 560 200s190 80 190 300v140Z', fill: 'url(#worm-skin)' }),
        Array.from({ length: 9 }, (_, index) => svg('path', { d: `M${392 + index * 6} ${600 - index * 46}c60-14 160-6 ${340 - index * 10} 26`, stroke: 'rgba(40, 28, 16, .45)', 'stroke-width': 4, fill: 'none' })),
        svg('ellipse', { cx: 600, cy: 214, rx: 92, ry: 34, fill: '#2a1a0e', transform: 'rotate(-12 600 214)' }),
        Array.from({ length: 14 }, (_, index) => {
          const angle = (index / 14) * Math.PI * 2;
          return svg('path', { d: `M${600 + Math.cos(angle) * 88} ${214 + Math.sin(angle) * 30}l${-Math.cos(angle) * 18} ${-Math.sin(angle) * 8}`, stroke: '#e8dcc6', 'stroke-width': 3, transform: 'rotate(-12 600 214)' });
        })),
      svg('path', { d: 'M0 470c120-40 220-30 330-6s210 30 320 0 230-50 350-20V600H0Z', fill: 'url(#dune-sand)' }),
      svg('path', { d: 'M0 520c160-24 300-10 460 4s300 6 540-20V600H0Z', fill: '#c98a45', opacity: 0.8 })));
  document.body.append(desert);
  document.body.classList.add('quake');
  desert.querySelector('.worm').animate([
    { transform: 'translateY(420px)' }, { transform: 'translateY(0)', offset: 0.45 }, { transform: 'translateY(0)', offset: 0.6 }, { transform: 'translateY(460px)' },
  ], { duration: 4200, easing: 'ease-in-out' });
  desert.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 4600 })
    .finished.then(() => { desert.remove(); document.body.classList.remove('quake'); });
  setTimeout(() => { if (desert.isConnected) { desert.remove(); document.body.classList.remove('quake'); } }, 5200);
}

/** A book, opened on the table: title page on the left, its blurb on the right. */
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
        h('button', { class: 'btn sm', type: 'button', onClick: () => dialog.close() }, 'Close the book'))));
  document.body.append(dialog);
  dialog.showModal();
  // The open book sits above everything else, so it closes as the worm arrives.
  if (isDune) setTimeout(() => { dialog.close(); sandworm(); }, 1400);
}

/** The table, chairs, lamps, rug, window and cat, in front of the shelves. */
function readingArea() {
  const lamp = (x) => svg('g', { class: 'lamp' },
    svg('ellipse', { cx: x, cy: 222, rx: 70, ry: 14, fill: 'rgba(255, 214, 140, .35)', class: 'lamp-pool' }),
    svg('path', { d: `M${x - 10} 222h20l-4-6h-12Z`, fill: '#b08a3c' }),
    svg('path', { d: `M${x} 216v-26`, stroke: '#b08a3c', 'stroke-width': 3 }),
    svg('path', { d: `M${x - 26} 190c4-16 48-16 52 0Z`, fill: '#1f5a3a', stroke: '#14402a', 'stroke-width': 1.5 }),
    svg('path', { d: `M${x - 24} 190h48`, stroke: '#ffe2a0', 'stroke-width': 3, class: 'lamp-glow' }));
  const chair = (x, flip = false) => svg('g', { transform: `translate(${x} 0) scale(${flip ? -1 : 1} 1)` },
    svg('path', { d: 'M-24 300v-96M-24 204c10-6 30-6 40 0', stroke: '#5a3a20', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }),
    [-18, -10, -2, 6].map((dx) => svg('path', { d: `M${dx} 206v52`, stroke: '#5a3a20', 'stroke-width': 3 })),
    svg('rect', { x: -28, y: 256, width: 56, height: 10, rx: 3, fill: '#6b4428' }),
    svg('path', { d: 'M-22 266v40M22 266v40', stroke: '#5a3a20', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  return svg('svg', { class: 'reading-area', viewBox: '0 0 1000 340', role: 'img', 'aria-label': 'A long oak reading table with chairs and green banker\'s lamps, on a patterned rug, beside a window onto the Radcliffe Camera. A cat sleeps on one chair.' },
    svg('defs', null,
      svg('linearGradient', { id: 'oak', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#8a5a30' }), svg('stop', { offset: '100%', 'stop-color': '#5c3a1c' })),
      svg('linearGradient', { id: 'window-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': '#9cc2dd' }), svg('stop', { offset: '100%', 'stop-color': '#f2dcb4' }))),
    // Panelled wall.
    svg('rect', { width: 1000, height: 340, fill: '#3b2616' }),
    [0, 1, 2, 3, 4].map((index) => svg('rect', { x: 20 + index * 200, y: 30, width: 160, height: 140, rx: 4, fill: 'none', stroke: 'rgba(255, 220, 160, .12)', 'stroke-width': 3 })),
    // The window, onto the Radcliffe Camera.
    svg('g', null,
      svg('rect', { x: 820, y: 26, width: 140, height: 170, rx: 70, fill: 'url(#window-sky)', stroke: '#6b4428', 'stroke-width': 8 }),
      svg('path', { d: 'M842 196v-52h96v52ZM858 144a32 32 0 0 1 64 0Z', fill: 'rgba(120, 100, 80, .55)' }),
      svg('path', { d: 'M890 112v-14', stroke: 'rgba(120, 100, 80, .55)', 'stroke-width': 4 }),
      svg('path', { d: 'M890 26v170M820 110h140', stroke: '#6b4428', 'stroke-width': 5 })),
    // Rug.
    svg('path', { d: 'M90 330l60-60h700l60 60Z', fill: '#7a2a24' }),
    svg('path', { d: 'M130 322l44-44h652l44 44Z', fill: 'none', stroke: '#d9a95a', 'stroke-width': 3 }),
    svg('path', { d: 'M260 300l30-14 30 14-30 14ZM470 300l30-14 30 14-30 14ZM680 300l30-14 30 14-30 14Z', fill: '#d9a95a', opacity: 0.8 }),
    chair(250), chair(420), chair(590, true), chair(760, true),
    // The cat, asleep on a chair.
    svg('g', { class: 'library-cat' },
      svg('path', { d: 'M572 254c0-16 16-26 34-26 16 0 26 8 30 18 4 10 2 14-4 16h-58c-2 0-2-4-2-8Z', fill: '#d9822b' }),
      svg('path', { d: 'M628 236l6-10 2 12ZM616 232l3-11 6 10Z', fill: '#d9822b' }),
      svg('path', { d: 'M586 248c8 6 22 6 32 0M596 238c4 4 10 4 14 0', stroke: '#9a5418', 'stroke-width': 2, fill: 'none' }),
      svg('path', { d: 'M572 258c-12 0-18 6-14 12', stroke: '#d9822b', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' })),
    // The long table, with lamps and a few open books.
    svg('rect', { x: 150, y: 222, width: 700, height: 22, rx: 3, fill: 'url(#oak)' }),
    svg('path', { d: 'M190 244v70M810 244v70M200 244v66M800 244v66', stroke: '#4a2e16', 'stroke-width': 10 }),
    svg('path', { d: 'M330 220l40-8 40 8ZM600 220l36-7 36 7Z', fill: '#f4ead2', stroke: '#b9a684' }),
    lamp(260), lamp(500), lamp(740));
}

export function renderLibrary() {
  discover('library');
  const shelf = h('div', { class: 'bookcase', role: 'list', 'aria-label': `${BOOKS.length} books. Tap one to open it.` },
    BOOKS.map((book) => {
      const [title, author] = book;
      const seed = hash(title);
      const height = 118 + Math.round(seed * 48);
      const width = Math.max(26, Math.min(46, 18 + title.length * 0.9));
      const colour = BINDINGS[Math.floor(hash(author) * BINDINGS.length)];
      return h('div', { class: 'book-slot', role: 'listitem' },
        h('button', {
          class: 'book', type: 'button', title: `${title}, ${author}`,
          style: { height: `${height}px`, width: `${width}px`, '--binding': colour },
          onClick: () => openBook(book),
        }, h('span', null, title)));
    }));

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Wroth Library', null]),
    pageHeader({
      eyebrow: 'Through its only door, from the Wallace Room',
      title: 'The Wroth Library',
      intro: `A quiet reading room: ${BOOKS.length} books, a long oak table and three green lamps. Tap any spine to open it.`,
      actions: h('a', { class: 'btn', href: route('/map/engsci') }, 'Back to the corridor'),
    }),
    h('section', { class: 'library-room' }, shelf, readingArea()));
}
