// when fire, the web client.  Sunday, October 25, 2026; the Today page and notifications, Monday, October 26; the day as
// one list with three check-ins, one Done and a note box on every step, caps in Settings, last time, an Undo on every done step, and Settings in folds, Thursday, November 26.
// The evening of November 26, the push: the Thinker's sitting at the top of Today and whole on Thoughts with Next; the
// eight areas on Thoughts with his own number; the Thinker's notes and the questions off the page; last night's steps
// in dusk on Today; a page of the log read into a table under Pages to check on Record, his to fix and record.
// Several pages, one navigation (a bar at the top of every page), one door: every page talks to the connector with the same verbs any AI uses.
// The key rides on the page's address once (?token=...), then lives in this browser's storage.
// Pages: today, record (index), whens, thoughts, questions, settings.  The body's data-page says which one this is.
//
// Tuesday, November 24, 2026: a file goes in whole.  Until then the Record page redrew every picture on the phone
// (long side 1600, JPEG) and the redrawing was what the record kept.  Now a picture, a recording or a document
// travels as the file it is, up to sixteen megabytes; a larger one is told so plainly and stays where it is.  A whole
// file does not fit in the browser's small storage, so an entry with a file is kept in the browser's database until
// the record has it.  The page calls nothing recorded, or kept, that is not.

"use strict";

// ---------------------------------------------------------------------------------------------
// The door.
// ---------------------------------------------------------------------------------------------
const BASE = "https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/";
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch { return false; /* storage is shut or full */ } },
};
const params = new URLSearchParams(location.search);
if (params.get("token")) { store.set("wf_token", params.get("token")); }
if (params.get("schema") !== null) { store.set("wf_schema", params.get("schema") || null); }
if (params.get("door")) { store.set("wf_door", params.get("door")); }
const cameFor = params.get("when") ?? params.get("checkin");                   // a notification tapped: the step, or the check-in, to show
if ([...params.keys()].length) history.replaceState(null, "", location.pathname); // the key stays in storage, not in the bar

const token = () => store.get("wf_token", "");
const doorName = () => store.get("wf_door", "when-fire-mcp");
const schema = () => store.get("wf_schema", "");
const address = () => `${BASE}${doorName()}?token=${encodeURIComponent(token())}${schema() ? `&schema=${encodeURIComponent(schema())}` : ""}`;

async function call(name, args = {}) {
  if (!token()) throw new Error("no key");
  const r = await fetch(address(), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  if (r.status === 401) throw new Error("refused");
  // Only a plain answer is an answer.  A worker that stopped, or a gateway that timed out, sends words of its own
  // under another status; read as an answer, those words looked like a yes and the page said Recorded.
  if (!r.ok) { let words = ""; try { words = (await r.text()).replace(/\s+/g, " ").trim().slice(0, 160); } catch { /* no words came */ } throw new Error(`the door answered ${r.status}${words ? `: ${words}` : ""}`); }
  const j = await r.json();
  if (j?.error) throw new Error(j.error.message);
  const text = j?.result?.content?.[0]?.text ?? "";
  if (j?.result?.isError) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

// The service worker cannot read this storage, yet a Done tapped on a notification must reach the record without the
// page.  So while notifications are on, the door's address is also kept in the cache store, under one name; the worker
// reads it there.  Forgetting the key, or turning notifications off, removes it.
const KEY_CACHE = "when-fire-key";
const keyCache = {
  async put() { try { const c = await caches.open(KEY_CACHE); await c.put("./key", new Response(address(), { headers: { "content-type": "text/plain" } })); } catch { /* no cache store */ } },
  async drop() { try { await caches.delete(KEY_CACHE); } catch { /* nothing to drop */ } },
};

// ---------------------------------------------------------------------------------------------
// Time, in the device's zone.  The time a thing happened leads; the time it was entered is a footnote.
// ---------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const fmtDayLong = (iso) => new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
const fmtStamp = (iso) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const todayKey = () => dayKey(new Date().toISOString());
const inputValue = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const minutesApart = (a, b) => Math.abs(new Date(a) - new Date(b)) / 60000;
function relative(iso) {
  const m = (Date.now() - new Date(iso)) / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  if (m < 36 * 60) return `${Math.round(m / 60)} h ago`;
  return fmtDay(iso);
}

// ---------------------------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const ACTORS = new Set(["watch", "reconciler", "thinker", "doer", "librarian", "heartbeat", "system", "ai", "replay", "claude"]);
const isPersonSide = (w) => !ACTORS.has(String(w.asserted_by));
const isNote = (f) => f.kind === "note" || /^error:/.test(f.said_by);
const short = (s, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const firstWords = (s, n = 7) => s.split(/\s+/).slice(0, n).join(" ") + (s.split(/\s+/).length > n ? "…" : "");

function status(text, kind = "", ms = 3600) {
  const s = $("status"); if (!s) return;
  s.textContent = text; s.className = `status ${kind}`; s.hidden = false;
  clearTimeout(status.t);
  if (ms) status.t = setTimeout(() => { s.hidden = true; }, ms);
}
function needKey(err) {
  const form = $("key-form"); if (!form) return false;
  // Exactly the door's refusal of the key, or no key at all.  Other words that happen to hold "refused" (a worker's,
  // a gateway's) are not it, and must not make the phone forget its key.
  const said = String(err?.message ?? err);
  const refused = said === "refused" || said === "no key";
  if (refused) { if (said === "refused") store.set("wf_token", null); form.hidden = false; $("main")?.classList.add("locked"); }
  return refused;
}
function keyForm() {
  const form = $("key-form"); if (!form) return;
  if (!token()) { form.hidden = false; $("main")?.classList.add("locked"); }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = $("key-input").value.trim();
    let key = raw;
    try { const u = new URL(raw); key = u.searchParams.get("token") ?? raw; const d = u.pathname.split("/").pop(); if (d) store.set("wf_door", d); const s = u.searchParams.get("schema"); if (s) store.set("wf_schema", s); } catch { /* a bare key */ }
    if (!key) return;
    store.set("wf_token", key);
    location.reload();
  });
}

// A read, shared by the pages and kept for a minute so the tabs feel instant.
let cache = null;
async function readRecord(opts = {}, fresh = false) {
  const key = JSON.stringify(opts);
  if (!fresh && cache && cache.key === key && Date.now() - cache.at < 60000) return cache.data;
  const data = await call("read", opts);
  cache = { key, at: Date.now(), data };
  return data;
}

// Things the person wrote that did not reach the record yet (no connection, a door that did not answer, a phone that
// slept in the middle of a send): kept on this phone and sent again.  Words alone are kept in the browser's small
// storage, as before.  A whole file does not fit there, so an entry with a file is kept in the browser's database,
// which holds a file whole.  An entry from the Record form is kept before it travels and let go once the record has
// it, so a send cut short loses nothing; and it carries its own id, so one entry is one fact however often it is sent.
const PENDING = "wf_pending", MARKS = "wf_marks";
const FRESH = 30000;    // a send that was on its way under half a minute ago may still be landing; the page does not send it again on its own before then
const KEPT = "Kept on this phone; it goes to the record when the connection is back.";
const why = (err) => (err instanceof TypeError ? "no connection" : String(err?.message ?? err).slice(0, 140));
const plural = (n, word) => `${n} ${word}${String(n) === "1" ? "" : "s"}`;
const megabytes = (n) => (n >= 1e6 ? plural((n / 1e6).toFixed(1).replace(/\.0$/, ""), "megabyte") : plural(Math.max(1, Math.round(n / 1000)), "kilobyte"));
const entryId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// The browser's database, one store: the entries that carry a file.  A promise from here settles when its
// transaction has, so a write that resolves is on the phone.
const jar = {
  ready: null,
  open() {
    if (!this.ready) {
      this.ready = new Promise((ok, no) => {
        const req = indexedDB.open("when-fire", 1);
        req.onupgradeneeded = () => { req.result.createObjectStore("pending", { keyPath: "id", autoIncrement: true }); };
        req.onsuccess = () => ok(req.result);
        req.onerror = () => no(req.error ?? new Error("the browser's database did not open"));
        req.onblocked = () => no(new Error("the browser's database is busy"));
      });
    }
    return this.ready;
  },
  async work(mode, fn, again = true) {
    try {
      const db = await this.open();
      return await new Promise((ok, no) => {
        const t = db.transaction("pending", mode);
        const req = fn(t.objectStore("pending"));
        t.oncomplete = () => ok(req.result);
        t.onerror = t.onabort = () => no(t.error ?? req.error ?? new Error("the browser's database refused"));
      });
    } catch (e) {
      // A phone that has been asleep may have let the database go.  It is opened afresh, once.  Nothing was written
      // by the try that stumbled: a transaction that did not complete wrote nothing.
      const was = this.ready; this.ready = null;
      if (was) was.then((db) => { try { db.close(); } catch { /* already gone */ } }, () => {});
      if (!again) throw e;
      return await this.work(mode, fn, false);
    }
  },
  add(entry) { return this.work("readwrite", (s) => s.add(entry)); },
  all() { return this.work("readonly", (s) => s.getAll()); },
  drop(id) { return this.work("readwrite", (s) => s.delete(id)); },
};

// Small notes about kept entries, by key: when a send of it was last known to be on its way, and how often the door
// has refused it.
const marks = {
  all: () => { try { const m = JSON.parse(store.get(MARKS, "{}")); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; } catch { return {}; } },
  set(key, patch) { const m = this.all(); m[key] = { ...(m[key] ?? {}), ...patch }; store.set(MARKS, JSON.stringify(m)); },
  drop(key) { const m = this.all(); if (key in m) { delete m[key]; store.set(MARKS, JSON.stringify(m)); } },
  keep(keys) { const m = this.all(), k = new Set(keys); let changed = false; for (const x of Object.keys(m)) if (!k.has(x)) { delete m[x]; changed = true; } if (changed) store.set(MARKS, JSON.stringify(m)); },
};

const pending = {
  busy: false, wait: 0, inFlight: new Set(),
  words: () => { try { const l = JSON.parse(store.get(PENDING, "[]")); return Array.isArray(l) ? l : []; } catch { return []; } },
  // Everything kept, oldest first: the words in the small storage and the entries with a file in the database.
  async list() {
    const m = marks.all();
    const small = this.words().map((it) => ({ ...it, where: "storage", key: `s:${it.queued_at}` }));
    let whole = [], partial = false;
    try { whole = (await jar.all()).map((it) => ({ ...it, where: "database", key: `d:${it.id}` })); } catch { partial = true; /* the database could not be read just now */ }
    const l = [...small, ...whole].map((it) => ({ ...it, ...(m[it.key] ?? {}) })).sort((a, b) => (String(a.queued_at) < String(b.queued_at) ? -1 : 1));
    l.partial = partial;
    return l;
  },
  // Keeps an entry and says where, or null when this phone could not keep it.  It is kept with the time it was
  // written, so an entry that goes later still says when it happened.  sending: a send of it begins now.
  async add(item, sending = false) {
    const queued_at = new Date().toISOString();
    const entry = { ...item, args: { ...item.args, happened_at: item.args?.happened_at ?? queued_at }, queued_at };
    let h = null;
    if (!entry.args.attachment) {
      const l = this.words(); l.push(entry);
      if (store.set(PENDING, JSON.stringify(l))) h = { where: "storage", key: `s:${queued_at}`, queued_at };
    }
    if (!h) { try { const id = await jar.add(entry); h = { where: "database", key: `d:${id}`, id }; } catch { return null; } }
    if (sending) this.inFlight.add(h.key);
    return h;
  },
  // While a send is on its way its mark is kept fresh, so another opening of the page leaves the entry alone.
  beat(key) { const tick = () => marks.set(key, { alive: Date.now() }); tick(); return setInterval(tick, 10000); },
  // The record has it: the entry leaves the phone.
  async remove(h) {
    this.inFlight.delete(h.key); marks.drop(h.key);
    if (h.where === "database") await jar.drop(h.id).catch(() => {});
    else store.set(PENDING, JSON.stringify(this.words().filter((x) => x.queued_at !== h.queued_at)));
  },
  // A send of it ended without the record's receipt: it stays kept.  With no answer at all it may still be landing,
  // so its mark stays fresh a little longer.  A refusal the door answered did not land; it is counted.
  stays(h, err) {
    this.inFlight.delete(h.key);
    const said = String(err?.message ?? err);
    if (said === "refused" || said === "no key") marks.set(h.key, { alive: 0 });
    else if (err instanceof TypeError) marks.set(h.key, { alive: Date.now() });
    else marks.set(h.key, { alive: 0, tries: ((marks.all()[h.key] ?? {}).tries ?? 0) + 1, refused: why(err) });
  },
  // Sends what is kept, oldest first.  byHand is the Send now button: it also tries what the page holds back on its
  // own, which is an entry whose last send was on its way under half a minute ago (it may still be landing) and an
  // entry with a file that the door has refused three times (a whole file is a long upload to repeat at every opening).
  async flush(byHand = false) {
    if (this.busy) return 0;
    this.busy = true; this.wait = 0;
    let sent = 0;
    try {
      const all = await this.list();
      if (!all.partial) marks.keep([...all.map((it) => it.key), ...this.inFlight]);
      const now = Date.now();
      const due = all.filter((it) => {
        if (this.inFlight.has(it.key)) return false;
        if (byHand) return true;
        if (it.where === "database" && (it.tries ?? 0) >= 3) return false;
        const left = FRESH - (now - (it.alive ?? 0));
        if (left > 0) { this.wait = Math.max(this.wait, left); return false; }
        return true;
      });
      if (!due.length) return 0;
      // An entry may have reached the record after all: the file went up and the answer never came back.  The record
      // is asked once which of these it already holds, by each entry's own id in the fact's pocket.  If the record
      // does not answer, nothing is sent blind.
      let held = new Set();
      const mine = due.filter((it) => it.args?.shape?.entry);
      if (mine.length) {
        const since = new Date(Math.min(...mine.map((it) => new Date(it.queued_at).getTime())) - 3600 * 1000).toISOString();
        try { const rec = await call("read", { since, limit: "all", notes: false, fires: false }); held = new Set((rec?.facts ?? []).map((f) => f.shape?.entry).filter(Boolean)); }
        catch (e) { needKey(e); return 0; }
      }
      for (const it of due) {
        const id = it.args?.shape?.entry;
        let pulse = null;
        try {
          if (!id || !held.has(id)) {
            pulse = this.beat(it.key);
            const out = await call("record", it.args);
            if (!out?.fact) throw new Error("the record gave no receipt");
            if (id) held.add(id);
          }
          sent++;
          await this.remove(it);
        } catch (e) {
          this.stays(it, e);
          if (needKey(e)) break;
        } finally { clearInterval(pulse); }
      }
    } finally { this.busy = false; }
    return sent;
  },
};

// ---------------------------------------------------------------------------------------------
// Navigation: the same bar on every page; the current page is marked.
// ---------------------------------------------------------------------------------------------
function nav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".tabs a").forEach((a) => { if (a.dataset.page === page) a.setAttribute("aria-current", "page"); });
}

// ---------------------------------------------------------------------------------------------
// The pages.
// ---------------------------------------------------------------------------------------------
const pages = {};

// Today: the day as one list, read from the record (the today verb).  Since Thursday, November 26, 2026 (Stacy, 6:45 AM,
// November 2: "every today is potentially different"; 8:50 AM, November 26: the Lecto pattern, three check-ins a day):
// everything that falls today, from every routine, in clock order; nothing drawn that does not fall today; the three
// check-ins are the headings of the day's stretches, and "All as planned" under a heading records the stretch's steps
// at their planned times with one tap.  The morning stretch reaches back to last night.  Each step has one Done
// button and a note box that is always open; Done with words in the box records the step done in those words.  A
// worded step (the round) sits under the noon check-in, done when he can.  Nothing here is hard coded: a routine is
// a bundle of whens on the person's side, marked routine in its shape, and a check-in is a step whose pocket says so.
pages.today = async function () {
  const box = $("routines"), empty = $("today-empty"), hint = $("notify-hint"), lastBox = $("last-time");
  let day = null, yday = null;   // the record's local day and the one before, from the today verb
  if ("Notification" in window && Notification.permission !== "granted") hint.hidden = false;
  $("day-note").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ta = $("day-note-words"), words = ta.value.trim(); if (!words) { ta.focus(); return; }
    const args = { said: words, shape: { via: "when_fire_web", note: "day" } };
    try { await call("record", args); ta.value = ""; status("Noted.  If it changes a step, a question comes back for your yes.", "ok", 6000); }
    catch (err) {
      if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
      else { pending.add({ args }); ta.value = ""; status(KEPT, "warn", 6000); }
    }
  });
  // The planned instant of a step on a day, in this device's zone (the record's day is the person's day).
  const plannedAt = (w, onDay) => (w.at && onDay ? new Date(`${onDay}T${w.at}:00`) : null);
  const dayBefore = (d) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - 1); return dayKey(x.toISOString()); };
  const clock = (at) => (at ? fmtTime(`${todayKey()}T${at}:00`) : "");

  await render();
  renderLastTime();


  async function render() {
    try {
      const t = await call("today");
      day = t.day ?? todayKey(); yday = dayBefore(day);
      renderSitting($("sitting"), t.sitting, false);
      const all = (t.whens ?? []).map((w) => ({ ...w, on: day }));
      const checkins = all.filter((w) => w.shape?.checkin && w.falls_today).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      const steps = all.filter((w) => !w.shape?.checkin && w.falls_today);
      let yesterday = [];
      if (checkins.length) {
        // last night: the steps of the day before whose clock came after the last check-in of that day
        const last = checkins[checkins.length - 1].at;
        try { const y = await call("today", { day: yday }); yesterday = (y.whens ?? []).filter((w) => !w.shape?.checkin && w.falls_today && w.at && w.at > last).map((w) => ({ ...w, on: yday, lastNight: true })); }
        catch { /* the morning stretch shows today's own steps then */ }
      }
      // The stretches: each check-in heads the steps whose clock falls between the check-in before it and itself;
      // the first stretch reaches back to last night; what comes after the last check-in is tonight.
      const sections = [];
      if (checkins.length === 0) {
        sections.push({ title: "Today", steps });
      } else {
        const worded = steps.filter((w) => !w.at);
        let prev = null;
        checkins.forEach((c, i) => {
          const mine = steps.filter((w) => w.at && (prev === null || w.at > prev) && w.at <= c.at);
          const section = { checkin: c, title: c.words, at: c.at, steps: i === 0 ? [...yesterday, ...mine] : mine };
          if (i === 1 || (i === 0 && checkins.length === 1)) section.steps = [...worded, ...section.steps];   // the round and the like: done when he can, by noon
          sections.push(section);
          prev = c.at;
        });
        const tonight = steps.filter((w) => w.at && w.at > prev);
        if (tonight.length) sections.push({ title: "Tonight", at: null, steps: tonight, tonight: true });
      }
      box.replaceChildren(...sections.map((s) => section(s)));
      empty.hidden = all.length > 0;
      const target = cameFor ? box.querySelector(`[data-when="${cameFor}"]`) : null;
      if (target) { target.classList.add("flash"); target.scrollIntoView({ block: "start" }); }
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
  }

  function section(s) {
    const open = s.steps.filter((w) => !(w.facts_today ?? []).length);
    const past = open.filter((w) => { const p = plannedAt(w, w.on); return p ? p.getTime() < Date.now() : true; });
    const head = el("div", { class: "stretch-head" },
      el("h2", {}, s.title, s.at ? el("span", { class: "when-at" }, ` · ${clock(s.at)}`) : null),
      s.checkin ? (open.length === 0 && s.steps.length
        ? el("p", { class: "state met" }, "all recorded")
        : past.length ? allButton(s, past) : el("p", { class: "state" }, "nothing due yet")) : null);
    const art = el("section", { class: `stretch${s.tonight ? " tonight" : ""}`, "data-when": s.checkin?.id ?? null }, head, s.steps.map((w) => step(w)));
    if (s.checkin && (s.checkin.facts_today ?? []).length) art.append(el("p", { class: "meta" }, `checked in ${fmtTime(s.checkin.facts_today[s.checkin.facts_today.length - 1].happened_at)}`));
    if (s.tonight) art.append(el("p", { class: "meta" }, "the morning check-in picks these up"));
    return art;
  }

  // One tap: every open step of the stretch whose clock has passed is recorded at its planned time, and the check-in
  // itself is recorded as done, naming the steps.  Stacy, October 27: "done means it was done according to plan or
  // assertion."
  function allButton(s, past) {
    const btn = el("button", { class: "small primary", type: "button" }, `All as planned (${past.length})`);
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const recorded = [];
      try {
        for (const w of past) {
          const planned = plannedAt(w, w.on);
          const args = { said: w.words, about: w.id, shape: { via: "when_fire_web", done: true, as_planned: !!planned, checkin: s.checkin.id, routine: w.routine_name ?? null } };
          if (planned) args.happened_at = planned.toISOString();
          await call("record", args);
          recorded.push(w.id);
        }
        await call("record", { said: `${s.checkin.words}: ${recorded.length} as planned`, about: s.checkin.id, shape: { via: "when_fire_web", done: true, checkin: s.checkin.shape?.checkin ?? true, steps: recorded } });
        status(`Recorded, ${recorded.length} as planned.`, "ok");
        await render();
      } catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else status(`${recorded.length} recorded, then: ${why(err)}.  Tap again for the rest.`, "warn", 8000);
        btn.disabled = false;
      }
    });
    return btn;
  }

  function step(w) {
    const facts = w.facts_today ?? [];
    const done = facts.length;
    const last = done ? facts[done - 1] : null;
    const state = w.reading === "met" ? el("p", { class: "state met" }, `met${last ? `, ${fmtTime(last.happened_at)}` : ""}`)
      : w.reading === "silence" ? el("p", { class: "state silence" }, "silence")
      : done ? el("p", { class: "state met" }, `done, ${fmtTime(last.happened_at)}${done > 1 ? ` (${done} times)` : ""}${last.words ? `: ${last.words}` : last.said !== w.words ? `: ${short(last.said, 60)}` : ""}`)
      : el("p", { class: "state" }, w.lastNight ? "last night" : (w.condition_words ?? "open"));
    const noteBox = el("textarea", { rows: 1, class: "step-words", placeholder: done ? "a note…" : "a note, in your words…" });
    const btn = el("button", { class: `small${done ? " ghost" : " primary"}`, type: "button" }, done ? "Again" : "Done");
    // One button.  Before done: Done, with or without words.  After done: Note when the box has words, Again when not.
    const relabel = () => { if (done) btn.textContent = noteBox.value.trim() ? "Note" : "Again"; };
    noteBox.addEventListener("input", () => { noteBox.style.height = "auto"; noteBox.style.height = `${Math.min(noteBox.scrollHeight, 200)}px`; relabel(); });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const words = noteBox.value.trim();
      let args;
      if (done && words) {
        args = { said: words, about: w.id, shape: { via: "when_fire_web", note: "step", routine: w.routine_name ?? null } };
      } else {
        // A first Done after the step's clock is recorded at the planned time; a Done before it, or Again, at the tap.
        const planned = !done ? plannedAt(w, w.on) : null;
        const asPlanned = !!planned && planned.getTime() < Date.now();
        args = { said: words || w.words, about: w.id, shape: { via: "when_fire_web", done: true, routine: w.routine_name ?? null, ...(asPlanned ? { as_planned: true } : {}), ...(words ? { words, step: w.words } : {}) } };
        if (asPlanned) args.happened_at = planned.toISOString();
      }
      try {
        await call("record", args);
        status(args.shape.note ? "Noted.  If it changes the step, a question comes back for your yes." : args.happened_at ? `Recorded, as planned at ${fmtTime(args.happened_at)}.` : `Recorded, ${fmtTime(new Date().toISOString())}.`, "ok", 5000);
        await render();
      } catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else { pending.add({ args }); status(KEPT, "warn", 6000); btn.disabled = false; }
      }
    });
    // Undo: a Done tapped by mistake (Stacy, November 26, 1:52 PM: "I need an undo button, or an oh shit button").
    // Nothing is deleted: a new fact corrects the tap and says it was not done; the step stands open again.
    let undo = null;
    if (done && last?.id) {
      undo = el("button", { class: "small ghost undo", type: "button", title: "tapped by mistake" }, "Undo");
      undo.addEventListener("click", async () => {
        undo.disabled = true; btn.disabled = true;
        const args = { said: `Not done: ${w.words}.  Tapped by mistake.`, about: w.id, corrects: last.id, happened_at: last.happened_at,
          shape: { via: "when_fire_web", undo: true, undoes: last.id, step: w.words, routine: w.routine_name ?? null } };
        try {
          await call("record", args);
          status("Undone.  The tap and the undo both stand on the record; the step is open again.", "ok", 6000);
          await render();
        } catch (err) {
          if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
          else { pending.add({ args }); status(KEPT, "warn", 6000); undo.disabled = false; btn.disabled = false; }
        }
      });
    }
    // A pack: the step shows its label, and a tap opens a bubble with everything in it, read from the when's pocket
    // (Stacy, November 26, 3:07 PM: "let me tap it a bubble comes up and I see everything in it").
    const inside = Array.isArray(w.shape?.items) ? w.shape.items.filter(Boolean).map(String) : [];
    const words = inside.length
      ? el("details", { class: "bubble" },
          el("summary", {}, el("span", { class: "words" }, w.shape?.label ?? w.words), el("span", { class: "count" }, `${inside.length} in it`)),
          el("ul", {}, ...inside.map((it) => el("li", {}, it))))
      : el("p", { class: "words" }, w.shape?.label ?? w.words);
    return el("article", { class: `step${done ? " done" : ""}${w.lastNight ? " last-night" : ""}`, "data-when": w.id },
      el("span", { class: "clock" }, w.at ? clock(w.at) : "—"),
      el("div", { class: "body" }, words, state, noteBox),
      el("div", { class: "acts" }, btn, undo),
    );
  }

  // Last time: the last session of each kind of workout, from the logged pages, so a gym day starts with the numbers.
  async function renderLastTime() {
    if (!lastBox) return;
    try {
      const sessions = await call("last_time", { each: 1 });
      if (!sessions?.length) { lastBox.hidden = true; return; }
      const order = { push: 0, pull: 1, legs: 2, lower: 3 };
      sessions.sort((a, b) => (order[a.workout] ?? 9) - (order[b.workout] ?? 9) || (a.happened_at < b.happened_at ? 1 : -1));
      lastBox.replaceChildren(el("h2", {}, "Last time"), ...sessions.map((s) => el("details", { class: "last" },
        el("summary", {}, el("span", { class: "k" }, s.workout), ` · ${fmtDay(s.happened_at)}`),
        el("ul", {}, (s.exercises ?? []).map((e) => el("li", {}, el("span", { class: "k" }, e.name), e.setting ? el("span", { class: "meta" }, ` (${e.setting})`) : null, ": ",
          (e.sets ?? []).map((x) => `${x.weight}×${x.reps}${x.assisted ? "A" : ""}`).join(", ") || "warm-ups only"))),
      )));
      lastBox.hidden = false;
    } catch { lastBox.hidden = true; }
  }
};

// The Thinker's sitting (push brief 15a, November 26, 2026): one line a week, the one move in one area that lifts the
// most in the others, with the date it was first said.  At the top of Today the line alone, the rest a tap away; on
// Thoughts the whole of it: the chain, the why with what it drew on, the two runners-up, the page from the shelf.
function renderSitting(box, s, full) {
  if (!box) return;
  if (!s || !s.line) { box.hidden = !full; if (full) box.replaceChildren(el("p", { class: "empty" }, "No sitting yet.  The Thinker sits Wednesday night; Next asks for one now.")); return; }
  const said = s.first_said ?? s.said_at;
  const areas = Array.isArray(s.areas) && s.areas.length ? el("p", { class: "meta areas-touched" }, s.areas.join(" · ")) : null;
  const more = el("div", { class: "sitting-more" },
    s.chain ? el("p", { class: "chain" }, el("span", { class: "k" }, "the chain: "), s.chain) : null,
    s.why ? el("p", { class: "why" }, el("span", { class: "k" }, "why: "), s.why) : null,
    Array.isArray(s.runners_up) && s.runners_up.length ? el("div", { class: "runners" }, el("p", { class: "k" }, "runners-up"), el("ol", {}, s.runners_up.map((r) => el("li", {}, r.line, r.why ? el("span", { class: "meta" }, ` ${r.why}`) : null)))) : null,
    s.cue ? el("p", { class: "meta" }, el("span", { class: "k" }, "the page from the shelf: "), s.page?.title ? `${s.page.title}.  ` : "", s.cue) : null,
  );
  box.replaceChildren(
    full ? null : el("p", { class: "k small" }, "the sitting"),
    el("p", { class: "line" }, s.line),
    el("p", { class: "meta" }, `first said ${said ? fmtStamp(said) : ""}${s.by_hand ? ", asked by hand" : ""}`),
    areas,
    full ? more : el("details", { class: "bubble" }, el("summary", {}, el("span", { class: "count" }, "the why")), more),
  );
  box.hidden = false;
}

// Record: what happened, in the person's words, with the time it happened first.  The recent log below, paged.
pages.record = async function () {
  const form = $("record-form"), said = $("said"), when = $("happened"), sheet = $("attach-sheet"), plus = $("plus");
  let timeTouched = false, attachment = null, thumbUrl = null, picking = 0, reads = 0, holds = 0, timer = null;
  const READING = "Reading the file…";
  // Record waits while a file is still being read and while a send is on its way.
  const hold = (on) => { holds += on ? 1 : -1; $("record-btn").disabled = holds > 0; };
  let windowDays = 2, shown = 20;
  const worldFacts = (rec) => rec.facts.filter((f) => !isNote(f) && f.kind === "world").sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1));
  const setNow = () => { when.value = inputValue(); timeTouched = false; when.classList.remove("touched"); };
  setNow();
  when.addEventListener("input", () => { timeTouched = true; when.classList.add("touched"); });
  said.addEventListener("input", () => { said.style.height = "auto"; said.style.height = `${Math.min(said.scrollHeight, 320)}px`; });

  // the plus: Camera (straight to the camera) and Attachments (the phone's own menu: the library, a photo, any file)
  const openSheet = (open) => { sheet.hidden = !open; plus.setAttribute("aria-expanded", String(open)); plus.textContent = open ? "×" : "+"; };
  plus.addEventListener("click", () => openSheet(sheet.hidden));
  document.addEventListener("click", (e) => { if (!sheet.hidden && !sheet.contains(e.target) && e.target !== plus) openSheet(false); });
  for (const id of ["pick-camera", "pick-files"]) {
    $(id).addEventListener("change", async (e) => {
      const input = e.target, f = input.files?.[0]; openSheet(false);
      if (!f) return;
      // A file the page cannot carry is told so, never dropped in silence.
      const turn = ++picking;
      hold(true); reads++; status(READING, "", 0);
      try {
        const packed = await pack(f);
        if (turn !== picking) return;
        attachment = packed; showAttachment(f);
        if (!timeTouched && f.lastModified && Date.now() - f.lastModified > 5 * 60000) { when.value = inputValue(new Date(f.lastModified)); timeTouched = true; when.classList.add("touched"); }
      } catch (err) {
        if (turn === picking) status(String(err?.message ?? err), "warn", 0);
      } finally {
        hold(false); input.value = "";
        if (--reads === 0 && $("status").textContent === READING) $("status").hidden = true;
      }
    });
  }
  $("clear-attachment").addEventListener("click", dropAttachment);
  // The picture shown is the file itself, drawn by the browser; nothing is redrawn or re-encoded.
  function showAttachment(f) {
    const img = $("thumb");
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = null;
    if (attachment.media_type.startsWith("image/")) {
      thumbUrl = URL.createObjectURL(f);
      img.onerror = () => { img.hidden = true; };   // a kind of picture this browser cannot draw is attached all the same, whole
      img.src = thumbUrl; img.hidden = false;
    } else { img.hidden = true; img.removeAttribute("src"); }
    $("attached-name").textContent = `${f.name || "file"} · ${megabytes(f.size)} · whole`;
    // a picture may be a page of the log (push brief 15c): the box shows for pictures, ticked when the words say so
    const pageBox = $("is-page");
    if (pageBox) { pageBox.parentElement.hidden = !attachment.media_type.startsWith("image/"); pageBox.checked = attachment.media_type.startsWith("image/") && /\b(log|page|push|pull|legs?|lower|upper|workout|lift)/i.test(said.value); }
    $("attached").hidden = false;
  }
  function dropAttachment() {
    attachment = null; picking++;
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = null;
    const img = $("thumb"); img.hidden = true; img.removeAttribute("src");
    $("attached").hidden = true;
    const pageBox = $("is-page"); if (pageBox) { pageBox.checked = false; pageBox.parentElement.hidden = true; }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const words = said.value.trim();
    if (!words && !attachment) { said.focus(); return; }
    // entry: this entry's own id, in the fact's pocket.  One entry is one fact, however often it has to be sent.
    const args = { said: words || (attachment?.media_type.startsWith("image/") ? "(picture)" : `(${attachment?.title ?? "file"})`), shape: { via: "when_fire_web", entry: entryId() } };
    if (timeTouched && when.value) args.happened_at = new Date(when.value).toISOString();
    if (attachment) args.attachment = attachment;
    if (attachment && $("is-page")?.checked) args.shape.page = "workout";   // the reader wakes on it; the table lands under Pages to check
    const btn = $("record-btn"); hold(true); plus.disabled = true; btn.textContent = attachment ? "Sending the file…" : "Recording…";
    const clear = () => { said.value = ""; said.style.height = ""; dropAttachment(); setNow(); };
    let kept = null, recorded = false, pulse = null;
    try {
      kept = await pending.add({ args }, true);   // on the phone before it travels: a send cut short loses nothing
      if (kept) pulse = pending.beat(kept.key);
      const out = await call("record", args);
      if (!out?.fact) throw new Error("the record gave no receipt");
      recorded = true;
      if (kept) await pending.remove(kept);
      status(args.shape.page ? "Recorded.  The reader is on the page; its table lands under Pages to check in a minute." : args.happened_at ? `Recorded, as of ${fmtStamp(args.happened_at)}.` : "Recorded.", "ok", args.shape.page ? 8000 : 3600);
      clear();
      await renderLog(true);
      if (args.shape.page) { setTimeout(() => renderPages(), 45000); setTimeout(() => renderPages(), 120000); }
    } catch (err) {
      const key = needKey(err);
      if (recorded) { /* the fact is on the record; what stumbled came after it */ }
      else if (kept) {
        pending.stays(kept, err);
        status(key ? "The key was refused.  Paste the address again; this entry is kept on this phone and goes then." : `Not sent (${why(err)}).  ${KEPT}`, "warn", key ? 0 : 8000);
        clear();
        renderPending();
        if (err instanceof TypeError) later(FRESH);   // no answer at all: once it can no longer be landing, the page tries again by itself
      } else if (key) { status("The key was refused.  Paste the address again.", "warn", 0); }
      else { status(`Not sent (${why(err)}), and this phone could not keep it.  Your words${attachment ? " and the file" : ""} are still here: tap Record again when the connection is back.`, "warn", 0); }
    } finally { clearInterval(pulse); hold(false); plus.disabled = false; btn.textContent = "Record"; }
  });

  // What is kept goes when the page opens, when the connection or the page comes back, and by hand.
  function later(ms) { if (!timer) timer = setTimeout(() => { timer = null; sendKept(false); }, ms + 1000); }
  async function sendKept(byHand) {
    if (pending.busy) { if (byHand) status("Sending what is kept…", "", 4000); return; }
    const n = await pending.flush(byHand).catch(() => 0);
    if (byHand) status(n ? `${n} sent.` : "Still waiting.", n ? "ok" : "warn");
    else if (n) status(`${n} kept entr${n === 1 ? "y" : "ies"} sent.`, "ok");
    renderPending(); if (n) renderLog(true);
    // What was held back because its last send may still be landing is tried again once that time has passed.
    if (pending.wait) later(pending.wait);
  }
  $("retry").addEventListener("click", () => sendKept(true));
  window.addEventListener("online", () => sendKept(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sendKept(false); });
  $("log-more").addEventListener("click", async () => { shown += 20; await renderLog(false, true); });
  renderPending();
  await renderLog();
  renderPages();
  sendKept(false);

  // Pages to check (push brief 15c): each unchecked page, its picture on top and the reader's table under it, every
  // cell his to change; Record writes the workout citing the page and marks the reading checked.  A set is one box,
  // "weight x reps", with A for assisted and w for a warm-up ("180x12w", "90x8A"); ? stays ? until he fixes it.
  async function renderPages() {
    const box = $("pages"), list = $("pages-list"); if (!box || !list) return;
    let pages = [];
    try { pages = await call("pages", { status: "unchecked", limit: 10 }); } catch { return; }
    if (!Array.isArray(pages) || pages.length === 0) { box.hidden = true; list.replaceChildren(); return; }
    list.replaceChildren(...pages.map((p) => pageCard(p)));
    box.hidden = false;
  }
  const setText = (s) => `${s.weight ?? "?"}x${s.reps ?? "?"}${s.assisted ? "A" : ""}${s.warm_up ? "w" : ""}`;
  const parseSet = (txt, note) => {
    const m = String(txt).trim().match(/^([^\sx×]+)\s*[x×]\s*([^\sAaWw]+)\s*([AaWw]*)$/);
    if (!m) return null;
    const flags = (m[3] ?? "").toLowerCase();
    return { weight: m[1], reps: m[2], assisted: flags.includes("a"), warm_up: flags.includes("w"), note: note ?? null };
  };
  function pageCard(p) {
    const t = p.reading?.table ?? {};
    const rows = [];
    const table = el("table", { class: "page-table" },
      el("thead", {}, el("tr", {}, el("th", {}, "exercise"), el("th", {}, "setting"), el("th", {}, "sets"))),
      el("tbody", {}));
    const addRow = (e = { name: "", setting: null, sets: [] }) => {
      const name = el("input", { type: "text", value: e.name ?? "", class: e.name === "?" ? "unread" : "", placeholder: "exercise" });
      const setting = el("input", { type: "text", value: e.setting ?? "", class: "narrow", placeholder: "–" });
      const sets = el("div", { class: "sets" });
      const addSet = (s = { weight: "?", reps: "?", assisted: false, warm_up: false, note: null }) => {
        const inp = el("input", { type: "text", value: setText(s), class: `set${/\?/.test(setText(s)) ? " unread" : ""}`, title: s.note ?? "", "data-note": s.note ?? "" });
        sets.append(inp);
      };
      (e.sets ?? []).forEach(addSet);
      const plus = el("button", { type: "button", class: "link tiny", onclick: () => { addSet({ weight: "", reps: "", assisted: false, warm_up: false, note: null }); sets.lastElementChild.focus(); } }, "+ set");
      const tr = el("tr", {}, el("td", {}, name, e.unclear ? el("p", { class: "unclear" }, e.unclear) : null), el("td", {}, setting), el("td", {}, sets, plus));
      table.querySelector("tbody").append(tr);
      rows.push({ name, setting, sets });
    };
    (t.exercises ?? []).forEach(addRow);
    const workout = el("input", { type: "text", value: t.workout ?? "", placeholder: "push, pull, legs…", class: "narrow" });
    const date = el("input", { type: "date", value: /^\d{4}-\d{2}-\d{2}$/.test(t.date ?? "") ? t.date : (p.happened_at ? dayKey(p.happened_at) : todayKey()) });
    const time = el("input", { type: "time", value: t.time ?? "" });
    const btn = el("button", { type: "button", class: "primary small" }, "Record");
    const addEx = el("button", { type: "button", class: "ghost small", onclick: () => addRow() }, "+ exercise");
    const card = el("article", { class: "page", "data-source": p.source },
      p.url ? el("a", { href: p.url, target: "_blank", rel: "noopener" }, el("img", { src: p.url, class: "page-picture", alt: p.file ?? p.title ?? "the page" })) : el("p", { class: "meta" }, "the picture could not be fetched; the table stands"),
      el("p", { class: "meta" }, `${p.file ?? p.title ?? "page"} · recorded ${p.happened_at ? fmtStamp(p.happened_at) : fmtStamp(p.captured_at)} · read ${p.reading?.read_at ? relative(p.reading.read_at) : ""}`),
      el("div", { class: "row page-head" }, el("label", { class: "field" }, el("span", {}, "workout"), workout), el("label", { class: "field" }, el("span", {}, "date"), date), el("label", { class: "field" }, el("span", {}, "time"), time)),
      table, addEx,
      t.unclear ? el("p", { class: "unclear page-unclear" }, t.unclear) : null,
      el("div", { class: "row" }, btn),
    );
    btn.addEventListener("click", async () => {
      const exercises = [];
      for (const r of rows) {
        const nm = r.name.value.trim(); if (!nm) continue;
        const sets = [...r.sets.querySelectorAll("input")].map((i) => i.value.trim()).filter(Boolean).map((v, i2, arr) => parseSet(v, r.sets.querySelectorAll("input")[i2]?.dataset.note || null) ?? { weight: v, reps: "?", assisted: false, warm_up: i2 === 0 && arr.length > 1, note: "could not be read as weight x reps" });
        exercises.push({ name: nm, setting: r.setting.value.trim() || null, sets, unclear: null });
      }
      if (!exercises.length) { status("Nothing to record: the table has no exercise.", "warn", 5000); return; }
      const open = exercises.flatMap((e) => e.sets).filter((s) => /\?/.test(`${s.weight}${s.reps}`)).length + exercises.filter((e) => e.name === "?").length;
      if (open && !confirm(`${open} cell${open === 1 ? "" : "s"} still read ?.  Record as it stands?`)) return;
      btn.disabled = true;
      try {
        const out = await call("record_page", { source: p.source, table: { workout: workout.value.trim() || null, date: date.value || null, time: time.value || null, exercises, unclear: t.unclear ?? null } });
        status(`Recorded: ${short(out?.said ?? "the workout", 80)}`, "ok", 6000);
        await renderPages();
        await renderLog(true);
      } catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else status(`Not recorded: ${why(err)}`, "warn", 8000);
        btn.disabled = false;
      }
    });
    return card;
  }

  async function renderPending() {
    try {
      const l = (await pending.list()).filter((it) => !pending.inFlight.has(it.key)); const box = $("pending");
      box.hidden = l.length === 0;
      $("pending-list").replaceChildren(...l.map((it) => el("li", {}, el("span", { class: "words" }, it.args.said), el("span", { class: "meta" },
        `written ${relative(it.queued_at)}${it.args.attachment ? `, with ${it.args.attachment.title || "a file"}` : ""}${it.where === "database" && (it.tries ?? 0) >= 3 ? `.  The door refused it ${it.tries} times (${it.refused}); Send now tries again.` : ""}`))));
    } catch { /* the list is a courtesy; the entries are kept either way */ }
  }
  // The log shows the newest facts first, twenty at a time; Earlier shows twenty more, widening the window as needed.
  async function renderLog(fresh = false, more = false) {
    const log = $("log"), empty = $("log-empty"), moreBtn = $("log-more");
    try {
      let rec = await readRecord({ since: hoursAgo(24 * windowDays), limit: "all", notes: false, fires: false }, fresh);
      let facts = worldFacts(rec);
      // widen the window until there are enough facts to show, or the window is a season
      while (facts.length < shown + 1 && windowDays < 120) { windowDays = Math.min(windowDays * 3, 120); rec = await readRecord({ since: hoursAgo(24 * windowDays), limit: "all", notes: false, fires: false }); facts = worldFacts(rec); }
      const me = String(rec.person?.name ?? "").toLowerCase();
      const corrected = new Set(facts.map((f) => f.corrects).filter(Boolean));
      const page = facts.slice(0, shown);
      const groups = new Map();
      for (const f of page) { const k = dayKey(f.happened_at); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
      log.replaceChildren(...[...groups.entries()].map(([k, fs]) => el("section", { class: "day" },
        el("h3", {}, k === todayKey() ? "Today" : fmtDayLong(fs[0].happened_at)),
        el("ol", { class: "facts" }, fs.map((f) => el("li", { class: `fact${corrected.has(f.id) ? " corrected" : ""}${f.said_by !== me ? " other" : ""}` },
          el("div", { class: "line" },
            el("time", { datetime: f.happened_at }, fmtTime(f.happened_at)),
            el("span", { class: "words" }, f.said),
          ),
          el("div", { class: "meta" },
            f.said_by !== me ? el("span", { class: "badge" }, f.said_by) : null,
            f.cites ? el("span", { class: "badge" }, "attachment") : null,
            f.corrects ? el("span", { class: "badge" }, "corrects an earlier entry") : null,
            corrected.has(f.id) ? el("span", { class: "badge" }, "corrected later") : null,
            minutesApart(f.recorded_at, f.happened_at) > 15 ? el("span", { class: "footnote" }, `entered ${fmtStamp(f.recorded_at)}`) : null,
          ),
        ))),
      )));
      empty.hidden = facts.length > 0;
      moreBtn.hidden = facts.length <= shown;
      if (more) moreBtn.scrollIntoView({ block: "nearest" });
    } catch (err) {
      if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000);
    }
  }
};

// An attachment travels as base64 and whole: the file as it is, under its own name.  It is never shrunk, cropped or
// re-encoded to fit.  (Until November 24, 2026 a picture was redrawn here at 1600 on its long side, as a JPEG, and the
// redrawing was what the record kept.)  The road has carried a file of twenty-five megabytes and given it back byte
// for byte; this page takes up to sixteen.  A larger original stays where it is: it goes in Drive whole, and the
// record points at it there.
const WHOLE_MAX = 16000000;
// What kind of file it is, by the ending of its name, when the browser does not say.
const KINDS = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff",
  m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime",
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv", md: "text/markdown", json: "application/json", zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
async function pack(file) {
  const name = file.name || "That file";
  if (file.size > WHOLE_MAX) throw new Error(`${name} is ${megabytes(file.size)}.  This page carries a file whole, up to ${megabytes(WHOLE_MAX)}, and does not shrink one to fit, so it was not attached.  A larger original goes in Drive whole, and the record points at it there.`);
  if (!file.size) throw new Error(`${name} is empty, so it was not attached.`);
  const base64 = await toBase64(file);
  if (!base64) throw new Error(`${name} could not be read, so it was not attached.`);
  return { base64, media_type: file.type || KINDS[String(file.name).toLowerCase().split(".").pop()] || "application/octet-stream", title: file.name };
}
// The push service's public key arrives as url-safe base64; the browser wants bytes.
function keyBytes(b64) { const s = (b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(s); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
const toBase64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(file); });

// Whens: what he said he would do, as it stands, with the latest reading beside each.
pages.whens = async function () {
  const list = $("whens"), toggle = $("show-ended");
  toggle.checked = store.get("wf_show_ended") === "1";
  toggle.addEventListener("change", () => { store.set("wf_show_ended", toggle.checked ? "1" : "0"); render(true); });
  await render();
  async function render(fresh = false) {
    try {
      const rec = await readRecord({ since: hoursAgo(72), limit: "all", fires: true, include_inactive: toggle.checked }, fresh);
      const snaps = new Map((rec.snapshots ?? []).filter((s) => s.subject_kind === "when").map((s) => [s.subject_id, s]));
      const whens = rec.whens.filter(isPersonSide);
      const byId = new Map(whens.map((w) => [w.id, w]));
      const superseded = new Set(whens.map((w) => w.supersedes).filter(Boolean));
      const live = whens.filter((w) => !superseded.has(w.id) && (!w.until_at || new Date(w.until_at) > new Date()));
      const ended = whens.filter((w) => !live.includes(w));
      // bundles: a when whose id is another's bundle is the head
      const heads = new Map();
      for (const w of live) { const h = w.bundle && byId.get(w.bundle) ? w.bundle : w.id; if (!heads.has(h)) heads.set(h, []); if (h !== w.id) heads.get(h).push(w); }
      const today = todayKey();
      const readings = (rec.fires ?? []).filter((x) => ["met", "silence"].includes(x.kind));
      const latest = (w) => readings.filter((x) => x.when_id === w.id).sort((a, b) => (a.fired_at < b.fired_at ? 1 : -1))[0];
      const card = (w, inBundle = false) => {
        const r = latest(w); const s = snaps.get(w.id);
        const tally = s?.shape?.tally;
        return el("article", { class: `when${inBundle ? " in-bundle" : ""}${w.kind === "tick" ? " crisp" : ""}` },
          el("p", { class: "words" }, w.words),
          w.condition_words ? el("p", { class: "cond" }, el("span", { class: "k" }, "when "), w.condition_words) : null,
          w.until_words ? el("p", { class: "cond" }, el("span", { class: "k" }, "until "), w.until_words) : null,
          w.reasons?.length ? el("p", { class: "because" }, el("span", { class: "k" }, "because "), w.reasons.map((x) => x.words ?? x.name).join("; ")) : null,
          r ? el("p", { class: `reading ${r.kind}` }, r.kind === "met" ? (r.context?.late ? "met, late" : "met") : "silence",
            el("span", { class: "meta" }, ` · ${r.context?.moment === today ? "today" : fmtDay(r.fired_at)}${r.context?.reason ? `: ${r.context.reason}` : ""}`)) : el("p", { class: "reading open" }, "open", el("span", { class: "meta" }, " · no reading yet")),
          s ? el("details", { class: "stands" }, el("summary", {}, `what stands${tally?.facts ? ` · ${tally.facts} fact${tally.facts === 1 ? "" : "s"}${tally.amount ? `, ${tally.amount}` : ""}` : ""} · as of ${fmtStamp(s.watermark)}`), el("p", {}, s.says)) : null,
          w.after?.length ? el("p", { class: "meta" }, `comes after ${w.after.length} earlier wording${w.after.length === 1 ? "" : "s"}`) : null,
          el("p", { class: "meta" }, `asserted ${fmtStamp(w.asserted_at)} by ${w.asserted_by}`),
        );
      };
      list.replaceChildren(...[...heads.entries()].map(([h, members]) => {
        const head = byId.get(h);
        if (!members.length) return card(head);
        return el("section", { class: "bundle" }, card(head), el("div", { class: "members" }, members.map((m) => card(m, true))));
      }));
      if (toggle.checked && ended.length) list.append(el("section", { class: "ended" }, el("h3", {}, "Ended and earlier wordings"), ended.sort((a, b) => (a.asserted_at < b.asserted_at ? 1 : -1)).map((w) => card(w))));
      $("whens-empty").hidden = live.length > 0;
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
  }
};

// Thoughts.  Since the push of November 26, 2026 (Stacy, 8:08 PM: "The thinker and the questions are all noise to
// me"): the Thinker's sitting, whole, with Next; the eight areas scored for consistency, each with its parts and the
// row for his own number; and the week and the days as the Reconciler wrote them, folded.  The Thinker's old notes
// and the questions stay on the record and off the page.
const AREAS = ["emotional", "physical", "social", "spiritual", "intellectual", "occupational", "financial", "environmental"];
pages.thoughts = async function () {
  const list = $("thoughts"), areasBox = $("areas-list"), sitBox = $("sitting-body"), next = $("next-sitting");
  for (const d of document.querySelectorAll("details.fold")) {
    d.open = store.get(`wf_fold_${d.dataset.fold}`) === "1";
    d.addEventListener("toggle", () => store.set(`wf_fold_${d.dataset.fold}`, d.open ? "1" : null));
  }
  let current = null;   // the sitting shown, by id
  next.addEventListener("click", async () => {
    next.disabled = true; next.textContent = "Sitting…";
    try {
      await call("sit", { why: "asked from the phone, Next on Thoughts" });
      status("The Thinker is sitting.  Its line lands here within a few minutes.", "ok", 8000);
      const began = Date.now();
      const poll = setInterval(async () => {
        try { const t = await call("today"); if (t.sitting?.id && t.sitting.id !== current) { clearInterval(poll); current = t.sitting.id; renderSitting(sitBox, t.sitting, true); next.disabled = false; next.textContent = "Next"; status("The sitting is here.", "ok", 4000); } }
        catch { /* the next tick looks again */ }
        if (Date.now() - began > 6 * 60000) { clearInterval(poll); next.disabled = false; next.textContent = "Next"; status("No line yet; it may be held back by the day's cap.  Look again later.", "warn", 8000); }
      }, 10000);
    } catch (err) {
      if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0); else status(`Not asked: ${why(err)}`, "warn", 8000);
      next.disabled = false; next.textContent = "Next";
    }
  });
  await render();
  async function render(fresh = false) {
    try {
      const t = await call("today");
      current = t.sitting?.id ?? null;
      renderSitting(sitBox, t.sitting, true);
      renderAreas(t.areas ?? []);
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
    try {
      const rec = await readRecord({ since: hoursAgo(24 * 8), limit: "all", notes: false, fires: false }, fresh);
      const items = (rec.snapshots ?? []).filter((s) => s.subject_kind === "week" || s.subject_kind === "day").sort((a, b) => (a.written_at < b.written_at ? 1 : -1));
      const week = items.find((it) => it.subject_kind === "week");
      if (week) { items.splice(items.indexOf(week), 1); items.unshift(week); }
      const gist = $("gist-week"); if (gist) gist.textContent = week ? `week to ${fmtDay(week.shape?.to ? `${week.shape.to}T12:00:00` : week.watermark)}` : `${items.length} day${items.length === 1 ? "" : "s"}`;
      list.replaceChildren(...items.slice(0, 9).map((s) => {
        const [main, ...rest] = s.says.split("\n\n");
        const title = s.subject_kind === "week" ? `The week, to ${fmtDayLong(s.shape?.to ? `${s.shape.to}T12:00:00` : s.watermark)}` : `The day, ${fmtDayLong(s.shape?.day ? `${s.shape.day}T12:00:00` : s.watermark)}`;
        return el("article", { class: `thought ${s.subject_kind}` }, el("h3", {}, title), el("p", {}, main), rest.length ? el("p", { class: "footnote" }, rest.join("  ")) : null,
          el("p", { class: "meta" }, `as of ${fmtStamp(s.watermark)} · written ${relative(s.written_at)} by ${s.written_by}`));
      }));
      $("thoughts-empty").hidden = items.length > 0;
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
  }
  // The eight areas (push brief 15b).  A number is met parts over read parts, in hundredths; no parts read is no
  // reading, not zero.  Under each, the fourteen-day trend as bars, the parts of the day with their readings, and the
  // row of 1 to 10 for his own number, which goes on the record as a fact in his words.
  function renderAreas(areas) {
    const byName = new Map(areas.map((a) => [a.area, a]));
    areasBox.replaceChildren(...AREAS.map((name) => {
      const a = byName.get(name);
      const score = a?.week?.score ?? null;
      const head = el("div", { class: "area-head" },
        el("span", { class: "area-name" }, name[0].toUpperCase() + name.slice(1)),
        el("span", { class: `area-score${score === null ? " none" : ""}` }, score === null ? "–" : String(score)),
      );
      const line = a ? el("p", { class: "meta" }, `today ${a.today?.read ? `${a.today.met} of ${a.today.read}` : "nothing read yet"} · seven days ${a.week?.read ? `${a.week.met} of ${a.week.read}` : "–"} · twenty-eight days ${a.month?.read ? `${a.month.met} of ${a.month.read}` : "–"}${a.own ? ` · yours ${a.own.number}` : ""}`)
        : el("p", { class: "meta" }, "no parts on the record yet");
      const trend = a?.days?.length ? el("div", { class: "trend", title: "fourteen days" }, a.days.map((d) => el("span", { class: `bar${d.read ? "" : " empty"}`, style: `height:${d.read ? Math.max(8, Math.round(100 * d.met / d.read)) : 4}%`, title: `${d.day}: ${d.read ? `${d.met} of ${d.read}` : "nothing read"}` }))) : null;
      const parts = a?.parts?.length ? el("details", { class: "bubble" }, el("summary", {}, el("span", { class: "count" }, `${a.parts.length} part${a.parts.length === 1 ? "" : "s"} today`)), el("ul", {}, a.parts.map((p) => el("li", { class: p.reading }, `${p.words} · ${p.reading}`)))) : null;
      const own = el("div", { class: "own" }, el("span", { class: "k small" }, "yours"), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const b = el("button", { type: "button", class: `tiny${a?.own?.number === n ? " on" : ""}` }, String(n));
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await call("record", { said: `${name[0].toUpperCase() + name.slice(1)}: ${n} of 10, how it feels`, shape: { via: "when_fire_web", kind: "area_number", area: name, number: n } });
            status(`${name}, ${n} of 10, on the record.`, "ok", 4000);
            own.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
          } catch (err) { if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0); else status(`Not recorded: ${why(err)}`, "warn", 6000); }
          b.disabled = false;
        });
        return b;
      }));
      return el("article", { class: `area${a ? "" : " quiet"}` }, head, line, trend, parts, own);
    }));
  }
};

// Questions: what the Thinker wants to know, and the outbox (the morning page lands here until a phat client).
pages.questions = async function () {
  await render();
  async function render(fresh = false) {
    try {
      const rec = await readRecord({ since: hoursAgo(24), limit: "20", fires: false }, fresh);
      const qs = rec.questions ?? [], tasks = rec.tasks ?? [];
      const mine = qs.filter((q) => q.ask_of === "person"), theirs = qs.filter((q) => q.ask_of !== "person");
      $("asked").replaceChildren(...mine.map((q) => {
        const box = el("textarea", { rows: 2, placeholder: "In your words…" });
        const btn = el("button", { class: "primary small", type: "button" }, "Answer");
        btn.addEventListener("click", async () => {
          const words = box.value.trim(); if (!words) return;
          btn.disabled = true;
          try { await call("answer", { question: q.id, words }); status("Answered; it is on the record.", "ok"); await render(true); }
          catch (e) { status(`Not answered: ${e.message}`, "warn", 6000); btn.disabled = false; }
        });
        const yes = q.shape?.proposal ? el("button", { class: "primary small", type: "button" }, "Yes, put it on") : null;
        if (yes) yes.addEventListener("click", async () => {
          yes.disabled = true; btn.disabled = true;
          try { const r = await call("answer", { question: q.id, words: "yes" }); status(r?.when ? "On your side, in place of the old wording." : "Answered; it is on the record.", "ok", 6000); await render(true); }
          catch (e) { status(`Not answered: ${e.message}`, "warn", 6000); yes.disabled = false; btn.disabled = false; }
        });
        return el("article", { class: `question${q.shape?.proposal ? " proposal" : ""}` }, el("p", { class: "words" }, q.words), el("p", { class: "meta" }, `asked ${fmtStamp(q.asked_at)} by ${q.asked_by}`), box, el("div", { class: "row" }, yes, btn));
      }));
      $("asked-empty").hidden = mine.length > 0;
      $("looking").replaceChildren(...theirs.map((q) => el("article", { class: "question quiet" }, el("p", { class: "words" }, q.words), el("p", { class: "meta" }, `the Thinker is asking the ${q.ask_of} · since ${fmtStamp(q.asked_at)}`))));
      $("looking-empty").hidden = theirs.length > 0;
      $("tasks").replaceChildren(...tasks.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((t) => {
        const btn = el("button", { class: "small", type: "button" }, "Done");
        btn.addEventListener("click", async () => { btn.disabled = true; try { await call("did", { task: t.id, kind: "done", words: "marked done in the web client" }); await render(true); } catch (e) { status(e.message, "warn"); btn.disabled = false; } });
        return el("article", { class: `task ${t.kind}` }, el("h3", {}, t.kind.replace(/_/g, " ")), el("pre", { class: "page" }, t.words), el("p", { class: "meta" }, `${fmtStamp(t.created_at)} by ${t.created_by}`), btn);
      }));
      $("tasks-empty").hidden = tasks.length > 0;
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
  }
};

// Settings: the key, the door, turbo, the system's health.  Each part folds (Stacy, November 26: "The top part of
// settings is huge ... a lot of scrolling"); closed, a part shows its gist on one line, and the phone keeps which
// parts he left open.
pages.settings = async function () {
  for (const d of document.querySelectorAll("details.fold")) {
    d.open = store.get(`wf_fold_${d.dataset.fold}`) === "1";
    d.addEventListener("toggle", () => store.set(`wf_fold_${d.dataset.fold}`, d.open ? "1" : null));
  }
  const gist = (name, text) => { const g = $(`gist-${name}`); if (g) g.textContent = text; };
  $("door").value = doorName(); $("schema").value = schema();
  $("door-form").addEventListener("submit", (e) => { e.preventDefault(); store.set("wf_door", $("door").value.trim() || "when-fire-mcp"); store.set("wf_schema", $("schema").value.trim() || null); cache = null; status("Saved.", "ok"); renderHealth(); });
  $("forget-key").addEventListener("click", async () => { store.set("wf_token", null); cache = null; await keyCache.drop(); location.reload(); });

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  // Notifications: the phone subscribes with the browser's push service, the subscription goes to the record (the
  // subscribe verb), and the notify handler sends each step of the routine to it at its minute.
  const nState = $("notify-state"), nOn = $("notify-on"), nOff = $("notify-off");
  const canPush = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  nOn.addEventListener("click", async () => {
    nOn.disabled = true;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { await showNotify(); return; }
      const reg = await navigator.serviceWorker.ready;
      const { public_key } = await call("subscribe", {});
      if (!public_key) throw new Error("the record has no push key");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(public_key) });
      const j = sub.toJSON();
      await call("subscribe", { endpoint: j.endpoint, keys: j.keys, agent: navigator.userAgent.slice(0, 200) });
      await keyCache.put();
      status("Notifications on.  The three check-ins reach this phone.", "ok", 6000);
    } catch (err) { if (!needKey(err)) status(`Not turned on: ${err.message}`, "warn", 8000); }
    finally { nOn.disabled = false; await showNotify(); }
  });
  nOff.addEventListener("click", async () => {
    nOff.disabled = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await call("subscribe", { endpoint: sub.endpoint, drop: true }).catch(() => {}); await sub.unsubscribe(); }
      await keyCache.drop();
      status("Notifications off.", "ok");
    } catch (err) { status(`Not turned off: ${err.message}`, "warn", 8000); }
    finally { nOff.disabled = false; await showNotify(); }
  });
  await showNotify();
  async function showNotify() {
    nOn.hidden = true; nOff.hidden = true;
    if (!canPush) { nState.textContent = standalone || !/iPhone|iPad/.test(navigator.userAgent) ? "This browser cannot receive notifications." : "Add the app to the home screen first; Safari only delivers notifications to an installed app."; return; }
    if (Notification.permission === "denied") { nState.textContent = "Blocked.  Allow notifications for this site in the phone's settings, then come back."; return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { nState.textContent = `On, on this phone.`; nOff.hidden = false; await keyCache.put(); }
      else { nState.textContent = "Off."; nOn.hidden = false; }
    } catch (err) { nState.textContent = `Could not tell: ${err.message}`; }
    gist("notify", nState.textContent.replace(/\.$/, "").toLowerCase());
  }
  $("turbo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hours = Number($("turbo-hours").value || 0);
    try { const r = await call("turbo", { hours }); status(hours > 0 ? `Watching closely until ${fmtStamp(r.turbo_until)}.` : "Turbo off.", "ok", 6000); } catch (err) { if (!needKey(err)) status(err.message, "warn", 6000); }
  });
  // Caps: the day's spend against each actor's cap, and a box per actor the person sets; the default row covers an
  // actor with no row of its own.  Stacy, October 26: the daily limit is his, in Settings, one per actor; a change
  // is one named row at a time, never a wildcard.
  await renderCaps();
  async function renderCaps() {
    const list = $("caps"); if (!list) return;
    try {
      const c = await call("caps");
      const row = (actor, label, spent, value, applies) => {
        const input = el("input", { type: "text", inputmode: "decimal", value: value ?? "", placeholder: applies ?? "" });
        const save = el("button", { class: "small", type: "button" }, "Set");
        save.addEventListener("click", async () => {
          const v = input.value.trim(); if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(v)) { status("A number of dollars, like 0.90.", "warn", 4000); return; }
          save.disabled = true;
          try { await call("caps", { set: { actor, daily_dollars: v } }); status(`${label}: ${v} a day.`, "ok"); await renderCaps(); }
          catch (err) { status(`Not set: ${err.message}`, "warn", 6000); save.disabled = false; }
        });
        return el("div", { class: "cap-row" }, el("span", { class: "k" }, label), el("span", { class: "spent" }, spent === null ? "" : `$${Number(spent).toFixed(2)} today`),
          el("span", { class: "meta" }, value ? "cap" : `cap ${applies ?? "none"} (default)`), input, save);
      };
      list.replaceChildren(
        ...(c.actors ?? []).map((a) => row(a.actor, a.actor, a.spent_today, a.daily_dollars, a.applies)),
        row("*", "default", null, c.default?.daily_dollars, c.default?.applies),
        el("p", { class: "meta" }, `All actors today: $${Number(c.spent_today ?? 0).toFixed(2)}.`));
      gist("caps", `$${Number(c.spent_today ?? 0).toFixed(2)} today`);
    } catch (err) { if (!needKey(err)) list.replaceChildren(el("p", { class: "meta" }, `The caps did not answer: ${err.message}`)); }
  }
  $("key-masked").textContent = token() ? `${token().slice(0, 4)}…${token().slice(-4)}` : "none";
  $("address").textContent = `${BASE}${doorName()}`;
  gist("door", doorName() + (schema() ? ` · ${schema()}` : ""));
  if (!standalone && /iPhone|iPad/.test(navigator.userAgent)) $("install-hint").hidden = false;
  await renderHealth();
  // Five lines, and the errors as a count with the last one; the list opens on a tap.
  async function renderHealth() {
    try {
      const h = await call("health");
      const errs = (h.errors_24h ?? []).slice().sort((a, b) => (String(a.at) < String(b.at) ? -1 : 1));
      const last = errs[errs.length - 1];
      const heartbeatErrs = Number(h.heartbeat_errors_24h ?? 0);
      const errLine = el("details", { class: "errs" },
        el("summary", {}, `${errs.length} actor, ${heartbeatErrs} heartbeat${last ? ` · last ${relative(last.at)}: ${short(String(last.said ?? ""), 80)}` : ""}`),
        errs.length ? el("ul", {}, ...errs.slice().reverse().map((e) => el("li", {}, `${fmtStamp(e.at)} · ${e.by}: ${e.said ?? JSON.stringify(e)}`))) : el("p", { class: "meta" }, "None."));
      $("health").replaceChildren(...[
        ["heartbeat", h.heartbeat_last ? `${relative(h.heartbeat_last)} (${fmtTime(h.heartbeat_last)})` : "never"],
        ["last fact from the world", h.last_world_fact ? fmtStamp(h.last_world_fact) : "none"],
        ["in 24 h", `${h.fires_24h ?? 0} fires · ${h.notes_24h ?? 0} notes`],
        ["spent today", `$${Number(h.spent_today_usd ?? 0).toFixed(2)}`],
        ["open", `${h.open_questions ?? 0} questions · ${h.open_tasks ?? 0} tasks`],
        ["errors in 24 h", errLine],
      ].map(([k, v]) => el("div", { class: "row" }, el("dt", {}, k), el("dd", {}, v))));
      gist("health", `heartbeat ${h.heartbeat_last ? relative(h.heartbeat_last) : "never"} · ${errs.length + heartbeatErrs} errors · $${Number(h.spent_today_usd ?? 0).toFixed(2)}`);
    } catch (err) { if (!needKey(err)) { $("health").replaceChildren(el("div", { class: "row" }, el("dt", {}, "health"), el("dd", {}, `did not answer: ${err.message}`))); gist("health", "did not answer"); } }
  }
};

// ---------------------------------------------------------------------------------------------
// Start.
// ---------------------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  nav(); keyForm();
  const d = $("today-date"); if (d) d.textContent = fmtDayLong(new Date().toISOString());
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
    if (token() && "PushManager" in window) navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => { if (sub) keyCache.put(); }).catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.recorded && document.body.dataset.page === "today") location.reload(); });
  }
  const page = pages[document.body.dataset.page];
  if (page && token()) {
    try { await page(); } catch (err) { if (!needKey(err)) status(err.message, "warn", 8000); }
    // What is kept on this phone goes from any page, not only from Record (which sends its own).
    if (document.body.dataset.page !== "record") pending.flush().then((n) => { if (n) status(`${n} kept entr${n === 1 ? "y" : "ies"} sent.`, "ok", 6000); }).catch(() => {});
  }
  else if (page) { keyForm(); }
});
