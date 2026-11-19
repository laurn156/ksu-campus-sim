"""Turn the aerial photo into a clean, illustrated ground map (our own artwork from public data).

Each pixel is classified (tree canopy, lawn, light pavement, asphalt, sand/infield, water) and
repainted in a flat palette, then smoothed so shapes stay crisp when magnified. Real paths, plazas,
steps and courts keep their true shapes; cars, shadows and photo noise disappear.

    python3 scripts/stylize_aerial.py public/aerial.jpg public/ground.png
"""

import sys

import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
bright = (r + g + b) / 3
mx = a.max(-1)
mn = a.min(-1)
sat = (mx - mn) / (mx + 1)
green = g - (r + b) / 2
gray = Image.fromarray(bright.astype(np.uint8))
blur = np.asarray(gray.filter(ImageFilter.BoxBlur(3))).astype(np.float32)
tex = np.asarray(Image.fromarray(np.clip(np.abs(bright - blur) * 4, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))).astype(np.float32)

CLASSES = {  # id: color
    0: (141, 190, 96),   # lawn
    1: (88, 132, 66),    # tree canopy (3D trees stand on it)
    2: (222, 216, 204),  # light pavement / sidewalks / plazas
    3: (112, 115, 120),  # asphalt (roads, lots)
    4: (214, 168, 118),  # sand / infield / bare ground
    5: (106, 163, 201),  # water
    6: (186, 182, 176),  # roofs & other built surfaces (mostly hidden under buildings)
}
cls = np.zeros(bright.shape, np.uint8)
veg = (green > -2) & (sat > 0.12) & (bright < 170)
canopy = veg & (bright < 150) & (tex > 11) & (green > 2)
canopy |= (green > 6) & (bright < 95)
water = np.zeros_like(bright, bool)  # water comes from OpenStreetMap polygons, not colour
shadow = (bright < 88) & ~((green > 6) & (bright > 40))
sand = (r > g + 4) & (r > b + 25) & (sat > 0.18) & (bright > 110)
# calibrated on OpenStreetMap walkways/roads vs open land in this photo:
# pavement is nearly colourless (sat ~0.04, g-b ~3); even dry autumn grass is yellow-green (sat ~0.14, g-b ~18)
gb = g - b
paved = (sat < 0.075) & (gb < 9)
pale = paved & (bright >= 140)
asphalt = paved & (bright < 140) & ~veg
cls[:] = 0
cls[sand] = 4
cls[asphalt] = 3
cls[pale] = 2
cls[canopy] = 1
cls[water] = 5
SHADOW = 255
cls[shadow & ~canopy] = SHADOW
# brown autumn grass reads as lawn, not sand, unless it is clearly orange infield
lawnish = ~paved & ~canopy & ~water & ~((r > g + 18) & (bright > 120))
cls[lawnish & ((cls == 4) | (cls == 2) | (cls == 3))] = 0

# smooth class map: majority vote in a small window (median on the label image works well enough
# for these few classes when done per class as a soft mask)
masks = []
far = []
for k in CLASSES:
    hard = Image.fromarray(((cls == k) * 255).astype(np.uint8))
    masks.append(np.asarray(hard.filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32))
    far.append(np.asarray(hard.filter(ImageFilter.GaussianBlur(9))).astype(np.float32))
smooth = np.argmax(np.stack(masks), 0).astype(np.uint8)
# shadows take the class that dominates around them (what the ground under the shadow most likely is)
fill = np.argmax(np.stack(far), 0).astype(np.uint8)
cls = np.where(cls == SHADOW, fill, smooth).astype(np.uint8)
# dark specks inside tree clusters are canopy shadow, not asphalt
canopy_near = far[1] > 110
cls[(cls == 3) & canopy_near] = 1
out = np.zeros(a.shape, np.uint8)
for k, col in CLASSES.items():
    out[cls == k] = col
# subtle variation so big lawns don't look flat (from the photo's own brightness)
shade = (bright - bright.mean()) / 255.0
out = np.clip(out.astype(np.float32) * (1 + 0.18 * shade[..., None]), 0, 255).astype(np.uint8)
img = Image.fromarray(out)
# 2x upscale with smoothing keeps edges clean when the camera is close
img = img.resize((int(img.width * 1.6), int(img.height * 1.6)), Image.LANCZOS).filter(ImageFilter.SMOOTH_MORE)
img.save(dst, quality=88)
print("ground", img.size, {k: round(float((cls == k).mean()) * 100, 1) for k in CLASSES})
