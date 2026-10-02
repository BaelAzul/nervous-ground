import * as store from "./store.js";
import * as sound from "./sound.js";
import { PATTERNS, MINUTES, createSession, practicePattern } from "./breath.js";
import { createRings } from "./rings.js";
import * as loops from "./loops.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const minutesLabel = (m) => (m ? `${m} min` : "No limit");

function pressChoice(row, value) {
  $$("button", row).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(value))));
}
function buildChoices(row, options, current, onPick) {
  row.innerHTML = "";
  options.forEach(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = value;
    b.textContent = label;
    b.addEventListener("click", () => { pressChoice(row, value); onPick(value); });
    row.append(b);
  });
  pressChoice(row, current);
}

// Any tap lets the browser play sound later (browsers block sound until you interact).
document.addEventListener("pointerdown", () => sound.unlock(), { once: true });

/* ---------------- settings ---------------- */
function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = store.get("theme");
  root.dataset.text = store.get("textSize");
  root.dataset.font = store.get("font");
  root.dataset.spacing = store.get("spacing");
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue("--ground").trim();
  breathRings.redraw();
  homeRings.redraw();
}

$$("[data-setting]").forEach((el) => {
  const key = el.dataset.setting;
  if (el.matches(".choice-row")) {
    pressChoice(el, store.get(key));
    $$("button", el).forEach((b) => b.addEventListener("click", () => {
      store.set(key, b.dataset.value);
      pressChoice(el, b.dataset.value);
      applySettings();
    }));
  } else if (el.type === "checkbox") {
    el.checked = !!store.get(key);
    el.addEventListener("change", () => {
      store.set(key, el.checked);
      if (key === "vibrate" && el.checked) navigator.vibrate?.(30);
      if (key === "tones" && el.checked) sound.cue("in");
    });
  }
});

/* ---------------- breathe ---------------- */
const breathView = $('[data-view="breathe"]');
const cueEl = $("#breath-cue");
const countEl = $("#breath-count");
const remainingEl = $("#breath-remaining");
const toggleBtn = $("#breath-toggle");
const notHelping = $("#not-helping");
const round1 = (n) => Math.round(n * 10) / 10;
const bpmText = (n) => `${round1(n).toString().replace(/\.0$/, "")}`;

let practice = null; // the running practice pattern, if any
let practiceStartRate = 0;

const session = createSession({
  onStep(step) {
    cueEl.textContent = step.cue;
    if (store.get("tones") && step.kind !== "hold") sound.cue(step.kind);
    if (store.get("vibrate")) navigator.vibrate?.(step.kind === "hold" ? 15 : 30);
  },
  onTick({ secondsLeftInStep, remaining, step }) {
    countEl.textContent = store.get("showCount") ? String(secondsLeftInStep) : "";
    const left = remaining == null ? "" : `${fmt(remaining)} left`;
    remainingEl.textContent = practice && step.bpm
      ? `${bpmText(step.bpm)} breaths a minute${left ? `. ${left}` : ""}`
      : left;
  },
  onDone() {
    if (store.get("tones")) sound.cue("end");
    countEl.textContent = "";
    if (practice) {
      const reached = practice.reached;
      logPractice(store.get("practiceMinutes"), practiceStartRate, reached);
      cueEl.textContent = "Done. Stay as long as you like.";
      remainingEl.textContent = summaryText(practiceStartRate, reached);
    } else {
      cueEl.textContent = "Done. Stay as long as you like.";
      remainingEl.textContent = "";
    }
    stopBreathing(true);
  },
});

function summaryText(from, to) {
  if (Math.abs(from - to) < 0.3) return `You breathed with the guide at about ${bpmText(to)} a minute.`;
  return `You eased from ${bpmText(from)} to ${bpmText(to)} breaths a minute.`;
}

const breathRings = createRings($("#breath-canvas"), {
  getSize: () => session.size,
  isMinimal: () => store.minimalMotion(),
});

function startBreathing() {
  sound.unlock();
  if (store.get("breathMode") === "practice") {
    practiceStartRate = Number(store.get("practiceFrom"));
    practice = practicePattern({
      from: practiceStartRate,
      to: Number(store.get("practiceTarget")),
      minutes: Number(store.get("practiceMinutes")),
      outShare: Number(store.get("practiceShare")),
    });
    session.start(practice, Number(store.get("practiceMinutes")));
    notHelping.hidden = false;
  } else {
    practice = null;
    session.start(store.get("pattern"), Number(store.get("minutes")));
  }
  breathView.classList.add("breathing");
  toggleBtn.textContent = "Stop";
}
function stopBreathing(finished = false) {
  if (!finished && practice && session.running && session.elapsed >= 60000) {
    // Stopping early still counts. Nothing is lost by stopping.
    logPractice(Math.round(session.elapsed / 60000), practiceStartRate, practice.reached);
    remainingEl.textContent = summaryText(practiceStartRate, practice.reached);
    session.stop(); session.settle();
    breathView.classList.remove("breathing");
    toggleBtn.textContent = "Go again";
    cueEl.textContent = "Stopped. That's fine.";
    countEl.textContent = "";
    notHelping.hidden = true;
    practice = null;
    return;
  }
  session.stop();
  session.settle();
  breathView.classList.remove("breathing");
  notHelping.hidden = true;
  toggleBtn.textContent = finished ? "Go again" : "Start";
  if (!finished) {
    cueEl.textContent = "Ready when you are";
    countEl.textContent = "";
    remainingEl.textContent = "";
  }
  practice = null;
}
toggleBtn.addEventListener("click", () => (session.running ? stopBreathing() : startBreathing()));

function renderBreathOptions() {
  const mode = store.get("breathMode");
  pressChoice($("#breath-mode"), mode);
  $("#breath-options").hidden = mode !== "patterns";
  $("#practice-options").hidden = mode !== "practice";

  buildChoices($("#pattern-choices"), Object.entries(PATTERNS).map(([id, p]) => [id, p.name]),
    store.get("pattern"), (v) => { store.set("pattern", v); $("#pattern-hint").textContent = PATTERNS[v].hint; });
  $("#pattern-hint").textContent = PATTERNS[store.get("pattern")]?.hint || "";
  buildChoices($("#minute-choices"), MINUTES.map((m) => [m, minutesLabel(m)]),
    store.get("minutes"), (v) => store.set("minutes", Number(v)));

  buildChoices($("#start-choices"), [8, 10, 12, 14, 16].map((n) => [n, String(n)]),
    store.get("practiceFrom"), (v) => { store.set("practiceFrom", Number(v)); $("#tap-status").textContent = `Starting at ${v} breaths a minute.`; });
  buildChoices($("#target-choices"), [[4.5, "4.5"], [5, "5"], [5.5, "5.5"], [6, "6"], [7, "7"], [8, "8"]],
    store.get("practiceTarget"), (v) => store.set("practiceTarget", Number(v)));
  buildChoices($("#share-choices"), [[0.5, "Same as the in-breath"], [0.6, "A little longer"], [0.67, "Twice as long"]],
    store.get("practiceShare"), (v) => store.set("practiceShare", Number(v)));
  buildChoices($("#practice-minutes"), [3, 5, 10, 15].map((m) => [m, `${m} min`]),
    store.get("practiceMinutes"), (v) => store.set("practiceMinutes", Number(v)));
  renderHistory();
}

$$("button", $("#breath-mode")).forEach((b) => b.addEventListener("click", () => {
  if (session.running) stopBreathing();
  store.set("breathMode", b.dataset.value);
  renderBreathOptions();
}));

// Find your rate: tap at the start of each in-breath.
let taps = [];
let tapReset = 0;
$("#tapper").addEventListener("click", (e) => {
  const now = performance.now();
  const btn = e.currentTarget;
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 250);
  clearTimeout(tapReset);
  tapReset = setTimeout(() => { taps = []; }, 30000);
  if (taps.length && now - taps[taps.length - 1] > 20000) taps = [];
  taps.push(now);
  const status = $("#tap-status");
  if (taps.length < 4) {
    status.textContent = taps.length === 1 ? "Got it. Keep breathing normally and tap at each in-breath." : `${taps.length} so far. A few more.`;
    return;
  }
  const recent = taps.slice(-6);
  const gaps = recent.slice(1).map((t, i) => t - recent[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const rate = Math.min(24, Math.max(4, Math.round((60000 / avg) * 2) / 2));
  store.set("practiceFrom", rate);
  pressChoice($("#start-choices"), rate);
  status.textContent = `About ${bpmText(rate)} breaths a minute. The guide will start there.`;
});

function logPractice(minutes, from, to) {
  if (!minutes) return;
  const log = [{ at: new Date().toISOString(), minutes, from: round1(from), to: round1(to), target: store.get("practiceTarget") },
    ...(store.get("practiceLog") || [])].slice(0, 30);
  store.set("practiceLog", log);
  renderHistory();
}
function renderHistory() {
  const log = store.get("practiceLog") || [];
  const list = $("#history-list");
  list.innerHTML = "";
  log.slice(0, 10).forEach((e) => {
    const li = document.createElement("li");
    const when = new Date(e.at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    li.innerHTML = `<span class="when"></span><span class="what"></span>`;
    $(".when", li).textContent = when;
    $(".what", li).textContent = `${e.minutes} min, ${bpmText(e.from)} to ${bpmText(e.to)} breaths a minute`;
    list.append(li);
  });
  $("#history-empty").hidden = log.length > 0;
  $("#history-clear").hidden = log.length === 0;
}
$("#history-clear").addEventListener("click", () => { store.set("practiceLog", []); renderHistory(); });

/* ---------------- sounds ---------------- */
const mixer = $("#mixer");
function renderMixer() {
  mixer.innerHTML = "";
  sound.LAYERS.forEach(({ id, name, note }) => {
    const level = store.get("levels")[id] ?? 0.5;
    const li = document.createElement("li");
    li.className = "mix-row";
    li.innerHTML = `
      <p class="mix-name" id="mix-${id}">${name}</p>
      <p class="mix-note">${note}</p>
      <button class="mix-toggle" type="button" aria-describedby="mix-${id}" aria-pressed="${sound.isOn(id)}">${sound.isOn(id) ? "On" : "Off"}</button>
      <label class="mix-volume" ${sound.isOn(id) ? "" : "hidden"}>
        <span>Volume</span>
        <input type="range" min="0.05" max="1" step="0.01" value="${level}" aria-label="${name} volume">
      </label>`;
    $(".mix-toggle", li).addEventListener("click", () => {
      sound.isOn(id) ? sound.turnOff(id) : sound.turnOn(id, store.get("levels")[id] ?? 0.5);
    });
    $("input", li).addEventListener("input", (e) => {
      const v = Number(e.target.value);
      sound.setLevel(id, v);
      store.set("levels", { ...store.get("levels"), [id]: v });
    });
    mixer.append(li);
  });
}
function syncMixer() {
  $$(".mix-row", mixer).forEach((li, i) => {
    const { id } = sound.LAYERS[i];
    const on = sound.isOn(id);
    const btn = $(".mix-toggle", li);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "On" : "Off";
    $(".mix-volume", li).hidden = !on;
  });
}
const SOUND_TIMERS = [[0, "Keep playing"], [15, "15 min"], [30, "30 min"], [60, "1 hour"]];
buildChoices($("#sound-timer-choices"), SOUND_TIMERS, 0, (v) => {
  sound.fadeOutAfter(Number(v));
});
function syncSoundTimer() {
  const left = sound.timerRemaining();
  $("#sound-timer-status").textContent = left ? `Fading out in ${fmt(left)}` : "";
  if (!left) pressChoice($("#sound-timer-choices"), 0);
}

const playingBtn = $("#playing");
playingBtn.addEventListener("click", () => sound.stopAll());
sound.onChange(() => {
  playingBtn.hidden = !sound.anyOn();
  syncMixer();
  syncSoundTimer();
});
setInterval(() => { if (sound.timerRemaining()) syncSoundTimer(); }, 1000);

/* ---------------- library ---------------- */
let library = { needs: [], items: [] };
let needFilter = "all";
const audio = new Audio();
audio.preload = "none";
let current = null;

async function loadLibrary() {
  try {
    const res = await fetch("library.json", { cache: "no-cache" });
    library = await res.json();
  } catch {
    $("#library-empty").textContent = "The library couldn't load. Check your connection and open this page again.";
    $("#library-empty").hidden = false;
  }
  buildChoices($("#need-filters"), [["all", "Everything"], ...library.needs.map((n) => [n.id, n.name])], "all", (v) => {
    needFilter = v; renderLibrary();
  });
  renderLibrary();
}

const KIND_LABEL = { breath: "Breathing", soundscape: "Soundscape", audio: "Recording", meditation: "Meditation" };

function renderLibrary() {
  const list = $("#library-list");
  const items = library.items.filter((it) => needFilter === "all" || (it.needs || []).includes(needFilter));
  list.innerHTML = "";
  items.forEach((it) => {
    const li = document.createElement("li");
    li.className = "lib-item";
    const meta = it.minutes ? `${it.minutes} min` : it.kind === "soundscape" ? "No limit" : "";
    li.innerHTML = `
      <button class="lib-btn" type="button">
        <span class="lib-title"></span>
        <span class="lib-meta">${meta}</span>
        <span class="lib-desc"></span>
      </button>`;
    $(".lib-title", li).textContent = it.title;
    const kind = document.createElement("span");
    kind.className = "lib-kind";
    kind.textContent = KIND_LABEL[it.kind] || "";
    $(".lib-title", li).append(kind);
    $(".lib-desc", li).textContent = it.description || "";
    $(".lib-btn", li).addEventListener("click", () => openItem(it));
    list.append(li);
  });
  $("#library-empty").hidden = items.length > 0;
}

function openItem(it) {
  sound.unlock();
  if (it.kind === "breath") {
    store.set("pattern", it.pattern);
    store.set("minutes", it.minutes || 0);
    location.hash = "#breathe?autostart=1";
  } else if (it.kind === "soundscape") {
    location.hash = `#calm?mix=${encodeURIComponent(it.mix)}${it.minutes ? `&minutes=${it.minutes}` : ""}`;
  } else if (it.kind === "audio" || it.kind === "meditation") {
    playRecording(it);
  }
}

function applyBackground(id) {
  if (id === "none") sound.stopAll();
  else sound.playMix(id, Object.fromEntries(Object.entries(sound.MIXES[id]).map(([k, v]) => [k, v * 0.7])));
}
buildChoices($("#bg-choices"), sound.BACKGROUNDS, store.get("background"), (v) => {
  store.set("background", v);
  store.set("backgroundChosen", true);
  if (current) applyBackground(v);
});

function playRecording(it) {
  current = it;
  sound.attachVoice(audio);
  audio.src = it.src;
  audio.volume = 0;
  const bg = it.background && !store.get("backgroundChosen") ? it.background : store.get("background");
  pressChoice($("#bg-choices"), bg);
  applyBackground(bg);
  sound.startDucking();
  audio.play().then(() => fadeAudio(1)).catch(() => {
    $("#player-time").textContent = "This recording couldn't play. Check the file is in the audio folder.";
  });
  $("#player").hidden = false;
  $("#player-title").textContent = it.title;
  $("#player-toggle").textContent = "Pause";
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: "Ebbly" });
  }
}
function fadeAudio(to, then) {
  const from = audio.volume, t0 = performance.now(), dur = 1500;
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / dur);
    audio.volume = from + (to - from) * p;
    if (p < 1) requestAnimationFrame(step); else then?.();
  };
  requestAnimationFrame(step);
}
$("#player-toggle").addEventListener("click", () => {
  if (audio.paused) { audio.play(); fadeAudio(1); $("#player-toggle").textContent = "Pause"; }
  else { fadeAudio(0, () => audio.pause()); $("#player-toggle").textContent = "Play"; }
});
$("#player-back").addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
$("#player-stop").addEventListener("click", () => {
  fadeAudio(0, () => { audio.pause(); audio.removeAttribute("src"); audio.load(); });
  sound.stopDucking();
  if (store.get("background") !== "none") sound.stopAll();
  $("#player").hidden = true;
  current = null;
});
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  $("#player-progress").style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  $("#player-time").textContent = `${fmt((audio.duration - audio.currentTime) * 1000)} left`;
});
audio.addEventListener("ended", () => {
  $("#player-toggle").textContent = "Play";
  $("#player-time").textContent = "Finished";
  sound.stopDucking();
  if (sound.anyOn()) sound.fadeOutAfter(1); // let the background carry on for a minute, then fade
});

/* ---------------- calm space ---------------- */
const calmUI = $("#calm-ui");
let calmStill = false;
let calmEndsAt = 0;
let calmFadeTimer = 0;
let calmClock = 0;

const calmRings = createRings($("#calm-canvas"), {
  rings: 9,
  getSize: (t) => (calmStill ? 0.6 : 0.6 + 0.22 * Math.sin((t * Math.PI * 2) / 10)),
  isMinimal: () => calmStill || store.minimalMotion(),
});

function showCalmUI() {
  calmUI.classList.remove("faded");
  clearTimeout(calmFadeTimer);
  calmFadeTimer = setTimeout(() => calmUI.classList.add("faded"), 5000);
}
$('[data-view="calm"]').addEventListener("click", (e) => {
  if (e.target.closest("button, a")) { showCalmUI(); return; }
  calmUI.classList.contains("faded") ? showCalmUI() : calmUI.classList.add("faded");
});
$("#calm-visual").addEventListener("click", () => {
  calmStill = !calmStill;
  $("#calm-visual").textContent = calmStill ? "Let it move" : "Make it still";
});
$("#calm-exit").addEventListener("click", () => history.length > 1 ? history.back() : (location.hash = "#home"));

function enterCalm(params) {
  document.body.classList.add("in-calm");
  if (params.get("theme")) { document.documentElement.dataset.theme = params.get("theme"); calmRings.redraw(); }
  calmStill = params.get("visual") === "still";
  $("#calm-visual").textContent = calmStill ? "Let it move" : "Make it still";
  const mix = params.get("mix");
  if (mix) sound.playMix(mix, store.get("levels"));
  const minutes = Number(params.get("minutes") || 0);
  calmEndsAt = minutes ? Date.now() + minutes * 60000 : 0;
  if (minutes) sound.fadeOutAfter(minutes);
  updateCalmClock();
  clearInterval(calmClock);
  calmClock = setInterval(updateCalmClock, 1000);
  calmRings.start();
  showCalmUI();
}
function updateCalmClock() {
  const el = $("#calm-time");
  if (!calmEndsAt) { el.textContent = ""; return; }
  const left = calmEndsAt - Date.now();
  el.textContent = left > 0 ? fmt(left) : "Time's up. No rush.";
}
function leaveCalm() {
  document.body.classList.remove("in-calm");
  document.documentElement.dataset.theme = store.get("theme");
  calmRings.stop();
  clearInterval(calmClock);
  clearTimeout(calmFadeTimer);
}

/* ---------------- home ---------------- */
// A small set of circles that swells very slowly, about five breaths a minute.
const homeRings = createRings($("#home-canvas"), {
  getSize: (t) => 0.6 + 0.32 * Math.sin((t * Math.PI * 2) / 12),
  isMinimal: () => store.minimalMotion(),
  rings: 6,
});
function startHomeRings() {
  if (store.minimalMotion()) { homeRings.stop(); requestAnimationFrame(() => homeRings.redraw()); }
  else homeRings.start();
}
function greet() {
  const h = new Date().getHours();
  $("#home-title").textContent =
    h >= 5 && h < 12 ? "Good morning." :
    h >= 12 && h < 17 ? "Good afternoon." :
    h >= 17 && h < 22 ? "Good evening." : "Still awake? That's okay.";
}

/* ---------------- worry time ---------------- */
function showWorryBanner() {
  $("#worry-banner").hidden = !loops.worryTimeDue();
}
$("#worry-dismiss").addEventListener("click", () => { loops.clearWorryTime(); showWorryBanner(); });
$("#worry-go").addEventListener("click", () => { loops.clearWorryTime(); });

/* ---------------- router ---------------- */
const VIEWS = ["home", "breathe", "sounds", "library", "calm", "settings", "loops", "loop", "help"];
const TAB_FOR = { loop: "loops", help: "loops" };
let currentView = null;

function route() {
  const [raw, query = ""] = location.hash.replace(/^#/, "").split("?");
  const view = VIEWS.includes(raw) ? raw : "home";
  const params = new URLSearchParams(query);

  if (currentView === "breathe" && view !== "breathe") { stopBreathing(); breathRings.stop(); }
  if (currentView === "calm" && view !== "calm") leaveCalm();

  $$(".view").forEach((v) => { v.hidden = v.dataset.view !== view; });
  $$(".tabs a").forEach((a) => {
    const tab = TAB_FOR[view] || view;
    a.toggleAttribute("aria-current", a.dataset.tab === tab);
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
  });

  if (view === "breathe") {
    if (params.get("pattern") && PATTERNS[params.get("pattern")]) { store.set("pattern", params.get("pattern")); store.set("breathMode", "patterns"); }
    if (params.get("mode") === "practice") store.set("breathMode", "practice");
    if (params.has("minutes")) store.set("minutes", Number(params.get("minutes")));
    renderBreathOptions();
    breathRings.start();
    if (params.get("autostart") || params.has("pattern")) {
      startBreathing();
      history.replaceState(null, "", "#breathe"); // so going back later doesn't restart it
    }
  }
  if (view === "sounds") syncMixer();
  if ((currentView === "loop" || currentView === "loops") && view !== currentView) loops.leaveLoops();
  if (currentView === "home" && view !== "home") homeRings.stop();
  if (view === "loops") loops.renderLoopList($("#loops-view"));
  if (view === "loop") loops.renderLoop($("#loop-view"), params);
  if (view === "help") loops.renderHelp($("#help-view"));
  if (view === "home") { showWorryBanner(); greet(); startHomeRings(); }
  if (view === "calm") enterCalm(params);

  if (view !== currentView) {
    window.scrollTo(0, 0);
    if (currentView) $("#main").focus({ preventScroll: true });
  }
  currentView = view;
}

window.addEventListener("hashchange", route);

/* ---------------- start ---------------- */
applySettings();
renderMixer();
loadLibrary();
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
