// How numbers and dates appear on the page.

/** Displays a score in the style its system declares in rating-approaches.json. */
export function formatScore(value, format) {
  if (value === null || value === undefined) return '–';
  switch (format) {
    case 'percent': return `${(value * 100).toFixed(1)}%`;
    case 'signed': return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
    default: return String(Math.round(value));
  }
}

/** Displays a change in score, such as +12 or −0.4%. Returns a dash when nothing moved. */
export function formatChange(change, format) {
  const scaled = format === 'percent' ? change * 100 : change;
  const decimals = format === 'percent' ? 1 : format === 'signed' ? 2 : 0;
  const rounded = Number(scaled.toFixed(decimals));
  if (rounded === 0) return '–';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toFixed(decimals)}${format === 'percent' ? ' pts' : ''}`;
}

export const percent = (value) => `${Math.round(value * 100)}%`;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const longDateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Who added something. A name typed with the group password is marked, as GitHub has not verified it. */
export const addedByLabel = ({ addedBy, viaPassword }) => (viaPassword ? `${addedBy} (group password)` : addedBy);

export const formatDate = (iso) => (iso ? dateFormat.format(new Date(`${iso}T00:00:00Z`)) : '–');
export const formatLongDate = (iso) => (iso ? longDateFormat.format(new Date(`${iso}T00:00:00Z`)) : '–');
export const formatShortDate = (iso) => (iso ? shortDateFormat.format(new Date(`${iso}T00:00:00Z`)) : '–');

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function ordinal(number) {
  const suffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
  return `${number}${suffixes[new Intl.PluralRules('en-GB', { type: 'ordinal' }).select(number)]}`;
}

/** Today's date in the viewer's own timezone, as YYYY-MM-DD. */
export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
