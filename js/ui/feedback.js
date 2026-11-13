// Things that pop up: side panels, confirmation prompts and toast messages.
// The native <dialog> element handles focus and the Escape key for us.
import { h } from './dom.js';
import { icon } from './icons.js';

/** Opens a panel from the right-hand side. Returns a function that closes it. */
export function openDrawer(title, content) {
  const close = () => dialog.close();
  const dialog = h('dialog', {
    class: 'drawer',
    'aria-label': title,
    onClose: () => dialog.remove(),
    // A click on the dimmed backdrop lands on the dialog element itself.
    onClick: (event) => { if (event.target === dialog) close(); },
  },
    h('div', { class: 'drawer-inner' },
      h('header', { class: 'drawer-head' },
        // Focus starts on the title, so the panel opens without a focus ring on the Close button.
        h('h2', { tabindex: '-1', autofocus: true }, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: close }, icon('x'))),
      h('div', { class: 'drawer-body' }, typeof content === 'function' ? content(close) : content)));
  document.body.append(dialog);
  dialog.showModal();
  return close;
}

/** Asks for confirmation. Resolves true only if the person clicks the confirm button. */
export function confirmAction({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const dialog = h('dialog', {
      class: 'confirm',
      'aria-label': title,
      onClose: () => { dialog.remove(); resolve(answer); },
    },
      h('h2', null, title),
      h('p', null, message),
      h('div', { class: 'confirm-acts' },
        h('button', { class: 'btn', type: 'button', onClick: () => dialog.close() }, 'Cancel'),
        h('button', {
          class: `btn ${danger ? 'danger-solid' : 'primary'}`,
          type: 'button',
          onClick: () => { answer = true; dialog.close(); },
        }, confirmLabel)));
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function toast(message, kind = 'info') {
  const holder = document.getElementById('toasts');
  const note = h('div', { class: `toast ${kind}` }, message);
  holder.append(note);
  setTimeout(() => note.remove(), 3800);
}

/** Starts a file download in the browser. */
export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
