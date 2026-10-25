"""Carry the first build's record and shelf into the new schema.
usage: carry.py <copies_dir> <schema> [--facts-since iso]
Whens and world facts keep their ids.  The system's old notes are not carried; replay regenerates what stands.
The thinker's open question becomes a question row.  Reasons become concepts linked with because."""
import json, os, subprocess, sys, tempfile, uuid
from datetime import datetime, timezone

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from wf import door  # noqa: E402

copies, schema = sys.argv[1], sys.argv[2]
L = lambda name: json.load(open(os.path.join(copies, name)))["rows"]
whens, facts = L("when_fire.whens.json"), L("when_fire.facts.json")
sources, claims = L("knowledge.sources.json"), L("knowledge.claims.json")
embeds = {r["claim_id"]: r["embedding"] for r in L("knowledge.claim_embeddings.json")}

q = lambda s: door({"verb": "run", "sql": s})
owner = q(f"select id from {schema}.people where kind = 'person' and name = 'Stacy'")["rows"][0]["id"]
NOW = datetime.now(timezone.utc).isoformat()
ENDED_24 = "2026-10-25T03:59:00+00:00"   # the end of October 24 in New York, the day those whens ended


def condition_of(old):
    if old is None:
        return None
    if "at" in old:
        return {k: v for k, v in old.items() if k in ("at", "days", "tz")}
    if "on_fire_of" in old:
        return {"on": old["on_fire_of"], "handler": old.get("handler")}
    if "after_fact_from" in old:
        return {"after": old["after_fact_from"]}
    if "quiet_after_fact_from" in old:
        return {"quiet": old["quiet_after_fact_from"], "minutes": old.get("minutes", 30)}
    if "silence_after_fire_of" in old:
        return None
    return None


def kind_of(c):
    if not c:
        return "worded"
    if "on" in c: return "on"
    if "at" in c or "every" in c: return "tick"
    if "after" in c: return "after"
    if "quiet" in c: return "quiet"
    return "worded"


rows = []
for w in whens:
    c = condition_of(w["condition"])
    shape = dict(w.get("shape") or {})
    until_at = None
    if w["id"].startswith("f991d312"):
        c = {"at": "06:50", "dates": ["2026-10-25", "2026-11-22", "2026-12-20"], "tz": "America/New_York"}
    if (w.get("until_words") or "").lower().startswith("ended october 24"):
        until_at = ENDED_24
    if w["affirmed_by"] == "ai":
        until_at = NOW
        shape["carried"] = "the first build's own when; ended at the rewrite, October 25, 2026"
    if w.get("suggested_then"):
        shape["suggested_then"] = w["suggested_then"]
    rows.append({
        "id": w["id"], "owner": owner, "asserted_at": w["affirmed_at"], "asserted_by": w["affirmed_by"],
        "words": w["words"], "condition_words": w.get("condition_words"), "condition": c, "kind": kind_of(c),
        "handler": None, "bounds": w.get("bounds"), "bundle": w.get("bound_to"),
        "until_words": w.get("until_words"), "until_at": until_at, "supersedes": w.get("supersedes"), "shape": shape or None,
    })
# parents before children: bundles first, then by supersedes order (ids are kept, FKs need order)
by_id = {r["id"]: r for r in rows}
def depth(r, seen=0):
    d = 0
    for key in ("bundle", "supersedes"):
        p = r.get(key)
        if p and p in by_id and seen < 10:
            d = max(d, 1 + depth(by_id[p], seen + 1))
    return d
depths = {r["id"]: depth(r) for r in rows}
rows.sort(key=lambda r: (depths[r["id"]], r["asserted_at"]))
print(door({"verb": "in", "schema": schema, "table": "whens", "rows": rows}))

# facts: the world's, kept; the first build's own notes left behind, except the two the person still has in play
SYSTEM = {"judge", "reconciler", "thinker", "listener:reconcile", "listener:echo", "listener:ai", "listener:think"}
frows, notes = [], []
for f in sorted(facts, key=lambda r: r["recorded_at"]):
    src = f["source"]
    if src in SYSTEM or src.startswith("listener:"):
        if f["id"].startswith("7264a42a") or f["id"].startswith("c489b69a") or f["id"].startswith("76277b6a"):
            notes.append(f)
        continue
    said_by = "stacy" if src == "stacy" else ("claude" if src in ("ai", "mcp") else src)
    kind = "world" if src == "stacy" else "note"
    frows.append({
        "id": f["id"], "owner": owner, "happened_at": f["happened_at"], "recorded_at": f["recorded_at"],
        "said_by": said_by, "kind": kind, "said": f["said"], "about": f.get("about"), "corrects": f.get("corrects"),
        "cites": None, "shape": f.get("shape"),
    })
for f in notes:
    frows.append({
        "id": f["id"], "owner": owner, "happened_at": f["happened_at"], "recorded_at": f["recorded_at"],
        "said_by": "thinker", "kind": "note", "said": f["said"], "about": f.get("about"), "corrects": None, "cites": None,
        "shape": f.get("shape"),
    })
# corrections point at earlier facts: parents first
frows.sort(key=lambda r: (1 if r.get("corrects") else 0, r["recorded_at"]))
print(door({"verb": "in", "schema": schema, "table": "facts", "rows": frows}))

# bridges: a fact the person pointed at a when counts toward it, stated
brows = [{"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "bridge:" + r["id"] + ":" + r["about"])), "owner": owner, "made_by": "stated", "fact_id": r["id"], "when_id": r["about"], "cites": "the person named the when when he recorded it"}
         for r in frows if r.get("about") and r["kind"] == "world"]
print(door({"verb": "in", "schema": schema, "table": "bridges", "rows": brows}))

# the open question the thinker asked on October 24
c489 = next((f for f in notes if f["id"].startswith("c489b69a")), None)
already = q(f"select 1 from {schema}.questions where shape->>'carried_from_fact' like 'c489b69a%'")["rows"]
if c489 and not already:
    words = c489["said"].split("Question for Stacy Draper: ", 1)[-1]
    print(q(f"""select {schema}.question('{owner}', 'thinker', $q${words}$q$, 'when', '{c489["about"]}', 'person',
                 jsonb_build_object('carried_from_fact', '{c489["id"]}', 'asked_at', '{c489["recorded_at"]}'))"""))

# reasons, as concepts, linked with because
def reason(name, words, when_ids):
    r = q(f"select {schema}.concept('{owner}', 'stacy', 'reason', $n${name}$n$, $w${words}$w$) as id")
    cid = r["rows"][0]["id"]
    for wid in when_ids:
        q(f"select {schema}.link('{owner}', 'stacy', 'when', '{wid}', 'because', '{cid}', 'from the words of the assertion')")
    return cid

by_prefix = lambda p: next(w["id"] for w in whens if w["id"].startswith(p))
calves_bundle = by_prefix("d34af8ea")
calves_children = [w["id"] for w in whens if w.get("bound_to") == calves_bundle]
reason("the gift", "I jump rope because it develops the gift God gave me: a calf built for spring.  Fun; run light; a harder session a week for the heart.", [calves_bundle] + calves_children)
reason("crain's plan", "Dr. Crain, July 30, 2026: seated calf raises 3 sets of 15 after rope; two full rest days between hard calf days.", [by_prefix("33c24876"), by_prefix("cd4e74d9")])
gtg = [w["id"] for w in whens if w["id"].startswith(("aa99e956", "8cc383c2", "9e4ac0a1"))]
gtg_children = [w["id"] for w in whens if w.get("bound_to") in gtg and w["affirmed_by"] == "stacy"]
reason("keep moving", "Grease the groove every day to keep my joints, body and muscles moving.  Submaximal, about half of what I could do.", gtg + gtg_children)

# the shelf
srows = [{"id": s["id"], "owner": owner, "captured_at": s["captured_at"], "happened_at": s.get("happened_at"), "origin": s["origin"],
          "kind": s.get("kind_words"), "title": s.get("title"), "text": s["text"], "media_path": None, "media_type": None, "shape": s.get("shape")}
         for s in sources]
print(door({"verb": "in", "schema": schema, "table": "sources", "rows": srows}))
crows = [{"id": c["id"], "owner": owner, "made_at": c["made_at"], "made_by": c["made_by"], "source_id": c["source_id"], "said": c["said"],
          "about_words": c.get("about_words"), "supersedes": c.get("supersedes"), "embedding": embeds.get(c["id"]) or c.get("embedding"), "shape": c.get("shape")}
         for c in sorted(claims, key=lambda r: (1 if r.get("supersedes") else 0, r["made_at"]))]
total = 0
for i in range(0, len(crows), 250):
    r = door({"verb": "in", "schema": schema, "table": "claims", "rows": crows[i:i + 250]})
    if "error" in r:
        print("claims ERROR", r); break
    total += r["inserted"]
print("claims inserted", total, "of", len(crows))
print(q(f"select (select count(*) from {schema}.whens) whens, (select count(*) from {schema}.facts) facts, (select count(*) from {schema}.bridges) bridges, (select count(*) from {schema}.sources) sources, (select count(*) from {schema}.claims) claims, (select count(*) from {schema}.claims where embedding is not null) embedded, (select count(*) from {schema}.concepts where kind='reason') reasons, (select count(*) from {schema}.open_questions) questions")["rows"])
