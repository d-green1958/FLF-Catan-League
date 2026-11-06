import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createAdminKey, signChanges, unlockWithCode } from '../js/domain/admin-key.js';
import { createGroupAccess, openGroupAccess } from '../js/domain/group-access.js';
import { applyRecentIssues, compactIssue } from '../js/domain/live-issues.js';
import { buildIssue, buildIssueLink, describeChanges, fitChanges, fitsInIssue, processSubmission, TITLE_PREFIX } from '../js/domain/submission.js';
import { isPersonalEdit, isPhoto, MAX_PHOTO_CHARS } from '../js/domain/validate.js';

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

const submit = ({ changes, body, author = 'someone', profiles = players, games = [], activity = [], issue = 5, now }) => processSubmission({
  body: body ?? bodyFor(changes), author, issue, now, profiles, games, activity, league, colours, expansions,
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
  assert.deepEqual(outcome.activity, [
    { action: 'added', type: 'player', id: 'zed', label: 'Zed', by: 'first-timer', at: '2026-11-06T13:00:00.000Z', issue: 5 },
    { action: 'added', type: 'game', id: '2026-11-06-ab12', label: 'Game on 2026-11-06: A, B, Zed', by: 'first-timer', at: '2026-11-06T13:00:00.000Z', issue: 5 },
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
  const activity = [{ action: 'added', type: 'game', id: games[0].id, label: 'Game on 2026-11-06: A, B, C', by: 'vandal', at: '2026-11-06T13:00:00.000Z', issue: 2 }];

  const correction = payload({ savedGames: [newGame({ notes: 'Corrected' })] });
  const corrected = await submit({ body: await signedBody(correction), games, activity, author: 'an-admin' });
  assert.equal(corrected.status, 'applied');
  assert.equal(corrected.games.length, 1);
  assert.equal(corrected.games[0].notes, 'Corrected');
  assert.deepEqual(corrected.activity[0], activity[0], 'a correction keeps the record of who first added it');
  assert.deepEqual(corrected.activity.slice(1).map(({ action, type, by }) => ({ action, type, by })), [{ action: 'edited', type: 'game', by: 'an-admin' }]);

  const removal = payload({ deletedGames: [games[0].id] });
  const deleted = await submit({ body: await signedBody(removal), games, activity, author: 'an-admin' });
  assert.equal(deleted.status, 'applied');
  assert.equal(deleted.games.length, 0);
  assert.deepEqual(deleted.activity[0], activity[0], 'a removal keeps the record of who first added it');
  assert.equal(deleted.activity.length, 2);
  assert.equal(deleted.activity[1].action, 'removed');
  assert.equal(deleted.activity[1].label, 'Game on 2026-11-06: A, B, C', 'what was removed can still be read');
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

const fakePhoto = (length = 200) => `data:image/jpeg;base64,/9j/${'A'.repeat(length)}`;

test('photos must be small, real JPEG or WebP pictures', () => {
  assert.ok(isPhoto(fakePhoto()));
  assert.ok(isPhoto('data:image/webp;base64,UklGRAAAAA=='));
  assert.ok(!isPhoto(fakePhoto(MAX_PHOTO_CHARS)), 'too large');
  assert.ok(!isPhoto('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj4='), 'an SVG can carry scripts');
  assert.ok(!isPhoto('data:image/jpeg;base64,PHNjcmlwdD4='), 'says JPEG but is not one');
  assert.ok(!isPhoto('https://example.com/tracking.jpg'), 'an outside link would reveal who views the page');
  assert.ok(!isPhoto(`${fakePhoto()}"><script>`));
});

test('anyone can edit the personal details on a profile, and the log says what changed', async () => {
  const before = { id: 'a', name: 'A', joined: '2026-11-06', active: true, tagline: 'Old' };
  const after = { ...before, tagline: 'New', bio: 'Hello', photo: fakePhoto(), favouriteResource: 'ore', playStyle: 'road-builder', nickname: 'Ace', favouriteColour: 'red' };
  const outcome = await submit({ changes: payload({ savedPlayers: [after] }), profiles: [before], author: 'a-player' });
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.profiles[0].tagline, 'New');
  assert.equal(outcome.activity[0].action, 'edited');
  assert.equal(outcome.activity[0].by, 'a-player');
  assert.deepEqual([...outcome.activity[0].changed].sort(), ['bio', 'favouriteColour', 'favouriteResource', 'nickname', 'photo', 'playStyle', 'tagline']);
});

test('without the code, a name, joining date or retirement cannot change, and nothing can be removed', async () => {
  const before = { id: 'a', name: 'A', joined: '2026-11-06', active: true };
  for (const change of [{ name: 'Someone else' }, { joined: '2020-01-01' }, { active: false }, { name: 'B', tagline: 'Sneaked in with a real edit' }]) {
    const outcome = await submit({ changes: payload({ savedPlayers: [{ ...before, ...change }] }), profiles: [before] });
    assert.equal(outcome.status, 'needs-code', JSON.stringify(change));
  }
  assert.equal((await submit({ changes: payload({ deletedPlayers: ['a'] }), profiles: [before] })).status, 'needs-code');
  assert.ok(isPersonalEdit(before, { ...before, bio: 'x' }));
  assert.ok(!isPersonalEdit(before, { ...before, id: 'b' }));
});

test('profile fields are checked: a bad photo or an over-long about section is refused', async () => {
  const before = { id: 'a', name: 'A', active: true };
  for (const change of [{ photo: 'data:image/svg+xml;base64,PHN2Zz4=' }, { photo: fakePhoto(MAX_PHOTO_CHARS) }, { bio: 'x'.repeat(281) }, { favouriteResource: 'x'.repeat(21) }, { surprise: 'field' }]) {
    const outcome = await submit({ body: buildIssue(payload({ savedPlayers: [{ ...before, ...change }] })).body, profiles: [before] });
    assert.equal(outcome.status, 'rejected', JSON.stringify(Object.keys(change)));
  }
});

test('a player with the largest allowed photo and every field filled in still fits in a GitHub link', () => {
  const player = {
    id: 'a-player-with-a-long-id', name: 'N'.repeat(60), nickname: 'K'.repeat(40), tagline: 'T'.repeat(120), bio: 'B'.repeat(280),
    // Like a real picture: all 64 base64 characters equally often, and just two of them need escaping in a link.
    photo: `data:image/jpeg;base64,/9j/${'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.repeat(61).slice(0, MAX_PHOTO_CHARS - 26)}`, favouriteResource: 'grain', playStyle: 'smooth-talker', joined: '2026-11-06', favouriteColour: 'orange', active: true,
  };
  assert.ok(isPhoto(player.photo));
  assert.ok(buildIssueLink(league.repository, payload({ savedPlayers: [player] })), 'fits, with room to spare for a signature');
});

test('when too much is waiting, as much as fits is sent and the rest stays', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, active: true }));
  const direct = fitChanges(payload({ savedPlayers: many }), (changes) => fitsInIssue(changes));
  assert.equal(direct.changes.profiles.saved.length, 25, 'the limit on one submission without the code');
  assert.equal(direct.left, 5);
  assert.equal(fitChanges(payload({ savedPlayers: many }), (changes) => fitsInIssue(changes, { signed: true })).left, 0);

  const withPhotos = many.map((player) => ({ ...player, photo: fakePhoto(3900) }));
  const viaLink = fitChanges(payload({ savedPlayers: withPhotos }), (changes) => fitsInIssue(changes, { viaLink: league.repository }));
  assert.equal(viaLink.changes.profiles.saved.length, 1);
  assert.ok(buildIssueLink(league.repository, viaLink.changes));
  const bigIssue = fitChanges(payload({ savedPlayers: withPhotos }), (changes) => fitsInIssue(changes));
  assert.ok(bigIssue.changes.profiles.saved.length > 5 && buildIssue(bigIssue.changes, { submittedBy: 'x' }).body.length <= 65536);
});

test('games wait for their players: nothing is sent after the first thing that does not fit', () => {
  const fitted = fitChanges(payload({ savedPlayers: [players[0], players[1]], savedGames: [newGame()] }), (changes) => changes.profiles.saved.length < 2);
  assert.equal(fitted.changes.games.saved.length, 0);
  assert.equal(fitted.left, 2);
});

test('recent issues show at once, under the same rules as the Action', async () => {
  const now = Date.UTC(2026, 10, 6, 13);
  const issue = (number, changes, extra = {}) => compactIssue({
    number, title: `${TITLE_PREFIX} x`, body: buildIssue(changes).body, state: 'open', state_reason: null,
    html_url: `https://github.com/x/y/issues/${number}`, created_at: new Date(now - 1000).toISOString(), user: { login: 'someone' }, ...extra,
  });
  const published = { profiles: players, games: [], activity: [] };
  const apply = (issues) => applyRecentIssues(published, issues, { league, colours, expansions }, now);
  const zed = { id: 'zed', name: 'Zed', active: true };

  const added = await apply([issue(9, payload({ savedPlayers: [zed] }))]);
  assert.ok(added.profiles.some((player) => player.id === 'zed'), 'shown while the issue is still open');
  assert.deepEqual(added.outcomes.map(({ number, accepted }) => ({ number, accepted })), [{ number: 9, accepted: true }]);
  assert.equal(added.activity[0].by, 'someone');
  assert.equal(added.activity[0].issue, 9);

  const vandal = await apply([issue(10, payload({ deletedPlayers: ['a'] }))]);
  assert.equal(vandal.profiles.length, 3, 'an unsigned removal does nothing');
  assert.equal(vandal.outcomes[0].accepted, false);
  assert.match(vandal.outcomes[0].message, /admin code/);

  const refused = await apply([issue(11, payload({ savedPlayers: [zed] }), { state: 'closed', state_reason: 'not_planned' })]);
  assert.ok(!refused.profiles.some((player) => player.id === 'zed'), 'the Action has the last word');
  assert.equal(refused.outcomes[0].accepted, false);

  const stale = await apply([issue(12, payload({ savedPlayers: [zed] }), { created_at: new Date(now - 60 * 60 * 1000).toISOString() })]);
  assert.ok(!stale.profiles.some((player) => player.id === 'zed'), 'old issues are not applied for ever');

  const other = await apply([issue(13, payload({ savedPlayers: [zed] }), { title: 'Please fix the typo' })]);
  assert.ok(!other.profiles.some((player) => player.id === 'zed'), 'ordinary issues are ignored');

  const order = await apply([
    issue(15, payload({ savedPlayers: [{ ...zed, tagline: 'Second' }] })),
    issue(14, payload({ savedPlayers: [zed] })),
  ]);
  assert.equal(order.profiles.find((player) => player.id === 'zed').tagline, 'Second', 'applied oldest first');
});

test('replaying an issue that has already been published changes nothing, and is not logged twice', async () => {
  const now = Date.UTC(2026, 10, 6, 13);
  const zed = { id: 'zed', name: 'Zed', active: true };
  const issue = compactIssue({ number: 9, title: `${TITLE_PREFIX} x`, body: buildIssue(payload({ savedPlayers: [zed] })).body, state: 'closed', state_reason: 'completed', html_url: 'u', created_at: new Date(now - 1000).toISOString(), user: { login: 'someone' } });
  const first = await applyRecentIssues({ profiles: players, games: [], activity: [] }, [issue], { league, colours, expansions }, now);
  const again = await applyRecentIssues({ profiles: first.profiles, games: first.games, activity: first.activity }, [issue], { league, colours, expansions }, now);
  assert.deepEqual(again.profiles, first.profiles);
  assert.deepEqual(again.activity, first.activity);
  assert.equal(again.outcomes[0].accepted, true);
});

test('a signed issue is checked against when it was opened, not when someone happens to view it', async () => {
  const opened = Date.UTC(2026, 10, 6, 13);
  const changes = payload({ deletedPlayers: ['c'] });
  const issue = compactIssue({ number: 3, title: `${TITLE_PREFIX} x`, body: await signedBody(changes, opened), state: 'open', state_reason: null, html_url: 'u', created_at: new Date(opened).toISOString(), user: { login: 'someone' } });
  const later = await applyRecentIssues({ profiles: players, games: [], activity: [] }, [issue], { league, colours, expansions }, opened + 10 * 60 * 1000);
  assert.equal(later.profiles.length, 2);
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

const OWNER = league.repository.owner;
const FAKE_TOKEN = 'github_pat_11AAAAAAA0exampleonlynotarealtoken';
const groupPlayer = { id: 'sam', name: 'Sam', active: true };

test('a name is believed only on issues sent with the group password', async () => {
  const changes = payload({ savedPlayers: [groupPlayer] });
  const body = buildIssue(changes, { submittedBy: 'Priya' }).body;

  const viaToken = await submit({ body, author: OWNER });
  assert.equal(viaToken.status, 'applied');
  assert.equal(viaToken.submittedBy, 'Priya');
  assert.equal(viaToken.activity[0].by, 'Priya');
  assert.equal(viaToken.activity[0].viaPassword, true);

  // Someone else typing a name into their own issue cannot pose as anyone: GitHub's username wins.
  const impostor = await submit({ body, author: 'impostor' });
  assert.equal(impostor.status, 'applied');
  assert.equal(impostor.submittedBy, 'impostor');
  assert.equal(impostor.activity[0].by, 'impostor');
  assert.equal(impostor.activity[0].viaPassword, undefined);
});

test('a signed issue from the token shows the admin as verified, and an unsigned one cannot claim that', async () => {
  const changes = payload({ savedPlayers: [groupPlayer] });
  const authorisation = await signChanges(signingKey, changes);
  const signed = buildIssue(changes, { authorisation, submittedBy: 'Admin' });
  assert.match(signed.body, /by Admin, using the admin code/);

  const admin = await submit({ body: signed.body, author: OWNER });
  assert.equal(admin.status, 'applied');
  assert.equal(admin.activity[0].by, 'Admin');
  assert.equal(admin.activity[0].viaPassword, undefined);

  // Someone with only the group password can type "Admin", but it stays marked as unverified.
  const unsigned = await submit({ body: buildIssue(changes, { submittedBy: 'Admin' }).body, author: OWNER });
  assert.equal(unsigned.activity[0].by, 'Admin');
  assert.equal(unsigned.activity[0].viaPassword, true);

  // A signature does not let someone else's account use a typed name.
  const other = await submit({ body: signed.body, author: 'someone-else' });
  assert.equal(other.activity[0].by, 'someone-else');
});

test('sending the same thing twice is harmless and logs it once', async () => {
  const changes = payload({ savedPlayers: [groupPlayer] });
  const first = await submit({ changes, author: 'first-timer' });
  const again = await submit({ changes, author: 'first-timer', profiles: first.profiles, activity: first.activity });
  assert.equal(again.status, 'unchanged');

  const both = payload({ savedPlayers: [groupPlayer, { id: 'kim', name: 'Kim', active: true }] });
  const next = await submit({ changes: both, author: 'first-timer', profiles: first.profiles, activity: first.activity });
  assert.equal(next.status, 'applied');
  assert.deepEqual(next.activity.map(({ id }) => id), ['sam', 'kim']);
});

test('the owner adding normally is shown under their own username', async () => {
  const outcome = await submit({ changes: payload({ savedPlayers: [groupPlayer] }), author: OWNER });
  assert.equal(outcome.activity[0].by, OWNER);
  assert.equal(outcome.activity[0].viaPassword, undefined);
});

test('the group password can add but cannot change or remove anything', async () => {
  const game = newGame();
  for (const changes of [payload({ deletedGames: [game.id] }), payload({ savedGames: [newGame({ notes: 'Edited' })] })]) {
    const body = buildIssue(changes, { submittedBy: 'Priya' }).body;
    const outcome = await submit({ body, author: OWNER, games: [game] });
    assert.equal(outcome.status, 'needs-code', JSON.stringify(changes));
    assert.equal(outcome.games, undefined);
  }
});

test('bad names are refused', async () => {
  for (const submittedBy of ['L'.repeat(61), 'line\nbreak', 7, { name: 'x' }]) {
    const body = `<!-- flfoxtan-submission -->\n\`\`\`json\n${JSON.stringify({ ...payload({ savedPlayers: [groupPlayer] }), submittedBy })}\n\`\`\``;
    const outcome = await submit({ body, author: OWNER });
    assert.equal(outcome.status, 'rejected', JSON.stringify(submittedBy));
  }
});

test('the group token opens only with the right password, and is never stored readable', async () => {
  const access = await createGroupAccess('the group password for tests', FAKE_TOKEN);
  assert.equal(await openGroupAccess('the group password for tests', access), FAKE_TOKEN);
  assert.equal(await openGroupAccess(' the group password for tests ', access), FAKE_TOKEN, 'stray spaces do not matter');
  assert.equal(await openGroupAccess('a completely wrong password', access), null);
  const stored = JSON.stringify(access);
  assert.ok(!stored.includes(FAKE_TOKEN) && !stored.includes('github_pat_') && !stored.includes('the group password'));
});

test('weak passwords and over-powered tokens are refused', async () => {
  await assert.rejects(createGroupAccess('too short', FAKE_TOKEN), /at least 12/);
  await assert.rejects(createGroupAccess('a long enough password', 'ghp_classictokenwithwideaccess'), /fine-grained/);
  await assert.rejects(createGroupAccess('a long enough password', ''), /fine-grained/);
});

/** The real league.json with no admin copy of the token, so these tests do not depend on what has been set up. */
const leagueWithoutAdminAccess = () => readFileSync(fileURLToPath(new URL('../data/league.json', import.meta.url)), 'utf8')
  .replace(/"adminAccess": (null|\{[^}]*\})/, '"adminAccess": null');

test('the set-group-password script stores working access and leaves the rest alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-group-'));
  try {
    const file = join(dir, 'league.json');
    const start = leagueWithoutAdminAccess().replace(/"adminKey": (null|\{[^}]*\})/, `"adminKey": ${JSON.stringify(adminKey)}`);
    writeFileSync(file, start);
    const script = fileURLToPath(new URL('../scripts/set-group-password.js', import.meta.url));
    const run = (input) => execFileSync(process.execPath, [script], { env: { ...process.env, DATA_DIR: dir }, input, encoding: 'utf8', stdio: 'pipe' });

    assert.throws(() => run(`${CODE}\n${FAKE_TOKEN}\n`), /different from the admin code/);
    assert.throws(() => run('short\n' + FAKE_TOKEN + '\n'));
    assert.throws(() => run('a long enough password\nghp_classic\n'));
    assert.equal(readFileSync(file, 'utf8'), start, 'a refused attempt changes nothing');

    run(`a long enough password\n${FAKE_TOKEN}\n`);
    const text = readFileSync(file, 'utf8');
    assert.equal(await openGroupAccess('a long enough password', JSON.parse(text).groupAccess), FAKE_TOKEN);
    assert.ok(!text.includes(FAKE_TOKEN) && !text.includes('a long enough password'));
    const withoutAccess = (json) => json.replace(/"groupAccess": (null|\{[^}]*\})/, '"groupAccess": null');
    assert.equal(withoutAccess(text), withoutAccess(start), 'only the access line changes');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the set-admin-access script gives admins their own copy of the token, without needing the token', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-admin-access-'));
  try {
    const file = join(dir, 'league.json');
    const groupAccess = await createGroupAccess('a long enough password', FAKE_TOKEN);
    const start = leagueWithoutAdminAccess()
      .replace(/"adminKey": (null|\{[^}]*\})/, `"adminKey": ${JSON.stringify(adminKey)}`)
      .replace(/"groupAccess": (null|\{[^}]*\})/, `"groupAccess": ${JSON.stringify(groupAccess)}`);
    writeFileSync(file, start);
    const scriptPath = (name) => fileURLToPath(new URL(`../scripts/${name}.js`, import.meta.url));
    const run = (name, input) => execFileSync(process.execPath, [scriptPath(name)], { env: { ...process.env, DATA_DIR: dir }, input, encoding: 'utf8', stdio: 'pipe' });

    assert.throws(() => run('set-admin-access', `the wrong password here\n${CODE}\n`), /group password is not right/);
    assert.throws(() => run('set-admin-access', 'a long enough password\nthe wrong code here\n'), /admin code is not right/);
    assert.equal(readFileSync(file, 'utf8'), start, 'a refused attempt changes nothing');

    run('set-admin-access', `a long enough password\n${CODE}\n`);
    const text = readFileSync(file, 'utf8');
    const stored = JSON.parse(text);
    assert.equal(await openGroupAccess(CODE, stored.adminAccess), FAKE_TOKEN, 'the code opens the token');
    assert.equal(await openGroupAccess('a long enough password', stored.adminAccess), null, 'the group password does not open the admin copy');
    assert.equal(await openGroupAccess('a long enough password', stored.groupAccess), FAKE_TOKEN, 'the group copy still works');
    assert.ok(!text.includes(FAKE_TOKEN) && !text.includes(CODE));
    const withoutAccess = (json) => json.replace(/"adminAccess": (null|\{[^}]*\})/, '"adminAccess": null');
    assert.equal(withoutAccess(text), start, 'only the admin access line changes');

    // Either secret changing makes the admin copy out of date, so it is cleared and the script says so.
    assert.throws(() => run('set-admin-code', 'a long enough password\n'), /different from the group password/);
    const afterCode = run('set-admin-code', 'a brand new admin code here\n');
    assert.match(afterCode, /set-admin-access/);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).adminAccess, null);

    run('set-admin-access', 'a long enough password\na brand new admin code here\n');
    const afterPassword = run('set-group-password', `another long password\n${FAKE_TOKEN}\n`);
    assert.match(afterPassword, /set-admin-access/);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).adminAccess, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the set-admin-code script stores a working key in league.json and leaves the rest alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flf-code-'));
  try {
    const before = leagueWithoutAdminAccess();
    writeFileSync(join(dir, 'league.json'), before);
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
    // Start from an empty league, so this does not depend on who has really been added.
    for (const [file, list] of [['profiles.json', 'profiles'], ['games.json', 'games'], ['activity.json', 'activity']]) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      writeFileSync(join(dir, file), JSON.stringify({ ...data, [list]: [] }));
    }
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
    const log = JSON.parse(readFileSync(join(dir, 'activity.json'), 'utf8')).activity;
    assert.equal(log.length, 4);
    assert.ok(log.every((entry) => entry.by === 'first-timer' && entry.issue === 12));

    const refused = run(payload({ deletedGames: [newGame().id] }), 'vandal');
    assert.match(refused, /changed=false/);
    assert.match(refused, /close_reason=not planned/);
    assert.equal(JSON.parse(readFileSync(join(dir, 'games.json'), 'utf8')).games.length, 1);
    assert.match(readFileSync(replyFile, 'utf8'), /needs the admin code/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
