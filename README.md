# KSU Campus Life (working title)

A Sims-inspired game set on Kennesaw State University's **Marietta campus**, built from the real campus layout.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Controls: **WASD** walk, **Shift** run, **drag** (left or right mouse) to look around, **Q/E** turn, mouse **wheel**
zoom, **📍 Go to…** menu to jump to any building or landmark, **M** mute.

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
  (~12,000 trees). Roofs show their own patch of the photo.

- **Buildings look like the real ones** (`src/scene/styles.ts`), using KSU's interactive map and its building
  photos as visual reference: red brick halls, Hornet Village's brick over a cast-stone base, Crawford's tan
  stucco with the concrete screen band, white ribbon-window academic blocks, glass curtain walls (Architecture,
  ETC), tan-brick University Commons with gray hipped roofs, the parking deck, light flat roofs with equipment.
- **Landmarks** (`src/scene/Landmarks.tsx`): Slap the Rock, the gold KSU letters at Hornet Village, the Globe
  plaza, the row of white tents from Math to Administration, the covered walkway with stairs from Crawford to
  Math, the outdoor stage, the Atrium's walk-under canopies, the Library's dome skylight, the University Commons basketball and volleyball courts, plus OpenStreetMap
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

### Campus Life prototype

Choose Campus Life after signing in with a **demo profile**. Walk up to a named student and press **F** (or click their name nearby) to talk. The phone contains relationships, the clock and schedule, a list of locations, and a journal. Walk to a listed building or bench for nearby activities. Needs, academic and involvement points, relationships, a few conversation memories and social story stages are saved in this browser for each demo username. The clock advances one in-game minute per real second; activities advance it further. These are local demo saves, not accounts or cloud saves.

The named students use scripted schedules and lightweight, rule-based conversations by default. Their multi-day stories, invitations and the rotating events are early prototypes. The recreation action is not a playable minigame, and multiplayer across devices is not implemented. Custom messages have limited local topic recognition when AI is unavailable.

For optional generated dialogue **in local development only**, set `OPENAI_API_KEY` in the server environment and start Vite with `VITE_CAMPUS_DIALOGUE_ENDPOINT=/api/campus-dialogue`. The key remains on the development server; player messages and relevant character context are sent to OpenAI when enabled. API usage may incur charges. `OPENAI_MODEL` can select a model; it defaults to `gpt-4.1-mini`. The local endpoint is not a production backend; a deployment needs its own authenticated server and safeguards. Replies fall back to local rules if the service is unavailable. Game effects are calculated locally rather than accepted from model output.

Run the simulation checks with `node --experimental-strip-types scripts/test-life.mjs` on a Node version that supports type stripping. Also run `npm run build` and `npm run lint`.
