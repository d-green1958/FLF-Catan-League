// What this browser may do, and how changes get sent to the repo.
//
// Anyone can add players and games, and edit the personal details on a profile. Anything else needs the admin code. Entering it here
// shows every tool and lets this tab sign changes: the real check happens on GitHub, in
// js/domain/submission.js. It also opens the admins' copy of the GitHub token, if one has been set up,
// so an unlocked admin's changes go straight through. Reloading or closing the tab locks it again.
//
// The group password is separate. It lets someone add without a GitHub account, and it is also forgotten
// when the tab closes. It gives no extra rights: the same checks apply on GitHub.
import * as storage from './browser-storage.js';
import { store } from './store.js';
import { signChanges, unlockWithCode } from '../domain/admin-key.js';
import { openGroupAccess } from '../domain/group-access.js';
import { buildIssue, buildIssueLink, fitChanges, fitsInIssue } from '../domain/submission.js';
import { toast } from '../ui/feedback.js';

const SENT_KEY = 'flfoxtan.sent';
const ADMIN_NAME = 'Admin';
// How long before saying sent changes seem overdue. Saving takes about 40 seconds at most.
const OVERDUE_AFTER_MS = 5 * 60 * 1000;
// While waiting on a GitHub tab, the site checks this often. These use up GitHub's allowance, so they stop
// after a while, and start again whenever someone comes back to this tab.
const CHECK_EVERY_MS = 5 * 1000;
const CHECKS_WHEN_WAITING = 12;
// How often an open tab looks for newly published data. These files are free to fetch.
const TICKS_BETWEEN_RELOADS = 6;

let signingKey = null;
let adminToken = null;
let groupToken = null;
let groupName = '';
let sending = false;
let checksLeft = 0;

export const adminCodeIsSet = () => Boolean(store.reference().league.adminKey);
export const isUnlocked = () => Boolean(signingKey);

export const groupAccessIsSet = () => Boolean(store.reference().league.groupAccess);
export const isGroupUnlocked = () => Boolean(groupToken);
export const groupMemberName = () => groupName;

/** True if changes from this tab can go straight to the league, with nothing more to ask. */
export const canSendDirectly = () => Boolean(adminToken || groupToken);
/** True if an admin is unlocked but will still be asked how to send, because no copy of the token was set up. */
export const adminMustChooseRoute = () => isUnlocked() && !canSendDirectly();

/** Returns true if the password is right. */
export async function unlockGroup(password, name) {
  groupToken = await openGroupAccess(password, store.reference().league.groupAccess);
  groupName = groupToken ? name.trim() : '';
  if (groupToken) store.refresh();
  return isGroupUnlocked();
}

export function lockGroup() {
  groupToken = null;
  groupName = '';
  store.refresh();
}

/** Demo mode is always editable, because nothing in it is real. */
export const canManage = () => store.mode() === 'demo' || isUnlocked();

/** Returns true if the code is right. */
export async function unlockAdmin(code) {
  const { adminKey, adminAccess } = store.reference().league;
  signingKey = await unlockWithCode(code, adminKey);
  if (signingKey) {
    adminToken = adminAccess ? await openGroupAccess(code, adminAccess) : null;
    store.refresh();
  }
  return isUnlocked();
}

export function lockAdmin() {
  signingKey = null;
  adminToken = null;
  store.refresh();
}

/** The text that identifies a set of changes inside the issue that carries them. */
const issueText = (changes) => JSON.stringify(changes).slice(0, -1);

/** One string per change, so that what has been sent can be compared with what is still waiting. */
const changeList = (changes) => ['profiles', 'games'].flatMap((collection) => [
  ...changes[collection].saved.map((item) => `${collection}:saved:${JSON.stringify(item)}`),
  ...changes[collection].deleted.map((id) => `${collection}:deleted:${id}`),
]);

function rememberSent(route, changes, issue = null) {
  storage.write(SENT_KEY, { route, changes: changeList(changes), text: issueText(changes), issue, at: Date.now() });
  checksLeft = CHECKS_WHEN_WAITING;
  store.refresh();
}

/**
 * Where this browser's unpublished changes stand:
 *   null      nothing is waiting
 *   'unsent'  they still need sending
 *   'locked'  they need the admin code before they can be sent
 *   'opened'  GitHub was opened, and they may not have pressed Submit yet
 *   'sent'    the issue has been opened, and its result is not known yet
 *   'refused' the league did not accept it, and message says why
 */
export function sendStatus() {
  const pending = store.pendingChanges();
  if (!pending.total || store.mode() === 'demo') return null;
  const sent = storage.read(SENT_KEY);
  const allSent = sent && changeList(store.pendingPayload()).every((change) => sent.changes.includes(change));
  if (allSent && sent.refusal) return { state: 'refused', total: pending.total, issue: sent.refusal.url, message: sent.refusal.message };
  if (allSent) {
    return { state: sent.route, total: pending.total, issue: sent.issue, overdue: Date.now() - sent.at > OVERDUE_AFTER_MS };
  }
  return { state: pending.needsCode && !isUnlocked() ? 'locked' : 'unsent', total: pending.total };
}

/** Reacts as soon as something sent is live or refused, so nobody is left waiting or tempted to send twice. */
function followSent() {
  const sent = storage.read(SENT_KEY);
  if (!sent) return;
  if (!store.pendingChanges().total) {
    storage.remove(SENT_KEY);
    toast('Done. That is live in the league.', 'good');
    return;
  }
  const outcome = sent.refusal ? null : store.issueOutcome(sent.text);
  if (outcome && !outcome.accepted) {
    storage.write(SENT_KEY, { ...sent, refusal: { message: outcome.message, url: outcome.url } });
    toast('The league did not accept that. The notice at the top says why.', 'warn');
    store.refresh();
  }
}

const waitingOnGitHub = () => ['opened', 'sent'].includes(sendStatus()?.state);

/** Keeps this tab up to date for as long as it is being looked at. */
export function startLiveUpdates() {
  store.subscribe(followSent);
  if (store.mode() === 'demo') return;
  const reload = () => store.reloadPublished().catch(() => {});
  let tick = 0;
  store.checkIssues();
  setInterval(() => {
    if (document.hidden) return;
    tick += 1;
    if (tick % TICKS_BETWEEN_RELOADS === 0) reload();
    if (checksLeft > 0 && waitingOnGitHub()) {
      checksLeft -= 1;
      store.checkIssues({ now: true });
    }
  }, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    reload();
    if (waitingOnGitHub()) {
      checksLeft = CHECKS_WHEN_WAITING;
      store.checkIssues({ now: true });
    } else {
      store.checkIssues();
    }
  });
}

/** Changes to what is already in the league cannot be sent while locked. Returns true if that is the case. */
export function needsCodeFirst() {
  if (!store.pendingChanges().needsCode || isUnlocked()) return false;
  toast('Some of these changes need the admin code. Enter it on the Review page, or discard them.', 'warn');
  window.location.hash = '#/data';
  return true;
}

/** Opens the issue directly, with no GitHub account needed. The changes stay in the draft if this fails. */
export async function sendDirectly() {
  if (sending) return;
  sending = true;
  try {
    const { owner, name } = store.reference().league.repository;
    const { changes, left } = fitChanges(store.pendingPayload(), (fitted) => fitsInIssue(fitted, { signed: isUnlocked() }));
    const authorisation = isUnlocked() ? await signChanges(signingKey, changes) : null;
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}/issues`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${adminToken ?? groupToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIssue(changes, { authorisation, submittedBy: adminToken ? ADMIN_NAME : groupName })),
    });
    if (!response.ok) {
      // Forgetting the token means pressing Send again offers the GitHub account route instead.
      adminToken = null;
      groupToken = null;
      groupName = '';
      store.refresh();
      toast('GitHub refused that, so please tell an admin. Your changes are safe here, and you can send them with a GitHub account.', 'warn');
      return;
    }
    const issue = await response.json();
    rememberSent('sent', changes, issue.html_url);
    await store.addIssue(issue);
    if (left) toast(`Sent, but ${left} more did not fit. Press Send for the rest.`, 'warn');
  } catch {
    toast('Could not reach GitHub. Your changes are safe here, so press Send to try again.', 'warn');
  } finally {
    sending = false;
  }
}

/** Opens GitHub with the issue filled in. Must run directly from a click, or browsers block the tab. */
export async function sendWithGitHubAccount() {
  if (needsCodeFirst()) return;
  // The tab has to open before anything asynchronous happens, or browsers treat it as an unwanted pop-up.
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
    toast('Your browser blocked the GitHub tab. Allow pop-ups for this site, then press Send.', 'warn');
    return;
  }
  tab.opener = null;

  const { repository } = store.reference().league;
  const { changes, left } = fitChanges(store.pendingPayload(), (fitted) => fitsInIssue(fitted, { signed: isUnlocked(), viaLink: repository }));
  const authorisation = isUnlocked() ? await signChanges(signingKey, changes) : null;
  const link = buildIssueLink(repository, changes, authorisation);
  if (!link || !changeList(changes).length) {
    tab.close();
    toast('That is too much to send through GitHub in one go. Please use the group password instead.', 'warn');
    return;
  }
  tab.location.href = link.url;
  rememberSent('opened', changes);
  toast(left ? `Press the green button on GitHub, then come back and press Send for the other ${left}.` : 'Press the green button on GitHub, then come back here.', 'good');
}

/** The line on each form that says what happens when it is saved. */
export function sendingHint() {
  if (adminToken) return 'This goes straight into the league.';
  if (groupToken) return `This goes straight into the league, under the name ${groupName}.`;
  return 'Next, you choose how to send this to the league.';
}
