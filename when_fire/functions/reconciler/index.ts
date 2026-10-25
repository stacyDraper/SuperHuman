// when fire: the Reconciler.  Sunday, October 25, 2026.
// Closes episodes and days and writes snapshots: what stands now about each stale subject, as of a watermark.
// Modes.  episode: the bus posts a quiet fire (the record has been still for the gap); the Watch reads the worded
// whens, then facts the glance did not link are linked and bridged, then one snapshot per stale when and one for the
// episode; then the Thinker is asked to settle.  day: the bus posts the day-close tick; the Watch reads the day one
// last time, then one snapshot of the day with the health line and the day's cost.  replay: a caller with the secret
// posts { mode: "replay", owner, since }; the record is walked from that date as if the Reconciler had been there,
// episodes and days closing at the times they would have closed, each actor seeing only what had been recorded by
// then.  link: a caller posts { mode: "link", owner, facts?: [ids] }; facts with no links are linked and bridged
// again (a repair), and the model's reply is returned for inspection.
// Never a verdict, never a grade, never "should".

import {
  belted, bridge, concept, conceptList, CREDO, errorNote, factsAsText, firesAsText, health, json, link, local, localDate, model,
  personSide, personWords, read, run, secretOk, setting, snap, tzOf, vault, whensAsText, withSchema, currentSchema,
} from "./lib.ts";
import { watch } from "./watch.ts";

const LINK_SHAPE = {
  type: "object", additionalProperties: false,
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          fact: { type: "string", description: "the fact's id, copied whole" },
          concepts: {
            type: "array",
            items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, kind: { type: "string", enum: ["body_part", "movement", "measure", "reason", "person", "place", "goal", "document", "substance", "condition", "other"] } }, required: ["name", "kind"] },
          },
          whens: {
            type: "array",
            items: { type: "object", additionalProperties: false, properties: { when: { type: "string", description: "the when's id, copied whole" }, amount: { type: ["number", "null"] }, why: { type: "string" } }, required: ["when", "amount", "why"] },
          },
        },
        required: ["fact", "concepts", "whens"],
      },
    },
  },
  required: ["facts"],
};

const SNAP_SHAPE = {
  type: "object", additionalProperties: false,
  properties: {
    whens: { type: "array", items: { type: "object", additionalProperties: false, properties: { when: { type: "string", description: "the when's id, copied whole" }, says: { type: "string" }, cites: { type: "array", items: { type: "string" } } }, required: ["when", "says", "cites"] } },
    episode: { type: "string", description: "the episode's story in two to four sentences: what happened, in order, with local times; the asserted beside the recorded where a when was in play; no grade" },
  },
  required: ["whens", "episode"],
};

const DAY_SHAPE = {
  type: "object", additionalProperties: false,
  properties: { day: { type: "string", description: "the day in three to five sentences, happened times first, the asserted beside the recorded, no grade" } },
  required: ["day"],
};

const STABLE = CREDO + "\n\n" +
  "You are the Reconciler.  You write what stands now: for each when, what was asserted and what the record shows, side by side, in two or three sentences, citing fact and fire ids; " +
  "for an episode or a day, the story in order.  Where nothing was recorded for a when whose window has passed, write silence.  " +
  "Where a count applies, give the count the facts show (so far today, or in the window the when names).  Where a correction exists, the corrected words stand and the correction is noted once.  " +
  "Where the time entered differs from the time happened by more than a quarter hour, say so in a footnote clause, not in the main line.  Plain prose; no closing marks after the last sentence.";

const LINK_STABLE = CREDO + "\n\n" +
  "You link facts to the graph.  For each fact, name the concepts it names: movements (dip, jump rope), body parts (calves), measures (calories, reps, weight), people, places, substances.  " +
  "Prefer a concept already in the list, by its exact name; coin a new one only when none fits, lowercase, singular, plain.  " +
  "Then say which of the person's whens the fact counts toward, by id, with the amount it contributes when the when counts a number (reps, calories, sessions), and one clause why.  " +
  "A fact counts toward a when only when its words plainly match the when's words; a fact may count toward several whens (a round of dips is grease the groove and is exercise).  " +
  "Never link the system's own notes.  Copy every id whole, exactly as shown.";

type Seg = { facts: any[]; first: Date; last: Date; close: Date };

function segment(facts: any[], gapMin: number): Seg[] {
  const out: Seg[] = [];
  for (const f of facts) {
    const t = new Date(f.happened_at);
    const cur = out[out.length - 1];
    if (cur && t.getTime() - cur.last.getTime() <= gapMin * 60 * 1000) {
      cur.facts.push(f); if (t > cur.last) cur.last = t;
    } else {
      out.push({ facts: [f], first: t, last: t, close: t });
    }
  }
  for (const s of out) s.close = new Date(s.last.getTime() + gapMin * 60 * 1000);
  return out;
}

// Ids come back from the model whole or, now and then, as a prefix; match either way, but only against what was shown.
function pick(id: unknown, rows: any[]): any | undefined {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s) return undefined;
  return rows.find((r) => r.id === s) ?? (s.length >= 8 ? rows.find((r) => String(r.id).startsWith(s)) : undefined);
}

async function linkAndBridge(owner: string, facts: any[], whens: any[], tz: string, fireId: string | null, asOf: Date, debug = false): Promise<any> {
  const unlinked = [];
  for (const f of facts) {
    const has = await run(`select 1 from §.links where from_kind = 'fact' and from_id = $1 limit 1`, [f.id]);
    if (has.length === 0) unlinked.push(f);
  }
  if (unlinked.length === 0) return debug ? { links: 0, bridges: 0, unlinked: 0 } : 0;
  const concepts = await conceptList(owner);
  const user =
    `${await personWords(owner)}\nLocal time now: ${local(asOf, tz)}.\n\nConcepts already known (kind: name):\n${concepts.map((c) => `${c.kind}: ${c.name}`).join("; ")}\n\n` +
    `The person's whens:\n${whensAsText(whens, tz)}\n\nFacts to link:\n${factsAsText(unlinked, tz)}`;
  const { data } = await model(owner, "reconciler", { stable: LINK_STABLE, system: "Return the links as data.", user, maxTokens: 8000, shape: LINK_SHAPE, fire: fireId, note: "link and bridge" });
  let links = 0, bridges = 0;
  const slips: string[] = [];
  for (const row of data.facts ?? []) {
    const f = pick(row.fact, unlinked);
    if (!f) { slips.push(`fact ${row.fact}`); continue; }
    for (const c of row.concepts ?? []) {
      try {
        const cid = await concept(owner, "reconciler", c.kind, String(c.name).trim().toLowerCase());
        await link(owner, "reconciler", "fact", f.id, "about", cid, `the fact's words`);
        links++;
      } catch (e) { await errorNote(owner, "reconciler", `link ${c.kind}/${c.name}: ${e}`); }
    }
    for (const w of row.whens ?? []) {
      const when = pick(w.when, whens);
      if (!when) { slips.push(`when ${w.when}`); continue; }
      try { await bridge(owner, "reconciler", f.id, when.id, w.amount ?? null, w.why); bridges++; } catch (e) { await errorNote(owner, "reconciler", `bridge ${when.id}: ${e}`); }
    }
  }
  if (slips.length) await errorNote(owner, "reconciler", `link and bridge: ids returned that match nothing shown: ${slips.join(", ")}`);
  return debug ? { links, bridges, unlinked: unlinked.length, slips, reply: data } : links;
}

// A when is stale when a fact about it (or about any when it comes after, or bridged to either) was recorded after
// its current snapshot's watermark.  The whens are the ones that stood at asOf.
async function staleWhens(owner: string, whens: any[], asOf: Date): Promise<any[]> {
  const out: any[] = [];
  for (const w of whens) {
    const r = await run(
      `select s.watermark, max(f.recorded_at) as latest
         from §.facts f
         left join §.current_snapshots s on s.subject_kind = 'when' and s.subject_id = $2
        where f.owner = $1 and f.kind = 'world' and f.recorded_at <= $3
          and (f.about = any (§.lineage($2)) or exists (select 1 from §.bridges b where b.fact_id = f.id and b.when_id = any (§.lineage($2)) and b.negates is null))
        group by s.watermark
       having s.watermark is null or date_trunc('milliseconds', max(f.recorded_at)) > s.watermark`, [owner, w.id, asOf.toISOString()]);
    if (r[0]) out.push({ id: w.id, watermark: r[0].watermark, latest: r[0].latest });
  }
  return out;
}

async function factsFor(owner: string, whenId: string, asOf: Date): Promise<any[]> {
  return await run(
    `select distinct f.* from §.facts f
      where f.owner = $1 and f.kind = 'world' and f.recorded_at <= $3
        and (f.about = any (§.lineage($2)) or exists (select 1 from §.bridges b where b.fact_id = f.id and b.when_id = any (§.lineage($2)) and b.negates is null))
      order by f.happened_at`, [owner, whenId, asOf.toISOString()]);
}

async function snapshotWhensAndEpisode(owner: string, seg: Seg | null, whens: any[], tz: string, fireId: string | null, asOf: Date, by: string, episodeId: string | null): Promise<any> {
  const stale = await staleWhens(owner, whens, asOf);
  const parts: string[] = [];
  const cites: Record<string, string[]> = {};
  for (const s of stale) {
    const w = whens.find((x) => x.id === s.id);
    if (!w) continue;
    const facts = await factsFor(owner, s.id, asOf);
    const fires = await run(`select * from §.fires where owner = $1 and when_id = $2 and kind in ('met', 'silence', 'tick') and fired_at <= $3 order by fired_at`, [owner, s.id, asOf.toISOString()]);
    const prev = await run(`select says, watermark from §.current_snapshots where subject_kind = 'when' and subject_id = $1`, [s.id]);
    cites[s.id] = facts.map((f) => f.id);
    parts.push(
      `### when ${w.id}\n${whensAsText([w], tz)}\n` +
      (prev[0] ? `What stood as of ${local(prev[0].watermark, tz)}: ${prev[0].says}\n` : "") +
      `Facts about it (recorded by now):\n${facts.length ? factsAsText(facts.slice(-40), tz) : "(none)"}\n` +
      `Readings on it:\n${fires.length ? firesAsText(fires.slice(-20), tz) : "(none)"}`);
  }
  const epText = seg
    ? `### the episode\nFrom ${local(seg.first, tz)} to ${local(seg.last, tz)}, closed ${local(seg.close, tz)}.\nIts facts:\n${factsAsText(seg.facts, tz)}`
    : "### the episode\n(no episode; whens only)";
  if (parts.length === 0 && !seg) return { whens: 0 };
  const user = `${await personWords(owner)}\nLocal time now: ${local(asOf, tz)} (${tz}).\n\nThe person's whens as they stand:\n${whensAsText(whens, tz)}\n\n${parts.join("\n\n")}\n\n${epText}`;
  const { data } = await model(owner, "reconciler", { stable: STABLE, system: "Return the snapshots as data.  One entry per when shown; the episode's story in the episode field.", user, maxTokens: 10000, shape: SNAP_SHAPE, fire: fireId, note: seg ? "episode snapshots" : "when snapshots" });
  let n = 0;
  for (const s of data.whens ?? []) {
    const st = pick(s.when, stale);
    if (!st) continue;
    const tallyRow = await run(`select §.tally($1, $2) as v`, [owner, st.id]);
    const cited = (s.cites ?? []).filter((id: string) => cites[st.id].includes(id));
    await snap(owner, "when", st.id, st.latest, by, s.says, { cites: cited.length ? cited : cites[st.id], tally: tallyRow[0]?.v, fire: fireId });
    n++;
  }
  if (seg && episodeId) {
    const wm = seg.facts.reduce((m: string, f: any) => (f.recorded_at > m ? f.recorded_at : m), seg.facts[0].recorded_at);
    await snap(owner, "episode", episodeId, wm, by, data.episode || "Nothing was written for this episode.", { facts: seg.facts.map((f) => f.id), fire: fireId });
  }
  return { whens: n, episode: !!seg };
}

// Episodes close at the moment the Reconciler wakes (asOf): every world fact recorded by then that belongs to no
// closed episode is segmented by happened time, and each segment whose gap has passed becomes an episode.  Facts that
// land late inside a closed episode's span make that episode stale and it is written again.  A day already closed
// whose record changed is closed again too, so the corrected words stand.
async function closeEpisodes(owner: string, fireId: string | null, asOf: Date, replay: boolean): Promise<any> {
  const tz = await tzOf(owner);
  const gap = Number((await setting(owner, "gap_minutes")) ?? 30);
  const by = replay ? "replay" : "reconciler";
  const today = localDate(asOf, tz);
  const rec = await read(owner, { since: new Date(asOf.getTime() - 3 * 24 * 3600 * 1000).toISOString(), until: asOf.toISOString(), limit: "all", as_of: replay ? asOf.toISOString() : undefined });
  const whens = personSide(rec.whens).filter((w: any) => new Date(w.asserted_at) <= asOf);
  const out: any[] = [];
  const touchedDays = new Set<string>();

  // late facts: a closed episode is stale when a fact in its span was recorded after its snapshot's watermark;
  // an episode with no snapshot at all (a run that stopped halfway) is stale too
  const late = await run(
    `select e.id, e.first_at, e.last_at, e.closed_at from §.episodes e
       left join §.current_snapshots s on s.subject_kind = 'episode' and s.subject_id = e.id
      where e.owner = $1 and e.kind = 'episode' and e.closed_at is not null and e.closed_at <= $2
        and (s.id is null or exists (select 1 from §.facts f where f.owner = $1 and f.kind = 'world' and date_trunc('milliseconds', f.recorded_at) > s.watermark and f.recorded_at <= $2
                      and f.happened_at between e.first_at - make_interval(mins => $3) and e.last_at + make_interval(mins => $3)))
      order by e.first_at`,
    [owner, asOf.toISOString(), gap]);
  for (const e of late) {
    const efacts = await run(`select * from §.facts where owner = $1 and kind = 'world' and recorded_at <= $2 and happened_at between $3 and $4 order by happened_at`,
      [owner, asOf.toISOString(), new Date(new Date(e.first_at).getTime() - gap * 60000).toISOString(), new Date(new Date(e.last_at).getTime() + gap * 60000).toISOString()]);
    if (efacts.length === 0) continue;
    const seg: Seg = { facts: efacts, first: new Date(e.first_at), last: new Date(e.last_at), close: new Date(e.closed_at) };
    // the Watch looks again at the episode's days: a fact that lands after a silence can turn it into met, late
    const days = [...new Set([localDate(seg.first, tz), localDate(seg.last, tz), today])].sort();
    const why = replay ? `replay, a late fact in the episode of ${local(seg.first, tz)}, looked at ${local(asOf, tz)}` : `a late fact in the episode of ${local(seg.first, tz)}`;
    const readings = await watch(owner, fireId, why, days, replay ? asOf.toISOString() : null);
    const linked = await linkAndBridge(owner, efacts, whens, tz, fireId, asOf);
    const snaps = await snapshotWhensAndEpisode(owner, seg, whens, tz, fireId, asOf, by, e.id);
    for (const f of efacts) touchedDays.add(localDate(f.happened_at, tz));
    out.push({ episode: e.id, late: true, facts: efacts.length, readings: readings.readings?.length ?? 0, linked, snaps });
  }

  // new episodes: facts in no closed episode's span, segmented by happened time
  const loose = await run(
    `select f.* from §.facts f
      where f.owner = $1 and f.kind = 'world' and f.recorded_at <= $2
        and not exists (select 1 from §.episodes e where e.owner = f.owner and e.kind = 'episode' and e.closed_at is not null
                          and f.happened_at between e.first_at - make_interval(mins => $3) and e.last_at + make_interval(mins => $3))
      order by f.happened_at`,
    [owner, asOf.toISOString(), gap]);
  const segs = segment(loose, gap).filter((s) => s.close <= asOf);
  for (const seg of segs) {
    const ep = await run(
      `insert into §.episodes (owner, kind, first_at, last_at, closed_at) values ($1, 'episode', $2, $3, $4) returning id`,
      [owner, seg.first.toISOString(), seg.last.toISOString(), asOf.toISOString()]);
    const episodeId = ep[0].id;
    const days = [...new Set([localDate(seg.first, tz), localDate(seg.last, tz), today])].sort();
    const why = replay ? `replay, episode of ${local(seg.first, tz)} closing, looked at ${local(asOf, tz)}` : `episode of ${local(seg.first, tz)} closing`;
    const readings = await watch(owner, fireId, why, days, replay ? asOf.toISOString() : null);
    const linked = await linkAndBridge(owner, seg.facts, whens, tz, fireId, asOf);
    const snaps = await snapshotWhensAndEpisode(owner, seg, whens, tz, fireId, asOf, by, episodeId);
    for (const f of seg.facts) touchedDays.add(localDate(f.happened_at, tz));
    out.push({ episode: episodeId, first: seg.first, last: seg.last, facts: seg.facts.length, readings: readings.readings?.length ?? 0, linked, snaps });
  }

  // a day already closed whose record changed is closed again
  const redone: string[] = [];
  for (const day of touchedDays) {
    if (day >= today) continue;
    const done = await run(`select 1 from §.snapshots where owner = $1 and subject_kind = 'day' and shape->>'day' = $2 limit 1`, [owner, day]);
    if (done.length) { await closeDay(owner, day, fireId, asOf, by, false); redone.push(day); }
  }
  return { closed: segs.length, late: out.filter((o) => o.late).length, episodes: out, days_redone: redone };
}

async function closeDay(owner: string, day: string, fireId: string | null, asOf: Date, by: string, lookFirst = true): Promise<any> {
  const tz = await tzOf(owner);
  const replay = by === "replay";
  if (lookFirst) await watch(owner, fireId, replay ? `replay, the day ${day} closing, looked at ${local(asOf, tz)}` : `the day ${day} closing`, [day], replay ? asOf.toISOString() : null);
  const facts = await run(
    `select * from §.facts where owner = $1 and kind = 'world' and (happened_at at time zone $2)::date = $3::date and recorded_at <= $4 order by happened_at`,
    [owner, tz, day, asOf.toISOString()]);
  const fires = await run(
    `select * from §.fires where owner = $1 and kind in ('met', 'silence') and context->>'moment' = $2 and fired_at <= $3 order by fired_at`, [owner, day, asOf.toISOString()]);
  const rec = await read(owner, { since: new Date(asOf.getTime() - 2 * 24 * 3600 * 1000).toISOString(), until: asOf.toISOString(), limit: "all", fires: false, as_of: replay ? asOf.toISOString() : undefined });
  const whens = personSide(rec.whens).filter((w: any) => new Date(w.asserted_at) <= asOf);
  const snaps = await run(`select subject_kind, subject_id, says from §.current_snapshots where owner = $1 and subject_kind in ('when', 'episode') and written_at <= $2 and watermark >= $3::date`, [owner, asOf.toISOString(), day]);
  const h = await health(owner);
  const spent = await run(`select coalesce(sum(dollars), 0) as d, count(*) as n from §.costs where owner = $1 and (at at time zone $2)::date = $3::date`, [owner, tz, day]);
  const existing = await run(`select id from §.episodes where owner = $1 and kind = 'day' and day = $2::date`, [owner, day]);
  let dayId = existing[0]?.id;
  if (!dayId) {
    const first = facts[0]?.happened_at ?? `${day}T04:00:00`;
    const last = facts[facts.length - 1]?.happened_at ?? first;
    const ep = await run(`insert into §.episodes (owner, kind, first_at, last_at, closed_at, day) values ($1, 'day', $2, $3, $4, $5::date) returning id`, [owner, first, last, asOf.toISOString(), day]);
    dayId = ep[0].id;
  }
  const prev = await run(`select says, watermark from §.current_snapshots where subject_kind = 'day' and subject_id = $1`, [dayId]);
  const user =
    `${await personWords(owner)}\nLocal time now: ${local(asOf, tz)} (${tz}).  The day to close: ${day}.\n\n` +
    `The person's whens:\n${whensAsText(whens, tz)}\n\nThe day's facts:\n${facts.length ? factsAsText(facts, tz) : "(none)"}\n\n` +
    `Readings for the day:\n${fires.length ? firesAsText(fires, tz) : "(none)"}\n\n` +
    (prev[0] ? `What stood for the day as of ${local(prev[0].watermark, tz)} (the record has changed since; write it again):\n${prev[0].says}\n\n` : "") +
    `What stands for each subject:\n${snaps.map((s: any) => `- ${s.subject_kind} ${s.subject_id}: ${s.says}`).join("\n") || "(none)"}`;
  const { data } = await model(owner, "reconciler", { stable: STABLE, system: "Return the day's snapshot as data.", user, maxTokens: 8000, shape: DAY_SHAPE, fire: fireId, note: `day ${day}` });
  const tallies: Record<string, unknown> = {};
  for (const w of whens) {
    const t = await run(`select §.tally($1, $2, ($3::date)::timestamp at time zone $4, (($3::date) + 1)::timestamp at time zone $4) as v`, [owner, w.id, day, tz]);
    if (Number(t[0]?.v?.facts ?? 0) > 0) tallies[w.id] = t[0].v;
  }
  const healthLine = `Heartbeat last ran ${h?.heartbeat_last ? local(h.heartbeat_last, tz) : "never"}; ${h?.heartbeat_errors_24h ?? 0} heartbeat errors in 24h; ${(h?.errors_24h ?? []).length} actor errors in 24h; ${h?.fires_24h ?? 0} fires in 24h; ${h?.open_questions ?? 0} open questions; ${h?.open_tasks ?? 0} open tasks.`;
  const cost = `The day cost ${Number(spent[0]?.d ?? 0).toFixed(2)} dollars over ${spent[0]?.n ?? 0} model calls.`;
  const says = `${data.day}\n\n${healthLine}  ${cost}`;
  const id = await snap(owner, "day", dayId, asOf.toISOString(), by, says, { day, facts: facts.map((f: any) => f.id), fires: fires.map((x: any) => x.id), tallies, health: h, fire: fireId });
  return { day, snapshot: id, facts: facts.length, fires: fires.length };
}

// Replay walks the record as if the Reconciler had been there: at every moment it would have woken (the gap after each
// fact was recorded, and each day's close), it closes what had closed by then, seeing only what had been recorded by
// then.  A cursor in settings remembers how far it got, so a caller loops with a few steps per call (an edge function
// has a wall clock) until more is false.
async function replay(owner: string, since: string, fireId: string | null, steps = 2): Promise<any> {
  const tz = await tzOf(owner);
  const gap = Number((await setting(owner, "gap_minutes")) ?? 30);
  const dayClose = (await setting(owner, "day_close")) ?? "04:00";
  const facts = await run(`select recorded_at, happened_at from §.facts where owner = $1 and kind = 'world' and recorded_at >= $2::date order by recorded_at`, [owner, since]);
  if (facts.length === 0) return { checkpoints: 0, steps: [], more: false };
  // the moments the Reconciler would have woken
  const moments = new Set<number>();
  for (const f of facts) moments.add(new Date(f.recorded_at).getTime() + gap * 60000);
  const firstDay = localDate(facts[0].happened_at, tz);
  const now = Date.now();
  for (let d = new Date(`${firstDay}T12:00:00Z`); d.getTime() < now + 24 * 3600000; d = new Date(d.getTime() + 24 * 3600000)) {
    const next = localDate(new Date(d.getTime() + 24 * 3600000), tz);
    const t = zoned(next, dayClose, tz).getTime();
    if (t < now) moments.add(t);
  }
  const line = [...moments].sort((a, b) => a - b).filter((t) => t <= now);
  const cursorRow = await run(`select value from §.settings where owner = $1 and key = 'replay_cursor'`, [owner]);
  let cursor = cursorRow[0]?.value ? new Date(cursorRow[0].value).getTime() : 0;
  const out: any[] = [];
  let done = 0;
  for (const t of line) {
    if (t <= cursor) continue;
    if (done >= steps) return { checkpoints: line.length, steps: out, more: true, cursor: new Date(cursor).toISOString() };
    const asOf = new Date(t);
    // a day closes at its backstop hour: the day before the local date of this moment
    const dayOf = localDate(asOf, tz);
    const isDayClose = Math.abs(zoned(dayOf, dayClose, tz).getTime() - t) < 1000;
    if (isDayClose) {
      const prev = localDate(new Date(t - 24 * 3600000), tz);
      const dayDone = await run(`select 1 from §.snapshots where owner = $1 and subject_kind = 'day' and shape->>'day' = $2 limit 1`, [owner, prev]);
      if (dayDone.length === 0) { out.push(await closeDay(owner, prev, fireId, asOf, "replay")); done++; }
    } else {
      const r = await closeEpisodes(owner, fireId, asOf, true);
      if (r.closed > 0 || r.late > 0) { out.push({ at: asOf.toISOString(), ...r }); done++; }
    }
    cursor = t;
    await run(`insert into §.settings (owner, key, value, note) values ($1, 'replay_cursor', $2, 'how far replay has walked') on conflict (owner, key) do update set value = excluded.value`, [owner, asOf.toISOString()]);
  }
  return { checkpoints: line.length, steps: out, more: false, cursor: new Date(cursor).toISOString() };
}

// The instant of a local wall time in a zone, as a Date.
function zoned(day: string, hhmm: string, tz: string): Date {
  const guess = new Date(`${day}T${hhmm}:00Z`);
  const asLocal = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (asLocal.getTime() - asUtc.getTime()));
}

async function settle(owner: string, fireId: string | null): Promise<void> {
  const h = await run(`select address from §.handlers where name = 'thinker' and enabled`);
  if (!h[0]) return;
  const secret = await vault("when_fire_listener_secret");
  await fetch(h[0].address, {
    method: "POST",
    headers: { "content-type": "application/json", "x-when-fire-secret": secret },
    body: JSON.stringify({ owner, fire: fireId, mode: "settle", schema: currentSchema() }),
  }).catch(() => {});
}

// Repair: link and bridge the given facts (or every world fact with no links) again, and show the model's reply.
async function relink(owner: string, factIds: string[] | null): Promise<any> {
  const tz = await tzOf(owner);
  const facts = factIds?.length
    ? await run(`select * from §.facts where owner = $1 and kind = 'world' and id = any ($2::uuid[]) order by happened_at`, [owner, factIds])
    : await run(`select f.* from §.facts f where f.owner = $1 and f.kind = 'world' and not exists (select 1 from §.links l where l.from_kind = 'fact' and l.from_id = f.id) order by f.happened_at limit 30`, [owner]);
  const rec = await read(owner, { since: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), limit: "all", fires: false });
  const whens = personSide(rec.whens);
  return await linkAndBridge(owner, facts, whens, tz, null, new Date(), true);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await secretOk(req))) return json({ error: "no" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  return await withSchema(body.schema, async () => {
    let owner = body.owner;
    let bounds: any = {};
    if (body.fire) {
      const f = await run(`select f.owner, w.bounds, f.kind from §.fires f join §.whens w on w.id = f.when_id where f.id = $1`, [body.fire]);
      owner ??= f[0]?.owner; bounds = f[0]?.bounds ?? {};
    }
    if (!owner) return json({ error: "no owner" }, 400);
    const mode = body.mode ?? bounds.mode ?? "episode";
    try {
      const stop = await belted(owner, "reconciler");
      if (stop) { await errorNote(owner, "reconciler", `seatbelt: ${stop}`); return json({ stopped: stop }); }
      if (mode === "replay") {
        if (!body.since) return json({ error: "replay needs since (YYYY-MM-DD)" }, 400);
        return json(await replay(owner, body.since, body.fire ?? null, Number(body.steps ?? 2)));
      }
      if (mode === "link") return json(await relink(owner, Array.isArray(body.facts) ? body.facts : null));
      if (mode === "day") {
        const tz = await tzOf(owner);
        const day = body.day ?? localDate(new Date(Date.now() - 24 * 3600 * 1000), tz);
        return json(await closeDay(owner, day, body.fire ?? null, new Date(), "reconciler"));
      }
      const out = await closeEpisodes(owner, body.fire ?? null, new Date(), false);
      if ((bounds.then ?? body.then) === "thinker" && out.closed > 0) await settle(owner, body.fire ?? null);
      return json(out);
    } catch (e) {
      await errorNote(owner, "reconciler", e, { fire: body.fire, mode });
      return json({ error: String(e) }, 500);
    }
  });
});
