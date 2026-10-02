// Settings and small preferences, kept on this device only.
const KEY = "nervous-ground:v1";

const defaults = {
  theme: "dusk",
  motion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "minimal" : "gentle",
  textSize: "normal",
  tones: false,
  vibrate: false,
  showCount: true,
  pattern: "longer-out",
  minutes: 3,
  soundTimer: 0,
  levels: {},
};

let state = { ...defaults };

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  state = { ...defaults, ...saved, levels: { ...(saved.levels || {}) } };
} catch { /* private mode or storage blocked: use defaults */ }

const listeners = new Set();

export function get(key) { return state[key]; }

export function set(key, value) {
  state[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(key, value));
}

export function onChange(fn) { listeners.add(fn); }

export function minimalMotion() { return state.motion === "minimal"; }
