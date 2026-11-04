// The home page: one scoring system in detail, or every system side by side.
import { canEdit } from '../data/access.js';
import { store } from '../data/store.js';
import { settings } from '../data/settings.js';
import { getLeague, leaderboard, selectedApproach } from '../domain/league.js';
import { scoreHistory } from '../ratings/engine.js';
import { openGameForm } from '../forms/game-form.js';
import { openPlayerForm } from '../forms/player-form.js';
import { h, route } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { avatar, changeBadge, emptyState, kpi, page, pageHeader, playerLink, sectionHeader, table } from '../ui/components.js';
import { assignSlots, lineChart } from '../ui/charts.js';
import { formatDate, formatScore, formatShortDate, ordinal, percent, plural } from '../ui/format.js';

const CHART_PLAYERS = 4;

function headerActions() {
  if (!canEdit()) return null;
  return [
    h('button', { class: 'btn', onClick: () => openPlayerForm() }, icon('users'), 'Register player'),
    h('button', { class: 'btn primary', onClick: () => openGameForm() }, icon('plus'), 'Log game'),
  ];
}

function kpiRow(league, approach) {
  const rows = leaderboard(league, approach.id);
  const leader = rows[0];
  const lastGame = league.games.at(-1);
  const active = league.profiles.filter((player) => player.active !== false).length;
  return h('section', { class: 'kpis' },
    kpi('Current leader', leader ? leader.player.name : 'Nobody yet', leader ? `${formatScore(leader.score, approach.format)} on ${approach.name}` : null, 'trophy'),
    kpi('Games played', league.games.length, lastGame ? `Last: ${formatDate(lastGame.date)}` : null, 'dice'),
    kpi('Players', league.profiles.length, `${active} active`, 'users'));
}

function viewToggle() {
  const view = settings.get('view');
  const button = (id, label) => h('button', {
    type: 'button',
    'aria-pressed': String(view === id),
    onClick: () => settings.set('view', id),
  }, label);
  return h('div', { class: 'seg' }, button('single', 'One system'), button('compare', 'Compare all'));
}

function approachSelect(league, approach) {
  const { families } = league.reference;
  return h('select', {
    class: 'select',
    'aria-label': 'Scoring system',
    onChange: (event) => settings.set('approachId', event.target.value),
  }, families.map((family) => {
    const members = league.approaches.filter((entry) => entry.family === family.id);
    return members.length ? h('optgroup', { label: family.name }, members.map((entry) =>
      h('option', { value: entry.id, selected: entry.id === approach.id }, entry.name))) : null;
  }));
}

function retiredToggle() {
  return h('label', { class: 'switch' },
    h('input', {
      type: 'checkbox',
      checked: settings.get('showRetired'),
      onChange: (event) => settings.set('showRetired', event.target.checked),
    }),
    'Show retired');
}

function singleSystem(league, approach) {
  const rows = leaderboard(league, approach.id, { includeRetired: settings.get('showRetired') });
  const columns = [
    { label: 'Rank' },
    { label: 'Player' },
    { label: approach.shortName, align: 'right', title: approach.name },
    { label: 'Last game', align: 'right', title: 'Change from their most recent game' },
    { label: 'Games', align: 'right' },
    { label: 'Wins', align: 'right' },
    { label: 'Win rate', align: 'right' },
    { label: 'Avg VP', align: 'right' },
  ];
  const tableRows = rows.map((row) => ({
    className: row.player.active === false ? 'dim' : null,
    cells: [
      h('span', { class: `rank rank-${row.rank}` }, row.rank),
      h('div', { class: 'who' }, avatar(row.player),
        h('div', null,
          playerLink(row.player),
          row.provisional && h('span', { class: 'badge muted', title: `Fewer than ${league.reference.league.settings.provisionalGames} games` }, 'Provisional'),
          row.player.active === false && h('span', { class: 'badge muted' }, 'Retired'))),
      h('b', { class: 'num' }, formatScore(row.score, approach.format)),
      changeBadge(row.lastChange, approach.format),
      row.summary.games,
      row.summary.wins,
      percent(row.summary.winRate),
      row.summary.averageVp.toFixed(1),
    ],
  }));

  return [
    h('div', { class: 'card' },
      h('div', { class: 'card-h system-note' },
        h('div', null, h('b', null, approach.name), h('p', null, approach.summary)),
        h('a', { class: 'btn ghost sm', href: route(`/scoring#${approach.id}`) }, 'How it works')),
      table(columns, tableRows)),
    historyChart(league, approach, rows),
  ];
}

function historyChart(league, approach, rows) {
  if (league.games.length < 2) return null;
  const top = rows.slice(0, CHART_PLAYERS);
  const slots = assignSlots(top.map((row) => row.playerId), league.profiles.map((player) => player.id));
  return [
    sectionHeader(`How the top ${Math.min(top.length, CHART_PLAYERS)} got here`, approach.name),
    h('div', { class: 'card card-b' }, lineChart({
      series: top.map((row) => ({
        id: row.playerId,
        label: row.player.name,
        slot: slots.get(row.playerId),
        values: scoreHistory(league.runs.get(approach.id), row.playerId),
      })),
      xLabels: league.games.map((game) => formatShortDate(game.date)),
      formatValue: (value) => formatScore(value, approach.format),
      summary: `Line chart of ${approach.name} after each game for ${top.map((row) => row.player.name).join(', ')}. The table above has the current values.`,
    })),
  ];
}

function compareSystems(league) {
  const includeRetired = settings.get('showRetired');
  const players = league.profiles
    .filter((player) => league.summaries.get(player.id).games > 0)
    .filter((player) => includeRetired || player.active !== false);
  const ranksBySystem = new Map(league.approaches.map((entry) => [
    entry.id,
    new Map(leaderboard(league, entry.id, { includeRetired }).map((row) => [row.playerId, row])),
  ]));

  const rows = players.map((player) => {
    const ranks = league.approaches.map((entry) => ranksBySystem.get(entry.id).get(player.id).rank);
    return { player, ranks, average: ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length, best: Math.min(...ranks), worst: Math.max(...ranks) };
  }).sort((a, b) => a.average - b.average);

  const columns = [
    { label: 'Player', sticky: true },
    { label: 'Average', align: 'right', title: 'Average rank across all systems' },
    { label: 'Range', align: 'right', title: 'Best and worst rank across all systems' },
    ...league.approaches.map((entry) => ({ label: entry.shortName, align: 'right', title: entry.name })),
  ];
  const tableRows = rows.map((row) => [
    h('div', { class: 'who' }, avatar(row.player), playerLink(row.player)),
    h('b', { class: 'num' }, row.average.toFixed(1)),
    h('span', { class: 'nowrap' }, `${ordinal(row.best)}–${ordinal(row.worst)}`),
    ...league.approaches.map((entry, index) => {
      const score = ranksBySystem.get(entry.id).get(row.player.id).score;
      return h('span', {
        class: `rank-cell ${row.ranks[index] === 1 ? 'first' : ''}`.trim(),
        title: `${entry.name}: ${formatScore(score, entry.format)}`,
      }, row.ranks[index]);
    }),
  ]);

  return h('div', { class: 'card compare' },
    h('div', { class: 'card-h system-note' },
      h('div', null,
        h('b', null, 'Rank under every system'),
        h('p', null, 'A wide range means your position depends heavily on how you score the league. Hover over a rank to see the score.'))),
    table(columns, tableRows));
}

function welcome() {
  return emptyState({
    title: 'The league starts here',
    message: canEdit()
      ? 'No games have been logged yet. Register the players, log your first game and the leaderboards will fill themselves in. To see the site with data first, try the demo: it uses made-up players and leaves the real league untouched.'
      : 'No games have been logged yet. The leaderboards will fill themselves in as league admins add results. To see how it will look, try the demo: it uses made-up players and leaves the real league untouched.',
    actions: [
      h('button', { class: 'btn', onClick: () => store.enterDemo() }, icon('flask'), 'Try the demo'),
      headerActions(),
    ],
  });
}

export function renderLeaderboard() {
  const league = getLeague();
  const { shortName, tagline } = league.reference.league;
  const header = pageHeader({
    eyebrow: tagline,
    title: 'Leaderboard',
    intro: league.games.length
      ? `${plural(league.games.length, 'game')} so far, scored ${league.approaches.length} different ways.`
      : `Welcome to ${shortName}.`,
    actions: headerActions(),
  });
  if (!league.games.length) return page(header, welcome());

  const approach = selectedApproach(league);
  const view = settings.get('view');
  return page(
    header,
    kpiRow(league, approach),
    h('div', { class: 'toolbar spaced' },
      viewToggle(),
      view === 'single' && approachSelect(league, approach),
      h('span', { class: 'spacer' }),
      retiredToggle()),
    view === 'compare' ? compareSystems(league) : singleSystem(league, approach));
}
