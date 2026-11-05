// Run by .github/workflows/league-submission.yml when an issue is opened.
// Checks the issue, updates the data files if it is valid, and leaves a reply for the workflow to post.
// It only ever writes data/profiles.json, data/games.json and data/additions.json.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processSubmission } from '../js/domain/submission.js';

const dataDir = process.env.DATA_DIR || 'data';
const read = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

/** Rewrites a data file, keeping its header note. Games stay in date order so the file is easy to read. */
function writeCollection(file, collection, items) {
  const sorted = collection === 'games'
    ? [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    : items;
  const { _readme } = read(file);
  writeFileSync(join(dataDir, file), `${JSON.stringify({ _readme, [collection]: sorted }, null, 2)}\n`);
}

const outcome = await processSubmission({
  body: process.env.ISSUE_BODY ?? '',
  author: process.env.ISSUE_AUTHOR ?? '',
  issue: Number(process.env.ISSUE_NUMBER) || null,
  profiles: read('profiles.json').profiles,
  games: read('games.json').games,
  additions: read('additions.json').additions,
  league: read('league.json'),
  colours: read('colours.json').colours,
  expansions: read('expansions.json'),
});

if (outcome.status === 'applied') {
  writeCollection('profiles.json', 'profiles', outcome.profiles);
  writeCollection('games.json', 'games', outcome.games);
  writeCollection('additions.json', 'additions', outcome.additions);
}

if (process.env.REPLY_FILE) writeFileSync(process.env.REPLY_FILE, `${outcome.message}\n`);
if (process.env.GITHUB_OUTPUT) {
  const closeReason = ['applied', 'unchanged'].includes(outcome.status) ? 'completed' : 'not planned';
  appendFileSync(process.env.GITHUB_OUTPUT, [
    `changed=${outcome.status === 'applied'}`,
    `close_reason=${closeReason}`,
    `summary=${(outcome.summary ?? '').replace(/[\r\n]+/g, ' ')}`,
    '',
  ].join('\n'));
}
console.log(`${outcome.status}: ${outcome.message}`);
