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
  // brick with glass bands (ETC, Atrium, Stingers)
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
  // open parking deck: concrete spandrel + dark open floor
  deck: (g) => {
    g.fillStyle = '#c4c1ba'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#3e4246'
    g.fillRect(0, 50, W, 90)
    g.fillStyle = '#c4c1ba'
    g.fillRect(60, 50, 8, 90)
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
