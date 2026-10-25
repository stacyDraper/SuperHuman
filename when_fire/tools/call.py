"""call.py <function> '<json body>'  -- POST to an actor with the shared secret; prints the reply."""
import json, os, sys, time, urllib.request
SECRET = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "copy_secret")).read().strip()
fn, body = sys.argv[1], json.loads(sys.argv[2])
req = urllib.request.Request(f"https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/{fn}", data=json.dumps(body).encode(), method="POST",
                             headers={"content-type": "application/json", "x-when-fire-secret": SECRET})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=900) as r:
        out = r.read().decode()
except urllib.error.HTTPError as e:
    out = f"HTTP {e.code}: " + e.read().decode()[:3000]
print(f"{time.time()-t0:.1f}s")
try:
    print(json.dumps(json.loads(out), indent=1)[:6000])
except Exception:
    print(out[:6000])
