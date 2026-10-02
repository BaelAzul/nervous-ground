// Keeps Ebbly working offline once it has been opened.
// Bump VERSION whenever app files change so phones pick up the new version.
const VERSION = "ebbly-2";
const SHELL = [
  "./", "index.html", "css/app.css",
  "js/app.js", "js/store.js", "js/sound.js", "js/breath.js", "js/rings.js", "js/loops.js",
  "library.json", "loops.json", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "ng-audio").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Recordings: keep a copy after the first listen so they play offline.
  if (url.origin === location.origin && url.pathname.includes("/audio/")) {
    if (req.headers.has("range")) return; // let the browser stream normally
    e.respondWith(caches.open("ng-audio").then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.status === 200) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // The library list: try the network first so new items show up, fall back offline.
  if (url.pathname.endsWith("library.json") || url.pathname.endsWith("loops.json")) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // Everything else (app files, fonts): use the saved copy, refresh it in the background.
  e.respondWith(caches.match(req).then((hit) => {
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
