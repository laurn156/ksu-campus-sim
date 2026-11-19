"""Find tree canopy in the aerial photo and write 3D tree positions into public/campus.json.

Canopy = darker, textured green (lawns are brighter and smooth). Sampled on a grid in meters;
each canopy cell becomes a tree, sized by how dense the canopy is around it.

    python3 scripts/trees_from_aerial.py public/aerial.jpg public/campus.json
"""

import json
import sys

import numpy as np
from PIL import Image, ImageFilter

IMG, CAMPUS = sys.argv[1], sys.argv[2]
STEP = 7.0  # meters between candidate trees

c = json.load(open(CAMPUS))
x0, z0, x1, z1 = c["extent"]
im = Image.open(IMG).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
bright = (r + g + b) / 3
green = g - (r + b) / 2
# local texture: canopy is bumpy, lawns/roofs/pavement are smooth
gray = Image.fromarray(bright.astype(np.uint8))
blur = np.asarray(gray.filter(ImageFilter.BoxBlur(3))).astype(np.float32)
tex = np.abs(bright - blur)
tex = np.asarray(Image.fromarray(np.clip(tex * 4, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))).astype(np.float32)
canopy = (green > 2) & (bright < 150) & (tex > 11)
canopy |= (green > 6) & (bright < 95)  # deep shade inside woods
cover = np.asarray(Image.fromarray((canopy * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(6))).astype(np.float32) / 255

def inside(x, z, poly):
    inside_ = False
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi:
            inside_ = not inside_
    return inside_

bbs = [(min(p[0] for p in b_["poly"]), min(p[1] for p in b_["poly"]), max(p[0] for p in b_["poly"]), max(p[1] for p in b_["poly"]), b_["poly"]) for b_ in c["buildings"]]

def on_building(x, z):
    for ax, az, bx, bz, poly in bbs:
        if ax - 2 < x < bx + 2 and az - 2 < z < bz + 2 and inside(x, z, poly):
            return True
    return False

rng = np.random.default_rng(3)
trees = []
z = z0
while z < z1:
    x = x0
    while x < x1:
        jx = x + rng.uniform(-STEP / 2, STEP / 2)
        jz = z + rng.uniform(-STEP / 2, STEP / 2)
        px = int((jx - x0) / (x1 - x0) * (W - 1))
        py = int((jz - z0) / (z1 - z0) * (H - 1))
        if 0 <= px < W and 0 <= py < H:
            cv = cover[py, px]
            if canopy[py, px] and cv > 0.4 and not on_building(jx, jz):
                trees.append([round(float(jx), 1), round(float(jz), 1), round(float(0.75 + 0.6 * min(1.0, cv)), 2)])
        x += STEP
    z += STEP
c["trees"] = trees
c["treesFromAerial"] = True
tmp = CAMPUS + ".tmp"
json.dump(c, open(tmp, "w"), separators=(",", ":"))
import os
os.replace(tmp, CAMPUS)  # never leave a half-written campus.json
print("trees from aerial:", len(trees))
# debug overlay
dbg = im.copy().convert("RGB")
px = dbg.load()
for tx, tz, s in trees:
    X = int((tx - x0) / (x1 - x0) * (W - 1)); Y = int((tz - z0) / (z1 - z0) * (H - 1))
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            if 0 <= X + dx < W and 0 <= Y + dy < H:
                px[X + dx, Y + dy] = (255, 0, 255)
dbg.save(sys.argv[3] if len(sys.argv) > 3 else "/dev/null", "JPEG") if len(sys.argv) > 3 else None
