# Nest Life

A Sims-inspired game set on Kennesaw State University's **Marietta campus**, built from the real campus layout.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Controls: **WASD** walk, **Shift** run, drag to look around, **Q/E** turn, mouse wheel to zoom, **G** enter a nearby building, **T** talk to a nearby character, **B** board a nearby bus, and **M** mute. Use **View location** to look around campus and **Activities** to start a game.

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

## Campus activities

The Activities menu starts Bathtub Race, Disc Golf, Big Owl Bus, Slap the Rock, Hooty Hoo Hunt, classes, the photo booth, vending repair, and robot-arm tic-tac-toe. Walk around campus to find people and buildings; approach a building and press **G** to enter, or press **T** near a student or Scrappy to talk. Use the phone to view relationships, players, and saved photos.

## Guest multiplayer demo

The default campus session is account-free. To host on one computer:

```sh
npm install
npm run build
HOST=0.0.0.0 npm run serve
```

Open `http://localhost:4173` on the host. Another device on the same network can open `http://<host-local-IP>:4173`; allow port 4173 through the host firewall if needed. Both devices must connect to the same running server. For production hosting, the Node host must support WebSockets.

Campus chat reaches everyone connected. Open the phone's **Players** tab for friend requests, private messages, and invitations to tic-tac-toe, Slap the Rock, the photo booth, disc golf, and bathtub racing. Guest identities, friendships, and messages are temporary and disappear on disconnect or server restart. Character customization stays in the browser. This is a hackathon demo; the guest relay is not a moderated or identity-verified public service.

## Ollama classes and conversations

Install Ollama on the game server, start it, and pull the model:

```sh
ollama pull qwen3:4b
```

The development server supports the AI endpoints on localhost. For a shared demo, `npm run serve` serves both the built game and its Ollama proxy; players do not need Ollama on their own devices. The defaults are `http://127.0.0.1:11434` and `qwen3:4b`. The server can be configured with `HOST`, `PORT`, `OLLAMA_URL`, and `OLLAMA_MODEL`. If Ollama is unavailable, NPC conversations use fallback dialogue; classes show an error and allow a retry. A static-only host cannot provide the Ollama endpoints.

## Optional ELEGOO controller

The current setup uses a Mega 2560, joystick, and photoresistor. See the [wiring and setup guide](docs/ELEGOO-WIRING.md) and [Arduino sketch](hardware/elegoo/NestLifeJoystick/NestLifeJoystick.ino). The joystick controls walking and interaction; the photoresistor changes the sky and lighting from night at 400 or below to day at 600 or above, with a gradual transition. The controller is optional and is disabled when another player connects. Keyboard and mouse remain available.

On Linux, `npm run dev` starts a local serial bridge for the Mega at `/dev/ttyACM0`. Close Arduino IDE's Serial Monitor before enabling the controller. The joystick and light sensor were tested on the demo hardware; other hardware integrations remain unfinished. The local bridge is loopback-only and is not included in `npm run serve`.

## Checks

```sh
npm run build
npm run lint
node scripts/test-demo-relay.mjs
node scripts/test-campus-contests.mjs
node scripts/test-hardware-controller.mjs
```

Additional focused checks live in `scripts/test-*.mjs`. Automated tests cannot replace checking 3D presentation, real hardware, and two physical devices during a demo.
