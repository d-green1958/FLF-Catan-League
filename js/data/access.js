// What this browser may do, and how changes get sent to the repo.
//
// Anyone can add players and games. Correcting or removing them needs the admin code. Entering it here
// only shows the tools and lets this tab sign changes: the real check happens on GitHub, in
// js/domain/submission.js. The key is held in memory, so reloading or closing the tab locks it again.
import { store } from './store.js';
import { signChanges, unlockWithCode } from '../domain/admin-key.js';
import { buildIssueLink } from '../domain/submission.js';
import { toast } from '../ui/feedback.js';

let signingKey = null;

export const adminCodeIsSet = () => Boolean(store.reference().league.adminKey);
export const isUnlocked = () => Boolean(signingKey);

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

/** Opens GitHub with the waiting changes filled in. Must run directly from a click, or browsers block the tab. */
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

/** Call after any change. In the real league it goes on to GitHub, and in the demo it just stays here. */
export function finishChange(message) {
  if (store.mode() === 'demo') toast(message, 'good');
  else publishChanges();
}
