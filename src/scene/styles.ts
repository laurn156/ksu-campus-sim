// How each real Marietta building looks, from KSU's interactive map and its building photos
// (used as visual reference only). Keyed by the campus letter code.

export interface Look {
  wall: string // facade style (textures.ts)
  base?: string // ground-floor style, if different
  roof: 'flat' | 'hip'
  roofColor?: string
  floors?: number // override when OSM has no/odd floor count
}

const L = (wall: string, roof: Look['roof'] = 'flat', extra: Partial<Look> = {}): Look => ({ wall, roof, ...extra })

export const LOOKS: Record<string, Look> = {
  A: L('redbrick', 'flat', { floors: 2 }), // Joe Mack Wilson Student Center
  B: L('redbrick', 'flat', { floors: 2 }), // Administration
  C: L('librarybrick', 'flat', { floors: 3 }), // Library
  D: L('mathscreen', 'flat', { base: 'mathglass', floors: 2 }), // Mathematics: glazed ground floor and concrete screen
  E: L('mathscreen', 'flat', { base: 'mathglass', floors: 2 }), // Crawford Lab
  G: L('whiteband', 'flat'), // Engineering Lab
  H: L('academicbrick', 'flat', { floors: 3 }), // Academic Building
  I1: L('whiteband', 'flat'),
  I2: L('designlargeglass', 'flat', { floors: 2 }),
  J: L('atriumbrick', 'flat', { floors: 3 }), // Atrium
  L: L('metal', 'flat'),
  L1: L('metal', 'flat'),
  M: L('redbrick', 'flat'), // Textile Center
  N: L('glass', 'flat', { base: 'redbrick' }), // Architecture
  O: L('metal', 'flat'),
  P60: L('deck', 'flat'), // Parking deck
  Q: L('etcglass', 'flat', { base: 'etcbrick', floors: 3 }), // Engineering Technology Center
  R1: L('redbrick', 'flat'), // Howell Hall
  R2: L('redbrick', 'flat'), // Norton Hall
  R10: L('tanbrick', 'hip', { roofColor: '#6d6a68' }),
  R20: L('tanbrick', 'hip', { roofColor: '#6d6a68' }),
  R30: L('tanbrick', 'hip', { roofColor: '#6d6a68' }),
  R701: L('hvbrick', 'flat', { base: 'stone' }), // Hornet Village 1
  R702: L('hvbrick', 'flat', { base: 'stone' }), // Hornet Village 2
  S1: L('redbrick', 'flat'), // Recreation and Wellness
  S2: L('metal', 'flat'), // Gym
  T: L('redbrick', 'flat'), // Wilder Communications
  X: L('brickglass', 'flat', { base: 'redbrick' }), // Stingers
}

export function lookFor(code: string, name: string, kind: string): Look {
  if (LOOKS[code]) return LOOKS[code]
  // University Commons (R100..R600), Courtyards (R1000..R3000), Columns: tan brick with gray hipped roofs
  if (/^R\d{3,4}$/.test(code) || name.startsWith('University Columns')) return L('tanbrick', 'hip', { roofColor: '#6b6966' })
  if (name === 'Science Lab Annex') return L('metal', 'flat')
  if (kind === 'roof') return L('metal', 'flat')
  if (kind === 'detached' || kind === 'house' || kind === 'apartments') return L('tanbrick', 'hip', { roofColor: '#5f5c59' })
  return L('plain', 'flat')
}
