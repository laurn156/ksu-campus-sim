export const DIALOGUE_FORMAT: Record<string, unknown>
export function dialogueMessages(context: unknown): { role: 'system' | 'user'; content: string }[]
export function cleanLine(text: unknown, playerName?: string, maxSentences?: number, maxChars?: number): string
export function parseDialogue(raw: unknown, playerName?: string): { reply: string; options: { warm: string; playful: string; blunt: string } | null } | null
