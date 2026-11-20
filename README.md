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
  Buildings stay opaque when viewed from outside.

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

### Unified campus and Supabase setup

Registered players and AI students share one campus. Logged-in accounts use Supabase Presence for online status and private broadcast channels for movement; social requests and private messages use the existing database tables. Offline local profiles remain playable without online features.

For an existing project that already has `supabase/setup.sql` and `supabase/migrations/social.sql`, run **`supabase/migrations/unified_campus.sql`** in that project's SQL editor. It adds the optional `offline_roaming` and `major` fields and allows authenticated users to connect to campus realtime channels. For a new project, apply `setup.sql`, `social.sql`, and `unified_campus.sql` in that order. The public Supabase URL and publishable key belong in `.env.local`; never put a service role key in frontend environment variables.

Open **Social → Settings** to opt into offline roaming. This is off by default and available to registered accounts, not anonymous demo accounts. Up to 10 opted-in accounts are shown in a deterministic, client-side approximation based on their IDs and the current time; Presence suppresses their offline representation when the owner is online. The current simulation uses short sidewalk segments and timed building appearances, and does not persist the exact last position or provide true shared NPC AI. Real players in the same building see one another; private messages work across locations. Friends and messages refresh about every three seconds.

Before a multiplayer demonstration, configure and apply the migrations, then test with two distinct registered accounts in separate browser profiles: move outdoors and indoors, send and accept a friend request, exchange messages, enable offline roaming, disconnect one account, and reconnect. This repository cannot apply the migration without database administration access.

Campus Life needs, relationships, story progress and memories remain in local browser storage rather than Supabase. Press F near an AI student to talk; their dialogue uses built-in rules unless Ollama with `qwen3:4b` is available to the local Vite development server. To enable local dialogue, install Ollama, run `ollama pull qwen3:4b`, and run the development server on localhost. Static builds use fallback dialogue. Do not expose the Vite development server publicly. Run the simulation checks with `node --experimental-strip-types scripts/test-life.mjs`.

Before testing accounts, configure the Supabase Auth site URL, redirect allowlist, email/password sign-in, confirmation and password reset delivery. Anonymous demo identities are tied to their browser and cannot be recovered after sign-out. This multiplayer prototype is not ready for public release: presence claims are not identity-verified, and it lacks authoritative movement, server-side chat rate limiting and moderation tooling. Per-user broadcast channels and database RLS still restrict who can publish as a user or read private messages. In Supabase Realtime settings, disable public channel access so private-channel policies are enforced.
