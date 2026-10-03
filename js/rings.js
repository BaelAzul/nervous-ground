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
//
// Responsive extras (all optional, all off with Minimal movement):
//   interactive  touch or drag to send ripples out from your finger; the rings lean towards you
//   getAudio     a function returning { level, low, high, voice } so the rings move with the sound
//   motes        a number of tiny specks drifting slowly through the light

export const MODES = ["ripple", "outward", "tide", "loosen", "warm", "open", "still", "fade"];

// Options: shape "circle" or "box" (soft rounded squares, for box breathing);
// getHold() can return 0..1 while a breath is held, to draw a slow arc so the hold has a visible end.
export function createRings(canvas, {
  getSize, isMinimal, rings = 7, mode = "ripple", shape = "circle", getHold = null,
  interactive = false, getAudio = null, motes = 0,
}) {
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

  // Touch: ripples from the finger, a little extra energy, and a gentle lean towards it.
  const ripples = [];
  let energy = 0;
  let finger = null;              // where a finger is resting, if anywhere
  const pull = { x: 0, y: 0 };
  let lastDrag = 0;
  if (interactive) {
    canvas.style.touchAction = canvas.closest(".calm, .listen") ? "none" : "pan-y";
    const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener("pointerdown", (e) => {
      if (isMinimal() || !running) return;
      const p = at(e);
      ripples.push({ ...p, t: performance.now(), s: 1 });
      energy = Math.min(1.4, energy + 0.5);
      finger = p;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!finger || isMinimal()) return;
      finger = at(e);
      const now = performance.now();
      if (now - lastDrag > 140) { ripples.push({ ...finger, t: now, s: 0.55 }); lastDrag = now; energy = Math.min(1.4, energy + 0.08); }
    });
    const up = () => { finger = null; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);
  }

  // Sound: smoothed so the rings breathe with it rather than flicker.
  const aud = { level: 0, low: 0, high: 0, voice: 0 };

  // Specks of light drifting slowly outwards.
  const specks = Array.from({ length: motes }, () => newSpeck(true));
  function newSpeck(anywhere) {
    return { a: Math.random() * Math.PI * 2, r: anywhere ? Math.random() : Math.random() * 0.15, v: 0.004 + Math.random() * 0.01, spin: (Math.random() - 0.5) * 0.02, size: 0.6 + Math.random() * 1.2, tw: Math.random() * 6 };
  }

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

    // follow the sound, gently
    const a = !minimal && getAudio ? getAudio() : null;
    for (const key of ["level", "low", "high", "voice"]) {
      const target = a ? a[key] || 0 : 0;
      aud[key] += (target - aud[key]) * (key === "voice" ? 0.12 : 0.05);
    }
    energy *= 0.985;
    // lean towards a resting finger
    const tx = finger ? (finger.x - cx) * 0.08 : 0, ty = finger ? (finger.y - cy) * 0.08 : 0;
    pull.x += (tx - pull.x) * 0.06; pull.y += (ty - pull.y) * 0.06;
    const stir = 1 + aud.high * 2.5 + aud.voice * 1.4 + energy * 1.5;

    const outer = maxR * (0.42 + 0.58 * size) * (1 + aud.low * 0.08 + aud.voice * 0.07);

    // How strong everything is drawn.
    let strength = 1;
    if (mode === "still") strength = 0.6;
    if (mode === "fade") strength = 1 - 0.65 * Math.min(1, t / 150); // dims over about two and a half minutes
    const count = mode === "still" ? 4 : rings;

    // Soft glow behind the rings.
    const glowR = outer * (mode === "warm" ? 1.25 : 1.05);
    const glow = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    const glowA = ((mode === "warm" ? 0.2 + 0.12 * size : 0.10 + 0.12 * size) + aud.level * 0.12 + aud.voice * 0.18 + energy * 0.06) * strength;
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
      let ox = pull.x * (1 - k * 0.6), oy = pull.y * (1 - k * 0.6), sx = 1, sy = 1;
      if (mode === "tide") {
        oy += Math.sin(t * 0.42 - i * 0.38) * maxR * 0.035;
        ox += Math.sin(t * 0.21 - i * 0.3) * maxR * 0.02;
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
      const steps = shape === "box" ? 220 : 140;
      for (let s = 0; s <= steps; s++) {
        const a = from + (s / steps) * (to - from);
        let wobble = 0;
        if (!minimal && mode !== "still") {
          const calm = mode === "fade" ? 0.5 : 1;
          wobble = base * k * k * calm * stir * (
            Math.sin(a * 3 + t * 0.25 + i * 0.9) * 0.012 +
            Math.sin(a * 2 - t * 0.17 + i) * 0.008);
          if (mode === "tide") wobble += base * Math.sin(a + t * 0.3 + i * 0.5) * 0.01;
          if (knot) wobble += base * knot * (Math.sin(a * 5 + t * 0.6 + i * 1.7) * 0.05 + Math.sin(a * 7 - t * 0.4 + i) * 0.025);
        }
        let rr = base + wobble;
        if (shape === "box") {
          // superellipse: a circle that has become a soft square
          const n = 4;
          rr = rr * 0.93 / Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), 1 / n);
        }
        const x = cx + ox + Math.cos(a) * rr * sx, y = cy + oy + Math.sin(a) * rr * sy;
        s ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
      }
      if (mode !== "open") ctx2d.closePath();
      ctx2d.stroke();
    }
    // Ripples from a finger.
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = (now - rp.t) / 1000, life = 4.5;
      if (age > life || minimal) { ripples.splice(i, 1); continue; }
      const p = age / life;
      [0, 0.12].forEach((lag, j) => {
        const q = p - lag;
        if (q <= 0) return;
        ctx2d.strokeStyle = rgba(ring, (1 - q) * (1 - q) * 0.5 * rp.s * (j ? 0.5 : 1) * strength);
        ctx2d.lineWidth = 1.6 - j * 0.6;
        ctx2d.beginPath(); ctx2d.arc(rp.x, rp.y, (1 - Math.pow(1 - q, 2.2)) * maxR * 0.85 * rp.s + 2, 0, Math.PI * 2); ctx2d.stroke();
      });
    }

    // Specks of light.
    if (specks.length && !minimal) {
      const sc = hexToRgb(palette.sand);
      specks.forEach((sp, i) => {
        sp.r += sp.v * 0.016 * (1 + aud.level * 2 + energy);
        sp.a += sp.spin * 0.016;
        if (sp.r > 1.05) specks[i] = newSpeck(false);
        const rr = sp.r * maxR * 1.1;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.8 + sp.tw);
        ctx2d.fillStyle = rgba(sc, (0.08 + 0.22 * tw) * Math.sin(Math.PI * Math.min(1, sp.r)) * strength);
        ctx2d.beginPath(); ctx2d.arc(cx + Math.cos(sp.a) * rr, cy + Math.sin(sp.a) * rr, sp.size, 0, Math.PI * 2); ctx2d.fill();
      });
    }

    // A slow arc while holding, so you can see when the hold will end.
    const hold = getHold ? getHold() : null;
    if (hold != null && hold >= 0) {
      const sandC = hexToRgb(palette.sand);
      const hr = maxR * 0.98;
      ctx2d.lineCap = "round";
      ctx2d.lineWidth = 3;
      const path = (p) => {
        ctx2d.beginPath();
        const n = 120;
        for (let s = 0; s <= n; s++) {
          const a = -Math.PI / 2 + Math.PI * 2 * p * (s / n);
          let r = hr;
          if (shape === "box") r = hr * 0.93 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 1 / 4);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          s ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
        }
        ctx2d.stroke();
      };
      ctx2d.strokeStyle = rgba(sandC, 0.18); path(1);
      ctx2d.strokeStyle = rgba(sandC, 0.75); path(Math.min(1, hold));
    }
    if (running) raf = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); });
  ro.observe(canvas);

  return {
    start() { if (running) return; running = true; t0 = performance.now(); resize(); palette = colors(); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); },
    redraw() { palette = colors(); resize(); draw(performance.now()); },
    setShape(sh) { shape = sh === "box" ? "box" : "circle"; if (!running) this.redraw(); },
    setMode(m) { mode = MODES.includes(m) ? m : "ripple"; t0 = performance.now(); if (!running) this.redraw(); },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
