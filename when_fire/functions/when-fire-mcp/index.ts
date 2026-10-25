// when fire: the connector.  Sunday, October 25, 2026.
// A Model Context Protocol server, stateless over HTTP.  Any AI client plugs in by address; the lock is a token on the
// address (?token=...) or a bearer header, and the token names the owner.  The web client speaks the same protocol.
// One deploy serves the live schema; ?schema=wf_next points a call at the scratch copy while it is being built.
// Verbs: read, assert, record, propose, raise, ask, learn, answer, did, turbo, health.
// Everything it touches goes through the doors; it holds no state of its own.

import { ask, currentSchema, json, read, record, run, tzOf, vault, withSchema, SUPABASE_URL } from "./lib.ts";

const SERVER_NAME = "when-fire";
const SERVER_VERSION = "1.0.0";

const WHEN_SHAPE = {
  type: "object",
  description: "A when: a thing to do, in the person's words, with the condition that makes it due.",
  properties: {
    words: { type: "string", description: "The thing, as spoken.  Whatever it carries (an amount, a count, a span) lives in the words." },
    condition_words: { type: "string", description: "The when, as spoken.  'In the morning when I can.'  'After a rope session.'" },
    condition: {
      type: ["object", "null"],
      description: "Machine form, or null for worded (the Watch reads it from the words).  Crisp forms: {\"at\":\"06:50\",\"days\":[\"sun\"]} or {\"at\":\"06:50\",\"dates\":[\"2026-11-22\"]} (tz optional); {\"every\":180,\"hours\":\"06-23\"}; {\"after\":\"world\"} or {\"after\":\"<when id>\"}; {\"quiet\":\"world\",\"minutes\":30}; {\"on\":\"<when id>\",\"handler\":\"<name>\"}.",
    },
    until_words: { type: "string", description: "The horizon, as spoken." },
    until_condition: { type: ["object", "null"], description: "The horizon in machine form: {\"date\":\"2026-12-20\"} or {\"at\":\"<iso>\"}." },
    supersedes: { type: "string", description: "Id of the when this one comes after." },
    bundle: { type: "string", description: "Id of the bundle this belongs to (defaults to the bundle in the same call)." },
    bounds: { type: ["object", "null"], description: "For a when with a handler: what the handler may not do." },
    handler: { type: "string", description: "For the system's own whens: the handler the fire is sent to." },
    asserted_by: { type: "string", description: "Who asserts this one, if not the call's asserted_by." },
    shape: { type: ["object", "null"], description: "Anything else worth keeping: sets, maxes, dates, places." },
  },
  required: ["words"],
};

const TOOLS = [
  {
    name: "read",
    description: "Read the record: the active whens (with their reasons), the facts since a time (happened time first), the Watch's readings, what stands now (snapshots), the open questions and the open tasks.  Default window 7 days.  Read before you act.",
    inputSchema: { type: "object", properties: {
      since: { type: "string", description: "ISO time.  Facts, readings and snapshots from here on.  Default 7 days ago." },
      limit: { type: "string", description: "Max facts, or 'all'.  Default 500." },
      bundle: { type: "string", description: "A when id, or words that appear in a bundle, to read one bundle only." },
      include_inactive: { type: "boolean", description: "Also the superseded and ended whens." },
      notes: { type: "boolean", description: "Also the system's own notes (readings, thoughts, errors).  Default false." },
    } },
  },
  {
    name: "assert",
    description: "Put an intention on the record: a bundle and the whens in it, with the reason behind them in the person's words.  An assertion swears nothing; it is something the person thinks can be true and will strive for.  Only after the person has said yes to a read-back of his side; the system's own whens are signed by their actor.  Returns the ids.",
    inputSchema: { type: "object", properties: {
      asserted_by: { type: "string", description: "The signer: the person's name, or an actor's." },
      bundle: { ...WHEN_SHAPE, description: "The bundle itself: words, condition_words, until_words, shape.  Optional." },
      whens: { type: "array", items: WHEN_SHAPE },
      reason: { type: "object", properties: { words: { type: "string", description: "Why, in the person's words." }, name: { type: "string", description: "A short name for the reason, to reuse it later.  'the gift'." } }, required: ["words"], description: "The reason; a concept every when here points at with because." },
    }, required: ["asserted_by", "whens"] },
  },
  {
    name: "record",
    description: "Write a fact: what happened, in the person's words.  Two times: happened_at (when it happened; may be long ago) and recorded_at (now).  Late facts are welcome.  A correction is a new fact pointing at the old one.  A picture (base64) is stored as a source and cited by the fact; the glance reads it.",
    inputSchema: { type: "object", properties: {
      said: { type: "string", description: "The words.  'Did a round.'  'Eight at 120.'  '12 decline push-ups.'" },
      said_by: { type: "string", description: "Who says it: the person's name (default), 'health', a device, an actor." },
      about: { type: "string", description: "Id of the when the person named, if he named one." },
      happened_at: { type: "string", description: "ISO time it happened.  Default now." },
      corrects: { type: "string", description: "Id of the earlier fact this corrects." },
      shape: { type: ["object", "null"] },
      picture: { type: "object", properties: { base64: { type: "string" }, media_type: { type: "string" }, title: { type: "string" } }, description: "A picture to store with the fact." },
    }, required: ["said"] },
  },
  {
    name: "propose",
    description: "A new when that comes after an existing one (supersedes it), when life pushed or the words got clearer.  Nothing is edited; the chain notes that one came after another.  On the person's side only after the person said yes.",
    inputSchema: { type: "object", properties: { asserted_by: { type: "string" }, when: WHEN_SHAPE, reason: { type: "object", properties: { words: { type: "string" }, name: { type: "string" } } } }, required: ["asserted_by", "when"] },
  },
  {
    name: "raise",
    description: "Give a worded when a reading by hand: met (a fact shows it was done; name the fact) or silence (its window passed with nothing recorded).  The Watch does this on its own; use it when you are the one who knows.  A reading describes the record; it is not a verdict on the person.",
    inputSchema: { type: "object", properties: {
      when: { type: "string" }, reading: { type: "string", enum: ["met", "silence"] }, reason: { type: "string" },
      moment: { type: "string", description: "The local date, YYYY-MM-DD.  Default today." }, by_fact: { type: "string" }, late: { type: "boolean" },
    }, required: ["when", "reading", "reason"] },
  },
  {
    name: "ask",
    description: "Ask the shelf: what the person's documents say, as claims, one sentence each, with their sources.  Ask before reasoning about his history, numbers, prescriptions, or what a clinician said.",
    inputSchema: { type: "object", properties: { question: { type: "string" }, limit: { type: "integer" } }, required: ["question"] },
  },
  {
    name: "learn",
    description: "Hand a source to the Librarian: the whole text is kept, read, and written as claims.  A story the person tells is taken once, in his words, as a source.  The same origin and title handed in again adds only what is missing.",
    inputSchema: { type: "object", properties: {
      origin: { type: "string" }, title: { type: "string" }, text: { type: "string" }, happened_at: { type: "string" }, kind: { type: "string", description: "What it is, in a few words." }, shape: { type: ["object", "null"] },
    }, required: ["origin", "text"] },
  },
  {
    name: "answer",
    description: "Answer an open question in the person's words.  The answer is recorded as a fact and the question closes.",
    inputSchema: { type: "object", properties: { question: { type: "string", description: "The question's id." }, words: { type: "string" }, happened_at: { type: "string" } }, required: ["question", "words"] },
  },
  {
    name: "did",
    description: "Mark a task in the outbox done (or dropped), with a line on what was done.",
    inputSchema: { type: "object", properties: { task: { type: "string" }, words: { type: "string" }, kind: { type: "string", enum: ["done", "dropped", "taken", "error"] } }, required: ["task"] },
  },
  {
    name: "turbo",
    description: "Watch closely for a while: the Watch's poll runs every thirty minutes until the time given, then falls back to every three hours on its own.",
    inputSchema: { type: "object", properties: { hours: { type: "number", description: "How many hours from now.  0 turns it off." } }, required: ["hours"] },
  },
  { name: "health", description: "The system's own state: heartbeat, errors, fires, spend today, open questions and tasks.", inputSchema: { type: "object", properties: {} } },
];

const INSTRUCTIONS =
  "when fire is a person's record of what he said he would do (whens) and what happened (facts).  The record is a witness, not a judge: it holds what was asserted and what was recorded, and when nothing was recorded the word is silence.  " +
  "Never write failed, missed, good, bad, success or should about the person, in any note or any field.  Read before you act.  " +
  "An assertion is an intention put on the record; it swears nothing.  The person says yes to a read-back of his side before anything is asserted on it; the system's own whens are signed by their actor.  " +
  "Record what happened in the person's words, with happened_at when it was not now; the time a thing happened leads.  A new when that comes after an old one supersedes it; nothing is edited or deleted.  " +
  "A worded when is read, not computed: the Watch gives it a reading, met or silence, and you may too when you are the one who knows.  " +
  "Beside the record is the shelf: what his documents say, as claims with sources.  Ask it before reasoning about his history, his numbers, his prescriptions, or what a clinician said.";

async function librarian(owner: string, body: Record<string, unknown>) {
  const h = await run(`select address from §.handlers where name = 'librarian' and enabled`);
  const secret = await vault("when_fire_listener_secret");
  const r = await fetch(h[0]?.address ?? `${SUPABASE_URL}/functions/v1/librarian`, {
    method: "POST", headers: { "content-type": "application/json", "x-when-fire-secret": secret },
    body: JSON.stringify({ ...body, owner, schema: currentSchema() }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`librarian: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function callTool(owner: string, name: string, args: Record<string, any>) {
  const p = (await run(`select name from §.people where id = $1`, [owner]))[0]?.name ?? "the person";
  switch (name) {
    case "read": return JSON.stringify(await read(owner, args ?? {}), null, 1);
    case "assert": {
      const out = await run(`select §.assert($1, $2, $3::text::jsonb) as v`, [owner, args.asserted_by ?? p, JSON.stringify({ bundle: args.bundle ?? null, whens: args.whens ?? [], reason: args.reason ?? null })]);
      return JSON.stringify(out[0].v);
    }
    case "record": {
      if (!args.said) throw new Error("record needs said");
      let cites: string | null = null;
      if (args.picture?.base64) {
        const m = await librarian(owner, { verb: "media", media: { base64: args.picture.base64, media_type: args.picture.media_type ?? "image/jpeg", title: args.picture.title ?? null, happened_at: args.happened_at ?? null } });
        cites = m.source;
      }
      const id = await record(owner, args.said, args.said_by ?? p.toLowerCase(), { happened_at: args.happened_at ?? null, about: args.about ?? null, corrects: args.corrects ?? null, cites, shape: args.shape ?? { via: "connector" } });
      return JSON.stringify({ fact: id, cites });
    }
    case "propose": {
      const w = args.when ?? {};
      if (!w.supersedes) throw new Error("propose needs when.supersedes: the id of the when this one comes after");
      const out = await run(`select §.assert($1, $2, $3::text::jsonb) as v`, [owner, args.asserted_by ?? p, JSON.stringify({ whens: [w], reason: args.reason ?? null })]);
      return JSON.stringify(out[0].v);
    }
    case "raise": {
      if (!args.when || !args.reading || !args.reason) throw new Error("raise needs when, reading and reason");
      const tz = await tzOf(owner);
      const moment = args.moment ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const dup = await run(`select kind from §.fires where owner = $1 and when_id = $2 and kind in ('met','silence') and context->>'moment' = $3`, [owner, args.when, moment]);
      if (dup.some((d: any) => d.kind === args.reading)) return JSON.stringify({ already: true });
      const late = args.late ?? (args.reading === "met" && dup.some((d: any) => d.kind === "silence"));
      const out = await run(`select §.raise($1, $2, $3, $4, $5::text::jsonb, $6, null) as v`, [owner, args.when, args.reading, args.raised_by ?? "claude", JSON.stringify({ moment, reason: args.reason, late, via: "connector" }), args.by_fact ?? null]);
      return JSON.stringify({ fire: out[0].v, late });
    }
    case "ask": {
      if (!args.question) throw new Error("ask needs a question");
      return JSON.stringify(await ask(owner, String(args.question), Number(args.limit ?? 12)), null, 1);
    }
    case "learn": {
      const out = await librarian(owner, { verb: "learn", source: { origin: args.origin, title: args.title ?? null, text: args.text, happened_at: args.happened_at ?? null, kind: args.kind ?? null, shape: { ...(args.shape ?? {}), via: "connector" } } });
      return JSON.stringify(out);
    }
    case "answer": {
      if (!args.question || !args.words) throw new Error("answer needs question and words");
      const q = (await run(`select * from §.questions where id = $1 and owner = $2`, [args.question, owner]))[0];
      if (!q) throw new Error("no such question");
      const fid = await record(owner, args.words, p.toLowerCase(), { happened_at: args.happened_at ?? null, about: q.about_kind === "when" ? q.about_id : null, shape: { answers: q.id, via: "connector" } });
      await run(`select §.question_event($1, 'answered', $2, $3, $4, null)`, [q.id, p.toLowerCase(), args.words, `fact:${fid}`]);
      return JSON.stringify({ fact: fid, question: q.id, closed: true });
    }
    case "did": {
      if (!args.task) throw new Error("did needs task");
      const out = await run(`select §.task_event($1, $2, $3, $4, null) as v`, [args.task, args.kind ?? "done", args.by ?? "claude", args.words ?? null]);
      return JSON.stringify({ event: out[0].v });
    }
    case "turbo": {
      const hours = Number(args.hours ?? 0);
      const until = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : "epoch";
      await run(`insert into §.settings (owner, key, value, note) values ($1, 'turbo_until', $2, 'set through the connector') on conflict (owner, key) do update set value = excluded.value, note = excluded.note`, [owner, until]);
      return JSON.stringify({ turbo_until: until });
    }
    case "health": return JSON.stringify((await run(`select §.health($1) as v`, [owner]))[0].v, null, 1);
    default: throw new Error(`no tool named "${name}"`);
  }
}

function result(id: unknown, res: unknown) { return { jsonrpc: "2.0", id, result: res }; }
function failure(id: unknown, code: number, message: string) { return { jsonrpc: "2.0", id, error: { code, message } }; }

async function handle(owner: string, msg: any): Promise<unknown | null> {
  const { id, method, params } = msg ?? {};
  const isNotification = id === undefined || id === null;
  try {
    switch (method) {
      case "initialize":
        return result(id, { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }, instructions: INSTRUCTIONS });
      case "ping": return result(id, {});
      case "tools/list": return result(id, { tools: TOOLS });
      case "tools/call": {
        try {
          const text = await callTool(owner, params?.name, params?.arguments ?? {});
          return result(id, { content: [{ type: "text", text }], isError: false });
        } catch (e) {
          return result(id, { content: [{ type: "text", text: String(e) }], isError: true });
        }
      }
      default:
        if (isNotification) return null;
        return failure(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (isNotification) return null;
    return failure(id, -32603, String(e));
  }
}

Deno.serve(async (req: Request) => {
  const headers = {
    "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, accept",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers });
  const url = new URL(req.url);
  const offered = url.searchParams.get("token") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  // ?schema= names a scratch schema while one is being built; anything not on the list is the live schema
  return await withSchema(url.searchParams.get("schema"), async () => {
    const owner = offered ? (await run(`select §.owner_for_token($1) as v`, [offered]))[0]?.v : null;
    if (!owner) return new Response("no", { status: 401, headers });
    let body: any;
    try { body = await req.json(); } catch { return new Response(JSON.stringify(failure(null, -32700, "Parse error")), { status: 400, headers }); }
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map((m) => handle(owner, m)))).filter((x) => x !== null);
      if (out.length === 0) return new Response(null, { status: 202, headers });
      return new Response(JSON.stringify(out), { status: 200, headers });
    }
    const out = await handle(owner, body);
    if (out === null) return new Response(null, { status: 202, headers });
    return new Response(JSON.stringify(out), { status: 200, headers });
  });
});
