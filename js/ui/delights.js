// Small surprises for the curious. None of them change any league data, and all of them respect "reduce motion".
// The Map page (js/pages/map.js) gives a riddle for each one and marks the ones this browser has found.
//
//   dice       Tap the crest three times quickly      roll two dice (one tap still goes home)
//   robber     Roll a 7                               the robber walks across the screen
//   confetti   Log a game                             hexagon confetti in the resource colours
//   seafarers  Konami code, or "seafarers" in the games search     waves behind the page
//   trade      "wood for sheep" in the games search   the eternal question, answered
//   sheep      Tap a profile picture five times       a sheep wanders past
//   proverb    Tap the proverb under the menu         another lunchtime proverb
//   scholar    Run oxtan.reveal() in the browser console
//   owl        Visit between midnight and 4am         an owl and a word of concern
//   feast      Visit on a Friday                      a ribbon for the day the group is named after
//   winter     Switch dark mode five times quickly    snow
//   dragon     Type "dragon", or search for it        a dragon's shadow passes over
//   recount    Tap the Leaderboard title three times  everyone demands a recount
//   answer     Search the games for 42
//   lost       Visit a page that does not exist       here be dragons
//   compass    Spin the compass on the Map three times
// Inside the Engineering Science complex (js/pages/engsci.js):
//   cryo       Tap Cryogenics                         the screen frosts over
//   library    Tap the Wroth Library                  shhh
//   wallace    Eat every biscuit in the Wallace Room
//   room11     Visit Room 11 eleven times             a fresh whiteboard each time
//   deadzone   Tap the Dead Zone                      the signal drops
//   holder     Tap Hølder-bygningen                   velkommen
//   lift       Ride the Terrible Lift                 eventually, it arrives
//   penthouse  Reach the Penthouse, on the 8th floor of the Thom Building: a night sky that stays
import * as storage from '../data/browser-storage.js';
import { h, svg } from './dom.js';
import { toast } from './feedback.js';

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RESOURCE_COLOURS = ['#3d6b35', '#9cc45a', '#e3b23c', '#c4613a', '#8c9199'];

// ---------- the secrets, and which ones this browser has found ----------
export const SECRETS = [
  { id: 'dice', title: 'The Bones of Carfax', place: 'carfax', riddle: 'Where four roads meet and the bells keep time, press the seal of the realm three times and let the bones fall.' },
  { id: 'robber', title: 'The Hooded One', place: 'christchurch', riddle: 'Of all the sums the bones can make, one is cursed. When it falls, a hooded figure walks.' },
  { id: 'confetti', title: 'A Feast of Hexes', place: 'sheldonian', riddle: 'Write a battle into the ledger and the sky itself will celebrate.' },
  { id: 'seafarers', title: 'The Sailors\' Chant', place: 'folly', riddle: 'Up, up, down, down, left, right, left, right, then the two letters of a sailor\'s grunt. Or simply name the sea-folk in the ledger of games.' },
  { id: 'trade', title: 'The Impossible Trade', place: 'portmeadow', riddle: 'Ask the ledger of games for the bargain every settler offers and no settler accepts.' },
  { id: 'sheep', title: 'The Wandering Flock', place: 'parks', riddle: 'Knock five times on a settler\'s portrait, and see who comes to answer.' },
  { id: 'proverb', title: 'The Changing Wisdom', place: 'bodleian', riddle: 'Beneath the list of places lies a saying. Touch it, and it thinks again.' },
  { id: 'scholar', title: 'The Scholar\'s Incantation', place: 'maths', riddle: 'Those who look beneath the hood of the page will find a greeting, and a spell to speak.' },
  { id: 'owl', title: 'The Night Owl', place: 'magdalen', riddle: 'Visit while the owls are awake: after midnight, before the fourth bell.' },
  { id: 'feast', title: 'The Day of the Feast', place: 'market', riddle: 'Return on the day the group is named after.' },
  { id: 'winter', title: 'The Long Winter', place: 'sighs', riddle: 'Turn day to night and night to day, five times, as fast as you can.' },
  { id: 'dragon', title: 'The Beast of Otmoor', place: 'otmoor', riddle: 'Speak the beast\'s name aloud on your keys, or write it in the ledger of games.' },
  { id: 'recount', title: 'The Great Recount', place: 'schools', riddle: 'The losers always demand it. Strike the title of the rankings three times.' },
  { id: 'answer', title: 'The Answer', place: 'pittrivers', riddle: 'Ask the ledger of games for the answer to life, the universe and everything.' },
  { id: 'lost', title: 'Beyond the Ring Road', place: 'ringroad', riddle: 'Wander off the edge of the map: go to a page that does not exist.' },
  { id: 'compass', title: 'The Hidden Hex', place: 'compass', riddle: 'The compass rose knows a secret. Spin it three times.' },
  { id: 'cryo', title: 'Absolute Zero', place: 'jenkin', inside: 'engsci', where: 'Cryogenics', riddle: 'At the northern edge of the complex, the cold runs deep. Touch it.' },
  { id: 'library', title: 'The Whispering Stacks', place: 'jenkin', inside: 'engsci', where: 'Wroth Library', riddle: 'Below the cold lies a room of books that does not like noise.' },
  { id: 'wallace', title: 'The Last Biscuit', place: 'jenkin', inside: 'engsci', where: 'Wallace Room', riddle: 'Every seminar has biscuits. Every plate runs out. Find out who took the last one.' },
  { id: 'room11', title: 'It Goes Up to Eleven', place: 'jenkin', inside: 'engsci', where: 'Room 11', riddle: 'Its whiteboard never runs dry. Visit it as many times as its number.' },
  { id: 'deadzone', title: 'No Signal', place: 'jenkin', inside: 'engsci', where: 'The Dead Zone', riddle: 'Between the old and the Danish lies a place where phones go quiet.' },
  { id: 'holder', title: 'Velkommen', place: 'jenkin', inside: 'engsci', where: 'Hølder-bygningen', riddle: 'One building speaks another tongue. Knock and be greeted.' },
  { id: 'lift', title: 'The Terrible Lift', place: 'jenkin', inside: 'engsci', where: 'The Terrible Lift', riddle: 'Brave the lift at the southern end. It goes up. Eventually.' },
  { id: 'penthouse', title: 'The View from the Top', place: 'thom', inside: 'thom', where: 'The Penthouse', riddle: 'Climb the Thom Building to the eighth floor, and look up.' },
];
export const secretPlace = (secret, places) => secret.where ?? places[secret.place]?.name ?? secret.place;
const FOUND_KEY = 'flfoxtan.secrets';
export const foundSecrets = () => new Set(storage.read(FOUND_KEY, []));

/** Records a discovery in this browser, quietly. The Map shows what has been found. */
export function discover(id) {
  const found = foundSecrets();
  if (found.has(id)) return;
  found.add(id);
  storage.write(FOUND_KEY, [...found]);
}

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
  'He who hoards wheat feeds no one.',
  'Every port is a promise.',
  'The longest road begins with one brick.',
];
export const proverb = () => PROVERBS[Math.floor(Math.random() * PROVERBS.length)];

function layer(className) {
  const element = h('div', { class: `delight ${className}`, 'aria-hidden': 'true' });
  document.body.append(element);
  return element;
}

/** Moves something across the screen from left to right, bobbing, then removes it. */
function crossScreen(element, { duration = 3400, bob = 10, steps = 10 } = {}) {
  const width = window.innerWidth + 160;
  return element.animate(Array.from({ length: steps + 1 }, (_, step) => ({
    transform: `translate(${-140 + (width * step) / steps}px, ${step % 2 ? -bob : 0}px)`,
  })), { duration, easing: 'linear' }).finished.then(() => element.remove());
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
  const robber = layer('walker-low');
  robber.append(svg('svg', { viewBox: '0 0 60 100', width: 54, height: 90 },
    svg('ellipse', { cx: 30, cy: 94, rx: 22, ry: 5, fill: 'rgba(0,0,0,.25)' }),
    svg('path', { d: 'M30 6a13 13 0 0 1 9 22c7 4 11 13 11 24 0 9-3 17-6 24h6v12H10V76h6c-3-7-6-15-6-24 0-11 4-20 11-24a13 13 0 0 1 9-22Z', fill: '#2a2a2e' }),
    svg('circle', { cx: 25, cy: 18, r: 2.2, fill: '#ffd76a' }),
    svg('circle', { cx: 34, cy: 18, r: 2.2, fill: '#ffd76a' })));
  crossScreen(robber, { duration: 3200, bob: 3 });
}

let rolling = false;
export function rollDice() {
  if (rolling) return;
  rolling = true;
  discover('dice');
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  const total = a + b;
  const finish = () => {
    rolling = false;
    if (total === 7) {
      toast('Seven! The robber is on the move.', 'warn');
      discover('robber');
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

// ---------- falling things: confetti and snow ----------
function fall(className, count, paint, { duration = [1500, 2800], spin = 900, drift = 220 } = {}) {
  const sky = layer(className);
  const width = window.innerWidth;
  for (let i = 0; i < count; i += 1) {
    const bit = paint(i);
    bit.style.left = `${Math.random() * width}px`;
    sky.append(bit);
    bit.animate([
      { transform: 'translate(0, -30px) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * drift}px, ${window.innerHeight + 40}px) rotate(${(Math.random() - 0.5) * spin}deg)`, opacity: 0.9 },
    ], { duration: duration[0] + Math.random() * (duration[1] - duration[0]), delay: Math.random() * 600, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'forwards' });
  }
  setTimeout(() => sky.remove(), duration[1] + 900);
}

export function confetti() {
  discover('confetti');
  if (calm()) return;
  fall('confetti', 70, (i) => {
    const size = 8 + Math.random() * 9;
    return h('span', { class: 'confetti-bit', style: { width: `${size}px`, height: `${size * 1.15}px`, background: RESOURCE_COLOURS[i % 5] } });
  });
}

function snow() {
  toast('The long winter is here. Wool prices are soaring.');
  discover('winter');
  if (calm()) return;
  fall('confetti', 90, () => {
    const size = 4 + Math.random() * 7;
    return h('span', { class: 'snowflake', style: { width: `${size}px`, height: `${size}px` } });
  }, { duration: [4000, 7500], spin: 120, drift: 120 });
}

// ---------- creatures ----------
export function sheep() {
  toast('Baa.');
  discover('sheep');
  if (calm()) return;
  const flock = layer('walker-low');
  flock.append(svg('svg', { viewBox: '0 0 120 90', width: 96, height: 72 },
    svg('ellipse', { cx: 60, cy: 86, rx: 34, ry: 4, fill: 'rgba(0,0,0,.2)' }),
    [[40, 40], [58, 32], [76, 40], [48, 52], [70, 52], [60, 44]].map(([cx, cy]) => svg('circle', { cx, cy, r: 17, fill: '#fbf8ef', stroke: '#d9d2bf', 'stroke-width': 2 })),
    svg('ellipse', { cx: 96, cy: 42, rx: 12, ry: 10, fill: '#2a2418' }),
    svg('circle', { cx: 99, cy: 39, r: 2, fill: '#fff' }),
    [42, 52, 68, 78].map((x) => svg('rect', { x, y: 62, width: 5, height: 20, rx: 2, fill: '#2a2418' }))));
  crossScreen(flock, { duration: 3600, bob: 14 });
}

const DRAGON_PATH = 'M10 60c20-4 34-14 46-30l8 14 14-26 6 22 20-30 2 34c10 4 20 4 32-2-6 10-18 16-32 16l8 14-22-6-12 16-6-16c-16 6-32 6-48 2l-16 10 6-16Z';
export function dragon() {
  toast('A shadow passes over the realm. Guard your sheep.');
  discover('dragon');
  if (calm()) return;
  const beast = layer('flyer');
  beast.append(svg('svg', { viewBox: '0 0 160 100', width: 260, height: 160 }, svg('path', { d: DRAGON_PATH, fill: 'rgba(20, 16, 12, .55)' })));
  beast.style.top = `${10 + Math.random() * 30}vh`;
  crossScreen(beast, { duration: 4200, bob: 24, steps: 6 });
}

function owl() {
  toast('Up past midnight plotting settlements? The owl approves.');
  discover('owl');
  if (calm()) return;
  const bird = layer('flyer');
  bird.style.top = '18vh';
  bird.append(svg('svg', { viewBox: '0 0 80 80', width: 70, height: 70 },
    svg('ellipse', { cx: 40, cy: 46, rx: 22, ry: 26, fill: '#6b4f33' }),
    svg('path', { d: 'M18 46 2 34l14 22Z M62 46l16-12-14 22Z', fill: '#5a4129' }),
    svg('circle', { cx: 32, cy: 38, r: 8, fill: '#f3e2b0' }), svg('circle', { cx: 48, cy: 38, r: 8, fill: '#f3e2b0' }),
    svg('circle', { cx: 32, cy: 38, r: 3.5, fill: '#1c140c' }), svg('circle', { cx: 48, cy: 38, r: 3.5, fill: '#1c140c' }),
    svg('path', { d: 'M38 44h4l-2 5Z', fill: '#e0a43a' }),
    svg('path', { d: 'M24 24l6 8M56 24l-6 8', stroke: '#5a4129', 'stroke-width': 4, 'stroke-linecap': 'round' })));
  crossScreen(bird, { duration: 5000, bob: 30, steps: 8 });
}

// ---------- page-specific ones ----------
export function toggleSeafarers() {
  const on = document.documentElement.classList.toggle('seafarers');
  if (on) discover('seafarers');
  toast(on ? 'Seafarers mode. Mind the pirates.' : 'Back on dry land.');
}

/** Messages hidden in the games search box. */
export function searchSecrets(text) {
  const query = text.trim().toLowerCase();
  if (query === 'seafarers') toggleSeafarers();
  if (/wood\s*(for|4)\s*sheep/.test(query)) { toast('Nobody has wood for sheep. Nobody has ever had wood for sheep.'); discover('trade'); }
  if (query === 'dragon') dragon();
  if (query === '42') { toast('42. Though nobody remembers the question.'); discover('answer'); }
}

/** Everyone demands a recount: the leaderboard rows jumble, then settle back. */
function recount() {
  toast('A recount has been demanded. The results stand.');
  discover('recount');
  if (calm()) return;
  document.querySelectorAll('#view .tbl tbody tr').forEach((row, index) => row.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${(Math.random() - 0.5) * 60}px, ${(Math.random() - 0.5) * 120}px) rotate(${(Math.random() - 0.5) * 8}deg)`, offset: 0.4 },
    { transform: 'translate(0, 0)' },
  ], { duration: 1100, delay: index * 40, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
}

/** Counts quick taps, and calls back after the given number. */
export function onTaps(element, count, callback) {
  let taps = 0;
  let timer = null;
  element.addEventListener('click', (event) => {
    taps += 1;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 900);
    if (taps >= count) { taps = 0; callback(event); }
  });
  return element;
}

let themeFlips = [];
/** Call whenever the theme is switched. Five switches in four seconds brings the long winter. */
export function noteThemeSwitch() {
  const now = Date.now();
  themeFlips = [...themeFlips.filter((time) => now - time < 4000), now];
  if (themeFlips.length >= 5) { themeFlips = []; snow(); }
}

/** The page shown for an address that leads nowhere. */
export function lostPage(homeLink, mapLink) {
  discover('lost');
  return h('div', { class: 'page' }, h('div', { class: 'empty card lost' },
    svg('svg', { viewBox: '0 0 160 100', width: 180, height: 112, 'aria-hidden': 'true' }, svg('path', { d: DRAGON_PATH, fill: 'currentColor' })),
    h('h2', null, 'Here be dragons'),
    h('p', null, 'You have wandered beyond the Ring Road, where no settler has built. Nothing lives here but rumours.'),
    h('div', { class: 'acts' }, mapLink, homeLink)));
}

/** Sets up the site-wide ones. Call once, after the first page is drawn. */
export function installDelights() {
  // One tap on the crest goes home, as anyone would expect. Three quick taps roll the dice.
  const crest = document.querySelector('.brand .mark');
  if (crest) onTaps(crest, 3, rollDice);

  // Keys typed anywhere: the Konami code, and the beast's name.
  const konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let typed = [];
  window.addEventListener('keydown', (event) => {
    if (event.target.matches?.('input, textarea, select')) return;
    typed = [...typed, event.key.toLowerCase()].slice(-10);
    if (typed.join(',') === konami.join(',')) { typed = []; toggleSeafarers(); }
    if (typed.slice(-6).join('') === 'dragon') { typed = []; dragon(); }
  });

  // Three taps on the Leaderboard title, wherever it is drawn.
  let titleTaps = 0;
  let titleTimer = null;
  document.getElementById('view').addEventListener('click', (event) => {
    if (!(event.target.matches('h1') && event.target.textContent === 'Leaderboard')) return;
    titleTaps += 1;
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => { titleTaps = 0; }, 900);
    if (titleTaps >= 3) { titleTaps = 0; recount(); }
  });

  // Proverbs think again when touched.
  document.addEventListener('click', (event) => {
    if (!event.target.matches('.proverb')) return;
    event.target.textContent = proverb();
    discover('proverb');
  });

  // The time and the day.
  const now = new Date();
  if (now.getHours() < 4) setTimeout(owl, 1500);
  if (now.getDay() === 5) {
    discover('feast');
    const ribbon = h('div', { class: 'feast-ribbon', role: 'status' },
      'Happy Friday, settlers. Fun Lunch Friday, in name at least.',
      h('button', { class: 'link-btn', type: 'button', 'aria-label': 'Dismiss', onClick: () => ribbon.remove() }, '×'));
    document.getElementById('main').prepend(ribbon);
  }

  // For anyone peeking at the console.
  window.oxtan = {
    reveal() {
      discover('scholar');
      return `Well read, scholar. There are ${SECRETS.length} secrets in all, and the Map knows where.`;
    },
  };
  console.log('%c⬢ FLFOxtan', 'font: 700 20px Georgia, serif; color: #d3ae58; background: #0f1f36; padding: 6px 12px; border-radius: 6px;');
  console.log('Looking under the hood? Everything is plain HTML, CSS and JavaScript. Speak the incantation: oxtan.reveal()');
}
