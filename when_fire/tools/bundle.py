"""Print the files array for a function deploy as JSON: bundle.py <function dir name> [--next]
Includes lib.ts, watch.ts when imported, and index.ts.  --next substitutes when_fire -> wf_next for a scratch deploy."""
import json, os, re, sys

root = "/home/claude/build/when_fire/functions"
name = sys.argv[1]
nxt = "--next" in sys.argv
idx = open(os.path.join(root, name, "index.ts")).read()
files = [{"name": "index.ts", "content": idx}]
for shared in ("lib.ts", "watch.ts"):
    if f'"./{shared}"' in idx or (shared == "lib.ts" and '"./watch.ts"' in idx):
        files.append({"name": shared, "content": open(os.path.join(root, shared)).read()})
if nxt:
    for f in files:
        f["content"] = re.sub(r"\bwhen_fire\b", "wf_next", f["content"])
print(json.dumps(files, ensure_ascii=False))
