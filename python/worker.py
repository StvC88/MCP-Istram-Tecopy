"""One JSON request/response per process. Never execute model-provided Python or shell."""
import collections
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

class BridgeError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

def fail(code, message):
    raise BridgeError(code, message)

def digest(file):
    h = hashlib.sha256()
    with open(file, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def processes():
    if sys.platform != "win32":
        fail("WINDOWS_REQUIRED", "Native ISTRAM operations require an interactive Windows session")
    result = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, check=True)
    text = result.stdout.decode("mbcs")
    return [{"name": row[0], "pid": int(row[1])} for row in csv.reader(io.StringIO(text))
            if len(row)>1 and row[0].lower() in ("istram.exe", "istramx.exe", "arranque.exe")]

def load_profile():
    file = os.environ.get("ISTRAM_ADAPTER_PROFILE")
    if not file:
        fail("ADAPTER_REQUIRED", "Configure a locally verified adapter profile; no shipped recipe is certified")
    profile = json.loads(Path(file).read_text(encoding="utf-8"))
    evidence = profile.get("evidence", {})
    runs = evidence.get("runs", [])
    candidate = profile.get("status") == "candidate" and os.environ.get("ISTRAM_ACCEPTANCE_MODE") == "1"
    if not candidate and (profile.get("status") != "verified" or len(runs) < 20 or len(set(r.get("nativeSessionId") for r in runs if r.get("nativeSessionId"))) < 2):
        fail("ADAPTER_UNVERIFIED", "Profile needs 20 successful runs in two sessions")
    if not candidate and any(r.get("success") is not True or not r.get("reportSha256") or not r.get("reportPath") or not r.get("nativeSessionId") for r in runs):
        fail("ADAPTER_UNVERIFIED", "Acceptance evidence is incomplete")
    if not candidate:
        reports = set()
        run_ids = set()
        for run in runs:
            report_file = bound_file(Path(file).resolve().parent, run["reportPath"])
            if not report_file.is_file() or digest(report_file) != run["reportSha256"]:
                fail("ADAPTER_UNVERIFIED", "Acceptance report is absent or its hash differs")
            report = json.loads(report_file.read_text(encoding="utf-8"))
            if report.get("success") is not True or run["nativeSessionId"] not in report.get("nativeSessionIds", []) or len(set(report.get("nativeSessionIds", []))) < 2 or report.get("engineeringAssertionsPassed") is not True:
                fail("ADAPTER_UNVERIFIED", "Report does not prove native sessions and engineering assertions")
            reports.add(str(report_file))
            run_ids.add(report.get("runId"))
        if len(reports) < 20 or len(run_ids - {None, ""}) < 20:
            fail("ADAPTER_UNVERIFIED", "Twenty distinct acceptance reports and run IDs are required")
    exe = Path(os.environ.get("ISTRAM_PATH", r"C:\Ispol")) / "Istram.exe"
    if not exe.is_file() or digest(exe) != profile.get("binarySha256"):
        fail("VERSION_MISMATCH", "Verified profile does not match the installed executable hash")
    for name, expected in profile.get("binaryHashes", {}).items():
        binary = bound_file(exe.parent, name)
        if not binary.is_file() or digest(binary) != expected:
            fail("VERSION_MISMATCH", "A verified native component hash differs")
    return profile, exe

def check_guard(app, guard, params, directory=False):
    if not guard:
        fail("WORKING_DIRECTORY_GUARD_REQUIRED" if directory else "PROJECT_GUARD_REQUIRED",
             "Adapter must verify the active working directory" if directory else "Adapter must verify the loaded project")
    control = app.window(**guard["window"]).child_window(**guard["selector"])
    control.wait("exists visible", timeout=10)
    actual = control.window_text()
    if directory:
        expected = Path(params["projectPath"]).resolve()
        if not Path(actual).is_absolute() or Path(actual).resolve() != expected:
            fail("WRONG_WORKING_DIRECTORY", "Active ISTRAM directory differs from the managed copy")
    elif actual != expand(guard["expected"], params):
        fail("WRONG_PROJECT", "Loaded project identity differs from the managed copy")

def check_context(app, profile, params):
    check_guard(app, profile.get("projectGuard"), params)
    check_guard(app, profile.get("workingDirectoryGuard"), params, directory=True)

def snapshot():
    active = processes()
    from pywinauto import Application
    snapshots=[]
    for proc in active:
        if proc["name"].lower() not in ("istram.exe", "istramx.exe"):
            continue
        app=Application(backend="uia").connect(process=proc["pid"], timeout=10)
        windows=[]
        for window in app.windows():
            windows.append({"title":window.window_text(), "handle":window.handle,
                "controls":[{"name":c.window_text(),"type":c.element_info.control_type,
                             "automationId":c.element_info.automation_id}
                            for c in window.descendants()[:400]]})
        snapshots.append({**proc,"windows":windows})
    return {"processes":active,"snapshots":snapshots,"licensedModulesVerified":False}

def bound_file(root, relative):
    root = root.resolve()
    file = root / relative
    if Path(relative).is_absolute() or ".." in Path(relative).parts:
        fail("PATH_ESCAPE", "Expected relative project file")
    cursor = root
    for part in Path(relative).parts:
        cursor /= part
        if cursor.is_symlink():
            fail("SYMLINK", "Linked project path refused")
    file = file.resolve()
    if not file.is_relative_to(root):
        fail("PATH_ESCAPE", "Artifact leaves project")
    return file

def expand(value, params):
    text = str(value)
    for key in ("projectPath","projectFile","outputPath"):
        text = text.replace("{"+key+"}",str(params.get(key,"")))
    if re.search(r"\{[A-Za-z]+\}",text):
        fail("MISSING_PARAMETER","Unresolved recipe parameter")
    return text

def action(params):
    profile, exe = load_profile()
    name=params["action"]
    recipe=profile.get("actions",{}).get(name)
    if not recipe:
        fail("UNSUPPORTED_ACTION", "No verified recipe for "+name)
    if not profile.get("workingDirectoryGuard"):
        fail("WORKING_DIRECTORY_GUARD_REQUIRED", "Adapter must verify the active working directory before native writes")
    if not profile.get("projectGuard"):
        fail("PROJECT_GUARD_REQUIRED", "Adapter must verify the loaded project")
    steps = recipe.get("steps", [])
    if not steps or not any(s.get("kind")=="verify_text" for s in steps):
        fail("POSTCONDITION_REQUIRED", "Recipe must contain an explicit result check before it can run")
    if any(s.get("kind") not in ("invoke", "set_text", "wait", "verify_text") for s in steps):
        fail("UNSUPPORTED_STEP", "Recipe contains an unsupported step")
    root=Path(params["projectPath"]).resolve()
    if not (root/".istram-mcp"/"copy.json").is_file():
        fail("NOT_MANAGED_COPY", "Native actions require a managed project copy")
    before={a:digest(bound_file(root,a)) if bound_file(root,a).is_file() else None for a in recipe.get("artifacts",[])}
    if name not in ("open_project", "close_project") and not before:
        fail("ARTIFACT_REQUIRED", "Native computation must declare its result artifacts")
    session_file=root/".istram-mcp"/"session.json"
    from pywinauto import Application
    started=False
    if name == "open_project":
        if processes():
            fail("SESSION_BUSY", "Close existing ISTRAM sessions before opening a managed copy")
        arguments=[expand(a,params) for a in recipe.get("arguments",[])]
        try:
            app=Application(backend="uia").start(
                subprocess.list2cmdline([str(exe)]+arguments),work_dir=str(root),timeout=30)
        except Exception as error:
            fail("OUTCOME_UNCERTAIN", "Native launch may have started: "+str(error))
        started=True
    else:
        if not session_file.is_file():
            fail("SESSION_REQUIRED","Open this managed copy first")
        session=json.loads(session_file.read_text())
        app=Application(backend="uia").connect(process=session["pid"],path=str(exe),timeout=10)
        if session.get("binarySha256") != profile["binarySha256"] or not session.get("sessionId"):
            fail("SESSION_MISMATCH", "Managed session belongs to an older or different verified executable")
        check_context(app, profile, params)
    session_id = str(uuid.uuid4()) if started else session["sessionId"]
    try:
        for step in steps:
            if started and step["kind"] in ("invoke", "set_text"):
                check_guard(app, profile.get("workingDirectoryGuard"), params, directory=True)
            if not started and name != "close_project" and step["kind"] in ("invoke", "set_text"):
                check_context(app, profile, params)
            window=app.window(**step["window"])
            window.wait("exists visible enabled",timeout=min(step.get("timeout",30),1800))
            allowed=step.get("allowedWindows",[])
            if allowed and any(not any(re.fullmatch(p,w.window_text()) for p in allowed) for w in app.windows()):
                fail("UNEXPECTED_DIALOG","Unexpected top-level window; no further actions performed")
            control=window.child_window(**step["selector"])
            control.wait("exists visible enabled",timeout=min(step.get("timeout",30),1800))
            if step["kind"]=="invoke":
                control.wrapper_object().invoke()
            elif step["kind"]=="set_text":
                control.set_edit_text(expand(step["value"],params))
            elif step["kind"]=="wait":
                pass
            elif step["kind"]=="verify_text":
                if control.window_text() != expand(step["value"],params):
                    fail("POSTCONDITION_FAILED","Control text differs")
            else:
                fail("UNSUPPORTED_STEP","Recipe contains an unsupported step")
        if not any(s["kind"]=="verify_text" for s in recipe["steps"]):
            fail("POSTCONDITION_REQUIRED","Verified recipe must contain an explicit result check")
        after={}
        for relative,old in before.items():
            file=bound_file(root,relative)
            if not file.is_file():
                fail("POSTCONDITION_FAILED","Expected artifact is absent")
            new=digest(file)
            if new==old and recipe.get("requireArtifactChange",True):
                fail("POSTCONDITION_FAILED","Artifact did not change; computation cannot be proved")
            after[relative]=new
        if name == "close_project":
            app.wait_for_process_exit(timeout=30)
            if processes():
                fail("SESSION_STILL_OPEN", "Native session remains active after the close recipe")
        else:
            check_context(app, profile, params)
        if name=="open_project":
            session_file.write_text(json.dumps({"pid":app.process,"binarySha256":profile["binarySha256"],"sessionId":session_id}))
        return {"action":name,"pid":app.process,"nativeSessionId":session_id,"binarySha256":profile["binarySha256"],
                "workingDirectoryVerified":True,"artifacts":after,"verified":profile.get("status")=="verified"}
    except Exception as error:
        # UI changes may have occurred. Never silently retry a native action.
        fail("OUTCOME_UNCERTAIN",str(error))

def validate_ifc(params):
    import ifcopenshell
    import ifcopenshell.validate
    import ifcopenshell.util.element
    import ifcopenshell.util.unit
    model=ifcopenshell.open(params["filePath"])
    logger=ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(model,logger,express_rules=True)
    counts=dict(collections.Counter(e.is_a() for e in model))
    projects=model.by_type("IfcProject")
    issues=[{"level":s.get("level"),"message":str(s.get("message")),"instance":str(s.get("instance",""))}
            for s in logger.statements]
    if len(projects)!=1:
        issues.append({"level":"error","message":"Expected exactly one IfcProject"})
    for p in projects:
        if not p.UnitsInContext:
            issues.append({"level":"error","message":"Project units are absent"})
    products=model.by_type("IfcProduct")
    if len(products)<params.get("minProducts",0):
        issues.append({"level":"error","message":"Product count below requested minimum"})
    expected_schema=params.get("expectedSchema")
    if expected_schema and not model.schema_identifier.upper().startswith(expected_schema.upper()):
        issues.append({"level":"error","message":"Unexpected IFC schema: "+model.schema_identifier})
    required=params.get("requiredPsets",[])
    missing=[]
    for e in model.by_type("IfcElement"):
        psets=ifcopenshell.util.element.get_psets(e)
        for pset in required:
            if pset not in psets:
                missing.append({"guid":e.GlobalId,"pset":pset})
    property_issues=[]
    for requirement in params.get("requiredProperties",[]):
        try:
            elements=model.by_type(requirement.get("entityType","IfcElement"))
        except RuntimeError:
            elements=[]
        if not elements:
            property_issues.append({"requirement":requirement,"message":"No matching entity; property expectation cannot be proved"})
        for element in elements:
            values=ifcopenshell.util.element.get_psets(element).get(requirement["pset"],{})
            actual=values.get(requirement["property"])
            if requirement["property"] not in values or ("expectedValue" in requirement and (type(actual) is not type(requirement["expectedValue"]) or actual != requirement["expectedValue"])):
                # IFC numeric values may be float for an expected integer: compare numbers, excluding boolean coercion.
                numeric_equal=(type(actual) in (int,float) and type(requirement.get("expectedValue")) in (int,float) and actual==requirement["expectedValue"])
                if not numeric_equal:
                    property_issues.append({"guid":getattr(element,"GlobalId",None),"pset":requirement["pset"],"property":requirement["property"],"actual":actual,"message":"Required property absent or differs"})
    geometry=[]
    if params.get("geometry"):
        import ifcopenshell.geom
        settings=ifcopenshell.geom.settings()
        for element in products:
            if not element.Representation:
                continue
            try:
                shape=ifcopenshell.geom.create_shape(settings,element)
                geometry.append({"id":element.id(),"vertices":len(shape.geometry.verts)//3})
            except Exception as error:
                issues.append({"level":"error","message":"Geometry failed for #"+str(element.id())+": "+str(error)})
    def optional_type(name):
        try:return model.by_type(name)
        except RuntimeError:return []
    unit_scale=ifcopenshell.util.unit.calculate_unit_scale(model)
    expected_unit=params.get("expectedLengthUnitToMetres")
    if expected_unit is not None and abs(unit_scale-expected_unit)>max(1e-12,abs(expected_unit)*1e-9):
        issues.append({"level":"error","message":"Length unit scale differs from expectation"})
    projected_crs=[getattr(e,"Name",None) for e in optional_type("IfcProjectedCRS")]
    if params.get("expectedProjectedCrs") and params["expectedProjectedCrs"] not in projected_crs:
        issues.append({"level":"error","message":"Expected projected CRS name absent"})
    if params.get("minGeometryProducts"):
        if not params.get("geometry") or len(geometry)<params["minGeometryProducts"] or any(g["vertices"]<=0 for g in geometry):
            issues.append({"level":"error","message":"Nonempty geometry product count below requested minimum"})
    return {"schema":model.schema_identifier,"sha256":digest(params["filePath"]),"counts":counts,
        "projects":len(projects),"products":len(products),
        "alignments":len(optional_type("IfcAlignment")),
        "lengthUnitToMetres":unit_scale,"projectedCrsNames":projected_crs,"propertyIssues":property_issues,
        "georeferencing":[str(e) for e in optional_type("IfcMapConversion")],
        "units":[str(e.UnitsInContext) for e in projects],
        "missingPsets":missing,"geometry":geometry,"geometryChecked":bool(params.get("geometry")),
        "issues":issues,"valid":not issues and not missing and not property_issues}

def dispatch(method, params):
    if method=="health":
        import importlib
        dependencies = {}
        for name in ("pywinauto", "ifcopenshell"):
            try:
                importlib.import_module(name)
                dependencies[name] = {"available": True}
            except Exception as error:
                dependencies[name] = {"available": False, "error": str(error)}
        try:
            profile, _ = load_profile()
            adapter = {"verified":profile.get("status")=="verified", "actions":list(profile.get("actions",{})),
                       "workingDirectoryGuardConfigured":bool(profile.get("workingDirectoryGuard")),
                       "projectGuardConfigured":bool(profile.get("projectGuard"))}
        except BridgeError as error:
            adapter = {"verified":False,"actions":[],"error":{"code":error.code,"message":str(error)}}
        except Exception:
            adapter = {"verified":False,"actions":[],"error":{"code":"ADAPTER_INVALID","message":"Local adapter profile cannot be read"}}
        return {"platform":sys.platform,"python":sys.version,"pywinauto":dependencies["pywinauto"]["available"],
            "ifcopenshell":dependencies["ifcopenshell"]["available"],"dependencies":dependencies,
            "profileConfigured":bool(os.environ.get("ISTRAM_ADAPTER_PROFILE")),"adapter":adapter}
    if method=="snapshot":return snapshot()
    if method=="idle":
        profile,_ = load_profile()
        if processes():fail("PROJECT_BUSY","Native file writes require all ISTRAM sessions to be closed")
        root=Path(params["projectPath"]).resolve()
        if not (root/".istram-mcp"/"copy.json").is_file():
            fail("NOT_MANAGED_COPY","Native writes require a managed copy")
        for change in params.get("changes",[]):
            file=bound_file(root,change["file"])
            rule=profile.get("writableFormats",{}).get(file.suffix.lower())
            if not rule:
                fail("FORMAT_UNVERIFIED","No verified writer rule for "+file.suffix)
            raw=file.read_text(encoding=rule.get("encoding","cp1252"))
            revision=rule.get("revisionPattern")
            if not revision or not re.search(revision,raw,re.MULTILINE):
                fail("FORMAT_VERSION_MISMATCH","File revision is not verified")
            pattern=rule.get("linePattern")
            if not pattern or not re.fullmatch(pattern,change["expected"]) or not re.fullmatch(pattern,change["replacement"]):
                fail("CHANGE_UNVERIFIED","Line does not match verified writer rule")
        return {"idle":True}
    if method=="action":return action(params)
    if method=="ifc_validate":return validate_ifc(params)
    fail("UNKNOWN_METHOD","Unsupported worker method")

def main():
    request={}
    try:
        request=json.loads(sys.stdin.readline())
        result=dispatch(request["method"],request.get("params",{}))
        response={"id":request.get("id"),"ok":True,"result":result}
    except Exception as error:
        response={"id":request.get("id"),"ok":False,"error":{"code":getattr(error,"code","WORKER_ERROR"),"message":str(error)}}
    print(json.dumps(response,ensure_ascii=True,default=str),flush=True)

if __name__=="__main__":main()
