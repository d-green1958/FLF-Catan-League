// Who we are, plus a timeline and numbers worked out from the league's real history.
import { getLeague, nameOf } from '../domain/league.js';
import { winnerSeat } from '../domain/games.js';
import { records } from '../domain/stats.js';
import { h } from '../ui/dom.js';
import { kpi, page, pageHeader, playerLink, sectionHeader } from '../ui/components.js';
import { formatDate, formatLongDate } from '../ui/format.js';

const MILESTONE_GAMES = [10, 25, 50, 100, 250, 500, 1000];

function timeline(league) {
  const { inceptionDate, shortName } = league.reference.league;
  const events = [{ date: inceptionDate, text: `${shortName} is founded.` }];

  const joined = [...league.profiles].filter((player) => player.joined).sort((a, b) => a.joined.localeCompare(b.joined));
  if (joined[0]) events.push({ date: joined[0].joined, text: `${joined[0].name} becomes the first registered player.` });

  const first = league.games[0];
  if (first) {
    events.push({ date: first.date, text: `The first league game is played. ${nameOf(league, winnerSeat(first).playerId)} wins.` });
  }
  for (const milestone of MILESTONE_GAMES) {
    const game = league.games[milestone - 1];
    if (game) events.push({ date: game.date, text: `Game number ${milestone}. ${nameOf(league, winnerSeat(game).playerId)} wins.` });
  }
  const sorted = events.sort((a, b) => a.date.localeCompare(b.date));

  return h('ol', { class: 'timeline' }, sorted.map((event) =>
    h('li', null, h('time', { datetime: event.date }, formatDate(event.date)), h('span', null, event.text))));
}

function founders(league) {
  const { inceptionDate } = league.reference.league;
  const earliest = league.profiles.filter((player) => player.joined && player.joined <= inceptionDate);
  if (!earliest.length) return null;
  return [
    sectionHeader('Founding members', 'Registered on or before the day the league began'),
    h('div', { class: 'card card-b founders' }, earliest.map((player) => playerLink(player))),
  ];
}

export function renderAbout() {
  const league = getLeague();
  const { shortName, fullName, inceptionDate, home, meets, about } = league.reference.league;
  const cabinet = records(league.games, league.profiles).slice(0, 3);
  const totalVp = league.games.flatMap((game) => game.seats).reduce((sum, seat) => sum + seat.vp, 0);

  return page(
    pageHeader({ eyebrow: fullName, title: `About ${shortName}` }),
    h('section', { class: 'card about-hero' },
      h('img', { class: 'crest', src: 'assets/crest.jpeg', alt: 'A gold and navy league crest showing hexagonal resource tiles, dice, crossed swords and laurels.', width: 640, height: 640 }),
      h('div', { class: 'about-text' },
        h('p', { class: 'lead' }, about.intro),
        h('dl', { class: 'facts' },
          h('div', null, h('dt', null, 'Full name'), h('dd', null, fullName)),
          h('div', null, h('dt', null, 'Inception'), h('dd', null, formatLongDate(inceptionDate))),
          h('div', null, h('dt', null, 'Home'), h('dd', null, home)),
          h('div', null, h('dt', null, 'Meets'), h('dd', null, meets))))),
    h('section', { class: 'kpis spaced' },
      kpi('Players', league.profiles.length, null, 'users'),
      kpi('Games', league.games.length, null, 'dice'),
      kpi('Victory points scored', totalVp, null, 'trophy')),
    h('div', { class: 'two-col' },
      h('div', null,
        about.sections.map((section) => [
          sectionHeader(section.heading),
          h('p', { class: 'prose' }, section.body),
        ])),
      h('div', null,
        sectionHeader('Timeline'),
        h('div', { class: 'card card-b' }, timeline(league)),
        cabinet.length > 0 && [
          sectionHeader('Trophy cabinet'),
          h('div', { class: 'card card-b' }, h('ul', { class: 'plain-list' }, cabinet.map((record) =>
            h('li', null, h('b', null, `${record.title}: `), `${nameOf(league, record.playerId)}, ${record.value}`)))),
        ],
        founders(league))),
    h('p', { class: 'disclaimer' }, about.disclaimer));
}

