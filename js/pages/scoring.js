// Explains every scoring system, and lets people experiment with the settings in their own browser.
import { settings } from '../data/settings.js';
import { getLeague, isEnabled, leaderboard, paramsFor } from '../domain/league.js';
import { repeatWeight } from '../ratings/elo.js';
import { h } from '../ui/dom.js';
import { page, pageHeader, playerLink, sectionHeader } from '../ui/components.js';
import { formatScore, percent } from '../ui/format.js';

const DECAY_EXAMPLES = [1, 2, 3, 6, 11, 21, 51];

function parameterInput(entry, parameter, current) {
  const changed = current !== parameter.value;
  return h('label', { class: 'field param' },
    h('span', { class: 'field-label' }, parameter.label, changed && h('span', { class: 'badge warn' }, `Default: ${parameter.value}`)),
    h('input', {
      class: 'input',
      type: 'number',
      min: parameter.min,
      max: parameter.max,
      step: parameter.step,
      value: current,
      onChange: (event) => {
        const value = Number(event.target.value);
        const valid = event.target.value !== '' && Number.isFinite(value) && value >= parameter.min && value <= parameter.max;
        if (valid) settings.setParam(entry.id, parameter.key, value);
        else event.target.value = current;
      },
    }),
    parameter.help && h('span', { class: 'field-hint' }, parameter.help));
}

/** Shows how quickly a pairing fades, using this system's current half-life. */
function decayStrip(halfLife) {
  if (!(halfLife > 0)) return h('p', { class: 'field-hint' }, 'Decay is off: repeat games count in full.');
  return h('div', { class: 'decay-strip', role: 'list', 'aria-label': 'How much each repeat game counts' },
    DECAY_EXAMPLES.map((gameNumber) => h('div', { class: 'decay-step', role: 'listitem' },
      h('b', null, percent(repeatWeight(gameNumber - 1, halfLife))),
      h('span', null, gameNumber === 1 ? '1st game' : `Game ${gameNumber}`))));
}

function approachCard(entry, league) {
  const params = paramsFor(entry);
  const enabled = isEnabled(entry);
  const leader = enabled && league.games.length ? leaderboard(league, entry.id)[0] : null;
  const hasOverrides = Boolean(settings.get('paramOverrides')[entry.id]);

  return h('article', { class: `card approach ${enabled ? '' : 'dim'}`.trim(), id: entry.id },
    h('header', { class: 'approach-head' },
      h('div', null,
        h('h3', null, entry.name),
        h('p', null, entry.summary)),
      h('label', { class: 'switch', title: 'Show this system on the leaderboards in this browser' },
        h('input', {
          type: 'checkbox',
          checked: enabled,
          'aria-label': `Show ${entry.name}`,
          onChange: (event) => settings.setEnabled(entry.id, event.target.checked),
        }),
        'Show')),
    h('dl', { class: 'approach-body' },
      h('div', null, h('dt', null, 'How it works'), h('dd', null, entry.howItWorks)),
      h('div', null, h('dt', null, 'Watch out for'), h('dd', null, entry.watchOut)),
      leader && h('div', null,
        h('dt', null, 'Current leader'),
        h('dd', null, playerLink(leader.player), ` (${formatScore(leader.score, entry.format)})`))),
    params.halfLife !== undefined && decayStrip(params.halfLife),
    entry.parameters.length > 0 && h('details', { class: 'params', open: hasOverrides },
      h('summary', null, 'Try different settings'),
      h('div', { class: 'param-grid' }, entry.parameters.map((parameter) => parameterInput(entry, parameter, params[parameter.key]))),
      hasOverrides && h('button', { class: 'btn ghost sm', type: 'button', onClick: () => settings.resetParams(entry.id) }, 'Back to league defaults')));
}

export function renderScoring() {
  const league = getLeague();
  const { approaches, families } = league.reference;
  return page(
    pageHeader({
      eyebrow: 'Fair is hard',
      title: 'Scoring systems',
      intro: `${approaches.length} ways to rank the league, all running side by side. Scores are recalculated from the game history, so you can change a setting here and watch the leaderboards respond. Your changes stay in this browser and do not affect anyone else.`,
    }),
    families.map((family) => {
      const members = approaches.filter((entry) => entry.family === family.id);
      return members.length ? [
        sectionHeader(family.name),
        h('div', { class: 'approach-list' }, members.map((entry) => approachCard(entry, league))),
      ] : null;
    }));
}
