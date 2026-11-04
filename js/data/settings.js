// Personal preferences kept in this browser: theme, chosen system and experiments with scoring settings.
// None of these change the league's published data.
import * as storage from './browser-storage.js';

const KEY = 'flfoxtan.settings';
const listeners = new Set();
let values = { approachId: null, view: 'single', showRetired: false, paramOverrides: {}, enabledOverrides: {}, ...storage.read(KEY, {}) };

export const settings = {
  get: (name) => values[name],

  set(name, value) {
    values = { ...values, [name]: value };
    storage.write(KEY, values);
    listeners.forEach((listener) => listener());
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setParam(approachId, key, value) {
    const current = values.paramOverrides[approachId] || {};
    settings.set('paramOverrides', { ...values.paramOverrides, [approachId]: { ...current, [key]: value } });
  },

  resetParams(approachId) {
    const { [approachId]: removed, ...rest } = values.paramOverrides;
    settings.set('paramOverrides', rest);
  },

  setEnabled(approachId, enabled) {
    settings.set('enabledOverrides', { ...values.enabledOverrides, [approachId]: enabled });
  },
};
