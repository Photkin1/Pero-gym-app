import sys, json, yaml, jsonschema
root = sys.argv[1]
schema = json.load(open(f"{root}/schema/program.schema.json"))
lib = yaml.safe_load(open(f"{root}/library/exercises.yaml"))
exdef = schema["$defs"]["exercise"]
resolver_schema = dict(schema); 
ok = True
ids = {}
for e in lib["exercises"]:
    try: jsonschema.validate(e, {**exdef, "$defs": schema["$defs"]})
    except jsonschema.ValidationError as er: print("LIB", e.get("id"), er.message); ok=False
    if e["id"] in ids: print("dup", e["id"]); ok=False
    ids[e["id"]] = e
import glob
for f in sorted(glob.glob(f"{root}/programs/*.yaml")):
    p = yaml.safe_load(open(f))
    try: jsonschema.validate(p, schema)
    except jsonschema.ValidationError as er: print(f, list(er.path), er.message); ok=False; continue
    allx = dict(ids); allx.update({c["id"]: c for c in p.get("custom_exercises", [])})
    wids = {w["id"] for w in p["workouts"]}
    sch = p["schedule"]; refs = sch["days"].values() if sch["type"]=="weekly" else [x for x in sch["order"] if x!="rest"]
    for r in refs:
        if r not in wids: print(f, "schedule ref", r); ok=False
    for w in p["workouts"]:
        for x in w["exercises"]:
            e = allx.get(x["exercise"])
            if not e: print(f, "no exercise", x["exercise"]); ok=False; continue
            if "variant" in x and x["variant"] not in {v["id"] for v in e.get("variants", [])}: print(f, "bad variant", x); ok=False
            if x.get("sides")=="each" and e.get("sides","both")=="both": print(f, "sides each on both-only", x["exercise"]); ok=False
            if e["type"]=="time" and not str(x["reps"]).endswith("s"): print(f,"time reps",x); ok=False
    print("OK " if ok else "..", f.split("/")[-1], len(p["workouts"]), "workouts")
print("ALL OK" if ok else "ERRORS", len(ids), "exercises")
