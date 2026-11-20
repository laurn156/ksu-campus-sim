
// Tiny synthesized sound kit (WebAudio, no files). Soft, toy-like tones to
// match the clay look. Press M to mute.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
try {
  muted = localStorage.getItem('rival.muted') === '1'
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = 0.35
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; when?: number; vol?: number; slide?: number } = {}) {
  const c = ac()
  if (!c || !master || muted) return
  const t0 = c.currentTime + (opts.when ?? 0)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = opts.type ?? 'triangle'
  o.frequency.setValueAtTime(freq, t0)
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(opts.vol ?? 0.5, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(dur: number, vol = 0.25, when = 0, cutoff = 1800) {
  const c = ac()
  if (!c || !master || muted) return
  const t0 = c.currentTime + when
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = cutoff
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(master)
  src.start(t0)
}

export const sfx = {
  horn() { tone(220, .35, { type: 'sawtooth', vol: .28 }); tone(277, .35, { type: 'square', vol: .12 }) },
  hit(speed: number, mine: boolean) {
    const k = Math.min(1, speed / 4)
    tone((mine ? 520 : 400) + k * 360, 0.09, { type: 'sine', vol: 0.35 + k * 0.35, slide: 0.7 })
    noise(0.04, 0.15 + k * 0.2, 0, 2500)
  },
  goal(mine: boolean) {
    const notes = mine ? [523, 659, 784, 1047] : [440, 370, 311, 262]
    notes.forEach((f, i) => tone(f, mine ? 0.22 : 0.26, { when: i * 0.09, vol: 0.45, type: mine ? 'triangle' : 'sine' }))
    if (mine) noise(0.5, 0.12, 0.05, 6000) // little crowd "pssh"
  },
  bounce() {
    tone(1250, 0.04, { type: 'sine', vol: 0.25 })
  },
  tick() {
    tone(880, 0.06, { type: 'square', vol: 0.12 })
  },
  start() {
    tone(392, 0.12, { vol: 0.4 })
    tone(784, 0.25, { when: 0.12, vol: 0.45 })
  },
  reveal() {
    ;[659, 880, 1175].forEach((f, i) => tone(f, 0.5, { when: i * 0.12, type: 'sine', vol: 0.35 }))
  },
  boss() {
    tone(110, 0.6, { type: 'sawtooth', vol: 0.18, slide: 0.8 })
    tone(98, 0.8, { type: 'sawtooth', vol: 0.15, when: 0.25, slide: 0.7 })
  },
  win() {
    ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, { when: i * 0.1, vol: 0.4 }))
  },
  lose() {
    ;[392, 349, 330, 262].forEach((f, i) => tone(f, 0.28, { when: i * 0.16, vol: 0.35, type: 'sine' }))
  },
  toggleMute() {
    muted = !muted
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.1)
    try {
      localStorage.setItem('rival.muted', muted ? '1' : '0')
    } catch {
      /* ignore */
    }
    return muted
  },
  get muted() {
    return muted
  },
}

// ------------------------------------------------------------------ music
// A small synthesized loop: I-vi-IV-V in C at 100 bpm, soft pad + bass + a light melody and shaker.
// Scheduled ahead with a timer (the standard WebAudio "lookahead" pattern) so it never drifts.
const CHORDS = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
]
const BASS = [130.81, 110.0, 87.31, 98.0]
const MELODY = [523.25, 0, 659.25, 587.33, 0, 523.25, 0, 440, 523.25, 0, 587.33, 0, 659.25, 0, 783.99, 0]
const STEP = 60 / 100 / 2 // eighth notes at 100 bpm
let musicOn = false
let musicGain: GainNode | null = null
let step = 0
let nextTime = 0
let timer: number | undefined

function musicNote(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !musicGain) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(musicGain)
  o.start(at)
  o.stop(at + dur + 0.05)
}

function shaker(at: number, vol: number) {
  if (!ctx || !musicGain) return
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = 6000
  const g = ctx.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(musicGain)
  src.start(at)
}

function schedule() {
  if (!ctx || !musicGain) return
  while (nextTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(step / 8) % 4
    const s8 = step % 8
    if (s8 === 0) CHORDS[bar].forEach((f) => musicNote(f, nextTime, STEP * 7.5, 'triangle', 0.05))
    if (s8 === 0 || s8 === 4) musicNote(BASS[bar], nextTime, STEP * 3.5, 'sine', 0.14)
    const m = MELODY[step % 16]
    if (m && Math.floor(step / 16) % 2 === 1) musicNote(m, nextTime, STEP * 1.6, 'sine', 0.05)
    shaker(nextTime, s8 % 2 ? 0.02 : 0.04)
    nextTime += STEP
    step++
  }
}

export function startMusic() {
  const c = ac()
  if (!c || !master || musicOn) return
  musicOn = true
  musicGain = c.createGain()
  musicGain.gain.value = muted ? 0 : 0.55
  musicGain.connect(master)
  nextTime = c.currentTime + 0.1
  timer = window.setInterval(schedule, 100)
}

export function stopMusic() {
  musicOn = false
  if (timer) clearInterval(timer)
  musicGain?.disconnect()
  musicGain = null
}

let installed = false
export function installSfx() {
  if (installed) return
  installed = true
  // browsers only allow audio after a user gesture
  addEventListener('pointerdown', () => startMusic(), { once: true })
  addEventListener('keydown', () => startMusic(), { once: true })
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' && !(e.target instanceof HTMLInputElement)) sfx.toggleMute()
  })
}
