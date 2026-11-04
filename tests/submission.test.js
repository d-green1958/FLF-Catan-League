import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { buildIssueLink, describeChanges, isAdmin, processSubmission, TITLE_PREFIX } from '../js/domain/submission.js';

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
const league = await load('league.json');
const { colours } = await load('colours.json');
const expansions = await load('expansions.json');

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), active: true }));
const newGame = (changes = {}) => ({
  id: '2026-11-06-ab12',
  date: '2026-11-06',
  expansions: [],
  vpTarget: 10,
  winnerId: 'a',
  seats: [
    { playerId: 'a', colour: 'red', vp: 10 },
    { playerId: 'b', colour: 'blue', vp: 8 },
    { playerId: 'c', colour: 'white', vp: 6 },
  ],
  ...changes,
});
const payload = ({ savedGames = [], deletedGames = [], savedPlayers = [], deletedPlayers = [] } = {}) => ({
  profiles: { saved: savedPlayers, deleted: deletedPlayers },
  games: { saved: savedGames, deleted: deletedGames },
});

/** The issue body exactly as the site would write it: taken from the real link. */
const bodyFor = (changes) => new URL(buildIssueLink(league.repository, changes).url).searchParams.get('body');

const submit = ({ changes, body, author = 'bogosimsutwana', profiles = players, games = [] }) => processSubmission({
  body: body ?? bodyFor(changes), author, profiles, games, league, colours, expansions,
});

test('the two league admins are on the list, ignoring upper and lower case', () => {
  assert.ok(isAdmin('bogosimsutwana', league.admins));
  assert.ok(isAdmin('d-green1958', league.admins));
  assert.ok(isAdmin('D-Green1958', league.admins));
  assert.ok(!isAdmin('someone-else', league.admins));
  assert.ok(!isAdmin('', league.admins));
});

test('the link points at the repo and its title triggers the workflow', () => {
  const link = buildIssueLink(league.repository, payload({ savedGames: [newGame()] }));
  const url = new URL(link.url);
  assert.equal(url.origin + url.pathname, 'https://github.com/d-green1958/FLF-Catan-League/issues/new');
  assert.ok(url.searchParams.get('title').startsWith(TITLE_PREFIX));
  assert.equal(link.title, '[League] Game on 2026-11-06');
});

test('a very large submission gives no link rather than a broken one', () => {
  const many = Array.from({ length: 80 }, (_, i) => newGame({ id: `game-${i}` }));
  assert.equal(buildIssueLink(league.repository, payload({ savedGames: many })), null);
});

test('titles describe the changes', () => {
  assert.equal(describeChanges(payload({ savedGames: [newGame()], savedPlayers: [players[0]] })), 'Game on 2026-11-06, 1 player');
  assert.equal(describeChanges(payload({ deletedGames: ['x', 'y'] })), 'delete 2 games');
});

test('an admin can add a game, and a player and game can arrive together', () => {
  const outcome = submit({
    changes: payload({ savedGames: [newGame({ seats: [{ playerId: 'a', colour: 'red', vp: 10 }, { playerId: 'b', colour: 'blue', vp: 8 }, { playerId: 'zed', colour: 'white', vp: 6 }] })], savedPlayers: [{ name: 'Zed', active: true, id: 'zed' }] }),
  });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.games.length, 1);
  assert.ok(outcome.profiles.some((player) => player.id === 'zed'));
});

test('someone who is not an admin changes nothing, whatever they send', () => {
  const outcome = submit({ changes: payload({ savedGames: [newGame()] }), author: 'stranger' });
  assert.equal(outcome.status, 'not-admin');
  assert.equal(outcome.games, undefined);
  assert.equal(outcome.profiles, undefined);
  assert.match(outcome.message, /bogosimsutwana, d-green1958/);
});

test('corrections replace the original, and deletions remove it', () => {
  const games = [newGame()];
  const corrected = submit({ changes: payload({ savedGames: [newGame({ notes: 'Corrected' })] }), games });
  assert.equal(corrected.status, 'applied');
  assert.equal(corrected.games.length, 1);
  assert.equal(corrected.games[0].notes, 'Corrected');

  const deleted = submit({ changes: payload({ deletedGames: [games[0].id] }), games });
  assert.equal(deleted.status, 'applied');
  assert.equal(deleted.games.length, 0);
});

test('submitting the same thing twice changes nothing the second time', () => {
  const game = newGame();
  assert.equal(submit({ changes: payload({ savedGames: [game] }), games: [game] }).status, 'unchanged');
});

test('invalid games are refused with the reason, even from an admin', () => {
  const cases = [
    [newGame({ winnerId: 'b' }), /fewer VPs/],
    [newGame({ vpTarget: 12 }), /not reached the target/],
    [newGame({ date: 'yesterday' }), /date/],
    [newGame({ seats: [{ playerId: 'a', colour: 'red', vp: 10 }, { playerId: 'ghost', colour: 'blue', vp: 8 }, { playerId: 'c', colour: 'white', vp: 6 }] }), /not registered/],
    [newGame({ expansions: ['made-up-expansion'] }), /not a recognised expansion/],
  ];
  for (const [game, reason] of cases) {
    const outcome = submit({ changes: payload({ savedGames: [game] }) });
    assert.equal(outcome.status, 'rejected', JSON.stringify(game));
    assert.match(outcome.message, reason);
    assert.equal(outcome.games, undefined);
  }
});

test('a player with games cannot be deleted', () => {
  const outcome = submit({ changes: payload({ deletedPlayers: ['a'] }), games: [newGame()] });
  assert.equal(outcome.status, 'rejected');
});

test('unexpected or hostile content is refused', () => {
  const asBody = (json) => `<!-- flfoxtan-submission -->\n\`\`\`json\n${json}\n\`\`\``;
  const hostile = [
    'Just a normal issue with no submission in it',
    asBody('not json'),
    asBody('null'),
    asBody('[]'),
    asBody('{"profiles":{"saved":[],"deleted":[]}}'),
    asBody(JSON.stringify(payload({ savedPlayers: [{ id: 'x', name: 'X', isAdmin: true }] }))),
    asBody(JSON.stringify(payload({ savedPlayers: [{ id: '../../etc/passwd', name: 'X' }] }))),
    asBody(JSON.stringify(payload({ savedPlayers: [{ id: '__proto__', name: 'X' }] }))),
    asBody(JSON.stringify(payload({ savedPlayers: [{ id: 'x', name: 123 }] }))),
    asBody(JSON.stringify(payload({ savedPlayers: [{ name: 'No id' }] }))),
    asBody(JSON.stringify(payload({ savedPlayers: [{ id: 'x', name: 'L'.repeat(500) }] }))),
    asBody(JSON.stringify(payload({ savedGames: [newGame({ extra: 'field' })] }))),
    asBody(JSON.stringify(payload({ savedGames: [newGame({ seats: 'everyone' })] }))),
    asBody(JSON.stringify(payload({ deletedGames: [{ id: 'x' }] }))),
    asBody(JSON.stringify(payload({ deletedGames: Array.from({ length: 500 }, (_, i) => `g-${i}`) }))),
  ];
  for (const body of hostile) {
    const outcome = submit({ body });
    assert.equal(outcome.status, 'rejected', `should refuse: ${body.slice(0, 90)}`);
    assert.equal(outcome.games, undefined);
  }
});

test('HTML in a name is stored as plain text, because the site never renders it as HTML', () => {
  const name = '<img src=x onerror=alert(1)>';
  const outcome = submit({ changes: payload({ savedPlayers: [{ name, active: true, id: 'imgx' }] }) });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.profiles.at(-1).name, name);
});

test('the script updates only the two data files, keeps their notes, and reports its outcome', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-submission-'));
  try {
    cpSync(fileURLToPath(new URL('../data', import.meta.url)), dir, { recursive: true });
    const script = fileURLToPath(new URL('../scripts/apply-submission.js', import.meta.url));
    const outputFile = join(dir, 'output.txt');
    const replyFile = join(dir, 'reply.md');
    const run = (changes, author) => {
      writeFileSync(outputFile, '');
      execFileSync(process.execPath, [script], {
        env: { ...process.env, DATA_DIR: dir, ISSUE_BODY: bodyFor(changes), ISSUE_AUTHOR: author, REPLY_FILE: replyFile, GITHUB_OUTPUT: outputFile },
        stdio: 'pipe',
      });
      return readFileSync(outputFile, 'utf8');
    };
    const leagueBefore = readFileSync(join(dir, 'league.json'), 'utf8');
    const readme = JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8'))._readme;
    const changes = payload({ savedPlayers: players, savedGames: [newGame()] });

    const refused = run(changes, 'stranger');
    assert.match(refused, /changed=false/);
    assert.match(refused, /close_reason=not planned/);
    assert.equal(JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8')).games.length, 0);
    assert.match(readFileSync(replyFile, 'utf8'), /Only league admins/);

    const accepted = run(changes, 'd-green1958');
    assert.match(accepted, /changed=true/);
    assert.match(accepted, /close_reason=completed/);
    assert.match(accepted, /summary=Game on 2026-11-06, 3 players/);
    const saved = JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8'));
    assert.equal(saved.games.length, 1);
    assert.equal(saved._readme, readme);
    assert.equal(JSON.parse(readFileSync(join(dir, 'profiles.json'), 'utf8')).profiles.length, 3);
    assert.equal(readFileSync(join(dir, 'league.json'), 'utf8'), leagueBefore);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
