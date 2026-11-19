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

Regenerate the campus data: `python3 scripts/osm_to_campus.py data/marietta.osm public/campus.json`

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the
Open Database License (ODbL). Not an official Kennesaw State University product.
