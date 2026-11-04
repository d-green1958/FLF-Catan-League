// For league admins: switch on the editing tools and send changes to the repo.
import { canEdit, publishChanges } from '../data/access.js';
import { settings } from '../data/settings.js';
import { store } from '../data/store.js';
import { validateDataset } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { errorList, page, pageHeader, sectionHeader } from '../ui/components.js';
import { confirmAction, downloadText, toast } from '../ui/feedback.js';

function adminSwitch() {
  const { admins } = store.reference().league;
  return h('div', { class: 'card card-b admin-card' },
    h('label', { class: 'switch' },
      h('input', {
        type: 'checkbox',
        checked: Boolean(settings.get('adminMode')),
        onChange: (event) => settings.set('adminMode', event.target.checked),
      }),
      h('b', null, 'I am a league admin')),
    h('p', { class: 'field-hint' }, 'This shows the tools for registering players and logging games in this browser. It does not grant access by itself: GitHub checks who you are when you submit.'),
    h('p', { class: 'field-hint' }, 'Admins: ', admins.join(', '), '. To add one, edit the list in data/league.json.'));
}

function changeLine(label, counts) {
  const parts = [
    counts.added && `${counts.added} new`,
    counts.edited && `${counts.edited} edited`,
    counts.deleted && `${counts.deleted} deleted`,
  ].filter(Boolean);
  return h('li', null, h('b', null, `${label}: `), parts.length ? parts.join(', ') : 'no changes');
}

function publishCard() {
  const pending = store.pendingChanges();
  const { colours, league } = store.reference();
  const issues = validateDataset(
    { profiles: store.profiles(), games: store.games() },
    { colours, settings: league.settings },
  );

  return [
    issues.length > 0 && h('div', { class: 'note warn' }, h('b', null, 'Problems found in the data'), errorList(issues)),
    h('div', { class: `note ${pending.total ? 'warn' : ''}`.trim() },
      h('b', null, pending.total ? 'These changes are not live yet' : 'Everything here is live'),
      pending.total
        ? h('ul', { class: 'plain-list' }, changeLine('Players', pending.profiles), changeLine('Games', pending.games))
        : h('p', null, 'There is nothing waiting to go to GitHub.'),
      pending.total > 0 && h('p', null, 'If you have just submitted them, they will clear by themselves once the site has updated, usually within a few minutes.'),
      pending.total > 0 && h('button', { class: 'btn primary', type: 'button', onClick: publishChanges }, icon('external'), 'Publish on GitHub')),
    sectionHeader('How publishing works'),
    h('ol', { class: 'steps' },
      h('li', null, h('b', null, 'Log it here'), h('span', null, 'GitHub opens with your changes already filled in. You need to be signed in as a league admin.')),
      h('li', null, h('b', null, 'Press Submit on GitHub'), h('span', null, 'A GitHub Action checks your username and the details, then saves the changes to the repo.')),
      h('li', null, h('b', null, 'That is it'), h('span', null, 'The issue closes with a confirmation and the site updates. If there is a problem, the issue explains it and nothing changes.'))),
  ];
}

function backupCard() {
  const pending = store.pendingChanges();
  return [
    sectionHeader('Backups and manual edits'),
    h('p', { class: 'prose' }, 'A backup holds all your players and games in one file. To edit the data by hand instead, download the two data files, change them, and commit them to the data folder.'),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('flfoxtan-backup.json', store.backupJson()) }, icon('save'), 'Download backup'),
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('profiles.json', store.exportJson('profiles')) }, icon('save'), 'profiles.json'),
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('games.json', store.exportJson('games')) }, icon('save'), 'games.json'),
      importButton(),
      pending.total > 0 && h('button', {
        class: 'btn ghost danger',
        type: 'button',
        onClick: async () => {
          const confirmed = await confirmAction({
            title: 'Discard changes in this browser?',
            message: `This permanently removes ${pending.total} unpublished change${pending.total === 1 ? '' : 's'}. Anything already submitted on GitHub is not affected. Download a backup first if you might want them later.`,
            confirmLabel: 'Discard changes',
            danger: true,
          });
          if (!confirmed) return;
          store.discardDraft();
          toast('Changes discarded');
        },
      }, icon('trash'), 'Discard changes')),
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
      h('p', null, 'Everything on the site is made up, and anything you add here is thrown away when you leave. Nothing goes to GitHub.'),
      h('button', { class: 'btn', type: 'button', onClick: () => store.exitDemo() }, 'Leave demo'));
  }
  return [
    sectionHeader('Demo mode'),
    h('p', { class: 'prose' }, 'See the site full of made-up players and games, and try out the forms. The real league stays untouched and comes straight back when you leave.'),
    h('button', { class: 'btn', type: 'button', onClick: () => store.enterDemo() }, icon('flask'), 'Try the demo'),
  ];
}

export function renderData() {
  const demo = store.mode() === 'demo';
  return page(
    pageHeader({
      eyebrow: 'Keeping the record',
      title: 'Admin',
      intro: 'League admins register players and log games. Everyone else can follow along without an account.',
    }),
    demo ? null : adminSwitch(),
    !demo && canEdit() ? [publishCard(), backupCard()] : null,
    demoCard());
}
