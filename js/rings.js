// The Ebbly circles: soft rings, like ripples on still water.
// size: 0 (breathed out) to 1 (breathed in). Drawn on a canvas.
//
// Each moment can have its own way of moving (set "rings" in loops.json):
//   ripple   gentle ripples (the default)
//   outward  rings travel outwards and fade, like letting a replay drift off
//   tide     slow sway, like water going in and out
//   loosen   starts a little knotted, then slowly relaxes into round
//   warm     a warm sand-coloured glow
//   open     rings with gaps in them, room to breathe
//   still    fewer rings, dim and completely still
//   fade     slowly dims, for night time
// With "Minimal" movement in Settings, every mode is drawn still.

export const MODES = ["ripple", "outward", "tide", "loosen", "warm", "open", "still", "fade"];

export function createRings(canvas, { getSize, isMinimal, rings = 7, mode = "ripple" }) {
  const ctx2d = canvas.getContext("2d");
  let raf = 0;
  let running = false;
  let w = 0, h = 0, dpr = 1;
  let t0 = performance.now();
  if (!MODES.includes(mode)) mode = "ripple";

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return { breath: v("--breath", "#9CC3B5"), sand: v("--sand", "#D6B98F"), lichen: v("--lichen", "#AEB4A9") };
  }
  let palette = colors();

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;

  function draw(now) {
    if (!w || !h) { if (running) raf = requestAnimationFrame(draw); return; }
    const minimal = isMinimal();
    const t = minimal ? 0 : (now - t0) / 1000; // seconds since this started
    const size = Math.max(0, Math.min(1, getSize(now / 1000)));
    const ring = hexToRgb(mode === "warm" ? palette.sand : mode === "fade" ? palette.lichen : palette.breath);
    const glowC = mode === "warm" ? hexToRgb(palette.sand) : ring;

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(w, h) * 0.47;
    const outer = maxR * (0.42 + 0.58 * size);

    // How strong everything is drawn.
    let strength = 1;
    if (mode === "still") strength = 0.6;
    if (mode === "fade") strength = 1 - 0.65 * Math.min(1, t / 150); // dims over about two and a half minutes
    const count = mode === "still" ? 4 : rings;

    // Soft glow behind the rings.
    const glowR = outer * (mode === "warm" ? 1.25 : 1.05);
    const glow = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    const glowA = (mode === "warm" ? 0.2 + 0.12 * size : 0.10 + 0.12 * size) * strength;
    glow.addColorStop(0, rgba(glowC, glowA));
    glow.addColorStop(1, rgba(glowC, 0));
    ctx2d.fillStyle = glow;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, glowR, 0, Math.PI * 2); ctx2d.fill();

    // Rings travel outwards in "outward" mode.
    const drift = mode === "outward" ? (t * 0.045) % 1 : 0;
    // "loosen" starts knotted and relaxes over a couple of minutes.
    const knot = mode === "loosen" ? (minimal ? 0 : 1 / (1 + t / 25)) : 0;

    for (let i = 0; i < count; i++) {
      let k = (i + 1) / count;
      let alpha = (0.55 - 0.42 * k + 0.1 * size) * strength;
      if (mode === "outward") {
        k = (i + drift) / count;
        if (k <= 0.02) continue;
        alpha = (0.22 + 0.4 * Math.sin(Math.PI * k) * (1 - k * 0.5) + 0.08 * size) * strength;
      }
      const base = outer * k;
      ctx2d.strokeStyle = rgba(ring, Math.max(0.05 * strength, alpha));
      ctx2d.lineWidth = 1.4 + (1 - k) * 1.2;

      // Where this ring sits (tide moves each ring a little after the one inside it).
      let ox = 0, oy = 0, sx = 1, sy = 1;
      if (mode === "tide") {
        oy = Math.sin(t * 0.42 - i * 0.38) * maxR * 0.035;
        ox = Math.sin(t * 0.21 - i * 0.3) * maxR * 0.02;
        sx = 1.04; sy = 0.96;
      }

      // Rings with a gap, slowly turning, for "open".
      let from = 0, to = Math.PI * 2;
      if (mode === "open") {
        const gap = 0.55 + 0.25 * k;
        const turn = t * 0.04 * (i % 2 ? 1 : -1) + i * 1.3;
        from = turn + gap / 2; to = turn + Math.PI * 2 - gap / 2;
        ctx2d.lineCap = "round";
      }

      ctx2d.beginPath();
      const steps = 140;
      for (let s = 0; s <= steps; s++) {
        const a = from + (s / steps) * (to - from);
        let wobble = 0;
        if (!minimal && mode !== "still") {
          const calm = mode === "fade" ? 0.5 : 1;
          wobble = base * k * k * calm * (
            Math.sin(a * 3 + t * 0.25 + i * 0.9) * 0.012 +
            Math.sin(a * 2 - t * 0.17 + i) * 0.008);
          if (mode === "tide") wobble += base * Math.sin(a + t * 0.3 + i * 0.5) * 0.01;
          if (knot) wobble += base * knot * (Math.sin(a * 5 + t * 0.6 + i * 1.7) * 0.05 + Math.sin(a * 7 - t * 0.4 + i) * 0.025);
        }
        const rr = base + wobble;
        const x = cx + ox + Math.cos(a) * rr * sx, y = cy + oy + Math.sin(a) * rr * sy;
        s ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
      }
      if (mode !== "open") ctx2d.closePath();
      ctx2d.stroke();
    }
    if (running) raf = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); });
  ro.observe(canvas);

  return {
    start() { if (running) return; running = true; t0 = performance.now(); resize(); palette = colors(); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); },
    redraw() { palette = colors(); resize(); draw(performance.now()); },
    setMode(m) { mode = MODES.includes(m) ? m : "ripple"; t0 = performance.now(); if (!running) this.redraw(); },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
