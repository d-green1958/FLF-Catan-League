// One player's profile: who they are, then their record, form, honours, rating history, colours, rivals and recent games.
import { store } from '../data/store.js';
import { settings } from '../data/settings.js';
import { getLeague, leaderboard, nameOf, paramsFor, selectedApproach } from '../domain/league.js';
import { winnerSeat } from '../domain/games.js';
import { colourStats, headToHead, milestonesEarned, playerDetails, records } from '../domain/stats.js';
import { scoreHistory } from '../ratings/engine.js';
import { openPlayerForm } from '../forms/player-form.js';
import { h, route } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { avatar, colourDot, colourName, emptyState, kpi, page, pageHeader, playerLink, sectionHeader, table } from '../ui/components.js';
import { barList, lineChart } from '../ui/charts.js';
import { byLabel, formatDate, formatScore, formatShortDate, ordinal, percent, plural } from '../ui/format.js';
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
      { label: 'Next game counts', align: 'right', optional: true, title: `From repeat decay with a half-life of ${halfLife} games` },
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
    [{ label: 'Date' }, { label: 'Finish' }, { label: 'VP', align: 'right' }, { label: 'Colour', optional: true }, { label: 'Winner', optional: true }, { label: '' }],
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

/** Who they are: everything people fill in themselves. */
function aboutCard(player) {
  const { resources, playStyles } = store.reference().profileOptions;
  const optionName = (options, id) => options.find((option) => option.id === id)?.name;
  const addedBy = store.additionFor('player', player.id);
  const facts = [
    ['Signature move', player.tagline],
    ['Play style', optionName(playStyles, player.playStyle)],
    ['Favourite resource', optionName(resources, player.favouriteResource)],
    ['Favourite colour', player.favouriteColour && h('span', { class: 'seat-name' }, colourDot(player.favouriteColour), colourName(player.favouriteColour))],
    ['Joined', player.joined && formatDate(player.joined)],
    ['Registered by', addedBy && byLabel(addedBy)],
  ].filter(([, value]) => value);
  const unfinished = !player.photo || !player.bio || !player.tagline;
  return h('section', { class: 'card card-b about-card' },
    player.bio && h('p', { class: 'bio' }, player.bio),
    h('dl', { class: 'profile-facts' }, facts.map(([label, value]) => h('div', null, h('dt', null, label), h('dd', null, value)))),
    unfinished && h('p', { class: 'field-hint' },
      'Is this you? ',
      h('button', { class: 'link-btn', type: 'button', onClick: () => openPlayerForm(player) }, 'Add a photo, a signature move and more.')));
}

function formCard(details) {
  const { recentForm, streak, longestWinStreak, bestScore, biggestWin } = details;
  const streakText = streak.won
    ? (streak.length > 1 ? `Won the last ${streak.length}` : 'Won their last game')
    : `${plural(streak.length, 'game')} since a win`;
  return h('div', { class: 'card card-b' },
    h('div', { class: 'form-chips' }, recentForm.map((game) => h('button', {
      class: `form-chip ${game.won ? 'won' : ''}`.trim(),
      type: 'button',
      title: `${formatDate(game.date)}: ${ordinal(game.place)} of ${game.size}, ${game.vp} VP`,
      'aria-label': `${formatDate(game.date)}: ${ordinal(game.place)} of ${game.size}, ${game.vp} VP`,
      onClick: () => openGameDetail(game.gameId),
    }, ordinal(game.place)))),
    h('p', { class: 'field-hint' }, `Last ${plural(recentForm.length, 'game')}, oldest first. ${streakText}.`),
    h('dl', { class: 'profile-facts' },
      h('div', null, h('dt', null, 'Best win streak'), h('dd', null, plural(longestWinStreak, 'game'))),
      h('div', null, h('dt', null, 'Highest score'), h('dd', null, `${bestScore} VP`)),
      biggestWin > 0 && h('div', null, h('dt', null, 'Biggest win'), h('dd', null, `by ${biggestWin} VP`))));
}

function rivalryCard(league, details) {
  const { nemesis, favouriteOpponent } = details;
  const person = (row) => playerLink(league.profiles.find((other) => other.id === row.playerId));
  return h('div', { class: 'card card-b' },
    h('dl', { class: 'profile-facts' },
      h('div', null, h('dt', null, 'Nemesis'), h('dd', null, nemesis ? [person(nemesis), `, who has won ${nemesis.theirWins} of their ${plural(nemesis.games, 'game')} together`] : 'Nobody has beaten them yet')),
      h('div', null, h('dt', null, 'Favourite opponent'), h('dd', null, favouriteOpponent ? [person(favouriteOpponent), `, beaten in ${favouriteOpponent.wins} of ${plural(favouriteOpponent.games, 'game')}`] : 'Still looking for one'))));
}

function winRateBars(rows, labelOf) {
  return h('div', { class: 'card card-b' }, barList(rows.map((row) => ({
    label: labelOf(row.key),
    value: row.winRate,
    display: percent(row.winRate),
    detail: `${row.wins} of ${plural(row.games, 'game')}`,
  })), { max: 1 }));
}

function finishesBars(rows, total) {
  return h('div', { class: 'card card-b' }, barList(rows.map((row) => ({
    label: ordinal(row.key),
    value: row.games,
    display: plural(row.games, 'game'),
    detail: percent(row.games / total),
  }))));
}

function honours(league, player, summary, details) {
  const held = records(league.games, league.profiles).filter((record) => record.playerId === player.id);
  const earned = milestonesEarned(summary, details);
  if (!held.length && !earned.length) return null;
  return [
    sectionHeader('Honours', 'League records they hold right now, and milestones they have reached'),
    h('div', { class: 'records honours' },
      held.map((record) => h('div', { class: 'card record' }, h('span', { class: 'record-title' }, icon('trophy'), ' League record'), h('b', null, record.title), h('span', { class: 'muted' }, record.value))),
      earned.map((milestone) => h('div', { class: 'card record' }, h('span', { class: 'record-title' }, 'Milestone'), h('b', null, milestone.title), h('span', { class: 'muted' }, milestone.detail)))),
  ];
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
      eyebrow: [player.nickname, player.active === false ? 'Retired' : null].filter(Boolean).join(' · '),
      title: player.name,
      actions: h('button', { class: 'btn', onClick: () => openPlayerForm(player) }, icon('edit'), 'Edit profile'),
    }));

  if (!summary.games) {
    return page(header, aboutCard(player), emptyState({
      title: `${player.name} has not played yet`,
      message: 'Their record will start with their first logged game.',
    }));
  }

  const hasBonuses = summary.longestRoutes || summary.largestArmies;
  const details = playerDetails(league.games, player.id);
  return page(
    header,
    aboutCard(player),
    h('section', { class: 'kpis' },
      kpi(approach.name, formatScore(standing.score, approach.format), `${ordinal(standing.rank)} in the league`, 'trophy'),
      kpi('Record', `${summary.wins}–${summary.losses}`, `${plural(summary.games, 'game')}, ${percent(summary.winRate)} won`, 'dice'),
      kpi('Average VP', summary.averageVp.toFixed(1), `Average finish: ${summary.averagePlace.toFixed(1)}`, 'chart'),
      hasBonuses ? kpi('Bonus tiles', summary.longestRoutes + summary.largestArmies, `${plural(summary.longestRoutes, 'Longest Route')}, ${summary.largestArmies} Largest Army`, 'scale') : null),
    h('div', { class: 'two-col' },
      h('div', null, sectionHeader('Form'), formCard(details)),
      h('div', null, sectionHeader('Rivalries'), rivalryCard(league, details))),
    honours(league, player, summary, details),
    ratingChart(league, player, approach),
    h('div', { class: 'two-col' },
      h('div', null, sectionHeader('Standing in every system'), standingsTable(league, player)),
      h('div', null,
        sectionHeader('Colours played'), colourSection(league, player))),
    h('div', { class: 'two-col' },
      h('div', null, sectionHeader('Where they finish'), finishesBars(details.finishes, summary.games)),
      h('div', null, sectionHeader('Win rate by table size'), winRateBars(details.byTableSize, (size) => `${size} players`))),
    sectionHeader('Win rate by turn order', 'Where they sat in the turn order, with 1st going first'),
    winRateBars(details.byTurnOrder, (position) => ordinal(position)),
    sectionHeader('Head to head', 'Who they meet the most, and how much the next game with each person counts towards repeat-decay ratings'),
    rivalsTable(league, player),
    sectionHeader('Recent games'),
    recentGames(league, player));
}
