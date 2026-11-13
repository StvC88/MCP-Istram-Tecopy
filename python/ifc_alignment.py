"""Rebuild an empty ISTRAM IFC alignment from its exported straight ALI/RAS reports."""
from bisect import bisect_right
from pathlib import Path
from hashlib import sha256
from math import atan2, ceil, floor, hypot, isfinite
import re

import ifcopenshell
from ifcopenshell.api import alignment as align, context, geometry, nest, pset
from ifcopenshell.util.element import get_pset, remove_deep2
from ifcopenshell.util.placement import get_local_placement
from ifcopenshell.util.unit import calculate_unit_scale
import numpy as np


def read_report(file):
    with Path(file).open("rb") as stream:
        data = stream.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise ValueError("ALI/RAS report exceeds 16 MiB")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252")
    axis = re.search(r"^#\s*eje\s*:\s*(\d+)\b", text, re.I | re.M)
    if not axis or not re.search(r"^#\s*formato\s*:\s*istram\b", text, re.I | re.M):
        raise ValueError("Expected ISTRAM report with an explicit axis identifier")
    lines = [line.split() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]
    return axis.group(1), lines


def read_axis(ali_file, ras_file):
    axis, ali = read_report(ali_file)
    ras_axis, ras = read_report(ras_file)
    if axis != ras_axis or not ali or len(ali[0]) != 1 or len(ali) < 3 or len(ras) < 2:
        raise ValueError("ALI/RAS must identify the same nonempty axis")
    if any(len(row) != 9 or row[0] != "1" for row in ali[1:-1]) or len(ali[-1]) != 9 or ali[-1][:1] != ["0"]:
        raise ValueError("Only straight ALI rows with an explicit endpoint are supported")
    if any(len(row) != 8 or float(row[7]) != 0.0 for row in ras):
        raise ValueError("Only straight-gradient ISTRAM RAS reports are supported")
    start = float(ali[0][0])
    xy = [(float(row[2]), float(row[3])) for row in ali[1:]]
    zs = [(float(row[0]) - start, float(row[1])) for row in ras]
    if not all(isfinite(v) for pair in [*xy, *zs] for v in pair) or not isfinite(start):
        raise ValueError("Report contains a non-finite coordinate")
    chain = [0.]
    for row, (x, y), (nx, ny) in zip(ali[1:-1], xy, xy[1:]):
        length = hypot(nx-x, ny-y)
        stated_length = float(row[1])
        if length <= 0 or not isfinite(stated_length) or abs(length-stated_length) > 0.001:
            raise ValueError("ALI length differs from the straight-line geometry by more than 1 mm")
        chain.append(chain[-1]+length)
    if abs(zs[0][0]) > .001 or abs(zs[-1][0] - chain[-1]) > .001 or any(a[0] >= b[0] for a,b in zip(zs,zs[1:])):
        raise ValueError("RAS station domain does not match ALI")
    zs[0] = (0., zs[0][1])
    zs[-1] = (chain[-1], zs[-1][1])
    return axis, start, xy, chain, zs


def interpolate(domain, values, distance):
    i = max(0, min(len(domain) - 2, bisect_right(domain, distance) - 1))
    ratio = (distance - domain[i]) / (domain[i + 1] - domain[i])
    return tuple(a + (b-a) * ratio for a,b in zip(values[i], values[i+1]))


def add_locations(model, road, axis_id, start, end):
    count = 0
    for element in model.by_type("IfcElement"):
        source = get_pset(element, "ISTRAM") or {}
        if str(source.get("Eje")) != axis_id:
            continue
        pk1, pk2 = source.get("PK inicial usuario"), source.get("PK final usuario")
        if not all(type(v) in (int, float) and isfinite(v) for v in (pk1, pk2)):
            continue
        if not start - .001 <= pk1 <= pk2 <= end + .001:
            continue
        if get_pset(element, "DGC_LOC"):
            continue
        properties = {"DGC_LOC_01_Carretera": road, "DGC_LOC_02_Eje": axis_id}
        if pk1 == pk2:
            properties["DGC_LOC_05_PK_Puntual"] = model.createIfcLengthMeasure(pk1)
        else:
            properties.update(DGC_LOC_03_PK_Inicial=model.createIfcLengthMeasure(pk1),
                              DGC_LOC_04_PK_Final=model.createIfcLengthMeasure(pk2))
        pset.edit_pset(model, pset=pset.add_pset(model, product=element, name="DGC_LOC"), properties=properties)
        count += 1
    return count


def enrich(model, ali_file, ras_file, road, interval, height):
    if model.schema_identifier != "IFC4X3_ADD2" or calculate_unit_scale(model) != 1:
        raise ValueError("Expected IFC4X3_ADD2 with metre units")
    axis_id, start, xy, chain, zs = read_axis(ali_file, ras_file)
    first_marker = ceil(start / interval)
    last_marker = floor((start + chain[-1]) / interval)
    if last_marker - first_marker + 1 > 1000:
        raise ValueError("Requested interval produces more than 1000 markers")
    matches = [item for item in model.by_type("IfcAlignment") if item.Name == f"Eje {axis_id}"]
    if len(matches) != 1:
        raise ValueError("Expected a unique native IfcAlignment with the matching axis name")
    axis = matches[0]
    h, v = align.get_horizontal_layout(axis), align.get_vertical_layout(axis)
    old_rep = axis.Representation
    curves = [item for rep in old_rep.Representations for item in rep.Items] if old_rep else []
    if (not h or not v or not curves or any(not curve.is_a("IfcCompositeCurve") or curve.Segments for curve in curves)
            or not np.allclose(get_local_placement(axis.ObjectPlacement), np.eye(4), atol=1e-10, rtol=0)):
        raise ValueError("Expected ISTRAM's empty horizontal/vertical curves and identity alignment placement")
    for layout in (h, v):
        for relation in list(layout.IsNestedBy):
            if relation.RelatedObjects:
                raise ValueError("Refusing to replace a populated alignment layout")
            model.remove(relation)
    refs = [item for rel in axis.IsNestedBy for item in rel.RelatedObjects if item.is_a("IfcReferent")]
    if len(refs) != 1 or (get_pset(refs[0], "Pset_Stationing") or {}).get("Station") != 0:
        raise ValueError("Expected one native zero-station placeholder")
    native_ref = refs[0]
    old_placement = native_ref.ObjectPlacement
    native_ref.ObjectPlacement = model.createIfcLocalPlacement(
        RelativePlacement=model.createIfcAxis2Placement3D(Location=model.createIfcCartesianPoint((0.,0.,0.))))
    if old_placement:
        remove_deep2(model, old_placement)
    axis.Representation = None
    remove_deep2(model, old_rep)
    # The API expects a terminal zero-length segment before appending real segments.
    for layout in (h,v):
        align.add_zero_length_segment(model,layout)
    for (x,y),(nx,ny),s0,s1 in zip(xy,xy[1:],chain,chain[1:]):
        align.create_layout_segment(model,h,model.createIfcAlignmentHorizontalSegment(
            StartPoint=model.createIfcCartesianPoint((x,y)),StartDirection=atan2(ny-y,nx-x),
            StartRadiusOfCurvature=0.,EndRadiusOfCurvature=0.,SegmentLength=s1-s0,PredefinedType="LINE"))
    align.layout_vertical_alignment_by_pi_method(model,v,zs,[0.]*(len(zs)-2))
    native_ref.Name = f"{int(start//1000)}+{start%1000:07.3f}"
    stationing = model.by_id(get_pset(native_ref, "Pset_Stationing")["id"])
    pset.edit_pset(model, pset=stationing, properties={"Station":model.createIfcLengthMeasure(start)})
    align.create_representation(model,axis)
    if align.get_basis_curve(axis).Segments[0].Placement.Location.Coordinates != xy[0]:
        raise ValueError("Reconstructed IFC curve does not start at the ALI origin")
    model_context = next(c for c in model.by_type("IfcGeometricRepresentationContext", include_subtypes=False)
                         if c.ContextType == "Model")
    body_context = context.add_context(model, context_type="Model", context_identifier="Body",
                                       target_view="MODEL_VIEW", parent=model_context)
    markers = []
    for k in range(first_marker, last_marker+1):
        pk = k*interval
        distance = pk-start
        x,y = interpolate(chain,xy,distance)
        z, = interpolate([item[0] for item in zs],[(item[1],) for item in zs],distance)
        name = f"{int(pk//1000)}+{pk%1000:07.3f}"
        if abs(distance) < 1e-8:
            marker = native_ref
        else:
            marker = model.createIfcReferent(GlobalId=ifcopenshell.guid.new(),Name=name,PredefinedType="REFERENCEMARKER")
            nest.assign_object(model,related_objects=[marker],relating_object=axis)
        placement = model.createIfcAxis2Placement3D(Location=model.createIfcCartesianPoint((x,y,z)))
        # Attach a visible swept solid to the referent. Keep the start's linear placement.
        if marker == native_ref and marker.ObjectPlacement.is_a("IfcLinearPlacement"):
            marker.ObjectPlacement.CartesianPosition = placement
        else:
            marker.ObjectPlacement = model.createIfcLocalPlacement(RelativePlacement=placement)
        rep = geometry.add_wall_representation(model, context=body_context, length=.5, height=height, thickness=.35,
                                               offset=-.175)
        geometry.assign_representation(model, marker, rep)
        pset.edit_pset(model, pset=pset.add_pset(model,product=marker,name="DGC_LOC"),properties={
            "DGC_LOC_01_Carretera":road,"DGC_LOC_02_Eje":axis_id,"DGC_LOC_05_PK_Puntual":model.createIfcLengthMeasure(pk)})
        markers.append({"pk":pk,"name":name,"xyz":[x,y,z],"guid":marker.GlobalId})
    return {"axis":axis_id,"alignmentGuid":axis.GlobalId,"pkStart":start,"pkEnd":start+chain[-1],
            "horizontalSegments":len(xy)-1,"verticalRows":len(zs),"markers":markers,
            "locationPsets":add_locations(model,road,axis_id,start,start+chain[-1])}


def prepare(params):
    source = Path(params["filePath"])
    output = Path(params["outputPath"])
    ali, ras = Path(params["aliPath"]), Path(params["rasPath"])
    sources = (source, ali, ras)
    def fingerprint(file):
        digest = sha256()
        with file.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    fingerprints = [fingerprint(file) for file in sources]
    model = ifcopenshell.open(str(source))
    result = enrich(model, ali, ras, params["roadId"], params["intervalMetres"], params["markerHeightMetres"])
    if fingerprints != [fingerprint(file) for file in sources]:
        raise ValueError("IFC or ISTRAM reports changed during processing")
    payload = model.to_string().encode("ascii")
    with output.open("xb") as stream:
        stream.write(payload)
    return {**result, "outputPath":str(output), "sourceSha256":fingerprints[0], "aliSha256":fingerprints[1],
            "rasSha256":fingerprints[2], "sha256":fingerprint(output)}
