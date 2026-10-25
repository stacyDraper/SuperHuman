// when fire: copy.  October 25, 2026.
// Moves whole tables off and onto the database so the record can be copied every night, carried into a new
// schema, and put back.  Door: POST with header x-copy-secret equal to the vault secret when_fire_listener_secret.
//
//   { "verb": "out", "schema": "when_fire", "table": "facts", "since": iso (optional), "since_column": "recorded_at" }
//       -> { schema, table, count, rows }        rows are row_to_json; vectors arrive as "[0.1,...]" strings
//   { "verb": "in",  "schema": "when_fire", "table": "facts", "rows": [ {...}, ... ] }
//       -> { schema, table, inserted }           rows are inserted with jsonb_populate_record; unknown keys are dropped
//   The run verb that executed statements during the rewrite was removed at the end of the rewrite day, October 25, 2026.
//
// Schemas served: when_fire, wf_next (the rewrite's scratch copy), knowledge and when_fire_v1 (the first build).

import postgres from "npm:postgres@3.4.5";

const SCHEMAS = ["when_fire", "wf_next", "knowledge", "when_fire_v1"];
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 20 });

async function secret(): Promise<string> {
  const r = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'when_fire_listener_secret' limit 1`;
  return r[0]?.decrypted_secret ?? "";
}

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
}

async function tableExists(schema: string, table: string): Promise<boolean> {
  const r = await sql`select 1 from information_schema.tables where table_schema = ${schema} and table_name = ${table}`;
  return r.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return bad("copy: POST only", 405);
  const given = req.headers.get("x-copy-secret") ?? "";
  const want = await secret();
  if (!want || given !== want) return bad("copy: no", 401);

  let body: any;
  try { body = await req.json(); } catch { return bad("copy: body must be JSON"); }
  const verb = String(body.verb ?? "out");

  try {
    const schema = String(body.schema ?? "");
    const table = String(body.table ?? "");
    if (!SCHEMAS.includes(schema) || !/^[a-z_]+$/.test(table) || !(await tableExists(schema, table))) {
      return bad(`copy: ${schema}.${table} is not served`);
    }

    if (verb === "out") {
      const sinceColumn = String(body.since_column ?? "recorded_at");
      if (!/^[a-z_]+$/.test(sinceColumn)) return bad("copy: bad since_column");
      const rows = body.since
        ? await sql.unsafe(`select row_to_json(t) as r from ${schema}.${table} t where t.${sinceColumn} >= $1`, [String(body.since)])
        : await sql.unsafe(`select row_to_json(t) as r from ${schema}.${table} t`);
      const out = rows.map((x: any) => x.r);
      return new Response(JSON.stringify({ schema, table, count: out.length, rows: out }), { headers: { "content-type": "application/json" } });
    }

    if (verb === "in") {
      const rows = body.rows;
      if (!Array.isArray(rows)) return bad("in: rows must be an array");
      // only the columns the rows carry are named, so columns left out take their defaults
      const present = new Set<string>();
      for (const r of rows) for (const k of Object.keys(r ?? {})) present.add(k);
      const cols = (await sql`select column_name from information_schema.columns
                                where table_schema = ${schema} and table_name = ${table} and is_generated = 'NEVER'
                                order by ordinal_position`)
        .map((c: any) => c.column_name).filter((c: string) => present.has(c)).map((c: string) => `"${c}"`).join(", ");
      if (!cols) return bad("in: no known columns in rows");
      let inserted = 0;
      const chunk = 200;
      for (let i = 0; i < rows.length; i += chunk) {
        const part = rows.slice(i, i + chunk);
        const r = await sql.unsafe(
          `insert into ${schema}.${table} (${cols}) select ${cols} from jsonb_populate_recordset(null::${schema}.${table}, $1::text::jsonb) on conflict do nothing`,
          [JSON.stringify(part)],
        );
        inserted += r.count ?? 0;
      }
      return new Response(JSON.stringify({ schema, table, inserted }), { headers: { "content-type": "application/json" } });
    }

    return bad(`copy: no verb named ${verb}`);
  } catch (e) {
    return bad(`copy: ${String(e)}`.slice(0, 1500), 500);
  }
});
