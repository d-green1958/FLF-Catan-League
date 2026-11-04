// Game rules, league rules and what each expansion adds.
import { store } from '../data/store.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { page, pageHeader, sectionHeader, table } from '../ui/components.js';

// The chosen tab survives a re-render.
let activeTab = 'league';

function externalLink(url, label) {
  return h('a', { class: 'link', href: url, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external', 'sm'));
}

function ruleSection(section) {
  return h('section', { class: 'card card-b rule-card' },
    h('h3', null, section.heading),
    h('ul', { class: 'rule-list' }, section.items.map((item) => h('li', null, item))),
    section.costs && table(
      [{ label: 'Build' }, { label: 'Cost' }, { label: 'VP', align: 'right' }],
      section.costs.map((row) => [row.item, row.cost, row.vp])));
}

function ruleGrid(sections) {
  return h('div', { class: 'rule-grid' }, sections.map(ruleSection));
}

function leagueTab(league) {
  return [
    h('div', { class: 'note warn' }, h('b', null, league.status), h('p', null, league.intro)),
    ruleGrid(league.sections),
  ];
}

function generalTab(general, expansions) {
  return [
    h('div', { class: 'note' },
      h('p', null, general.intro),
      h('div', { class: 'link-row' },
        externalLink(expansions.base.rulebookUrl, 'Official 3–4 player rulebook'),
        externalLink(expansions.base.extensionRulebookUrl, 'Official 5–6 player rulebook'))),
    ruleGrid(general.sections),
  ];
}

function expansionsTab(expansions) {
  return [
    h('div', { class: 'note' },
      h('p', null, 'You can log any of these on a game. All four main expansions have official rules for 5–6 players, using their own extension box.'),
      h('div', { class: 'link-row' }, externalLink(expansions.rulesIndexUrl, 'All official rulebooks on catan.com'))),
    h('div', { class: 'rule-grid' }, expansions.expansions.map((expansion) =>
      h('section', { class: 'card card-b rule-card' },
        h('h3', null, expansion.name),
        h('p', null, expansion.summary),
        h('dl', { class: 'facts' },
          h('div', null, h('dt', null, 'Players'), h('dd', null, expansion.players)),
          h('div', null, h('dt', null, 'Target'), h('dd', null, expansion.vpNote))),
        expansion.scenarios.length > 0 && h('details', null,
          h('summary', null, `${expansion.scenarios.length} scenarios`),
          h('ul', { class: 'rule-list' }, expansion.scenarios.map((name) => h('li', null, name)))),
        h('div', { class: 'link-row' },
          externalLink(expansion.rulebookUrl, 'Rulebook'),
          externalLink(expansion.extensionRulebookUrl, '5–6 players'))))),
    sectionHeader('Other official additions'),
    h('div', { class: 'card' }, table(
      [{ label: 'Name' }, { label: 'Rules' }],
      expansions.extras.map((extra) => [extra.name, externalLink(extra.rulebookUrl, 'Rulebook')]))),
  ];
}

export function renderRules() {
  const { rules, expansions } = store.reference();
  const tabs = [
    ['league', 'League rules', () => leagueTab(rules.league)],
    ['general', 'Game rules', () => generalTab(rules.general, expansions)],
    ['expansions', 'Expansions', () => expansionsTab(expansions)],
  ];
  const holder = h('div');
  const tabBar = h('div', { class: 'seg tab-bar' });

  const show = (id) => {
    activeTab = id;
    tabBar.replaceChildren(...tabs.map(([tabId, label]) => h('button', {
      type: 'button',
      'aria-pressed': String(tabId === id),
      onClick: () => show(tabId),
    }, label)));
    holder.replaceChildren(...tabs.find(([tabId]) => tabId === id)[2]().flat());
  };
  show(activeTab);

  return page(
    pageHeader({
      eyebrow: 'How we play',
      title: 'Rules',
      intro: 'The rules of the league, a refresher on the game, and what each expansion adds.',
    }),
    tabBar,
    holder);
}
