// Starts the app: loads the data, draws the sidebar and shows the page named in the URL.
import { groupIsRemembered, groupMemberName, isGroupUnlocked, lockGroup, restoreGroupAccess, startLiveUpdates } from './data/access.js';
import { store } from './data/store.js';
import { settings } from './data/settings.js';
import { useApproachModules } from './domain/league.js';
import { openGameForm } from './forms/game-form.js';
import { renderSendBar } from './forms/send-dialog.js';
import { loadApproachModules } from './ratings/engine.js';
import { h, route } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { installDelights, lostPage, noteThemeSwitch, proverb } from './ui/delights.js';
import { renderMap } from './pages/map.js';
import { renderHome } from './pages/home.js';
import { renderEngSci, renderLowerGround, renderPenthouse, renderThom } from './pages/engsci.js';
import { renderArctic, renderCryogenics } from './pages/expeditions.js';
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
    { path: '/', label: 'Home', icon: 'hex' },
    { path: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { path: '/games', label: 'Games', icon: 'dice' },
    { path: '/players', label: 'Players', icon: 'users' },
    { path: '/insights', label: 'Insights', icon: 'chart' },
  ] },
  { group: 'Reference', items: [
    { path: '/scoring', label: 'Scoring systems', icon: 'scale' },
    { path: '/rules', label: 'Rules', icon: 'book' },
    { path: '/about', label: 'About', icon: 'info' },
    { path: '/map', label: 'The Map', icon: 'map' },
  ] },
  { group: 'Data', items: [
    { path: '/data', label: 'Review', icon: 'edit' },
  ] },
];

const ROUTES = [
  { match: /^\/$/, render: renderHome, nav: '/' },
  { match: /^\/leaderboard$/, render: renderLeaderboard, nav: '/leaderboard' },
  { match: /^\/games$/, render: renderGames, nav: '/games' },
  { match: /^\/players$/, render: renderPlayers, nav: '/players' },
  { match: /^\/players\/([^/]+)$/, render: (id) => renderPlayer(decodeURIComponent(id)), nav: '/players' },
  { match: /^\/insights$/, render: renderInsights, nav: '/insights' },
  { match: /^\/scoring$/, render: renderScoring, nav: '/scoring' },
  { match: /^\/rules$/, render: renderRules, nav: '/rules' },
  { match: /^\/about$/, render: renderAbout, nav: '/about' },
  { match: /^\/map$/, render: renderMap, nav: '/map' },
  { match: /^\/map\/engsci$/, render: renderEngSci, nav: '/map' },
  { match: /^\/map\/thom$/, render: renderThom, nav: '/map' },
  { match: /^\/map\/thom\/penthouse$/, render: renderPenthouse, nav: '/map' },
  { match: /^\/map\/lower-ground$/, render: renderLowerGround, nav: '/map' },
  { match: /^\/map\/cryogenics$/, render: renderCryogenics, nav: '/map' },
  { match: /^\/map\/arctic$/, render: renderArctic, nav: '/map' },
  { match: /^\/data$/, render: renderData, nav: '/data' },
];

/** "#/scoring#elo-vp" means the Scoring page, scrolled to the elo-vp card. */
function currentLocation() {
  const [path, anchor] = (window.location.hash.slice(1) || '/').split('#');
  return { path: path || '/', anchor };
}

function renderNav(activePath) {
  document.getElementById('nav').replaceChildren(...NAV.map(({ group, items }) => [
    h('div', { class: 'lbl' }, group),
    items.map((item) => h('a', {
      href: route(item.path),
      class: item.path === activePath ? 'active' : null,
      'aria-current': item.path === activePath ? 'page' : null,
    },
      icon(item.icon),
      h('span', null, item.label))),
  ]).flat(Infinity));
}

// On phones the sidebar becomes a bottom tab bar. These pages get their own tab; the rest live under More.
const TABS = ['/', '/leaderboard', '/games'];
const TAB_LABELS = { '/': 'Home', '/leaderboard': 'Table', '/games': 'Games' };
const navItems = () => NAV.flatMap(({ items }) => items);

function renderTabBar(activePath) {
  const tab = (item) => h('a', {
    class: `tab ${item.path === activePath ? 'active' : ''}`.trim(),
    href: route(item.path),
    'aria-current': item.path === activePath ? 'page' : null,
  }, icon(item.icon), h('span', null, TAB_LABELS[item.path]));
  const [home, table, games] = TABS.map((path) => navItems().find((item) => item.path === path));
  const inMore = activePath && !TABS.includes(activePath);
  document.getElementById('tabbar').replaceChildren(
    tab(home),
    tab(table),
    h('button', { class: 'tab tab-log', type: 'button', onClick: () => openGameForm() },
      h('span', { class: 'hexbtn' }, icon('plus')), h('span', null, 'Log game')),
    tab(games),
    h('button', { class: `tab ${inMore ? 'active' : ''}`.trim(), type: 'button', 'aria-haspopup': 'dialog', onClick: () => openMoreSheet(activePath) },
      icon('menu'), h('span', null, 'More')));
}

/** "Sending as Sam · Forget", once the group password has been entered on this device. */
function sessionLine() {
  if (!isGroupUnlocked()) return null;
  return h('div', { class: 'session' },
    h('span', null, 'Sending as ', h('b', null, groupMemberName() || 'group member'), groupIsRemembered() ? '' : ' until this tab closes'),
    h('button', { class: 'link-btn', type: 'button', onClick: () => lockGroup() }, 'Forget'));
}

function themeButton() {
  const theme = currentTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return h('button', {
    class: 'btn ghost sm block',
    type: 'button',
    onClick: () => { settings.set('theme', next); noteThemeSwitch(); },
  }, icon(theme === 'dark' ? 'sun' : 'moon'), `${next === 'dark' ? 'Dark' : 'Light'} mode`);
}

function openMoreSheet(activePath) {
  const sheet = h('dialog', {
    class: 'sheet',
    'aria-label': 'More pages',
    onClose: () => sheet.remove(),
    onClick: (event) => { if (event.target === sheet) sheet.close(); },
  });
  const links = navItems().filter((item) => !TABS.includes(item.path)).map((item) => h('a', {
    href: route(item.path),
    class: item.path === activePath ? 'active' : null,
    onClick: () => sheet.close(),
  }, icon(item.icon), item.label));
  sheet.append(h('div', { class: 'sheet-inner', tabindex: '-1', autofocus: true },
    h('div', { class: 'sheet-grip' }),
    h('nav', { class: 'sheet-links', 'aria-label': 'More pages' }, links),
    h('div', { class: 'sheet-foot' }, sessionLine(), themeButton(), h('p', { class: 'proverb' }, proverb()))));
  document.body.append(sheet);
  sheet.showModal();
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
  document.getElementById('theme-toggle').replaceChildren(themeButton());
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
    view.replaceChildren(lostPage(
      h('a', { class: 'btn', href: route('/') }, 'Back home'),
      h('a', { class: 'btn primary', href: route('/map') }, icon('map'), 'Consult the Map')));
  }

  renderNav(matched?.candidate.nav);
  renderTabBar(matched?.candidate.nav);
  document.getElementById('session').replaceChildren(...[sessionLine()].filter(Boolean));
  renderDemoBanner();
  renderSendBar();
  renderThemeToggle();
  document.title = `${document.querySelector('#view h1, #view h2')?.textContent ?? 'Page not found'} · ${store.reference().league.shortName}`;

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
    restoreGroupAccess();
  } catch (error) {
    showFatalError(error);
    return;
  }
  store.subscribe(showPage);
  settings.subscribe(() => { applyTheme(settings.get('theme')); showPage(); });
  window.addEventListener('hashchange', showPage);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderThemeToggle);
  showPage();
  startLiveUpdates();
  document.getElementById('proverb').textContent = proverb();
  installDelights();
}

start();
