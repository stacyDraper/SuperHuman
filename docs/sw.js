// when fire, the web client's service worker.  Sunday, October 25, 2026; pushes, Monday, October 26.
// Keeps the shell available offline: the pages, the script, the styles, the icon.  The connector is never cached.
// Receives the routine's pushes from the notify handler and shows each step as a notification.  Done on the
// notification records the fact straight from here, through the door's address the page keeps in the key cache;
// a plain tap opens the Today page on that step.
const SHELL = "when-fire-shell-v6";
const ASSETS = ["./", "./index.html", "./today.html", "./whens.html", "./thoughts.html", "./questions.html", "./settings.html", "./app.js", "./styles.css", "./icon-512.png", "./manifest.webmanifest"];
const SCOPE = self.registration.scope;
const KEY_CACHE = "when-fire-key";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== KEY_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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

// A push: one step of the routine, from the notify handler.  { title, body, when, fire, kind, at, condition_words }
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title ?? "when fire";
  const options = {
    body: d.body ?? "",
    icon: "./icon-512.png",
    badge: "./icon-512.png",
    tag: d.tag ?? (d.when ? `when-${d.when}` : undefined),
    renotify: !!(d.when || d.tag),
    data: d,
    actions: d.when && d.kind === "tick" ? [{ action: "done", title: "Done" }] : [],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// A tap.  Done records the step as a fact in the step's own words; anything else opens Today on the step.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data ?? {};
  const page = d.url ? String(d.url) : `./today.html${d.when ? `?when=${encodeURIComponent(d.when)}` : ""}`;
  if (e.action === "done" && d.when) {
    e.waitUntil(recordDone(d).then(async (ok) => {
      if (ok) { for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ recorded: d.when }); return; }
      return open(page);
    }));
    return;
  }
  e.waitUntil(open(page));
});

async function recordDone(d) {
  try {
    const c = await caches.open(KEY_CACHE);
    const r = await c.match("./key");
    if (!r) return false;
    const address = await r.text();
    const body = { jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "record", arguments: {
      said: d.body, about: d.when, shape: { via: "when_fire_web", done: true, fire: d.fire ?? null, from: "notification" } } } };
    const res = await fetch(address, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return false;
    const j = await res.json();
    return !j?.error && !j?.result?.isError;
  } catch { return false; }
}

async function open(page) {
  const url = new URL(page, SCOPE).href;
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const mine = all.find((c) => c.url.startsWith(SCOPE));
  if (mine && "navigate" in mine) { await mine.focus(); return mine.navigate(url); }
  if (mine) return mine.focus();
  return self.clients.openWindow(url);
}
