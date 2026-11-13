"""Checks for the DGC geolocation requirements selected for an IFC delivery."""
from math import isclose, isfinite


def numeric(value):
    return type(value) in (int, float) and isfinite(value)


def audit(model, params):
    from ifcopenshell.util.element import get_pset
    from ifcopenshell.util.geolocation import auto_xyz2enh
    from ifcopenshell.util.placement import get_local_placement

    if model.schema_identifier != "IFC4X3_ADD2":
        return {"valid": False, "issueCount": 1, "issues": [{"kind": "expected_ifc4x3_add2"}]}

    locations = 0
    unscoped = 0
    issues = []
    for element in model.by_type("IfcElement"):
        source = get_pset(element, "ISTRAM") or {}
        data = get_pset(element, "DGC_LOC") or {}
        axis = source.get("Eje")
        if axis is None and not data:
            unscoped += 1
            continue
        begin = data.get("DGC_LOC_03_PK_Inicial")
        end = data.get("DGC_LOC_04_PK_Final")
        point = data.get("DGC_LOC_05_PK_Puntual")
        has_range = numeric(begin) and numeric(end) and begin <= end and point is None
        has_point = numeric(point) and begin is None and end is None
        valid_axis = isinstance(data.get("DGC_LOC_02_Eje"), str) and data["DGC_LOC_02_Eje"].strip()
        valid_road = isinstance(data.get("DGC_LOC_01_Carretera"), str) and data["DGC_LOC_01_Carretera"].strip()
        if (has_range or has_point) and valid_axis and valid_road:
            if axis is None or str(axis) == data["DGC_LOC_02_Eje"]:
                expected = (source.get("PK inicial usuario"), source.get("PK final usuario"))
                actual = (begin, end) if has_range else (point, point)
                if not all(numeric(pk) for pk in expected) or all(
                        isclose(a,b,rel_tol=0,abs_tol=.001) for a,b in zip(actual,expected)):
                    locations += 1
                    continue
                issues.append({"kind": "pk_differs_from_istram", "guid": element.GlobalId,
                               "actual": actual, "expected": expected})
                continue
        issues.append({"kind": "invalid_location", "guid": element.GlobalId})

    crs = model.by_type("IfcProjectedCRS")
    map_conversions = model.by_type("IfcMapConversion")
    projected = [item for item in crs if item.Name == params["expectedProjectedCrs"]]
    if len(projected) != 1:
        issues.append({"kind": "projected_crs_mismatch", "expected": params["expectedProjectedCrs"]})
    operations = model.by_type("IfcCoordinateOperation")
    conversion_verified = len(operations) == len(map_conversions) == len(projected) == 1 and map_conversions[0].TargetCRS == projected[0]
    if not conversion_verified:
        issues.append({"kind": "map_conversion_missing_or_ambiguous"})
    datums = sorted({item.VerticalDatum for item in projected if item.VerticalDatum})
    expected_datum = params.get("expectedVerticalDatum")
    if not expected_datum:
        issues.append({"kind": "vertical_datum_evidence_required", "declared": datums})
    elif expected_datum not in datums:
        issues.append({"kind": "vertical_datum_mismatch", "expected": expected_datum, "declared": datums})
    north_defined = any(item.TrueNorth for item in model.by_type("IfcGeometricRepresentationContext", include_subtypes=False)
                        if item.ContextType == "Model")
    if not north_defined:
        issues.append({"kind": "true_north_not_declared"})
    if not locations:
        issues.append({"kind": "no_dgc_locations"})

    control = params.get("surveyControl")
    verified = None
    if not control:
        issues.append({"kind": "official_survey_control_required"})
    elif conversion_verified:
        try:
            point = model.by_guid(control["guid"])
        except RuntimeError:
            point = None
        placement = getattr(point, "ObjectPlacement", None)
        if not placement or not placement.is_a("IfcLocalPlacement") or not getattr(point, "Representation", None):
            issues.append({"kind": "survey_marker_missing", "guid": control["guid"]})
        else:
            xyz = get_local_placement(placement)[:3, 3]
            actual = [float(v) for v in auto_xyz2enh(model, *xyz)]
            expected = [control["easting"], control["northing"], control["elevation"]]
            if all(isclose(a,b,rel_tol=0,abs_tol=control["toleranceMetres"]) for a,b in zip(actual,expected)):
                verified = {"guid": control["guid"], "mapCoordinates": actual}
            else:
                issues.append({"kind": "survey_marker_mismatch", "guid": control["guid"],
                               "actual": actual, "expected": expected})
    marker_pks = []
    for point in model.by_type("IfcReferent"):
        data = get_pset(point, "DGC_LOC") or {}
        pk = data.get("DGC_LOC_05_PK_Puntual")
        if type(pk) in (int, float) and isfinite(pk) and point.Representation:
            marker_pks.append(pk)
    missing_pks = [pk for pk in params.get("requiredMarkerPks", []) if pk not in marker_pks]
    if missing_pks:
        issues.append({"kind": "represented_pk_markers_missing", "pk": missing_pks})

    return {"valid": not issues, "elementsWithValidLocations": locations, "unscopedElements": unscoped,
            "projectedCrs": [item.Name for item in crs], "verticalDatums": datums, "trueNorthDeclared": north_defined,
            "surveyControl": verified, "representedMarkerPks": sorted(marker_pks),
            "issueCount": len(issues), "issues": issues[:params.get("sampleLimit", 20)]}
