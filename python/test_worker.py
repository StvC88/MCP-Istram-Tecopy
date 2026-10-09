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

if __name__=="__main__":unittest.main()
