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

The named students use scripted schedules and lightweight, rule-based conversations by default. Their multi-day stories, invitations and the rotating events are early prototypes. The recreation action is not a playable minigame. KSU Connect requires the separate limited-test setup below. Custom messages have limited local topic recognition when AI is unavailable.

For locally generated student dialogue, install [Ollama](https://ollama.com/download), start Ollama, and run `ollama pull qwen3:4b` once (about 2.5 GB). Start the game with `npm install` and `npm run dev -- --host 127.0.0.1`, then open the local address shown in the terminal. The model runs on the same computer as the game and does not require an API key or per-message payment. The first response can take longer while the model loads. If Ollama or the model is unavailable, conversations automatically use the built-in rules. Other players need their own Ollama installation and model download. Performance depends on their hardware.

The dialogue endpoint is provided only by the local Vite development server and is restricted to same-origin requests from the local computer. It is not included in a static build or `npm run preview`; those use fallback replies. Do not expose the development server publicly. Dialogue is generated locally, but the model can still make mistakes or invent details; deterministic game rules control the actual effects.

Run the simulation checks with `node --experimental-strip-types scripts/test-life.mjs` on a Node version that supports type stripping. Also run `npm run build` and `npm run lint`.

### KSU Connect: limited online test (setup required)

Connect uses Supabase anonymous Auth, a profile table, and private Realtime channels. Players can choose a demo name without an email. Their identity is saved in their current browser only; signing out or clearing browser data loses access, and another device starts a new profile. Anonymous demo players may enter the room without individual approval, so treat the room as an open demo and do not expose it publicly before adding abuse protections. It is **unfinished and has not been verified with a real Supabase project or deployed site**. Keep it restricted to people you trust: there are no blocking/reporting tools, authoritative movement checks, or server-side chat rate limits yet. Presence claims are not identity-verified, but movement and chat are received on per-user channels that only that user's authenticated account may publish to. Do not offer this as public multiplayer yet.

1. Create a Supabase project. In its SQL Editor run `supabase/setup.sql` once. In Realtime settings disable **Allow public access to channels** so private channel policies are enforced.
2. Copy `.env.example` to `.env.local` and fill in the project URL and **publishable/anon key** from Supabase. Never put a secret or service-role key in frontend environment variables. Restart Vite after changing the file.
3. Configure the Auth site URL and redirect allowlist for your local and deployed game URLs. Enable email/password sign-in and set up email confirmation and password reset delivery. Supabase's default email service has testing restrictions; use your own SMTP if needed.
4. Create test accounts in the game, confirm their emails, then log in. Usernames are claimed on first login, with case-insensitive uniqueness enforced by the database; a conflict currently needs a different account/username.
5. In the SQL Editor, approve each test account by replacing the example email and running `insert into public.campus_testers (id) select id from auth.users where email = 'tester@example.com';`. Never commit actual tester emails or credentials. Anonymous demo players can enter the shared room; email accounts still require tester approval.
6. Test two accounts in separate browsers/computers: profiles, appearance, movement, chat, reconnect and departure. A static deployment also requires the two public Vite environment variables at build time. Repeat the tests on the deployed URL.

Online accounts use the same avatar editor in both modes; guest profiles and Campus Life progress remain local to their browser. The previous same-browser Connect demo is no longer the Connect mode. Friends, reporting, blocking, direct messages, and activities are not implemented.
