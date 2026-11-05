// Log a new game, or correct an existing one. Seats are entered in turn order.
import { finishChange } from '../data/access.js';
import { store } from '../data/store.js';
import { validateGame, validatePlayer } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { errorList, field } from '../ui/components.js';
import { openDrawer, toast } from '../ui/feedback.js';
import { today } from '../ui/format.js';

const blankSeat = () => ({ playerId: '', colour: '', vp: '' });

/** The usual target for the chosen expansions: the highest default, or the base game's 10. */
function suggestedTarget(selected, catalogue) {
  const defaults = catalogue.expansions
    .filter((expansion) => selected.includes(expansion.id) && expansion.defaultVp)
    .map((expansion) => expansion.defaultVp);
  return Math.max(catalogue.base.defaultVp, ...defaults);
}

export function openGameForm(existing = null, { onSaved } = {}) {
  openDrawer(existing ? 'Correct this game' : 'Log a game', (close) => {
    const { colours, expansions: catalogue, league } = store.reference();
    const { minPlayers, maxPlayers } = league.settings;

    const state = {
      seats: existing ? existing.seats.map((seat) => ({ ...seat })) : Array.from({ length: Math.min(4, maxPlayers) }, blankSeat),
      winnerId: existing?.winnerId ?? '',
      winnerChosenByHand: Boolean(existing),
      targetChosenByHand: Boolean(existing),
      expansions: [...(existing?.expansions ?? [])],
    };

    const errorHolder = h('div');
    const date = h('input', { class: 'input', type: 'date', value: existing?.date ?? today() });
    const time = h('input', { class: 'input', type: 'time', value: existing?.time ?? '' });
    const location = h('input', { class: 'input', maxlength: 80, autocomplete: 'off', value: existing?.location ?? '' });
    const scenario = h('input', { class: 'input', list: 'scenario-options', maxlength: 80, autocomplete: 'off', value: existing?.scenario ?? '' });
    const scenarioOptions = h('datalist', { id: 'scenario-options' });
    const vpTarget = h('input', {
      class: 'input', type: 'number', min: 3, max: 30, step: 1,
      value: existing?.vpTarget ?? catalogue.base.defaultVp,
      onInput: () => { state.targetChosenByHand = true; },
    });
    const vpNote = h('span', { class: 'field-hint' });
    const endedEarly = h('input', { type: 'checkbox', checked: Boolean(existing?.endedEarly) });
    const notes = h('textarea', { class: 'input', rows: 2, maxlength: 500 }, existing?.notes ?? '');
    const longestRoute = h('select', { class: 'select' });
    const largestArmy = h('select', { class: 'select' });
    const largestArmyField = field('Largest Army', largestArmy);
    const seatsHolder = h('div', { class: 'seats' });
    const extensionNote = h('p', { class: 'field-hint' });

    const selectedExpansions = () => catalogue.expansions.filter((expansion) => state.expansions.includes(expansion.id));

    function refreshExpansionHints() {
      const chosen = selectedExpansions();
      vpNote.textContent = chosen.filter((expansion) => expansion.vpNote).map((expansion) => `${expansion.name}: ${expansion.vpNote}`).join(' ');
      scenarioOptions.replaceChildren(...chosen.flatMap((expansion) => expansion.scenarios || []).map((name) => h('option', { value: name })));
      if (!state.targetChosenByHand) vpTarget.value = suggestedTarget(state.expansions, catalogue);
      const noArmy = chosen.some((expansion) => expansion.noLargestArmy);
      largestArmyField.hidden = noArmy;
      if (noArmy) largestArmy.value = '';
    }

    /** Keeps everything that depends on the seats up to date, without rebuilding inputs mid-typing. */
    function refreshDerived() {
      if (!state.winnerChosenByHand) {
        const scored = state.seats.filter((seat) => seat.playerId && Number.isInteger(seat.vp));
        const top = Math.max(-1, ...scored.map((seat) => seat.vp));
        const leaders = scored.filter((seat) => seat.vp === top);
        state.winnerId = leaders.length === 1 ? leaders[0].playerId : '';
      }
      seatsHolder.querySelectorAll('[data-seat]').forEach((row) => {
        const index = Number(row.dataset.seat);
        const seat = state.seats[index];
        const playerSelect = row.querySelector('[data-role=player]');
        const colourSelect = row.querySelector('[data-role=colour]');
        const winner = row.querySelector('[data-role=winner]');
        for (const option of playerSelect.options) {
          option.disabled = Boolean(option.value) && option.value !== seat.playerId && state.seats.some((other) => other.playerId === option.value);
        }
        for (const option of colourSelect.options) {
          option.disabled = Boolean(option.value) && option.value !== seat.colour && state.seats.some((other) => other.colour === option.value);
        }
        winner.disabled = !seat.playerId;
        winner.checked = Boolean(seat.playerId) && seat.playerId === state.winnerId;
        row.classList.toggle('is-winner', winner.checked);
      });

      for (const select of [longestRoute, largestArmy]) {
        const previous = select.value;
        select.replaceChildren(
          h('option', { value: '' }, 'Nobody / not noted'),
          state.seats.filter((seat) => seat.playerId).map((seat) => h('option', { value: seat.playerId }, store.player(seat.playerId)?.name)),
        );
        select.value = state.seats.some((seat) => seat.playerId === previous) ? previous : '';
      }

      const count = state.seats.length;
      extensionNote.textContent = count >= 5
        ? `${count} players: you will need the 5–6 player extension for this game.`
        : count === 3 ? 'The official rules leave out the white pieces in a 3-player game.' : '';
      addSeatButton.disabled = count >= maxPlayers;
    }

    function availableColour() {
      return colours.find((colour) => !state.seats.some((seat) => seat.colour === colour.id))?.id ?? '';
    }

    function seatRow(seat, index) {
      const playerSelect = h('select', {
        class: 'select', 'data-role': 'player', 'aria-label': `Seat ${index + 1} player`,
        onChange: (event) => {
          seat.playerId = event.target.value;
          const preferred = store.player(seat.playerId)?.favouriteColour;
          if (!seat.colour) {
            const preferredFree = preferred && !state.seats.some((other) => other.colour === preferred);
            seat.colour = preferredFree ? preferred : availableColour();
            colourSelect.value = seat.colour;
          }
          refreshDerived();
        },
      },
        h('option', { value: '' }, 'Player'),
        [...store.profiles()]
          .filter((player) => player.active !== false || player.id === seat.playerId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((player) => h('option', { value: player.id, selected: player.id === seat.playerId }, player.name)));

      const colourSelect = h('select', {
        class: 'select', 'data-role': 'colour', 'aria-label': `Seat ${index + 1} colour`,
        onChange: (event) => { seat.colour = event.target.value; refreshDerived(); },
      },
        h('option', { value: '' }, 'Colour'),
        colours.map((colour) => h('option', { value: colour.id, selected: colour.id === seat.colour }, colour.name)));

      const vp = h('input', {
        class: 'input vp', type: 'number', min: 0, max: 40, step: 1, inputmode: 'numeric', placeholder: 'VP',
        'aria-label': `Seat ${index + 1} victory points`, value: seat.vp,
        onInput: (event) => {
          seat.vp = event.target.value === '' ? '' : Number(event.target.value);
          refreshDerived();
        },
      });

      const winner = h('input', {
        type: 'radio', name: 'winner', 'data-role': 'winner', 'aria-label': `Seat ${index + 1} won`,
        onChange: () => { state.winnerId = seat.playerId; state.winnerChosenByHand = true; refreshDerived(); },
      });

      const move = (direction) => {
        const target = index + direction;
        if (target < 0 || target >= state.seats.length) return;
        [state.seats[index], state.seats[target]] = [state.seats[target], state.seats[index]];
        renderSeats();
      };

      return h('div', { class: 'seat', 'data-seat': index },
        h('span', { class: 'seat-no', title: 'Turn order' }, index + 1),
        playerSelect, colourSelect, vp,
        h('label', { class: 'seat-win', title: 'Winner' }, winner, icon('trophy', 'sm')),
        h('div', { class: 'seat-tools' },
          h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Move seat ${index + 1} earlier`, disabled: index === 0, onClick: () => move(-1) }, icon('up', 'sm')),
          h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Move seat ${index + 1} later`, disabled: index === state.seats.length - 1, onClick: () => move(1) }, icon('down', 'sm')),
          h('button', {
            class: 'icon-btn sm', type: 'button', 'aria-label': `Remove seat ${index + 1}`,
            disabled: state.seats.length <= minPlayers,
            onClick: () => {
              state.seats.splice(index, 1);
              if (seat.playerId === state.winnerId) { state.winnerId = ''; state.winnerChosenByHand = false; }
              renderSeats();
            },
          }, icon('x', 'sm'))));
    }

    function renderSeats() {
      seatsHolder.replaceChildren(...state.seats.map(seatRow));
      refreshDerived();
    }

    const addSeatButton = h('button', {
      class: 'btn sm', type: 'button',
      onClick: () => { if (state.seats.length < maxPlayers) { state.seats.push(blankSeat()); renderSeats(); } },
    }, icon('plus', 'sm'), 'Add seat');

    // Lets someone register a newcomer without losing the game they are part-way through logging.
    const newPlayerName = h('input', { class: 'input', placeholder: 'New player name', maxlength: 60, autocomplete: 'off', 'aria-label': 'New player name' });
    const addNewPlayer = () => {
      const player = { name: newPlayerName.value.trim(), joined: date.value || today(), active: true };
      const problems = validatePlayer(player, store.profiles());
      errorHolder.replaceChildren(...[errorList(problems)].filter(Boolean));
      if (problems.length) return;
      const saved = store.savePlayer(player);
      newPlayerName.value = '';
      const emptySeat = state.seats.find((seat) => !seat.playerId);
      if (emptySeat) {
        emptySeat.playerId = saved.id;
        emptySeat.colour = emptySeat.colour || availableColour();
      }
      renderSeats();
      toast(`${saved.name} registered`, 'good');
    };
    newPlayerName.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); addNewPlayer(); }
    });

    const expansionChoice = (expansion) => h('label', { class: 'check' },
      h('input', {
        type: 'checkbox', checked: state.expansions.includes(expansion.id),
        onChange: (event) => {
          state.expansions = event.target.checked
            ? [...state.expansions, expansion.id]
            : state.expansions.filter((id) => id !== expansion.id);
          refreshExpansionHints();
        },
      }),
      expansion.name);

    const submit = (event) => {
      event.preventDefault();
      const game = {
        ...(existing ? { id: existing.id } : {}),
        date: date.value,
        ...(time.value ? { time: time.value } : {}),
        ...(location.value.trim() ? { location: location.value.trim() } : {}),
        expansions: state.expansions,
        ...(scenario.value.trim() ? { scenario: scenario.value.trim() } : {}),
        vpTarget: Number(vpTarget.value),
        winnerId: state.winnerId,
        ...(endedEarly.checked ? { endedEarly: true } : {}),
        seats: state.seats.map((seat) => ({ playerId: seat.playerId, colour: seat.colour, vp: seat.vp === '' ? null : seat.vp })),
        ...(longestRoute.value ? { longestRoute: longestRoute.value } : {}),
        ...(largestArmy.value ? { largestArmy: largestArmy.value } : {}),
        ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
      };
      const errors = validateGame(game, { profiles: store.profiles(), colours, settings: league.settings });
      errorHolder.replaceChildren(...[errorList(errors)].filter(Boolean));
      if (errors.length) {
        errorHolder.scrollIntoView({ block: 'nearest' });
        return;
      }
      const saved = store.saveGame(game);
      finishChange(existing ? 'Game corrected. Ratings recalculated.' : 'Game logged. Ratings updated.');
      close();
      onSaved?.(saved);
    };

    const form = h('form', { class: 'form', onSubmit: submit, novalidate: true },
      errorHolder,
      h('div', { class: 'form-row' }, field('Date', date), field('Start time (optional)', time)),
      field('Location (optional)', location),

      h('fieldset', { class: 'group' },
        h('legend', null, 'Who played?'),
        h('p', { class: 'field-hint' }, 'List the seats in turn order, with the first player at the top. Tick the trophy for the winner: it fills in by itself from the highest VPs.'),
        seatsHolder,
        extensionNote,
        h('div', { class: 'seat-add' },
          addSeatButton,
          h('div', { class: 'new-player' },
            newPlayerName,
            h('button', { class: 'btn sm', type: 'button', onClick: addNewPlayer }, 'Register')))),

      h('fieldset', { class: 'group' },
        h('legend', null, 'What was on the table?'),
        h('p', { class: 'field-hint' }, 'The base game is always in play. Tick anything added to it.'),
        h('div', { class: 'checks' }, catalogue.expansions.map(expansionChoice)),
        h('details', null,
          h('summary', null, 'Other official additions'),
          h('div', { class: 'checks' }, catalogue.extras.map(expansionChoice)))),
      field('Scenario or variant (optional)', scenario),
      scenarioOptions,
      h('div', { class: 'field' },
        h('label', { class: 'field-label' }, 'Victory point target', vpTarget),
        vpNote),
      h('label', { class: 'switch' }, endedEarly, 'Ended early (lunch ran out before anyone reached the target)'),

      h('fieldset', { class: 'group' },
        h('legend', null, 'Extras (optional)'),
        h('div', { class: 'form-row' }, field('Longest Route', longestRoute), largestArmyField),
        field('Notes', notes)),

      store.mode() !== 'demo' && h('p', { class: 'field-hint' }, 'Next, GitHub opens with this game filled in, and you press Submit to confirm it. You need a free GitHub account, and your username is shown next to the game.'),
      h('div', { class: 'form-acts' },
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onClick: close }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save correction' : 'Log game')));

    renderSeats();
    longestRoute.value = existing?.longestRoute ?? '';
    largestArmy.value = existing?.largestArmy ?? '';
    refreshExpansionHints();
    return form;
  });
}
