import * as THREE from 'three'

// Procedural facade textures (no image files). One tile = one window bay (3.2 m) x one floor (3.8 m).
// Styles are drawn to match the real Marietta buildings (see scene/styles.ts).
const cache = new Map<string, THREE.CanvasTexture>()
const W = 128
const H = 152

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

function brick(g: CanvasRenderingContext2D, base: [number, number, number], seed: number) {
  const r = rng(seed)
  g.fillStyle = `rgb(${base.map((v) => Math.round(v * 0.72)).join(',')})` // mortar
  g.fillRect(0, 0, W, H)
  for (let y = 0; y < H; y += 6)
    for (let x = (y / 6) % 2 ? -8 : 0; x < W; x += 16) {
      const v = 0.86 + r() * 0.22
      g.fillStyle = `rgb(${base.map((c) => Math.round(c * v)).join(',')})`
      g.fillRect(x + 1, y + 1, 14, 4)
    }
}

function win(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: string, glass = '#2f4a63', mullions = 1) {
  g.fillStyle = frame
  g.fillRect(x - 4, y - 4, w + 8, h + 8)
  g.fillStyle = glass
  g.fillRect(x, y, w, h)
  g.fillStyle = 'rgba(255,255,255,.2)'
  g.fillRect(x, y, w, h * 0.3)
  g.fillStyle = frame
  for (let i = 1; i <= mullions; i++) g.fillRect(x + (w * i) / (mullions + 1) - 1.5, y, 3, h)
}

const DRAW: Record<string, (g: CanvasRenderingContext2D) => void> = {
  // Design 2: broad glass panes separated by pale mullions and a low sill.
  designlargeglass: (g) => {
    g.fillStyle = '#415e5b'; g.fillRect(0, 0, W, H)
    const light = g.createLinearGradient(0, 0, W, H)
    light.addColorStop(0, 'rgba(170,202,194,.28)'); light.addColorStop(1, 'rgba(20,44,42,.12)')
    g.fillStyle = light; g.fillRect(0, 0, W, H)
    g.fillStyle = '#d4dcd5'; g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H)
    g.fillRect(0, 0, W, 6); g.fillRect(0, H - 19, W, 6); g.fillRect(0, H - 5, W, 5)
  },
  // Mathematics: dark glazed ground floor behind slim pale frames.
  mathglass: (g) => {
    g.fillStyle = '#334c49'; g.fillRect(0, 0, W, H)
    const reflection=g.createLinearGradient(0,0,W,H);reflection.addColorStop(0,'rgba(176,205,193,.25)');reflection.addColorStop(1,'rgba(22,40,36,.10)');g.fillStyle=reflection;g.fillRect(0,0,W,H)
    g.fillStyle='#b4bcb3';for(let x=0;x<W;x+=32)g.fillRect(x,0,3,H)
    for(const y of [3,74,146])g.fillRect(0,y,W,3)
    g.fillStyle='#d6d7cd';g.fillRect(0,0,7,H)
  },
  // Recessed, repeated concrete openings in the upper screen.
  mathscreen: (g) => {
    g.fillStyle='#d4d4cb';g.fillRect(0,0,W,H)
    for(let y=2;y<H;y+=38)for(let x=2;x<W;x+=32){
      g.fillStyle='#a7aaa1';g.fillRect(x,y,27,34)
      g.fillStyle='#515d58';g.fillRect(x+5,y+4,18,26)
      g.fillStyle='#e4e4da';g.fillRect(x,y,4,34);g.fillRect(x,y,27,3)
      g.fillStyle='#818a81';g.fillRect(x+22,y+3,5,30);g.fillRect(x+4,y+30,20,3)
    }
  },
  studentmetal: (g) => {
    g.fillStyle = '#e0e2dc'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#b9bdb8'
    for (let x = 0; x < W; x += 17) g.fillRect(x, 0, 2, H)
  },
  // Perforated reddish screen on the projecting Design 2 wings.
  brickscreen: (g) => {
    g.fillStyle = '#a65d45'; g.fillRect(0, 0, W, H)
    for (let y = 3; y < H; y += 7) for (let x = (y / 7 | 0) % 2 ? 1 : 5; x < W; x += 9) {
      g.fillStyle = '#633b32'; g.fillRect(x, y, 5, 3)
      g.fillStyle = '#ca8268'; g.fillRect(x, y + 3, 5, 1)
    }
  },
  // The library's entrance has an uninterrupted brick facade.
  librarybrick: (g) => { brick(g, [150, 79, 66], 19) },
  // classic campus red brick with stone sill band (Student Center, Library, Howell/Norton, Wilder)
  redbrick: (g) => {
    brick(g, [158, 74, 52], 7)
    g.fillStyle = '#ddd2bd'
    g.fillRect(0, H - 9, W, 9)
    win(g, 30, 36, 68, 72, '#e9e2d2')
  },
  // ground floor of Hornet Village: tan cast stone with tall windows
  stone: (g) => {
    g.fillStyle = '#cdb994'
    g.fillRect(0, 0, W, H)
    g.fillStyle = 'rgba(0,0,0,.08)'
    for (let y = 0; y < H; y += 19) g.fillRect(0, y, W, 2)
    win(g, 24, 28, 80, 104, '#8e8a83', '#355066', 2)
  },
  // Hornet Village upper floors: red-orange brick, paired windows
  hvbrick: (g) => {
    brick(g, [176, 82, 50], 11)
    win(g, 20, 40, 36, 74, '#d9cfbb')
    win(g, 72, 40, 36, 74, '#d9cfbb')
  },
  // University Commons / Courtyard / Columns: tan brick apartments
  tanbrick: (g) => {
    brick(g, [190, 160, 118], 5)
    win(g, 36, 38, 56, 66, '#f2ece0', '#3d5568')
    g.fillStyle = '#efe6d4'
    g.fillRect(30, 108, 68, 6)
  },
  // long white concrete academic blocks with dark ribbon windows
  whiteband: (g) => {
    g.fillStyle = '#e4e3dd'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#2d3f4f'
    g.fillRect(0, 46, W, 56)
    g.fillStyle = 'rgba(255,255,255,.16)'
    g.fillRect(0, 46, W, 16)
    g.fillStyle = '#c9c8c1'
    g.fillRect(0, 46, 4, 56)
    g.fillRect(62, 46, 4, 56)
    g.fillRect(0, H - 6, W, 6)
  },
  // Crawford Lab: concrete screen-block band over a tan stucco ground floor
  stucco: (g) => {
    g.fillStyle = '#d6c096'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#e4dccb'
    g.fillRect(0, 8, W, 70)
    g.fillStyle = '#a99c84'
    for (let x = 2; x < W; x += 10) for (let y = 12; y < 74; y += 10) g.fillRect(x, y, 6, 6)
    win(g, 34, 96, 60, 44, '#7a776f', '#38495a', 2)
  },
  // Architecture: blue-green glass curtain wall with light mullions
  glass: (g) => {
    g.fillStyle = '#5f8e99'
    g.fillRect(0, 0, W, H)
    const grd = g.createLinearGradient(0, 0, W, H)
    grd.addColorStop(0, 'rgba(255,255,255,.25)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#d7dcdc'
    for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 3, H)
    g.fillRect(0, 0, W, 6)
    g.fillRect(0, 70, W, 3)
  },
  // Engineering Technology Center: glass curtain wall with fine horizontal rails.
  etcglass: (g) => {
    g.fillStyle='#426e70';g.fillRect(0,0,W,H)
    const reflection=g.createLinearGradient(0,0,W,H);reflection.addColorStop(0,'rgba(193,220,209,.30)');reflection.addColorStop(.55,'rgba(107,163,157,.08)');reflection.addColorStop(1,'rgba(25,51,50,.2)');g.fillStyle=reflection;g.fillRect(0,0,W,H)
    g.fillStyle='#bdcbc7';for(let x=0;x<W;x+=32)g.fillRect(x,0,2,H);for(let y=0;y<H;y+=38)g.fillRect(0,y,W,2)
  },
  etcbrick: (g) => { brick(g,[120,76,60],13) },
  // Academic Building: broad brick walls and narrow horizontal window strips.
  academicbrick: (g) => {
    brick(g, [151, 84, 66], 47)
    g.fillStyle='#d0b7a5';g.fillRect(0,H-5,W,5)
    g.fillStyle='#344c4a';g.fillRect(0,42,W,24)
    g.fillStyle='#87948b';for(let x=0;x<W;x+=32)g.fillRect(x,42,2,24)
    g.fillStyle='#b8b6a6';g.fillRect(0,40,W,2);g.fillRect(0,66,W,2)
  },
  // Atrium: warm red brick, pale horizontal bands, and wide dark windows.
  atriumbrick: (g) => {
    brick(g, [166, 96, 74], 29)
    g.fillStyle = '#e6d9c5'; g.fillRect(0, 3, W, 7); g.fillRect(0, H - 12, W, 8)
    win(g, 15, 31, 98, 78, '#d9c9b6', '#334d50', 2)
  },
  // brick with glass bands (Atrium and other buildings)
  brickglass: (g) => {
    brick(g, [150, 70, 50], 3)
    g.fillStyle = '#577f8b'
    g.fillRect(0, 40, W, 70)
    g.fillStyle = 'rgba(255,255,255,.2)'
    g.fillRect(0, 40, W, 18)
    g.fillStyle = '#d6dad9'
    for (let x = 0; x < W; x += 32) g.fillRect(x, 40, 3, 70)
  },
  // labs, sheds, gym: ribbed metal panels
  metal: (g) => {
    g.fillStyle = '#b8bcbd'
    g.fillRect(0, 0, W, H)
    g.fillStyle = 'rgba(0,0,0,.09)'
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 3, H)
  },
  // Small pale square ceramic tiles on the Textile Center's curved and flat walls.
  textiletile: (g) => {
    g.fillStyle='#d9d9d3';g.fillRect(0,0,W,H)
    g.strokeStyle='#b7b9b3';g.lineWidth=1
    for(let x=0;x<=W;x+=8){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
    for(let y=0;y<=H;y+=8){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  },
  textilebrick: (g) => { brick(g,[163,119,105],46) },
  // West Deck: red brick surrounds the partially visible lower parking level.
  westdeck: (g) => {
    brick(g, [145, 75, 63], 810)
    g.fillStyle='#d0c4b5';g.fillRect(0,0,W,5) // coping
    g.fillStyle='#454a45';g.fillRect(10,43,W-20,59) // recessed opening
    g.fillStyle='#74645b';g.fillRect(10,43,W-20,4)
    g.fillStyle='#b39a88';g.fillRect(10,101,W-20,4) // sill
  },
  // open parking deck: concrete spandrel + dark open floor
  deck: (g) => {
    // open-sided parking level: dim interior with car silhouettes, concrete spandrel band, columns
    g.fillStyle = '#5c5f63'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#7a7d80'
    g.fillRect(0, 0, W, 22) // ceiling underside
    const cars = ['#c9ccd0', '#2a2c30', '#8c2a2a', '#3a5a8c', '#e8e8e8']
    for (let i = 0; i < 3; i++) {
      g.fillStyle = cars[(i * 2 + 1) % cars.length]
      g.fillRect(8 + i * 40, 66, 32, 16)
      g.fillRect(14 + i * 40, 56, 20, 12)
    }
    g.fillStyle = '#d8d4cb' // spandrel
    g.fillRect(0, 86, W, H - 86)
    g.fillStyle = 'rgba(0,0,0,.08)'
    g.fillRect(0, 86, W, 4)
    g.fillStyle = '#cfcbc2' // columns
    g.fillRect(0, 0, 10, H)
    g.fillRect(W - 10, 0, 10, H)
  },
  plain: (g) => {
    g.fillStyle = '#d8ccb6'
    g.fillRect(0, 0, W, H)
    win(g, 36, 40, 56, 60, '#f4efe4', '#44586a')
  },
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function facade(style: string): THREE.CanvasTexture {
  if (!cache.has(style)) cache.set(style, canvasTex(W, H, DRAW[style] ?? DRAW.plain))
  return cache.get(style)!
}

/** Flat roof membrane: light gray with faint seams (tile = 8 m). */
export function roofTexture(): THREE.CanvasTexture {
  if (!cache.has('roof'))
    cache.set('roof', canvasTex(64, 64, (g) => {
      g.fillStyle = '#d9d8d3'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = 'rgba(0,0,0,.05)'
      g.fillRect(0, 0, 64, 2)
      g.fillRect(0, 32, 64, 1)
    }))
  return cache.get('roof')!
}

/** Parking stripes: one tile = 2.7 m stall width. */
export function parkingTexture(): THREE.CanvasTexture {
  if (!cache.has('parking'))
    cache.set('parking', canvasTex(64, 64, (g) => {
      g.fillStyle = '#6d6f73'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = 'rgba(255,255,255,.8)'
      g.fillRect(0, 0, 3, 40)
    }))
  return cache.get('parking')!
}

/** Stair treads across a walkway (tile = 0.35 m of run). */
export function stepsTexture(): THREE.CanvasTexture {
  if (!cache.has('steps'))
    cache.set('steps', canvasTex(16, 16, (g) => {
      g.fillStyle = '#d9d3c5'
      g.fillRect(0, 0, 16, 16)
      g.fillStyle = '#9d978a'
      g.fillRect(0, 12, 16, 4)
    }))
  return cache.get('steps')!
}

/** Text painted on a canvas (signs, the rock). */
export function textTexture(text: string, opts: { bg: string; fg: string; w?: number; h?: number; font?: string }): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = opts.w ?? 512
  c.height = opts.h ?? 128
  const g = c.getContext('2d')!
  g.fillStyle = opts.bg
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = opts.fg
  g.font = opts.font ?? `900 ${Math.round(c.height * 0.55)}px Nunito, Arial, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, c.height / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
