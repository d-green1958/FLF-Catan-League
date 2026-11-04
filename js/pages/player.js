// One player's profile: their record, rating history, colours, rivals and recent games.
import { settings } from '../data/settings.js';
import { getLeague, leaderboard, nameOf, paramsFor, selectedApproach } from '../domain/league.js';
import { winnerSeat } from '../domain/games.js';
import { colourStats, headToHead } from '../domain/stats.js';
import { scoreHistory } from '../ratings/engine.js';
import { openPlayerForm } from '../forms/player-form.js';
import { h, route } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { avatar, colourDot, colourName, emptyState, kpi, page, pageHeader, playerLink, sectionHeader, table } from '../ui/components.js';
import { barList, lineChart } from '../ui/charts.js';
import { formatDate, formatScore, formatShortDate, ordinal, percent, plural } from '../ui/format.js';
import { openGameDetail } from './games.js';

const RECENT_GAMES = 8;

function ratingChart(league, player, approach) {
  const run = league.runs.get(approach.id);
  const history = scoreHistory(run, player.id);
  const playedAt = league.games.flatMap((game, index) =>
    (game.seats.some((seat) => seat.playerId === player.id) ? [index] : []));
  if (playedAt.length < 2) return null;

  const select = h('select', {
    class: 'select', 'aria-label': 'Scoring system',
    onChange: (event) => settings.set('approachId', event.target.value),
  }, league.approaches.map((entry) => h('option', { value: entry.id, selected: entry.id === approach.id }, entry.name)));

  return [
    sectionHeader('Rating over time', null, select),
    h('div', { class: 'card card-b' }, lineChart({
      series: [{ id: player.id, label: player.name, slot: 1, values: playedAt.map((index) => history[index]) }],
      xLabels: playedAt.map((index) => formatShortDate(league.games[index].date)),
      formatValue: (value) => formatScore(value, approach.format),
      summary: `Line chart of ${player.name}'s ${approach.name} score over their ${playedAt.length} games.`,
    })),
  ];
}

function standingsTable(league, player) {
  const rows = league.approaches.flatMap((entry) => {
    const row = leaderboard(league, entry.id, { includeRetired: true }).find((item) => item.playerId === player.id);
    return row ? [{ entry, row }] : [];
  });
  return h('div', { class: 'card' }, table(
    [{ label: 'System' }, { label: 'Score', align: 'right' }, { label: 'Rank', align: 'right' }],
    rows.map(({ entry, row }) => [
      h('a', { class: 'link', href: route(`/scoring#${entry.id}`) }, entry.name),
      h('span', { class: 'num' }, formatScore(row.score, entry.format)),
      ordinal(row.rank),
    ]),
  ));
}

function colourSection(league, player) {
  const rows = colourStats(league.games, league.reference.colours, player.id)
    .filter((row) => row.games > 0)
    .sort((a, b) => b.games - a.games);
  return h('div', { class: 'card card-b' }, barList(rows.map((row) => ({
    lead: colourDot(row.id),
    label: row.name,
    value: row.games,
    display: plural(row.games, 'game'),
    detail: `${percent(row.winRate)} won`,
  }))));
}

function rivalsTable(league, player) {
  const halfLife = paramsFor(league.reference.approaches.find((entry) => entry.id === 'elo-repeat-decay')).halfLife;
  const rows = headToHead(league.games, player.id, halfLife);
  return h('div', { class: 'card' }, table(
    [
      { label: 'Opponent' },
      { label: 'Games together', align: 'right' },
      { label: `${player.name} won`, align: 'right' },
      { label: 'They won', align: 'right' },
      { label: 'Next game counts', align: 'right', title: `From repeat decay with a half-life of ${halfLife} games` },
    ],
    rows.map((row) => [
      playerLink(league.profiles.find((other) => other.id === row.playerId)),
      row.games,
      row.wins,
      row.theirWins,
      percent(row.influence),
    ]),
  ));
}

function recentGames(league, player) {
  const games = league.games.filter((game) => game.seats.some((seat) => seat.playerId === player.id)).slice(-RECENT_GAMES).reverse();
  return h('div', { class: 'card' }, table(
    [{ label: 'Date' }, { label: 'Finish' }, { label: 'VP', align: 'right' }, { label: 'Colour' }, { label: 'Winner' }, { label: '' }],
    games.map((game) => {
      const seat = game.seats.find((item) => item.playerId === player.id);
      return [
        h('span', { class: 'nowrap' }, formatDate(game.date)),
        `${ordinal(seat.place)} of ${game.size}`,
        h('span', { class: 'num' }, seat.vp),
        h('span', { class: 'seat-name' }, colourDot(seat.colour), colourName(seat.colour)),
        nameOf(league, winnerSeat(game).playerId),
        h('button', { class: 'btn ghost sm', type: 'button', onClick: () => openGameDetail(game.id) }, 'Details'),
      ];
    }),
  ));
}

export function renderPlayer(id) {
  const league = getLeague();
  const player = league.profiles.find((item) => item.id === id);
  if (!player) {
    return page(pageHeader({ title: 'Player not found' }), emptyState({
      title: 'We could not find that player',
      message: 'They may have been deleted, or the link may be out of date.',
      actions: h('a', { class: 'btn', href: route('/players') }, 'See all players'),
    }));
  }

  const summary = league.summaries.get(player.id);
  const approach = selectedApproach(league);
  const standing = leaderboard(league, approach.id, { includeRetired: true }).find((row) => row.playerId === player.id);

  const header = h('div', { class: 'profile-head' },
    avatar(player, 'xl'),
    pageHeader({
      eyebrow: [player.nickname, player.active === false ? 'Retired' : null, player.joined ? `Joined ${formatDate(player.joined)}` : null].filter(Boolean).join(' · '),
      title: player.name,
      intro: player.tagline || null,
      actions: h('button', { class: 'btn', onClick: () => openPlayerForm(player) }, icon('edit'), 'Edit profile'),
    }));

  if (!summary.games) {
    return page(header, emptyState({
      title: `${player.name} has not played yet`,
      message: 'Their record will start with their first logged game.',
    }));
  }

  const hasBonuses = summary.longestRoutes || summary.largestArmies;
  return page(
    header,
    h('section', { class: 'kpis' },
      kpi(approach.name, formatScore(standing.score, approach.format), `${ordinal(standing.rank)} in the league`, 'trophy'),
      kpi('Record', `${summary.wins}–${summary.losses}`, `${plural(summary.games, 'game')}, ${percent(summary.winRate)} won`, 'dice'),
      kpi('Average VP', summary.averageVp.toFixed(1), `Average finish: ${summary.averagePlace.toFixed(1)}`, 'chart'),
      hasBonuses ? kpi('Bonus tiles', summary.longestRoutes + summary.largestArmies, `${plural(summary.longestRoutes, 'Longest Route')}, ${summary.largestArmies} Largest Army`, 'scale') : null),
    ratingChart(league, player, approach),
    h('div', { class: 'two-col' },
      h('div', null, sectionHeader('Standing in every system'), standingsTable(league, player)),
      h('div', null,
        sectionHeader('Colours played'), colourSection(league, player))),
    sectionHeader('Head to head', 'Who they meet the most, and how much the next game with each person counts towards repeat-decay ratings'),
    rivalsTable(league, player),
    sectionHeader('Recent games'),
    recentGames(league, player));
}
