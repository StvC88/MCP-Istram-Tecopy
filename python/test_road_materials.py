import tempfile
import unittest
from pathlib import Path

import ifcopenshell
from ifcopenshell.guid import new
from ifcopenshell.api.pset import add_pset, edit_pset
from ifcopenshell.util.element import get_material

from rceclass import TABLES
from road_materials import FUNCTION, run


class RoadMaterialsTest(unittest.TestCase):
    def test_base_and_subbase_get_distinct_materials_and_preserve_unmatched_family(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            rules = [{"family": "base AC", "functionCode": "F_BASE", "materialCodes": ["M_AGG", "M_BIND"]},
                     {"family": "subbase ZA", "functionCode": "F_SUB", "materialCodes": ["M_ZA"]}]
            for number, (stem, _) in TABLES.items():
                text = {"01": "F_BASE\tBase\t1\nF_SUB\tSubbase\t1",
                        "03": "M_AGG\tAggregate\t1\nM_BIND\tBinder\t1\nM_ZA\tZahorra\t1"}.get(number, "OTHER\tOther\t1")
                (root / f"RCEclass_{number}{stem}Istram.fct").write_text(text, encoding="utf8")
            model = ifcopenshell.file(schema="IFC4X3_ADD2")
            scheme = model.create_entity("IfcClassification", Name="RCEclass_01_Funciones")
            for family, code in [("base AC", "F_BASE"), ("subbase ZA", "F_SUB"), ("relleno ZA", "F_SUB")]:
                obj = model.create_entity("IfcCourse", GlobalId=new(), ObjectType=family)
                ps = add_pset(model, product=obj, name="RCE_CLA")
                edit_pset(model, pset=ps, properties={FUNCTION: code})
                reference = model.create_entity("IfcClassificationReference", Identification=code, ReferencedSource=scheme)
                model.create_entity("IfcRelAssociatesClassification", GlobalId=new(), RelatedObjects=[obj], RelatingClassification=reference)
            src, dst = root / "in.ifc", root / "out.ifc"
            model.write(str(src))
            args = {"filePath": str(src), "catalogDirectory": folder, "rules": rules}
            self.assertEqual(run(args)["rules"][0]["eligible"], 1)
            run(dict(args, outputPath=str(dst)))
            review = run(dict(args, filePath=str(dst)))
            self.assertEqual([r["verified"] for r in review["rules"]], [1, 1])
            reopened = ifcopenshell.open(str(dst))
            elements = {e.ObjectType: e for e in reopened.by_type("IfcElement")}
            self.assertEqual(get_material(elements["base AC"]).is_a(), "IfcMaterialConstituentSet")
            self.assertEqual(get_material(elements["subbase ZA"]).Name, "Zahorra")
            self.assertIsNone(get_material(elements["relleno ZA"]))
            rel = next(r for r in elements["base AC"].HasAssociations if r.is_a("IfcRelAssociatesMaterial"))
            reopened.remove(rel)
            get_material(elements["subbase ZA"]).Name = "Different material"
            reopened.write(str(dst))
            self.assertEqual(run(dict(args, filePath=str(dst)))["rules"][1]["materialConflict"], 1)
            repaired = root / "repaired.ifc"
            sync = dict(args, rules=[], useExistingTable03=True, filePath=str(dst))
            run(dict(sync, outputPath=str(repaired)))
            review = run(dict(sync, filePath=str(repaired)))
            states = {r["family"]: r for r in review["existingAssignments"]}
            self.assertEqual(states["base AC"]["verified"], 1)
            self.assertEqual(states["subbase ZA"]["materialConflict"], 1)
            with self.assertRaises(ValueError):
                run(dict(args, outputPath=str(src)))
