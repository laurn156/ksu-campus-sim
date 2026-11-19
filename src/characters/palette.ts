// Sampled from the concept sheet's "Color Palette Ideas".
export const PALETTE = {
  orange: '#E9876B',
  yellow: '#F2CC5F',
  cream: '#F4E7C8',
  green: '#AECB91',
  blue: '#8AB1E8',
  purple: '#B9A5E0',
  slate: '#6F90C4',
  charcoal: '#4B4B52',
} as const
export type PaletteName = keyof typeof PALETTE

export const OFFWHITE = '#F8F3E8'
export const INK = '#2B2A2E'

// Accent (sash/headband/stripes) that reads well against each body color.
export const ACCENT: Record<PaletteName, string> = {
  orange: OFFWHITE,
  yellow: OFFWHITE,
  cream: PALETTE.orange,
  green: OFFWHITE,
  blue: OFFWHITE,
  purple: OFFWHITE,
  slate: OFFWHITE,
  charcoal: '#E25B4A',
}

// Darker shade for hats/headphones on the same character.
export function shade(hex: string, k = 0.78) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * k)
  const g = Math.round(((n >> 8) & 255) * k)
  const b = Math.round((n & 255) * k)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
