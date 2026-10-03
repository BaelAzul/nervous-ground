// Settings and small preferences, kept on this device only.
const KEY = "nervous-ground:v1"; // internal storage name; kept from the app's first name so saved settings carry over

const defaults = {
  theme: "dusk",
  motion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "minimal" : "gentle",
  textSize: "normal",
  font: "rounded",   // rounded (Nunito), clear (Atkinson Hyperlegible) or lexend
  spacing: "normal", // normal or roomy
  captions: true,    // show a meditation's words as they're spoken, when it has them
  tones: false,
  vibrate: false,
  showCount: true,
  pattern: "longer-out",
  minutes: 3,
  soundTimer: 0,
  levels: {},
  breathMode: "patterns",
  practiceFrom: 10,
  practiceTarget: 6,
  practiceShare: 0.6,
  practiceMinutes: 5,
  practiceLog: [],
  background: "none",
  worryTime: null, // only the time someone chose to come back to a worry; never the words
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
