"""Copy whole tables off the database through the copy door into a dated folder.
usage: copy_out.py <out_dir> <schema.table> [<schema.table> ...]
The secret is read from the file named in COPY_SECRET_FILE (default ./copy_secret)."""
import json, os, sys, time, urllib.request

URL = "https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/copy"
out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
secret = open(os.environ.get("COPY_SECRET_FILE", os.path.join(os.path.dirname(__file__), "copy_secret"))).read().strip()
summary = {}
for name in sys.argv[2:]:
    schema, table = name.split(".")
    body = json.dumps({"schema": schema, "table": table}).encode()
    req = urllib.request.Request(URL, data=body, method="POST",
                                 headers={"content-type": "application/json", "x-copy-secret": secret})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    j = json.loads(data)
    path = os.path.join(out_dir, f"{schema}.{table}.json")
    with open(path, "wb") as f:
        f.write(data)
    summary[name] = {"count": j["count"], "bytes": len(data), "seconds": round(time.time() - t0, 1)}
    print(f"{name}: {j['count']} rows, {len(data):,} bytes, {summary[name]['seconds']}s")
with open(os.path.join(out_dir, "copy_summary.json"), "w") as f:
    json.dump({"copied_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "tables": summary}, f, indent=1)
