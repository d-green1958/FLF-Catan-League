// Safe access to the browser's localStorage. If storage is blocked (some private windows), values live
// in memory until the page closes rather than crashing the app.
const memory = new Map();

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return memory.has(key) ? memory.get(key) : fallback;
  }
}

export function write(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Already held in memory above.
  }
}

export function remove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing more to do.
  }
}
