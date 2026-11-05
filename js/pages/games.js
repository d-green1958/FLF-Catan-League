// The game log, with filters and a detail panel for each game.
import { canManage, finishChange } from '../data/access.js';
import { store } from '../data/store.js';
import { getLeague, nameOf, selectedApproach } from '../domain/league.js';
import { winnerSeat } from '../domain/games.js';
import { openGameForm } from '../forms/game-form.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { changeBadge, colourDot, colourName, emptyState, page, pageHeader, playerLink, table } from '../ui/components.js';
import { confirmAction, openDrawer } from '../ui/feedback.js';
import { addedByLabel, formatDate, formatLongDate, formatScore, ordinal, plural } from '../ui/format.js';

// Filters survive a re-render, such as after logging a game.
const filters = { playerId: '', expansionId: '', search: '' };

export function expansionNames(game, catalogue) {
  const options = [...catalogue.expansions, ...catalogue.extras];
  return game.expansions.map((id) => options.find((option) => option.id === id)?.name ?? id);
}

function tableTags(game, catalogue) {
  return [
    ...expansionNames(game, catalogue).map((name) => h('span', { class: 'badge accent' }, name)),
    game.scenario && h('span', { class: 'badge' }, game.scenario),
    game.size >= 5 && h('span', { class: 'badge' }, '5–6 extension'),
    game.endedEarly && h('span', { class: 'badge warn' }, icon('clock', 'sm'), 'Ended early'),
  ];
}

export function openGameDetail(gameId) {
  const league = getLeague();
  const game = league.games.find((item) => item.id === gameId);
  if (!game) return;
  const approach = selectedApproach(league);
  const timelineEntry = league.runs.get(approach.id).timeline.find((entry) => entry.gameId === game.id);
  const changeOf = (playerId) => timelineEntry.changes.find((row) => row.playerId === playerId);
  const catalogue = league.reference.expansions;

  openDrawer(formatLongDate(game.date), (close) => {
    const remove = async () => {
      const confirmed = await confirmAction({
        title: 'Delete this game?',
        message: `This removes the game from ${formatDate(game.date)} and recalculates every rating without it.`,
        confirmLabel: 'Delete game',
        danger: true,
      });
      if (!confirmed) return;
      store.deleteGame(game.id);
      finishChange('Game deleted. Ratings recalculated.');
      close();
    };

    const finishing = [...game.seats].sort((a, b) => a.place - b.place);
    const addition = store.additionFor('game', game.id);
    return h('div', { class: 'detail' },
      h('p', { class: 'detail-meta' },
        [game.time, game.location].filter(Boolean).join(' · ') || null),
      h('div', { class: 'tags' }, tableTags(game, catalogue)),
      h('p', { class: 'field-hint' }, `Target: ${game.vpTarget} VP. Rating changes shown for ${approach.name}.`),
      table(
        [{ label: 'Place' }, { label: 'Player' }, { label: 'Turn', align: 'right' }, { label: 'VP', align: 'right' }, { label: 'Change', align: 'right' }],
        finishing.map((seat) => [
          seat.isWinner ? h('span', { class: 'winner-mark' }, icon('trophy', 'sm'), '1st') : ordinal(seat.place),
          h('span', { class: 'seat-name' }, colourDot(seat.colour), playerLink(league.profiles.find((player) => player.id === seat.playerId)), h('span', { class: 'muted' }, colourName(seat.colour))),
          seat.turnOrder,
          h('b', { class: 'num' }, seat.vp),
          changeBadge(changeOf(seat.playerId).change, approach.format),
        ]),
      ),
      (game.longestRoute || game.largestArmy) && h('ul', { class: 'plain-list' },
        game.longestRoute && h('li', null, 'Longest Route: ', nameOf(league, game.longestRoute)),
        game.largestArmy && h('li', null, 'Largest Army: ', nameOf(league, game.largestArmy))),
      game.notes && h('p', { class: 'notes' }, game.notes),
      addition && h('p', { class: 'field-hint' }, `Added by ${addedByLabel(addition)} on ${formatDate(addition.addedAt.slice(0, 10))}.`),
      canManage() && h('div', { class: 'form-acts' },
        h('button', { class: 'btn ghost danger', type: 'button', onClick: remove }, icon('trash'), 'Delete'),
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn primary', type: 'button',
          onClick: () => { close(); openGameForm(store.game(game.id)); },
        }, icon('edit'), 'Correct this game')));
  });
}

function matchesFilters(game, league) {
  if (filters.playerId && !game.seats.some((seat) => seat.playerId === filters.playerId)) return false;
  if (filters.expansionId === 'base-only' && game.expansions.length) return false;
  if (filters.expansionId && filters.expansionId !== 'base-only' && !game.expansions.includes(filters.expansionId)) return false;
  if (filters.search) {
    const text = [game.date, game.location, game.scenario, game.notes, ...game.seats.map((seat) => nameOf(league, seat.playerId))]
      .filter(Boolean).join(' ').toLowerCase();
    if (!text.includes(filters.search.toLowerCase())) return false;
  }
  return true;
}

function seatChip(seat, league) {
  return h('span', { class: `chip ${seat.isWinner ? 'won' : ''}`.trim() },
    colourDot(seat.colour),
    nameOf(league, seat.playerId),
    h('span', { class: 'chip-vp' }, seat.vp));
}

function filterBar(league, count, rerender) {
  const catalogue = league.reference.expansions;
  const usedExpansions = [...catalogue.expansions, ...catalogue.extras]
    .filter((option) => league.games.some((game) => game.expansions.includes(option.id)));
  return h('div', { class: 'toolbar' },
    h('input', {
      class: 'input grow', type: 'search', placeholder: 'Search players, places, notes…', 'aria-label': 'Search games',
      value: filters.search,
      onInput: (event) => { filters.search = event.target.value; rerender(); },
    }),
    h('select', {
      class: 'select', 'aria-label': 'Filter by player',
      onChange: (event) => { filters.playerId = event.target.value; rerender(); },
    },
      h('option', { value: '' }, 'All players'),
      [...league.profiles].sort((a, b) => a.name.localeCompare(b.name)).map((player) =>
        h('option', { value: player.id, selected: filters.playerId === player.id }, player.name))),
    h('select', {
      class: 'select', 'aria-label': 'Filter by expansion',
      onChange: (event) => { filters.expansionId = event.target.value; rerender(); },
    },
      h('option', { value: '' }, 'All setups'),
      h('option', { value: 'base-only', selected: filters.expansionId === 'base-only' }, 'Base game only'),
      usedExpansions.map((option) => h('option', { value: option.id, selected: filters.expansionId === option.id }, option.name))),
    h('span', { class: 'count', 'data-count': true }, plural(count, 'game')));
}

function gameTable(games, league) {
  const catalogue = league.reference.expansions;
  const newestFirst = [...games].reverse();
  return h('div', { class: 'card' }, table(
    [{ label: 'Date' }, { label: 'Winner' }, { label: 'Players, in turn order (with VPs)' }, { label: 'Setup' }, { label: '' }],
    newestFirst.map((game) => {
      const winner = winnerSeat(game);
      return [
        h('span', { class: 'nowrap' }, formatDate(game.date)),
        h('b', { class: 'nowrap' }, nameOf(league, winner.playerId)),
        h('div', { class: 'chips' }, game.seats.map((seat) => seatChip(seat, league))),
        h('div', { class: 'tags' }, tableTags(game, catalogue).filter(Boolean).length ? tableTags(game, catalogue) : h('span', { class: 'muted' }, 'Base game')),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': `Open the game from ${formatDate(game.date)}`, onClick: () => openGameDetail(game.id) }, 'Details'),
      ];
    }),
  ));
}

export function renderGames() {
  const league = getLeague();
  const logButton = () => h('button', { class: 'btn primary', onClick: () => openGameForm() }, icon('plus'), 'Log game');
  const header = pageHeader({
    eyebrow: 'The record',
    title: 'Games',
    intro: 'Every league game, newest first. Corrections recalculate all the ratings that come after them.',
    actions: logButton(),
  });

  if (!league.games.length) {
    return page(header, emptyState({
      title: 'No games yet',
      message: 'Log your first game and it will appear here.',
      actions: logButton(),
    }));
  }

  // A filter can go stale, such as when leaving demo mode. Clear it so it never hides games invisibly.
  if (!league.profiles.some((player) => player.id === filters.playerId)) filters.playerId = '';
  if (filters.expansionId !== 'base-only' && !league.games.some((game) => game.expansions.includes(filters.expansionId))) filters.expansionId = '';

  // Filtering redraws only the results, so the search box keeps its focus while typing.
  const results = h('div');
  const shell = h('div');
  const rerender = () => {
    const visible = league.games.filter((game) => matchesFilters(game, league));
    shell.querySelector('[data-count]').textContent = plural(visible.length, 'game');
    results.replaceChildren(visible.length
      ? gameTable(visible, league)
      : emptyState({ title: 'No matching games', message: 'Try removing a filter.' }));
  };
  shell.append(filterBar(league, 0, rerender), results);
  rerender();
  return page(header, shell);
}
