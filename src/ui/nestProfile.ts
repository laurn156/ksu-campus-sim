import type { AvatarLook } from '../scene/Player'
import { DEFAULT_PROFILE, type Profile } from './Welcome'

/** Local Nest Life profile (browser only; not authentication). */
export interface NestProfile {
  playerId: string
  displayName: string
  characterPreset: string | null
  characterAppearance: AvatarLook
  hasSeenWelcome: boolean
}

export const NEST_KEY = 'nest-life-profile-v1'
const LEGACY_KEY = 'ksu-campus-profile-v1'
const LEGACY_ACCOUNTS_KEY = 'ksu-campus-demo-profiles-v1'

export const NAME_MAX = 20
/** Trim, collapse inner whitespace, and enforce the length limit. Returns an error message or the clean name. */
export function cleanName(raw: string): { name: string; error: string } {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return { name, error: 'Please enter a name.' }
  if (name.length > NAME_MAX) return { name, error: `Names can be up to ${NAME_MAX} characters.` }
  return { name, error: '' }
}

const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => typeof v === 'string' && (options as readonly string[]).includes(v) ? v as T : fallback
const hex = (v: unknown, fallback: string) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback

/** Validate an appearance object from storage or the network; unknown values fall back to defaults. */
export function validLook(raw: unknown): AvatarLook | null {
  if (!raw || typeof raw !== 'object') return null
  const l = raw as Record<string, unknown>
  const d = DEFAULT_PROFILE.look
  return {
    color: pick(l.color, ['orange', 'yellow', 'cream', 'green', 'blue', 'purple', 'slate', 'charcoal'] as const, d.color),
    headwear: pick(l.headwear === 'bun' ? 'none' : l.headwear, ['none', 'cap', 'beanie', 'bucket', 'headphones', 'headband'] as const, 'none'),
    face: pick(l.face, ['happy', 'dots', 'wink', 'surprised', 'angry'] as const, 'happy'),
    accessory: pick(l.accessory === 'sunglasses' ? 'rectangle' : l.accessory, ['none', 'glasses', 'square', 'rectangle'] as const, 'none'),
    top: pick(l.top, ['tee', 'hoodie', 'ksu-tee', 'ksu-hoodie', 'jersey'] as const, 'tee'),
    topColor: hex(l.topColor, d.topColor),
    bottom: pick(l.bottom, ['shorts', 'skirt', 'pants'] as const, 'pants'),
    bottomColor: hex(l.bottomColor, d.bottomColor),
    jerseyNumber: typeof l.jerseyNumber === 'string' && /^\d{1,2}$/.test(l.jerseyNumber) ? l.jerseyNumber : '12',
    shoes: pick(l.shoes, ['none', 'sneakers', 'black', 'boots', 'flipflops'] as const, 'none'),
    bagStyle: pick(l.bagStyle, ['backpack', 'sling'] as const, 'backpack'),
    bag: pick(l.bag, ['none', 'black', 'cream', 'brown'] as const, l.backpack === true ? 'brown' : 'none'),
    backpack: false,
  }
}

function newId(): string {
  try { return crypto.randomUUID() } catch { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) }
}

/** Load the saved profile. Invalid or missing data returns null, which sends the player to first-time setup. */
export function loadNestProfile(): NestProfile | null {
  try {
    const data = JSON.parse(localStorage.getItem(NEST_KEY) || 'null') as Record<string, unknown> | null
    if (!data || typeof data !== 'object') return null
    const { name, error } = cleanName(typeof data.displayName === 'string' ? data.displayName : '')
    const look = validLook(data.characterAppearance)
    if (error || !look || typeof data.playerId !== 'string' || !data.playerId) return null
    return { playerId: data.playerId, displayName: name, characterPreset: typeof data.characterPreset === 'string' ? data.characterPreset : null, characterAppearance: look, hasSeenWelcome: data.hasSeenWelcome === true }
  } catch { return null }
}

export function saveNestProfile(p: NestProfile) {
  try { localStorage.setItem(NEST_KEY, JSON.stringify(p)) } catch { /* private mode: the session still works */ }
}

/** Start a profile for first-time setup, reusing any character saved by the older menus (never overwriting it). */
export function draftProfile(): NestProfile {
  let look: AvatarLook | null = null, name = ''
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') as Profile | null
    const accounts = JSON.parse(localStorage.getItem(LEGACY_ACCOUNTS_KEY) || '{}') as Record<string, Profile>
    const first = legacy ?? Object.values(accounts ?? {})[0]
    if (first) { look = validLook(first.look); name = typeof first.name === 'string' ? first.name.slice(0, NAME_MAX) : '' }
  } catch { /* ignore broken legacy data */ }
  return { playerId: newId(), displayName: name, characterPreset: look ? null : PRESETS[0].id, characterAppearance: look ?? PRESETS[0].look, hasSeenWelcome: false }
}

const base = DEFAULT_PROFILE.look
export const PRESETS: { id: string; label: string; look: AvatarLook }[] = [
  { id: 'preset_01', label: 'Owl Classic', look: { ...base, color: 'cream', headwear: 'cap', face: 'happy', top: 'ksu-hoodie', topColor: '#29292c', bottom: 'pants', bottomColor: '#4e526b', shoes: 'sneakers', bag: 'black' } },
  { id: 'preset_02', label: 'Sunny Scholar', look: { ...base, color: 'orange', headwear: 'beanie', face: 'dots', accessory: 'glasses', top: 'ksu-tee', topColor: '#d4a720', bottom: 'shorts', bottomColor: '#4e526b', shoes: 'sneakers', bag: 'brown' } },
  { id: 'preset_03', label: 'Chill Coder', look: { ...base, color: 'blue', headwear: 'headphones', face: 'wink', top: 'hoodie', topColor: '#777d9a', bottom: 'pants', bottomColor: '#29292c', shoes: 'black', bag: 'black' } },
  { id: 'preset_04', label: 'Garden Grower', look: { ...base, color: 'green', headwear: 'bucket', face: 'happy', top: 'tee', topColor: '#f5f1e7', bottom: 'skirt', bottomColor: '#82906b', shoes: 'sneakers', bag: 'cream' } },
  { id: 'preset_05', label: 'Game Day', look: { ...base, color: 'purple', headwear: 'headband', face: 'surprised', accessory: 'square', top: 'jersey', jerseyNumber: '7', topColor: '#d4a720', bottom: 'shorts', bottomColor: '#29292c', shoes: 'sneakers' } },
  { id: 'preset_06', label: 'Night Owl', look: { ...base, color: 'charcoal', face: 'dots', accessory: 'rectangle', top: 'ksu-hoodie', topColor: '#d4a720', bottom: 'pants', bottomColor: '#4e526b', shoes: 'black', bag: 'brown' } },
]
