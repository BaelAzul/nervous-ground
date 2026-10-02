// Gentle vibration.
// Android phones: the browser's vibration feature.
// iPhones (iOS 18 and later): Safari has no vibration feature, but it gives a light tap
// when an on/off switch is flicked, so we flick a hidden one.
import * as store from "./store.js";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canVibrate = typeof navigator.vibrate === "function";

export const kind = canVibrate ? "vibrate" : isIOS ? "ios" : "none";
export const supported = kind !== "none";

let label = null;
function iosSwitch() {
  if (label) return label;
  label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.append(input);
  document.body.append(label);
  return label;
}

function once(ms) {
  if (kind === "vibrate") navigator.vibrate(ms);
  else if (kind === "ios") iosSwitch().click();
}

// pattern: list of lengths in ms; on iPhone each one is a single light tap.
export function play(pattern = [30], force = false) {
  if (!supported || (!force && !store.get("vibrate"))) return;
  if (kind === "vibrate") { navigator.vibrate(pattern.flatMap((ms, i) => (i ? [90, ms] : [ms]))); return; }
  pattern.forEach((ms, i) => setTimeout(() => once(ms), i * 160));
}

export const tap = () => play([15]);
// A different feel for each kind of breath step.
export function step(stepKind) {
  if (stepKind === "in") play([35]);
  else if (stepKind === "out") play([20, 20]);
  else play([12]);
}
