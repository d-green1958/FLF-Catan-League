import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createAdminKey, signChanges, unlockWithCode } from '../js/domain/admin-key.js';
import { buildIssueLink, describeChanges, processSubmission, TITLE_PREFIX } from '../js/domain/submission.js';

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
const CODE = 'a test code that is long enough';
const adminKey = await createAdminKey(CODE);
const signingKey = await unlockWithCode(CODE, adminKey);
const league = { ...(await load('league.json')), adminKey };
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
const bodyFor = (changes, authorisation = null) => new URL(buildIssueLink(league.repository, changes, authorisation).url).searchParams.get('body');
const signedBody = async (changes, signedAt) => bodyFor(changes, await signChanges(signingKey, changes, signedAt));

const submit = ({ changes, body, author = 'someone', profiles = players, games = [], additions = [], issue = 5, now }) => processSubmission({
  body: body ?? bodyFor(changes), author, issue, now, profiles, games, additions, league, colours, expansions,
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

test('anyone can add a game, and a player and game can arrive together', async () => {
  const outcome = await submit({
    changes: payload({ savedGames: [newGame({ seats: [{ playerId: 'a', colour: 'red', vp: 10 }, { playerId: 'b', colour: 'blue', vp: 8 }, { playerId: 'zed', colour: 'white', vp: 6 }] })], savedPlayers: [{ name: 'Zed', active: true, id: 'zed' }] }),
    author: 'first-timer',
    now: Date.UTC(2026, 10, 6, 13),
  });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.games.length, 1);
  assert.ok(outcome.profiles.some((player) => player.id === 'zed'));
  assert.deepEqual(outcome.additions, [
    { type: 'player', id: 'zed', addedBy: 'first-timer', addedAt: '2026-11-06T13:00:00.000Z', issue: 5 },
    { type: 'game', id: '2026-11-06-ab12', addedBy: 'first-timer', addedAt: '2026-11-06T13:00:00.000Z', issue: 5 },
  ]);
});

test('without the code, nothing already in the league can be changed or removed', async () => {
  const game = newGame();
  const attempts = [
    payload({ savedGames: [newGame({ notes: 'Sneaky edit' })] }),
    payload({ deletedGames: [game.id] }),
    payload({ deletedPlayers: ['a'] }),
    payload({ savedPlayers: [{ id: 'a', name: 'Renamed', active: true }] }),
    payload({ savedPlayers: [{ ...players[0], active: false }] }),
    // Hiding a removal among genuine additions does not help.
    payload({ savedPlayers: [{ id: 'new', name: 'New', active: true }], deletedGames: [game.id] }),
    // Nor does removing something that is not there.
    payload({ deletedGames: ['missing'] }),
  ];
  for (const changes of attempts) {
    const outcome = await submit({ changes, games: [game] });
    assert.equal(outcome.status, 'needs-code', JSON.stringify(changes));
    assert.equal(outcome.games, undefined);
    assert.equal(outcome.profiles, undefined);
  }
});

test('one submission without the code can only add so much', async () => {
  const many = Array.from({ length: 26 }, (_, i) => ({ id: `p-${i}`, name: `P ${i}`, active: true }));
  const outcome = await submit({ changes: payload({ savedPlayers: many }) });
  assert.equal(outcome.status, 'rejected');
  assert.match(outcome.message, /smaller batches/);
});

test('with the code, corrections replace the original and removals take it away', async () => {
  const games = [newGame()];
  const additions = [{ type: 'game', id: games[0].id, addedBy: 'vandal', addedAt: '2026-11-06T13:00:00.000Z', issue: 2 }];

  const correction = payload({ savedGames: [newGame({ notes: 'Corrected' })] });
  const corrected = await submit({ body: await signedBody(correction), games, additions });
  assert.equal(corrected.status, 'applied');
  assert.equal(corrected.games.length, 1);
  assert.equal(corrected.games[0].notes, 'Corrected');
  assert.deepEqual(corrected.additions, additions, 'a correction keeps the record of who first added it');

  const removal = payload({ deletedGames: [games[0].id] });
  const deleted = await submit({ body: await signedBody(removal), games, additions });
  assert.equal(deleted.status, 'applied');
  assert.equal(deleted.games.length, 0);
  assert.deepEqual(deleted.additions, []);
});

test('an admin can remove several things in one go, even if one has already gone', async () => {
  const games = [newGame()];
  const spurious = { id: 'spam', name: 'Spam', active: true };
  const removal = payload({ deletedGames: [games[0].id, 'already-gone'], deletedPlayers: ['spam'] });
  const outcome = await submit({ body: await signedBody(removal), games, profiles: [...players, spurious] });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.games.length, 0);
  assert.ok(!outcome.profiles.some((player) => player.id === 'spam'));
});

test('a signature only works for the changes it was made for', async () => {
  const game = newGame();
  const signed = await signChanges(signingKey, payload({ deletedGames: ['something-else'] }));
  const outcome = await submit({ body: bodyFor(payload({ deletedGames: [game.id] }), signed), games: [game] });
  assert.equal(outcome.status, 'needs-code');
  assert.match(outcome.message, /did not check out/);
  assert.equal(outcome.games, undefined);
});

test('a signature made with the wrong code is refused', async () => {
  const otherKey = await createAdminKey('some completely different code');
  const wrongKey = await unlockWithCode('some completely different code', otherKey);
  const game = newGame();
  const changes = payload({ deletedGames: [game.id] });
  const outcome = await submit({ body: bodyFor(changes, await signChanges(wrongKey, changes)), games: [game] });
  assert.equal(outcome.status, 'needs-code');
  assert.equal(outcome.games, undefined);
});

test('malformed signatures are refused, not crashed on', async () => {
  const game = newGame();
  const changes = payload({ deletedGames: [game.id] });
  for (const authorisation of [{ signedAt: Date.now(), signature: 'not base64 !!' }, { signedAt: Date.now(), signature: 'AAAA' }, { signedAt: 'soon', signature: 'AAAA' }, { signature: 'AAAA' }, 'yes', 1]) {
    const outcome = await submit({ body: bodyFor(changes, authorisation), games: [game] });
    assert.ok(['needs-code', 'rejected'].includes(outcome.status), JSON.stringify(authorisation));
    assert.equal(outcome.games, undefined);
  }
});

test('an old signature copied from an issue cannot be reused later', async () => {
  const game = newGame();
  const changes = payload({ deletedGames: [game.id] });
  const signedAt = Date.UTC(2026, 10, 6, 13);
  const body = await signedBody(changes, signedAt);
  const hour = 60 * 60 * 1000;

  assert.equal((await submit({ body, games: [game], now: signedAt + hour - 1 })).status, 'applied');
  const late = await submit({ body, games: [game], now: signedAt + hour + 1 });
  assert.equal(late.status, 'needs-code');
  assert.match(late.message, /expired/);
  assert.equal((await submit({ body, games: [game], now: signedAt - 11 * 60 * 1000 })).status, 'needs-code');
});

test('nothing can be corrected or removed until an admin code has been set', async () => {
  const game = newGame();
  const changes = payload({ deletedGames: [game.id] });
  const outcome = await processSubmission({
    body: await signedBody(changes), author: 'someone', profiles: players, games: [game], league: { ...league, adminKey: null }, colours, expansions,
  });
  assert.equal(outcome.status, 'needs-code');
});

test('the code cannot be recovered from what the repo stores, and only the right code unlocks', async () => {
  assert.ok(!JSON.stringify(adminKey).includes(CODE));
  assert.equal(await unlockWithCode('not the right code at all', adminKey), null);
  assert.ok(await unlockWithCode(`  ${CODE} `, adminKey), 'stray spaces do not matter');
  await assert.rejects(createAdminKey('too short'), /at least 12/);
});

test('a signature in the issue never contains the code', async () => {
  const body = await signedBody(payload({ deletedGames: ['x'] }));
  assert.ok(!body.includes(CODE));
});

test('submitting the same thing twice changes nothing the second time', async () => {
  const game = newGame();
  assert.equal((await submit({ changes: payload({ savedGames: [game] }), games: [game] })).status, 'unchanged');
});

test('sending an unchanged player again with a new game still works', async () => {
  // Someone's browser keeps a new player in its draft until the site updates, so it can be sent twice.
  const outcome = await submit({ changes: payload({ savedPlayers: [players[0]], savedGames: [newGame()] }) });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.profiles.length, 3);
});

test('invalid games are refused with the reason', async () => {
  const cases = [
    [newGame({ winnerId: 'b' }), /fewer VPs/],
    [newGame({ vpTarget: 12 }), /not reached the target/],
    [newGame({ date: 'yesterday' }), /date/],
    [newGame({ seats: [{ playerId: 'a', colour: 'red', vp: 10 }, { playerId: 'ghost', colour: 'blue', vp: 8 }, { playerId: 'c', colour: 'white', vp: 6 }] }), /not registered/],
    [newGame({ expansions: ['made-up-expansion'] }), /not a recognised expansion/],
  ];
  for (const [game, reason] of cases) {
    const outcome = await submit({ changes: payload({ savedGames: [game] }) });
    assert.equal(outcome.status, 'rejected', JSON.stringify(game));
    assert.match(outcome.message, reason);
    assert.equal(outcome.games, undefined);
  }
});

test('a player with games cannot be deleted, even with the code', async () => {
  const outcome = await submit({ body: await signedBody(payload({ deletedPlayers: ['a'] })), games: [newGame()] });
  assert.equal(outcome.status, 'rejected');
});

test('unexpected or hostile content is refused', async () => {
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
    const outcome = await submit({ body });
    assert.equal(outcome.status, 'rejected', `should refuse: ${body.slice(0, 90)}`);
    assert.equal(outcome.games, undefined);
  }
});

test('HTML in a name is stored as plain text, because the site never renders it as HTML', async () => {
  const name = '<img src=x onerror=alert(1)>';
  const outcome = await submit({ changes: payload({ savedPlayers: [{ name, active: true, id: 'imgx' }] }) });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.profiles.at(-1).name, name);
});

test('the set-admin-code script stores a working key in league.json and leaves the rest alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-code-'));
  try {
    cpSync(fileURLToPath(new URL('../data/league.json', import.meta.url)), join(dir, 'league.json'));
    const before = readFileSync(join(dir, 'league.json'), 'utf8');
    const script = fileURLToPath(new URL('../scripts/set-admin-code.js', import.meta.url));
    const run = (input) => execFileSync(process.execPath, [script], { env: { ...process.env, DATA_DIR: dir }, input, encoding: 'utf8', stdio: 'pipe' });

    assert.throws(() => run('short\n'));
    assert.equal(readFileSync(join(dir, 'league.json'), 'utf8'), before, 'a refused code changes nothing');

    // Setting it twice proves a code can be changed, and that the old one stops working.
    run('the first code for this test\n');
    const firstKey = JSON.parse(readFileSync(join(dir, 'league.json'), 'utf8')).adminKey;
    run('the second code for this test\n');
    const text = readFileSync(join(dir, 'league.json'), 'utf8');
    const { adminKey: stored } = JSON.parse(text);
    assert.notEqual(stored.publicKey, firstKey.publicKey);
    assert.ok(await unlockWithCode('the second code for this test', stored));
    assert.equal(await unlockWithCode('the first code for this test', stored), null);
    assert.ok(!text.includes('second code'));
    const withoutKey = (json) => json.replace(/"adminKey": (null|\{[^}]*\})/, '"adminKey": null');
    assert.equal(withoutKey(text), withoutKey(before), 'only the key line changes');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the script updates only the data files it should, keeps their notes, and reports its outcome', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-submission-'));
  try {
    cpSync(fileURLToPath(new URL('../data', import.meta.url)), dir, { recursive: true });
    const script = fileURLToPath(new URL('../scripts/apply-submission.js', import.meta.url));
    const outputFile = join(dir, 'output.txt');
    const replyFile = join(dir, 'reply.md');
    const run = (changes, author) => {
      writeFileSync(outputFile, '');
      execFileSync(process.execPath, [script], {
        env: { ...process.env, DATA_DIR: dir, ISSUE_BODY: bodyFor(changes), ISSUE_AUTHOR: author, ISSUE_NUMBER: '12', REPLY_FILE: replyFile, GITHUB_OUTPUT: outputFile },
        stdio: 'pipe',
      });
      return readFileSync(outputFile, 'utf8');
    };
    const leagueBefore = readFileSync(join(dir, 'league.json'), 'utf8');
    const readme = JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8'))._readme;
    const changes = payload({ savedPlayers: players, savedGames: [newGame()] });

    const accepted = run(changes, 'first-timer');
    assert.match(accepted, /changed=true/);
    assert.match(accepted, /close_reason=completed/);
    assert.match(accepted, /summary=Game on 2026-11-06, 3 players/);
    const saved = JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8'));
    assert.equal(saved.games.length, 1);
    assert.equal(saved._readme, readme);
    assert.equal(JSON.parse(readFileSync(join(dir, 'profiles.json'), 'utf8')).profiles.length, 3);
    assert.equal(readFileSync(join(dir, 'league.json'), 'utf8'), leagueBefore);
    const log = JSON.parse(readFileSync(join(dir, 'additions.json'), 'utf8')).additions;
    assert.equal(log.length, 4);
    assert.ok(log.every((entry) => entry.addedBy === 'first-timer' && entry.issue === 12));

    const refused = run(payload({ deletedGames: [newGame().id] }), 'vandal');
    assert.match(refused, /changed=false/);
    assert.match(refused, /close_reason=not planned/);
    assert.equal(JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8')).games.length, 1);
    assert.match(readFileSync(replyFile, 'utf8'), /needs the admin code/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
