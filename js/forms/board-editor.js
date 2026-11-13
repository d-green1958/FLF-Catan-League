// The board editor: tap tiles to set their terrain, tap them again to place number tokens, then tap corners to
// mark everyone's starting settlements. A photo can fill in the tiles first. Used in the game form, and on its
// own to add the board to a game logged earlier.
import { MAX_STARTS, NUMBER_TOKENS, GEOMETRY, HEX_COUNT, TERRAINS, terrainOf } from '../domain/board.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/feedback.js';
import { boardView } from '../ui/board-view.js';
import { openPhotoReader } from '../ui/board-photo-reader.js';

const NUMBERS = [...new Set(NUMBER_TOKENS)];
const countOf = (list, value) => list.filter((item) => item === value).length;

/**
 * players(): the seated players, as [{ playerId, name, colour }] where colour is a CSS colour.
 * Returns { element, refresh, read }. read() gives { board } (null if left blank) or { error }.
 */
export function boardEditor({ initial = null, players }) {
  const state = {
    tiles: initial ? [...initial.tiles] : Array(HEX_COUNT).fill(' '),
    numbers: initial ? [...initial.numbers] : Array(HEX_COUNT).fill(0),
    starts: structuredClone(initial?.starts ?? {}),
    mode: 'tiles',
    terrain: 'F',
    number: 2,
    playerId: null,
    unsure: [],
  };

  const root = h('div', { class: 'board-editor' });

  const filledTiles = () => state.tiles.filter((code) => code !== ' ').length;
  const filledNumbers = () => state.numbers.filter(Boolean).length;
  const tilesLeft = (code) => terrainOf(code).count - countOf(state.tiles, code);
  const numbersLeft = (number) => countOf(NUMBER_TOKENS, number) - countOf(state.numbers, number);
  const seated = () => players().filter((player) => player.playerId);
  const colourOf = (playerId) => seated().find((player) => player.playerId === playerId)?.colour ?? '#888';

  /** After placing a token, move on to the next number that still has tokens left. */
  function nextNumber() {
    if (numbersLeft(state.number) > 0) return;
    const start = NUMBERS.indexOf(state.number);
    const found = [...NUMBERS.slice(start + 1), ...NUMBERS.slice(0, start)].find((number) => numbersLeft(number) > 0);
    if (found) state.number = found;
  }

  function tapHex(index) {
    state.unsure = state.unsure.filter((item) => item !== index);
    if (state.mode === 'tiles') {
      state.tiles[index] = state.tiles[index] === state.terrain ? ' ' : state.terrain;
      if (state.tiles[index] === 'D') state.numbers[index] = 0;
      if (filledTiles() === HEX_COUNT && state.tiles.every((code) => code === ' ' || tilesLeft(code) >= 0) && filledNumbers() === 0) {
        state.mode = 'numbers';
        toast('Tiles done. Now tap each tile to place its number.', 'good');
      } else if (tilesLeft(state.terrain) <= 0) {
        const next = TERRAINS.find((terrain) => tilesLeft(terrain.code) > 0);
        if (next) state.terrain = next.code;
      }
    } else if (state.mode === 'numbers') {
      if (state.tiles[index] === 'D') { toast('The desert has no number.', 'warn'); return; }
      if (state.tiles[index] === ' ') { toast('Set that tile\'s terrain first.', 'warn'); return; }
      state.numbers[index] = state.numbers[index] === state.number ? 0 : state.number;
      nextNumber();
      if (filledNumbers() === HEX_COUNT - 1 && seated().length) {
        state.mode = 'starts';
        state.playerId = seated()[0].playerId;
        toast('Board done. Now mark where everyone started, if you like.', 'good');
      }
    }
    render();
  }

  function tapCorner(corner) {
    const owner = Object.keys(state.starts).find((playerId) => state.starts[playerId].includes(corner));
    if (owner) {
      state.starts[owner] = state.starts[owner].filter((item) => item !== corner);
      if (!state.starts[owner].length) delete state.starts[owner];
      render();
      return;
    }
    if (!state.playerId) { toast('Choose whose settlement it is first.', 'warn'); return; }
    const taken = new Set(Object.values(state.starts).flat());
    if (GEOMETRY.vertices[corner].neighbours.some((other) => taken.has(other))) {
      toast('Too close to another settlement: the distance rule needs a gap of one corner.', 'warn');
      return;
    }
    const mine = state.starts[state.playerId] ?? [];
    if (mine.length >= MAX_STARTS) { toast('They already have two. Tap one to remove it.', 'warn'); return; }
    state.starts[state.playerId] = [...mine, corner];
    // Once someone has both settlements, move on to the next player still to place.
    if (state.starts[state.playerId].length === MAX_STARTS) {
      const next = seated().find((player) => (state.starts[player.playerId]?.length ?? 0) < MAX_STARTS);
      if (next) state.playerId = next.playerId;
    }
    render();
  }

  const modeButton = (id, label) => h('button', {
    type: 'button', 'aria-pressed': String(state.mode === id),
    onClick: () => {
      state.mode = id;
      if (id === 'starts' && !seated().some((player) => player.playerId === state.playerId)) state.playerId = seated()[0]?.playerId ?? null;
      render();
    },
  }, label);

  function palette() {
    if (state.mode === 'tiles') {
      return h('div', { class: 'palette' },
        TERRAINS.map((terrain) => h('button', {
          type: 'button', class: 'swatch-btn', 'aria-pressed': String(state.terrain === terrain.code),
          onClick: () => { state.terrain = terrain.code; render(); },
        }, h('span', { class: 'tile-swatch', style: { background: terrain.colour } }), terrain.name,
        h('span', { class: `left ${tilesLeft(terrain.code) < 0 ? 'over' : ''}`.trim() }, tilesLeft(terrain.code)))),
        h('button', {
          type: 'button', class: 'btn sm photo-btn',
          onClick: () => openPhotoReader({
            onRead: ({ tiles, unsure }) => {
              state.tiles = [...tiles];
              state.numbers = state.numbers.map((number, index) => (tiles[index] === 'D' ? 0 : number));
              state.unsure = unsure;
              render();
              toast(unsure.length
                ? `Tiles read. ${unsure.length} outlined in red are worth a second look.`
                : 'Tiles read. Check them against the board, then tap in the numbers.', 'good');
            },
          }),
        }, icon('camera', 'sm'), 'Read from a photo'));
    }
    if (state.mode === 'numbers') {
      return h('div', { class: 'palette' }, NUMBERS.map((number) => h('button', {
        type: 'button', class: `number-btn ${number === 6 || number === 8 ? 'hot' : ''}`.trim(), 'aria-pressed': String(state.number === number),
        'aria-label': `${number}, ${numbersLeft(number)} left`,
        onClick: () => { state.number = number; render(); },
      }, number, h('span', { class: 'left' }, numbersLeft(number)))));
    }
    const people = seated();
    if (!people.length) return h('p', { class: 'field-hint' }, 'Choose who played first, then mark their settlements here.');
    return h('div', { class: 'palette' }, people.map((player) => h('button', {
      type: 'button', class: 'swatch-btn', 'aria-pressed': String(state.playerId === player.playerId),
      onClick: () => { state.playerId = player.playerId; render(); },
    }, h('span', { class: 'piece-dot', style: { '--piece': player.colour } }), player.name,
    h('span', { class: 'left' }, `${state.starts[player.playerId]?.length ?? 0}/${MAX_STARTS}`))));
  }

  function status() {
    const people = seated();
    const placed = people.filter((player) => (state.starts[player.playerId]?.length ?? 0) === MAX_STARTS).length;
    return h('p', { class: 'field-hint board-status' },
      `Tiles ${filledTiles()}/${HEX_COUNT} · Numbers ${filledNumbers()}/${HEX_COUNT - 1}`,
      people.length ? ` · Openings ${placed}/${people.length}` : '');
  }

  function render() {
    const board = { tiles: state.tiles.join(''), numbers: state.numbers, starts: state.starts };
    const hint = {
      tiles: 'Choose a terrain, then tap the tiles that have it. Tap a tile again to clear it.',
      numbers: 'Choose a number, then tap its tile. It moves on to the next number by itself.',
      starts: 'Choose a player, then tap the corners where they placed their two settlements.',
    }[state.mode];
    root.replaceChildren(
      h('div', { class: 'seg board-modes' }, modeButton('tiles', 'Tiles'), modeButton('numbers', 'Numbers'), modeButton('starts', 'Settlements')),
      h('p', { class: 'field-hint' }, hint),
      palette(),
      boardView(board, {
        colourOf,
        onHex: state.mode === 'starts' ? null : tapHex,
        onCorner: state.mode === 'starts' ? tapCorner : null,
        showCorners: state.mode === 'starts',
        flagged: state.unsure,
        label: 'Board editor',
      }),
      h('div', { class: 'board-foot' },
        status(),
        h('button', {
          type: 'button', class: 'link-btn',
          onClick: () => {
            Object.assign(state, { tiles: Array(HEX_COUNT).fill(' '), numbers: Array(HEX_COUNT).fill(0), starts: {}, mode: 'tiles', unsure: [] });
            render();
          },
        }, 'Clear the board')));
  }

  render();

  return {
    element: root,
    /** Call when the seated players change, so the settlement palette stays right. */
    refresh: () => { if (state.mode === 'starts') render(); },
    read() {
      const blank = filledTiles() === 0 && filledNumbers() === 0 && !Object.keys(state.starts).length;
      if (blank) return { board: null };
      if (filledTiles() < HEX_COUNT || filledNumbers() < HEX_COUNT - 1) {
        return { error: 'Finish the board (every tile and number), or press "Clear the board" to leave it out.' };
      }
      const seatedIds = seated().map((player) => player.playerId);
      const starts = Object.fromEntries(Object.entries(state.starts).filter(([playerId, corners]) => seatedIds.includes(playerId) && corners.length));
      return { board: { tiles: state.tiles.join(''), numbers: [...state.numbers], ...(Object.keys(starts).length ? { starts } : {}) } };
    },
  };
}
