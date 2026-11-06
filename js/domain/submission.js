// How changes travel from the site to the repo:
//   1. The site turns someone's changes into a pre-filled GitHub issue.
//   2. They press Submit on GitHub, which records who sent it.
//   3. A GitHub Action (scripts/apply-submission.js) checks the issue and commits the changes.
//
// Anyone can add new players and games, and edit the personal details on a profile. Changing or removing
// anything else needs the admin code, proved by a signature (see admin-key.js).
//
// People with the group password skip steps 1 and 2: the site opens the issue for them using the repo
// owner's token (see group-access.js), and they give their name. The same rules apply. Admins who have
// entered the code skip them too, as the code also opens a copy of that token.
//
// Both ends use this file, so they always agree on the format and the rules. The site's own checks are
// a convenience: processSubmission() below is the real gatekeeper, and it trusts nothing in the issue.
import { checkAuthorisation } from './admin-key.js';
import { changedFields, isPersonalEdit, isPhoto, validateDataset } from './validate.js';

export const TITLE_PREFIX = '[League]';
const MARKER = '<!-- flfoxtan-submission -->';

// GitHub starts failing on new-issue links of about 6,900 characters. A GitHub issue can hold 65,536.
const MAX_URL_LENGTH = 6400;
const MAX_ISSUE_BODY = 60000;
const MAX_ITEMS = 200;
// A cap on what one submission without the code can add, to limit the clean-up after any misuse.
const MAX_PUBLIC_ADDITIONS = 25;

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
  bio: isText(280),
  photo: isPhoto,
  favouriteResource: isText(20),
  playStyle: isText(40),
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

function issueIntro({ authorisation, submittedBy }) {
  if (!submittedBy) return '**Last step: press the green button below (Ctrl+Enter also works), then go back to the site.** There is nothing to fill in.';
  return `Sent from the site by ${submittedBy}, using ${authorisation ? 'the admin code' : 'the group password'}.`;
}

/** The issue's title and text, whichever way it gets sent. */
export function buildIssue(changes, { authorisation = null, submittedBy = null } = {}) {
  const submission = { ...changes, ...(authorisation && { authorisation }), ...(submittedBy && { submittedBy }) };
  return {
    title: `${TITLE_PREFIX} ${describeChanges(changes)}`,
    body: [
      issueIntro({ authorisation, submittedBy }),
      '',
      MARKER,
      '```json',
      JSON.stringify(submission),
      '```',
    ].join('\n'),
  };
}

/** Builds the link that opens GitHub with the issue filled in. Returns null if it would be too long. */
export function buildIssueLink(repository, changes, authorisation = null) {
  const { title, body } = buildIssue(changes, { authorisation });
  const url = `https://github.com/${repository.owner}/${repository.name}/issues/new`
    + `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return url.length > MAX_URL_LENGTH ? null : { url, title };
}

/**
 * Takes as much as will fit in one submission, for when too much is waiting to go at once.
 * Players come first, as games can depend on them. Returns what fits, and how many items are left over.
 */
export function fitChanges(changes, fits) {
  const fitted = {
    profiles: { saved: [], deleted: changes.profiles.deleted },
    games: { saved: [], deleted: changes.games.deleted },
  };
  let left = 0;
  for (const collection of ['profiles', 'games']) {
    for (const item of changes[collection].saved) {
      if (!left) {
        fitted[collection].saved.push(item);
        if (fits(fitted)) continue;
        fitted[collection].saved.pop();
      }
      left += 1;
    }
  }
  return { changes: fitted, left };
}

/** Whether changes fit in one issue sent directly, or in one GitHub link. Pass a stand-in signature for an admin. */
export function fitsInIssue(changes, { signed = false, viaLink = null } = {}) {
  const added = changes.profiles.saved.length + changes.games.saved.length;
  if (!signed && added > MAX_PUBLIC_ADDITIONS) return false;
  const authorisation = signed ? { signedAt: Date.now(), signature: 'x'.repeat(100) } : null;
  return viaLink
    ? Boolean(buildIssueLink(viaLink, changes, authorisation))
    : buildIssue(changes, { authorisation, submittedBy: 'x'.repeat(60) }).body.length <= MAX_ISSUE_BODY;
}

class SubmissionError extends Error {}

function parseSubmission(body) {
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
  const authorisation = raw?.authorisation ?? null;
  if (authorisation !== null && !(Number.isSafeInteger(authorisation.signedAt) && isText(200)(authorisation.signature))) {
    throw new SubmissionError('The admin signature on this submission is not in the expected format.');
  }
  const submittedBy = raw?.submittedBy ?? null;
  if (submittedBy !== null && !(typeof submittedBy === 'string' && /^[^\r\n]{1,60}$/.test(submittedBy))) {
    throw new SubmissionError('The name on this submission is not in the expected format.');
  }
  return {
    changes: { profiles: section('profiles', PLAYER_FIELDS, 'player'), games: section('games', GAME_FIELDS, 'game') },
    authorisation,
    submittedBy,
  };
}

function applyToList(list, { saved, deleted }) {
  const replacements = new Map(saved.map((item) => [item.id, item]));
  const kept = list
    .filter((item) => !deleted.includes(item.id))
    .map((item) => replacements.get(item.id) ?? item);
  const existing = new Set(list.map((item) => item.id));
  return [...kept, ...saved.filter((item) => !existing.has(item.id))];
}

/** Without the code, a submission can only add, or edit personal details on a profile. */
function touchesExisting(changes, { profiles, games }) {
  const alters = (list, { saved, deleted }, allowed = () => false) => {
    const current = new Map(list.map((item) => [item.id, item]));
    return deleted.length > 0 || saved.some((item) => current.has(item.id) && !allowed(current.get(item.id), item) && changedFields(current.get(item.id), item).length > 0);
  };
  return alters(profiles, changes.profiles, isPersonalEdit) || alters(games, changes.games);
}

/** The name stored for each thing in the log, so it can still be read after that thing is removed. */
function activityLabel(type, item, nameOf) {
  if (type === 'player') return item.name;
  return `Game on ${item.date}: ${item.seats.map((seat) => nameOf(seat.playerId)).join(', ')}`;
}

/** Adds what this submission did to the log of everything added, edited and removed. */
function logActivity(activity, before, next, { sender, issue, now }) {
  const names = new Map([...before.profiles, ...next.profiles].map((player) => [player.id, player.name]));
  const nameOf = (id) => names.get(id) ?? id;
  const at = new Date(now).toISOString();
  const entry = (action, type, item, extra = {}) => ({ action, type, id: item.id, label: activityLabel(type, item, nameOf), ...extra, ...sender, at, issue });
  const changesIn = (type, previous, current) => {
    const old = new Map(previous.map((item) => [item.id, item]));
    const stillThere = new Set(current.map((item) => item.id));
    return [
      ...current.filter((item) => !old.has(item.id)).map((item) => entry('added', type, item)),
      ...current.filter((item) => old.has(item.id) && JSON.stringify(old.get(item.id)) !== JSON.stringify(item)).map((item) => entry('edited', type, item, { changed: changedFields(old.get(item.id), item) })),
      ...previous.filter((item) => !stillThere.has(item.id)).map((item) => entry('removed', type, item)),
    ];
  };
  return [
    ...activity,
    ...changesIn('player', before.profiles, next.profiles),
    ...changesIn('game', before.games, next.games),
  ];
}

const SIGNATURE_PROBLEMS = {
  invalid: 'The admin code on this submission did not check out, so nothing has been changed.',
  expired: 'This admin submission was signed more than an hour ago, so it has expired and nothing has been changed. Please send it again from the site.',
};

/**
 * Decides what happens to a submitted issue. Nothing is written here: the caller gets the outcome back.
 *   status: 'needs-code' | 'rejected' | 'unchanged' | 'applied'
 */
export async function processSubmission({ body, author, profiles, games, activity = [], league, colours, expansions, issue = null, now = Date.now() }) {
  const { adminKey, repository, settings } = league;

  try {
    const { changes, authorisation, submittedBy } = parseSubmission(body);

    // Issues sent from the site come from the owner's token, so a typed name is only believed on those.
    // Anyone else's name comes from GitHub, and whatever they typed is ignored, so nobody can pose as someone.
    // A valid signature proves the sender has the admin code, so only unsigned names are marked as unverified.
    const named = Boolean(submittedBy) && String(author).toLowerCase() === repository.owner.toLowerCase();
    const sender = named ? { by: submittedBy, ...(!authorisation && { viaPassword: true }) } : { by: author };

    if (authorisation) {
      const result = await checkAuthorisation(adminKey, changes, authorisation, now);
      if (result !== 'valid') return { status: 'needs-code', message: SIGNATURE_PROBLEMS[result] };
    } else {
      if (touchesExisting(changes, { profiles, games })) {
        return {
          status: 'needs-code',
          message: 'Anyone can add players and games and edit the personal details on a profile, but anything else already in the league needs the admin code, so nothing has been changed. Please ask a league admin.',
        };
      }
      if (changes.profiles.saved.length + changes.games.saved.length > MAX_PUBLIC_ADDITIONS) {
        throw new SubmissionError(`A single submission can add up to ${MAX_PUBLIC_ADDITIONS} players and games. Please send them in smaller batches.`);
      }
    }

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
      : {
        status: 'applied',
        message: `Saved to the league: ${describeChanges(changes)}.`,
        summary: describeChanges(changes),
        submittedBy: sender.by,
        ...next,
        activity: logActivity(activity, { profiles, games }, next, { sender, issue, now }),
      };
  } catch (error) {
    if (error instanceof SubmissionError) return { status: 'rejected', message: error.message };
    return { status: 'rejected', message: 'The submission could not be processed, so nothing has been changed.' };
  }
}
