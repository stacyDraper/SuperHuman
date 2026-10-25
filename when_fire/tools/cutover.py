"""The cutover, Sunday, October 25, 2026: the old when_fire becomes when_fire_v1, the rewrite becomes when_fire.
Steps print as they go; stop at the first error."""
import json, subprocess, sys, time
sys.path.insert(0, ".")
from wf import door

ORDER = ["people", "settings", "caps", "relations", "handlers", "whens", "sources", "facts", "fires", "concepts", "links", "bridges",
         "episodes", "snapshots", "questions", "question_events", "costs", "tasks", "task_events", "claims"]

def run(sql, label):
    t0 = time.time()
    out = door({"verb": "run", "sql": sql})
    if "error" in out:
        print(f"FAILED {label}: {out['error'][:1500]}"); sys.exit(1)
    print(f"ok {label} ({time.time()-t0:.1f}s, count={out.get('count')})")
    return out.get("rows", [])

step = sys.argv[1] if len(sys.argv) > 1 else "all"

if step in ("all", "1"):
    run("select cron.unschedule('when_fire_heartbeat'); select cron.unschedule('wf_next.heartbeat');", "1 stop the old heartbeat and the scratch heartbeat")
    run("alter schema when_fire rename to when_fire_v1;", "2 rename the old schema to when_fire_v1")
if step in ("all", "3"):
    for f in ["001_when_fire_tables.sql", "002_when_fire_doors.sql", "003_when_fire_bus.sql"]:
        run(open(f"/home/claude/build/when_fire/migrations/{f}").read(), f"3 apply {f}")
if step in ("all", "4"):
    for t in ORDER:
        cols = run(f"select column_name from information_schema.columns where table_schema='when_fire' and table_name='{t}' and is_generated='NEVER' order by ordinal_position", f"4 columns of {t}")
        names = ", ".join(c["column_name"] for c in cols)
        run(f"insert into when_fire.{t} ({names}) select {names} from wf_next.{t};", f"4 copy {t}")
if step in ("all", "5"):
    rows = run("select (select count(*) from when_fire.whens) whens, (select count(*) from when_fire.facts) facts, (select count(*) from when_fire.claims) claims, (select count(*) from when_fire.snapshots) snapshots, (select count(*) from cron.job where jobname='when_fire.heartbeat') heartbeat_jobs", "5 counts")
    print(rows)
    run("drop function if exists public.raise_fire; drop function if exists public.when_fire_model_key; drop function if exists public.when_fire_setting; drop function if exists public.when_fire_listener_secret; drop function if exists public.when_fire_mcp_token; drop function if exists public.when_fire_health;", "5 drop the old public doors")
