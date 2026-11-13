// League-wide statistics: colours, turn order, table sizes, expansions, pairings and records.
import { getLeague, nameOf, paramsFor } from '../domain/league.js';
import { colourStats, expansionStats, pairStats, records, tableSizeStats, turnOrderStats } from '../domain/stats.js';
import { RESOURCE_NAMES, TERRAINS, openingStats } from '../domain/board.js';
import { h } from '../ui/dom.js';
import { colourDot, emptyState, kpi, page, pageHeader, playerLink, sectionHeader, table } from '../ui/components.js';
import { barList } from '../ui/charts.js';
import { ordinal, percent, plural } from '../ui/format.js';

const MOST_PLAYED_PAIRS = 8;

function recordsGrid(league) {
  return h('div', { class: 'records' }, records(league.games, league.profiles).map((record) =>
    h('div', { class: 'card record' },
      h('span', { class: 'record-title' }, record.title),
      h('b', null, record.value),
      playerLink(league.profiles.find((player) => player.id === record.playerId)))));
}

function colourCard(league) {
  const rows = colourStats(league.games, league.reference.colours)
    .filter((row) => row.games > 0)
    .sort((a, b) => b.winRate - a.winRate);
  return h('div', { class: 'card card-b' }, barList(rows.map((row) => ({
    lead: colourDot(row.id),
    label: row.name,
    value: row.winRate,
    display: percent(row.winRate),
    detail: `${row.wins} of ${row.games}`,
  }))));
}

function turnOrderCard(league) {
  const rows = turnOrderStats(league.games);
  return h('div', { class: 'card card-b' },
    barList(rows.map((row) => ({
      label: `${ordinal(row.position)} to play`,
      value: row.winRate,
      display: percent(row.winRate),
      detail: `chance: ${percent(row.expectedRate)}`,
    })), { max: Math.max(...rows.map((row) => Math.max(row.winRate, row.expectedRate))) }));
}

function tableSizeCard(league) {
  return h('div', { class: 'card card-b' }, barList(tableSizeStats(league.games).map((row) => ({
    label: `${row.size} players`,
    value: row.games,
    display: plural(row.games, 'game'),
  }))));
}

function setupCard(league) {
  return h('div', { class: 'card card-b' }, barList(expansionStats(league.games, league.reference.expansions).map((row) => ({
    label: row.name,
    value: row.games,
    display: plural(row.games, 'game'),
  }))));
}

/** A grid showing how often each pair has shared a table. Darker means more often. */
function pairMatrix(league, pairs) {
  const players = league.profiles.filter((player) => pairs.some((pair) => pair.players.includes(player.id)));
  if (!players.length) return null;
  const countFor = (a, b) => pairs.find((pair) => pair.players.includes(a) && pair.players.includes(b))?.games ?? 0;
  const most = Math.max(...pairs.map((pair) => pair.games));

  return h('div', { class: 'card matrix-card', tabindex: '0' },
    h('table', { class: 'matrix' },
      h('thead', null, h('tr', null,
        h('td'),
        players.map((player) => h('th', { scope: 'col', title: player.name }, h('span', null, player.name))))),
      h('tbody', null, players.map((rowPlayer) => h('tr', null,
        h('th', { scope: 'row' }, rowPlayer.name),
        players.map((columnPlayer) => {
          if (rowPlayer.id === columnPlayer.id) return h('td', { class: 'self' });
          const count = countFor(rowPlayer.id, columnPlayer.id);
          const pair = pairs.find((item) => item.players.includes(rowPlayer.id) && item.players.includes(columnPlayer.id));
          return h('td', {
            class: `cell ${most && count / most > 0.55 ? 'strong' : ''}`.trim(),
            style: { '--amount': most ? (count / most).toFixed(3) : 0 },
            title: `${rowPlayer.name} and ${columnPlayer.name}: ${plural(count, 'game')} together${pair ? `, next game counts ${percent(pair.influence)}` : ''}`,
          }, count || '');
        }))))));
}

/** What the recorded boards say about starting placements. Shown once any game has everyone's opening. */
function openingsSection(league) {
  const stats = openingStats(league.games);
  if (!stats.games) return null;
  const top = Math.max(...stats.resources.flatMap((row) => [row.winners, row.others]));
  return [
    sectionHeader('Openings', `From ${plural(stats.games, 'game')} with the board and everyone's starting settlements recorded`),
    h('section', { class: 'kpis' },
      kpi('Strongest opening won', `${stats.strongestWon} of ${stats.games}`, `${percent(stats.strongestWon / stats.games)} of games`, 'trophy'),
      kpi('Winners started on', `${stats.winnerPips.toFixed(1)} pips`, `Everyone else: ${stats.otherPips.toFixed(1)}`, 'hex'),
      kpi('Winners touched', `${stats.winnerVariety.toFixed(1)} resources`, `Everyone else: ${stats.otherVariety.toFixed(1)} of 5`, 'scale')),
    h('div', { class: 'two-col' },
      h('div', null,
        sectionHeader('What winners started on', 'Average pips per resource'),
        h('div', { class: 'card card-b' }, barList(stats.resources.flatMap((row) => [
          { lead: h('span', { class: `res-dot res-${row.resource}` }), label: `${RESOURCE_NAMES[row.resource]}, winners`, value: row.winners, display: row.winners.toFixed(1), colour: TERRAINS.find((terrain) => terrain.resource === row.resource).colour },
          { lead: h('span', { class: 'res-dot faded' }), label: 'everyone else', value: row.others, display: row.others.toFixed(1), colour: 'var(--border-strong)' },
        ]), { max: top }))),
      h('div', null,
        sectionHeader('Openers', 'Average starting pips, and the resource each player leans on'),
        h('div', { class: 'card' }, table(
          [{ label: 'Player' }, { label: 'Pips', align: 'right' }, { label: 'Leans on' }, { label: 'Games', align: 'right', optional: true }],
          stats.players.map((row) => [
            playerLink(league.profiles.find((player) => player.id === row.playerId)),
            h('b', { class: 'num' }, row.averagePips.toFixed(1)),
            h('span', { class: `res-chip res-${row.favourite}` }, RESOURCE_NAMES[row.favourite]),
            row.games,
          ]),
        )))),
  ];
}

export function renderInsights() {
  const league = getLeague();
  const header = pageHeader({
    eyebrow: 'The numbers',
    title: 'Insights',
    intro: 'Is orange really lucky? Does going first help? Who keeps playing the same people?',
  });
  if (!league.games.length) {
    return page(header, emptyState({ title: 'Nothing to show yet', message: 'Insights appear once there are games to study.' }));
  }

  const halfLife = paramsFor(league.reference.approaches.find((entry) => entry.id === 'elo-repeat-decay')).halfLife;
  const pairs = pairStats(league.games, halfLife);

  return page(
    header,
    sectionHeader('Records'),
    recordsGrid(league),
    openingsSection(league),
    h('div', { class: 'two-col' },
      h('div', null, sectionHeader('Win rate by colour'), colourCard(league)),
      h('div', null, sectionHeader('Win rate by turn order', '"Chance" is the rate you would expect from table size alone'), turnOrderCard(league)),
      h('div', null, sectionHeader('Table sizes'), tableSizeCard(league)),
      h('div', null, sectionHeader('Setups played'), setupCard(league))),
    sectionHeader('Who plays with whom', 'Number of games each pair has shared. Darker means more often.'),
    pairMatrix(league, pairs),
    sectionHeader('Most-repeated pairings', `With a half-life of ${plural(halfLife, 'game')}, repeat games count for less and less`),
    h('div', { class: 'card' }, table(
      [{ label: 'Pair' }, { label: 'Games together', align: 'right' }, { label: 'Their next game counts', align: 'right' }],
      pairs.slice(0, MOST_PLAYED_PAIRS).map((pair) => [
        `${nameOf(league, pair.players[0])} and ${nameOf(league, pair.players[1])}`,
        pair.games,
        percent(pair.influence),
      ]),
    )));
}
