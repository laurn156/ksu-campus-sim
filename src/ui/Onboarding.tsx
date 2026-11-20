import { useState } from 'react'
import { PALETTE } from '../characters/palette'
import { CharacterPreview } from './Welcome'
import { NAME_MAX, PRESETS, cleanName, type NestProfile } from './nestProfile'

type Step = 'welcome' | 'name' | 'character' | 'ready'
type Props = { draft: NestProfile; startStep?: Step; onChange: (p: NestProfile) => void; onCustomize: () => void; onCancel: () => void; onDone: () => void; busy?: boolean; error?: string }

/** First-time setup: welcome → name → character → ready. Shown over the live campus menu background. */
export function Onboarding({ draft, startStep = 'welcome', onChange, onCustomize, onCancel, onDone, busy, error }: Props) {
  const [step, setStep] = useState<Step>(startStep)
  const [nameText, setNameText] = useState(draft.displayName)
  const [nameError, setNameError] = useState('')
  const submitName = () => {
    const { name, error } = cleanName(nameText)
    if (error) { setNameError(error); return }
    setNameError(''); onChange({ ...draft, displayName: name }); setStep('character')
  }
  return <div className="menu-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
    {step === 'welcome' && <div className="menu-card">
      <div className="card-owl" aria-hidden="true">🦉</div>
      <h2 id="onboard-title">Welcome to Nest Life!</h2>
      <p>Before you explore campus, let's get you ready.</p>
      <button className="menu-btn primary small" onClick={() => setStep('name')}>Get Started</button>
      <button className="link-btn" onClick={onCancel}>Back to menu</button>
    </div>}
    {step === 'name' && <form className="menu-card" onSubmit={e => { e.preventDefault(); submitName() }} noValidate>
      <Steps at={1} />
      <h2 id="onboard-title">What should we call you?</h2>
      <input className="name-input" autoFocus maxLength={NAME_MAX} placeholder="Enter your name..." value={nameText} aria-invalid={!!nameError} aria-describedby="name-help"
        onChange={e => { setNameText(e.target.value); if (nameError) setNameError('') }} />
      <p id="name-help" className={nameError ? 'field-error' : 'field-help'} role={nameError ? 'alert' : undefined}>{nameError || `Up to ${NAME_MAX} characters. Other players will see this name.`}</p>
      <div className="card-row"><button type="button" className="link-btn" onClick={() => setStep('welcome')}>← Back</button><button type="submit" className="menu-btn primary small">Next ▶</button></div>
    </form>}
    {step === 'character' && <div className="menu-card wide">
      <Steps at={2} />
      <h2 id="onboard-title">Choose Your Character</h2>
      <div className="choose-grid">
        <div className="choose-preview"><CharacterPreview look={draft.characterAppearance} rotation={0} /></div>
        <div>
          <div className="preset-grid" role="radiogroup" aria-label="Character presets">
            {PRESETS.map(p => <button key={p.id} role="radio" aria-checked={draft.characterPreset === p.id} className="preset" onClick={() => onChange({ ...draft, characterPreset: p.id, characterAppearance: { ...p.look } })}>
              <span className="preset-dot" style={{ background: PALETTE[p.look.color] }} /><span>{p.label}</span>
            </button>)}
          </div>
          {draft.characterPreset === null && <p className="field-help">Using your custom look.</p>}
          <button className="menu-btn small ghost" onClick={onCustomize}>✎ More customization options</button>
        </div>
      </div>
      <div className="card-row"><button className="link-btn" onClick={() => setStep('name')}>← Back</button><button className="menu-btn primary small" onClick={() => setStep('ready')}>Next ▶</button></div>
    </div>}
    {step === 'ready' && <div className="menu-card ready">
      <div className="ready-preview"><CharacterPreview look={draft.characterAppearance} rotation={0} /></div>
      <div>
        <h2 id="onboard-title">You're all set, {draft.displayName}!</h2>
        <p>Time to explore KSU Marietta.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="menu-btn primary small" disabled={busy} onClick={onDone}>{busy ? 'Joining campus…' : "Let's Go! ▶"}</button>
        <button className="link-btn" disabled={busy} onClick={() => setStep('character')}>← Back</button>
      </div>
    </div>}
  </div>
}

function Steps({ at }: { at: number }) { return <div className="steps" aria-label={`Step ${at} of 2`}>{[1, 2].map(n => <span key={n} className={n <= at ? 'on' : ''} />)}</div> }

/** One-time campus greeting from Scrappy, then a brief controls reminder. */
export function CampusGreeting({ onSeen }: { onSeen: () => void }) {
  const [phase, setPhase] = useState<'hello' | 'controls' | 'done'>('hello')
  if (phase === 'done') return null
  if (phase === 'controls') return <div className="controls-toast" role="status" onAnimationEnd={() => setPhase('done')}>
    <span><kbd>WASD</kbd> Move</span><span><kbd>Drag</kbd> Look around</span><span><kbd>F</kbd> Talk</span><span><kbd>G</kbd> Go inside</span>
  </div>
  return <div className="greeting" role="dialog" aria-labelledby="greet-title">
    <div className="card-owl" aria-hidden="true">🦉</div>
    <div><b id="greet-title">Scrappy</b><p>Hooty Hoo! Welcome to Nest Life! Explore campus, meet other students, and see what you can find!</p>
      <button className="menu-btn primary small" autoFocus onClick={() => { setPhase('controls'); onSeen() }}>Got it!</button></div>
  </div>
}
