"""q.py "<sql>" [--next] [--json]: run SQL through the copy door, print rows in full (text) or as JSON."""
import json, sys
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from wf import door, to_next
a = [x for x in sys.argv[1:] if not x.startswith("--")]
sql = a[0]
if "--next" in sys.argv: sql = to_next(sql)
out = door({"verb": "run", "sql": sql})
if "error" in out: print("ERROR", out.get("status"), out["error"]); sys.exit(1)
rows = out.get("rows", [])
if "--json" in sys.argv: print(json.dumps(rows, default=str, ensure_ascii=False, indent=1))
else:
    for r in rows:
        print(" | ".join(f"{k}={v}" for k, v in r.items()))
        print()
