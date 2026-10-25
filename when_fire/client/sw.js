// when fire, the web client's service worker.  Sunday, October 25, 2026.
// Keeps the shell available offline: the pages, the script, the styles, the icon.  The connector is never cached.
const SHELL = "when-fire-shell-v4";
const ASSETS = ["./", "./index.html", "./whens.html", "./thoughts.html", "./questions.html", "./settings.html", "./app.js", "./styles.css", "./icon-512.png", "./manifest.webmanifest"];
const SCOPE = self.registration.scope;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Pages and the script: network first, so a new deploy shows at once; the cached copy when offline.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !url.href.startsWith(SCOPE)) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m ?? caches.match("./"))),
  );
});
