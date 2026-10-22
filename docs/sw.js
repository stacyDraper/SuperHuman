// when fire web client, service worker.
// Keeps the shell available offline and is where a push will land in phase 3.
const SHELL = "when-fire-shell-v2";
const ASSETS = ["./", "./app.js", "./styles.css", "./icon-512.png"];
const SCOPE = self.registration.scope; // everything under here is ours

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// The page itself: network first, so a new deploy shows at once; the shell from cache when offline.
// Everything else under this path: cache first.  The connector is never cached.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !url.href.startsWith(SCOPE)) return;
  const isPage = e.request.mode === "navigate" || url.href.split("?")[0] === SCOPE;
  if (isPage) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(SHELL).then((c) => c.put("./", copy));
      return r;
    }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && !url.pathname.endsWith("manifest.webmanifest")) {
      const copy = r.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
    }
    return r;
  })));
});

// Phase 3 lands here: a push opens or continues a session.
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title ?? "when fire", {
    body: data.body ?? "",
    icon: "./icon-512.png",
    data: { url: data.url ?? "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate?.(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
