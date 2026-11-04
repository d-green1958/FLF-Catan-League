// Starts the app: loads the data, draws the sidebar and shows the page named in the URL.
import { store } from './data/store.js';
import { settings } from './data/settings.js';
import { useApproachModules } from './domain/league.js';
import { loadApproachModules } from './ratings/engine.js';
import { h, route } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { renderAbout } from './pages/about.js';
import { renderData } from './pages/data.js';
import { renderGames } from './pages/games.js';
import { renderInsights } from './pages/insights.js';
import { renderLeaderboard } from './pages/leaderboard.js';
import { renderPlayer } from './pages/player.js';
import { renderPlayers } from './pages/players.js';
import { renderRules } from './pages/rules.js';
import { renderScoring } from './pages/scoring.js';

const NAV = [
  { group: 'League', items: [
    { path: '/', label: 'Leaderboard', icon: 'trophy' },
    { path: '/games', label: 'Games', icon: 'dice' },
    { path: '/players', label: 'Players', icon: 'users' },
    { path: '/insights', label: 'Insights', icon: 'chart' },
  ] },
  { group: 'Reference', items: [
    { path: '/scoring', label: 'Scoring systems', icon: 'scale' },
    { path: '/rules', label: 'Rules', icon: 'book' },
    { path: '/about', label: 'About', icon: 'info' },
  ] },
  { group: 'Data', items: [
    { path: '/data', label: 'Admin', icon: 'edit', showPending: true },
  ] },
];

const ROUTES = [
  { match: /^\/$/, render: renderLeaderboard, nav: '/' },
  { match: /^\/games$/, render: renderGames, nav: '/games' },
  { match: /^\/players$/, render: renderPlayers, nav: '/players' },
  { match: /^\/players\/([^/]+)$/, render: (id) => renderPlayer(decodeURIComponent(id)), nav: '/players' },
  { match: /^\/insights$/, render: renderInsights, nav: '/insights' },
  { match: /^\/scoring$/, render: renderScoring, nav: '/scoring' },
  { match: /^\/rules$/, render: renderRules, nav: '/rules' },
  { match: /^\/about$/, render: renderAbout, nav: '/about' },
  { match: /^\/data$/, render: renderData, nav: '/data' },
];

/** "#/scoring#elo-vp" means the Scoring page, scrolled to the elo-vp card. */
function currentLocation() {
  const [path, anchor] = (window.location.hash.slice(1) || '/').split('#');
  return { path: path || '/', anchor };
}

function renderNav(activePath) {
  const pending = store.pendingChanges().total;
  document.getElementById('nav').replaceChildren(...NAV.map(({ group, items }) => [
    h('div', { class: 'lbl' }, group),
    items.map((item) => h('a', {
      href: route(item.path),
      class: item.path === activePath ? 'active' : null,
      'aria-current': item.path === activePath ? 'page' : null,
    },
      icon(item.icon),
      h('span', null, item.label),
      item.showPending && pending > 0 && store.mode() !== 'demo'
        && h('span', { class: 'count hot', title: `${pending} unpublished changes` }, pending))),
  ]).flat(Infinity));
}

function renderDemoBanner() {
  const banner = document.getElementById('demo-banner');
  banner.hidden = store.mode() !== 'demo';
  if (!banner.hidden) {
    banner.replaceChildren(
      h('b', null, 'Demo mode. '),
      'All players and results are made up. ',
      h('button', { class: 'link-btn', type: 'button', onClick: () => store.exitDemo() }, 'Leave demo'),
    );
  }
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function currentTheme() {
  return settings.get('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function renderThemeToggle() {
  const theme = currentTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  document.getElementById('theme-toggle').replaceChildren(h('button', {
    class: 'btn ghost sm block',
    type: 'button',
    onClick: () => settings.set('theme', next),
  }, icon(theme === 'dark' ? 'sun' : 'moon'), `${next === 'dark' ? 'Dark' : 'Light'} mode`));
}

let lastPath = null;

function showPage() {
  const { path, anchor } = currentLocation();
  const matched = ROUTES.map((candidate) => ({ candidate, found: path.match(candidate.match) })).find(({ found }) => found);
  const view = document.getElementById('view');
  const scroller = document.getElementById('main');

  // A re-render on the same page keeps the reader's place, and a new page starts at the top.
  const samePage = path === lastPath;
  const scrollTop = scroller.scrollTop;

  if (matched) {
    view.replaceChildren(matched.candidate.render(...matched.found.slice(1)));
  } else {
    view.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'empty card' },
      h('h2', null, 'Page not found'),
      h('p', null, 'That address does not lead anywhere on this island.'),
      h('a', { class: 'btn', href: route('/') }, 'Back to the leaderboard'))));
  }

  renderNav(matched?.candidate.nav);
  renderDemoBanner();
  renderThemeToggle();
  document.title = `${document.querySelector('#view h1')?.textContent ?? 'Page not found'} · ${store.reference().league.shortName}`;

  scroller.scrollTop = samePage ? scrollTop : 0;
  if (anchor && !samePage) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  lastPath = path;
}

function showFatalError(error) {
  console.error(error);
  document.getElementById('view').replaceChildren(h('div', { class: 'page' }, h('div', { class: 'empty card' },
    h('h2', null, 'The league data could not be loaded'),
    h('p', null, error.message),
    h('p', { class: 'muted' }, 'Check your connection and reload. If you are running the site locally, make sure the local server is still running.'))));
}

async function start() {
  applyTheme(settings.get('theme'));
  try {
    await store.init();
    useApproachModules(await loadApproachModules(store.reference().approaches));
  } catch (error) {
    showFatalError(error);
    return;
  }
  store.subscribe(showPage);
  settings.subscribe(() => { applyTheme(settings.get('theme')); showPage(); });
  window.addEventListener('hashchange', showPage);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderThemeToggle);
  showPage();
}

start();
