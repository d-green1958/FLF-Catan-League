// The list of everyone registered in the league.
import { canEdit } from '../data/access.js';
import { getLeague, leaderboard, selectedApproach } from '../domain/league.js';
import { openPlayerForm } from '../forms/player-form.js';
import { h, route } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { avatar, emptyState, page, pageHeader } from '../ui/components.js';
import { formatDate, formatScore, ordinal, percent, plural } from '../ui/format.js';

function playerCard(player, league, approach, standing) {
  const summary = league.summaries.get(player.id);
  return h('a', { class: `card player-card ${player.active === false ? 'dim' : ''}`.trim(), href: route(`/players/${encodeURIComponent(player.id)}`) },
    h('div', { class: 'player-card-top' },
      avatar(player, 'lg'),
      h('div', { class: 'player-card-name' },
        h('b', null, player.name),
        player.nickname && h('span', { class: 'muted' }, player.nickname)),
      standing && h('span', { class: 'badge accent', title: `${formatScore(standing.score, approach.format)} on ${approach.name}` }, ordinal(standing.rank)),
      player.active === false && h('span', { class: 'badge muted' }, 'Retired')),
    player.tagline && h('p', { class: 'tagline' }, player.tagline),
    h('dl', { class: 'mini-stats' },
      h('div', null, h('dt', null, 'Games'), h('dd', null, summary.games)),
      h('div', null, h('dt', null, 'Wins'), h('dd', null, summary.wins)),
      h('div', null, h('dt', null, 'Win rate'), h('dd', null, summary.games ? percent(summary.winRate) : '–'))),
    h('p', { class: 'field-hint' }, summary.lastPlayed ? `Last played ${formatDate(summary.lastPlayed)}` : 'No games yet'));
}

export function renderPlayers() {
  const league = getLeague();
  const register = () => (canEdit() ? h('button', { class: 'btn primary', onClick: () => openPlayerForm() }, icon('plus'), 'Register player') : null);
  const header = pageHeader({
    eyebrow: 'The settlers',
    title: 'Players',
    intro: league.profiles.length ? `${plural(league.profiles.length, 'player')} registered.` : 'Everyone starts here.',
    actions: register(),
  });
  if (!league.profiles.length) {
    return page(header, emptyState({
      title: 'Nobody has registered yet',
      message: canEdit() ? 'Add the first player to get the league going.' : 'Players will appear here once a league admin registers them.',
      actions: register(),
    }));
  }

  const approach = selectedApproach(league);
  const standings = new Map(leaderboard(league, approach.id, { includeRetired: true }).map((row) => [row.playerId, row]));
  const sorted = [...league.profiles].sort((a, b) =>
    (a.active === false) - (b.active === false)
    || (standings.get(a.id)?.rank ?? Infinity) - (standings.get(b.id)?.rank ?? Infinity)
    || a.name.localeCompare(b.name));

  return page(header,
    h('p', { class: 'field-hint spaced-bottom' }, `Ranks are from ${approach.name}. You can change the system on the Leaderboard page.`),
    h('div', { class: 'player-grid' }, sorted.map((player) => playerCard(player, league, approach, standings.get(player.id)))));
}

