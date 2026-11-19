import { Canvas } from '@react-three/fiber'
import { Character, type Face, type Headwear } from '../characters/Character'
import { PALETTE, type PaletteName } from '../characters/palette'
import type { AvatarLook } from '../scene/Player'
import './welcome.css'

export type Profile = { name: string; look: AvatarLook }
export const DEFAULT_PROFILE: Profile = { name: '', look: { color: 'blue', headwear: 'cap', face: 'happy', accessory: 'none', top: 'tee', bottom: 'shorts', backpack: false } }
const hats: {value: Headwear; label: string}[] = [
  {value:'none',label:'None'}, {value:'cap',label:'Cap'}, {value:'beanie',label:'Beanie'}, {value:'bucket',label:'Bucket hat'}, {value:'bun',label:'Buns'}, {value:'headphones',label:'Headphones'}, {value:'headband',label:'Headband'},
]
const faces: {value: Face; label: string}[] = [{value:'happy',label:'Happy'}, {value:'dots',label:'Smile'}, {value:'wink',label:'Wink'}, {value:'surprised',label:'Surprised'}, {value:'angry',label:'Focused'}]

type Props = { screen: 'welcome' | 'create'; profile: Profile; hasSaved: boolean; onChange: (p: Profile) => void; onCreate: () => void; onPlay: () => void; onBack: () => void }
export function Welcome({ screen, profile, hasSaved, onChange, onCreate, onPlay, onBack }: Props) {
  const set = (patch: Partial<AvatarLook>) => onChange({ ...profile, look: { ...profile.look, ...patch } })
  return <main className="start-shell">
    <header className="start-header"><div className="start-brand"><span>✦</span> CAMPUS LIFE <small>MARIETTA</small></div><span className="start-edition">A CAMPUS ADVENTURE</span></header>
    {screen === 'welcome' ? <section className="welcome-layout">
      <div className="welcome-copy"><div className="eyebrow">YOUR CAMPUS, YOUR STORY</div><h1>Welcome to<br /><em>Owl Nation.</em></h1><p>Find your people, explore familiar places, and make the campus your own.</p>
        <div className="welcome-actions"><button className="primary" onClick={hasSaved ? onPlay : onCreate}>{hasSaved ? 'Continue exploring' : 'Create your character'} <span>→</span></button>{hasSaved && <button className="secondary" onClick={onCreate}>Edit character</button>}</div>
        <div className="welcome-note"><span>✳</span> MADE FOR THE KSU COMMUNITY <span>✳</span></div>
      </div>
      <div className="welcome-visual"><div className="visual-label">MEET YOUR NEW CAMPUS COMPANION <b>↗</b></div><div className="character-stage"><CharacterPreview look={profile.look} /></div><div className="visual-bottom"><span>01 / THE BEGINNING</span><strong>LET'S GO, OWLS!</strong></div></div>
    </section> : <section className="creator-layout">
      <div className="creator-heading"><button className="back" onClick={onBack}>← Back</button><div><div className="eyebrow">THE FIRST STEP</div><h1>Make yourself <em>at home.</em></h1><p>Create a character for your campus adventure.</p></div><span className="step-badge">CHARACTER CREATOR / 01</span></div>
      <div className="creator-grid"><div className="preview-card"><div className="preview-top"><span>YOUR CHARACTER</span><b>✦</b></div><div className="preview-canvas"><CharacterPreview look={profile.look} /></div><div className="preview-bottom"><div><small>READY FOR CAMPUS</small><strong>{profile.name.trim() || 'Your character'}</strong></div><span>✳</span></div></div>
      <div className="customize"><label className="field-label" htmlFor="name">WHAT SHOULD WE CALL YOU? <span>OPTIONAL</span></label><input id="name" maxLength={24} placeholder="Enter a name" value={profile.name} onChange={e => onChange({...profile, name: e.target.value})} />
        <fieldset><legend>01 <b>Body color</b></legend><div className="colors">{(Object.keys(PALETTE) as PaletteName[]).map(color => <button key={color} aria-label={color} aria-pressed={profile.look.color===color} className={'swatch '+(profile.look.color===color?'selected':'')} style={{background:PALETTE[color]}} onClick={() => set({color})} />)}</div></fieldset>
        <fieldset><legend>02 <b>Headwear & hair</b></legend><div className="choices">{hats.map(({value,label}) => <button key={value} aria-pressed={profile.look.headwear===value} onClick={() => set({headwear:value})}>{label}</button>)}</div></fieldset>
        <fieldset><legend>03 <b>Expression</b></legend><div className="choices">{faces.map(({value,label}) => <button key={value} aria-pressed={profile.look.face===value} onClick={() => set({face:value})}>{label}</button>)}</div></fieldset>
        <fieldset><legend>04 <b>Outfit</b></legend><div className="choice-row"><label>Top<select value={profile.look.top} onChange={e => set({top:e.target.value as AvatarLook['top']})}><option value="none">None</option><option value="tee">T-shirt</option><option value="hoodie">Hoodie</option></select></label><label>Bottom<select value={profile.look.bottom} onChange={e => set({bottom:e.target.value as AvatarLook['bottom']})}><option value="none">None</option><option value="shorts">Shorts</option><option value="skirt">Skirt</option></select></label></div><div className="choices extras"><button aria-pressed={profile.look.accessory==='glasses'} onClick={() => set({accessory:profile.look.accessory==='glasses'?'none':'glasses'})}>Glasses</button><button aria-pressed={profile.look.backpack} onClick={() => set({backpack:!profile.look.backpack})}>Backpack</button></div></fieldset>
        <button className="primary start-playing" onClick={onPlay}>Let's explore <span>→</span></button><p className="save-note">Your character is saved on this device. You can edit them later.</p>
      </div></div>
    </section>}
  </main>
}
function CharacterPreview({ look }: {look: AvatarLook}) {
  return <Canvas camera={{position:[0,0.3,5],fov:33}} dpr={[1,1.5]}><ambientLight intensity={2.2}/><directionalLight position={[4,6,5]} intensity={2}/><group position={[0,-0.7,0]} scale={1.3}><Character {...look} /></group></Canvas>
}

