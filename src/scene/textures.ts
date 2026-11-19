import * as THREE from 'three'

// Procedural facade textures (no image files): one tile = one window bay (3.2 m) x one floor (3.8 m).
const cache = new Map<string, THREE.CanvasTexture>()

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

function makeFacade(style: string): THREE.CanvasTexture {
  const W = 128
  const H = 152
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = rng(style.length * 977 + 13)
  if (style === 'brick') {
    g.fillStyle = '#9c4f3c'
    g.fillRect(0, 0, W, H)
    // brick courses with slight colour variation and mortar lines
    for (let y = 0; y < H; y += 6) {
      for (let x = (y / 6) % 2 ? -8 : 0; x < W; x += 16) {
        const v = 0.85 + r() * 0.25
        g.fillStyle = `rgb(${Math.round(156 * v)},${Math.round(79 * v)},${Math.round(60 * v)})`
        g.fillRect(x + 1, y + 1, 14, 4)
      }
    }
    // light stone band at each floor line (like the campus' trim)
    g.fillStyle = '#d8cbb4'
    g.fillRect(0, H - 10, W, 10)
    windows(g, W, H, '#2f4a63', '#efe7d6', 30, 34, 68, 70)
  } else if (style === 'modern') {
    g.fillStyle = '#d9dbd8'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#c7cac7'
    g.fillRect(0, H - 14, W, 14)
    // wide glass band
    g.fillStyle = '#3d5a73'
    g.fillRect(6, 30, W - 12, 86)
    g.fillStyle = 'rgba(255,255,255,.18)'
    g.fillRect(6, 30, W - 12, 20)
    g.fillStyle = '#9aa3a8'
    for (let x = 6; x < W; x += 30) g.fillRect(x, 30, 3, 86)
  } else if (style === 'concrete') {
    g.fillStyle = '#b9b6ae'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#8f8c86'
    g.fillRect(0, 60, W, 40)
  } else {
    g.fillStyle = '#d8ccb6'
    g.fillRect(0, 0, W, H)
    windows(g, W, H, '#44586a', '#f4efe4', 36, 40, 56, 60)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function windows(g: CanvasRenderingContext2D, W: number, _H: number, glass: string, frame: string, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = frame
  g.fillRect(x0 - 5, y0 - 5, w + 10, h + 10)
  g.fillStyle = glass
  g.fillRect(x0, y0, w, h)
  g.fillStyle = 'rgba(255,255,255,.22)'
  g.fillRect(x0, y0, w, h * 0.3)
  g.fillStyle = frame
  g.fillRect(x0 + w / 2 - 2, y0, 4, h)
  void W
}

export function facade(style: string): THREE.CanvasTexture {
  if (!cache.has(style)) cache.set(style, makeFacade(style))
  return cache.get(style)!
}

/** Parking stripes: one tile = 2.7 m stall width. */
export function parkingTexture(): THREE.CanvasTexture {
  if (cache.has('parking')) return cache.get('parking')!
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#6d6f73'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = 'rgba(255,255,255,.8)'
  g.fillRect(0, 0, 3, 40)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  cache.set('parking', t)
  return t
}
