"""Independent reader QA for packages produced by scripts/smoke.mjs; no native UI."""
import json
import math
from pathlib import Path
import sys
import ezdxf

report_file = Path(sys.argv[1]) if len(sys.argv)>1 else max(Path(".local/smoke").glob("*/report.json"),key=lambda p:p.stat().st_mtime)
report = json.loads(report_file.read_text(encoding="utf-8"))
assert report["success"], "Smoke run must succeed first"
results = []
for package in report["packages"]:
    dxf_file = Path(package["artifacts"][0]["path"])
    design = json.loads(Path(package["artifacts"][1]["path"]).read_text(encoding="utf-8"))
    document = ezdxf.readfile(dxf_file)
    audit = document.audit()
    assert document.units == 6, "DXF units must be metres"
    assert not audit.errors and not audit.fixes, "DXF must parse without repairs"
    entities = list(document.modelspace())
    expected = design["preview"]["drawing"]
    assert len(entities) == len(expected)
    for entity, line in zip(entities, expected):
        assert entity.dxftype() == "POLYLINE" and entity.is_3d_polyline
        assert bool(entity.is_closed) == line["closed"]
        assert entity.dxf.layer == line["layer"]
        points = [tuple(v.dxf.location) for v in entity.vertices]
        assert len(points) == len(line["points"])
        for actual, target in zip(points, line["points"]):
            assert all(math.isclose(a, b, rel_tol=0, abs_tol=1e-9) for a, b in zip(actual, target))
    results.append({"kind":package["kind"], "entities":len(entities), "errors":0, "repairs":0, "units":"m"})
output = {"independentReader":"ezdxf "+ezdxf.__version__, "success":True, "packages":results, "nativeImportVerified":False}
report_file.with_name("dxf-qa.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
print(json.dumps(output, indent=2))
