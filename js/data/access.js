// What this browser may do, and how changes get sent to the repo.
//
// Anyone can add players and games. Correcting or removing them needs the admin code. Entering it here
// shows the tools and lets this tab sign changes: the real check happens on GitHub, in
// js/domain/submission.js. It also opens the admins' copy of the GitHub token, if one has been set up,
// so an unlocked admin's changes go straight through. Reloading or closing the tab locks it again.
//
// The group password is separate. It lets someone add without a GitHub account, and it is also forgotten
// when the tab closes. It gives no extra rights: the same checks apply on GitHub.
import * as storage from './browser-storage.js';
import { store } from './store.js';
import { signChanges, unlockWithCode } from '../domain/admin-key.js';
import { openGroupAccess } from '../domain/group-access.js';
import { buildIssue, buildIssueLink } from '../domain/submission.js';
import { toast } from '../ui/feedback.js';

const SENT_KEY = 'flfoxtan.sent';
const ADMIN_NAME = 'Admin';
// How often to check whether sent changes are live, and how long before saying they seem overdue.
const CHECK_EVERY_MS = 20 * 1000;
const OVERDUE_AFTER_MS = 10 * 60 * 1000;

let signingKey = null;
let adminToken = null;
let groupToken = null;
let groupName = '';
let sending = false;
let watcher = null;

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

/** One string per change, so that what has been sent can be compared with what is still waiting. */
const changeList = (changes) => ['profiles', 'games'].flatMap((collection) => [
  ...changes[collection].saved.map((item) => `${collection}:saved:${JSON.stringify(item)}`),
  ...changes[collection].deleted.map((id) => `${collection}:deleted:${id}`),
]);

function rememberSent(route, changes, issue = null) {
  storage.write(SENT_KEY, { route, changes: changeList(changes), issue, at: Date.now() });
  watchUntilLive();
  store.refresh();
}

/**
 * Where this browser's unpublished changes stand:
 *   null      nothing is waiting
 *   'unsent'  they still need sending
 *   'locked'  they need the admin code before they can be sent
 *   'opened'  GitHub was opened, and they may not have pressed Submit yet
 *   'sent'    the issue has been opened, and the Action has it
 */
export function sendStatus() {
  const pending = store.pendingChanges();
  if (!pending.total || store.mode() === 'demo') return null;
  const sent = storage.read(SENT_KEY);
  const allSent = sent && changeList(store.pendingPayload()).every((change) => sent.changes.includes(change));
  if (allSent) {
    return { state: sent.route, total: pending.total, issue: sent.issue, overdue: Date.now() - sent.at > OVERDUE_AFTER_MS };
  }
  return { state: pending.needsCode && !isUnlocked() ? 'locked' : 'unsent', total: pending.total };
}

/** Clears the notice by itself once the site has republished, so nobody is tempted to send twice. */
export function watchUntilLive() {
  if (watcher || store.mode() === 'demo' || !store.pendingChanges().total) return;
  const started = Date.now();
  const stop = () => { clearInterval(watcher); watcher = null; };
  watcher = setInterval(async () => {
    try {
      await store.reloadPublished();
    } catch {
      return;
    }
    if (!store.pendingChanges().total) {
      stop();
      storage.remove(SENT_KEY);
      toast('That is now live on the site.', 'good');
    } else if (Date.now() - started > OVERDUE_AFTER_MS) {
      stop();
      store.refresh();
    }
  }, CHECK_EVERY_MS);
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
    const changes = store.pendingPayload();
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
    rememberSent('sent', changes, (await response.json()).html_url);
    toast('Sent. The site will update in a few minutes.', 'good');
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

  const changes = store.pendingPayload();
  const authorisation = isUnlocked() ? await signChanges(signingKey, changes) : null;
  const link = buildIssueLink(store.reference().league.repository, changes, authorisation);
  if (!link) {
    tab.close();
    toast('Too many changes for one submission. Discard them and send them in smaller batches.', 'warn');
    return;
  }
  tab.location.href = link.url;
  rememberSent('opened', changes);
  toast('Nearly done: press Submit on the GitHub tab.', 'good');
}

/** The line on each form that says what happens when it is saved. */
export function sendingHint() {
  if (adminToken) return 'This goes straight to the league.';
  if (groupToken) return `This goes straight to the league, shown as added by ${groupName}.`;
  return 'Next, you choose how to send this to the league.';
}
