// when fire: the Doer.  Sunday, October 25, 2026.
// Acts in the world from the outbox.  Today it has two hands of its own and otherwise writes tasks for the Claude
// session, which reads open tasks through the connector and marks them done.
//   morning_page: at the tick, writes the page (today's whens in the person's words, last night's day snapshot, the
//                 questions only the person can answer) as a task of kind morning_page.
//   copy:         at the tick, copies every table of the schema into the private copies bucket, dated, and leaves a
//                 task of kind carry asking the session to carry the record's tables to Drive.
// Nothing in the record changes when the Doer changes.

import { errorNote, json, local, localDate, personSide, read, run, secretOk, task, taskEvent, tzOf, vault, withSchema, currentSchema, SERVICE_KEY, SUPABASE_URL } from "./lib.ts";

const TABLES = ["people", "settings", "caps", "whens", "sources", "facts", "fires", "relations", "concepts", "links", "bridges", "episodes", "snapshots", "questions", "question_events", "costs", "tasks", "task_events", "handlers", "claims"];

async function morningPage(owner: string, fireId: string | null): Promise<any> {
  const tz = await tzOf(owner);
  const rec = await read(owner, { since: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), limit: 200, fires: false });
  const whens = personSide(rec.whens).filter((w: any) => w.kind !== "on");
  const day = (rec.snapshots ?? []).filter((s: any) => s.subject_kind === "day").sort((a: any, b: any) => (a.written_at < b.written_at ? 1 : -1))[0];
  const forPerson = (rec.questions ?? []).filter((q: any) => q.ask_of === "person");
  const today = local(new Date(), tz);
  const lines = [
    `Morning page, ${today}.`,
    "",
    "Today's whens, in your words:",
    ...whens.map((w: any) => `- ${w.words}${w.condition_words ? `  (when: ${w.condition_words})` : ""}`),
    "",
    day ? `Last night's reconciliation: ${day.says}` : "Last night's reconciliation: none written yet.",
  ];
  if (forPerson.length) lines.push("", "The Thinker would like to know:", ...forPerson.map((q: any) => `- ${q.words}`));
  const words = lines.join("\n");
  const id = await task(owner, "doer", "morning_page", words, null, fireId, { whens: whens.map((w: any) => w.id), day: day?.id ?? null, questions: forPerson.map((q: any) => q.id) });
  return { task: id, whens: whens.length, questions: forPerson.length };
}

async function copyOut(owner: string, fireId: string | null): Promise<any> {
  const tz = await tzOf(owner);
  const schema = currentSchema();
  const date = localDate(new Date(), tz);
  const secret = await vault("when_fire_listener_secret");
  const copyUrl = `${SUPABASE_URL}/functions/v1/copy`;
  const landed: Record<string, number> = {};
  for (const t of TABLES) {
    const r = await fetch(copyUrl, { method: "POST", headers: { "content-type": "application/json", "x-copy-secret": secret }, body: JSON.stringify({ verb: "out", schema, table: t }) });
    if (!r.ok) { await errorNote(owner, "doer", `copy out ${t}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    const text = await r.text();
    const path = `${schema}/${date}/${t}.json`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/copies/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "content-type": "application/json", "x-upsert": "true" },
      body: text,
    });
    if (!up.ok) { await errorNote(owner, "doer", `copy up ${t}: ${up.status} ${(await up.text()).slice(0, 200)}`); continue; }
    landed[t] = JSON.parse(text).count ?? 0;
  }
  const words = `Copied ${Object.keys(landed).length} tables of ${schema} to the copies bucket under ${schema}/${date}: ` + Object.entries(landed).map(([k, v]) => `${k} ${v}`).join(", ") + ".";
  const t1 = await task(owner, "doer", "copy", words, null, fireId, { date, landed });
  await taskEvent(t1, "done", "doer", words);
  const t2 = await task(owner, "doer", "carry", `Carry the record's tables of ${date} (whens, facts, fires, snapshots, questions, concepts, links, bridges) from the copies bucket to Drive, superhuman/store/copies/${date}.`, null, fireId, { date, bucket: "copies", path: `${schema}/${date}` });
  return { copied: landed, task: t1, carry: t2 };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await secretOk(req))) return json({ error: "no" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  return await withSchema(body.schema, async () => {
    let owner = body.owner; let bounds: any = {};
    if (body.fire) {
      const f = (await run(`select f.owner, w.bounds from §.fires f join §.whens w on w.id = f.when_id where f.id = $1`, [body.fire]))[0];
      owner ??= f?.owner; bounds = f?.bounds ?? {};
    }
    if (!owner) return json({ error: "no owner" }, 400);
    const kind = body.kind ?? bounds.kind ?? "morning_page";
    try {
      if (kind === "copy") return json(await copyOut(owner, body.fire ?? null));
      return json(await morningPage(owner, body.fire ?? null));
    } catch (e) {
      await errorNote(owner, "doer", e, { fire: body.fire, kind });
      return json({ error: String(e) }, 500);
    }
  });
});
