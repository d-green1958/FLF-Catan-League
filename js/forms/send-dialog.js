// Getting a change to the league: the question asked after saving, and the notice shown until it is live.
import { canSendDirectly, groupAccessIsSet, needsCodeFirst, sendDirectly, sendStatus, sendWithGitHubAccount, unlockGroup } from '../data/access.js';
import { settings } from '../data/settings.js';
import { store } from '../data/store.js';
import { describeChanges } from '../domain/submission.js';
import { h } from '../ui/dom.js';
import { field } from '../ui/components.js';
import { confirmAction, toast } from '../ui/feedback.js';
import { plural } from '../ui/format.js';

function passwordStep({ onUnlocked, onBack }) {
  const name = h('input', { class: 'input', maxlength: 60, autocomplete: 'off', value: settings.get('groupMemberName') ?? '', 'aria-label': 'Your name' });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'off', 'aria-label': 'Group password' });
  const problem = h('p', { class: 'field-hint', role: 'alert' });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
  const submit = async (event) => {
    event.preventDefault();
    problem.textContent = '';
    if (!name.value.trim() || !password.value.trim()) {
      problem.textContent = 'Please enter your name and the group password.';
      return;
    }
    button.disabled = true;
    try {
      if (await unlockGroup(password.value, name.value)) {
        settings.set('groupMemberName', name.value.trim());
        onUnlocked();
        return;
      }
      problem.textContent = 'That password is not right.';
      password.select();
    } catch {
      problem.textContent = 'This browser could not check the password. Please try an up-to-date browser.';
    }
    button.disabled = false;
  };
  return h('form', { class: 'send-form', onSubmit: submit },
    h('h2', null, 'Use the group password'),
    h('p', null, 'Your name is shown publicly next to what you add, so a first name or nickname is best. Reloading the page locks this again.'),
    field('Your name', name),
    field('Group password', password),
    problem,
    h('div', { class: 'confirm-acts' },
      h('button', { class: 'btn', type: 'button', onClick: onBack }, 'Back'),
      button));
}

/** Asks how to send the waiting changes. Saying "not now" keeps them in this browser. */
function askHowToSend() {
  const summary = describeChanges(store.pendingPayload());
  let sent = false;
  const dialog = h('dialog', {
    class: 'confirm send-dialog',
    'aria-label': 'Send this to the league',
    onClose: () => {
      dialog.remove();
      if (!sent) toast('Saved in this browser only. Press Send at the top of the page when you are ready.');
    },
  });
  const openGitHub = () => {
    sent = true;
    dialog.close();
    sendWithGitHubAccount();
  };
  const showChoice = () => dialog.replaceChildren(h('div', null,
    h('h2', null, 'Send this to the league'),
    h('p', null, summary),
    groupAccessIsSet()
      ? h('p', null, h('b', null, 'Do you have a GitHub account?'))
      : h('p', null, 'This needs a free GitHub account, and your username is shown next to the entry.'),
    h('div', { class: 'send-choice' },
      h('button', { class: 'btn primary', type: 'button', onClick: openGitHub }, groupAccessIsSet() ? 'Yes, open GitHub' : 'Open GitHub'),
      groupAccessIsSet() && h('button', { class: 'btn', type: 'button', onClick: showPassword }, 'No, use the group password'),
      h('button', { class: 'btn ghost', type: 'button', onClick: () => dialog.close() }, 'Not now'))));
  const showPassword = () => {
    const step = passwordStep({
      onUnlocked: () => {
        sent = true;
        dialog.close();
        sendDirectly();
      },
      onBack: showChoice,
    });
    dialog.replaceChildren(step);
    step.querySelector('input').focus();
  };
  showChoice();
  document.body.append(dialog);
  dialog.showModal();
}

/** Sends the waiting changes, asking how only if it has to. */
export function sendChanges() {
  if (!sendStatus() || needsCodeFirst()) return;
  if (canSendDirectly()) sendDirectly();
  else askHowToSend();
}

/** Call after any change. In the real league it goes on to GitHub, and in the demo it just stays here. */
export function finishChange(message) {
  if (store.mode() === 'demo') toast(message, 'good');
  else sendChanges();
}

async function discardChanges(total) {
  const confirmed = await confirmAction({
    title: 'Discard changes in this browser?',
    message: `This permanently removes ${plural(total, 'unsent change')}. Anything already sent to GitHub is not affected.`,
    confirmLabel: 'Discard changes',
    danger: true,
  });
  if (!confirmed) return;
  store.discardDraft();
  toast('Changes discarded');
}

/** The notice at the top of every page while something has not reached the league yet. */
export function renderSendBar() {
  const bar = document.getElementById('send-bar');
  const status = sendStatus();
  bar.hidden = !status;
  if (!status) {
    bar.replaceChildren();
    return;
  }
  const { state, total, issue, overdue } = status;
  const changes = plural(total, 'change');
  const button = (label, onClick, kind = 'btn sm') => h('button', { class: kind, type: 'button', onClick }, label);
  const discard = button('Discard', () => discardChanges(total), 'btn ghost danger sm');
  const progress = issue && h('a', { class: 'link', href: issue, target: '_blank', rel: 'noopener' }, 'See how it went');

  const views = {
    unsent: [`${changes} not sent to the league yet.`, [button('Send', sendChanges, 'btn primary sm'), discard]],
    locked: [`${changes} waiting for the admin code.`, [h('a', { class: 'btn sm', href: '#/data' }, 'Go to Review'), discard]],
    opened: overdue
      ? [`${changes} still not live. Did you press Submit on GitHub?`, [button('Open GitHub again', sendWithGitHubAccount, 'btn primary sm'), discard]]
      : ['Waiting for you to press Submit on GitHub.', [button('Open GitHub again', sendWithGitHubAccount), discard]],
    sent: overdue
      ? [`${changes} sent but still not live.`, [progress, button('Send again', sendChanges), discard]]
      : ['Sent. The site will update in a few minutes.', [progress]],
  };
  const [message, actions] = views[state];
  bar.replaceChildren(h('span', null, message), h('span', { class: 'send-bar-acts' }, actions));
}
