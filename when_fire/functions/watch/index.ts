// when fire: the Watch's door.  Sunday, October 25, 2026.
// The bus posts here when the Watch's poll ticks: { fire, handler, owner, when, kind, schema }.
// A caller with the secret may also post { owner, why, dates | days, schema } to ask for a look now.

import { errorNote, json, localDate, run, secretOk, tzOf, withSchema } from "./lib.ts";
import { watch } from "./watch.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await secretOk(req))) return json({ error: "no" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  return await withSchema(body.schema, async () => {
    const owner = body.owner ?? (body.fire ? (await run(`select owner from §.fires where id = $1`, [body.fire]))[0]?.owner : null);
    if (!owner) return json({ error: "no owner" }, 400);
    try {
      let dates: string[] | null = Array.isArray(body.dates) ? body.dates : null;
      if (!dates && body.days) {
        const tz = await tzOf(owner);
        dates = [];
        for (let i = Number(body.days) - 1; i >= 0; i--) dates.push(localDate(new Date(Date.now() - i * 24 * 3600 * 1000), tz));
      }
      const out = await watch(owner, body.fire ?? null, body.why ?? (body.fire ? `the Watch's poll (fire ${body.fire})` : "asked"), dates);
      return json(out);
    } catch (e) {
      await errorNote(owner, "watch", e, { fire: body.fire });
      return json({ error: String(e) }, 500);
    }
  });
});
