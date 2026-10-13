// Practice: build a session from parts (settle, breathe, meditation, quiet), each with its
// own sound underneath, then play it through in one go. Sessions and a simple practice log
// are kept on this device only.
import * as store from "./store.js";
import * as sound from "./sound.js";
import { PATTERNS, createSession } from "./breath.js";
import { createRings } from "./rings.js";

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  children.flat().forEach((c) => c != null && n.append(c));
  return n;
}
// Like append, but quietly skips anything left out (null).
const appendAll = (root, ...kids) => root.append(...kids.flat().filter((k) => k != null && k !== false));
const btn = (label, onclick, cls = "secondary") => el("button", { type: "button", class: cls, onclick, text: label });
const uid = () => Math.random().toString(36).slice(2, 10);

export const STEP_TYPES = {
  settle: { name: "Settle", verb: "Settle with sound", cue: "Arrive. Let the sound settle around you." },
  breath: { name: "Breathe", verb: "Breathe" },
  meditation: { name: "Meditation", verb: "Meditation" },
  quiet: { name: "Quiet", verb: "Quiet", cue: "Nothing to do now. Just stay." },
};
const STEP_MINUTES = [1, 2, 3, 5, 8, 10, 15, 20];

// Ready-made sessions. People can start these, or copy one and change it.
export const READY = [
  { id: "ready-arrive", name: "Arrive", note: "A gentle way in, for any time.", chime: true, steps: [
    { type: "settle", minutes: 1, sound: { type: "mix", mix: "quiet-room" } },
    { type: "breath", minutes: 3, pattern: "longer-out", sound: { type: "same" } },
    { type: "quiet", minutes: 1, sound: { type: "same" } },
  ] },
  { id: "ready-reset", name: "Quick reset", note: "When it's all too much, right now.", chime: false, steps: [
    { type: "breath", minutes: 1, pattern: "sigh", sound: { type: "none" } },
    { type: "breath", minutes: 2, pattern: "even", sound: { type: "mix", mix: "low-tide" } },
  ] },
  { id: "ready-steady", name: "Steady before something hard", note: "Predictable and even.", chime: true, steps: [
    { type: "breath", minutes: 4, pattern: "box", sound: { type: "mix", mix: "still-air" } },
    { type: "quiet", minutes: 2, sound: { type: "same" } },
  ] },
  { id: "ready-wind-down", name: "Wind down", note: "For the end of the day, or bed.", chime: true, steps: [
    { type: "settle", minutes: 2, sound: { type: "mix", mix: "rain-room" } },
    { type: "breath", minutes: 5, pattern: "4-7-8", sound: { type: "same" } },
    { type: "quiet", minutes: 8, sound: { type: "same" } },
  ] },
];

/* ---------------- storage ---------------- */
const mySessions = () => store.get("sessions") || [];
const saveSessions = (list) => store.set("sessions", list);
const findSession = (id) => mySessions().find((s) => s.id === id) || READY.find((s) => s.id === id);
export function logPractice(entry) {
  const log = [{ at: new Date().toISOString(), ...entry }, ...(store.get("sessionsLog") || [])].slice(0, 400);
  store.set("sessionsLog", log);
}

/* ---------------- library (for meditation steps) ---------------- */
let libraryItems = null;
async function loadLibrary() {
  if (libraryItems) return libraryItems;
  try { libraryItems = (await (await fetch("library.json", { cache: "no-cache" })).json()).items || []; }
  catch { libraryItems = []; }
  return libraryItems;
}
const recordings = () => (libraryItems || []).filter((i) => (i.kind === "meditation" || i.kind === "audio") && i.src);

/* ---------------- descriptions ---------------- */
const soundName = (s, prev) => {
  if (!s || s.type === "same") return prev || "silence";
  if (s.type === "none") return "silence";
  if (s.type === "mix") return (sound.MIX_LABELS[s.mix] || s.mix).toLowerCase();
  return "your own mix";
};
const stepMinutes = (st) => (st.type === "meditation" ? (recordings().find((r) => r.id === st.itemId)?.minutes || 0) : Number(st.minutes) || 0);
const totalMinutes = (sess) => sess.steps.reduce((a, st) => a + stepMinutes(st), 0);
const stepTitle = (st) => st.type === "breath" ? (PATTERNS[st.pattern]?.name || "Breathe")
  : st.type === "meditation" ? (recordings().find((r) => r.id === st.itemId)?.title || "Meditation")
  : STEP_TYPES[st.type]?.name || "Part";
const summary = (sess) => sess.steps.map((st) => `${stepTitle(st)}${st.type !== "meditation" ? ` ${st.minutes}` : ""}`).join(" · ");

/* ---------------- the Practice page ---------------- */
export async function renderPractice(root) {
  await loadLibrary();
  root.innerHTML = "";
  const mine = mySessions();
  const card = (sess, ready) => el("li", { class: "session-card" },
    el("div", { class: "session-head" },
      el("span", { class: "session-name", text: sess.name }),
      el("span", { class: "session-time", text: `${totalMinutes(sess)} min` })),
    sess.note ? el("p", { class: "session-note", text: sess.note }) : null,
    el("p", { class: "session-steps", text: summary(sess) }),
    el("div", { class: "row" },
      el("a", { class: "primary", href: `#session?id=${sess.id}`, text: "Start" }),
      ready
        ? btn("Copy and change", () => { const c = { ...structuredClone(sess), id: uid(), name: `${sess.name} (mine)`, note: undefined }; saveSessions([...mySessions(), c]); location.hash = `#build?id=${c.id}`; })
        : el("a", { class: "secondary", href: `#build?id=${sess.id}`, text: "Change" })));

  appendAll(root,
    el("h1", { text: "Practice" }),
    el("p", { class: "lead", text: "Put breathing, meditation and sound together into one session, or just breathe." }),
    el("ul", { class: "cards" },
      el("li", {}, el("a", { class: "card", href: "#breathe" },
        el("span", { class: "pebble", "aria-hidden": "true" }, ringIcon()),
        el("span", { class: "card-name", text: "Just breathe" }),
        el("span", { class: "card-note", text: "Pick a pattern and go, or practise slowing down" }))),
      el("li", {}, el("a", { class: "card", href: "#build?id=new" },
        el("span", { class: "pebble", "aria-hidden": "true" }, plusIcon()),
        el("span", { class: "card-name", text: "Build a session" }),
        el("span", { class: "card-note", text: "Choose the parts, their length and the sound under each" })))),
    mine.length ? el("h2", { class: "section-title", text: "My sessions" }) : null,
    mine.length ? el("ul", { class: "session-list" }, mine.map((s) => card(s, false))) : null,
    el("h2", { class: "section-title", text: "Ready-made" }),
    el("ul", { class: "session-list" }, READY.map((s) => card(s, true))),
    recentPractice(),
  );
}

function recentPractice() {
  const log = store.get("sessionsLog") || [];
  if (!log.length) return null;
  const weekAgo = Date.now() - 7 * 864e5;
  const week = log.filter((e) => new Date(e.at).getTime() >= weekAgo);
  const mins = Math.round(week.reduce((a, e) => a + (e.minutes || 0), 0));
  const days = new Set(week.map((e) => e.at.slice(0, 10))).size;
  return el("section", { class: "recent" },
    el("h2", { class: "section-title", text: "Lately" }),
    el("p", { class: "lead", text: week.length ? `In the last 7 days: ${mins < 1 ? "under a minute" : `${mins} ${mins === 1 ? "minute" : "minutes"}`}, on ${days} ${days === 1 ? "day" : "days"}.` : "Nothing in the last 7 days. That's fine." }),
    el("ul", { class: "history-list" }, log.slice(0, 5).map((e) => el("li", {},
      el("span", { class: "when", text: new Date(e.at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) }),
      el("span", { text: `${e.name}, ${Math.max(1, Math.round(e.minutes || 0))} min${e.feeling ? `. Felt ${e.feeling}.` : ""}` })))));
}

function svg(paths) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.innerHTML = paths;
  return s;
}
const ringIcon = () => svg('<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8"/>');
const plusIcon = () => svg('<path d="M12 6v12M6 12h12"/>');

/* ---------------- the builder ---------------- */
export async function renderBuilder(root, params) {
  await loadLibrary();
  const id = params.get("id");
  const existing = id && id !== "new" ? mySessions().find((s) => s.id === id) : null;
  const sess = existing ? structuredClone(existing) : {
    id: uid(), name: "", chime: true,
    steps: [{ type: "settle", minutes: 1, sound: { type: "mix", mix: "quiet-room" } }, { type: "breath", minutes: 3, pattern: "longer-out", sound: { type: "same" } }],
  };
  root.innerHTML = "";

  const nameIn = el("input", { class: "jot one-line", type: "text", value: sess.name, placeholder: "Name it, e.g. After school", "aria-label": "Session name" });
  nameIn.addEventListener("input", () => { sess.name = nameIn.value; });
  const list = el("ol", { class: "build-steps" });
  const total = el("p", { class: "build-total" });
  const chime = el("input", { type: "checkbox" });
  chime.checked = sess.chime !== false;
  chime.addEventListener("change", () => { sess.chime = chime.checked; });

  const soundOptions = (st) => {
    const sel = el("select", { class: "select", "aria-label": "Sound underneath" });
    const opts = [["same", "Same as before"], ["none", "Silence"], ...Object.entries(sound.MIX_LABELS).map(([k, v]) => [`mix:${k}`, v]),
      ["custom", st.sound?.type === "custom" ? "My own mix (saved)" : "What's playing now"]];
    opts.forEach(([v, l]) => sel.append(el("option", { value: v, text: l })));
    const cur = st.sound?.type === "mix" ? `mix:${st.sound.mix}` : st.sound?.type || "same";
    sel.value = cur;
    sel.addEventListener("change", () => {
      const v = sel.value;
      if (v.startsWith("mix:")) st.sound = { type: "mix", mix: v.slice(4) };
      else if (v === "custom") {
        const levels = sound.currentLevels();
        if (!Object.keys(levels).length) {
          alert("Nothing is playing yet. Turn on some sounds in the Sounds tab first, then choose this again.");
          sel.value = cur; return;
        }
        st.sound = { type: "custom", levels };
      } else st.sound = { type: v };
      draw();
    });
    return sel;
  };

  function draw() {
    list.innerHTML = "";
    sess.steps.forEach((st, i) => {
      const move = (d) => { const j = i + d; if (j < 0 || j >= sess.steps.length) return; [sess.steps[i], sess.steps[j]] = [sess.steps[j], sess.steps[i]]; draw(); };
      const typeRow = el("div", { class: "choice-row" }, Object.entries(STEP_TYPES).map(([k, t]) => {
        const b = el("button", { type: "button", "aria-pressed": String(st.type === k), text: t.name });
        b.addEventListener("click", () => {
          st.type = k;
          if (k === "breath" && !st.pattern) st.pattern = "longer-out";
          if (k === "meditation" && !st.itemId) st.itemId = recordings()[0]?.id || "";
          draw();
        });
        return b;
      }));
      const minutesRow = st.type === "meditation" ? null : el("div", { class: "choice-row" }, STEP_MINUTES.map((m) => {
        const b = el("button", { type: "button", "aria-pressed": String(Number(st.minutes) === m), text: `${m} min` });
        b.addEventListener("click", () => { st.minutes = m; draw(); });
        return b;
      }));
      let detail = null;
      if (st.type === "breath") {
        detail = el("div", { class: "choice-row" }, Object.entries(PATTERNS).map(([k, p]) => {
          const b = el("button", { type: "button", "aria-pressed": String(st.pattern === k), text: p.name });
          b.addEventListener("click", () => { st.pattern = k; draw(); });
          return b;
        }));
      }
      if (st.type === "meditation") {
        const recs = recordings();
        if (!recs.length) detail = el("p", { class: "hint", text: "Your recorded meditations will appear here once they're in the Library." });
        else {
          const sel = el("select", { class: "select", "aria-label": "Which meditation" });
          recs.forEach((r) => sel.append(el("option", { value: r.id, text: `${r.title}${r.minutes ? ` (${r.minutes} min)` : ""}` })));
          sel.value = st.itemId || recs[0].id;
          st.itemId = sel.value;
          sel.addEventListener("change", () => { st.itemId = sel.value; draw(); });
          detail = sel;
        }
      }
      const prevSound = i > 0 ? soundName(sess.steps[i - 1].sound) : null;
      list.append(el("li", { class: "build-step" },
        el("div", { class: "build-step-head" },
          el("span", { class: "build-step-n", text: `${i + 1}` }),
          el("span", { class: "build-step-title", text: stepTitle(st) }),
          el("span", { class: "build-step-tools" },
            el("button", { type: "button", class: "icon-mini", "aria-label": "Move up", text: "↑", onclick: () => move(-1), disabled: i === 0 }),
            el("button", { type: "button", class: "icon-mini", "aria-label": "Move down", text: "↓", onclick: () => move(1), disabled: i === sess.steps.length - 1 }),
            el("button", { type: "button", class: "icon-mini", "aria-label": "Remove this part", text: "✕", onclick: () => { sess.steps.splice(i, 1); draw(); }, disabled: sess.steps.length === 1 }))),
        typeRow, detail, minutesRow,
        el("label", { class: "build-sound" }, el("span", { text: "Sound underneath" }), soundOptions(st)),
        st.sound?.type === "same" && i > 0 ? el("p", { class: "hint", text: `Carries on: ${prevSound}.` }) : null));
    });
    const t = totalMinutes(sess);
    total.textContent = `About ${t} ${t === 1 ? "minute" : "minutes"} altogether${sess.steps.some((s) => s.type === "meditation") ? ", plus the meditation" : ""}.`;
  }

  const add = (type) => {
    const st = { type, minutes: type === "quiet" ? 2 : type === "settle" ? 1 : 3, sound: { type: "same" } };
    if (type === "breath") st.pattern = "longer-out";
    if (type === "meditation") st.itemId = recordings()[0]?.id || "";
    sess.steps.push(st); draw();
    list.lastElementChild?.scrollIntoView({ block: "nearest", behavior: store.minimalMotion() ? "auto" : "smooth" });
  };
  const save = () => {
    if (!sess.name.trim()) sess.name = `My session ${mySessions().length + 1}`;
    const all = mySessions().filter((s) => s.id !== sess.id);
    saveSessions([...all, sess]);
    return sess;
  };

  draw();
  appendAll(root,
    el("div", { class: "loop-top" }, el("a", { class: "text-link back", href: "#practice", text: "Practice" })),
    el("h1", { text: existing ? "Change session" : "Build a session" }),
    el("p", { class: "lead", text: "Add the parts you want, in the order you want them. Each part can have its own sound." }),
    el("label", { class: "build-name" }, el("span", { text: "Name" }), nameIn),
    list,
    el("div", { class: "build-add" }, el("span", { class: "hint", text: "Add a part:" }),
      ...Object.entries(STEP_TYPES).map(([k, t]) => btn(`+ ${t.name}`, () => add(k)))),
    el("label", { class: "switch" }, chime, el("span", { text: "A soft bell between parts" })),
    total,
    el("div", { class: "row" },
      btn("Save and start", () => { const s = save(); location.hash = `#session?id=${s.id}`; }, "primary"),
      btn("Save", () => { save(); location.hash = "#practice"; }),
      existing ? btn("Delete", () => { if (confirm(`Delete "${sess.name}"?`)) { saveSessions(mySessions().filter((s) => s.id !== sess.id)); location.hash = "#practice"; } }, "text-btn") : null),
  );
}

/* ---------------- playing a session ---------------- */
let run = null;

export async function renderSession(root, params) {
  await loadLibrary();
  stopRun();
  const sess = findSession(params.get("id"));
  root.innerHTML = "";
  if (!sess) { root.append(el("p", { text: "That session couldn't be found." }), el("a", { class: "text-link", href: "#practice", text: "Back to Practice" })); return; }

  const canvas = el("canvas", { "aria-hidden": "true" });
  const segs = el("div", { class: "seg-bar", "aria-hidden": "true" }, sess.steps.map((st) => el("i", { style: `flex-grow:${Math.max(1, stepMinutes(st) || 3)}` }, el("b"))));
  const stepLabel = el("p", { class: "session-step" });
  const cue = el("p", { class: "session-cue", "aria-live": "polite" });
  const left = el("p", { class: "session-left" });
  const pauseBtn = btn("Pause", () => togglePause());
  const ui = el("div", { class: "session-ui" },
    el("div", { class: "session-top" },
      el("p", { class: "session-title", text: sess.name }), segs),
    el("div", { class: "session-mid" }, cue),
    el("div", { class: "session-bottom" }, stepLabel, left,
      el("div", { class: "calm-controls" },
        pauseBtn,
        btn("Next part", () => next()),
        btn("Sounds", () => document.dispatchEvent(new CustomEvent("ebbly:sounds"))),
        btn("End", () => finish(true), "primary"))));
  root.append(canvas, ui);

  const audio = new Audio();
  audio.preload = "auto";
  run = {
    sess, i: -1, startedAt: Date.now(), pausedMs: 0, pausedAt: 0, paused: false,
    stepStart: 0, stepPausedMs: 0, breath: null, audio, size: 0.45, raf: 0, done: false,
    breathMinutesLeft: 0,
  };

  const breathRunner = createSession({
    onStep(step) {
      cue.textContent = step.cue;
      if (store.get("tones") && step.kind !== "hold") sound.cue(step.kind);
    },
    onTick() {},
    onDone() { if (run && !run.paused) next(); },
  });
  run.breath = breathRunner;

  const rings = createRings(canvas, {
    rings: 8,
    getSize: (t) => {
      const st = run?.sess.steps[run.i];
      if (st?.type === "breath" && breathRunner.running) return breathRunner.size;
      if (st?.type === "quiet") return 0.5;
      return 0.55 + 0.12 * Math.sin((t * Math.PI * 2) / 12);
    },
    getHold: () => breathRunner.hold,
    isMinimal: () => store.minimalMotion(),
    getAudio: () => sound.analysis(),
    interactive: true,
    motes: 14,
  });
  run.rings = rings;

  audio.addEventListener("ended", () => { if (run && !run.paused) next(); });
  sound.unlock();
  sound.attachVoice(audio);
  rings.start();
  document.body.classList.add("in-session");
  next();

  function applySound(st) {
    const s = st.sound || { type: "same" };
    if (s.type === "none") sound.stopAll();
    else if (s.type === "mix") sound.playMix(s.mix);
    else if (s.type === "custom") sound.playLevels(s.levels || {});
  }

  function next() {
    if (!run || run.done) return;
    breathRunner.stop();
    audio.pause();
    sound.stopDucking();
    run.i += 1;
    if (run.i >= sess.steps.length) { finish(false); return; }
    if (run.i > 0 && sess.chime !== false) sound.chime();
    const st = sess.steps[run.i];
    run.stepStart = Date.now(); run.stepPausedMs = 0;
    [...segs.children].forEach((s, k) => { s.classList.toggle("done", k < run.i); s.classList.toggle("on", k === run.i); });
    stepLabel.textContent = `${run.i + 1} of ${sess.steps.length}: ${stepTitle(st)}`;
    applySound(st);
    if (st.type === "breath") {
      breathRunner.start(st.pattern || "longer-out", Number(st.minutes) || 3);
    } else if (st.type === "meditation") {
      const rec = recordings().find((r) => r.id === st.itemId);
      if (!rec) { cue.textContent = "This meditation isn't available. Moving on."; setTimeout(next, 2500); return; }
      cue.textContent = rec.title;
      audio.src = rec.src;
      audio.play().then(() => sound.startDucking()).catch(() => { cue.textContent = "The recording couldn't play. Tap Next part to carry on."; });
    } else {
      cue.textContent = STEP_TYPES[st.type].cue;
    }
    tick();
  }

  function stepElapsed() {
    const pausedNow = run.paused ? Date.now() - run.pausedAt : 0;
    return Date.now() - run.stepStart - run.stepPausedMs - pausedNow;
  }

  function tick() {
    cancelAnimationFrame(run.raf);
    const loop = () => {
      if (!run || run.done) return;
      const st = sess.steps[run.i];
      let fracDone = 0, remaining = 0;
      if (st.type === "meditation") {
        const d = audio.duration || 0;
        fracDone = d ? audio.currentTime / d : 0;
        remaining = d ? (d - audio.currentTime) * 1000 : 0;
      } else {
        const total = (Number(st.minutes) || 1) * 60000;
        const e = stepElapsed();
        fracDone = Math.min(1, e / total);
        remaining = Math.max(0, total - e);
        // settle and quiet end on time; breathing ends at the end of a full breath (see onDone)
        if (st.type !== "breath" && !run.paused && e >= total) { next(); return; }
      }
      const seg = segs.children[run.i]?.firstChild;
      if (seg) seg.style.width = `${Math.round(fracDone * 100)}%`;
      const s = Math.ceil(remaining / 1000);
      left.textContent = run.paused ? "Paused" : s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} left in this part` : "";
      run.raf = requestAnimationFrame(loop);
    };
    run.raf = requestAnimationFrame(loop);
  }

  function togglePause() {
    const st = sess.steps[run.i];
    if (!run.paused) {
      run.paused = true; run.pausedAt = Date.now();
      pauseBtn.textContent = "Carry on";
      if (st.type === "breath") {
        run.breathMinutesLeft = Math.max(0.25, ((Number(st.minutes) || 3) * 60000 - stepElapsed()) / 60000);
        breathRunner.stop(); breathRunner.settle();
        cue.textContent = "Paused. Breathe however you like.";
      }
      if (st.type === "meditation") audio.pause();
    } else {
      const pausedFor = Date.now() - run.pausedAt;
      run.pausedMs += pausedFor; run.stepPausedMs += pausedFor; run.paused = false;
      pauseBtn.textContent = "Pause";
      if (st.type === "breath") breathRunner.start(st.pattern || "longer-out", run.breathMinutesLeft);
      if (st.type === "meditation") audio.play().catch(() => {});
      if (st.type !== "breath" && st.type !== "meditation") cue.textContent = STEP_TYPES[st.type].cue;
    }
  }

  function finish(early) {
    if (!run || run.done) return;
    run.done = true;
    breathRunner.stop(); audio.pause(); sound.stopDucking();
    cancelAnimationFrame(run.raf);
    if (sess.chime !== false) sound.chime(0.8);
    sound.stopAll();
    const minutes = (Date.now() - run.startedAt - run.pausedMs) / 60000;
    ui.replaceChildren(el("div", { class: "session-end" },
      el("p", { class: "session-cue", text: early ? "Stopped. That's fine." : "Done." }),
      el("p", { class: "lead", text: "How do you feel now?" }),
      el("div", { class: "choice-row feel-row" }, ["calmer", "about the same", "worse"].map((f) =>
        btn(f[0].toUpperCase() + f.slice(1), () => { logPractice({ name: sess.name, minutes, feeling: f }); thanks(); }))),
      el("button", { type: "button", class: "text-btn", text: "Skip", onclick: () => { logPractice({ name: sess.name, minutes }); thanks(); } })));
    function thanks() {
      ui.replaceChildren(el("div", { class: "session-end" },
        el("p", { class: "session-cue", text: "Noted. Only on this phone." }),
        el("div", { class: "calm-controls" },
          el("a", { class: "secondary", href: "#practice", text: "Back to Practice" }),
          el("a", { class: "primary", href: "#home", text: "Home" }))));
    }
  }
}

function stopRun() {
  if (!run) return;
  run.done = true;
  run.breath?.stop();
  run.audio?.pause();
  run.rings?.destroy();
  cancelAnimationFrame(run.raf);
  sound.stopDucking();
  run = null;
}

export function leaveSession() {
  const playing = run && !run.done;
  stopRun();
  if (playing) sound.stopAll();
  document.body.classList.remove("in-session");
}
