"""Build helper for the rewrite.
  wf.py run  <file.sql> [--next]      run a SQL file through the copy door; --next substitutes when_fire -> wf_next and functions/v1/ -> functions/v1/next-
  wf.py sql  "<sql>"   [--next]       run a SQL string
  wf.py in   <schema> <table> <json>  load rows (a copy file's rows array) into schema.table
  wf.py out  <schema> <table> <path>  dump a table to a file
"""
import json, os, re, sys, time, urllib.request

URL = "https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/copy"
SECRET = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "copy_secret")).read().strip()


def door(body, timeout=600):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "x-copy-secret": SECRET})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()[:3000], "status": e.code}


def to_next(text):
    text = re.sub(r"\bwhen_fire\b", "wf_next", text)
    return text


def main():
    a = sys.argv[1:]
    nxt = "--next" in a
    a = [x for x in a if x != "--next"]
    verb = a[0]
    if verb in ("run", "sql"):
        text = open(a[1]).read() if verb == "run" else a[1]
        if nxt:
            text = to_next(text)
        t0 = time.time()
        out = door({"verb": "run", "sql": text})
        if "error" in out:
            print("ERROR", out.get("status"), out["error"])
            sys.exit(1)
        print(f"ok {out.get('seconds')}s count={out.get('count')}")
        for r in out.get("rows", [])[:50]:
            print(json.dumps(r, default=str)[:400])
    elif verb == "in":
        schema, table, path = a[1], a[2], a[3]
        rows = json.load(open(path))
        rows = rows["rows"] if isinstance(rows, dict) else rows
        total = 0
        for i in range(0, len(rows), 500):
            out = door({"verb": "in", "schema": schema, "table": table, "rows": rows[i:i + 500]})
            if "error" in out:
                print("ERROR", out); sys.exit(1)
            total += out["inserted"]
        print(f"{schema}.{table}: inserted {total} of {len(rows)}")
    elif verb == "out":
        schema, table, path = a[1], a[2], a[3]
        out = door({"verb": "out", "schema": schema, "table": table})
        if "error" in out:
            print("ERROR", out); sys.exit(1)
        json.dump(out, open(path, "w"))
        print(f"{schema}.{table}: {out['count']} rows -> {path}")


if __name__ == "__main__":
    main()
