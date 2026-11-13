// Arrakis, reached by following the sand out of Dune in the Wroth Library.
// The dunes are real: photographed on Mars by NASA's Curiosity rover (Namib Dune, Gale Crater), cropped and
// graded warmer. Everything drawn over them is original: the sky and its two moons, the spice in the air,
// a thumper, a sandworm, and Duke Leto's signet ring half buried in the sand.
import { h, route, svg } from '../ui/dom.js';
import { page, pageHeader } from '../ui/components.js';
import { discover } from '../ui/delights.js';
import { trail } from './engsci.js';

const W = 1600;
const H = 1000;
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PHOTOS = [
  { file: 'vista', caption: 'Namib Dune, Gale Crater, Mars. A wall of dark sand several storeys high, with Mount Sharp hazy behind.', credit: 'NASA/JPL-Caltech/MSSS (Curiosity rover)', source: 'https://images.nasa.gov/details/PIA20284' },
  { file: 'slipface', caption: 'The steep downwind face of the same dune, where sand avalanches down in sheets.', credit: 'NASA/JPL-Caltech/MSSS (Curiosity rover)', source: 'https://images.nasa.gov/details/PIA20283' },
  { file: 'ripples', caption: 'Wind-carved ripples across the sand sheet near a dune on Mount Sharp.', credit: 'NASA/JPL-Caltech/MSSS (Curiosity rover)', source: 'https://images.nasa.gov/details/PIA21719' },
];

function stop(offset, colour, opacity = 1) {
  return svg('stop', { offset, 'stop-color': colour, 'stop-opacity': opacity });
}

function defs() {
  return svg('defs', null,
    svg('linearGradient', { id: 'arrakis-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#55301a'), stop('22%', '#9a6030'), stop('34%', '#e0a75c'), stop('42%', '#f6db98'), stop('55%', '#f7e2aa'), stop('100%', '#f7dfb2')),
    svg('radialGradient', { id: 'sun-glow' }, stop('0%', '#fff6dc', 1), stop('18%', '#ffe2a2', 0.9), stop('100%', '#ffbf6a', 0)),
    svg('radialGradient', { id: 'moon-face', cx: '38%', cy: '35%' }, stop('0%', '#fbf4e2'), stop('70%', '#d9cdb2'), stop('100%', '#a89a7c')),
    // Fade each photograph in from the top, so the layers melt into one another.
    // The photograph's own sky is hidden, so only the dune itself shows against the painted sky.
    svg('linearGradient', { id: 'fade-top', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#fff', 0), stop('20%', '#fff', 0), stop('36%', '#fff', 1), stop('100%', '#fff', 1)),
    svg('mask', { id: 'vista-mask', maskContentUnits: 'objectBoundingBox' }, svg('rect', { width: 1, height: 1, fill: 'url(#fade-top)' })),
    svg('linearGradient', { id: 'fade-top-short', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#fff', 0), stop('22%', '#fff', 1)),
    svg('mask', { id: 'ripples-mask', maskContentUnits: 'objectBoundingBox' }, svg('rect', { width: 1, height: 1, fill: 'url(#fade-top-short)' })),
    svg('linearGradient', { id: 'sand-back', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#a26a3a', 0), stop('9%', '#9a6436'), stop('100%', '#6e4424')),
    svg('linearGradient', { id: 'seam-haze', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#e6b47a', 0), stop('50%', '#e6b47a', 0.45), stop('100%', '#e6b47a', 0)),
    svg('linearGradient', { id: 'haze', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#f3c98a', 0), stop('50%', '#f3c98a', 0.35), stop('100%', '#f3c98a', 0)),
    svg('linearGradient', { id: 'gold', x1: 0, y1: 0, x2: 1, y2: 1 }, stop('0%', '#fff0b8'), stop('30%', '#e0b34e'), stop('60%', '#9a6c1c'), stop('85%', '#f2d27a'), stop('100%', '#7a5212')),
    svg('radialGradient', { id: 'stone', cx: '35%', cy: '30%' }, stop('0%', '#3a6b52'), stop('60%', '#12301f'), stop('100%', '#060f09')),
    svg('linearGradient', { id: 'worm-haze', x1: 0, y1: 0, x2: 0, y2: 1 }, stop('0%', '#f2c88c', 0.12), stop('60%', '#f2c88c', 0.4), stop('100%', '#f6d9a2', 0.75)),
    svg('linearGradient', { id: 'worm-skin', x1: 0, y1: 0, x2: 1, y2: 0 }, stop('0%', '#3a2a1a'), stop('35%', '#8a6c4a'), stop('55%', '#a08460'), stop('100%', '#2e2214')),
    svg('radialGradient', { id: 'worm-mouth' }, stop('0%', '#120a04'), stop('70%', '#2a1708'), stop('100%', '#5a3a1e')),
    svg('filter', { id: 'soft' }, svg('feGaussianBlur', { stdDeviation: 3 })));
}

/** Duke Leto's signet ring: a heavy gold band with an oval dark stone, a hawk engraved in it. Original design. */
function signetRing(onFind) {
  const ring = svg('g', { class: 'signet', role: 'button', tabindex: '0', 'aria-label': 'A gold ring, half buried in the sand', transform: 'translate(1110 880)' },
    svg('ellipse', { cx: 6, cy: 26, rx: 70, ry: 14, fill: 'rgba(40, 20, 6, .45)', filter: 'url(#soft)' }),
    // The band, seen at an angle.
    svg('ellipse', { cx: 0, cy: 12, rx: 50, ry: 20, fill: 'none', stroke: 'url(#gold)', 'stroke-width': 13 }),
    svg('ellipse', { cx: 0, cy: 12, rx: 50, ry: 20, fill: 'none', stroke: 'rgba(255, 245, 200, .5)', 'stroke-width': 1.5, transform: 'translate(-2 -4)' }),
    // The bezel and its stone.
    svg('ellipse', { cx: -4, cy: -10, rx: 36, ry: 24, fill: 'url(#gold)' }),
    svg('ellipse', { cx: -4, cy: -12, rx: 29, ry: 18.5, fill: 'url(#stone)' }),
    svg('ellipse', { cx: -12, cy: -20, rx: 10, ry: 4, fill: 'rgba(255, 255, 255, .28)', transform: 'rotate(-18 -12 -20)' }),
    // The hawk, engraved in gold on the stone: wings spread, head turned.
    svg('path', { d: 'M-4 -24c3 1 5 4 5 7l9-6-5 8 11-3-9 7 8 1-10 3c-2 3-5 5-9 5s-7-2-9-5l-10-3 8-1-9-7 11 3-5-8 9 6c0-3 2-6 5-7Z', fill: 'none', stroke: '#f3d27a', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
    svg('circle', { cx: -2, cy: -21, r: 0.9, fill: '#f3d27a' }),
    // Sand drifted over the near side of the band.
    svg('path', { d: 'M-70 30c20-14 40-16 60-8s40 6 80-6c6 10 6 20 0 26h-140Z', fill: 'rgba(150, 92, 46, .9)' }),
    svg('circle', { cx: 22, cy: -26, r: 3, class: 'glint' }));
  ring.addEventListener('click', onFind);
  ring.addEventListener('keydown', (event) => { if (event.key === 'Enter') onFind(); });
  return ring;
}

/** A sandworm rearing out of the sand, mouth first, leaning back as it rises. Drawn at its emergence point. */
function sandworm() {
  const tilt = -11;
  const mouth = { x: -88, y: 72 };
  const teeth = (count, rx, ry, inset, colour, width) => Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const x1 = Math.cos(angle) * rx;
    const y1 = Math.sin(angle) * ry;
    return svg('path', { d: `M${x1} ${y1}L${x1 * inset} ${y1 * inset}`, stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round' });
  });
  // The body tapers from a broad base to the head, leaning to the left as it rears.
  const body = 'M-196 520C-206 390-206 250-222 92-180 44 6 38 46 70 74 220 150 380 176 520Z';
  // Where the body's edges are at a given height, so the ridges can follow its shape.
  const edges = (y) => {
    const t = (520 - y) / 440;
    return [-196 + (-222 + 196) * t - Math.sin(t * Math.PI) * 6, 176 + (46 - 176) * t];
  };
  const ridges = Array.from({ length: 13 }, (_, index) => {
    const y = 110 + index * 30 + (index % 3) * 3;
    const [left, right] = edges(y);
    const sag = 14 + (index % 4) * 3;
    return svg('g', null,
      svg('path', { d: `M${left} ${y}Q${(left + right) / 2} ${y + sag} ${right} ${y - 4}`, stroke: 'rgba(28, 18, 8, .38)', 'stroke-width': 4.5 + (index % 3), fill: 'none' }),
      svg('path', { d: `M${left + 6} ${y - 6}Q${(left + right) / 2} ${y + sag - 7} ${right - 6} ${y - 10}`, stroke: 'rgba(255, 224, 176, .17)', 'stroke-width': 2.2, fill: 'none' }));
  });
  return svg('g', { class: 'worm', transform: 'translate(1040 960) scale(1.15)' },
    svg('defs', null,
      svg('clipPath', { id: 'worm-body' }, svg('path', { d: body })),
      svg('filter', { id: 'plume-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, svg('feGaussianBlur', { stdDeviation: 18 })),
      svg('filter', { id: 'worm-grain', x: 0, y: 0, width: '100%', height: '100%' },
        svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9 0.12', numOctaves: 2, seed: 3 }),
        svg('feColorMatrix', { values: '0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0.5 0' }))),
    svg('path', { d: body, fill: 'url(#worm-skin)' }),
    svg('g', { 'clip-path': 'url(#worm-body)' },
      svg('rect', { x: -200, y: 40, width: 400, height: 470, filter: 'url(#worm-grain)' }),
      ridges,
      // Light catching the left flank, shadow down the right.
      svg('path', { d: 'M-196 100c-8 130-2 270 8 410', stroke: 'rgba(255, 232, 196, .16)', 'stroke-width': 30, fill: 'none' }),
      svg('path', { d: 'M60 110c34 130 70 260 100 400', stroke: 'rgba(0, 0, 0, .3)', 'stroke-width': 50, fill: 'none' })),
    // The mouth, open to the sky, tilted back, with rings of crystal teeth.
    svg('g', { transform: `translate(${mouth.x} ${mouth.y}) rotate(${tilt})` },
      svg('ellipse', { cx: 0, cy: 0, rx: 134, ry: 48, fill: '#4e341c' }),
      svg('ellipse', { cx: 0, cy: 2, rx: 120, ry: 42, fill: 'url(#worm-mouth)' }),
      teeth(40, 118, 41, 0.82, '#efe3c8', 3.2), teeth(30, 88, 30, 0.8, '#d8c9a8', 2.4), teeth(22, 60, 21, 0.76, '#a99a7a', 1.8),
      svg('ellipse', { cx: 0, cy: 4, rx: 40, ry: 13, fill: '#030100' })),
    // Distance haze over the whole creature.
    svg('path', { d: body, fill: 'url(#worm-haze)' }),
    // Sand bursting up around it as it breaks the surface, hiding where it meets the ground.
    svg('g', { class: 'sand-plume', filter: 'url(#plume-blur)' },
      [[-260, 250, 120, 40], [-120, 230, 150, 50], [40, 240, 140, 46], [170, 260, 110, 36], [-60, 200, 100, 36]]
        .map(([cx, cy, rx, ry], index) => svg('ellipse', { cx, cy, rx, ry, fill: index % 2 ? 'rgba(206, 146, 84, .62)' : 'rgba(186, 126, 70, .7)' }))),
    Array.from({ length: 40 }, (_, index) => svg('circle', { cx: -280 + ((index * 53) % 520), cy: 150 + ((index * 37) % 130), r: 1.5 + (index % 3), fill: 'rgba(222, 170, 104, .65)' })));
}

export function renderArrakis() {
  discover('arrakis');
  const story = h('div', { class: 'map-riddle', 'aria-live': 'polite' },
    h('p', { class: 'map-riddle-hint' }, 'Heat shimmers over the sand. Something small glints in the foreground, and the dunes are very quiet. Perhaps too quiet.'));
  const tell = (place, title, ...lines) => story.replaceChildren(
    h('p', { class: 'map-riddle-place' }, place), h('h3', null, title), ...lines.map((line) => h('p', null, line)));

  const worm = sandworm();
  const thumper = svg('g', { class: 'thumper', transform: 'translate(1340 760)', opacity: 0 },
    svg('path', { d: 'M0 0v-90', stroke: '#3a2a1a', 'stroke-width': 6 }),
    svg('rect', { x: -9, y: -112, width: 18, height: 26, rx: 3, fill: '#5a4a38' }),
    svg('ellipse', { cx: 0, cy: 2, rx: 18, ry: 5, fill: 'rgba(40, 20, 6, .4)' }));

  const motes = svg('g', { class: 'spice-motes' }, Array.from({ length: 70 }, (_, index) => svg('circle', {
    cx: (index * 211) % W, cy: 300 + ((index * 137) % 640), r: 0.9 + (index % 4) * 0.6, fill: index % 5 ? '#ffd27a' : '#fff1c8',
    style: { animationDuration: `${8 + (index % 9)}s`, animationDelay: `${-(index % 13)}s` },
  })));

  const scene = svg('svg', { class: 'arrakis-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'A vast desert of dunes under an amber sky with two moons. A gold ring lies half buried in the sand.' },
    defs(),
    svg('rect', { width: W, height: H, fill: 'url(#arrakis-sky)' }),
    svg('circle', { cx: 1220, cy: 300, r: 260, fill: 'url(#sun-glow)' }),
    svg('circle', { cx: 1220, cy: 300, r: 34, fill: '#fff8e6', opacity: 0.95 }),
    // Two moons, one large and one small.
    svg('g', { opacity: 0.92 },
      svg('circle', { cx: 330, cy: 150, r: 48, fill: 'url(#moon-face)' }),
      [[316, 136, 8], [346, 166, 6], [336, 130, 4], [312, 170, 5]].map(([cx, cy, r]) => svg('circle', { cx, cy, r, fill: 'rgba(120, 104, 80, .28)' })),
      svg('circle', { cx: 480, cy: 96, r: 17, fill: 'url(#moon-face)' })),
    // The worm rises from behind the far dune, so the dune itself hides where it leaves the sand.
    worm,
    svg('image', { href: 'assets/arrakis/vista.jpg', x: -300, y: 230, width: 2200, height: 2200 * 473 / 2800, preserveAspectRatio: 'xMidYMid slice', mask: 'url(#vista-mask)' }),
    svg('rect', { x: 0, y: 380, width: W, height: 260, fill: 'url(#haze)', 'pointer-events': 'none' }),
    // Sand behind the foreground photograph, so its soft top edge blends into sand rather than sky.
    svg('rect', { x: 0, y: 560, width: W, height: 440, fill: 'url(#sand-back)' }),
    svg('image', { href: 'assets/arrakis/ripples.jpg', x: -260, y: 560, width: W + 520, height: (W + 520) * 457 / 2000, preserveAspectRatio: 'xMidYMid slice', mask: 'url(#ripples-mask)' }),
    // A band of haze where the far dune meets the near sand.
    svg('rect', { x: 0, y: 560, width: W, height: 90, fill: 'url(#seam-haze)', 'pointer-events': 'none' }),
    thumper,
    signetRing(() => {
      discover('signet');
      tell('Half buried in the sand', 'Duke Leto\'s signet ring',
        'A heavy gold ring set with a dark green stone, a hawk cut into its face. Sand has drifted over half the band.',
        'Whoever wore it governed this world once. The desert keeps what it is given.');
    }),
    motes,
    svg('rect', { width: W, height: H, fill: 'url(#haze)', opacity: 0.25, 'pointer-events': 'none' }));

  let summoning = false;
  const summon = () => {
    if (summoning) return;
    summoning = true;
    thumper.setAttribute('opacity', 1);
    tell('The open sand', 'The thumper is beating', 'Thump. Thump. Thump. The rhythm carries a long way through the sand.');
    if (calm()) {
      discover('worm');
      tell('The open sand', 'Something answers', 'Far off, a great shape breaks the surface of the dunes, then sinks again.');
      summoning = false;
      return;
    }
    thumper.querySelector('rect').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(10px)' }, { transform: 'translateY(0)' }], { duration: 420, iterations: 7 });
    setTimeout(() => {
      scene.classList.add('tremor');
      tell('The open sand', 'Something answers', 'The ground shudders. Run.');
    }, 2200);
    setTimeout(() => {
      discover('worm');
      const rise = worm.animate([
        { transform: 'translate(1040px, 960px) scale(1.15)' },
        { transform: 'translate(1040px, 40px) scale(1.15)', offset: 0.45 },
        { transform: 'translate(1040px, 40px) scale(1.15)', offset: 0.65 },
        { transform: 'translate(1040px, 960px) scale(1.15)' },
      ], { duration: 6000, easing: 'cubic-bezier(.4, 0, .3, 1)' });
      rise.finished.then(() => {
        scene.classList.remove('tremor');
        thumper.setAttribute('opacity', 0);
        tell('The open sand', 'Gone', 'The worm has gone back beneath the sand, and the thumper with it. The desert is quiet again.');
        summoning = false;
      });
      setTimeout(() => { if (rise.playState !== 'finished') rise.finish(); }, 7000);
    }, 3000);
  };

  return page(
    trail(['The Map', '/map'], ['EngSci complex', '/map/engsci'], ['Wroth Library', '/map/library'], ['Arrakis', null]),
    pageHeader({
      eyebrow: 'Following the sand out of the book',
      title: 'Arrakis',
      intro: 'Dune country: an ocean of sand under two moons. Look closely at the foreground, or plant a thumper and see what comes.',
      actions: [
        h('button', { class: 'btn gold', type: 'button', onClick: summon }, 'Plant a thumper'),
        h('a', { class: 'btn', href: route('/map/library') }, 'Back to the library'),
      ],
    }),
    h('div', { class: 'arrakis-sheet' }, scene),
    story,
    h('section', { class: 'arrakis-photos' },
      h('h2', null, 'Real dunes'),
      h('p', { class: 'field-hint' }, 'The sand in this scene is real: dunes photographed on Mars by NASA\'s Curiosity rover, shown here graded a little warmer. The sky, moons, ring, thumper and worm are drawn for this site.'),
      h('div', { class: 'arrakis-grid' }, PHOTOS.map((photo) => h('figure', null,
        h('a', { href: `assets/arrakis/${photo.file}.jpg`, target: '_blank', rel: 'noopener' }, h('img', { src: `assets/arrakis/${photo.file}.jpg`, alt: photo.caption, loading: 'lazy' })),
        h('figcaption', null, photo.caption, ' ', h('span', { class: 'muted' }, photo.credit, ' · '), h('a', { class: 'link', href: photo.source, target: '_blank', rel: 'noopener' }, 'NASA image library')))))));
}
