// Small building blocks shared by several pages.
import { store } from '../data/store.js';
import { h, route } from './dom.js';
import { icon } from './icons.js';
import { formatChange } from './format.js';

const colourById = (id) => store.reference().colours.find((colour) => colour.id === id);

export function pageHeader({ eyebrow, title, intro, actions }) {
  return h('header', { class: 'ph' },
    h('div', { class: 't' },
      eyebrow && h('div', { class: 'eyebrow' }, eyebrow),
      h('h1', null, title),
      intro && h('p', null, intro)),
    actions && h('div', { class: 'acts' }, actions));
}

export function page(...children) {
  return h('div', { class: 'page' }, children);
}

export function sectionHeader(title, hint, right) {
  return h('div', { class: 'sh' },
    h('h2', null, title),
    hint && h('span', { class: 'hint' }, hint),
    right && h('div', { class: 'right' }, right));
}

export function kpi(label, value, detail, iconName) {
  return h('div', { class: 'kpi' },
    h('div', { class: 'k' }, iconName && icon(iconName), label),
    h('div', { class: 'v' }, value),
    detail && h('div', { class: 'd' }, detail));
}

export function colourDot(colourId) {
  const colour = colourById(colourId);
  return h('span', {
    class: 'piece-dot',
    title: colour?.name ?? colourId,
    style: { '--piece': colour?.hex ?? 'transparent' },
  });
}

export function colourName(colourId) {
  return colourById(colourId)?.name ?? colourId;
}

export function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : name.slice(0, 2)).toUpperCase();
}

/** An avatar with initials, ringed with the player's favourite colour. */
export function avatar(player, size = '') {
  const colour = colourById(player?.favouriteColour);
  return h('span', {
    class: `avatar ${size}`.trim(),
    style: colour ? { '--ring': colour.hex } : null,
    'aria-hidden': 'true',
  }, initials(player?.name ?? '?'));
}

export function playerLink(player) {
  if (!player) return h('span', { class: 'muted' }, 'Unknown player');
  return h('a', { class: 'link', href: route(`/players/${encodeURIComponent(player.id)}`) }, player.name);
}

export function changeBadge(change, format) {
  const text = formatChange(change, format);
  const direction = text === '–' ? 'flat' : change > 0 ? 'up' : 'down';
  return h('span', { class: `delta ${direction}` }, text);
}

export function emptyState({ title, message, actions }) {
  return h('div', { class: 'empty card' },
    h('h2', null, title),
    h('p', null, message),
    actions && h('div', { class: 'acts' }, actions));
}

export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint && h('span', { class: 'field-hint' }, hint));
}

export function errorList(errors) {
  if (!errors.length) return null;
  return h('ul', { class: 'errors', role: 'alert' }, errors.map((error) => h('li', null, error)));
}

/** A scrolling table. Columns are { label, align?, sticky? }, and rows are arrays of cells. */
export function table(columns, rows) {
  return h('div', { class: 'table-wrap', tabindex: '0' },
    h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, columns.map((column) =>
        h('th', { scope: 'col', class: columnClass(column), title: column.title }, column.label)))),
      h('tbody', null, rows.map((row) =>
        h('tr', { class: row.className },
          (row.cells || row).map((cell, index) => h('td', { class: columnClass(columns[index]) }, cell)))))));
}

function columnClass(column) {
  return [column.align === 'right' && 'num-col', column.sticky && 'sticky-col'].filter(Boolean).join(' ') || null;
}
