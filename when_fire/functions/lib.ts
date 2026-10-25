// when fire: lib.  Shared by every actor's function.  Sunday, October 25, 2026.
// The database over a direct connection, the doors, the model call with its cost footnote and its cut-off rule,
// local time in the owner's zone, the shelf, and the secret check.  Every actor includes this file in its deploy.

import postgres from "npm:postgres@3.4.5";
import { AsyncLocalStorage } from "node:async_hooks";

// The schema a request works in.  The bus names it in every dispatch, so one deploy of an actor serves the live
// schema and a scratch copy of it (the rewrite's wf_next).  Nothing else may be named.
export const SCHEMAS = ["when_fire", "wf_next"];
const schemaStore = new AsyncLocalStorage<string>();
export function currentSchema(): string { return schemaStore.getStore() ?? "when_fire"; }
export function withSchema<T>(schema: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  const s = schema && SCHEMAS.includes(schema) ? schema : "when_fire";
  return schemaStore.run(s, fn);
}
export const MODEL_URL = "https://api.anthropic.com/v1/messages";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false, idle_timeout: 20 });

// Run a door or any query with positional parameters.  "§." in the text is the current schema; values are parameters.
export async function run(text: string, params: unknown[] = []): Promise<any[]> {
  return await sql.unsafe(text.replaceAll("§.", `${currentSchema()}.`), params as any[]);
}

// ---------------------------------------------------------------------------------------------
// Secrets and locks.
// ---------------------------------------------------------------------------------------------
export async function vault(name: string): Promise<string> {
  const r = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
  return r[0]?.decrypted_secret ?? "";
}

export async function secretOk(req: Request): Promise<boolean> {
  const given = req.headers.get("x-when-fire-secret") ?? "";
  const want = await vault("when_fire_listener_secret");
  return !!want && given === want;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
}

// ---------------------------------------------------------------------------------------------
// Settings, caps, time.
// ---------------------------------------------------------------------------------------------
export async function setting(owner: string, key: string): Promise<string | null> {
  const r = await run(`select §.setting($1, $2) as v`, [owner, key]);
  return r[0]?.v ?? null;
}
export async function cap(owner: string, actor: string, name: string): Promise<string | null> {
  const r = await run(`select §.cap($1, $2, $3) as v`, [owner, actor, name]);
  return r[0]?.v ?? null;
}
export async function tzOf(owner: string): Promise<string> {
  const r = await run(`select §.tz($1) as v`, [owner]);
  return r[0]?.v ?? "UTC";
}
export async function person(owner: string): Promise<any> {
  const r = await run(`select * from §.people where id = $1`, [owner]);
  return r[0];
}
// The person, as he asked to be introduced, for the top of every prompt.
export async function personWords(owner: string): Promise<string> {
  const p = await person(owner);
  return p?.words ? `The person: ${p.words}` : `The person: ${p?.name ?? "the owner"}.`;
}

// "Sat Oct 24, 8:00 AM" in the owner's zone.  Models never see raw universal times.
export function local(ts: string | Date | null | undefined, tz: string, withDate = true): string {
  if (!ts) return "";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { timeZone: tz, hour: "numeric", minute: "2-digit" };
  return d.toLocaleString("en-US", opts);
}
export function localDate(ts: string | Date, tz: string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toLocaleDateString("en-CA", { timeZone: tz });  // YYYY-MM-DD
}
export function withinHours(hours: string | null, tz: string): boolean {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }).replace(/\D/g, ""));
  const [a, b] = (hours ?? "00-24").split("-").map(Number);
  return h >= a && h < b;
}

// ---------------------------------------------------------------------------------------------
// The record's doors.
// ---------------------------------------------------------------------------------------------
export async function read(owner: string, p: Record<string, unknown> = {}): Promise<any> {
  const r = await run(`select §.read($1, $2::text::jsonb) as v`, [owner, JSON.stringify(p)]);
  return r[0]?.v;
}
export async function record(owner: string, said: string, saidBy: string, opts: {
  happened_at?: string | null; about?: string | null; corrects?: string | null; cites?: string | null; shape?: unknown; kind?: string;
} = {}): Promise<string> {
  const r = await run(`select §.record($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9) as v`, [
    owner, said, saidBy, opts.happened_at ?? null, opts.about ?? null, opts.corrects ?? null, opts.cites ?? null,
    opts.shape === undefined ? null : JSON.stringify(opts.shape), opts.kind ?? "world",
  ]);
  return r[0].v;
}
export async function note(owner: string, by: string, said: string, shape?: unknown): Promise<string> {
  return await record(owner, said, by, { kind: "note", shape });
}
export async function errorNote(owner: string, actor: string, err: unknown, shape?: unknown): Promise<void> {
  try { await record(owner, `${actor}: ${String(err).slice(0, 1500)}`, `error:${actor}`, { kind: "note", shape }); } catch { /* the error itself is the news */ }
}
export async function raise(owner: string, whenId: string, kind: string, by: string, context?: unknown, byFact?: string | null, byFire?: string | null, firedAt?: string | null): Promise<string> {
  const r = await run(`select §.raise($1, $2, $3, $4, $5::text::jsonb, $6, $7, $8) as v`, [owner, whenId, kind, by, JSON.stringify(context ?? null), byFact ?? null, byFire ?? null, firedAt ?? null]);
  return r[0].v;
}
export async function concept(owner: string, by: string, kind: string, name: string, words?: string | null): Promise<string> {
  const r = await run(`select §.concept($1, $2, $3, $4, $5) as v`, [owner, by, kind, name, words ?? null]);
  return r[0].v;
}
export async function link(owner: string, by: string, fromKind: string, fromId: string, relation: string, toConcept: string, cites?: string | null): Promise<string> {
  const r = await run(`select §.link($1, $2, $3, $4, $5, $6, $7) as v`, [owner, by, fromKind, fromId, relation, toConcept, cites ?? null]);
  return r[0].v;
}
export async function bridge(owner: string, by: string, fact: string, when: string, amount?: number | null, cites?: string | null): Promise<string> {
  const r = await run(`select §.bridge($1, $2, $3, $4, $5, $6) as v`, [owner, by, fact, when, amount ?? null, cites ?? null]);
  return r[0].v;
}
// Shaped replies sometimes carry a stray closing brace, tag or quote at the end of a text; trim it before it is kept.
export function tidy(text: unknown): string {
  let t = String(text ?? "").replace(/\s+\n/g, "\n").trim();
  for (let i = 0; i < 6; i++) {
    const before = t;
    t = t.replace(/(<\/?br\s*\/?>|[}\]]+|\s+\.)$/i, "").trim();
    if (t.endsWith('"') && (t.split('"').length - 1) % 2 === 1) t = t.slice(0, -1).trim();
    if (t.endsWith(".'")) t = t.slice(0, -1);
    if (t === before) break;
  }
  return t.replace(/ {3,}\./g, ".").replace(/\.\s+\.$/, ".");
}
export async function snap(owner: string, subjectKind: string, subjectId: string | null, watermark: string, by: string, says: string, shape?: unknown): Promise<string> {
  const r = await run(`select §.snap($1, $2, $3, $4, $5, $6, $7::text::jsonb) as v`, [owner, subjectKind, subjectId, watermark, by, tidy(says), JSON.stringify(shape ?? null)]);
  return r[0].v;
}
export async function question(owner: string, by: string, words: string, aboutKind?: string | null, aboutId?: string | null, askOf = "shelf", shape?: unknown): Promise<string> {
  const r = await run(`select §.question($1, $2, $3, $4, $5, $6, $7::text::jsonb) as v`, [owner, by, words, aboutKind ?? null, aboutId ?? null, askOf, JSON.stringify(shape ?? null)]);
  return r[0].v;
}
export async function questionEvent(q: string, kind: string, by: string, words?: string | null, cites?: string | null, shape?: unknown): Promise<string> {
  const r = await run(`select §.question_event($1, $2, $3, $4, $5, $6::text::jsonb) as v`, [q, kind, by, words ?? null, cites ?? null, JSON.stringify(shape ?? null)]);
  return r[0].v;
}
export async function task(owner: string, by: string, kind: string, words: string, dueAt?: string | null, fire?: string | null, shape?: unknown): Promise<string> {
  const r = await run(`select §.task($1, $2, $3, $4, $5, $6, $7::text::jsonb) as v`, [owner, by, kind, words, dueAt ?? null, fire ?? null, JSON.stringify(shape ?? null)]);
  return r[0].v;
}
export async function taskEvent(t: string, kind: string, by: string, words?: string | null, shape?: unknown): Promise<string> {
  const r = await run(`select §.task_event($1, $2, $3, $4, $5::text::jsonb) as v`, [t, kind, by, words ?? null, JSON.stringify(shape ?? null)]);
  return r[0].v;
}
export async function health(owner: string): Promise<any> {
  const r = await run(`select §.health($1) as v`, [owner]);
  return r[0]?.v;
}
export async function spentToday(owner: string, actor?: string): Promise<number> {
  const r = await run(`select §.spent_today($1, $2) as v`, [owner, actor ?? null]);
  return Number(r[0]?.v ?? 0);
}

// Concepts an actor may name, as a compact list for a prompt.
export async function conceptList(owner: string): Promise<{ id: string; kind: string; name: string }[]> {
  return await run(`select id, kind, name from §.concepts where supersedes is null and owner in ($1, §.system_id()) order by kind, name`, [owner]);
}

// ---------------------------------------------------------------------------------------------
// The shelf.
// ---------------------------------------------------------------------------------------------
let embedder: any = null;
export async function embed(text: string): Promise<number[] | null> {
  try {
    // @ts-ignore Supabase.ai is provided by the edge runtime
    embedder ??= new Supabase.ai.Session("gte-small");
    const out = await embedder.run(text.slice(0, 2000), { mean_pool: true, normalize: true });
    return Array.from(out as Float32Array);
  } catch {
    return null;
  }
}
export async function ask(owner: string, words: string, limit = 12): Promise<any[]> {
  const e = await embed(words);
  const r = await run(`select §.ask($1, $2, $3::extensions.vector, $4) as v`, [owner, words, e ? `[${e.join(",")}]` : null, limit]);
  return r[0]?.v ?? [];
}

// ---------------------------------------------------------------------------------------------
// The model.  Thinking stays on (the model's default); every ceiling is room, not a target.  A reply cut off at
// its ceiling is tried once more with twice the room, then fails loudly.  Replies that write into the record are
// shaped on the model's side.  Every call writes its cost footnote.  The stable part of the system prompt is cached.
// ---------------------------------------------------------------------------------------------
export type Usage = { input: number; output: number; thinking: number; cached: number; dollars: number; stop: string; seconds: number };
export type Block = { type: string; [k: string]: unknown };

export async function model(owner: string, actor: string, opts: {
  system: string; stable?: string; user: string | Block[]; maxTokens?: number; shape?: Record<string, unknown>; fire?: string | null; note?: string;
}): Promise<{ text: string; data: any; usage: Usage }> {
  const key = await vault("when_fire_model_key");
  if (!key) throw new Error("no model key in the vault");
  const name = (await setting(owner, "model")) ?? "claude-sonnet-5-5";
  const workspace = await setting(owner, "model_workspace_id");
  const headers: Record<string, string> = { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
  if (workspace) headers["anthropic-workspace-id"] = workspace;
  const priceIn = Number((await setting(owner, "price_in_per_m")) ?? 3);
  const priceOut = Number((await setting(owner, "price_out_per_m")) ?? 15);
  const priceCached = Number((await setting(owner, "price_cached_per_m")) ?? 0.3);

  const system: Block[] = [];
  if (opts.stable) system.push({ type: "text", text: opts.stable, cache_control: { type: "ephemeral" } });
  system.push({ type: "text", text: opts.system });
  const content = typeof opts.user === "string" ? opts.user : opts.user;
  const max = opts.maxTokens ?? 8000;
  const usage: Usage = { input: 0, output: 0, thinking: 0, cached: 0, dollars: 0, stop: "", seconds: 0 };
  let cut = "";
  const t0 = Date.now();
  try {
    for (const ceiling of [max, max * 2]) {
      const body: Record<string, unknown> = { model: name, max_tokens: ceiling, system, messages: [{ role: "user", content }] };
      if (opts.shape) body.output_config = { format: { type: "json_schema", schema: opts.shape } };
      const r = await fetch(MODEL_URL, { method: "POST", headers, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(`model ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
      const u = j.usage ?? {};
      usage.input += u.input_tokens ?? 0;
      usage.output += u.output_tokens ?? 0;
      usage.thinking += u.output_tokens_details?.thinking_tokens ?? 0;
      usage.cached += u.cache_read_input_tokens ?? 0;
      usage.stop = j.stop_reason ?? "";
      if (j.stop_reason === "max_tokens") {
        cut = `cut off at ${ceiling} tokens (${u.output_tokens_details?.thinking_tokens ?? 0} of them thinking)`;
        continue;
      }
      const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      let data: any = null;
      if (opts.shape) {
        data = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
      }
      return { text, data, usage };
    }
    throw new Error(`model reply ${cut}, twice`);
  } finally {
    usage.seconds = (Date.now() - t0) / 1000;
    usage.dollars = (usage.input * priceIn + usage.cached * priceCached + usage.output * priceOut) / 1e6;
    try {
      await run(`select §.cost($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
        owner, actor, name, usage.input, usage.output, usage.thinking, usage.cached, usage.dollars.toFixed(6), usage.stop || null,
        usage.seconds.toFixed(2), opts.fire ?? null, opts.note ?? null,
      ]);
    } catch { /* a missing footnote is not worth losing the reply over */ }
  }
}

// The seatbelt: has this actor spent its day's share?
export async function belted(owner: string, actor: string): Promise<string | null> {
  const all = Number((await cap(owner, "*", "daily_dollars")) ?? 3);
  const mine = await cap(owner, actor, "daily_dollars");
  const spentAll = await spentToday(owner);
  if (spentAll >= all) return `the day's cap for every actor together (${all.toFixed(2)}) is spent (${spentAll.toFixed(2)})`;
  if (mine !== null) {
    const spentMine = await spentToday(owner, actor);
    if (spentMine >= Number(mine)) return `the day's cap for ${actor} (${Number(mine).toFixed(2)}) is spent (${spentMine.toFixed(2)})`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The credo, in every actor's stable prompt.
// ---------------------------------------------------------------------------------------------
export const CREDO =
  "You are one actor inside when fire, a person's record of what he said he would do (whens) and what happened (facts).  " +
  "The record is a witness, not a judge.  It holds what was asserted and what was recorded; when nothing was recorded, the word is silence.  " +
  "Never write failed, missed, good, bad, success, should, or any grade, verdict or encouragement.  Describe; do not evaluate.  " +
  "The person's words outrank any retelling.  Keep what the person said and what you inferred apart.  " +
  "Times are given to you in the person's local time; use them as given.  The time a thing happened leads; the time it was entered is a footnote.  " +
  "The system's own notes (readings, snapshots, thoughts, errors) are never evidence that the person did a thing.  " +
  "Cite ids when you rest on a fact, a fire or a claim.  Be terse.";

export function factsAsText(facts: any[], tz: string): string {
  return facts.map((f) =>
    `- fact ${f.id} | happened ${local(f.happened_at, tz)}${Math.abs(new Date(f.recorded_at).getTime() - new Date(f.happened_at).getTime()) > 15 * 60 * 1000 ? ` (entered ${local(f.recorded_at, tz)})` : ""} | ${f.said_by}${f.about ? ` | about when ${f.about}` : ""}${f.cites ? ` | cites source ${f.cites}` : ""}\n  ${String(f.said).replace(/\s+/g, " ").slice(0, 900)}`
  ).join("\n");
}
export function whensAsText(whens: any[], tz: string): string {
  return whens.map((w) =>
    `- when ${w.id} | kind ${w.kind} | asserted by ${w.asserted_by} ${local(w.asserted_at, tz)}${w.bundle ? ` | in bundle ${w.bundle}` : ""}${w.until_words ? ` | until: ${w.until_words}` : ""}${w.reasons ? ` | because: ${w.reasons.map((r: any) => r.words ?? r.name).join("; ")}` : ""}${Array.isArray(w.after) && w.after.length ? ` | comes after (facts about these count here): ${w.after.join(", ")}` : ""}\n  ${String(w.words).replace(/\s+/g, " ")}\n  when: ${w.condition_words ?? "(worded in the words above)"}${w.condition ? ` | machine: ${JSON.stringify(w.condition)}` : ""}`
  ).join("\n");
}
export function firesAsText(fires: any[], tz: string): string {
  return fires.map((x) => `- fire ${x.id} | ${x.kind} | on when ${x.when_id} | ${local(x.fired_at, tz)} | by ${x.fired_by}${x.context?.moment ? ` | moment ${x.context.moment}` : ""}${x.context?.reason ? ` | ${x.context.reason}` : ""}`).join("\n");
}
export const ACTORS = ["watch", "reconciler", "thinker", "doer", "librarian", "heartbeat", "system", "ai"];
export function personSide(whens: any[]): any[] {
  return whens.filter((w) => !ACTORS.includes(String(w.asserted_by)));
}
