// Review: anyone can see what has been added and send their own changes, and admins can remove things.
import { adminCodeIsSet, canManage, groupAccessIsSet, groupMemberName, isGroupUnlocked, isUnlocked, lockAdmin, lockGroup, publishChanges, sentIssue, unlockAdmin, unlockGroup } from '../data/access.js';
import { settings } from '../data/settings.js';
import { store } from '../data/store.js';
import { MIN_CODE_LENGTH } from '../domain/admin-key.js';
import { validateDataset } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { errorList, field, page, playerLink, pageHeader, sectionHeader, table } from '../ui/components.js';
import { confirmAction, downloadText, toast } from '../ui/feedback.js';
import { addedByLabel, formatDate, plural } from '../ui/format.js';
import { openGameDetail } from './games.js';

const RECENT_ADDITIONS = 30;

function changeLine(label, counts) {
  const parts = [
    counts.added && `${counts.added} new`,
    counts.edited && `${counts.edited} edited`,
    counts.deleted && `${counts.deleted} deleted`,
  ].filter(Boolean);
  return h('li', null, h('b', null, `${label}: `), parts.length ? parts.join(', ') : 'no changes');
}

async function discardChanges(pending) {
  const confirmed = await confirmAction({
    title: 'Discard changes in this browser?',
    message: `This permanently removes ${plural(pending.total, 'unpublished change')}. Anything already submitted on GitHub is not affected.`,
    confirmLabel: 'Discard changes',
    danger: true,
  });
  if (!confirmed) return;
  store.discardDraft();
  toast('Changes discarded');
}

function pendingNote() {
  const pending = store.pendingChanges();
  if (!pending.total || store.mode() === 'demo') return null;
  const locked = pending.needsCode && !isUnlocked();
  return h('div', { class: 'note warn' },
    h('b', null, 'These changes are not live yet'),
    h('ul', { class: 'plain-list' }, changeLine('Players', pending.profiles), changeLine('Games', pending.games)),
    h('p', null, locked
      ? 'Some of these change what is already in the league, so they need the admin code below. If you are not an admin, discard them.'
      : 'If you have just submitted them, they will clear by themselves once the site has updated, usually within a few minutes.'),
    sentIssue() && h('p', null, h('a', { class: 'link', href: sentIssue(), target: '_blank', rel: 'noopener' }, 'See how your last submission went'), '. If there was a problem, the reply there explains it.'),
    h('div', { class: 'toolbar' },
      !locked && h('button', { class: 'btn primary', type: 'button', onClick: publishChanges }, icon('external'), 'Publish on GitHub'),
      h('button', { class: 'btn ghost danger', type: 'button', onClick: () => discardChanges(pending) }, icon('trash'), 'Discard changes')));
}

/** Removals wait in the draft, so an admin can clear several things with one submission. */
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
  toast(store.mode() === 'demo' ? `${label} removed` : `${label} marked for removal. Press Publish on GitHub when you are ready.`, 'good');
}

function additionRow(entry) {
  const isGame = entry.type === 'game';
  const item = isGame ? store.game(entry.id) : store.player(entry.id);
  const label = isGame ? `the game from ${formatDate(item.date)}` : item.name;
  const nameOf = (id) => store.player(id)?.name ?? id;
  const issueLink = entry.issue && `https://github.com/${store.reference().league.repository.owner}/${store.reference().league.repository.name}/issues/${entry.issue}`;
  return [
    h('span', { class: 'nowrap' }, formatDate(entry.addedAt.slice(0, 10))),
    isGame
      ? h('button', { class: 'link-btn', type: 'button', onClick: () => openGameDetail(item.id) },
        `Game on ${formatDate(item.date)}: ${item.seats.map((seat) => nameOf(seat.playerId)).join(', ')}`)
      : h('span', null, 'Player: ', playerLink(item)),
    issueLink ? h('a', { class: 'link', href: issueLink, target: '_blank', rel: 'noopener' }, addedByLabel(entry)) : addedByLabel(entry),
    canManage() && h('button', { class: 'btn ghost danger sm', type: 'button', onClick: () => removeItem({ type: entry.type, item, label }) }, 'Remove'),
  ];
}

function recentAdditions() {
  const entries = store.additions().slice(-RECENT_ADDITIONS).reverse();
  const hint = canManage()
    ? 'Removing something recalculates the ratings without it.'
    : 'Everything goes live straight away. Admins check this list and remove anything spurious.';
  return [
    sectionHeader('Recently added', hint),
    entries.length
      ? h('div', { class: 'card' }, table(
        [{ label: 'Added' }, { label: 'What' }, { label: 'By' }, { label: '' }],
        entries.map(additionRow)))
      : h('p', { class: 'prose' }, 'Nothing has been added yet.'),
  ];
}

function howItWorks() {
  return [
    sectionHeader('How adding works'),
    h('ol', { class: 'steps' },
      h('li', null, h('b', null, 'Log it here'), h('span', null, 'Use Log game or Register player. GitHub opens with the details filled in. You need a free GitHub account, and your username is shown next to what you add.')),
      h('li', null, h('b', null, 'Press Submit on GitHub'), h('span', null, 'A GitHub Action checks the details and saves them to the repo.')),
      h('li', null, h('b', null, 'That is it'), h('span', null, 'The issue closes with a confirmation and the site updates. If there is a problem, the issue explains it and nothing changes.'))),
  ];
}

function groupForm() {
  const name = h('input', { class: 'input', maxlength: 60, autocomplete: 'off', value: settings.get('groupMemberName') ?? '', 'aria-label': 'Your name' });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'off', 'aria-label': 'Group password' });
  const problem = h('p', { class: 'field-hint', role: 'alert' });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Unlock');
  const submit = async (event) => {
    event.preventDefault();
    problem.textContent = '';
    if (!name.value.trim() || !password.value.trim()) {
      problem.textContent = 'Please enter your name and the group password.';
      return;
    }
    button.disabled = true;
    try {
      if (await unlockGroup(password.value, name.value)) settings.set('groupMemberName', name.value.trim());
      else {
        problem.textContent = 'That password is not right.';
        password.select();
      }
    } catch {
      problem.textContent = 'This browser could not check the password. Please try an up-to-date browser.';
    }
    button.disabled = false;
  };
  return h('form', { class: 'code-form', onSubmit: submit },
    field('Your name', name),
    field('Group password', password),
    button,
    problem);
}

function groupCard() {
  if (store.mode() === 'demo' || !groupAccessIsSet()) return null;
  return [
    sectionHeader('No GitHub account?'),
    isGroupUnlocked()
      ? h('div', { class: 'card card-b admin-card' },
        h('b', null, `Adding as ${groupMemberName()}`),
        h('p', { class: 'field-hint' }, 'Anything you log or register in this tab now goes straight to the league, with no GitHub step. Reloading or closing this tab locks it again.'),
        h('div', null, h('button', { class: 'btn', type: 'button', onClick: lockGroup }, 'Lock')))
      : h('div', { class: 'card card-b admin-card' },
        h('p', { class: 'field-hint' }, 'Enter the group password here first, then log games or register players as usual. Your name is shown publicly next to what you add, so a first name or nickname is best.'),
        groupForm()),
  ];
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
    return [
      sectionHeader('For admins'),
      h('div', { class: 'card card-b admin-card' },
        h('p', { class: 'field-hint' }, `No admin code has been set yet, so nothing can be corrected or removed. To set one of at least ${MIN_CODE_LENGTH} characters, run scripts/set-admin-code.js and commit the result.`)),
    ];
  }
  return [
    sectionHeader('For admins'),
    isUnlocked()
      ? h('div', { class: 'card card-b admin-card' },
        h('b', null, 'Unlocked in this tab'),
        h('p', { class: 'field-hint' }, 'You can now remove items in the list above, and correct or delete them from their own pages. Reloading or closing this tab locks it again.'),
        h('div', null, h('button', { class: 'btn', type: 'button', onClick: lockAdmin }, 'Lock')))
      : h('div', { class: 'card card-b admin-card' },
        h('p', { class: 'field-hint' }, 'Enter the admin code to correct or remove what is in the league. Your code is never sent anywhere: this browser uses it to sign your changes, and GitHub checks the signature.'),
        unlockForm()),
  ];
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
          message: `It holds ${incoming.profiles.length} players and ${incoming.games.length} games. Any with the same id as existing ones will be replaced. They stay in this browser until you publish them.`,
          confirmLabel: 'Import',
        });
        if (!confirmed) return;
        store.importData(incoming);
        toast('Imported', 'good');
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
      intro: 'Anyone can add players and games. Admins check what comes in and remove anything spurious.',
    }),
    pendingNote(),
    liveAdmin && dataProblems(),
    recentAdditions(),
    howItWorks(),
    groupCard(),
    adminCard(),
    liveAdmin && backupCard(),
    demoCard());
}
