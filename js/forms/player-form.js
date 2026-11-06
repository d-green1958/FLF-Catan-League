// Register a new player, or edit an existing one.
import { sendingHint } from '../data/access.js';
import { store } from '../data/store.js';
import { validatePlayer } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { errorList, field } from '../ui/components.js';
import { confirmAction, openDrawer, toast } from '../ui/feedback.js';
import { today } from '../ui/format.js';
import { finishChange } from './send-dialog.js';

export function openPlayerForm(existing = null, { onSaved } = {}) {
  openDrawer(existing ? `Edit ${existing.name}` : 'Register a player', (close) => {
    const { colours } = store.reference();
    const errorHolder = h('div');

    const name = h('input', { class: 'input', required: true, maxlength: 60, autocomplete: 'off', value: existing?.name ?? '' });
    const nickname = h('input', { class: 'input', maxlength: 40, autocomplete: 'off', value: existing?.nickname ?? '' });
    const tagline = h('input', { class: 'input', maxlength: 120, autocomplete: 'off', value: existing?.tagline ?? '' });
    const joined = h('input', { class: 'input', type: 'date', value: existing?.joined ?? today() });
    const favouriteColour = h('select', { class: 'select' },
      h('option', { value: '' }, 'No preference'),
      colours.map((colour) => h('option', { value: colour.id, selected: existing?.favouriteColour === colour.id }, colour.name)));
    const active = h('input', { type: 'checkbox', checked: existing ? existing.active !== false : true });

    const submit = (event) => {
      event.preventDefault();
      const player = {
        ...(existing || {}),
        name: name.value.trim(),
        nickname: nickname.value.trim(),
        tagline: tagline.value.trim(),
        joined: joined.value,
        favouriteColour: favouriteColour.value,
        active: active.checked,
      };
      const errors = validatePlayer(player, store.profiles());
      errorHolder.replaceChildren(...[errorList(errors)].filter(Boolean));
      if (errors.length) return;
      const saved = store.savePlayer(player);
      close();
      finishChange(existing ? `${saved.name} updated` : `${saved.name} registered`);
      onSaved?.(saved);
    };

    const remove = async () => {
      if (!store.canDeletePlayer(existing.id)) {
        toast(`${existing.name} has played games, so retire them instead of deleting them.`, 'warn');
        return;
      }
      const confirmed = await confirmAction({
        title: `Delete ${existing.name}?`,
        message: 'This removes their profile. They have not played any games, so no results are affected.',
        confirmLabel: 'Delete player',
        danger: true,
      });
      if (!confirmed) return;
      store.deletePlayer(existing.id);
      close();
      finishChange(`${existing.name} deleted`);
      window.location.hash = '#/players';
    };

    return h('form', { class: 'form', onSubmit: submit, novalidate: true },
      errorHolder,
      field('Name', name, 'The site and repo are public, so a first name or nickname is best.'),
      field('Nickname (optional)', nickname),
      field('Signature move (optional)', tagline, 'For example: "Hoards wheat and calls it strategy."'),
      h('div', { class: 'form-row' },
        field('Favourite colour', favouriteColour),
        field('Joined', joined)),
      h('label', { class: 'switch' }, active, 'Active in the league'),
      h('p', { class: 'field-hint' }, 'Retired players keep their history and drop off the default leaderboard.'),
      store.mode() !== 'demo' && h('p', { class: 'field-hint' }, sendingHint()),
      h('div', { class: 'form-acts' },
        existing && h('button', { class: 'btn ghost danger', type: 'button', onClick: remove }, 'Delete'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onClick: close }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save changes' : 'Register player')));
  });
}
