from pathlib import Path
import tempfile
import unittest

import ifcopenshell
import ifcopenshell.api

from rceclass import TABLES, audit, inspect_profile


class RceclassTest(unittest.TestCase):
    def test_reports_unknown_native_fallback_and_preserves_multicode_assignments(self):
        model = ifcopenshell.file(schema="IFC4X3")
        road = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcPavement")
        pset = ifcopenshell.api.run("pset.add_pset", model, product=road, name="RCE_CLA")
        ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
            "RCE_CLA_01_Codigo_Funciones": "F_TEST_1; F_TEST_2",
            "RCE_CLA_01_Descripcion_Funciones": "First; Second",
        })
        classification = model.create_entity("IfcClassification", Name="RCEclass_01_Funciones")
        references = []
        for code in ("F_TEST_1", "F_TEST_2"):
            reference = model.create_entity("IfcClassificationReference", Identification=code,
                                            ReferencedSource=classification)
            references.append(reference)
            model.create_entity("IfcRelAssociatesClassification", GlobalId=ifcopenshell.guid.new(),
                                RelatedObjects=[road], RelatingClassification=reference)
        with tempfile.TemporaryDirectory() as directory:
            for number, (stem, _) in TABLES.items():
                Path(directory, f"RCEclass_{number}{stem}Istram.fct").write_text(
                    "F_TEST_1\tFirst\t1\nF_TEST_2\tSecond\t1\n", encoding="utf8")
            self.assertTrue(audit(model, directory, ["01"], 1)["valid"])
            references[1].Identification = "ISTRAM fallback"
            result = audit(model, directory, ["01"], 1)
            self.assertFalse(result["valid"])
            self.assertEqual(result["issueCounts"], {"association_mismatch": 1, "unknown_code": 1})
            self.assertEqual(result["conformingElements"], 0)
            self.assertEqual(result["unknownCodeSamples"][0]["code"], "ISTRAM fallback")

    def test_project_fcv_400_ignores_unassigned_slots(self):
        with tempfile.TemporaryDirectory() as directory:
            lines = ["CLASIF_VERSION 4.00"]
            for number, (stem, _) in TABLES.items():
                name = f"RCEclass_{number}{stem}Istram.fct"
                Path(directory, name).write_text("OK\tEtiqueta\t1\n", encoding="utf8")
                lines.extend([f"#CLASIF.{int(number)}", stem, "1", name, "", "", "", "", "",
                              "Familia;Familia;1;0;0;-1;;;;;"])
            profile = Path(directory, "istram.fcv")
            profile.write_text("\n".join(lines), encoding="utf8")
            result = inspect_profile(profile, directory, ["01"], ["Familia"], 10)
            self.assertEqual(result["issueCountsByTable"], {"01": 1})
            self.assertTrue(result["samples"][0]["missingAssignment"])
