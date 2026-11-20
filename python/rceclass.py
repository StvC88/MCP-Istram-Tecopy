"""Audit the seven RCEclass tables in IFC as exported by ISTRAM."""
from collections import Counter
import hashlib
from pathlib import Path
import re

TABLES = {
    "01": ("Funciones", "Funciones"),
    "02": ("Estados", "Estados"),
    "03": ("Materiales", "Materiales"),
    "04": ("Responsables", "Responsables"),
    "05": ("Complejos", "Complejos"),
    "06": ("ObjetivosBIM", "Objetivos_BIM"),
    "07": ("UsosBIM", "Usos_BIM"),
}


def read_catalog(directory):
    tables, files = {}, {}
    for number, (stem, _) in TABLES.items():
        name = f"RCEclass_{number}{stem}Istram.fct"
        path = Path(directory, name)
        with path.open("rb") as stream:
            data = stream.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024:
            raise ValueError(f"RCEclass table exceeds 2 MiB: {name}")
        try:
            content = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = data.decode("cp1252")
        codes = {}
        for index, line in enumerate(content.splitlines(), 1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            fields = [field.strip() for field in line.split("\t")]
            if len(fields) != 3 or not fields[0] or not fields[1] or not fields[2].isdigit():
                raise ValueError(f"Invalid RCEclass row: {name}:{index}")
            codes.setdefault(fields[0], set()).add(fields[1])
        if not codes:
            raise ValueError(f"Empty RCEclass table: {name}")
        tables[number] = codes
        files[number] = {"file": name, "codes": len(codes), "sha256": hashlib.sha256(data).hexdigest(),
                         "ambiguousCodes": sorted(code for code, descriptions in codes.items() if len(descriptions) > 1)}
    return tables, files


def classification_table(reference):
    seen = set()
    source = reference.ReferencedSource
    while source and source.is_a("IfcClassificationReference"):
        if source.id() in seen:
            return None
        seen.add(source.id())
        source = source.ReferencedSource
    name = source.Name if source and source.is_a("IfcClassification") else ""
    match = re.match(r"^RCEclass[ _-]+(0[1-7])(?:[ _-]|$)", name or "", re.I)
    return match.group(1) if match else None


def inspect_profile(file, catalog_dir, required_tables, classes, sample_limit):
    """Preflight the classification sections of the observed FCV revisions."""
    catalog, files = read_catalog(catalog_dir)
    with Path(file).open("rb") as stream:
        data = stream.read(4 * 1024 * 1024 + 1)
    if len(data) > 4 * 1024 * 1024:
        raise ValueError("FCV exceeds 4 MiB")
    try:
        lines = data.decode("utf-8-sig").splitlines()
    except UnicodeDecodeError:
        lines = data.decode("cp1252").splitlines()
    version = re.fullmatch(r"CLASIF_VERSION (3\.70|3\.80|4\.00)", lines[0] if lines else "")
    if not version:
        raise ValueError("Expected FCV CLASIF_VERSION 3.70, 3.80 or 4.00")
    markers = [(index, match.group(1)) for index, line in enumerate(lines)
               if (match := re.fullmatch(r"#CLASIF\.([1-7])", line))]
    if [number for _, number in markers] != list("1234567"):
        raise ValueError("FCV must contain the seven ordered RCEclass tables")
    mappings = {}
    for position, (start, number) in enumerate(markers):
        end = markers[position + 1][0] if position + 1 < len(markers) else len(lines)
        table = "0" + number
        header = lines[start + 1:start + 9]
        if len(header) != 8 or header[2] != files[table]["file"]:
            raise ValueError(f"Unexpected FCV table header at line {start + 1}")
        by_class = {}
        for index in range(start + 9, end):
            if not lines[index].strip():
                continue
            columns = lines[index].split(";")
            if len(columns) < 7 or not columns[2].isdigit() or len(columns) != 7 + 4 * int(columns[2]):
                raise ValueError(f"Unrecognized FCV row at line {index + 1}")
            if columns[0]:
                by_class.setdefault(columns[0], []).extend(
                    (columns[j], columns[j + 1]) for j in range(6, len(columns) - 1, 4))
        mappings[table] = by_class
    selected = list(dict.fromkeys(classes)) if classes else sorted(set().union(*(set(m) for m in mappings.values())))
    samples, counts = [], Counter()
    for name in selected:
        for table, by_class in mappings.items():
            rows = by_class.get(name, [])
            rows = [(code, label) for code, label in rows if code.strip()]
            unknown = sorted({code for code, _ in rows if code not in catalog[table]})
            ambiguous = sorted({code for code, _ in rows if code in files[table]["ambiguousCodes"]})
            missing_labels = sorted({code for code, label in rows if not label.strip()})
            if not (unknown or ambiguous or missing_labels or (table in required_tables and not rows)):
                continue
            counts[table] += 1
            if len(samples) < sample_limit:
                samples.append({"istramClass": name, "table": table, "missingAssignment": not rows,
                                "unknownCodes": unknown, "ambiguousCodes": ambiguous,
                                "codesWithoutDescription": missing_labels})
    return {"version": version.group(1), "sha256": hashlib.sha256(data).hexdigest(), "classes": len(selected),
            "scope": "requested_classes" if classes else "all_profile_classes",
            "requiredTables": required_tables, "issueCountsByTable": dict(counts), "samples": samples}


def audit(model, catalog_dir, required_tables, sample_limit):
    from ifcopenshell.util.element import get_pset, get_type

    catalog, files = read_catalog(catalog_dir)
    elements = model.by_type("IfcElement")
    failures, samples = Counter(), []
    coverage = {number: Counter() for number in TABLES}
    classified = 0
    conforming = 0
    unknown_codes = Counter()

    def issue(kind, element, table=None, **detail):
        failures[kind] += 1
        if len(samples) < sample_limit:
            samples.append({"kind": kind, "guid": element.GlobalId, "entity": element.is_a(),
                            "name": element.Name, "table": table, **detail})

    for element in elements:
        previous_issue_count = failures.total()
        pset = get_pset(element, "RCE_CLA") or {}
        references = {number: set() for number in TABLES}
        for source in (element, get_type(element)):
            for relation in getattr(source, "HasAssociations", ()):
                if not relation.is_a("IfcRelAssociatesClassification"):
                    continue
                ref = relation.RelatingClassification
                if ref.is_a("IfcClassificationReference") and (number := classification_table(ref)):
                    code = getattr(ref, "Identification", getattr(ref, "ItemReference", None))
                    if code and code.strip():
                        references[number].add(code.strip())
        if pset or any(references.values()):
            classified += 1
        for number, (_, suffix) in TABLES.items():
            code_value = pset.get(f"RCE_CLA_{number}_Codigo_{suffix}")
            description = pset.get(f"RCE_CLA_{number}_Descripcion_{suffix}")
            codes = {part.strip() for part in code_value.split(";") if part.strip()} if isinstance(code_value, str) else set()
            refs = references[number]
            coverage[number]["withCode"] += bool(codes)
            coverage[number]["withAssociation"] += bool(refs)
            coverage[number]["withDescription"] += isinstance(description, str) and bool(description.strip())
            coverage[number]["withCatalogAssignment"] += bool(codes and codes == refs and codes <= catalog[number].keys()
                                                              and isinstance(description, str) and description.strip())
            if number in required_tables and not codes and not refs:
                issue("missing_assignment", element, number)
            if (codes or refs) and codes != refs:
                issue("association_mismatch", element, number, psetCodes=sorted(codes), referenceCodes=sorted(refs))
            if (codes or refs) and (not isinstance(description, str) or not description.strip()):
                issue("missing_description", element, number)
            unknown = (codes | refs) - catalog[number].keys()
            if unknown:
                issue("unknown_code", element, number, codes=sorted(unknown))
                unknown_codes.update((number, code) for code in unknown)
            ambiguous = (codes | refs).intersection(files[number]["ambiguousCodes"])
            if ambiguous:
                issue("ambiguous_catalog_code", element, number, codes=sorted(ambiguous))
        conforming += failures.total() == previous_issue_count
    return {"valid": bool(elements) and classified > 0 and not failures, "elements": len(elements),
            "elementsWithRceData": classified, "conformingElements": conforming, "requiredTables": required_tables,
            "coverage": {number: dict(counts) for number, counts in coverage.items()},
            "catalog": files, "issueCounts": dict(failures), "samples": samples,
            "unknownCodeCount": len(unknown_codes),
            "unknownCodeSamples": [{"table": table, "code": code, "elements": count}
                                   for (table, code), count in unknown_codes.most_common(sample_limit)]}
