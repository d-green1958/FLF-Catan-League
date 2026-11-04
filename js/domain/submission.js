// How changes travel from the site to the repo:
//   1. The site turns an admin's changes into a pre-filled GitHub issue.
//   2. The admin presses Submit on GitHub, which proves who they are.
//   3. A GitHub Action (scripts/apply-submission.js) checks the issue and commits the changes.
// Both ends use this file, so they always agree on the format and the rules. The site's own checks are
// a convenience: processSubmission() below is the real gatekeeper, and it trusts nothing in the issue.
import { validateDataset } from './validate.js';

export const TITLE_PREFIX = '[League]';
const MARKER = '<!-- flfoxtan-submission -->';

// GitHub refuses new-issue links that are too long. Normal use comes nowhere near this.
const MAX_URL_LENGTH = 7500;
const MAX_ITEMS = 200;

const isId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(value);
const isText = (limit) => (value) => typeof value === 'string' && value.length <= limit;
const isBoolean = (value) => typeof value === 'boolean';
const isInteger = (value) => Number.isInteger(value);

// Every field a record is allowed to have. Anything else is refused.
const PLAYER_FIELDS = {
  id: isId,
  name: isText(60),
  nickname: isText(40),
  tagline: isText(120),
  joined: isText(10),
  favouriteColour: isText(20),
  active: isBoolean,
};
const SEAT_FIELDS = {
  playerId: isId,
  colour: isText(20),
  vp: isInteger,
};
const GAME_FIELDS = {
  id: isId,
  date: isText(10),
  time: isText(5),
  location: isText(80),
  expansions: (value) => Array.isArray(value) && value.every(isId),
  scenario: isText(80),
  vpTarget: isInteger,
  winnerId: isId,
  endedEarly: isBoolean,
  seats: (value) => Array.isArray(value) && value.length <= 8 && value.every((seat) => matchesFields(seat, SEAT_FIELDS)),
  longestRoute: isId,
  largestArmy: isId,
  notes: isText(500),
};

function matchesFields(record, fields) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return false;
  return Object.entries(record).every(([key, value]) => Object.hasOwn(fields, key) && fields[key](value));
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** A short description of the changes, used for the issue title. */
export function describeChanges(changes) {
  const parts = [];
  const add = (count, label) => { if (count) parts.push(label(count)); };
  const newGames = changes.games.saved.length;
  if (newGames === 1) parts.push(`Game on ${changes.games.saved[0].date}`);
  else add(newGames, (count) => plural(count, 'game'));
  add(changes.profiles.saved.length, (count) => plural(count, 'player'));
  add(changes.games.deleted.length, (count) => `delete ${plural(count, 'game')}`);
  add(changes.profiles.deleted.length, (count) => `delete ${plural(count, 'player')}`);
  return parts.join(', ') || 'No changes';
}

/** Builds the link that opens GitHub with the issue filled in. Returns null if it would be too long. */
export function buildIssueLink(repository, changes) {
  const title = `${TITLE_PREFIX} ${describeChanges(changes)}`;
  const body = [
    'Press **Submit** to add this to the league. Only league admins can submit, and the rest is automatic.',
    '',
    MARKER,
    '```json',
    JSON.stringify(changes),
    '```',
  ].join('\n');
  const url = `https://github.com/${repository.owner}/${repository.name}/issues/new`
    + `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return url.length > MAX_URL_LENGTH ? null : { url, title };
}

export function isAdmin(username, admins) {
  const lowered = String(username).toLowerCase();
  return admins.some((admin) => admin.toLowerCase() === lowered);
}

class SubmissionError extends Error {}

function parseChanges(body) {
  const match = String(body).split(MARKER)[1]?.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) throw new SubmissionError('This issue does not contain a league submission. Please send it from the site.');

  let raw;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    throw new SubmissionError('The submission could not be read. It may have been edited before it was submitted.');
  }

  const section = (name, fields, label) => {
    const part = raw?.[name];
    const valid = part && Array.isArray(part.saved) && Array.isArray(part.deleted)
      && part.saved.length + part.deleted.length <= MAX_ITEMS
      && part.deleted.every(isId);
    if (!valid) throw new SubmissionError(`The ${label} section of the submission is not in the expected format.`);
    for (const record of part.saved) {
      if (!matchesFields(record, fields) || !isId(record.id)) {
        throw new SubmissionError(`A ${label} record has a missing, invalid or unrecognised field.`);
      }
    }
    return { saved: part.saved, deleted: part.deleted };
  };
  return { profiles: section('profiles', PLAYER_FIELDS, 'player'), games: section('games', GAME_FIELDS, 'game') };
}

function applyToList(list, { saved, deleted }) {
  const replacements = new Map(saved.map((item) => [item.id, item]));
  const kept = list
    .filter((item) => !deleted.includes(item.id))
    .map((item) => replacements.get(item.id) ?? item);
  const existing = new Set(list.map((item) => item.id));
  return [...kept, ...saved.filter((item) => !existing.has(item.id))];
}

/**
 * Decides what happens to a submitted issue. Nothing is written here: the caller gets the outcome back.
 *   status: 'not-admin' | 'rejected' | 'unchanged' | 'applied'
 */
export function processSubmission({ body, author, profiles, games, league, colours, expansions }) {
  const { admins, settings } = league;
  if (!isAdmin(author, admins)) {
    return {
      status: 'not-admin',
      message: `Only league admins can add results, so nothing has been changed. Please ask one of them to log this: ${admins.join(', ')}.`,
    };
  }

  try {
    const changes = parseChanges(body);
    const known = new Set([...expansions.expansions, ...expansions.extras].map((option) => option.id));
    for (const game of changes.games.saved) {
      const unknown = (game.expansions || []).find((id) => !known.has(id));
      if (unknown) throw new SubmissionError(`"${unknown}" is not a recognised expansion.`);
    }

    const next = { profiles: applyToList(profiles, changes.profiles), games: applyToList(games, changes.games) };
    const issues = validateDataset(next, { colours, settings });
    if (issues.length) {
      throw new SubmissionError(`Nothing has been changed, because the league data would not be valid:\n\n${issues.slice(0, 10).map((issue) => `- ${issue}`).join('\n')}`);
    }

    const unchanged = JSON.stringify(next.profiles) === JSON.stringify(profiles)
      && JSON.stringify(next.games) === JSON.stringify(games);
    return unchanged
      ? { status: 'unchanged', message: 'These changes are already in the league, so there was nothing to add.' }
      : { status: 'applied', message: `Added to the league: ${describeChanges(changes)}. The site will update shortly.`, summary: describeChanges(changes), ...next };
  } catch (error) {
    if (error instanceof SubmissionError) return { status: 'rejected', message: error.message };
    return { status: 'rejected', message: 'The submission could not be processed, so nothing has been changed.' };
  }
}
