// What this browser may do, and how changes get sent to the repo.
//
// Anyone can add players and games. Correcting or removing them needs the admin code. Entering it here
// only shows the tools and lets this tab sign changes: the real check happens on GitHub, in
// js/domain/submission.js. The key is held in memory, so reloading or closing the tab locks it again.
//
// The group password is separate. It lets someone add without a GitHub account, and it is also forgotten
// when the tab closes. It gives no extra rights: the same checks apply on GitHub.
import { store } from './store.js';
import { signChanges, unlockWithCode } from '../domain/admin-key.js';
import { openGroupAccess } from '../domain/group-access.js';
import { buildIssue, buildIssueLink } from '../domain/submission.js';
import { toast } from '../ui/feedback.js';

let signingKey = null;
let groupToken = null;
let groupName = '';
let lastSentIssue = null;

export const adminCodeIsSet = () => Boolean(store.reference().league.adminKey);
export const isUnlocked = () => Boolean(signingKey);

export const groupAccessIsSet = () => Boolean(store.reference().league.groupAccess);
export const isGroupUnlocked = () => Boolean(groupToken);
export const groupMemberName = () => groupName;
/** The link to what was last sent with the group password, as the sender has no other way to see the reply. */
export const sentIssue = () => lastSentIssue;

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
  signingKey = await unlockWithCode(code, store.reference().league.adminKey);
  if (signingKey) store.refresh();
  return isUnlocked();
}

export function lockAdmin() {
  signingKey = null;
  store.refresh();
}

/** Opens the issue directly, with no GitHub account needed. The changes stay in the draft if this fails. */
async function sendWithGroupToken(changes, authorisation) {
  const { owner, name } = store.reference().league.repository;
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${owner}/${name}/issues`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${groupToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIssue(changes, { authorisation, submittedBy: groupName })),
    });
  } catch {
    toast('Could not reach GitHub. Your changes are safe here, so try Publish again on the Review page.', 'warn');
    return;
  }
  if (!response.ok) {
    // Forgetting the token means pressing Publish again uses the GitHub account route instead.
    groupToken = null;
    groupName = '';
    store.refresh();
    toast('The group password route is not working, so please tell an admin. Your changes are safe here, and you can publish them with a GitHub account on the Review page.', 'warn');
    return;
  }
  lastSentIssue = (await response.json()).html_url;
  store.refresh();
  toast('Sent. The site will update in a few minutes.', 'good');
}

/** Sends the waiting changes to GitHub. Must run directly from a click, or browsers block the tab. */
export async function publishChanges() {
  const pending = store.pendingChanges();
  if (!pending.total) {
    toast('There is nothing to publish.');
    return;
  }
  if (pending.needsCode && !isUnlocked()) {
    toast('Some of these changes need the admin code. Enter it on the Review page, or discard them there.', 'warn');
    window.location.hash = '#/data';
    return;
  }

  if (isGroupUnlocked()) {
    const changes = store.pendingPayload();
    await sendWithGroupToken(changes, pending.needsCode ? await signChanges(signingKey, changes) : null);
    return;
  }

  // The tab has to open before anything asynchronous happens, or browsers treat it as an unwanted pop-up.
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
    toast('Your browser blocked the GitHub tab. Press Publish on the Review page instead.', 'warn');
    return;
  }
  tab.opener = null;

  const changes = store.pendingPayload();
  const authorisation = pending.needsCode ? await signChanges(signingKey, changes) : null;
  const link = buildIssueLink(store.reference().league.repository, changes, authorisation);
  if (!link) {
    tab.close();
    toast('Too many changes for one submission. Discard some on the Review page and send them in smaller batches.', 'warn');
    return;
  }
  tab.location.href = link.url;
  toast('Nearly done: press Submit on the GitHub tab.', 'good');
}

/** The line on each form that says what happens when it is saved. */
export function sendingHint(what) {
  if (isGroupUnlocked()) return `This goes straight to the league, shown as added by ${groupName}.`;
  const noAccount = groupAccessIsSet() ? ' No GitHub account? Enter the group password on the Review page first.' : '';
  return `Next, GitHub opens with ${what} filled in, and you press Submit to confirm it. You need a free GitHub account, and your username is shown next to the entry.${noAccount}`;
}

/** Call after any change. In the real league it goes on to GitHub, and in the demo it just stays here. */
export function finishChange(message) {
  if (store.mode() === 'demo') toast(message, 'good');
  else publishChanges();
}
