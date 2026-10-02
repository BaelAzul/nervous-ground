// Thought loops and hard moments: recognise → interrupt → complete.
// All wording lives in loops.json so it can be edited without touching code.
// Nothing anyone types here is saved. "Park it" keeps only the time chosen.
import * as store from "./store.js";
import * as sound from "./sound.js";
import { createRings } from "./rings.js";

const $ = (sel, root = document) => root.querySelector(sel);
let data = null;

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
const btn = (label, onclick, cls = "secondary") => el("button", { type: "button", class: cls, onclick, text: label });

export async function loadLoops() {
  if (data) return data;
  try {
    const res = await fetch("loops.json", { cache: "no-cache" });
    data = await res.json();
  } catch {
    data = null;
  }
  return data;
}

/* ---------- circles ---------- */
// Each moment has its own circles ("rings" in loops.json). These are stopped when you leave.
let circles = [];
function clearCircles() { circles.forEach((c) => c.destroy()); circles = []; }

// A small, still picture of a moment's circles, for the list.
function miniRings(mode) {
  const c = el("canvas", { class: "mini-rings", "aria-hidden": "true" });
  circles.push(createRings(c, { getSize: () => 0.85, isMinimal: () => true, rings: 4, mode }));
  return c;
}

// The moving circles at the top of each step.
function heroRings(mode) {
  const c = el("canvas", { "aria-hidden": "true" });
  const wrap = el("div", { class: "loop-hero" }, c);
  const still = mode === "still";
  const r = createRings(c, {
    // A slow, unhurried swell, about five breaths a minute. Shutdown stays still.
    getSize: (t) => (still ? 0.6 : 0.62 + 0.3 * Math.sin((t * Math.PI * 2) / 12)),
    isMinimal: () => store.minimalMotion(),
    rings: 6, mode,
  });
  circles.push(r);
  if (store.minimalMotion()) requestAnimationFrame(() => r.redraw()); else r.start();
  return wrap;
}

/* ---------- list of moments ---------- */
export async function renderLoopList(root) {
  const d = await loadLoops();
  clearCircles();
  root.innerHTML = "";
  if (!d) { root.append(el("p", { class: "empty", text: "This part couldn't load. Check your connection and open it again." })); return; }
  root.append(
    el("h1", { text: d.title }),
    el("p", { class: "lead", text: d.intro }),
    el("ul", { class: "cards moments" },
      d.moments.map((m) => el("li", {}, el("a", { class: "card", href: `#loop?id=${m.id}&step=1` },
        miniRings(m.rings),
        el("span", { class: "card-name", text: m.title }))))),
    el("p", { class: "help-line" }, el("a", { class: "help-btn", href: "#help", text: "Get help now" })),
  );
}

/* ---------- one moment, step by step ---------- */
let cleanup = [];
function runCleanup() { cleanup.forEach((fn) => fn()); cleanup = []; }

export async function renderLoop(root, params) {
  runCleanup();
  clearCircles();
  const d = await loadLoops();
  const m = d?.moments.find((x) => x.id === params.get("id"));
  root.innerHTML = "";
  if (!m) { root.append(el("p", { text: "That one couldn't be found." }), el("a", { class: "text-link", href: "#loops", text: "See all of them" })); return; }
  const step = Number(params.get("step") || 1);
  root.classList.toggle("low-demand", !!m.lowDemand);

  const top = el("div", { class: "loop-top" },
    el("a", { class: "text-link back", href: "#loops", text: "All moments" }),
    el("a", { class: "help-btn", href: "#help", text: "Get help now" }));
  const steps = ["notice it", "interrupt it", "finish it"];
  const progress = el("p", { class: "loop-progress" },
    el("span", { class: "dots", "aria-hidden": "true" }, steps.map((s, i) => el("i", { class: i + 1 === step ? "on" : i + 1 < step ? "done" : "" }))),
    el("span", { text: `Step ${step} of 3: ${steps[step - 1] || ""}` }));
  const body = el("div", { class: "loop-body" });
  root.append(top, heroRings(m.rings), el("h1", { class: "loop-title", text: m.title }), progress, body);

  const go = (n) => { location.hash = `#loop?id=${m.id}&step=${n}`; };

  if (step === 1) {
    body.append(
      el("p", { class: "lead", text: m.recognise.lead || "You might notice:" }),
      el("ul", { class: "signs" }, m.recognise.signs.map((s) => el("li", { text: s }))),
      el("p", { class: "naming", text: m.recognise.naming }),
      el("div", { class: "row" },
        btn(m.lowDemand ? "Yes" : "Yes, that's it", () => go(2), "primary"),
        m.lowDemand ? null : el("a", { class: "secondary", href: "#loops", text: "Not quite" })),
    );
  }

  if (step === 2) {
    const area = el("div", { class: "drill-area" });
    const next = el("div", { class: "row next-row" }, btn(m.lowDemand ? "Next" : "On to finishing", () => go(3), "secondary"));
    const showThen = () => { if (m.then) renderThen(m.then, area, () => go(3)); else area.append(next); };
    const menu = el("div", { class: "drill-menu" });
    const again = el("p", { class: "again", hidden: true },
      el("button", { type: "button", class: "text-btn", onclick: () => { runCleanup(); area.innerHTML = ""; menu.hidden = false; again.hidden = true; }, text: "Choose a different one" }));
    const startDrill = (drill) => {
      runCleanup();
      area.innerHTML = "";
      if (m.drills.length > 1) { menu.hidden = true; again.hidden = false; area.prepend(el("p", { class: "drill-name", text: drill.name })); }
      runDrill(drill, area, { m, onDone: showThen, goFinish: () => go(3), root });
      area.scrollIntoView({ block: "start", behavior: store.minimalMotion() ? "auto" : "smooth" });
    };
    if (m.drills.length === 1 && !m.lowDemand) {
      startDrill(m.drills[0]);
    } else {
      menu.append(el("p", { class: "lead", text: m.lowDemand ? "One tap. Nothing else." : "Choose one." }),
        el("div", { class: "drill-choices" }, m.drills.map((dr) => btn(dr.name, () => startDrill(dr), m.lowDemand ? "primary big" : "secondary"))));
      body.append(menu, again);
    }
    body.append(area);
    if (m.helpNote) body.append(el("p", { class: "hint", text: m.helpNote }));
    body.append(el("p", { class: "skip" }, el("button", { type: "button", class: "text-btn", onclick: () => go(3), text: "Skip to finishing" })));
  }

  if (step === 3) renderComplete(m, body, d);
}

function renderThen(t, area, onNext) {
  const box = el("div", { class: "then" },
    el("p", { class: "line", text: t.question }),
    t.hint ? el("p", { class: "hint", text: t.hint }) : null);
  const answer = el("div", { class: "answer" });
  const yesNo = el("div", { class: "row" },
    btn("Yes", () => { yesNo.remove(); answer.append(el("p", { text: t.yes })); if (t.yesPark) answer.append(parkPicker(onNext)); else answer.append(el("div", { class: "row" }, btn("On to finishing", onNext, "primary"))); }),
    btn("No", () => { yesNo.remove(); answer.append(el("p", { text: t.no }), el("div", { class: "row" }, btn("On to finishing", onNext, "primary"))); }));
  box.append(yesNo, answer);
  area.append(box);
}

/* ---------- finishing ---------- */
function renderComplete(m, body, d) {
  const c = m.complete;
  if (c.intro) body.append(el("p", { class: "lead", text: c.intro }));
  const picked = el("div", { class: "picked" });
  const list = el("div", { class: "action-choices" });
  const choose = (text, i) => {
    list.remove();
    picked.innerHTML = "";
    if (c.parkAction === i) {
      picked.append(el("p", { class: "line", text }), parkPicker(() => finish()));
      return;
    }
    picked.append(
      el("p", { class: "line", text }),
      el("p", { class: "hint", text: "Go and do it now. Come back when it's finished." }),
      el("div", { class: "row" }, btn("Done", finish, "primary big")));
  };
  c.actions.forEach((a, i) => list.append(btn(a, () => choose(a, i), "action")));
  list.append(btn("Something else of my own", () => choose("Your own thing, start to finish.", -1), "action"));
  body.append(list, picked);

  function finish() {
    picked.innerHTML = "";
    picked.append(
      el("p", { class: "naming closing", text: c.closing || d.doneLine }),
      el("div", { class: "row" }, el("a", { class: "secondary", href: "#home", text: "Back to home" })));
  }
}

/* ---------- park it (time only, never the words) ---------- */
function parkPicker(onDone) {
  const wrap = el("div", { class: "park" }, el("p", { class: "lead", text: "When would you like to come back to it?" }));
  const now = new Date();
  const at = (h, addDays = 0) => { const t = new Date(now); t.setDate(t.getDate() + addDays); t.setHours(h, 0, 0, 0); return t; };
  const options = [
    ["In an hour", new Date(now.getTime() + 3600000)],
    ["This evening, 7pm", now.getHours() < 19 ? at(19) : null],
    ["Tomorrow morning, 9am", at(9, 1)],
  ].filter(([, t]) => t);
  const row = el("div", { class: "choice-row" });
  const set = (t) => {
    store.set("worryTime", t.toISOString());
    wrap.innerHTML = "";
    wrap.append(
      el("p", { text: `Parked until ${t.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}. Only the time is saved, never the words.` }),
      el("div", { class: "row" }, btn("Continue", onDone, "primary")));
  };
  options.forEach(([label, t]) => row.append(btn(label, () => set(t))));
  const custom = el("input", { type: "time", "aria-label": "Or choose a time" });
  custom.addEventListener("change", () => {
    const [h, mi] = custom.value.split(":").map(Number);
    const t = new Date(now); t.setHours(h, mi, 0, 0);
    if (t < now) t.setDate(t.getDate() + 1);
    set(t);
  });
  wrap.append(row, el("label", { class: "custom-time" }, el("span", { text: "Or pick a time" }), custom));
  return wrap;
}

export function worryTimeDue() {
  const t = store.get("worryTime");
  return t && new Date(t) <= new Date() ? new Date(t) : null;
}
export function clearWorryTime() { store.set("worryTime", null); }

/* ---------- drills ---------- */
function typingBox(placeholder) {
  // Words typed here are never stored anywhere and are wiped when you move on.
  return el("textarea", { class: "jot", rows: "3", placeholder, autocomplete: "off", autocapitalize: "sentences", spellcheck: "false" });
}

function runDrill(drill, area, ctx) {
  const done = ctx.onDone;
  const kinds = { lines: drillLines, notice: drillNotice, worryTree: drillWorryTree, listen: drillListen, brainDump: drillBrainDump, link: drillLink, changeWords: drillChangeWords };
  (kinds[drill.type] || drillLines)(drill, area, done, ctx);
}

function drillLines(drill, area, done) {
  let i = 0;
  const intro = drill.intro ? el("p", { class: "hint", text: drill.intro }) : null;
  const line = el("p", { class: "line", "aria-live": "polite" });
  const box = drill.typeable ? typingBox("Type, or just think it") : null;
  const nextBtn = btn("Next", () => advance(), "primary");
  const row = el("div", { class: "row" }, nextBtn);
  area.append(...[intro, line, box, row].filter(Boolean));
  const show = () => { line.textContent = drill.lines[i]; if (box) box.value = ""; nextBtn.textContent = i < drill.lines.length - 1 ? "Next" : "Continue"; };
  function advance() {
    i++;
    if (i < drill.lines.length) { show(); return; }
    if (box) { box.value = ""; box.remove(); }
    row.remove();
    if (drill.outro) area.append(el("p", { class: "line soft", text: drill.outro }));
    if (drill.outro && drill.typeable && drill.outro.includes("type")) area.append(typingBox(""));
    if (drill.park) area.append(el("div", { class: "row" }, btn("Pick a time for it", () => { area.lastChild.remove(); area.append(parkPicker(done)); }), btn("Continue", done, "primary")));
    else done();
  }
  show();
}

function drillNotice(drill, area, done, ctx = {}) {
  const box = typingBox(drill.prompt);
  const go = btn("Let it go", start, "primary");
  const stage = el("div", { class: "notice-stage", hidden: true },
    el("canvas", { "aria-hidden": "true" }),
    el("p", { class: "notice-text", "aria-live": "polite" }));
  const cue = el("p", { class: "cue small", "aria-live": "polite" });
  area.append(el("p", { class: "hint", text: drill.prompt }), box, el("div", { class: "row" }, go), stage, cue);
  let size = 0.5;
  const rings = createRings($("canvas", stage), { getSize: () => size, isMinimal: () => store.minimalMotion(), mode: ctx.m?.rings });
  const hero = ctx.root && $(".loop-hero", ctx.root);

  function start() {
    const text = box.value.trim();
    box.value = ""; // wiped straight away
    box.hidden = true; go.parentElement.hidden = true;
    area.querySelectorAll(".hint").forEach((h) => { h.hidden = true; });
    stage.hidden = false;
    if (hero) hero.hidden = true; // one set of circles at a time
    stage.scrollIntoView({ block: "center", behavior: store.minimalMotion() ? "auto" : "smooth" });
    const t = $(".notice-text", stage);
    const lower = /^I\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1); // keep "I" as a capital
    t.textContent = text ? `I'm noticing the thought that ${lower}` : "I'm noticing the thought.";
    t.style.opacity = "1"; t.style.transform = "scale(1)";
    rings.start();
    const IN = 4000, OUT = 6000, BREATHS = 3;
    const t0 = performance.now();
    let raf = 0;
    const frame = () => {
      const e = performance.now() - t0;
      const cycle = IN + OUT;
      const n = Math.floor(e / cycle);
      const p = e % cycle;
      const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
      if (n >= BREATHS) {
        size = 0.35;
        t.textContent = ""; t.style.opacity = "0";
        cue.textContent = "Gone. You can do another, or move on.";
        rings.stop();
        stage.hidden = true;
        if (hero) hero.hidden = false;
        area.append(el("div", { class: "row" },
          btn("Another thought", () => { area.innerHTML = ""; drillNotice(drill, area, done, ctx); }),
          btn("Continue", done, "primary")));
        return;
      }
      if (p < IN) { size = 0.4 + 0.5 * ease(p / IN); cue.textContent = "Breathe in"; }
      else {
        const q = (p - IN) / OUT;
        size = 0.9 - 0.5 * ease(q);
        cue.textContent = "Breathe out, and let it drift";
        const fade = 1 - (n + ease(q)) / BREATHS;
        t.style.opacity = String(Math.max(0, fade));
        t.style.transform = `scale(${0.85 + 0.15 * fade})`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    cleanup.push(() => { cancelAnimationFrame(raf); rings.destroy(); if (hero) hero.hidden = false; });
  }
}

function drillWorryTree(drill, area, done, ctx) {
  const screen = (...kids) => { area.innerHTML = ""; area.append(...kids); };
  const box = typingBox(drill.firstHint);
  screen(el("p", { class: "line", text: drill.first }), box,
    el("div", { class: "row" }, btn("Next", () => { box.value = ""; ask(); }, "primary")));
  function ask() {
    screen(el("p", { class: "line", text: drill.can }),
      el("div", { class: "row" }, btn("Yes", now), btn("No", cant)));
  }
  function cant() {
    screen(el("p", { class: "line", text: drill.cantSay }),
      el("div", { class: "row wrap" },
        btn("Park it", () => { area.innerHTML = ""; area.append(parkPicker(done)); }),
        btn("Let it go for now", done, "primary")));
  }
  function now() {
    screen(el("p", { class: "line", text: drill.now }),
      el("div", { class: "row" },
        btn("Yes", () => screen(el("p", { class: "line", text: drill.nowSay }),
          el("p", { class: "hint", text: "Go and do it. Come back when it's finished." }),
          el("div", { class: "row" }, btn("Done", ctx.goFinishDone || (() => { location.hash = `#loop?id=${ctx.m.id}&step=3`; }), "primary")))),
        btn("No", () => { screen(el("p", { class: "line", text: drill.laterSay })); area.append(parkPicker(done)); })));
  }
}

function drillListen(drill, area, done) {
  const total = (drill.minutes || 3) * 60;
  const plan = [
    [30, "Listen only to the rain. Let the other sounds be in the background."],
    [30, "Now only the hum. Low and steady."],
    [30, "Now only the waves."],
    [30, "Switch more quickly now: rain… hum… waves…"],
    [30, "Rain… waves… hum…"],
    [30, "Now let all of them in at once. The thought can be there too."],
  ];
  const scale = total / plan.reduce((a, [s]) => a + s, 0);
  const line = el("p", { class: "line", "aria-live": "polite" });
  const left = el("p", { class: "hint" });
  const stopBtn = btn("Stop", () => finish(true));
  area.append(el("p", { class: "hint", text: "The thought can stay. You're just practising moving your attention." }), line, left, el("div", { class: "row" }, stopBtn));
  const startedHere = !sound.anyOn();
  sound.turnOn("rain", 0.45); sound.turnOn("drone", 0.3); sound.turnOn("waves", 0.45);
  const t0 = Date.now();
  let lastIdx = -1;
  const tick = () => {
    const e = (Date.now() - t0) / 1000;
    if (e >= total) { finish(false); return; }
    let acc = 0, idx = 0;
    for (; idx < plan.length; idx++) { acc += plan[idx][0] * scale; if (e < acc) break; }
    if (idx !== lastIdx) { line.textContent = plan[idx][1]; lastIdx = idx; }
    const r = Math.ceil(total - e);
    left.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")} left`;
  };
  tick();
  const id = setInterval(tick, 500);
  cleanup.push(() => clearInterval(id));
  function finish(early) {
    clearInterval(id);
    if (startedHere) sound.stopAll();
    area.innerHTML = "";
    area.append(el("p", { class: "line", text: early ? "Stopped. That's fine." : "Well done. Attention moved, even if only a little." }));
    done();
  }
}

function drillBrainDump(drill, area, done) {
  const box = el("textarea", { class: "jot dump", rows: "8", placeholder: drill.prompt, autocomplete: "off", spellcheck: "false" });
  area.append(el("p", { class: "hint", text: drill.prompt }), box,
    el("div", { class: "row" }, btn("Let it all go", () => {
      box.classList.add("fading");
      setTimeout(() => {
        box.value = "";
        area.innerHTML = "";
        area.append(el("p", { class: "line", text: "Out of your head. You don't need to hold it now." }));
        done();
      }, 2500);
    }, "primary")),
    el("p", { class: "hint", text: "Nothing you type here is kept." }));
}

function drillLink(drill, area, done) {
  const href = drill.theme ? `${drill.href}&theme=${drill.theme}` : drill.href;
  area.append(el("div", { class: "row" }, el("a", { class: "primary big", href, text: `Open: ${drill.name}` })),
    el("p", { class: "hint", text: "Take as long as you like. When you leave it, you'll come back here." }));
  done();
}

function drillChangeWords(drill, area, done) {
  const input = el("input", { type: "text", class: "jot one-line", placeholder: "e.g. reply to that email", autocomplete: "off" });
  const out = el("div", { class: "action-choices" });
  area.append(el("p", { class: "hint", text: drill.prompt }), input,
    el("div", { class: "row" }, btn("Show me other ways to say it", show, "primary")), out);
  function show() {
    const x = input.value.trim().replace(/^i (have|need|must|should) to /i, "").replace(/\.$/, "") || "do it";
    input.value = "";
    out.innerHTML = "";
    out.append(el("p", { class: "hint", text: "Pick the one that feels lightest." }));
    drill.frames.forEach((f) => out.append(btn(f.replace("{x}", x), (e) => {
      out.innerHTML = "";
      out.append(el("p", { class: "line", text: e.target.textContent }));
      done();
    }, "action")));
  }
}

/* ---------- get help ---------- */
export async function renderHelp(root) {
  const d = await loadLoops();
  const h = d?.help;
  root.innerHTML = "";
  if (!h) {
    root.append(el("h1", { text: "Get help now" }), el("p", { text: "In an emergency call 112 or 999. Samaritans: 116 123, free, any time." }));
    return;
  }
  const link = (c) => c.tel ? `tel:${c.tel}` : `sms:${c.sms}${c.body ? `?&body=${encodeURIComponent(c.body)}` : ""}`;
  root.append(
    el("h1", { text: h.title }),
    el("h2", { text: h.urgentTitle }),
    el("ul", { class: "contacts" }, h.urgent.map((c) => el("li", {},
      el("a", { class: "contact", href: link(c) }, el("span", { class: "who", text: c.who }), el("span", { class: "how", text: c.how }))))),
    el("h2", { text: h.soonTitle }),
    el("p", { text: h.soonIntro }),
    el("ul", { class: "signs" }, h.soon.map((s) => el("li", { text: s }))),
    el("h2", { text: h.ongoingTitle }),
    el("p", { text: h.ongoing }),
    el("p", {}, el("a", { class: "text-link", href: h.practiceUrl, target: "_blank", rel: "noopener", text: h.practiceLabel })),
    el("p", {}, el("a", { class: "text-link", href: h.directoryUrl, target: "_blank", rel: "noopener", text: h.directoryNote })),
    el("p", { class: "hint", text: h.privacy }),
  );
}

export function leaveLoops() { runCleanup(); clearCircles(); }
