// The rules a player or game must follow before it can be saved.
// Each function returns a list of plain-English problems; an empty list means valid.
import { validateBoard } from './board.js';

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));

// Photos are kept small enough that one fits in a GitHub link, and only real JPEG or WebP pictures are allowed.
export const MAX_PHOTO_CHARS = 4000;
const PHOTO_START = /^data:image\/(?:jpeg;base64,\/9j\/|webp;base64,UklGR)[A-Za-z0-9+/]*={0,2}$/;

export const isPhoto = (value) => typeof value === 'string' && value.length <= MAX_PHOTO_CHARS && PHOTO_START.test(value);

// What anyone can edit on a profile. Name, joining date and retirement stay with the admins, since
// they affect the league itself and could be used to pass one player off as another.
export const PERSONAL_FIELDS = ['nickname', 'tagline', 'bio', 'photo', 'favouriteColour', 'favouriteResource', 'playStyle'];

/** The fields that differ between two versions of a record. A missing field counts the same as an empty one. */
export function changedFields(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key] ?? '') !== JSON.stringify(after[key] ?? ''));
}

export const isPersonalEdit = (before, after) => changedFields(before, after).every((key) => PERSONAL_FIELDS.includes(key));

/** Adding the board to a game that has none changes nothing anyone already entered, so anyone may do it. */
export const addsBoardOnly = (before, after) => !before.board && changedFields(before, after).every((key) => key === 'board');

export function validatePlayer(player, allPlayers = []) {
  const errors = [];
  const name = (player.name || '').trim();
  if (!name) errors.push('Add a name.');
  if (name.length > 60) errors.push('Keep the name to 60 characters or fewer.');
  if (player.joined && !isDate(player.joined)) errors.push('Use a real joining date.');
  if (player.photo && !isPhoto(player.photo)) errors.push('That photo could not be used. Please choose another.');
  if ((player.bio || '').length > 280) errors.push('Keep the "about" section to 280 characters or fewer.');

  const clash = allPlayers.find((other) =>
    other.id !== player.id && other.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) errors.push(`There is already a player called ${clash.name}.`);
  return errors;
}

export function validateGame(game, { profiles = [], colours = [], settings = {} } = {}) {
  const errors = [];
  const { minPlayers = 3, maxPlayers = 6 } = settings;
  const seats = game.seats || [];

  if (!isDate(game.date)) errors.push('Choose the date of the game.');
  if (!Number.isInteger(game.vpTarget) || game.vpTarget < 3 || game.vpTarget > 30) {
    errors.push('Set a victory point target between 3 and 30.');
  }
  if (seats.length < minPlayers || seats.length > maxPlayers) {
    errors.push(`A league game needs ${minPlayers} to ${maxPlayers} players.`);
  }

  const playerIds = seats.map((seat) => seat.playerId).filter(Boolean);
  if (playerIds.length !== seats.length) errors.push('Choose a player for every seat.');
  if (new Set(playerIds).size !== playerIds.length) errors.push('Each player can only sit once.');
  if (playerIds.some((id) => !profiles.some((player) => player.id === id))) {
    errors.push('One of the players is not registered.');
  }

  const colourIds = seats.map((seat) => seat.colour).filter(Boolean);
  if (colourIds.length !== seats.length) errors.push('Choose a colour for every seat.');
  if (new Set(colourIds).size !== colourIds.length) errors.push('Each colour can only be used once.');
  if (colourIds.some((id) => !colours.some((colour) => colour.id === id))) {
    errors.push('One of the colours is not recognised.');
  }

  const validVps = seats.every((seat) => Number.isInteger(seat.vp) && seat.vp >= 0 && seat.vp <= 40);
  if (!validVps) errors.push('Enter a whole number of victory points for every seat.');

  const winner = seats.find((seat) => seat.playerId === game.winnerId);
  if (!game.winnerId || !winner) {
    errors.push('Choose the winner.');
  } else if (validVps) {
    if (seats.some((seat) => seat.vp > winner.vp)) errors.push('The winner cannot have fewer VPs than another player.');
    if (winner.vp < game.vpTarget && !game.endedEarly) {
      errors.push(`The winner has not reached the target of ${game.vpTarget} VPs. Lower the target or tick "Ended early".`);
    }
  }

  for (const [label, holder] of [['Longest Route', game.longestRoute], ['Largest Army', game.largestArmy]]) {
    if (holder && !playerIds.includes(holder)) errors.push(`${label} must be held by someone in the game.`);
  }
  if (game.board !== undefined) errors.push(...validateBoard(game.board, playerIds));
  return errors;
}

/** Checks a whole dataset, for the Save & share page and for imports. */
export function validateDataset({ profiles, games }, reference) {
  const issues = [];
  const seenPlayers = new Set();
  for (const player of profiles) {
    if (!player.id || seenPlayers.has(player.id)) issues.push(`Player "${player.name || '?'}" has a missing or repeated id.`);
    seenPlayers.add(player.id);
    for (const problem of validatePlayer(player, profiles)) issues.push(`${player.name || player.id}: ${problem}`);
  }
  const seenGames = new Set();
  for (const game of games) {
    if (!game.id || seenGames.has(game.id)) issues.push(`A game on ${game.date || '?'} has a missing or repeated id.`);
    seenGames.add(game.id);
    for (const problem of validateGame(game, { profiles, ...reference })) issues.push(`Game ${game.id || '?'}: ${problem}`);
  }
  return issues;
}
