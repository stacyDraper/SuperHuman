// when fire: the Thinker.  Sunday, October 25, 2026.
// One socket, two speeds, ways as data.
// glance: the bus posts a land fire when a fact from the world lands.  One call: link the fact's concepts, say which
//   whens it counts toward, mark surprise, answer an open question if it does, open a question if one is worth
//   standing, and write a note only when the fact surprises or asks.  Reads any picture the fact cites.
// settle: the Reconciler posts after an episode closes.  A way runs: seats in order, each a model call that sees the
//   transcript so far, then the navigator, who chooses the way forward: a conclusion, a question (a standing thing, asked of the
//   shelf, the record, Health, or the person), a proposition for a calm moment, a commitment (asserted on the Thinker's
//   side), or nothing.  The yes-and way ships first, with an honesty seat; the court is the second way.
// Questions: a standing question is tried before the person is asked.  Most should close without reaching him.

import {
  ask, belted, bridge, concept, conceptList, CREDO, errorNote, factsAsText, firesAsText, json, link, local, model, note, personSide, personWords,
  question, questionEvent, read, run, secretOk, setting, task, tzOf, whensAsText, withSchema, SERVICE_KEY, SUPABASE_URL, Block, cap,
} from "./lib.ts";

// ---------------------------------------------------------------------------------------------
// Ways, as data.  settings.thinker_ways may hold a JSON override with the same shape.
// ---------------------------------------------------------------------------------------------
const WAYS: Record<string, { seats: { name: string; prompt: string }[]; rounds?: boolean }> = {
  "yes-and": {
    seats: [
      { name: "noticer", prompt: "Read the episode against the whens, the snapshots and the open questions.  Name what is worth thinking about, if anything: a pattern across days, a tension between the asserted and the recorded, a gap in what is known, words of the person's that change a when.  If nothing is worth it, say so in one line." },
      { name: "builder", prompt: "Yes, and.  Take the noticer's thread and build on it from the shelf and the record, citing claim ids and fact ids.  Add what the record implies but has not said.  Ask the shelf through the questions you are given answers to; do not invent what the shelf did not say." },
      { name: "gatherer", prompt: "Name what is still unknown that would matter, and where each unknown could be learned: the shelf, the record over more days, Health, or only the person.  Prefer anything but the person." },
      { name: "honesty", prompt: "Separate what the person said (quote or cite it) from what was inferred.  Strike any inference stated as a fact.  Strike any grade, verdict, should, or encouragement.  Leave what survives." },
    ],
  },
  court: {
    rounds: true,
    seats: [
      { name: "facilitator", prompt: "Frame the one question worth arguing from this episode, or say there is none." },
      { name: "proposer", prompt: "Argue the case from the record and the shelf, citing ids." },
      { name: "challenger", prompt: "Challenge it from the record and the shelf, citing ids; catch any story that is the system's and not the person's." },
      { name: "honesty", prompt: "Separate what the person said from what was inferred; strike any grade or verdict." },
    ],
  },
};

const GLANCE_SHAPE = {
  type: "object", additionalProperties: false,
  properties: {
    concepts: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, kind: { type: "string", enum: ["body_part", "movement", "measure", "reason", "person", "place", "goal", "document", "substance", "condition", "other"] } }, required: ["name", "kind"] } },
    whens: { type: "array", description: "the person's whens this fact counts toward: a fact counts toward a when when it does what the when's words name, in whole or in part (a rope session counts toward the rope when; one movement of a round counts toward the round's when)", items: { type: "object", additionalProperties: false, properties: { when: { type: "string", description: "the when's id, copied whole" }, amount: { type: ["number", "null"], description: "what the fact contributes when the when counts a number: calories, reps, minutes, sessions; else null" }, why: { type: "string" } }, required: ["when", "amount", "why"] } },
    read: { type: "string", enum: ["expected", "surprise", "question"] },
    note: { type: ["string", "null"], description: "two or three sentences, only for surprise or question; else null" },
    answers: { type: "array", items: { type: "object", additionalProperties: false, properties: { question: { type: "string" }, words: { type: "string" } }, required: ["question", "words"] }, description: "open questions this fact answers" },
    open: { type: ["string", "null"], description: "a question worth standing, in one sentence, or null" },
    ask_of: { type: "string", enum: ["shelf", "record", "health", "facts", "person"], description: "where to look first for the question opened" },
    watch_closely_hours: { type: ["number", "null"], description: "if this fact calls for turbo (a pain, a first attempt, something that may change within hours), hours to watch closely, at most 6; else null" },
  },
  required: ["concepts", "whens", "read", "note", "answers", "open", "ask_of", "watch_closely_hours"],
};

const NAVIGATOR_SHAPE = {
  type: "object", additionalProperties: false,
  properties: {
    exit: { type: "string", enum: ["conclusion", "question", "proposition", "commitment", "nothing"] },
    words: { type: "string", description: "the exit in the person's register: a conclusion in two or three sentences; a question in one; a proposition for a calm moment in two or three; a commitment as a when's words; empty for nothing" },
    ask_of: { type: "string", enum: ["shelf", "record", "health", "facts", "person"] },
    condition_words: { type: ["string", "null"], description: "for a commitment: when it is due, in words" },
    cites: { type: "array", items: { type: "string" } },
    answered: { type: "array", items: { type: "object", additionalProperties: false, properties: { question: { type: "string" }, words: { type: "string" }, cites: { type: "array", items: { type: "string" } } }, required: ["question", "words", "cites"] }, description: "open questions the way answered" },
    moved: { type: "array", items: { type: "object", additionalProperties: false, properties: { question: { type: "string" }, ask_of: { type: "string", enum: ["shelf", "record", "health", "facts", "person"] }, why: { type: "string" } }, required: ["question", "ask_of", "why"] }, description: "open questions whose next place to look changed" },
    shelf_questions: { type: "array", items: { type: "string" }, description: "up to three questions for the shelf, if the way needs them answered before closing" },
  },
  required: ["exit", "words", "ask_of", "condition_words", "cites", "answered", "moved", "shelf_questions"],
};

const STABLE = CREDO + "\n\n" +
  "You are the Thinker.  You think about the person's record and the shelf (what his documents say).  You do not do, judge, or coach; you notice, connect, and when it is worth it, you say one thing.  " +
  "A question is a standing thing: once opened it stays until the record, the shelf or Health answers it; the person is asked only when nothing else can answer.  " +
  "Prefer silence to a note that adds nothing.  Cite fact, fire and claim ids.";

// Ids come back whole or, now and then, as a prefix; match either way, but only against what was shown.
function pick(id: unknown, rows: any[]): any | undefined {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s) return undefined;
  return rows.find((r) => r.id === s) ?? (s.length >= 8 ? rows.find((r) => String(r.id).startsWith(s)) : undefined);
}

async function picture(sourceId: string): Promise<Block | null> {
  const s = await run(`select media_path, media_type from §.sources where id = $1`, [sourceId]);
  if (!s[0]?.media_path) return null;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sources/${s[0].media_path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return { type: "image", source: { type: "base64", media_type: s[0].media_type ?? "image/jpeg", data: btoa(bin) } };
}

// ---------------------------------------------------------------------------------------------
// glance
// ---------------------------------------------------------------------------------------------
async function glance(owner: string, fireId: string, factId: string): Promise<any> {
  const tz = await tzOf(owner);
  const f = (await run(`select * from §.facts where id = $1`, [factId]))[0];
  if (!f || f.kind !== "world") return { skipped: "not a world fact" };
  const rec = await read(owner, { since: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), limit: "all" });
  const whens = personSide(rec.whens);
  const concepts = await conceptList(owner);
  const today = rec.facts.filter((x: any) => x.id !== f.id);
  const open = rec.questions ?? [];
  const content: Block[] = [];
  if (f.cites) { const img = await picture(f.cites); if (img) content.push(img); }
  content.push({
    type: "text",
    text:
      `${await personWords(owner)}\nLocal time now: ${local(new Date(), tz)} (${tz}).\n\nThe fact that landed:\n${factsAsText([f], tz)}\n\n` +
      `The person's whens:\n${whensAsText(whens, tz)}\n\nOther facts of the last two days:\n${today.length ? factsAsText(today.slice(-30), tz) : "(none)"}\n\n` +
      `Readings of the last two days:\n${rec.fires?.length ? firesAsText(rec.fires.slice(-20), tz) : "(none)"}\n\n` +
      `Open questions:\n${open.map((q: any) => `- question ${q.id} (asked of ${q.ask_of}): ${q.words}`).join("\n") || "(none)"}\n\n` +
      `Concepts already known (kind: name):\n${concepts.map((c) => `${c.kind}: ${c.name}`).join("; ")}\n\n` +
      (f.cites ? "The fact cites the picture above; read the numbers and names off it where the words are short.\n\n" : "") +
      "Link: name the concepts the fact names.  Count: say which of the person's whens it counts toward, by id copied whole, with the amount it contributes.  Read: expected, surprise or question.  Write a note only if this fact surprises against the whens and the days around it, or if it raises a question worth standing.",
  });
  const { data, usage } = await model(owner, "thinker", { stable: STABLE, system: "Return the glance as data.", user: content, maxTokens: 6000, shape: GLANCE_SHAPE, fire: fireId, note: "glance" });

  for (const c of data.concepts ?? []) {
    try { const cid = await concept(owner, "thinker", c.kind, c.name); await link(owner, "thinker", "fact", f.id, "about", cid, "glance"); } catch { /* a bad name is not a stop */ }
  }
  for (const w of data.whens ?? []) {
    const target = pick(w.when, whens);
    if (target) { try { await bridge(owner, "thinker", f.id, target.id, w.amount ?? null, w.why); } catch { /* same */ } }
  }
  for (const a of data.answers ?? []) {
    const q = pick(a.question, open);
    if (q) await questionEvent(q.id, "answered", "thinker", a.words, `fact:${f.id}`);
  }
  let noteId: string | null = null;
  if (data.read !== "expected" && data.note) {
    noteId = await note(owner, "thinker", `Glance: ${data.note}`, { kind: "glance", read: data.read, fact: f.id, cites: [`fact:${f.id}`], cost: usage.dollars, fire: fireId });
  }
  let qId: string | null = null;
  if (data.open) qId = await question(owner, "thinker", data.open, "fact", f.id, data.ask_of ?? "shelf", { from: "glance", fact: f.id });
  if (data.watch_closely_hours && data.watch_closely_hours > 0) {
    const hours = Math.min(Number(data.watch_closely_hours), 6);  // a close watch is a few hours, never a day
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await run(`insert into §.settings (owner, key, value, note) values ($1, 'turbo_until', $2, 'set by the Thinker''s glance') on conflict (owner, key) do update set value = excluded.value, note = excluded.note`, [owner, until]);
  }
  return { read: data.read, note: noteId, question: qId, concepts: data.concepts?.length ?? 0, whens: data.whens?.length ?? 0, usage };
}

// ---------------------------------------------------------------------------------------------
// settle
// ---------------------------------------------------------------------------------------------
async function settle(owner: string, fireId: string | null): Promise<any> {
  const tz = await tzOf(owner);
  const maxTokens = Number((await cap(owner, "thinker", "max_tokens")) ?? 80000);
  const wayName = (await setting(owner, "thinker_way")) ?? "yes-and";
  let ways = WAYS;
  const override = await setting(owner, "thinker_ways");
  if (override) { try { ways = { ...WAYS, ...JSON.parse(override) }; } catch { /* keep the shipped ways */ } }
  const way = ways[wayName] ?? WAYS["yes-and"];

  const rec = await read(owner, { since: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), limit: "all" });
  const whens = personSide(rec.whens);
  const facts = rec.facts.filter((x: any) => x.kind === "world");
  if (facts.length === 0) return { exit: "nothing", why: "no facts" };
  const episode = (await run(`select e.*, s.says from §.episodes e left join §.current_snapshots s on s.subject_kind = 'episode' and s.subject_id = e.id where e.owner = $1 and e.kind = 'episode' order by e.closed_at desc nulls last limit 1`, [owner]))[0];
  const open = rec.questions ?? [];
  const thoughts = await run(`select said, recorded_at, shape from §.facts where owner = $1 and kind = 'note' and said_by = 'thinker' and recorded_at > now() - interval '3 days' order by recorded_at desc limit 8`, [owner]);

  // standing questions are tried on the shelf before the way sits
  const shelfNotes: string[] = [];
  for (const q of open.filter((q: any) => q.ask_of === "shelf").slice(0, 3)) {
    const hits = await ask(owner, q.words, 6);
    shelfNotes.push(`question ${q.id}: ${q.words}\n  shelf says:\n${hits.map((h: any) => `  - claim ${h.claim} (${h.source?.origin ?? ""}, ${h.source?.title ?? ""}): ${h.said}`).join("\n") || "  (nothing bearing on it)"}`);
    await questionEvent(q.id, "tried", "thinker", `asked the shelf, ${hits.length} claims`, null, { ask_of: hits.length ? "shelf" : "record" });
  }

  const ground =
    `${await personWords(owner)}\nLocal time now: ${local(new Date(), tz)} (${tz}).\n\nThe episode just closed: ${episode ? `${local(episode.first_at, tz)} to ${local(episode.last_at, tz)}.  ${episode.says ?? ""}` : "(none on record)"}\n\n` +
    `The person's whens:\n${whensAsText(whens, tz)}\n\nFacts of the last three days:\n${factsAsText(facts.slice(-60), tz)}\n\n` +
    `Readings:\n${rec.fires?.length ? firesAsText(rec.fires.slice(-30), tz) : "(none)"}\n\n` +
    `What stands (snapshots):\n${(rec.snapshots ?? []).map((s: any) => `- ${s.subject_kind} ${s.subject_id ?? ""}: ${s.says}`).join("\n") || "(none)"}\n\n` +
    `Open questions:\n${open.map((q: any) => `- question ${q.id} (asked of ${q.ask_of}, by ${q.asked_by}): ${q.words}`).join("\n") || "(none)"}\n\n` +
    `The shelf, on the standing questions:\n${shelfNotes.join("\n") || "(none asked)"}\n\n` +
    `The Thinker's own recent notes (not evidence):\n${thoughts.map((t: any) => `- ${local(t.recorded_at, tz)}: ${String(t.said).slice(0, 300)}`).join("\n") || "(none)"}`;

  const transcript: { seat: string; said: string }[] = [];
  let spentTokens = 0;
  for (const seat of way.seats) {
    const user = `${ground}\n\n--- transcript so far ---\n${transcript.map((t) => `[${t.seat}] ${t.said}`).join("\n\n") || "(you are first)"}\n\n--- your seat: ${seat.name} ---\n${seat.prompt}`;
    const { text, usage } = await model(owner, "thinker", { stable: STABLE, system: `You sit as the ${seat.name}.  Answer in plain prose, under 200 words, citing ids.`, user, maxTokens: 4000, fire: fireId, note: `settle: ${seat.name}` });
    transcript.push({ seat: seat.name, said: text.trim() });
    spentTokens += usage.input + usage.output;
    if (spentTokens > maxTokens) { transcript.push({ seat: "seatbelt", said: `stopped: ${spentTokens} tokens` }); break; }
    if (seat.name === "noticer" && /nothing (is )?worth/i.test(text) && text.length < 400) break;
  }

  const navigatorUser = `${ground}\n\n--- transcript ---\n${transcript.map((t) => `[${t.seat}] ${t.said}`).join("\n\n")}\n\n--- the way forward ---\nFrom everything in front of you, choose the way forward: the exit.  Nothing is a fine exit.  A question goes to the shelf, the record or Health before the person.  A proposition is for a calm moment, in his register, never a push.  A commitment is the Thinker's own when (what the Thinker will watch for), not the person's.`;
  const { data, usage } = await model(owner, "thinker", { stable: STABLE, system: "You sit as the navigator: you take the readings the seats gave and choose the course.  Return the exit as data.", user: navigatorUser, maxTokens: 4000, shape: NAVIGATOR_SHAPE, fire: fireId, note: "settle: navigator" });

  for (const a of data.answered ?? []) { const q = pick(a.question, open); if (q) await questionEvent(q.id, "answered", "thinker", a.words, (a.cites ?? []).join(",")); }
  for (const m of data.moved ?? []) { const q = pick(m.question, open); if (q) await questionEvent(q.id, "tried", "thinker", m.why, null, { ask_of: m.ask_of }); }

  const spent = await run(`select coalesce(sum(dollars), 0) as d from §.costs where owner = $1 and fire_id is not distinct from $2 and actor = 'thinker' and at > now() - interval '1 hour'`, [owner, fireId]);
  const shape = { kind: "thought", way: wayName, exit: data.exit, cites: data.cites, transcript, cost: Number(spent[0]?.d ?? 0), fire: fireId };
  let written: any = { exit: data.exit };
  if (data.exit === "nothing" || !data.words) return { ...written, transcript: transcript.length };
  if (data.exit === "conclusion") {
    written.note = await note(owner, "thinker", `Conclusion: ${data.words}`, shape);
  } else if (data.exit === "question") {
    written.question = await question(owner, "thinker", data.words, "episode", episode?.id ?? null, data.ask_of ?? "shelf", { from: "settle", cites: data.cites });
    written.note = await note(owner, "thinker", `Question (asked of ${data.ask_of}): ${data.words}`, shape);
    if (data.ask_of === "person") written.task = await task(owner, "thinker", "question", data.words, null, fireId, { question: written.question });
  } else if (data.exit === "proposition") {
    written.note = await note(owner, "thinker", `Proposition, for a calm moment: ${data.words}`, shape);
    written.task = await task(owner, "thinker", "proposition", data.words, null, fireId, { cites: data.cites });
  } else if (data.exit === "commitment") {
    const a = await run(`select §.assert($1, 'thinker', $2::text::jsonb) as v`, [owner, JSON.stringify({ whens: [{ words: data.words, condition_words: data.condition_words, condition: null, shape: { from: "settle", cites: data.cites } }] })]);
    written.when = a[0]?.v;
    written.note = await note(owner, "thinker", `Commitment: ${data.words}`, { ...shape, when: a[0]?.v });
  }
  return { ...written, transcript: transcript.length, usage };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await secretOk(req))) return json({ error: "no" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  return await withSchema(body.schema, async () => {
    let owner = body.owner; let bounds: any = {}; let fire: any = null;
    if (body.fire) {
      fire = (await run(`select f.*, w.bounds from §.fires f join §.whens w on w.id = f.when_id where f.id = $1`, [body.fire]))[0];
      owner ??= fire?.owner; bounds = fire?.bounds ?? {};
    }
    if (!owner) return json({ error: "no owner" }, 400);
    const mode = body.mode ?? bounds.mode ?? "glance";
    try {
      const tz = await tzOf(owner);
      const hours = (await cap(owner, "thinker", "hours")) ?? (await setting(owner, "hours"));
      const hour = Number(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }).replace(/\D/g, ""));
      const [a, b] = (hours ?? "00-24").split("-").map(Number);
      if (mode === "settle" && !(hour >= a && hour < b)) return json({ skipped: `outside hours ${hours}` });
      const stop = await belted(owner, "thinker");
      if (stop) { await errorNote(owner, "thinker", `seatbelt: ${stop}`); return json({ stopped: stop }); }
      if (mode === "glance") {
        const factId = body.fact ?? fire?.by_fact;
        if (!factId) return json({ error: "glance needs a fact" }, 400);
        return json(await glance(owner, body.fire ?? null, factId));
      }
      return json(await settle(owner, body.fire ?? null));
    } catch (e) {
      await errorNote(owner, "thinker", e, { fire: body.fire, mode });
      return json({ error: String(e) }, 500);
    }
  });
});
