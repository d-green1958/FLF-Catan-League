// Review: everything added, corrected and removed, which admins can correct or remove after entering the code.
import { adminCodeIsSet, adminMustChooseRoute, canManage, groupAccessIsSet, groupMemberName, isGroupUnlocked, isUnlocked, lockAdmin, lockGroup, unlockAdmin } from '../data/access.js';
import { store } from '../data/store.js';
import { MIN_CODE_LENGTH } from '../domain/admin-key.js';
import { validateDataset } from '../domain/validate.js';
import { openGameForm } from '../forms/game-form.js';
import { openPlayerForm } from '../forms/player-form.js';
import { finishChange } from '../forms/send-dialog.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { errorList, page, playerLink, pageHeader, sectionHeader, table } from '../ui/components.js';
import { confirmAction, downloadText, toast } from '../ui/feedback.js';
import { byLabel, formatDate } from '../ui/format.js';
import { openGameDetail } from './games.js';

const ACTIONS = {
  added: { label: 'Added', badge: 'accent' },
  corrected: { label: 'Corrected', badge: 'warn' },
  removed: { label: 'Removed', badge: 'muted' },
};

async function removeItem({ type, item, label }) {
  if (type === 'player' && !store.canDeletePlayer(item.id)) {
    toast(`${label} has played games, so remove those games first.`, 'warn');
    return;
  }
  const confirmed = await confirmAction({
    title: `Remove ${label}?`,
    message: type === 'game'
      ? 'This removes the game and recalculates every rating without it.'
      : 'This removes their profile. They have no games, so no results are affected.',
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!confirmed) return;
  if (type === 'game') store.deleteGame(item.id);
  else store.deletePlayer(item.id);
  finishChange(`${label} removed`);
}

function activityActions(entry, item) {
  const isGame = entry.type === 'game';
  const label = isGame ? `the game from ${formatDate(item.date)}` : item.name;
  return h('span', { class: 'row-actions' },
    h('button', { class: 'btn ghost sm', type: 'button', onClick: () => (isGame ? openGameForm(item) : openPlayerForm(item)) }, 'Edit'),
    h('button', { class: 'btn ghost danger sm', type: 'button', onClick: () => removeItem({ type: entry.type, item, label }) }, 'Remove'));
}

function activityRow(entry, showActions) {
  const isGame = entry.type === 'game';
  const item = isGame ? store.game(entry.id) : store.player(entry.id);
  const { owner, name } = store.reference().league.repository;
  const issueLink = entry.issue && `https://github.com/${owner}/${name}/issues/${entry.issue}`;
  // Labels are stored with the date as written in the data, so show it the way the rest of the site does.
  const label = entry.label.replace(/\d{4}-\d{2}-\d{2}/, formatDate);
  const what = () => {
    if (!item) return h('span', null, label);
    return isGame
      ? h('button', { class: 'link-btn', type: 'button', onClick: () => openGameDetail(item.id) }, label)
      : h('span', null, 'Player: ', playerLink(item));
  };
  return [
    h('span', { class: 'nowrap' }, formatDate(entry.at.slice(0, 10))),
    h('span', { class: `badge ${ACTIONS[entry.action].badge}` }, ACTIONS[entry.action].label),
    what(),
    issueLink ? h('a', { class: 'link', href: issueLink, target: '_blank', rel: 'noopener' }, byLabel(entry)) : byLabel(entry),
    canManage() && showActions && item ? activityActions(entry, item) : null,
  ];
}

function activityList() {
  const entries = store.activity();
  // Each item gets its buttons once, on its newest row, as they all act on the item as it is now.
  const seen = new Set();
  const rows = entries.map((entry) => {
    const key = `${entry.type}:${entry.id}`;
    const newest = !seen.has(key);
    seen.add(key);
    return activityRow(entry, newest);
  });
  return [
    sectionHeader('Activity', canManage()
      ? 'Editing or removing something recalculates the ratings straight away.'
      : 'Everything goes live straight away. Admins check this list and correct or remove anything spurious.'),
    entries.length
      ? h('div', { class: 'card' }, table(
        [{ label: 'When' }, { label: 'Action' }, { label: 'What' }, { label: 'By' }, { label: '' }],
        rows))
      : h('p', { class: 'prose' }, 'Nothing has happened yet.'),
  ];
}

function groupCard() {
  if (store.mode() === 'demo' || !groupAccessIsSet() || !isGroupUnlocked()) return null;
  return h('div', { class: 'card card-b admin-card' },
    h('b', null, `Sending as ${groupMemberName()}`),
    h('p', { class: 'field-hint' }, 'What you add in this tab goes straight to the league under this name. Reloading or closing the tab locks it again.'),
    h('div', null, h('button', { class: 'btn', type: 'button', onClick: lockGroup }, 'Lock')));
}

function unlockForm() {
  const code = h('input', { class: 'input', type: 'password', autocomplete: 'off', 'aria-label': 'Admin code' });
  const problem = h('p', { class: 'field-hint', role: 'alert' });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Unlock');
  const submit = async (event) => {
    event.preventDefault();
    if (!code.value.trim()) return;
    button.disabled = true;
    problem.textContent = '';
    try {
      if (!await unlockAdmin(code.value)) {
        problem.textContent = 'That code is not right.';
        code.select();
      }
    } catch {
      problem.textContent = 'This browser could not check the code. Please try an up-to-date browser.';
    }
    button.disabled = false;
  };
  return h('form', { class: 'code-form', onSubmit: submit }, code, button, problem);
}

function adminCard() {
  if (store.mode() === 'demo') return null;
  if (!adminCodeIsSet()) {
    return h('div', { class: 'card card-b admin-card' },
      h('p', { class: 'field-hint' }, `No admin code has been set yet, so nothing can be corrected or removed. To set one of at least ${MIN_CODE_LENGTH} characters, run scripts/set-admin-code.js and commit the result.`));
  }
  return isUnlocked()
    ? h('div', { class: 'card card-b admin-card' },
      h('b', null, 'Unlocked as an admin in this tab'),
      h('p', { class: 'field-hint' }, adminMustChooseRoute()
        ? 'You can edit and remove things below. You will be asked how to send each change until scripts/set-admin-access.js has been run. Reloading or closing this tab locks it again.'
        : 'You can edit and remove things below, and your changes go straight to the league. Reloading or closing this tab locks it again.'),
      h('div', null, h('button', { class: 'btn', type: 'button', onClick: lockAdmin }, 'Lock')))
    : h('div', { class: 'card card-b admin-card' },
      h('p', { class: 'field-hint' }, 'Admins: enter the code to correct or remove anything here. Your code is never sent anywhere: this browser uses it to sign your changes, and GitHub checks the signature.'),
      unlockForm());
}

function dataProblems() {
  const { colours, league } = store.reference();
  const issues = validateDataset(
    { profiles: store.profiles(), games: store.games() },
    { colours, settings: league.settings },
  );
  return issues.length > 0 && h('div', { class: 'note warn' }, h('b', null, 'Problems found in the data'), errorList(issues));
}

function backupCard() {
  return [
    sectionHeader('Backups and manual edits'),
    h('p', { class: 'prose' }, 'A backup holds all your players and games in one file. To edit the data by hand instead, download the two data files, change them, and commit them to the data folder.'),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('flfoxtan-backup.json', store.backupJson()) }, icon('save'), 'Download backup'),
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('profiles.json', store.exportJson('profiles')) }, icon('save'), 'profiles.json'),
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('games.json', store.exportJson('games')) }, icon('save'), 'games.json'),
      importButton()),
  ];
}

function importButton() {
  const input = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: async (event) => {
      const [file] = event.target.files;
      event.target.value = '';
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = { profiles: parsed.profiles ?? [], games: parsed.games ?? [] };
        if (!Array.isArray(incoming.profiles) || !Array.isArray(incoming.games) || (!incoming.profiles.length && !incoming.games.length)) {
          throw new Error('That file has no players or games in it.');
        }
        // The file is checked against the data it would create, so a bad one changes nothing.
        const { colours, league } = store.reference();
        const byId = (items) => new Map(items.map((item) => [item.id, item]));
        const combined = {
          profiles: [...new Map([...byId(store.profiles()), ...byId(incoming.profiles)]).values()],
          games: [...new Map([...byId(store.games()), ...byId(incoming.games)]).values()],
        };
        const issues = validateDataset(combined, { colours, settings: league.settings });
        if (issues.length) throw new Error(`That file has problems: ${issues[0]}`);

        const confirmed = await confirmAction({
          title: 'Import this file?',
          message: `It holds ${incoming.profiles.length} players and ${incoming.games.length} games. Any with the same id as existing ones will be replaced. They stay in this browser until you send them.`,
          confirmLabel: 'Import',
        });
        if (!confirmed) return;
        store.importData(incoming);
        finishChange('Imported');
      } catch (error) {
        toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message, 'warn');
      }
    },
  });
  return h('span', null, input,
    h('button', { class: 'btn', type: 'button', onClick: () => input.click() }, 'Import a file'));
}

function demoCard() {
  if (store.mode() === 'demo') {
    return h('div', { class: 'note warn' },
      h('b', null, 'You are in demo mode'),
      h('p', null, 'Everything on the site is made up, and anything you add or remove here is thrown away when you leave. Nothing goes to GitHub, and the admin tools are open so you can try them.'),
      h('button', { class: 'btn', type: 'button', onClick: () => store.exitDemo() }, 'Leave demo'));
  }
  return [
    sectionHeader('Demo mode'),
    h('p', { class: 'prose' }, 'See the site full of made-up players and games, and try out the forms. The real league stays untouched and comes straight back when you leave.'),
    h('button', { class: 'btn', type: 'button', onClick: () => store.enterDemo() }, icon('flask'), 'Try the demo'),
  ];
}

export function renderData() {
  const liveAdmin = store.mode() !== 'demo' && isUnlocked();
  return page(
    pageHeader({
      eyebrow: 'Keeping the record',
      title: 'Review',
      intro: 'Everything added to the league, and by whom. Admins can correct or remove any of it.',
    }),
    adminCard(),
    groupCard(),
    liveAdmin && dataProblems(),
    activityList(),
    liveAdmin && backupCard(),
    demoCard());
}
