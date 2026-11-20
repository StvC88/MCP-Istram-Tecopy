"""Create an IFC review variant of the observed three-rail Istram tessellation."""
import os
import tempfile
from pathlib import Path

import ifcopenshell
import numpy as np
from ifcopenshell.util.unit import calculate_unit_scale
from ifcopenshell.util.placement import get_local_placement


def middle_rail(points, dz):
    """Match closed rectangular rings at three fixed levels in every station."""
    pts = np.asarray(points, dtype=float)
    if len(pts) < 30 or len(pts) % 15 or not np.isfinite(pts).all():
        return None
    rings = pts.reshape(-1, 3, 5, 3)
    heights = rings[:, :, :, 2] - rings[:, :1, :1, 2]
    pattern = np.array([0., -.33, -.65])[:, None] + [0., 0., -.10, -.10, 0.]
    if not np.allclose(heights, pattern, atol=.001, rtol=0) or not np.allclose(
            rings[:, :, 0], rings[:, :, 4], rtol=0, atol=.001):
        return None
    changed = rings.copy()
    changed[:, 1, :, 2] += dz
    return changed.reshape(-1, 3)


def prepare(params):
    source, output = (Path(params[k]) for k in ("filePath", "outputPath"))
    dz = params["offsetMetres"]
    if not 0 < abs(dz) <= .10 or any(p.suffix.lower() != ".ifc" for p in (source, output)):
        raise ValueError("Expected IFC files and a nonzero offset up to 0.10 metre")
    if output.exists():
        raise FileExistsError(output)
    model = ifcopenshell.open(str(source))
    if model.schema_identifier != "IFC4X3_ADD2" or calculate_unit_scale(model) != 1:
        raise ValueError("Expected metric IFC4X3_ADD2")
    results = []
    for guid in params["guids"]:
        obj = model.by_guid(guid)
        if not (obj.is_a("IfcBuildingElementProxy") or obj.is_a("IfcRailing")):
            raise ValueError("Unsupported product " + guid)
        if not np.allclose(get_local_placement(obj.ObjectPlacement)[:3, 2], [0, 0, 1]):
            raise ValueError("Expected local vertical aligned with Z")
        body, = [r for r in obj.Representation.Representations if r.RepresentationIdentifier == "Body"]
        found = []
        for item in body.Items:
            if not item.is_a("IfcTriangulatedFaceSet"):
                continue
            changed = middle_rail(item.Coordinates.CoordList, dz)
            if changed is not None:
                found.append((item, changed))
        (item, changed), = found
        indices = np.asarray(item.CoordIndex, dtype=int) - 1
        if (item.PnIndex or indices.ndim != 2 or indices.shape[1] != 3 or not indices.size
                or indices.min() < 0 or indices.max() >= len(changed)):
            raise ValueError("Expected direct triangle indices: " + guid)
        rails = indices % 15 // 5
        if (rails != rails[:, :1]).any() or set(rails.ravel()) != {0, 1, 2}:
            raise ValueError("Expected three independent longitudinal rails: " + guid)
        for child, parent in ((item.Coordinates, item), (item, body), (body, obj.Representation), (obj.Representation, obj)):
            users = {u for u in model.get_inverse(child) if not u.is_a("IfcStyledItem") and not u.is_a("IfcPresentationLayerAssignment")}
            if users != {parent}:
                raise ValueError("Shared geometry or representation: " + guid)
        item.Coordinates.CoordList = changed.tolist()
        results.append({"guid": guid, "stations": len(changed)//15, "movedVertices": len(changed)//3})
    fd, temp = tempfile.mkstemp(suffix=".ifc", dir=output.parent)
    os.close(fd)
    try:
        model.write(temp)
        if os.name == "nt":
            os.rename(temp, output)  # Windows rejects an existing destination.
        else:
            os.link(temp, output)
    finally:
        Path(temp).unlink(missing_ok=True)
    return {"outputPath": str(output), "offsetMetres": dz, "products": results, "nativeExport": False}
