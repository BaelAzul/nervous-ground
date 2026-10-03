// Calming sounds made in the browser (no files to download), plus soft breathing tones.
// Everything fades in and out; nothing starts suddenly or loudly.

// Groups shown on the Sounds screen, in this order.
export const FAMILIES = [
  { id: "steady", name: "Steady noise", note: "Even sound that covers what's around you." },
  { id: "nature", name: "Nature", note: "Made in the app, a little different every moment." },
  { id: "recorded", name: "Recorded outdoors", note: "Real places, recorded for Ebbly." },
  { id: "close", name: "Close and warm", note: "Low, near and body-like." },
  { id: "tones", name: "Tones", note: "Soft musical sounds with no beat." },
];

export const LAYERS = [
  { id: "brown", family: "steady", name: "Brown noise", note: "Deep and rumbly. Softens sharp sounds nearby." },
  { id: "green", family: "steady", name: "Green noise", note: "Like a far-off waterfall. Often feels the most natural." },
  { id: "pink", family: "steady", name: "Pink noise", note: "Lighter and airier, like steady rain." },
  { id: "grey", family: "steady", name: "Grey noise", note: "Balanced, nothing sticks out. Kind to sensitive ears." },
  { id: "fan", family: "steady", name: "Fan", note: "Moving air, like a fan in the next room." },
  { id: "rain", family: "nature", name: "Rain", note: "Soft rain with the odd drop close by." },
  { id: "waves", family: "nature", name: "Waves", note: "Unhurried waves. Each one a little different." },
  { id: "stream", family: "nature", name: "Stream", note: "Water running over stones." },
  { id: "wind", family: "nature", name: "Wind", note: "Slow gusts that come and go." },
  { id: "fire", family: "nature", name: "Fire", note: "Low warmth with quiet crackles." },
  { id: "purr", family: "close", name: "Purr", note: "A cat purring. Low and steady." },
  { id: "heartbeat", family: "close", name: "Slow heartbeat", note: "About 56 a minute. Grounding for some, not all." },
  { id: "drone", family: "tones", name: "Warm hum", note: "A low, gentle chord with no beat." },
  { id: "bowl", family: "tones", name: "Singing bowl", note: "A soft bowl now and then, with long quiet between." },
];

// Named mixes used by the home screen, calm space and library.
export const MIXES = {
  "quiet-room": { brown: 0.6 },
  "low-tide": { waves: 0.6, drone: 0.2 },
  "rain-room": { rain: 0.55, brown: 0.25 },
  "soft-focus": { green: 0.4, drone: 0.15 },
  "warm-hum": { drone: 0.4 },
  "fireside": { fire: 0.55, wind: 0.15 },
  "by-a-stream": { stream: 0.5, wind: 0.15 },
  "curled-up": { purr: 0.5, rain: 0.25 },
  "still-air": { grey: 0.45, bowl: 0.35 },
};

// Background choices offered under a recording.
export const BACKGROUNDS = [
  ["none", "No background"],
  ["rain-room", "Rain"],
  ["low-tide", "Waves"],
  ["by-a-stream", "Stream"],
  ["fireside", "Fire"],
  ["quiet-room", "Low noise"],
  ["warm-hum", "Warm hum"],
];

// Your own recordings, listed in sounds.json, join the Sounds screen as loops.
const recorded = new Map(); // id -> { src }
export function addRecordings(list = []) {
  list.forEach((r) => {
    if (!r?.id || !r?.src || recorded.has(r.id) || LAYERS.some((l) => l.id === r.id)) return;
    recorded.set(r.id, { src: r.src });
    LAYERS.push({ id: r.id, family: "recorded", name: r.name || r.id, note: r.note || "", added: r.added });
  });
  emit();
}

const TRIM = { stream: 2.2, wind: 2.2, fire: 1.7, waves: 1.5, rain: 1.2, drone: 0.8, grey: 0.8 };
const FADE = 2.5;      // seconds to fade a sound in or out
const MAX_OUT = 0.55;  // overall ceiling so nothing is ever loud

let ctx = null;
let master = null;
let bed = null;          // background sounds pass through here so they can dip under a voice
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
  bed = ctx.createGain();
  bed.gain.value = 1;
  bed.connect(master);
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

// Short bursts of noise used for raindrops, crackles and stones in water.
function tickBuffer(ms) {
  const key = `tick${ms}`;
  if (buffers[key]) return buffers[key];
  const len = Math.floor(ctx.sampleRate * ms / 1000);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  buffers[key] = buf;
  return buf;
}
const rand = (a, b) => a + Math.random() * (b - a);

function build(id, out) {
  const nodes = [];
  const timers = [];
  const start = (n) => { n.start(); nodes.push(n); return n; };
  const filter = (type, freq, q) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q; return f; };
  const gainOf = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  // Run something every so often while the sound is on (randomised so it never repeats exactly).
  const every = (fn, minMs, maxMs) => {
    const h = { id: 0, alive: true };
    const go = () => { if (!h.alive) return; fn(); h.id = setTimeout(go, rand(minMs, maxMs)); };
    h.id = setTimeout(go, rand(0, minMs));
    timers.push({ stop: () => { h.alive = false; clearTimeout(h.id); } });
  };
  // A one-off short sound (a drop, a crackle), through its own filter and level.
  const blip = (ms, type, freq, q, level, rate = 1, when = 0) => {
    const b = ctx.createBufferSource();
    b.buffer = tickBuffer(ms);
    b.playbackRate.value = rate;
    const f = filter(type, freq, q);
    const g = gainOf(level);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = rand(-0.7, 0.7); b.connect(f).connect(g).connect(pan).connect(out); }
    else b.connect(f).connect(g).connect(out);
    b.start(ctx.currentTime + when);
  };

  if (id === "brown") {
    start(loop("brown")).connect(filter("lowpass", 1200)).connect(out);
  }
  if (id === "pink") {
    start(loop("pink")).connect(filter("lowpass", 5000)).connect(out);
  }
  if (id === "green") {
    const src = start(loop("pink"));
    const band = filter("bandpass", 520, 0.55);
    const body = filter("lowpass", 1800);
    src.connect(band).connect(gainOf(2.2)).connect(body).connect(out);
  }
  if (id === "grey") {
    const src = start(loop("pink"));
    const low = filter("lowshelf", 220); low.gain.value = 7;
    const high = filter("highshelf", 3500); high.gain.value = -9;
    src.connect(low).connect(high).connect(gainOf(0.8)).connect(out);
  }
  if (id === "fan") {
    const air = start(loop("brown"));
    const lp = filter("lowpass", 900);
    air.connect(lp).connect(gainOf(0.9)).connect(out);
    const hiss = start(loop("pink"));
    hiss.connect(filter("bandpass", 1600, 0.7)).connect(gainOf(0.18)).connect(out);
    const hum = start(ctx.createOscillator()); hum.frequency.value = 98;
    const flutter = start(ctx.createOscillator()); flutter.frequency.value = 7.5;
    const humG = gainOf(0.012), flAmt = gainOf(0.006);
    flutter.connect(flAmt).connect(humG.gain);
    hum.connect(humG).connect(out);
  }
  if (id === "rain") {
    const src = start(loop("pink"));
    const shimmer = gainOf(0.8);
    src.connect(filter("highpass", 700)).connect(filter("lowpass", 6000)).connect(shimmer).connect(out);
    every(() => shimmer.gain.setTargetAtTime(rand(0.65, 0.95), ctx.currentTime, 2), 3000, 7000);
    start(loop("brown")).connect(filter("lowpass", 350)).connect(gainOf(0.35)).connect(out);
    // the odd nearer drop
    every(() => blip(18, "bandpass", rand(2500, 5500), 2.5, rand(0.05, 0.16), rand(0.8, 1.3)), 60, 260);
  }
  if (id === "waves") {
    const src = start(loop("brown"));
    const lp = filter("lowpass", 400);
    const swell = gainOf(0.15);
    src.connect(lp).connect(swell).connect(out);
    const foam = start(loop("pink"));
    const foamF = filter("bandpass", 2500, 0.6);
    const foamG = gainOf(0);
    foam.connect(foamF).connect(foamG).connect(out);
    // One wave at a time: rises for a few seconds, breaks, then draws back. Never quite the same.
    let next = 0;
    const wave = () => {
      const t = Math.max(ctx.currentTime, next);
      const rise = rand(3.5, 5.5), fall = rand(4.5, 6.5), peak = rand(0.75, 1);
      swell.gain.setTargetAtTime(peak, t, rise / 3);
      lp.frequency.setTargetAtTime(rand(900, 1300), t, rise / 3);
      foamG.gain.setTargetAtTime(peak * 0.12, t + rise * 0.8, 0.6);
      swell.gain.setTargetAtTime(0.15, t + rise, fall / 3);
      lp.frequency.setTargetAtTime(400, t + rise, fall / 3);
      foamG.gain.setTargetAtTime(0, t + rise + 0.8, fall / 4);
      next = t + rise + fall;
    };
    wave();
    every(() => { if (ctx.currentTime > next - 1.5) wave(); }, 500, 700);
  }
  if (id === "stream") {
    start(loop("brown")).connect(filter("lowpass", 500)).connect(gainOf(0.3)).connect(out);
    const src = start(loop("pink"));
    [520, 1150, 2400, 3900].forEach((f, i) => {
      const bp = filter("bandpass", f, 4);
      const g = gainOf(0.5 - i * 0.07);
      src.connect(bp).connect(g).connect(out);
      // babbling: each band wanders quickly and unevenly
      every(() => {
        bp.frequency.setTargetAtTime(f * rand(0.75, 1.35), ctx.currentTime, rand(0.03, 0.09));
        g.gain.setTargetAtTime(rand(0.15, 0.75) - i * 0.06, ctx.currentTime, 0.05);
      }, 70, 190);
    });
    every(() => blip(10, "bandpass", rand(1800, 4200), 6, rand(0.04, 0.1), rand(0.9, 1.6)), 120, 420);
  }
  if (id === "wind") {
    const src = start(loop("pink"));
    const bp = filter("bandpass", 400, 0.9);
    const g = gainOf(0.4);
    src.connect(bp).connect(gainOf(1.6)).connect(g).connect(out);
    const low = start(loop("brown"));
    const lowG = gainOf(0.3);
    low.connect(filter("lowpass", 300)).connect(lowG).connect(out);
    every(() => {
      const strength = rand(0.15, 1);
      bp.frequency.setTargetAtTime(250 + strength * 650, ctx.currentTime, rand(1.2, 2.5));
      bp.Q.setTargetAtTime(rand(0.7, 2), ctx.currentTime, 2);
      g.gain.setTargetAtTime(0.15 + strength * 0.6, ctx.currentTime, rand(1.2, 2.5));
      lowG.gain.setTargetAtTime(0.2 + strength * 0.25, ctx.currentTime, 2);
    }, 2500, 7000);
  }
  if (id === "fire") {
    start(loop("brown")).connect(filter("lowpass", 260)).connect(gainOf(0.55)).connect(out);
    const roar = start(loop("pink"));
    const roarG = gainOf(0.05);
    roar.connect(filter("bandpass", 900, 0.8)).connect(roarG).connect(out);
    every(() => roarG.gain.setTargetAtTime(rand(0.02, 0.09), ctx.currentTime, 0.8), 800, 2200);
    // crackles come in little clusters, with the odd louder pop
    every(() => {
      const n = Math.floor(rand(1, 5));
      for (let i = 0; i < n; i++) blip(rand(4, 9), "bandpass", rand(1500, 4500), 1.5, rand(0.08, 0.25), rand(0.7, 1.3), i * rand(0.02, 0.09));
      if (Math.random() < 0.12) blip(25, "lowpass", 700, 0.7, rand(0.25, 0.4), 0.6);
    }, 150, 900);
  }
  if (id === "purr") {
    const src = start(loop("brown"));
    const lp = filter("lowpass", 320);
    const am = gainOf(0.5);
    const rate = start(ctx.createOscillator()); rate.frequency.value = 25;
    const depth = gainOf(0.45);
    rate.connect(depth).connect(am.gain);
    // purrs on the breath in and the breath out, a little different each time
    const breath = gainOf(0.6);
    src.connect(lp).connect(am).connect(breath).connect(gainOf(1.8)).connect(out);
    let inBreath = true;
    every(() => {
      inBreath = !inBreath;
      rate.frequency.setTargetAtTime(inBreath ? rand(24, 27) : rand(21, 24), ctx.currentTime, 0.2);
      breath.gain.setTargetAtTime(inBreath ? rand(0.7, 0.9) : rand(0.45, 0.6), ctx.currentTime, 0.25);
    }, 1400, 1900);
  }
  if (id === "heartbeat") {
    const beat = (when, level) => {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(62, when); o.frequency.exponentialRampToValueAtTime(38, when + 0.18);
      const g = gainOf(0);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
      o.connect(g).connect(out);
      o.start(when); o.stop(when + 0.3);
    };
    let next = ctx.currentTime + 0.2;
    every(() => {
      while (next < ctx.currentTime + 1.2) {
        beat(next, 0.6); beat(next + 0.28, 0.35);
        next += 60 / rand(55, 57);
      }
    }, 400, 500);
  }
  if (id === "drone") {
    const lp = filter("lowpass", 650);
    const sum = gainOf(0.22);
    [[110, -3], [110, 4], [164.8, 0], [220, 2]].forEach(([f, det]) => {
      const o = start(ctx.createOscillator());
      o.type = "sine"; o.frequency.value = f; o.detune.value = det;
      o.connect(sum);
    });
    const lfo = start(ctx.createOscillator()); lfo.frequency.value = 0.05;
    lfo.connect(gainOf(180)).connect(lp.frequency);
    sum.connect(lp).connect(out);
  }
  if (id === "bowl") {
    const strike = () => {
      const t = ctx.currentTime + 0.05;
      const f = [174.6, 196, 220, 261.6][Math.floor(Math.random() * 4)];
      // a bowl's partials aren't neat multiples, which gives it that shimmer
      [[1, 0.5, 14], [2.76, 0.22, 9], [5.4, 0.08, 6], [8.9, 0.03, 4]].forEach(([m, lvl, dur]) => {
        [-2, 2].forEach((beatHz) => {
          const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * m + beatHz / 2;
          const g = gainOf(0);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(lvl * 0.12, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(out);
          o.start(t); o.stop(t + dur + 0.1);
        });
      });
    };
    timers.push(setTimeout(strike, 1500));
    every(strike, 25000, 50000);
  }
  return () => {
    timers.forEach((t) => (t && t.stop ? t.stop() : clearTimeout(t)));
    nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
  };
}

// A recording that loops without a gap: two copies take turns, crossfading for a few
// seconds each time round, so you never hear the join. Streams, so long files are fine.
const CROSS = 4;
function buildRecorded(id, out) {
  const { src } = recorded.get(id);
  const players = [0, 1].map(() => {
    const a = new Audio();
    a.src = src; a.preload = "auto"; a.crossOrigin = "anonymous";
    const g = gainOf(0);
    try { ctx.createMediaElementSource(a).connect(g).connect(out); } catch { /* fall back to plain volume */ }
    return { a, g };
  });
  function gainOf(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  let current = 0, stopped = false, crossing = false;
  // Equal-power curves keep the loudness steady through the join.
  const curve = (up) => Float32Array.from({ length: 64 }, (_, i) => (up ? Math.sin : Math.cos)((i / 63) * Math.PI / 2));
  const ramp = (g, up, secs) => {
    g.gain.cancelScheduledValues(ctx.currentTime);
    try { g.gain.setValueCurveAtTime(curve(up), ctx.currentTime, Math.max(0.05, secs)); }
    catch { g.gain.setTargetAtTime(up ? 1 : 0, ctx.currentTime, secs / 3); }
  };
  const begin = (p, fade) => {
    p.a.currentTime = 0;
    p.a.play().catch(() => {});
    ramp(p.g, true, fade);
  };
  // Let both copies play once inside the tap, so phones allow the second one later.
  players[1].a.play().then(() => players[1].a.pause()).catch(() => {});
  begin(players[0], 0.1);
  const watch = setInterval(() => {
    if (stopped) return;
    const p = players[current];
    const d = p.a.duration;
    if (!d || !isFinite(d) || crossing) return;
    const cross = Math.min(CROSS, d / 4);
    if (p.a.currentTime >= d - cross - 0.25) {
      crossing = true;
      const q = players[1 - current];
      begin(q, cross);
      ramp(p.g, false, cross);
      setTimeout(() => { p.a.pause(); current = 1 - current; crossing = false; }, cross * 1000 + 400);
    }
  }, 200);
  return () => {
    stopped = true;
    clearInterval(watch);
    setTimeout(() => players.forEach((p) => { p.a.pause(); p.a.removeAttribute("src"); p.a.load(); }), 100);
  };
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
  gain.connect(bed);
  // Even out how loud each sound feels, so switching between them is never a jolt.
  const trim = ctx.createGain();
  trim.gain.value = TRIM[id] ?? 1;
  trim.connect(gain);
  const stop = recorded.has(id) ? buildRecorded(id, trim) : build(id, trim);
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

// How loud the sounds are right now (0..1). Used for checking levels when testing.
let meterNode = null;
export function level() {
  if (!ctx) return 0;
  if (!meterNode) { meterNode = ctx.createAnalyser(); meterNode.fftSize = 2048; master.connect(meterNode); }
  const d = new Float32Array(meterNode.fftSize);
  meterNode.getFloatTimeDomainData(d);
  return Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length);
}

// Called from a tap or click so browsers allow sound later on.
export function unlock() { ensureContext(); }

// Play a recording (an <audio> element) through the same sound system, so the
// background can dip gently while the voice is speaking and rise in the pauses.
let voice = null;
let duckTimer = 0;
export function attachVoice(audioEl) {
  ensureContext();
  if (voice) return true;
  try {
    const src = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    src.connect(ctx.destination); // the voice itself is not capped by the background ceiling
    voice = { analyser, data: new Float32Array(analyser.fftSize), level: 0 };
    return true;
  } catch {
    return false; // older browsers: recording still plays, background just won't dip
  }
}
export function startDucking() {
  if (!voice) return;
  clearInterval(duckTimer);
  let quietFor = 0;
  duckTimer = setInterval(() => {
    voice.analyser.getFloatTimeDomainData(voice.data);
    let sum = 0;
    for (const v of voice.data) sum += v * v;
    const rms = Math.sqrt(sum / voice.data.length);
    const speaking = rms > 0.02;
    quietFor = speaking ? 0 : quietFor + 1;
    // dip quickly when the voice starts; come back up slowly after ~1.5s of quiet
    if (speaking) bed.gain.setTargetAtTime(0.4, ctx.currentTime, 0.25);
    else if (quietFor > 15) bed.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
  }, 100);
}
export function stopDucking() {
  clearInterval(duckTimer);
  if (bed) bed.gain.setTargetAtTime(1, ctx.currentTime, 1);
}
