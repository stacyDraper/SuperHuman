"""mcp_call.py <function> <tool> '<json args>' [--schema wf_next]: call a connector tool over JSON-RPC and print the text."""
import json, os, sys, time, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
TOKEN = open(os.path.join(here, "mcp_token")).read().strip()
fn, tool = sys.argv[1], sys.argv[2]
args = json.loads(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith("--") else {}
schema = sys.argv[sys.argv.index("--schema") + 1] if "--schema" in sys.argv else None
url = f"https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/{fn}?token={TOKEN}" + (f"&schema={schema}" if schema else "")
if tool in ("initialize", "tools/list", "ping"):
    body = {"jsonrpc": "2.0", "id": 1, "method": tool, "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}} if tool == "initialize" else {}}
else:
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": args}}
req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={"content-type": "application/json"})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=600) as r: out = r.read().decode()
except urllib.error.HTTPError as e: out = f"HTTP {e.code}: " + e.read().decode()[:2000]
print(f"{time.time()-t0:.1f}s")
try:
    j = json.loads(out)
    res = j.get("result", j)
    if isinstance(res, dict) and "content" in res:
        print("isError" if res.get("isError") else "ok")
        for c in res["content"]: print(c.get("text", "")[:int(os.environ.get("CUT", "5000"))])
    else: print(json.dumps(res, indent=1)[:5000])
except Exception: print(out[:3000])
