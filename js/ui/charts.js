// The two chart types used on the site. Both are drawn from plain SVG and HTML, with no libraries.
import { h, svg } from './dom.js';

const SERIES_SLOTS = 8;
const MARGIN = { top: 14, right: 74, bottom: 28, left: 46 };
const HEIGHT = 280;

/**
 * Gives each player a stable chart colour based on their place in the player list, so someone stays
 * the same colour when the visible set changes. Only clashes on the same chart pick another slot.
 */
export function assignSlots(playerIds, allPlayerIds) {
  const used = new Set();
  const slots = new Map();
  for (const id of playerIds) {
    let slot = Math.max(0, allPlayerIds.indexOf(id)) % SERIES_SLOTS;
    while (used.has(slot)) slot = (slot + 1) % SERIES_SLOTS;
    used.add(slot);
    slots.set(id, slot + 1);
  }
  return slots;
}

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const rawStep = (max - min) / (count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find((multiple) => multiple * magnitude >= rawStep) * magnitude;
  const first = Math.floor(min / step) * step;
  const ticks = [];
  for (let value = first; value < max + step * 0.999; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

/** Stops direct labels at the line ends from overlapping. */
function spreadLabels(labels, minimumGap, top, bottom) {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].y - sorted[i - 1].y < minimumGap) sorted[i].y = sorted[i - 1].y + minimumGap;
  }
  const overflow = sorted.length ? sorted.at(-1).y - bottom : 0;
  if (overflow > 0) {
    sorted.at(-1).y = bottom;
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - minimumGap);
    }
  }
  sorted.forEach((label) => { label.y = Math.max(top, label.y); });
  return sorted;
}

/**
 * A line chart with a hover and keyboard readout.
 *   series:      [{ id, label, slot, values: [number|null per x position] }]
 *   xLabels:     text for each x position, such as the date of the game
 *   formatValue: turns a y value into display text
 *   summary:     description for screen readers
 */
export function lineChart({ series, xLabels, formatValue, summary }) {
  const plot = h('div', { class: 'plot', role: 'img', 'aria-label': summary, tabindex: '0' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const root = h('div', { class: 'chart' },
    series.length > 1 && h('ul', { class: 'legend' }, series.map((item) =>
      h('li', null, h('span', { class: 'swatch', style: { background: `var(--series-${item.slot})` } }), item.label))),
    h('div', { class: 'plot-holder' }, plot, tip));

  let cursor = null;
  let lastWidth = 0;

  const draw = (width) => {
    if (!width || width === lastWidth) return;
    lastWidth = width;
    plot.replaceChildren(buildSvg(width));
  };

  function buildSvg(width) {
    const right = series.length <= 4 && series.length > 1 && width > 460 ? MARGIN.right : 16;
    const innerWidth = width - MARGIN.left - right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const allValues = series.flatMap((item) => item.values).filter((value) => value !== null);
    const ticks = niceTicks(Math.min(...allValues), Math.max(...allValues));
    const [low, high] = [ticks[0], ticks.at(-1)];
    const positions = xLabels.length;
    const x = (index) => MARGIN.left + (positions > 1 ? (index / (positions - 1)) * innerWidth : innerWidth / 2);
    const y = (value) => MARGIN.top + (1 - (value - low) / (high - low)) * innerHeight;

    const grid = ticks.map((tick) => [
      svg('line', { class: 'grid', x1: MARGIN.left, x2: MARGIN.left + innerWidth, y1: y(tick), y2: y(tick) }),
      svg('text', { class: 'tick', x: MARGIN.left - 8, y: y(tick) + 4, 'text-anchor': 'end' }, formatValue(tick)),
    ]);

    const xCount = Math.min(positions, Math.max(2, Math.floor(innerWidth / 90)));
    const xIndexes = positions === 1 ? [0] : [...new Set(Array.from({ length: xCount }, (_, i) => Math.round((i / (xCount - 1)) * (positions - 1))))];
    const xTicks = xIndexes.map((index) => svg('text', {
      class: 'tick',
      x: x(index),
      y: HEIGHT - 8,
      'text-anchor': index === 0 && positions > 1 ? 'start' : index === positions - 1 && positions > 1 ? 'end' : 'middle',
    }, xLabels[index]));

    const lines = series.map((item) => {
      const points = item.values.map((value, index) => (value === null ? null : `${x(index)},${y(value)}`)).filter(Boolean);
      return svg('polyline', { class: 'line', points: points.join(' '), stroke: `var(--series-${item.slot})` });
    });

    const ends = series.map((item) => {
      const lastIndex = item.values.findLastIndex((value) => value !== null);
      return lastIndex < 0 ? null : svg('circle', {
        class: 'end-dot', cx: x(lastIndex), cy: y(item.values[lastIndex]), r: 4, fill: `var(--series-${item.slot})`,
      });
    });

    const labels = right === MARGIN.right
      ? spreadLabels(series.map((item) => ({
          text: item.label,
          y: y(item.values.findLast((value) => value !== null)) + 4,
        })), 14, MARGIN.top + 4, MARGIN.top + innerHeight).map((label) =>
          svg('text', { class: 'direct-label', x: MARGIN.left + innerWidth + 10, y: label.y }, label.text))
      : [];

    const crosshair = svg('line', { class: 'crosshair', y1: MARGIN.top, y2: MARGIN.top + innerHeight, visibility: 'hidden' });
    const nodes = series.map((item) => svg('circle', { class: 'hover-dot', r: 4, fill: `var(--series-${item.slot})`, visibility: 'hidden' }));

    const showAt = (index) => {
      cursor = Math.max(0, Math.min(positions - 1, index));
      crosshair.setAttribute('x1', x(cursor));
      crosshair.setAttribute('x2', x(cursor));
      crosshair.setAttribute('visibility', 'visible');
      series.forEach((item, seriesIndex) => {
        const value = item.values[cursor];
        nodes[seriesIndex].setAttribute('visibility', value === null ? 'hidden' : 'visible');
        if (value !== null) {
          nodes[seriesIndex].setAttribute('cx', x(cursor));
          nodes[seriesIndex].setAttribute('cy', y(value));
        }
      });
      const rows = series
        .filter((item) => item.values[cursor] !== null)
        .sort((a, b) => b.values[cursor] - a.values[cursor])
        .map((item) => h('div', { class: 'tip-row' },
          h('span', { class: 'swatch', style: { background: `var(--series-${item.slot})` } }),
          h('span', { class: 'tip-name' }, item.label),
          h('b', null, formatValue(item.values[cursor]))));
      tip.replaceChildren(h('div', { class: 'tip-title' }, xLabels[cursor]), ...rows);
      tip.hidden = false;
      const flip = x(cursor) > width / 2;
      tip.style.left = flip ? 'auto' : `${x(cursor) + 12}px`;
      tip.style.right = flip ? `${width - x(cursor) + 12}px` : 'auto';
    };

    const hide = () => {
      cursor = null;
      crosshair.setAttribute('visibility', 'hidden');
      nodes.forEach((node) => node.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    };

    const nearest = (event, element) => {
      const bounds = element.getBoundingClientRect();
      return Math.round(((event.clientX - bounds.left - MARGIN.left) / innerWidth) * (positions - 1));
    };

    const chart = svg('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}` }, grid, xTicks, crosshair, lines, ends, nodes, labels);
    chart.addEventListener('pointermove', (event) => showAt(positions > 1 ? nearest(event, chart) : 0));
    chart.addEventListener('pointerleave', hide);

    plot.onkeydown = (event) => {
      if (event.key === 'ArrowLeft') showAt((cursor ?? positions) - 1);
      else if (event.key === 'ArrowRight') showAt((cursor ?? -1) + 1);
      else if (event.key === 'Escape') hide();
      else return;
      event.preventDefault();
    };
    plot.onblur = hide;
    return chart;
  }

  new ResizeObserver(([entry]) => draw(Math.floor(entry.contentRect.width))).observe(plot);
  return root;
}

/**
 * Horizontal bars for comparing a few categories.
 *   rows: [{ label, lead?, value, display, detail? }]
 * Every value is printed, so no information is hidden behind hover.
 */
export function barList(rows, { max = null } = {}) {
  const top = max ?? Math.max(...rows.map((row) => row.value), 0);
  return h('div', { class: 'bars' }, rows.map((row) =>
    h('div', { class: 'bar-row' },
      h('div', { class: 'bar-label' }, row.lead, h('span', null, row.label)),
      h('div', { class: 'bar-track' },
        h('span', { class: 'bar', style: { width: `${top > 0 ? (row.value / top) * 100 : 0}%`, ...(row.colour && { background: row.colour }) } })),
      h('div', { class: 'bar-val' }, row.display, row.detail && h('small', null, row.detail)))));
}
