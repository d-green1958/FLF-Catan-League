// The rules a player or game must follow before it can be saved.
// Each function returns a list of plain-English problems; an empty list means valid.

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));

export function validatePlayer(player, allPlayers = []) {
  const errors = [];
  const name = (player.name || '').trim();
  if (!name) errors.push('Add a name.');
  if (name.length > 60) errors.push('Keep the name to 60 characters or fewer.');
  if (player.joined && !isDate(player.joined)) errors.push('Use a real joining date.');

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
