// Moves changes made in this browser into the repo, so everyone can see them. See js/data/store.js.
import { store } from '../data/store.js';
import { validateDataset } from '../domain/validate.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { errorList, page, pageHeader, sectionHeader } from '../ui/components.js';
import { confirmAction, downloadText, toast } from '../ui/feedback.js';

function changeLine(label, counts) {
  const parts = [
    counts.added && `${counts.added} new`,
    counts.edited && `${counts.edited} edited`,
    counts.deleted && `${counts.deleted} deleted`,
  ].filter(Boolean);
  return h('li', null, h('b', null, `${label}: `), parts.length ? parts.join(', ') : 'no changes');
}

function statusCard() {
  const pending = store.pendingChanges();
  return h('div', { class: `note ${pending.total ? 'warn' : ''}`.trim() },
    h('b', null, pending.total ? 'These changes are only in this browser' : 'Everything here matches the published files'),
    pending.total
      ? h('ul', { class: 'plain-list' }, changeLine('Players', pending.profiles), changeLine('Games', pending.games))
      : h('p', null, 'There is nothing to publish.'));
}

function liveActions() {
  const pending = store.pendingChanges();
  const { colours, league } = store.reference();
  const issues = validateDataset(
    { profiles: store.profiles(), games: store.games() },
    { colours, settings: league.settings },
  );

  const publishSteps = [
    ['Download both files', 'Use the buttons below.'],
    ['Replace the old copies', 'Move them into the data folder of the repo, replacing profiles.json and games.json.'],
    ['Commit and push', 'Once GitHub Pages rebuilds, everyone will see the changes. This browser\'s draft then clears itself, because it matches the published files.'],
  ];

  return [
    issues.length > 0 && h('div', { class: 'note warn' }, h('b', null, 'Problems found in the data'), errorList(issues)),
    sectionHeader('Publish your changes'),
    h('ol', { class: 'steps' }, publishSteps.map(([title, text]) => h('li', null, h('b', null, title), h('span', null, text)))),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn primary', type: 'button', onClick: () => downloadText('profiles.json', store.exportJson('profiles')) }, icon('save'), 'profiles.json'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => downloadText('games.json', store.exportJson('games')) }, icon('save'), 'games.json')),
    sectionHeader('Back up or restore'),
    h('p', { class: 'prose' }, 'Browser data can be cleared. A backup holds all your players and games in a single file you can bring back later, including into a different browser.'),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', type: 'button', onClick: () => downloadText('flfoxtan-backup.json', store.backupJson()) }, icon('save'), 'Download backup'),
      importButton(),
      pending.total > 0 && h('button', {
        class: 'btn ghost danger',
        type: 'button',
        onClick: async () => {
          const confirmed = await confirmAction({
            title: 'Discard changes in this browser?',
            message: `This permanently removes ${pending.total} unpublished change${pending.total === 1 ? '' : 's'}. Download a backup first if you might want them later.`,
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
          message: `It holds ${incoming.profiles.length} players and ${incoming.games.length} games. Any with the same id as existing ones will be replaced.`,
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
      h('p', null, 'Everything on the site is made up, and anything you add here is thrown away when you leave.'),
      h('button', { class: 'btn', type: 'button', onClick: () => store.exitDemo() }, 'Leave demo'));
  }
  return [
    sectionHeader('Demo mode'),
    h('p', { class: 'prose' }, 'See the site full of made-up players and games. Your real league stays untouched and comes straight back when you leave.'),
    h('button', { class: 'btn', type: 'button', onClick: () => store.enterDemo() }, icon('flask'), 'Try the demo'),
  ];
}

export function renderData() {
  const demo = store.mode() === 'demo';
  return page(
    pageHeader({
      eyebrow: 'Keeping the record',
      title: 'Save & share',
      intro: 'New players and games save straight away, but only in this browser. Publishing them puts them in front of the whole league.',
    }),
    demo ? null : statusCard(),
    demo ? null : liveActions(),
    demoCard());
}
