// when fire: the Watch.  Sunday, October 25, 2026.
// Reads the person's worded whens against the record and gives each a reading: met, silence, open, or met later.
// Runs on its own poll (a tick when with handler watch), at every episode close and at the day's close (called by
// the Reconciler).  A reading is a description of the record, never a verdict on the person.  Readings become fires
// of kind met or silence, with the facts that met the when written as bridges.  Never a second silence for the same
// when and day; a fact after a silence raises met with late true.

import { belted, bridge, CREDO, errorNote, factsAsText, firesAsText, local, localDate, model, personSide, personWords, raise, read, run, tzOf, whensAsText } from "./lib.ts";

const SHAPE = {
  type: "object",
  additionalProperties: false,
  properties: {
    readings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          when: { type: "string", description: "the when's id, copied whole" },
          moment: { type: "string", description: "the local date, YYYY-MM-DD, the reading belongs to" },
          reading: { type: "string", enum: ["met", "silence", "open", "met_later"] },
          facts: { type: "array", items: { type: "string" }, description: "ids of the facts that met the when, copied whole, in order; empty for silence and open" },
          amount: { type: ["number", "null"], description: "the number the facts add up to for this when, when the when counts a number; else null" },
          reason: { type: "string", description: "one sentence: what in the times and the facts gives this reading" },
        },
        required: ["when", "moment", "reading", "facts", "amount", "reason"],
      },
    },
  },
  required: ["readings"],
};

const STABLE = CREDO + "\n\n" +
  "You are the Watch.  For each worded when you are shown, decide from the facts and the local time what the record shows for each day you are asked about, and give one reading:\n" +
  "- met: a fact (or facts) shows the when's words were done within the window the when names.  Name the facts.\n" +
  "- silence: the window the when names has clearly closed for that day and no fact shows it.  Only when the window has clearly passed.\n" +
  "- open: the window has not closed yet, or the when's condition has not come up (a rope session is due only after two rest days; a max test has its dates; a pain when is open until pain is recorded).\n" +
  "- met_later: a fact shows it was done after an earlier silence reading for the same day.  Name the facts.\n" +
  "A when that names no window of its own has the whole day: it reads open until that day has closed (the day closes at 4:00 AM the next morning), and silence after that if no fact shows it.  " +
  "A fact counts for a when only if its words plainly match the when's words; a round done at any hour counts for a when that names no hour.  Facts recorded by the system itself (readings, snapshots, thoughts) are never evidence.  " +
  "Give one reading per when per day you are asked about; if a when has no bearing on the day, give open.  Keep reasons to one sentence, descriptive, with no grade in it.  Copy ids whole.";

// dates: the local days to read (YYYY-MM-DD); the caller decides (today for the poll; the episode's days and today
// at an episode close; the day itself at the day's close).
// asOf: in replay, the Watch looks as if it were that moment: only what was recorded by then, and that is "now".
export async function watch(owner: string, fireId: string | null, why: string, dates?: string[] | null, asOf?: string | null): Promise<any> {
  const tz = await tzOf(owner);
  const now = asOf ? new Date(asOf) : new Date();
  const today = localDate(now, tz);
  const days = [...new Set([...(dates ?? []), ...(dates?.length ? [] : [today])])].sort();
  const since = new Date(new Date(`${days[0]}T12:00:00Z`).getTime() - 36 * 3600 * 1000).toISOString();
  const rec = await read(owner, { since, until: now.toISOString(), limit: "all", fires: true, as_of: asOf ?? undefined });
  const whens = personSide(rec.whens).filter((w: any) => (w.kind === "worded" || w.kind === "tick") && new Date(w.asserted_at) <= now);
  if (whens.length === 0) return { readings: [], note: "no worded whens" };
  const facts = rec.facts.filter((f: any) => f.kind === "world" && new Date(f.recorded_at) <= now);
  const fires = rec.fires.filter((x: any) => ["met", "silence", "tick"].includes(x.kind) && new Date(x.fired_at) <= now);

  const stop = await belted(owner, "watch");
  if (stop) { await errorNote(owner, "watch", `seatbelt: ${stop}`); return { readings: [], note: stop }; }

  const user =
    `${await personWords(owner)}\nLocal time now: ${local(now, tz)} (${tz}).  Days to read: ${days.join(", ")}.\n\n` +
    `The person's whens:\n${whensAsText(whens, tz)}\n\n` +
    `Facts from the world since ${local(since, tz)} (happened time first):\n${facts.length ? factsAsText(facts, tz) : "(none)"}\n\n` +
    `Readings already on the record (do not repeat a silence for the same when and day; a met after a silence is met_later):\n${fires.length ? firesAsText(fires, tz) : "(none)"}\n\n` +
    `Why this look: ${why}.`;

  const { data, usage } = await model(owner, "watch", { stable: STABLE, system: "Return the readings as data.", user, maxTokens: 8000, shape: SHAPE, fire: fireId, note: why });

  const written: any[] = [];
  for (const r of data.readings ?? []) {
    if (!whens.some((w: any) => w.id === r.when)) { written.push({ ...r, wrote: false, note: "unknown when id" }); continue; }
    if (r.reading === "open") { written.push({ ...r, wrote: false }); continue; }
    const existing = await run(`select kind, context from §.fires where owner = $1 and when_id = $2 and kind in ('met', 'silence') and context->>'moment' = $3`, [owner, r.when, r.moment]);
    const hasMet = existing.some((x: any) => x.kind === "met");
    const hasSilence = existing.some((x: any) => x.kind === "silence");
    if (r.reading === "silence") {
      if (hasSilence || hasMet) { written.push({ ...r, wrote: false }); continue; }
      const id = await raise(owner, r.when, "silence", "watch", { moment: r.moment, reason: r.reason, why }, null, fireId, asOf ?? null);
      written.push({ ...r, fire: id, wrote: true });
    } else {
      if (hasMet) { written.push({ ...r, wrote: false }); continue; }
      const late = r.reading === "met_later" || hasSilence;
      const known = (r.facts ?? []).filter((id: string) => facts.some((f: any) => f.id === id));
      const id = await raise(owner, r.when, "met", "watch", { moment: r.moment, reason: r.reason, late, why, facts: known, amount: r.amount }, known[0] ?? null, fireId, asOf ?? null);
      for (const f of known) {
        try { await bridge(owner, "watch", f, r.when, known.length === 1 ? r.amount ?? null : null, `watch reading ${id}: ${r.reason}`); } catch { /* a slip of the model's, not a stop */ }
      }
      written.push({ ...r, fire: id, wrote: true, late });
    }
  }
  return { readings: written, usage, days };
}
