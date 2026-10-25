// when fire: the Librarian.  Sunday, October 25, 2026.
// Keeps sources wherever they live and says what they say.
//   learn: { owner, source: { origin, title, text, happened_at, kind, shape } }  keeps the whole text as a source (the same
//          origin and title handed in again reuses the source and adds only claims that are missing), reads it with the
//          model in chunks, writes one claim per sentence it says, embeds each.  Its model calls get the cut-off rule.
//   ask:   { owner, question, limit }  the current claims that bear on the question, by words and by meaning.
//   media: { owner, base64, media_type, origin, title, happened_at, kind }  stores a picture or a recording in the
//          private sources bucket and records it as a source; a fact may then cite it.
//   embed: { owner, limit }  fills embeddings for claims that have none, a few per request, and posts to itself for the
//          rest: the embedder is heavy on the worker's compute budget, so the work is spread over requests.
// The connector forwards the person's learn and ask here with the shared secret.  The bus does not post here.

import { ask, CREDO, currentSchema, embed, errorNote, json, local, model, run, secretOk, tzOf, vault, withSchema, SERVICE_KEY, SUPABASE_URL } from "./lib.ts";

const CLAIMS_SHAPE = {
  type: "object", additionalProperties: false,
  properties: {
    claims: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { said: { type: "string" }, about: { type: "string", description: "two to six words naming the subject: 'potassium', 'dips and the shoulder', 'rope sessions per week'" } }, required: ["said", "about"] },
    },
  },
  required: ["claims"],
};

const STABLE = CREDO + "\n\n" +
  "You are the Librarian.  Read the source and write what it says as claims: one sentence each, in plain words, each standing on its own, with the date or period the source gives when a number or a prescription depends on it.  " +
  "Write only what the source says; never what it implies, and never a grade.  Numbers keep their units.  A clinician's instruction is written as that clinician's instruction, with the date.  " +
  "Skip boilerplate, headers and repeated lines.  Twenty to sixty claims for a long document; a handful for a note.";

function chunks(text: string, size = 14000): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let j = Math.min(text.length, i + size);
    if (j < text.length) { const k = text.lastIndexOf("\n", j); if (k > i + size / 2) j = k; }
    out.push(text.slice(i, j)); i = j;
  }
  return out;
}

async function learn(owner: string, src: any): Promise<any> {
  if (!src?.origin || !src?.text) throw new Error("learn needs origin and text");
  const tz = await tzOf(owner);
  let reused = false;
  let source = (await run(`select id from §.sources where owner = $1 and origin = $2 and coalesce(title, '') = coalesce($3, '') limit 1`, [owner, src.origin, src.title ?? null]))[0];
  if (source) reused = true;
  else {
    source = (await run(
      `insert into §.sources (owner, happened_at, origin, kind, title, text, shape) values ($1, $2, $3, $4, $5, $6, $7::text::jsonb) returning id`,
      [owner, src.happened_at ?? null, src.origin, src.kind ?? null, src.title ?? null, src.text, JSON.stringify(src.shape ?? null)]))[0];
  }
  const existing = await run(`select said from §.claims where source_id = $1`, [source.id]);
  const have = new Set(existing.map((c: any) => c.said.trim().toLowerCase()));
  let written = 0;
  for (const part of chunks(String(src.text))) {
    const user = `Source: ${src.origin}${src.title ? `, "${src.title}"` : ""}${src.happened_at ? `, dated ${local(src.happened_at, tz)}` : ""}${src.kind ? ` (${src.kind})` : ""}.\n\n${part}`;
    const { data } = await model(owner, "librarian", { stable: STABLE, system: "Return the claims as data.", user, maxTokens: 12000, shape: CLAIMS_SHAPE, note: `learn: ${src.title ?? src.origin}` });
    for (const c of data.claims ?? []) {
      const key = String(c.said).trim().toLowerCase();
      if (!key || have.has(key)) continue;
      have.add(key);
      await run(`insert into §.claims (owner, made_by, source_id, said, about_words) values ($1, 'librarian', $2, $3, $4)`, [owner, source.id, c.said, c.about]);
      written++;
    }
  }
  if (written > 0) later(owner);
  return { source: source.id, reused, claims: written, embeddings: written > 0 ? "being filled" : "none needed" };
}

// Embeddings are filled by this function calling itself, a few claims per request, after the reply has gone out.
function later(owner: string): void {
  const p = (async () => {
    const secret = await vault("when_fire_listener_secret");
    await fetch(`${SUPABASE_URL}/functions/v1/librarian`, {
      method: "POST", headers: { "content-type": "application/json", "x-when-fire-secret": secret },
      body: JSON.stringify({ verb: "embed", owner, schema: currentSchema() }),
    }).catch(() => {});
  })();
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}

async function media(owner: string, m: any): Promise<any> {
  if (!m?.base64 || !m?.media_type) throw new Error("media needs base64 and media_type");
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp", "audio/m4a": "m4a", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" } as Record<string, string>)[m.media_type] ?? "bin";
  const id = crypto.randomUUID();
  const path = `${owner}/${id}.${ext}`;
  const bytes = Uint8Array.from(atob(m.base64), (c) => c.charCodeAt(0));
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/sources/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "content-type": m.media_type, "x-upsert": "false" }, body: bytes,
  });
  if (!up.ok) throw new Error(`storage ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const s = (await run(
    `insert into §.sources (id, owner, happened_at, origin, kind, title, text, media_path, media_type, shape) values ($1, $2, $3, $4, $5, $6, null, $7, $8, $9::text::jsonb) returning id`,
    [id, owner, m.happened_at ?? null, m.origin ?? "the person's camera", m.kind ?? (m.media_type.startsWith("image/") ? "picture" : "recording"), m.title ?? null, path, m.media_type, JSON.stringify(m.shape ?? null)]))[0];
  return { source: s.id, path, bytes: bytes.length };
}

async function fillEmbeddings(owner: string, limit = 8): Promise<any> {
  const rows = await run(`select id, said, about_words from §.claims where owner = $1 and embedding is null order by made_at limit $2`, [owner, limit]);
  let n = 0;
  for (const r of rows) {
    const e = await embed(`${r.about_words ?? ""}: ${r.said}`);
    if (!e) continue;
    await run(`update §.claims set embedding = $2::extensions.vector where id = $1`, [r.id, `[${e.join(",")}]`]);
    n++;
  }
  const left = Number((await run(`select count(*) as c from §.claims where owner = $1 and embedding is null`, [owner]))[0]?.c ?? 0);
  if (left > 0 && n > 0) later(owner);
  return { embedded: n, left };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await secretOk(req))) return json({ error: "no" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  return await withSchema(body.schema, async () => {
    const owner = body.owner;
    if (!owner) return json({ error: "no owner" }, 400);
    try {
      switch (body.verb) {
        case "learn": return json(await learn(owner, body.source));
        case "ask": return json({ claims: await ask(owner, String(body.question ?? ""), Number(body.limit ?? 12)) });
        case "media": return json(await media(owner, body.media));
        case "embed": return json(await fillEmbeddings(owner, Number(body.limit ?? 8)));
        default: return json({ error: `no verb named ${body.verb}` }, 400);
      }
    } catch (e) {
      await errorNote(owner, "librarian", e, { verb: body.verb });
      return json({ error: String(e) }, 500);
    }
  });
});
