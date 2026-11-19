# KSU Campus Life (working title)

A Sims-inspired game set on Kennesaw State University's **Marietta campus**, built from the real campus layout.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Controls: **WASD** walk, **Shift** run, **click** the ground to walk there, **Q/E** or right-drag to turn the
camera, mouse **wheel** to zoom, **M** mute.

## How the campus is built

- `data/marietta.osm`: an OpenStreetMap extract of the campus area.
- `scripts/osm_to_campus.py` converts it into `public/campus.json` (local meters): every building's real
  footprint, floor count and name (with the campus letter codes, e.g. A Student Center, C Library, Q Engineering
  Technology Center), walkways, roads, parking lots, fields, lawns, woods and water.
- The game renders it in an illustrated style inspired by KSU's interactive map: brick and modern facades with
  real-scale window grids, parapets and rooftop units, instanced trees, parked cars and lamp posts.
  Buildings between the camera and your character fade out (cutaway, like The Sims).

- **Ground from real aerial photography:** `public/aerial.jpg` is USDA NAIP imagery (public domain, ~0.5 m/px)
  of the exact campus area. `scripts/stylize_aerial.py` repaints it into our illustrated ground
  (`public/ground.jpg`: lawn, tree canopy, pavement, asphalt, infield), so every real walkway, plaza and lawn
  shape is in the right place. `scripts/trees_from_aerial.py` places a 3D tree on every patch of real canopy
  (~12,000 trees). Roofs show their own patch of the photo. **G** cycles ground styles: illustrated / photo / drawn.

- **Buildings look like the real ones** (`src/scene/styles.ts`), using KSU's interactive map and its building
  photos as visual reference: red brick halls, Hornet Village's brick over a cast-stone base, Crawford's tan
  stucco with the concrete screen band, white ribbon-window academic blocks, glass curtain walls (Architecture,
  ETC), tan-brick University Commons with gray hipped roofs, the parking deck, light flat roofs with equipment.
- **Landmarks** (`src/scene/Landmarks.tsx`): Slap the Rock, the gold KSU letters at Hornet Village, the Globe
  plaza and white tent canopies, the University Commons basketball and volleyball courts, plus OpenStreetMap
  benches, flagpoles, the fountain, bus shelters and stairs.

Regenerate the campus data (in order):

```bash
python3 scripts/osm_to_campus.py data/marietta.osm public/campus.json
python3 scripts/trees_from_aerial.py public/aerial.jpg public/campus.json      # needs numpy + pillow
python3 scripts/stylize_aerial.py public/aerial.jpg public/ground.jpg
```

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the
Open Database License (ODbL). Aerial imagery: USDA National Agriculture Imagery Program (NAIP), public domain,
via the USGS National Map. Not an official Kennesaw State University product.
