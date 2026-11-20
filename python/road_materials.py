"""Assign or preview catalogued constituents of explicitly identified road layers."""
import os
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import ifcopenshell
from ifcopenshell.api.pset import edit_pset
from ifcopenshell.guid import new
from ifcopenshell.util.element import get_material, get_pset, get_type

from rceclass import classification_table, read_catalog

CODE = "RCE_CLA_03_Codigo_Materiales"
LABEL = "RCE_CLA_03_Descripcion_Materiales"
FUNCTION = "RCE_CLA_01_Codigo_Funciones"


def refs(obj, table):
    result = set()
    for owner in (obj, get_type(obj)):
        for rel in getattr(owner, "HasAssociations", ()):
            if rel.is_a("IfcRelAssociatesClassification"):
                ref = rel.RelatingClassification
                if ref.is_a("IfcClassificationReference") and classification_table(ref) == table:
                    result.add(ref.Identification)
    return result


def material_codes(selection, catalog):
    if not selection:
        return set()
    if selection.is_a("IfcMaterial"):
        materials = [selection]
    elif selection.is_a("IfcMaterialConstituentSet"):
        materials = [c.Material for c in selection.MaterialConstituents or ()]
    else:
        return None
    result = set()
    for material in materials:
        codes = {r.RelatingReference.Identification for r in material.HasExternalReferences
                 if r.RelatingReference.is_a("IfcClassificationReference")
                 and classification_table(r.RelatingReference) == "03"}
        if len(codes) != 1 or material.Name not in catalog.get(next(iter(codes)), ()):
            return None
        result.update(codes)
    return result


def run(p):
    catalog, _ = read_catalog(p["catalogDirectory"])
    rules = {}
    for rule in p["rules"]:
        key = (rule["family"], rule["functionCode"])
        codes = tuple(rule["materialCodes"])
        if (key in rules or len(catalog["01"].get(key[1], ())) != 1 or not codes or len(codes) != len(set(codes))
                or any(len(catalog["03"].get(c, ())) != 1 for c in codes)):
            raise ValueError("Duplicate rule or invalid catalogue assignment: " + repr(key))
        rules[key] = codes
    src = Path(p["filePath"])
    dst = Path(p["outputPath"]) if p.get("outputPath") else None
    if src.suffix.lower() != ".ifc" or dst and (dst.suffix.lower() != ".ifc" or dst.exists()):
        raise ValueError("Expected IFC source and unused IFC destination")
    model = ifcopenshell.open(str(src))
    if model.schema_identifier != "IFC4X3_ADD2":
        raise ValueError("Expected IFC4X3_ADD2")
    systems = [s for s in model.by_type("IfcClassification") if s.Name == "RCEclass_03_Materiales"]
    if len(systems) > 1:
        raise ValueError("Ambiguous materials classification")
    counts = Counter()
    missing = Counter()
    by_rule = defaultdict(Counter)
    from_model = defaultdict(Counter)
    pending = defaultdict(list)
    for obj in model.by_type("IfcElement"):
        ps = get_pset(obj, "RCE_CLA") or {}
        material = get_material(obj)
        counts["elements"] += 1
        counts["withIfcMaterialBefore"] += bool(material)
        counts["withTable03Before"] += bool(ps.get(CODE))
        consistent = False
        if ps.get(CODE) or ps.get(LABEL):
            assigned = (ps.get(CODE) or "").split("; ") if isinstance(ps.get(CODE), str) else []
            expected_labels = [catalog["03"].get(code, set()) for code in assigned]
            labels = (ps.get(LABEL) or "").split("; ") if isinstance(ps.get(LABEL), str) else []
            consistent = (bool(assigned) and len(labels) == len(assigned) == len(set(assigned))
                          and all({label} == names for label, names in zip(labels, expected_labels))
                          and refs(obj, "03") == set(assigned))
            counts["table03CatalogAndProductRefsConsistent"] += consistent
            if not consistent:
                counts["table03Inconsistent"] += 1
            elif material_codes(material, catalog["03"]) != set(assigned):
                counts["table03WithoutMatchingIfcConstituents"] += 1
        key = (obj.ObjectType or "", ps.get(FUNCTION))
        if key in rules:
            codes = rules[key]
            report = by_rule[key]
        elif (p.get("useExistingTable03") and consistent and key[0] and
              len(catalog["01"].get(key[1], ())) == 1):
            codes = tuple(assigned)
            report = from_model[(*key, codes)]
        else:
            if not material or not ps.get(CODE):
                missing[key[0] or obj.is_a()] += 1
            continue
        labels = [next(iter(catalog["03"][c])) for c in codes]
        existing = refs(obj, "03")
        ok_values = ps.get(CODE) == "; ".join(codes) and ps.get(LABEL) == "; ".join(labels)
        mat_codes = material_codes(material, catalog["03"])
        if refs(obj, "01") != {key[1]}:
            state = "functionConflict"
        elif (material and mat_codes != set(codes) or existing - set(codes)
              or (ps.get(CODE) or ps.get(LABEL)) and not ok_values):
            state = "materialConflict"
        elif material and existing == set(codes) and ok_values:
            state = "verified"
        else:
            local = get_pset(obj, "RCE_CLA", should_inherit=False) or {}
            pset = model.by_id(local["id"]) if local else None
            if (not pset or pset.DefinesType or sum(len(rel.RelatedObjects) for rel in pset.DefinesOccurrence) != 1
                    or any(model.get_total_inverses(prop) != 1 for prop in pset.HasProperties if prop.Name in (CODE, LABEL))):
                state = "sharedOrInheritedPset"
            else:
                state = "eligible"
                pending[(*key, codes)].append((obj, pset, material, existing))
        report[state] += 1
    if dst and pending:
        system = systems[0] if systems else model.create_entity("IfcClassification", Name="RCEclass_03_Materiales")
        materials, references = {}, {}
        for (family, _, codes), items in pending.items():
            parts = []
            for code in codes:
                label, = catalog["03"][code]
                if code not in references:
                    ref = model.create_entity("IfcClassificationReference", Identification=code, Name=label, ReferencedSource=system)
                    mat = model.create_entity("IfcMaterial", Name=label)
                    model.create_entity("IfcExternalReferenceRelationship", RelatingReference=ref, RelatedResourceObjects=[mat])
                    references[code], materials[code] = ref, mat
                parts.append(materials[code])
                targets = [obj for obj, _, _, existing in items if code not in existing]
                if targets:
                    model.create_entity("IfcRelAssociatesClassification", GlobalId=new(), RelatedObjects=targets, RelatingClassification=references[code])
            targets = [obj for obj, _, mat, _ in items if not mat]
            if targets:
                selection = parts[0] if len(parts) == 1 else model.create_entity("IfcMaterialConstituentSet", Name=family,
                    MaterialConstituents=[model.create_entity("IfcMaterialConstituent", Name=m.Name, Material=m) for m in parts])
                model.create_entity("IfcRelAssociatesMaterial", GlobalId=new(), RelatedObjects=targets, RelatingMaterial=selection)
            for _, ps, _, _ in items:
                values = {CODE: "; ".join(codes), LABEL: "; ".join(m.Name for m in parts)}
                # IfcLabel is limited to 255 characters. Long lists need IfcText.
                edit_pset(model, pset=ps, properties={
                    name: model.createIfcText(value) if len(value) > 255 else value for name, value in values.items()
                })
        fd, temp = tempfile.mkstemp(dir=dst.parent, suffix=".ifc")
        os.close(fd)
        try:
            model.write(temp)
            if os.name == "nt":
                os.rename(temp, dst)
            else:
                os.link(temp, dst)
        finally:
            Path(temp).unlink(missing_ok=True)
    return {"outputPath": str(dst) if dst and pending else None, "coverage": dict(counts),
            "rules": [{"family": k[0], "functionCode": k[1], "materialCodes": v, **by_rule[k]} for k, v in rules.items()],
            "existingAssignments": [{"family": family, "functionCode": function, "materialCodes": codes, **stats}
                                    for (family, function, codes), stats in from_model.items()],
            "unmatchedFamiliesWithMissingData": dict(missing)}
