import json, subprocess, sys
schema = sys.argv[1] if len(sys.argv) > 1 else "wf_next"
owner = sys.argv[2] if len(sys.argv) > 2 else "a7af14dc-0552-43c3-a99c-897683abb43e"
for i in range(60):
    out = subprocess.run(["python3", "call.py", "reconciler", json.dumps({"owner": owner, "mode": "replay", "since": "2026-10-21", "steps": 1, "schema": schema})], capture_output=True, text=True).stdout
    lines = out.splitlines()
    try:
        j = json.loads("\n".join(lines[1:]))
    except Exception:
        print("pass", i, lines[0] if lines else "", out[:800]); break
    print(f"pass {i} {lines[0]} checkpoints={j.get('checkpoints')} cursor={j.get('cursor','')[:16]} more={j.get('more')}")
    for s in j.get("steps", []):
        if "episodes" in s or "late" in s:
            for e in s.get("episodes", []): print("   " + ("late episode " + e.get("episode", "")[:8] if e.get("late") else "episode " + str(e.get("first", ""))[:16]), "facts", e.get("facts"), "readings", e.get("readings"), "linked", e.get("linked"), "snaps", e.get("snaps"))
            if s.get("days_redone"): print("   days redone", s["days_redone"])
        elif "day" in s: print("   day", s["day"], "facts", s["facts"], "fires", s["fires"])
        elif "error" in s: print("   ERROR", s)
    if not j.get("more"): break
