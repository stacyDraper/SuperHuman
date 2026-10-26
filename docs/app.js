// when fire, the web client.  Sunday, October 25, 2026; the Today page and notifications, Monday, October 26.
// Several pages, one navigation (a bar at the top of every page), one door: every page talks to the connector with the same verbs any AI uses.
// The key rides on the page's address once (?token=...), then lives in this browser's storage.
// Pages: today, record (index), whens, thoughts, questions, settings.  The body's data-page says which one this is.

"use strict";

// ---------------------------------------------------------------------------------------------
// The door.
// ---------------------------------------------------------------------------------------------
const BASE = "https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/";
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage may be shut */ } },
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
  const refused = /refused|no key/.test(String(err?.message ?? err));
  if (refused) { if (/refused/.test(String(err?.message))) store.set("wf_token", null); form.hidden = false; $("main")?.classList.add("locked"); }
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

// Things the person wrote that did not reach the record yet (no network, a refused key): kept and retried.
const PENDING = "wf_pending";
const pending = {
  list: () => { try { return JSON.parse(store.get(PENDING, "[]")); } catch { return []; } },
  save: (l) => store.set(PENDING, JSON.stringify(l)),
  add(item) { const l = this.list(); l.push({ ...item, queued_at: new Date().toISOString() }); this.save(l); },
  async flush() {
    const l = this.list(); if (!l.length) return 0;
    const left = []; let sent = 0;
    for (const it of l) {
      try { await call("record", it.args); sent++; } catch (e) { if (needKey(e)) { left.push(it); break; } left.push(it); }
    }
    this.save(left); return sent;
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
  if ("Notification" in window && Notification.permission !== "granted") hint.hidden = false;
  await render();
  async function render() {
    try {
      const t = await call("today");
      const whens = t.whens ?? [];
      const byRoutine = new Map();
      for (const w of whens) { const k = w.bundle ?? w.id; if (!byRoutine.has(k)) byRoutine.set(k, { name: w.routine, steps: [] }); byRoutine.get(k).steps.push(w); }
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
      const args = { said: w.words, about: w.id, shape: { via: "when_fire_web", done: true, routine: w.routine_name ?? null } };
      try { await call("record", args); status(`Recorded, ${fmtTime(new Date().toISOString())}.`, "ok"); await render(); }
      catch (err) {
        if (needKey(err)) status("The key was refused.  Paste the address again.", "warn", 0);
        else { pending.add({ args }); status("Kept on this phone; it goes to the record when the connection is back.", "warn", 6000); btn.disabled = false; }
      }
    });
    return el("article", { class: `step${done ? " done" : ""}${w.falls_today ? "" : " off-day"}`, "data-when": w.id },
      el("span", { class: "clock" }, w.at ?? "—"),
      el("div", {}, el("p", { class: "words" }, w.words), state),
      btn,
    );
  }
};

// Record: what happened, in the person's words, with the time it happened first.  The recent log below, paged.
pages.record = async function () {
  const form = $("record-form"), said = $("said"), when = $("happened"), sheet = $("attach-sheet"), plus = $("plus");
  let timeTouched = false, attachment = null;
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
      const f = e.target.files?.[0]; openSheet(false);
      if (!f) return;
      attachment = await pack(f);
      showAttachment(f);
      if (!timeTouched && f.lastModified && Date.now() - f.lastModified > 5 * 60000) { when.value = inputValue(new Date(f.lastModified)); timeTouched = true; when.classList.add("touched"); }
      e.target.value = "";
    });
  }
  $("clear-attachment").addEventListener("click", () => { attachment = null; $("attached").hidden = true; $("thumb").hidden = true; });
  function showAttachment(f) {
    const img = $("thumb");
    if (attachment.media_type.startsWith("image/")) { img.src = `data:${attachment.media_type};base64,${attachment.base64}`; img.hidden = false; } else img.hidden = true;
    $("attached-name").textContent = attachment.media_type.startsWith("image/") ? "" : `${f.name} (${Math.round(f.size / 1024)} kB)`;
    $("attached").hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const words = said.value.trim();
    if (!words && !attachment) { said.focus(); return; }
    const args = { said: words || (attachment?.media_type.startsWith("image/") ? "(picture)" : `(${attachment?.title ?? "file"})`), shape: { via: "when_fire_web" } };
    if (timeTouched && when.value) args.happened_at = new Date(when.value).toISOString();
    if (attachment) args.attachment = attachment;
    const btn = $("record-btn"); btn.disabled = true; btn.textContent = "Recording…";
    try {
      await call("record", args);
      status(args.happened_at ? `Recorded, as of ${fmtStamp(args.happened_at)}.` : "Recorded.", "ok");
      said.value = ""; said.style.height = ""; attachment = null; $("attached").hidden = true; setNow();
      await renderLog(true);
    } catch (err) {
      if (needKey(err)) { status("The key was refused.  Paste the address again.", "warn", 0); }
      else {
        pending.add({ args });
        status("Kept on this phone; it goes to the record when the connection is back.", "warn", 6000);
        said.value = ""; said.style.height = ""; attachment = null; $("attached").hidden = true; setNow();
        renderPending();
      }
    } finally { btn.disabled = false; btn.textContent = "Record"; }
  });

  $("retry").addEventListener("click", async () => { const n = await pending.flush(); status(n ? `${n} sent.` : "Still waiting.", n ? "ok" : "warn"); renderPending(); if (n) renderLog(true); });
  $("log-more").addEventListener("click", async () => { shown += 20; await renderLog(false, true); });
  renderPending();
  const flushed = await pending.flush().catch(() => 0);
  if (flushed) { status(`${flushed} kept entr${flushed === 1 ? "y" : "ies"} sent.`, "ok"); renderPending(); }
  await renderLog();

  function renderPending() {
    const l = pending.list(); const box = $("pending");
    box.hidden = l.length === 0;
    $("pending-list").replaceChildren(...l.map((it) => el("li", {}, el("span", { class: "words" }, it.args.said), el("span", { class: "meta" }, `written ${relative(it.queued_at)}`))));
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

// An attachment travels as base64: a picture is shrunk on the phone first (long side 1600, JPEG); anything else as it is, up to 8 MB.
async function pack(file) {
  if (file.type.startsWith("image/")) return await shrink(file);
  if (file.size > 8 * 1024 * 1024) throw new Error("that file is over 8 MB");
  return { base64: await toBase64(file), media_type: file.type || "application/octet-stream", title: file.name };
}
// A picture is shrunk on the phone before it travels: long side 1600, JPEG.
async function shrink(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) { const b64 = await toBase64(file); return { base64: b64, media_type: file.type || "image/jpeg", title: file.name }; }
  const max = 1600, scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas"); c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
  c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { base64: url.split(",")[1], media_type: "image/jpeg", title: file.name };
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
        return el("article", { class: "question" }, el("p", { class: "words" }, q.words), el("p", { class: "meta" }, `asked ${fmtStamp(q.asked_at)} by ${q.asked_by}`), box, btn);
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
  if (page && token()) { try { await page(); } catch (err) { if (!needKey(err)) status(err.message, "warn", 8000); } }
  else if (page) { keyForm(); }
});
