"""Convert an OpenStreetMap extract of KSU Marietta into public/campus.json.

Coordinates become local meters: x = east, z = south (three.js: -z is north),
origin at the centre of the campus boundary. Map data (c) OpenStreetMap
contributors, ODbL: credit is shown in the game.

    python3 scripts/osm_to_campus.py data/marietta.osm public/campus.json
"""

import json
import math
import re
import sys
import xml.etree.ElementTree as ET

SRC, DST = sys.argv[1], sys.argv[2]
MARGIN_M = 70  # keep features this far outside the campus boundary
LEVEL_H = 3.8

root = ET.parse(SRC).getroot()
nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
node_tags = {n.get("id"): {t.get("k"): t.get("v") for t in n.iter("tag")} for n in root.iter("node")}
ways = []
for w in root.iter("way"):
    t = {x.get("k"): x.get("v") for x in w.iter("tag")}
    ref = [nd.get("ref") for nd in w.iter("nd")]
    ways.append((w.get("id"), t, [nodes[r] for r in ref if r in nodes]))

campus = next(p for _, t, p in ways if t.get("amenity") == "university" and "Marietta" in t.get("name", ""))
lat0 = sum(p[0] for p in campus) / len(campus)
lon0 = sum(p[1] for p in campus) / len(campus)
KX = 111320 * math.cos(math.radians(lat0))
KZ = 110540


def xy(p):
    return (round((p[1] - lon0) * KX, 2), round(-(p[0] - lat0) * KZ, 2))


boundary = [xy(p) for p in campus]


def inside(pt, poly):
    x, z = pt
    c = False
    for i in range(len(poly)):
        x1, z1 = poly[i]
        x2, z2 = poly[i - 1]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1 + 1e-12) + x1:
            c = not c
    return c


def dist_seg(p, a, b):
    ax, az = a
    bx, bz = b
    px, pz = p
    dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz + 1e-9)))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def near_campus(pts):
    for pt in pts[:: max(1, len(pts) // 6)] + [pts[-1]]:
        if inside(pt, boundary) or min(dist_seg(pt, boundary[i - 1], boundary[i]) for i in range(len(boundary))) < MARGIN_M:
            return True
    return False


def area(poly):
    return abs(sum(poly[i - 1][0] * poly[i][1] - poly[i][0] * poly[i - 1][1] for i in range(len(poly)))) / 2


BRICK_HINTS = ("Residence", "Hall", "Commons", "Courtyard", "Village", "Library", "Student Center", "Administration")


def building_style(t, name):
    if t.get("building") in ("dormitory", "residential", "apartments") or any(h in name for h in BRICK_HINTS):
        return "brick"
    if t.get("building") in ("roof", "parking"):
        return "concrete"
    if t.get("building") == "university" or re.match(r"^[A-Z]\d* - ", name):
        return "brick" if hash(name) % 3 else "modern"  # campus mix: mostly brick, some modern
    return "plain"


out = {"origin": {"lat": lat0, "lon": lon0}, "boundary": boundary, "buildings": [], "paths": [], "roads": [],
       "areas": [], "trees": [], "attribution": "Map data © OpenStreetMap contributors (ODbL)"}

ROAD_W = {"motorway": 16, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 9, "unclassified": 7,
          "residential": 7, "service": 5.5, "trunk_link": 8, "construction": 6}
PATH_W = {"footway": 2.6, "path": 2.0, "pedestrian": 6, "steps": 2.6, "cycleway": 2.5}

for wid, t, pts in ways:
    if len(pts) < 2:
        continue
    p = [xy(q) for q in pts]
    if not near_campus(p):
        continue
    closed = pts[0] == pts[-1]
    if "building" in t and closed and len(p) >= 4:
        name = t.get("name", "")
        lv = t.get("building:levels")
        try:
            levels = float(lv) if lv else None
        except ValueError:
            levels = None
        if levels is None:
            levels = 1 if t.get("building") in ("roof", "detached", "shed") else 2
        h = float(t.get("height", levels * LEVEL_H)) if re.match(r"^[\d.]+$", t.get("height", "x")) else levels * LEVEL_H
        if t.get("building") == "roof":
            h = 5
        code = name.split(" - ")[0] if " - " in name else ""
        out["buildings"].append({"id": wid, "name": name, "code": code, "short": name.split(" - ", 1)[-1] if name else "",
                                 "poly": p[:-1], "h": round(h, 1), "levels": levels,
                                 "style": building_style(t, name), "kind": t.get("building")})
    elif t.get("highway") in PATH_W:
        out["paths"].append({"pts": p, "w": PATH_W[t["highway"]], "kind": t["highway"]})
    elif t.get("highway") in ROAD_W:
        out["roads"].append({"pts": p, "w": ROAD_W[t["highway"]], "kind": t["highway"], "name": t.get("name", "")})
    elif closed and len(p) >= 4:
        kind = None
        if t.get("amenity") == "parking":
            kind = "parking"
        elif t.get("leisure") == "pitch":
            kind = "pitch:" + t.get("sport", "other")
        elif t.get("leisure") in ("park", "garden") or t.get("landuse") in ("grass", "recreation_ground", "meadow"):
            kind = "grass"
        elif t.get("natural") == "wood" or t.get("landuse") == "forest":
            kind = "wood"
        elif t.get("natural") == "water" or t.get("landuse") == "basin":
            kind = "water"
        elif t.get("leisure") in ("track", "stadium"):
            kind = "track"
        if kind:
            out["areas"].append({"kind": kind, "poly": p[:-1], "name": t.get("name", ""), "a": round(area(p))})

for nid, t in node_tags.items():
    if t.get("natural") == "tree":
        p = xy(nodes[nid])
        if near_campus([p]):
            out["trees"].append(p)

out["areas"].sort(key=lambda a: -a["a"])  # big first, so small areas draw on top
xs = [x for b in out["buildings"] for x, _ in b["poly"]] + [x for x, _ in boundary]
zs = [z for b in out["buildings"] for _, z in b["poly"]] + [z for _, z in boundary]
out["extent"] = [min(xs) - MARGIN_M, min(zs) - MARGIN_M, max(xs) + MARGIN_M, max(zs) + MARGIN_M]
json.dump(out, open(DST, "w"), separators=(",", ":"))
named = sorted(b["name"] for b in out["buildings"] if b["name"])
print(f"buildings {len(out['buildings'])} ({len(named)} named), paths {len(out['paths'])}, roads {len(out['roads'])}, "
      f"areas {len(out['areas'])}, trees {len(out['trees'])}, extent {[round(v) for v in out['extent']]}")
print(named)
