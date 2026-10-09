import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import worker

class WorkerTest(unittest.TestCase):
    def test_snapshot_includes_istramx_and_skips_launcher(self):
        from unittest.mock import MagicMock, patch
        application = MagicMock()
        application.return_value.connect.return_value.windows.return_value = []
        active = [{"name": "istramX.exe", "pid": 42}, {"name": "Arranque.exe", "pid": 43}]
        import types
        with patch.object(worker, "processes", return_value=active), patch.dict(sys.modules, {"pywinauto": types.SimpleNamespace(Application=application)}):
            result = worker.snapshot()
        self.assertEqual([s["pid"] for s in result["snapshots"]], [42])
        application.return_value.connect.assert_called_once_with(process=42, timeout=10)

    def test_protocol_health_and_unknown(self):
        for method, ok in [("health", True), ("arbitrary_python", False)]:
            result=subprocess.run([sys.executable,str(Path(worker.__file__))],input=json.dumps({"id":"a","method":method}),
                                  text=True,capture_output=True,check=True)
            response=json.loads(result.stdout)
            self.assertEqual(response["ok"],ok)
            self.assertEqual(response["id"],"a")

    def test_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(worker.BridgeError):
                worker.bound_file(Path(directory),"../escape.ifc")

    def test_native_without_profile_is_refused(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(worker.BridgeError):
                worker.load_profile()

    def test_ifc_validation(self):
        import ifcopenshell
        import ifcopenshell.api
        with tempfile.TemporaryDirectory() as directory:
            model=ifcopenshell.file(schema="IFC4X3")
            project=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcProject",name="Synthetic test")
            ifcopenshell.api.run("unit.assign_unit",model)
            file=Path(directory)/"synthetic.ifc"
            model.write(str(file))
            result=worker.validate_ifc({"filePath":str(file),"expectedSchema":"IFC4X3"})
            self.assertEqual(result["projects"],1)
            self.assertTrue(result["valid"],result["issues"])
            invalid=worker.validate_ifc({"filePath":str(file),"expectedSchema":"IFC2X3"})
            self.assertFalse(invalid["valid"])
            empty=worker.validate_ifc({"filePath":str(file),"geometry":True,"minGeometryProducts":1,"minProducts":1,"expectedLengthUnitToMetres":1,"expectedProjectedCrs":"EPSG:25830"})
            self.assertFalse(empty["valid"])
            self.assertGreaterEqual(len(empty["issues"]),3)

    def test_ifc_required_property_values_are_checked_on_matching_elements(self):
        import ifcopenshell
        import ifcopenshell.api
        with tempfile.TemporaryDirectory() as directory:
            model=ifcopenshell.file(schema="IFC4X3")
            ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcProject",name="Synthetic")
            ifcopenshell.api.run("unit.assign_unit",model)
            wall=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcWall",name="Fixture")
            pset=ifcopenshell.api.run("pset.add_pset",model,product=wall,name="MCP_Test")
            ifcopenshell.api.run("pset.edit_pset",model,pset=pset,properties={"Material":"Concrete","Height":2.0})
            file=Path(directory)/"fixture.ifc";model.write(str(file))
            params={"filePath":str(file),"requiredProperties":[{"entityType":"IfcWall","pset":"MCP_Test","property":"Height","expectedValue":2}]}
            self.assertEqual(worker.validate_ifc(params)["propertyIssues"],[])
            params["requiredProperties"][0]["expectedValue"]=3
            self.assertFalse(worker.validate_ifc(params)["valid"])
            params["requiredProperties"][0]["entityType"]="IfcPipeSegment"
            self.assertIn("No matching entity",worker.validate_ifc(params)["propertyIssues"][0]["message"])

import os
from unittest.mock import MagicMock, patch
import types

class GuardTest(unittest.TestCase):
    def test_working_directory_guard_refuses_wrong_or_relative_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            app=MagicMock()
            control=app.window.return_value.child_window.return_value
            guard={"window":{},"selector":{}}
            control.window_text.return_value=directory
            worker.check_guard(app,guard,{"projectPath":directory},directory=True)
            for actual in ("relative",str(Path(directory)/"other")):
                control.window_text.return_value=actual
                with self.assertRaises(worker.BridgeError) as result:
                    worker.check_guard(app,guard,{"projectPath":directory},directory=True)
                self.assertEqual(result.exception.code,"WRONG_WORKING_DIRECTORY")
            with self.assertRaises(worker.BridgeError) as result:
                worker.check_guard(app,None,{"projectPath":directory},directory=True)
            self.assertEqual(result.exception.code,"WORKING_DIRECTORY_GUARD_REQUIRED")

    def test_recipe_preflight_refuses_missing_guard_or_postcondition_before_any_ui(self):
        profile={"actions":{"save":{"steps":[{"kind":"invoke"}]}}}
        application=MagicMock()
        with patch.object(worker,"load_profile",return_value=(profile,Path("Istram.exe"))),patch.dict(sys.modules,{"pywinauto":types.SimpleNamespace(Application=application)}):
            with self.assertRaises(worker.BridgeError) as result:
                worker.action({"action":"save","projectPath":"unused"})
            self.assertEqual(result.exception.code,"WORKING_DIRECTORY_GUARD_REQUIRED")
            profile["workingDirectoryGuard"]={"window":{},"selector":{}}
            profile["projectGuard"]={"window":{},"selector":{},"expected":"{projectFile}"}
            with self.assertRaises(worker.BridgeError) as result:
                worker.action({"action":"save","projectPath":"unused"})
            self.assertEqual(result.exception.code,"POSTCONDITION_REQUIRED")
            application.assert_not_called()

    def test_unverified_report_metadata_cannot_certify_adapter(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/"profile.json"
            profile={"status":"verified","evidence":{"runs":[{"success":True,"session":"label-"+str(i%2),"reportSha256":"pretend"} for i in range(20)]}}
            file.write_text(json.dumps(profile),encoding="utf-8")
            with patch.dict(os.environ,{"ISTRAM_ADAPTER_PROFILE":str(file)},clear=True):
                with self.assertRaises(worker.BridgeError) as result:
                    worker.load_profile()
                self.assertEqual(result.exception.code,"ADAPTER_UNVERIFIED")

    def test_candidate_hash_mismatch_does_not_start_istram(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory)
            (base/"Istram.exe").write_bytes(b"test executable, never run")
            (base/"profile.json").write_text(json.dumps({"status":"candidate","binarySha256":"wrong"}),encoding="utf-8")
            with patch.dict(os.environ,{"ISTRAM_ADAPTER_PROFILE":str(base/"profile.json"),"ISTRAM_PATH":directory,"ISTRAM_ACCEPTANCE_MODE":"1"},clear=True):
                with self.assertRaises(worker.BridgeError) as result:
                    worker.load_profile()
                self.assertEqual(result.exception.code,"VERSION_MISMATCH")

    def test_verified_profile_needs_twenty_distinct_hashed_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory)
            (base/"Istram.exe").write_bytes(b"fixture executable, never run")
            runs=[]
            for i in range(20):
                report=base/(str(i)+".json")
                report.write_text(json.dumps({"runId":str(i),"success":True,"nativeSessionIds":["a","b"],"engineeringAssertionsPassed":True}),encoding="utf-8")
                runs.append({"success":True,"nativeSessionId":"a" if i%2 else "b","reportPath":report.name,"reportSha256":worker.digest(report)})
            profile={"status":"verified","binarySha256":worker.digest(base/"Istram.exe"),"evidence":{"runs":runs}}
            file=base/"profile.json";file.write_text(json.dumps(profile),encoding="utf-8")
            with patch.dict(os.environ,{"ISTRAM_ADAPTER_PROFILE":str(file),"ISTRAM_PATH":directory},clear=True):
                worker.load_profile()
                profile["evidence"]["runs"]=[dict(runs[0],nativeSessionId="a" if i%2 else "b") for i in range(20)]
                file.write_text(json.dumps(profile),encoding="utf-8")
                with self.assertRaises(worker.BridgeError) as result:
                    worker.load_profile()
                self.assertEqual(result.exception.code,"ADAPTER_UNVERIFIED")
                profile["evidence"]["runs"]=runs
                file.write_text(json.dumps(profile),encoding="utf-8")
                (base/"0.json").write_text("tampered",encoding="utf-8")
                with self.assertRaises(worker.BridgeError) as result:
                    worker.load_profile()
                self.assertEqual(result.exception.code,"ADAPTER_UNVERIFIED")

if __name__=="__main__":unittest.main()
