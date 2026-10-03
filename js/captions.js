// Words that appear as they're spoken, for meditations that have a captions file (.vtt).
// Each phrase fades in word by word at the pace it's spoken, rests, then fades away.

export async function loadCaptions(src) {
  if (!src) return [];
  try {
    const res = await fetch(src, { cache: "no-cache" });
    if (!res.ok) return [];
    return parseVTT(await res.text());
  } catch {
    return [];
  }
}

const toSecs = (ts) => {
  const parts = ts.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

export function parseVTT(text) {
  const cues = [];
  text.replace(/\r/g, "").split(/\n\n+/).forEach((block) => {
    const lines = block.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) return;
    const [a, b] = lines[i].split("-->");
    const words = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (words) cues.push({ start: toSecs(a), end: toSecs(b.trim().split(/\s+/)[0]), text: words });
  });
  return cues.sort((x, y) => x.start - y.start);
}

export function createCaptionView(el) {
  let cues = [];
  let shown = -1;
  let spans = [];
  let weights = [];

  function render(i) {
    shown = i;
    el.replaceChildren();
    spans = [];
    if (i < 0) return;
    const words = cues[i].text.split(/\s+/);
    // longer words take longer to say
    const lens = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2);
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    weights = lens.map((l) => (acc += l) / total - l / total);
    words.forEach((w, n) => {
      const s = document.createElement("span");
      s.className = "cw";
      s.textContent = w;
      el.append(s);
      if (n < words.length - 1) el.append(" ");
      spans.push(s);
    });
  }

  return {
    set(list) { cues = list || []; render(-1); },
    get has() { return cues.length > 0; },
    clear() { render(-1); },
    update(time) {
      if (!cues.length) return;
      // the phrase being spoken now, or the last one for a moment after it ends
      let i = cues.findIndex((c) => time >= c.start - 0.15 && time < c.end + 1.2);
      if (i !== shown) render(i);
      if (i < 0) return;
      const c = cues[i];
      const p = (time - c.start) / Math.max(0.3, c.end - c.start);
      spans.forEach((s, n) => s.classList.toggle("on", p >= weights[n] - 0.02));
      el.classList.toggle("leaving", time > c.end + 0.4);
    },
  };
}
