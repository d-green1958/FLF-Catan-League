// Register players, or edit a profile. Anyone can edit the personal details on a profile.
// Name, joining date, retirement and deletion need the admin code.
import { canManage, sendingHint } from '../data/access.js';
import { store } from '../data/store.js';
import { validatePlayer } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { avatar, errorList, field } from '../ui/components.js';
import { confirmAction, openDrawer, toast } from '../ui/feedback.js';
import { plural, today } from '../ui/format.js';
import { photoFromFile } from '../ui/photo.js';
import { finishChange } from './send-dialog.js';

/** Someone else may have registered since this page loaded, so check before saying a name is free. */
const catchUp = () => Promise.all([store.reloadPublished().catch(() => {}), store.checkIssues({ now: true })]);

function optionsSelect(options, selected, emptyLabel) {
  return h('select', { class: 'select' },
    h('option', { value: '' }, emptyLabel),
    options.map((option) => h('option', { value: option.id, selected: selected === option.id }, option.name)));
}

/** Choosing, previewing and removing a photo. */
function photoPicker(name, startingPhoto) {
  let photo = startingPhoto ?? '';
  const preview = h('span', { class: 'photo-preview' });
  const problem = h('span', { class: 'field-hint', role: 'alert' });
  const removeButton = h('button', { class: 'btn ghost sm', type: 'button', onClick: () => setPhoto('') }, 'Remove photo');
  const input = h('input', {
    class: 'visually-hidden', type: 'file', accept: 'image/*', 'aria-label': 'Choose a photo',
    onChange: async () => {
      const [file] = input.files;
      input.value = '';
      if (!file) return;
      problem.textContent = 'Shrinking the picture…';
      try {
        setPhoto(await photoFromFile(file));
        problem.textContent = '';
      } catch (error) {
        problem.textContent = error.message;
      }
    },
  });
  const setPhoto = (value) => {
    photo = value;
    preview.replaceChildren(avatar({ name: name.value.trim() || '?', photo }, 'xl'));
    removeButton.hidden = !photo;
  };
  setPhoto(photo);
  return {
    element: h('div', { class: 'field' },
      h('span', { class: 'field-label' }, 'Photo (optional)'),
      h('div', { class: 'photo-picker' },
        preview,
        h('div', { class: 'photo-acts' },
          h('label', { class: 'btn sm' }, input, 'Choose a photo'),
          removeButton)),
      problem,
      h('span', { class: 'field-hint' }, 'It is cropped to a small square. The site and repo are public, and a photo stays in the repo’s history even after it is removed, so use one you are happy to share. A cartoon works too.')),
    value: () => photo,
    clear: () => setPhoto(''),
  };
}

export function openPlayerForm(existing = null, { onSaved } = {}) {
  openDrawer(existing ? `Edit ${existing.name}` : 'Register a player', (close) => {
    const { colours, profileOptions } = store.reference();
    const errorHolder = h('div');
    // Anyone can edit the personal details, but only admins can change the rest of a live profile.
    const locked = Boolean(existing) && !canManage();
    let added = [];

    const name = h('input', { class: 'input', required: true, maxlength: 60, autocomplete: 'off', value: existing?.name ?? '', disabled: locked });
    const nickname = h('input', { class: 'input', maxlength: 40, autocomplete: 'off', value: existing?.nickname ?? '' });
    const tagline = h('input', { class: 'input', maxlength: 120, autocomplete: 'off', value: existing?.tagline ?? '' });
    const bio = h('textarea', { class: 'input', rows: 3, maxlength: 280 }, existing?.bio ?? '');
    const picker = photoPicker(name, existing?.photo);
    const joined = h('input', { class: 'input', type: 'date', value: existing?.joined ?? today(), disabled: locked });
    const favouriteColour = h('select', { class: 'select' },
      h('option', { value: '' }, 'No preference'),
      colours.map((colour) => h('option', { value: colour.id, selected: existing?.favouriteColour === colour.id }, colour.name)));
    const favouriteResource = optionsSelect(profileOptions.resources, existing?.favouriteResource, 'No preference');
    const playStyle = optionsSelect(profileOptions.playStyles, existing?.playStyle, 'Keeping that secret');
    const active = h('input', { type: 'checkbox', checked: existing ? existing.active !== false : true, disabled: locked });
    const addedNote = h('p', { class: 'field-hint', role: 'status' });
    const doneButton = h('button', { class: 'btn', type: 'button', onClick: () => done() }, 'Cancel');

    const done = () => {
      close();
      if (added.length) finishChange(`${plural(added.length, 'player')} registered`);
    };

    const buildPlayer = () => {
      // Optional extras are left out when empty, so opening and saving a profile does not count as a change.
      const extras = { bio: bio.value.trim(), photo: picker.value(), favouriteResource: favouriteResource.value, playStyle: playStyle.value };
      const player = {
        ...(existing || {}),
        name: name.value.trim(),
        nickname: nickname.value.trim(),
        tagline: tagline.value.trim(),
        joined: joined.value,
        favouriteColour: favouriteColour.value,
        active: active.checked,
      };
      for (const [key, value] of Object.entries(extras)) {
        if (value) player[key] = value;
        else delete player[key];
      }
      return player;
    };

    const clearForNext = () => {
      for (const input of [name, nickname, tagline, bio]) input.value = '';
      for (const select of [favouriteColour, favouriteResource, playStyle]) select.value = '';
      picker.clear();
      addedNote.textContent = `Ready to send: ${added.join(', ')}.`;
      doneButton.textContent = `Done, send ${added.length}`;
      name.focus();
    };

    const submit = async (event) => {
      event.preventDefault();
      const addAnother = event.submitter?.dataset.another === 'yes';
      if (!existing) await catchUp();
      const player = buildPlayer();
      const errors = validatePlayer(player, store.profiles());
      errorHolder.replaceChildren(...[errorList(errors)].filter(Boolean));
      if (errors.length) return;
      const saved = store.savePlayer(player);
      if (addAnother) {
        added = [...added, saved.name];
        clearForNext();
        return;
      }
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
      field('Name', name, locked ? 'Only an admin can change a name.' : 'The site and repo are public, so a first name or nickname is best.'),
      picker.element,
      field('Nickname (optional)', nickname),
      field('Signature move (optional)', tagline, 'For example: "Hoards wheat and calls it strategy."'),
      field('About (optional)', bio, 'A line or two: how you got into Catan, your proudest win, your excuses.'),
      h('div', { class: 'form-row' },
        field('Favourite colour', favouriteColour),
        field('Favourite resource', favouriteResource)),
      h('div', { class: 'form-row' },
        field('Play style', playStyle),
        field('Joined', joined)),
      h('label', { class: 'switch' }, active, 'Active in the league'),
      h('p', { class: 'field-hint' }, locked
        ? 'Only an admin can change the joining date, retire a player or delete a profile.'
        : 'Retired players keep their history and drop off the default leaderboard.'),
      store.mode() !== 'demo' && h('p', { class: 'field-hint' }, sendingHint()),
      addedNote,
      h('div', { class: 'form-acts wrap' },
        existing && !locked && h('button', { class: 'btn ghost danger', type: 'button', onClick: remove }, 'Delete'),
        h('span', { class: 'spacer' }),
        doneButton,
        !existing && h('button', { class: 'btn', type: 'submit', 'data-another': 'yes' }, 'Save and add another'),
        h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save changes' : 'Register player')));
  });
}

/** Registers a whole list of names in one go, which then sends as one submission. */
export function openRegisterSeveral() {
  openDrawer('Register several players', (close) => {
    const errorHolder = h('div');
    const names = h('textarea', { class: 'input', rows: 8, 'aria-label': 'Names' });
    const submit = async (event) => {
      event.preventDefault();
      await catchUp();
      const list = names.value.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean);
      const players = list.map((name) => ({ name, nickname: '', tagline: '', joined: today(), favouriteColour: '', active: true }));
      const errors = players.length ? [] : ['Add at least one name.'];
      // Earlier names on the list get a stand-in id, so that a name typed twice counts as a clash.
      players.forEach((player, index) => {
        const earlier = players.slice(0, index).map((other, position) => ({ ...other, id: `line-${position}` }));
        errors.push(...validatePlayer(player, [...store.profiles(), ...earlier]));
      });
      errorHolder.replaceChildren(...[errorList(errors)].filter(Boolean));
      if (errors.length) return;
      for (const player of players) store.savePlayer(player);
      close();
      finishChange(`${plural(players.length, 'player')} registered`);
    };
    return h('form', { class: 'form', onSubmit: submit, novalidate: true },
      errorHolder,
      field('Names', names, 'One per line, or separated by commas. Everyone can add a photo and the rest to their own profile afterwards. The site and repo are public, so first names or nicknames are best.'),
      store.mode() !== 'demo' && h('p', { class: 'field-hint' }, sendingHint()),
      h('div', { class: 'form-acts' },
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onClick: close }, 'Cancel'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Register everyone')));
  });
}
