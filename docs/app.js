// when fire web client, phase 1: read the ledger, record facts.
// Talks to the core through the when fire connector, the same five verbs any AI uses.
// The key rides on the page's address (?token=...), exactly as it does on the connector's.

const SYSTEM_SOURCES = /^(judge|reconciler|listener:)/;
// The system's and the AI's own notes are never the person's doing.
const isSystem = (k) => SYSTEM_SOURCES.test(k.source) || k.source === "ai";
// A reconciliation, whoever wrote it, belongs to "last night", not to today's ledger.
const isReconciliation = (k) => typeof k.shape?.kind === "string" && k.shape.kind.startsWith("reconciliation");

// --- the address and its key --------------------------------------------------
const CONNECTOR = document.querySelector('meta[name="when-fire-connector"]').content;
const params = new URLSearchParams(location.search);
let token = params.get("token");
if (token) {
  localStorage.setItem("wf_token", token);
  history.replaceState(null, "", location.pathname); // the key stays in storage, not in the address bar
} else {
  token = localStorage.getItem("wf_token");
}

// --- the one door --------------------------------------------------------------
async function call(name, args = {}) {
  const r = await fetch(`${CONNECTOR}?token=${encodeURIComponent(token ?? "")}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  if (r.status === 401) throw new Error("The key on this address was refused.  Open the app from its full address.");
  const j = await r.json();
  if (j?.error) throw new Error(j.error.message);
  const text = j?.result?.content?.[0]?.text ?? "";
  if (j?.result?.isError) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

// --- time ----------------------------------------------------------------------
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayBefore = (d) => new Date(d.getTime() - 24 * 3600 * 1000);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const localInputValue = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromInput = (v) => (v ? new Date(v).toISOString() : undefined);

// --- state ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let record = { whens: [], facts: [], fires: [] };
let whenById = new Map();
let corrected = new Set(); // facts a later fact corrects; shown nowhere
const name = () => (localStorage.getItem("wf_name") || "stacy").trim();

function status(text, ms = 3200) {
  const el = $("status");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(status.t);
  status.t = setTimeout(() => { el.hidden = true; }, ms);
}

// --- load ----------------------------------------------------------------------
async function load() {
  const since = dayBefore(startOfDay()).toISOString();
  record = await call("read", { since, limit: "all" });
  whenById = new Map(record.whens.map((w) => [w.id, w]));
  corrected = new Set(record.facts.map((k) => k.corrects).filter(Boolean));
  render();
}

function wordsFor(whenId) {
  const w = whenById.get(whenId);
  return w ? w.words : "a when no longer live";
}

// --- render --------------------------------------------------------------------
function render() {
  $("today-date").textContent = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  renderLedger();
  renderLive();
  renderRecordForm();
  renderNight();
}

function renderLedger() {
  const today = startOfDay().getTime();
  const lines = [];
  for (const x of record.fires) {
    if (new Date(x.fired_at).getTime() < today) continue;
    lines.push({ t: x.fired_at, kind: x.context?.kind ?? "fire", text: wordsFor(x.when_id), why: x.context?.reason ?? "" , who: `fired by ${x.fired_by}` });
  }
  for (const k of record.facts) {
    if (isReconciliation(k) || corrected.has(k.id)) continue; // last night's, or superseded by a correction
    if (new Date(k.recorded_at).getTime() < today) continue;
    const happened = new Date(k.happened_at);
    const earlier = happened.getTime() < today;             // happened before today, recorded today
    const late = !earlier && Math.abs(new Date(k.recorded_at) - happened) > 5 * 60 * 1000;
    const notes = [k.source];
    if (earlier) notes.push(`happened ${happened.toLocaleDateString([], { weekday: "short" })} ${fmtTime(k.happened_at)}`);
    else if (late) notes.push(`recorded ${fmtTime(k.recorded_at)}`);
    if (k.about) notes.push(`about: ${wordsFor(k.about).split(".")[0]}`);
    lines.push({
      t: earlier ? k.recorded_at : k.happened_at,
      kind: isSystem(k) ? "listener" : "fact",
      text: k.said,
      who: notes.join(", "),
      why: "",
    });
  }
  lines.sort((a, b) => new Date(a.t) - new Date(b.t));
  const ol = $("ledger");
  ol.replaceChildren(...lines.map((l) => {
    const li = document.createElement("li");
    li.innerHTML = `<time></time><span class="mark"></span><div class="entry"><p></p><p class="who"></p><p class="why"></p></div>`;
    li.querySelector("time").textContent = fmtTime(l.t);
    li.querySelector(".mark").classList.add(l.kind);
    li.querySelector(".entry p").textContent = l.text;
    li.querySelector(".who").textContent = l.who;
    const why = li.querySelector(".why");
    if (l.why) why.textContent = l.why; else why.remove();
    return li;
  }));
  $("ledger-empty").hidden = lines.length > 0;
}

function renderLive() {
  const whens = record.whens;
  const tops = whens.filter((w) => !w.bound_to);
  const childrenOf = (id) => whens.filter((w) => w.bound_to === id);
  const today = startOfDay().getTime();
  const doneToday = (id) => record.facts.filter((k) =>
    k.about === id && !isSystem(k) && !isReconciliation(k) && !corrected.has(k.id) && new Date(k.happened_at).getTime() >= today);

  const host = $("bundles");
  host.replaceChildren();
  const tpl = $("when-row");

  const row = (w) => {
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.dataset.id = w.id;
    if (w.affirmed_by === "ai") li.classList.add("ai");
    li.querySelector(".when-words").textContent = w.words;
    const cond = li.querySelector(".when-cond");
    cond.textContent = w.condition_words ?? "";
    const done = doneToday(w.id);
    if (done.length) {
      const p = document.createElement("p");
      p.className = "when-done";
      p.textContent = done.length === 1 ? `recorded ${fmtTime(done[0].happened_at)}: ${done[0].said}` : `recorded ${done.length} times today`;
      li.querySelector(".when-main").appendChild(p);
    }
    const btn = li.querySelector("button.did");
    const form = li.querySelector(".did-form");
    if (w.affirmed_by === "ai") { btn.remove(); form.remove(); return li; }
    btn.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) { form.elements.when.value = localInputValue(); form.elements.said.focus(); }
    });
    form.querySelector(".cancel").addEventListener("click", () => { form.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submit = form.querySelector("button.primary");
      submit.disabled = true;
      try {
        await call("record", {
          said: form.elements.said.value.trim() || "Did it.",
          source: name(),
          about: w.id,
          happened_at: fromInput(form.elements.when.value),
          shape: { via: "when_fire_web", round: w.shape?.round ?? undefined },
        });
        status("Recorded.");
        await load();
      } catch (err) {
        status(`Not recorded: ${err.message}`, 6000);
        submit.disabled = false;
      }
    });
    return li;
  };

  const group = (title, untilWords, members) => {
    const div = document.createElement("div");
    div.className = "bundle";
    if (title) { const p = document.createElement("p"); p.className = "bundle-words"; p.textContent = title; div.appendChild(p); }
    if (untilWords) { const p = document.createElement("p"); p.className = "bundle-until"; p.textContent = `until ${untilWords}`; div.appendChild(p); }
    const ul = document.createElement("ul");
    ul.className = "whens";
    for (const w of members) ul.appendChild(row(w));
    div.appendChild(ul);
    return div;
  };

  const standaloneAi = [];
  for (const top of tops) {
    const kids = childrenOf(top.id);
    if (kids.length) {
      const mine = kids.filter((w) => w.affirmed_by !== "ai");
      const theirs = kids.filter((w) => w.affirmed_by === "ai");
      host.appendChild(group(top.words, top.until_words, [...mine, ...theirs]));
    } else if (top.affirmed_by === "ai") {
      standaloneAi.push(top);
    } else {
      host.appendChild(group(null, top.until_words, [top]));
    }
  }
  if (standaloneAi.length) host.appendChild(group("The system's own", null, standaloneAi));
  $("live-empty").hidden = whens.length > 0;
}

function renderRecordForm() {
  const sel = $("record-about");
  const keep = sel.value;
  sel.replaceChildren(new Option("Nothing in particular", ""));
  for (const w of record.whens) {
    if (w.affirmed_by === "ai") continue;
    sel.appendChild(new Option(w.words.length > 60 ? w.words.slice(0, 57) + "…" : w.words, w.id));
  }
  sel.value = keep;
  if (!$("record-when").value) $("record-when").value = localInputValue();
}

function renderNight() {
  const recon = record.facts.filter((k) => isReconciliation(k) && k.shape?.for && !corrected.has(k.id));
  const host = $("reconciliation");
  host.replaceChildren();
  if (!recon.length) { $("night-empty").hidden = false; return; }
  $("night-empty").hidden = true;
  const latest = recon.map((k) => k.shape.for).sort().at(-1);
  const night = recon.filter((k) => k.shape.for === latest);
  const summary = night.find((k) => k.shape.kind === "reconciliation_summary");
  const items = night.filter((k) => k.shape.kind === "reconciliation");
  const heading = document.createElement("p");
  heading.className = "recon-date";
  heading.textContent = new Date(`${latest}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    + (summary ? "" : ", written by hand");
  host.appendChild(heading);
  if (summary) {
    const p = document.createElement("p");
    p.className = "recon-summary";
    p.textContent = summary.said.replace(/^Reconciled, \S+: \d+ items?\.\s*/, "");
    host.appendChild(p);
  }
  for (const k of items) {
    const p = document.createElement("p");
    p.className = "recon-item";
    const about = document.createElement("span");
    about.className = "about";
    about.textContent = k.about ? wordsFor(k.about).split(".")[0] : "";
    p.appendChild(about);
    p.appendChild(document.createTextNode(k.said.replace(/^Reconciled, \S+\.\s*/, "")));
    host.appendChild(p);
  }
  const h = summary?.shape?.health;
  if (h && typeof h === "object") {
    const p = document.createElement("p");
    p.className = "recon-health";
    p.textContent = `Heartbeat: ${h.heartbeat_runs_24h ?? "?"} beats in 24 hours, ${h.heartbeat_failures_24h ?? "?"} failed.  Last look by the watch: ${h.last_presented_at ? fmtTime(h.last_presented_at) : "unknown"}.`;
    host.appendChild(p);
  }
}

// --- the free record form --------------------------------------------------------
$("record-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button.primary");
  btn.disabled = true;
  try {
    await call("record", {
      said: $("record-said").value.trim(),
      source: name(),
      about: $("record-about").value || undefined,
      happened_at: fromInput($("record-when").value),
      shape: { via: "when_fire_web" },
    });
    $("record-said").value = "";
    $("record-when").value = localInputValue();
    status("Recorded.");
    await load();
  } catch (err) {
    status(`Not recorded: ${err.message}`, 6000);
  } finally {
    btn.disabled = false;
  }
});

// --- name, install hint, service worker ---------------------------------------------
$("name").value = name();
$("name").addEventListener("change", () => localStorage.setItem("wf_name", $("name").value.trim() || "stacy"));

const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
if (!standalone && /iPhone|iPad/.test(navigator.userAgent)) $("install-hint").hidden = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

$("today-date").textContent = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

// --- the key, when the address did not carry it (an installed app opens at its root) ------------
$("key-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = $("key-input").value.trim();
  const m = raw.match(/token=([A-Za-z0-9]+)/);
  const key = m ? m[1] : raw.replace(/[^A-Za-z0-9]/g, "");
  if (!key) return;
  localStorage.setItem("wf_token", key);
  token = key;
  $("key-form").hidden = true;
  load().catch((err) => status(err.message, 60000));
});

// --- go ----------------------------------------------------------------------------
if (!token) {
  $("key-form").hidden = false;
  $("key-input").focus();
} else {
  load().catch((err) => {
    status(err.message, 60000);
    if (/refused/.test(err.message)) { localStorage.removeItem("wf_token"); $("key-form").hidden = false; }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && token) load().catch(() => {}); });
}
