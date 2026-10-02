// The "ground" shape: soft rings, like ripples spreading on still water.
// size: 0 (breathed out) to 1 (breathed in). Drawn on a canvas.

export function createRings(canvas, { getSize, isMinimal, rings = 7 }) {
  const ctx2d = canvas.getContext("2d");
  let raf = 0;
  let running = false;
  let w = 0, h = 0, dpr = 1;

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      breath: cs.getPropertyValue("--breath").trim() || "#93BDB4",
      ground: cs.getPropertyValue("--ground").trim() || "#1F2B2A",
    };
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

  function draw(now) {
    const t = now / 1000;
    const size = Math.max(0, Math.min(1, getSize(t)));
    const minimal = isMinimal();
    const [r, g, b] = hexToRgb(palette.breath);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(w, h) * 0.47;
    const outer = maxR * (0.42 + 0.58 * size);

    // soft glow behind the rings
    const glow = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, outer * 1.05);
    glow.addColorStop(0, `rgba(${r},${g},${b},${0.10 + 0.12 * size})`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx2d.fillStyle = glow;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, outer * 1.05, 0, Math.PI * 2); ctx2d.fill();

    for (let i = 0; i < rings; i++) {
      const k = (i + 1) / rings;
      const base = outer * k;
      const alpha = 0.55 - 0.42 * k + 0.1 * size;
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${Math.max(0.06, alpha)})`;
      ctx2d.lineWidth = 1.4 + (1 - k) * 1.2;
      ctx2d.beginPath();
      const steps = 120;
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        // A faint ripple, strongest on the outer rings, so the centre stays a calm circle.
        const wobble = minimal ? 0 : base * k * k * (
          Math.sin(a * 3 + t * 0.25 + i * 0.9) * 0.012 +
          Math.sin(a * 2 - t * 0.17 + i) * 0.008);
        const rr = base + wobble;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        s ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
      }
      ctx2d.closePath();
      ctx2d.stroke();
    }
    if (running) raf = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); });
  ro.observe(canvas);

  return {
    start() { if (running) return; running = true; resize(); palette = colors(); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); },
    redraw() { palette = colors(); resize(); draw(performance.now()); },
  };
}
