// Calming sounds made in the browser (no files to download), plus soft breathing tones.
// Everything fades in and out; nothing starts suddenly or loudly.

export const LAYERS = [
  { id: "brown", name: "Brown noise", note: "Deep and steady. Softens sharp sounds around you." },
  { id: "pink", name: "Pink noise", note: "Lighter, like a distant waterfall." },
  { id: "rain", name: "Rain", note: "Soft rain on a window." },
  { id: "waves", name: "Slow waves", note: "Rises and falls about six times a minute." },
  { id: "drone", name: "Warm hum", note: "A low, gentle chord with no beat." },
];

// Named mixes used by the home screen and the library.
export const MIXES = {
  "quiet-room": { brown: 0.6 },
  "low-tide": { waves: 0.6, drone: 0.25 },
  "rain-room": { rain: 0.55, brown: 0.25 },
  "soft-focus": { pink: 0.35, drone: 0.2 },
};

const FADE = 2.5;      // seconds to fade a sound in or out
const MAX_OUT = 0.55;  // overall ceiling so nothing is ever loud

let ctx = null;
let master = null;
let buffers = {};
const active = new Map(); // id -> { gain, stop() }
const listeners = new Set();
let timerId = null;
let timerEnds = 0;

function ensureContext() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // iOS: play through the silent switch, like a music app.
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* ignore */ }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = MAX_OUT;
  master.connect(ctx.destination);
  return ctx;
}

function noiseBuffer(kind) {
  if (buffers[kind]) return buffers[kind];
  const seconds = 12;
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    // Crossfade the loop point so there is no click when it repeats.
    const x = Math.floor(ctx.sampleRate * 0.5);
    for (let i = 0; i < x; i++) {
      const t = i / x;
      d[i] = d[i] * t + d[len - x + i] * (1 - t);
    }
  }
  buffers[kind] = buf;
  return buf;
}

function loop(kind) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = true;
  src.loopStart = 0.5;
  src.loopEnd = src.buffer.duration - 0.5;
  return src;
}

function build(id, out) {
  const nodes = [];
  const start = (n) => { n.start(); nodes.push(n); return n; };

  if (id === "brown") {
    const src = start(loop("brown"));
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
    src.connect(lp).connect(out);
  }
  if (id === "pink") {
    const src = start(loop("pink"));
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000;
    src.connect(lp).connect(out);
  }
  if (id === "rain") {
    const src = start(loop("pink"));
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 700;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
    const shimmer = ctx.createGain(); shimmer.gain.value = 0.85;
    const wob = start(ctx.createOscillator()); wob.frequency.value = 0.13;
    const wobAmt = ctx.createGain(); wobAmt.gain.value = 0.12;
    wob.connect(wobAmt).connect(shimmer.gain);
    src.connect(hp).connect(lp).connect(shimmer).connect(out);
    const body = start(loop("brown"));
    const bl = ctx.createBiquadFilter(); bl.type = "lowpass"; bl.frequency.value = 350;
    const bg = ctx.createGain(); bg.gain.value = 0.35;
    body.connect(bl).connect(bg).connect(out);
  }
  if (id === "waves") {
    const src = start(loop("brown"));
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    const swell = ctx.createGain(); swell.gain.value = 0.55;
    const lfo = start(ctx.createOscillator()); lfo.frequency.value = 0.1; // six per minute
    const depth = ctx.createGain(); depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    const lfo2 = ctx.createGain(); lfo2.gain.value = 500;
    lfo.connect(lfo2).connect(lp.frequency);
    src.connect(lp).connect(swell).connect(out);
  }
  if (id === "drone") {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650;
    const sum = ctx.createGain(); sum.gain.value = 0.22;
    [[110, -3], [110, 4], [164.8, 0], [220, 2]].forEach(([f, det]) => {
      const o = start(ctx.createOscillator());
      o.type = "sine"; o.frequency.value = f; o.detune.value = det;
      o.connect(sum);
    });
    const lfo = start(ctx.createOscillator()); lfo.frequency.value = 0.05;
    const amt = ctx.createGain(); amt.gain.value = 180;
    lfo.connect(amt).connect(lp.frequency);
    sum.connect(lp).connect(out);
  }
  return () => nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
}

function emit() { listeners.forEach((fn) => fn()); }
export function onChange(fn) { listeners.add(fn); }

export function isOn(id) { return active.has(id); }
export function anyOn() { return active.size > 0; }

export function setLevel(id, level) {
  const a = active.get(id);
  if (a) a.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.3);
}

export function turnOn(id, level = 0.5) {
  ensureContext();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(MAX_OUT, ctx.currentTime, 0.4);
  if (active.has(id)) { setLevel(id, level); return; }
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  const stop = build(id, gain);
  gain.gain.setTargetAtTime(level, ctx.currentTime, FADE / 3);
  active.set(id, { gain, stop });
  emit();
}

export function turnOff(id) {
  const a = active.get(id);
  if (!a) return;
  active.delete(id);
  a.gain.gain.cancelScheduledValues(ctx.currentTime);
  a.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 3);
  setTimeout(() => { a.stop(); a.gain.disconnect(); }, FADE * 1000 + 500);
  if (!active.size) clearTimer();
  emit();
}

export function stopAll() {
  [...active.keys()].forEach(turnOff);
  clearTimer();
}

export function playMix(name, levels = {}) {
  const mix = MIXES[name];
  if (!mix) return;
  LAYERS.forEach(({ id }) => {
    if (mix[id] != null) turnOn(id, levels[id] ?? mix[id]);
    else turnOff(id);
  });
}

// Fade everything out after a number of minutes (0 = keep playing).
export function fadeOutAfter(minutes) {
  clearTimer();
  if (!minutes) { emit(); return; }
  timerEnds = Date.now() + minutes * 60000;
  timerId = setTimeout(() => {
    ensureContext();
    master.gain.setTargetAtTime(0, ctx.currentTime, 6);
    setTimeout(() => { stopAll(); }, 20000);
  }, minutes * 60000);
  emit();
}
function clearTimer() { clearTimeout(timerId); timerId = null; timerEnds = 0; }
export function timerRemaining() { return timerEnds ? Math.max(0, timerEnds - Date.now()) : 0; }

// A soft bell-like tone for breathing cues. Higher for in, lower for out.
export function cue(kind) {
  ensureContext();
  const t = ctx.currentTime;
  const f = kind === "in" ? 392 : kind === "out" ? 294 : 330;
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.01;
  const g = ctx.createGain(); g.gain.value = 0;
  const g2 = ctx.createGain(); g2.gain.value = 0.15;
  o.connect(g); o2.connect(g2).connect(g); g.connect(ctx.destination);
  g.gain.linearRampToValueAtTime(0.07, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
}

// Called from a tap or click so browsers allow sound later on.
export function unlock() { ensureContext(); }
