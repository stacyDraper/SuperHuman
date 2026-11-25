// when fire, the web client.  Sunday, October 25, 2026; the Today page and notifications, Monday, October 26.
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
const cameFor = params.get("when");                                             // a notification tapped: the step to show
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

// Today: the routine as it stands for the day, read from the record (the today verb), one card per routine, its steps in
// clock order.  Done records a fact about the step in the step's own words; the Watch reads met from it.  Nothing here
// is hard coded: a routine is a bundle of whens on the person's side, marked routine in its shape.
pages.today = async function () {
  const box = $("routines"), empty = $("today-empty"), hint = $("notify-hint");
  let day = null;   // the record's local day, from the today verb; the planned time of a step is built on it
  if ("Notification" in window && Notification.permission !== "granted") hint.hidden = false;
  $("day-note").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ta = $("day-note-words"), words = ta.value.trim(); if (!words) { ta.focus(); return; }
    const args = { said: words, shape: { via: "when_fire_web", note: "day" } };
    try { await call("record", args); ta.value = ""; status("Noted.  If it changes a step, a question comes back for your yes.", "ok", 6000); }
    catch (err) {
      if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
      else { pending.add({ args }); ta.value = ""; status("Kept on this phone; it goes to the record when the connection is back.", "warn", 6000); }
    }
  });
  await render();
  async function render() {
    try {
      const t = await call("today");
      day = t.day ?? null;
      const whens = t.whens ?? [];
      const byRoutine = new Map();
      for (const w of whens) { const k = w.bundle ?? w.id; if (!byRoutine.has(k)) byRoutine.set(k, { name: w.routine_name ?? w.routine, steps: [] }); byRoutine.get(k).steps.push(w); }
      box.replaceChildren(...[...byRoutine.values()].map((r) => el("section", { class: "routine" },
        byRoutine.size > 1 || r.name ? el("h2", {}, r.name ?? "the routine") : null,
        r.steps.map((w) => step(w)),
      )));
      empty.hidden = whens.length > 0;
      if (cameFor) { const target = box.querySelector(`[data-when="${cameFor}"]`); if (target) { target.classList.add("flash"); target.scrollIntoView({ block: "center" }); } }
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
  }
  function step(w) {
    const done = (w.facts_today ?? []).length;
    const last = done ? w.facts_today[w.facts_today.length - 1] : null;
    const state = w.reading === "met" ? el("p", { class: "state met" }, `met${last ? `, ${fmtTime(last.happened_at)}` : ""}`)
      : w.reading === "silence" ? el("p", { class: "state silence" }, "silence")
      : done ? el("p", { class: "state met" }, `done, ${fmtTime(last.happened_at)}${done > 1 ? ` (${done} times)` : ""}`)
      : el("p", { class: "state" }, w.falls_today ? (w.condition_words ?? "open") : "not today");
    const btn = el("button", { class: `small${done ? " ghost" : " primary"}`, type: "button" }, done ? "Again" : "Done");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      // Done means it was done according to plan (Stacy, October 27, 2026: "done means it was done according to plan or
      // assertion").  A first Done after the step's clock is recorded at the planned time; a Done before it, or Again,
      // at the tap.
      const planned = !done && w.at && day ? new Date(`${day}T${w.at}:00`) : null;
      const asPlanned = !!planned && planned.getTime() < Date.now();
      const args = { said: w.words, about: w.id, shape: { via: "when_fire_web", done: true, routine: w.routine_name ?? null, ...(asPlanned ? { as_planned: true } : {}) } };
      if (asPlanned) args.happened_at = planned.toISOString();
      try { await call("record", args); status(asPlanned ? `Recorded, as planned at ${fmtTime(planned.toISOString())}.` : `Recorded, ${fmtTime(new Date().toISOString())}.`, "ok"); await render(); }
      catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else { pending.add({ args }); status("Kept on this phone; it goes to the record when the connection is back.", "warn", 6000); btn.disabled = false; }
      }
    });
    const noteBtn = el("button", { class: "small ghost note", type: "button" }, "note");
    const noteBox = el("textarea", { rows: 2, placeholder: "In your words: a slip, a change, anything…" });
    const noteSend = el("button", { class: "small", type: "button" }, "Note");
    const noteForm = el("div", { class: "step-note", hidden: true }, noteBox, el("div", { class: "row" }, noteSend));
    noteBtn.addEventListener("click", () => { noteForm.hidden = !noteForm.hidden; if (!noteForm.hidden) noteBox.focus(); });
    noteSend.addEventListener("click", async () => {
      const words = noteBox.value.trim(); if (!words) { noteBox.focus(); return; }
      noteSend.disabled = true;
      const args = { said: words, about: w.id, shape: { via: "when_fire_web", note: "step", routine: w.routine_name ?? null } };
      try { await call("record", args); noteBox.value = ""; noteForm.hidden = true; status("Noted.  If it changes the step, a question comes back for your yes.", "ok", 6000); }
      catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else { pending.add({ args }); noteBox.value = ""; noteForm.hidden = true; status("Kept on this phone; it goes to the record when the connection is back.", "warn", 6000); }
      } finally { noteSend.disabled = false; }
    });
    return el("article", { class: `step${done ? " done" : ""}${w.falls_today ? "" : " off-day"}`, "data-when": w.id },
      el("span", { class: "clock" }, w.at ?? "—"),
      el("div", {}, el("p", { class: "words" }, w.words), state),
      el("div", { class: "acts" }, btn, noteBtn),
      noteForm,
    );
  }
};

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
  $("now").addEventListener("click", setNow);
  said.addEventListener("input", () => { said.style.height = "auto"; said.style.height = `${Math.min(said.scrollHeight, 320)}px`; });

  // the plus: camera, photos, files
  const openSheet = (open) => { sheet.hidden = !open; plus.setAttribute("aria-expanded", String(open)); plus.textContent = open ? "×" : "+"; };
  plus.addEventListener("click", () => openSheet(sheet.hidden));
  document.addEventListener("click", (e) => { if (!sheet.hidden && !sheet.contains(e.target) && e.target !== plus) openSheet(false); });
  for (const id of ["pick-camera", "pick-photos", "pick-files"]) {
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
    $("attached").hidden = false;
  }
  function dropAttachment() {
    attachment = null; picking++;
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = null;
    const img = $("thumb"); img.hidden = true; img.removeAttribute("src");
    $("attached").hidden = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const words = said.value.trim();
    if (!words && !attachment) { said.focus(); return; }
    // entry: this entry's own id, in the fact's pocket.  One entry is one fact, however often it has to be sent.
    const args = { said: words || (attachment?.media_type.startsWith("image/") ? "(picture)" : `(${attachment?.title ?? "file"})`), shape: { via: "when_fire_web", entry: entryId() } };
    if (timeTouched && when.value) args.happened_at = new Date(when.value).toISOString();
    if (attachment) args.attachment = attachment;
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
      status(args.happened_at ? `Recorded, as of ${fmtStamp(args.happened_at)}.` : "Recorded.", "ok");
      clear();
      await renderLog(true);
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
  sendKept(false);

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

// Thoughts: what stands now, written by the Reconciler, and the Thinker's own notes.
pages.thoughts = async function () {
  const list = $("thoughts"), toggle = $("show-notes"), moreBtn = $("thoughts-more");
  let windowDays = 7, shown = 12;
  toggle.checked = store.get("wf_show_notes") === "1";
  toggle.addEventListener("change", () => { store.set("wf_show_notes", toggle.checked ? "1" : "0"); render(true); });
  moreBtn.addEventListener("click", async () => { shown += 12; if (shown > 24) windowDays = Math.min(windowDays * 3, 120); await render(false, true); });
  await render();
  async function render(fresh = false, more = false) {
    try {
      const rec = await readRecord({ since: hoursAgo(24 * windowDays), limit: "all", notes: toggle.checked, fires: false, include_inactive: true }, fresh);
      const byId = new Map(rec.whens.map((w) => [w.id, w]));
      const items = [];
      for (const s of rec.snapshots ?? []) items.push({ at: s.written_at, kind: s.subject_kind, s });
      if (toggle.checked) for (const f of rec.facts.filter((f) => isNote(f) && !/^error:/.test(f.said_by) && ["thinker", "claude", "ai"].includes(f.said_by))) items.push({ at: f.recorded_at, kind: "note", f });
      items.sort((a, b) => (a.at < b.at ? 1 : -1));
      const page = items.slice(0, shown);
      list.replaceChildren(...page.map((it) => {
        if (it.kind === "note") return el("article", { class: "thought note" }, el("h3", {}, `${it.f.said_by}, ${fmtStamp(it.f.recorded_at)}`), el("p", {}, it.f.said));
        const s = it.s;
        const [main, ...rest] = s.says.split("\n\n");
        const title = s.subject_kind === "day" ? `The day, ${fmtDayLong(s.shape?.day ? `${s.shape.day}T12:00:00` : s.watermark)}`
          : s.subject_kind === "episode" ? `Episode, ${fmtStamp(s.watermark)}`
          : s.subject_kind === "when" ? `When: ${firstWords(byId.get(s.subject_id)?.words ?? "(an earlier wording)", 8)}`
          : `${s.subject_kind}`;
        return el("article", { class: `thought ${s.subject_kind}` }, el("h3", {}, title), el("p", {}, main), rest.length ? el("p", { class: "footnote" }, rest.join("  ")) : null,
          el("p", { class: "meta" }, `as of ${fmtStamp(s.watermark)} · written ${relative(s.written_at)} by ${s.written_by}`));
      }));
      $("thoughts-empty").hidden = items.length > 0;
      moreBtn.hidden = items.length <= shown && windowDays >= 120;
      if (more) moreBtn.scrollIntoView({ block: "nearest" });
    } catch (err) { if (!needKey(err)) status(`The record did not answer: ${err.message}`, "warn", 6000); }
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

// Settings: the key, the door, turbo, the system's health.
pages.settings = async function () {
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
      status("Notifications on.  Each step reaches this phone at its minute.", "ok", 6000);
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
  }
  $("turbo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hours = Number($("turbo-hours").value || 0);
    try { const r = await call("turbo", { hours }); status(hours > 0 ? `Watching closely until ${fmtStamp(r.turbo_until)}.` : "Turbo off.", "ok", 6000); } catch (err) { if (!needKey(err)) status(err.message, "warn", 6000); }
  });
  $("key-masked").textContent = token() ? `${token().slice(0, 4)}…${token().slice(-4)}` : "none";
  $("address").textContent = `${BASE}${doorName()}`;
  if (!standalone && /iPhone|iPad/.test(navigator.userAgent)) $("install-hint").hidden = false;
  await renderHealth();
  async function renderHealth() {
    try {
      const h = await call("health");
      $("health").replaceChildren(...[
        ["heartbeat last ran", h.heartbeat_last ? `${fmtStamp(h.heartbeat_last)} (${relative(h.heartbeat_last)})` : "never"],
        ["last fact from the world", h.last_world_fact ? fmtStamp(h.last_world_fact) : "none"],
        ["fires in 24 h", h.fires_24h], ["notes in 24 h", h.notes_24h],
        ["actor errors in 24 h", (h.errors_24h ?? []).length ? (h.errors_24h ?? []).map((e) => e.said ?? JSON.stringify(e)).join("  ") : 0],
        ["heartbeat errors in 24 h", h.heartbeat_errors_24h],
        ["spent today", `$${Number(h.spent_today_usd ?? 0).toFixed(2)}`],
        ["open questions", h.open_questions], ["open tasks", h.open_tasks],
      ].map(([k, v]) => el("div", { class: "row" }, el("dt", {}, k), el("dd", {}, String(v)))));
    } catch (err) { if (!needKey(err)) $("health").replaceChildren(el("div", { class: "row" }, el("dt", {}, "health"), el("dd", {}, `did not answer: ${err.message}`))); }
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
