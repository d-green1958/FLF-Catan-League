// Who sees the editing tools, and how an admin's changes get sent to the repo.
//
// Admin mode only shows or hides buttons. A static site cannot tell who is using it, so this is not
// security: the real check happens on GitHub, in js/domain/submission.js.
import { store } from './store.js';
import { settings } from './settings.js';
import { buildIssueLink } from '../domain/submission.js';
import { toast } from '../ui/feedback.js';

/** Demo mode is always editable, because nothing in it is real. */
export const canEdit = () => store.mode() === 'demo' || Boolean(settings.get('adminMode'));

/** Opens GitHub with the waiting changes filled in. Must run directly from a click, or browsers block the tab. */
export function publishChanges() {
  if (!store.pendingChanges().total) {
    toast('There is nothing to publish.');
    return;
  }
  const link = buildIssueLink(store.reference().league.repository, store.pendingPayload());
  if (!link) {
    toast('Too many changes for one submission. Download the files on the Admin page and commit them instead.', 'warn');
    return;
  }
  const tab = window.open(link.url, '_blank');
  if (tab) {
    tab.opener = null;
    toast('Nearly done: press Submit on the GitHub tab.', 'good');
  } else {
    toast('Your browser blocked the GitHub tab. Press Publish on the Admin page instead.', 'warn');
  }
}

/** Call after any admin change. In the real league it goes on to GitHub, and in the demo it just stays here. */
export function finishChange(message) {
  if (store.mode() === 'demo') toast(message, 'good');
  else publishChanges();
}
