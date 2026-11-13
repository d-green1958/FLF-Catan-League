// The home page: the crest and a countdown to the next Fun Lunch Friday, the podium, the latest game told
// as a story, a living window onto the Map, and a few league records.
import { store } from '../data/store.js';
import { getLeague, leaderboard, nameOf, selectedApproach } from '../domain/league.js';
import { openingFor } from '../domain/board.js';
import { records } from '../domain/stats.js';
import { openGameForm } from '../forms/game-form.js';
import { openPlayerForm } from '../forms/player-form.js';
import { h, route, svg } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { avatar, colourDot, page } from '../ui/components.js';
import { formatLongDate, formatScore, plural } from '../ui/format.js';
import { livingMap } from './map.js';
import { boardView } from '../ui/board-view.js';

// When the group meets. The countdown aims for the next Friday at this time, local time.
const MEET_DAY = 5;
const MEET_HOUR = 12;
const MEET_MINUTE = 30;
const GAME_LENGTH_MINUTES = 90;

let countdownTimer = null;

/** The next meeting, or the one happening right now. */
function nextMeeting(now = new Date()) {
  const start = new Date(now);
  start.setHours(MEET_HOUR, MEET_MINUTE, 0, 0);
  start.setDate(start.getDate() + ((MEET_DAY - start.getDay() + 7) % 7));
  const end = new Date(start.getTime() + GAME_LENGTH_MINUTES * 60000);
  if (now >= end) start.setDate(start.getDate() + 7);
  return { start, live: now >= start && now < end };
}

function countdown() {
  const holder = h('div', { class: 'countdown', role: 'timer', 'aria-live': 'off' });
  const unit = (value, label) => h('div', { class: 'cd-unit' }, h('b', null, String(value).padStart(2, '0')), h('span', null, label));
  const draw = () => {
    if (!holder.isConnected && holder.dataset.drawn) { clearInterval(countdownTimer); return; }
    holder.dataset.drawn = '1';
    const { start, live } = nextMeeting();
    if (live) {
      holder.replaceChildren(h('p', { class: 'cd-live' }, h('span', { class: 'cd-pulse' }), 'Game on. It is Fun Lunch Friday right now.'));
      return;
    }
    let seconds = Math.max(0, Math.floor((start - new Date()) / 1000));
    const days = Math.floor(seconds / 86400); seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600); seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    holder.replaceChildren(
      h('p', { class: 'cd-label' }, 'Next Fun Lunch Friday'),
      h('div', { class: 'cd-units' }, unit(days, days === 1 ? 'day' : 'days'), unit(hours, 'hours'), unit(minutes, 'mins'), unit(seconds - minutes * 60, 'secs')),
      h('p', { class: 'cd-when' }, start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), `, ${String(MEET_HOUR).padStart(2, '0')}:${String(MEET_MINUTE).padStart(2, '0')}`));
  };
  draw();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(draw, 1000);
  return holder;
}

function hero(league) {
  const { fullName } = league.reference.league;
  return h('section', { class: 'hero' },
    h('img', { class: 'hero-crest', src: 'assets/crest2026.jpeg', alt: 'The FLFOxtan League crest', width: 168, height: 168 }),
    h('div', { class: 'hero-text' },
      h('p', { class: 'hero-eyebrow' }, 'Strategy · Trade · Build · Settle'),
      h('h1', { class: 'hero-title' }, 'FLFOxtan League'),
      h('p', { class: 'hero-sub' }, `${fullName}. Every Friday at lunch, settlers gather, trade and quarrel over sheep. Est. 2026.`),
      countdown(),
      h('div', { class: 'hero-acts' },
        h('button', { class: 'btn gold', type: 'button', onClick: () => openGameForm() }, icon('plus'), 'Log a game'),
        h('a', { class: 'btn ghost-light', href: route('/leaderboard') }, icon('trophy'), 'The table'))));
}

function podium(league, approach) {
  const rows = leaderboard(league, approach.id).slice(0, 3);
  if (!rows.length) return null;
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return h('section', { class: 'podium-wrap' },
    h('div', { class: 'home-h' }, h('h2', null, 'The podium'), h('a', { class: 'link', href: route('/leaderboard') }, 'Full table', icon('external', 'sm'))),
    h('div', { class: 'podium' }, order.map((row) => h('a', { class: `step step-${row.rank}`, href: route(`/players/${encodeURIComponent(row.playerId)}`) },
      row.rank === 1 && svg('svg', { class: 'podium-crown', viewBox: '0 0 40 26', 'aria-hidden': 'true' }, svg('path', { d: 'M3 24 1 6l10 8 9-13 9 13 10-8-2 18Z', fill: '#d3ae58', stroke: '#7a5a12', 'stroke-width': 1.6, 'stroke-linejoin': 'round' })),
      avatar(row.player, 'xl'),
      h('b', { class: 'step-name' }, row.player.name),
      h('span', { class: 'step-score' }, `${formatScore(row.score, approach.format)}`),
      h('div', { class: 'step-block' }, h('span', null, row.rank))))));
}

/** The latest game, told as a short story. */
function lastBattle(league) {
  const game = league.games.at(-1);
  if (!game) return null;
  const finishing = [...game.seats].sort((a, b) => a.place - b.place);
  const winner = finishing[0];
  const runnerUp = finishing[1];
  const margin = runnerUp ? winner.vp - runnerUp.vp : 0;
  const name = (seat) => nameOf(league, seat.playerId);
  const verb = margin >= 4 ? 'crushed' : margin >= 2 ? 'beat' : margin === 1 ? 'edged out' : 'tied with, but outlasted,';
  const extras = [
    game.longestRoute && `${nameOf(league, game.longestRoute)} built the Longest Road`,
    game.largestArmy && `${nameOf(league, game.largestArmy)} raised the Largest Army`,
  ].filter(Boolean);
  const openings = game.board?.starts
    ? game.seats.map((seat) => ({ seat, opening: openingFor(game.board, seat.playerId) })).filter((row) => row.opening).sort((a, b) => b.opening.total - a.opening.total)
    : [];
  const story = [
    `${name(winner)} ${verb} ${runnerUp ? name(runnerUp) : 'the table'}, ${winner.vp} to ${runnerUp?.vp ?? '–'}.`,
    extras.length ? ` ${extras.join(', and ')}.` : '',
    game.endedEarly ? ' Lunch ran out before the end.' : '',
    openings.length ? ` ${openings[0].seat.playerId === game.winnerId ? 'The strongest opening paid off' : `${name(openings[0].seat)} had the strongest opening, and it was not enough`}.` : '',
  ].join('');
  return h('section', { class: 'card battle' },
    h('p', { class: 'battle-when' }, `The last battle · ${formatLongDate(game.date)}${game.location ? ` · ${game.location}` : ''}`),
    h('p', { class: 'battle-story' }, story),
    h('div', { class: 'chips' }, finishing.map((seat) => h('span', { class: `chip ${seat.isWinner ? 'won' : ''}`.trim() },
      colourDot(seat.colour), name(seat), h('span', { class: 'chip-vp' }, seat.vp)))),
    game.board && boardView(game.board, {
      colourOf: (playerId) => league.reference.colours.find((colour) => colour.id === game.seats.find((seat) => seat.playerId === playerId)?.colour)?.hex ?? '#888',
      label: 'The board from the last game',
    }),
    h('a', { class: 'link battle-link', href: route('/games') }, 'Every game', icon('external', 'sm')));
}

function mapWindow(league, approach) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { map, place } = livingMap(league, approach, { calm, viewBox: '170 110 680 470', label: 'A window onto the Map, with every player walking about' });
  place(league.games.length);
  const waiting = league.profiles.filter((player) => !league.games.some((game) => game.seats.some((seat) => seat.playerId === player.id))).length;
  return h('a', { class: 'card map-window', href: route('/map') },
    h('div', { class: 'map-window-art' }, map),
    h('div', { class: 'map-window-text' },
      h('b', null, 'The Realm of Oxtan'),
      h('span', null, league.games.length
        ? 'Every settler, walking the city by rank and favourite resource. Sixteen secrets hide on the Map.'
        : `${plural(waiting, 'settler')} waiting at the station for the first game. Sixteen secrets hide on the Map.`)));
}

function recordStrip(league) {
  const items = records(league.games, league.profiles).slice(0, 4);
  if (!items.length) return null;
  return h('section', { class: 'record-strip' }, items.map((record) => h('div', { class: 'card rec' },
    h('span', null, record.title),
    h('b', null, record.value),
    h('span', { class: 'muted' }, nameOf(league, record.playerId)))));
}

function firstSteps() {
  return h('section', { class: 'card first-steps' },
    h('h2', null, 'The league starts here'),
    h('p', null, 'No games yet. Register the players, log your first game and the podium, the story and the Map fill themselves in. Or try the demo, which uses made-up players and leaves the real league alone.'),
    h('div', { class: 'acts' },
      h('button', { class: 'btn', type: 'button', onClick: () => store.enterDemo() }, icon('flask'), 'Try the demo'),
      h('button', { class: 'btn', type: 'button', onClick: () => openPlayerForm() }, icon('users'), 'Register a player'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => openGameForm() }, icon('plus'), 'Log a game')));
}

export function renderHome() {
  const league = getLeague();
  const approach = selectedApproach(league);
  return page(
    hero(league),
    league.games.length ? podium(league, approach) : firstSteps(),
    h('div', { class: 'home-grid' }, lastBattle(league), mapWindow(league, approach)),
    recordStrip(league));
}
