// Breathing patterns and a simple session runner.
// Each step moves the shape towards a size (0 = out, 1 = in) over a number of seconds.

export const PATTERNS = {
  "longer-out": {
    name: "Longer out-breath",
    rings: "ripple", feel: "Settling", timing: "In 4, out 6",
    hint: "In for 4, out for 6. A longer out-breath helps the body slow down.",
    steps: [
      { cue: "Breathe in", kind: "in", secs: 4, to: 1 },
      { cue: "Breathe out", kind: "out", secs: 6, to: 0 },
    ],
  },
  sigh: {
    name: "Double sigh",
    rings: "outward", feel: "Quick relief", timing: "In, a little more, long sigh out",
    hint: "Two breaths in through the nose, then a long, slow sigh out. Good for fast relief.",
    steps: [
      { cue: "Breathe in", kind: "in", secs: 2.5, to: 0.8 },
      { cue: "A little more", kind: "in", secs: 1, to: 1 },
      { cue: "Long sigh out", kind: "out", secs: 7, to: 0 },
    ],
  },
  box: {
    name: "Box",
    rings: "still", shape: "box", feel: "Steady", timing: "In 4, hold 4, out 4, hold 4",
    hint: "In, hold, out, hold, for 4 each. Steady and predictable.",
    steps: [
      { cue: "Breathe in", kind: "in", secs: 4, to: 1 },
      { cue: "Hold", kind: "hold", secs: 4, to: 1 },
      { cue: "Breathe out", kind: "out", secs: 4, to: 0 },
      { cue: "Hold", kind: "hold", secs: 4, to: 0 },
    ],
  },
  even: {
    name: "Even",
    rings: "tide", feel: "Balanced", timing: "In 5, out 5",
    hint: "In for 5, out for 5. A calm, even rhythm about six breaths a minute.",
    steps: [
      { cue: "Breathe in", kind: "in", secs: 5, to: 1 },
      { cue: "Breathe out", kind: "out", secs: 5, to: 0 },
    ],
  },
  "4-7-8": {
    name: "4-7-8",
    rings: "fade", feel: "Winding down", timing: "In 4, hold 7, out 8",
    hint: "In for 4, hold for 7, out for 8. Some find it helps before sleep. Skip the hold if it feels uncomfortable.",
    steps: [
      { cue: "Breathe in", kind: "in", secs: 4, to: 1 },
      { cue: "Hold", kind: "hold", secs: 7, to: 1 },
      { cue: "Breathe out", kind: "out", secs: 8, to: 0 },
    ],
  },
};

export const MINUTES = [1, 3, 5, 10, 0]; // 0 = no limit

const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// A practice "pattern" that changes pace gently over the session:
// starts at the person's own rate and glides towards the target, never faster than
// 1 breath a minute per minute, reaching it (at most) about 70% of the way through.
export function practicePattern({ from, to, minutes, outShare = 0.6 }) {
  const totalMs = Math.max(1, minutes) * 60000;
  const rampMs = totalMs * 0.7;
  const dir = Math.sign(to - from);
  let last = from;
  const rateAt = (elapsed) => {
    const linear = from + (to - from) * Math.min(1, elapsed / rampMs);
    const capped = from + dir * Math.min(Math.abs(to - from), (elapsed / 60000) * 1.0);
    // whichever has moved less from the start is the gentler one
    return Math.abs(linear - from) < Math.abs(capped - from) ? linear : capped;
  };
  return {
    get reached() { return last; },
    nextSteps(elapsed) {
      const bpm = rateAt(elapsed);
      last = bpm;
      const cycle = 60 / bpm;
      return [
        { cue: "Breathe in", kind: "in", secs: cycle * (1 - outShare), to: 1, bpm },
        { cue: "Breathe out", kind: "out", secs: cycle * outShare, to: 0, bpm },
      ];
    },
  };
}

export function createSession({ onStep, onTick, onDone }) {
  let pattern = null;
  let steps = [];
  let stepIndex = 0;
  let stepStart = 0;
  let from = 0;
  let size = 0.35; // resting size before starting
  let endAt = 0;
  let startedAt = 0;
  let running = false;
  let tickId = 0;
  let stepP = 0;

  function beginStep(now) {
    const step = steps[stepIndex];
    from = size;
    stepStart = now;
    onStep(step, stepIndex);
  }

  function frame() {
    if (!running) return;
    const now = performance.now();
    const step = steps[stepIndex];
    const p = Math.min(1, (now - stepStart) / (step.secs * 1000));
    stepP = p;
    size = from + (step.to - from) * ease(p);
    const left = Math.ceil(step.secs - (now - stepStart) / 1000);
    onTick({ size, step, secondsLeftInStep: Math.max(1, left), remaining: endAt ? Math.max(0, endAt - Date.now()) : null });
    if (p >= 1) {
      stepIndex = (stepIndex + 1) % steps.length;
      if (stepIndex === 0) {
        // Only finish at the end of a full breath, never mid-breath.
        if (endAt && Date.now() >= endAt) { finish(); return; }
        if (pattern.nextSteps) steps = pattern.nextSteps(Date.now() - startedAt);
      }
      beginStep(now);
    }
    tickId = requestAnimationFrame(frame);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(tickId);
    onDone();
  }

  return {
    start(patternOrId, minutes) {
      pattern = typeof patternOrId === "string" ? PATTERNS[patternOrId] : patternOrId;
      startedAt = Date.now();
      steps = pattern.nextSteps ? pattern.nextSteps(0) : pattern.steps;
      stepIndex = 0;
      endAt = minutes ? startedAt + minutes * 60000 : 0;
      running = true;
      beginStep(performance.now());
      tickId = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(tickId); },
    get running() { return running; },
    get size() { return size; },
    // 0..1 through a hold, or null when not holding
    get hold() { return running && steps[stepIndex]?.kind === "hold" ? stepP : null; },
    get elapsed() { return startedAt ? Date.now() - startedAt : 0; },
    settle() {
      // Ease the shape back to resting size after stopping.
      const startSize = size, t0 = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / 1500);
        size = startSize + (0.35 - startSize) * ease(p);
        if (p < 1 && !running) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  };
}
