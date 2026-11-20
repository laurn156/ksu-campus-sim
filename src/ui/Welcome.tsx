import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Character, type Face, type Headwear } from '../characters/Character'
import { PALETTE, type PaletteName } from '../characters/palette'
import type { AvatarLook } from '../scene/Player'
import './welcome.css'

export type Profile = { name: string; look: AvatarLook }
export const DEFAULT_PROFILE: Profile = { name: '', look: { color: 'blue', headwear: 'none', face: 'happy', accessory: 'none', top: 'tee', topColor: '#29292c', bottom: 'pants', bottomColor: '#4e526b', jerseyNumber: '12', backpack: false, shoes: 'none', bag: 'none', bagStyle: 'backpack' } }
const hats: {value: Headwear; label: string; icon: string}[] = [
  {value:'none',label:'None',icon:'○'}, {value:'cap',label:'Cap',icon:'◒'}, {value:'beanie',label:'Beanie',icon:'◓'}, {value:'bucket',label:'Bucket hat',icon:'⌒'}, {value:'headphones',label:'Headphones',icon:'♬'}, {value:'headband',label:'Headband',icon:'◠'},
]
const faces: {value: Face; label: string; icon:string}[] = [{value:'happy',label:'Happy',icon:'☺'}, {value:'dots',label:'Smile',icon:'•ᴗ•'}, {value:'wink',label:'Wink',icon:'◠ᴗ•'}, {value:'surprised',label:'Surprised',icon:'⊙'}, {value:'angry',label:'Angry',icon:'•̀ᴗ•́'}]
const tops: {value: AvatarLook['top']; label: string; icon:string}[] = [{value:'tee',label:'T-shirt',icon:'♧'},{value:'hoodie',label:'Hoodie',icon:'♧'},{value:'ksu-tee',label:'KSU tee',icon:'KSU'},{value:'ksu-hoodie',label:'KSU hoodie',icon:'KSU'},{value:'jersey',label:'KSU jersey',icon:'KSU'}]
const bottoms: {value: AvatarLook['bottom'];label:string;icon:string}[] = [{value:'shorts',label:'Shorts',icon:'▥'},{value:'skirt',label:'Skirt',icon:'◭'},{value:'pants',label:'Pants',icon:'▥'}]
const clothingColors = ['#29292c','#f5f1e7','#d4a720','#82906b','#777d9a','#aa92ad']
type Section = 'Outfit' | 'Hair & hats' | 'Accessories' | 'Colors' | 'Expression'
const sections: {label:Section; icon:string}[] = [{label:'Outfit',icon:'♧'}, {label:'Hair & hats',icon:'◠'}, {label:'Accessories',icon:'✧'}, {label:'Colors',icon:'◉'}, {label:'Expression',icon:'☺'}]

type Props = { screen: 'welcome' | 'create'; profile: Profile; hasSaved: boolean; onChange: (p: Profile) => void; onCreate: () => void; onPlay: () => void; onBack: () => void; nameError?: string; saveLabel?: string }
export function Welcome({ screen, profile, hasSaved, onChange, onCreate, onPlay, onBack, nameError, saveLabel }: Props) {
  const [section,setSection] = useState<Section>('Outfit')
  const [clothes,setClothes] = useState<'Top'|'Bottom'|'Shoes'>('Top')
  const [rotation,setRotation] = useState(0)
  const set = (patch: Partial<AvatarLook>) => onChange({ ...profile, look: { ...profile.look, ...patch } })
  const randomize = () => set({color:(Object.keys(PALETTE) as PaletteName[])[Math.floor(Math.random()*Object.keys(PALETTE).length)], top:tops[Math.floor(Math.random()*tops.length)].value, bottom:bottoms[Math.floor(Math.random()*bottoms.length)].value, headwear:hats[Math.floor(Math.random()*hats.length)].value})
  return <main className={'start-shell '+(screen==='create'?'creator-shell':'')}>
    <header className="start-header"><div className="start-brand"><span>✦</span> NEST LIFE <small>MARIETTA</small></div><span className="start-edition">A CAMPUS ADVENTURE</span></header>
    {screen === 'welcome' ? <section className="welcome-layout">
      <div className="welcome-copy"><div className="eyebrow">YOUR CAMPUS, YOUR STORY</div><h1>Welcome to<br /><em>Owl Nation.</em></h1><p>Explore familiar places and make the campus your own.</p>
        <div className="welcome-actions"><button className="primary" onClick={hasSaved ? onPlay : onCreate}>{hasSaved ? 'Continue exploring' : 'Create your character'} <span>→</span></button>{hasSaved && <button className="secondary" onClick={onCreate}>Edit character</button>}</div>
        <div className="welcome-note"><span>✳</span> MADE FOR THE KSU COMMUNITY <span>✳</span></div>
      </div><div className="welcome-visual"><div className="visual-label">MEET YOUR CAMPUS COMPANION <b>↗</b></div><div className="character-stage"><CharacterPreview look={profile.look} rotation={0} /></div><div className="visual-bottom"><span>01 / THE BEGINNING</span><strong>LET'S GO, OWLS!</strong></div></div>
    </section> : <section className="creator2">
      <div className="creator2-heading"><button className="back" onClick={onBack}>← Back</button><div><h1>Customize Your Character</h1><p>Create a student for your campus adventure.</p></div></div>
      <div className="creator2-grid">
        <aside className="creator-nav" aria-label="Customization categories">{sections.map(item => <button key={item.label} aria-pressed={section===item.label} onClick={() => setSection(item.label)}><span>{item.icon}</span>{item.label}</button>)}<button className="randomize" onClick={randomize}>⤨ &nbsp; Randomize</button></aside>
        <div className="creator-stage"><div className="stage-kicker">YOUR CHARACTER <span>✦</span></div><div className="stage-character"><CharacterPreview look={profile.look} rotation={rotation} /></div><div className="stage-floor"></div><div className="stage-controls"><button aria-label="Rotate character left" onClick={() => setRotation(r => r-Math.PI/4)}>‹</button><span>ROTATE YOUR CHARACTER</span><button aria-label="Rotate character right" onClick={() => setRotation(r => r+Math.PI/4)}>›</button></div></div>
        <div className="creator-panels"><div className="edit-panel name-panel"><label htmlFor="name">Your name</label><input id="name" maxLength={20} placeholder="Enter your name..." value={profile.name} onChange={e => onChange({...profile,name:e.target.value})} aria-invalid={!!nameError} />{nameError && <p className="name-error" role="alert">{nameError}</p>}</div>
          {section === 'Outfit' && <div className="edit-panel"><div className="panel-title"><h2>♧ &nbsp; Outfit</h2><div className="tabs">{(['Top','Bottom','Shoes'] as const).map(t => <button key={t} aria-pressed={clothes===t} onClick={() => setClothes(t)}>{t}</button>)}</div></div>
            {clothes==='Top' ? <div className="item-grid">{tops.map(t => <Item key={t.value} selected={profile.look.top===t.value} label={t.label} icon={t.icon} onClick={() => set({top:t.value})} />)}</div> : clothes==='Bottom' ? <div className="item-grid">{bottoms.map(t => <Item key={t.value} selected={profile.look.bottom===t.value} label={t.label} icon={t.icon} onClick={() => set({bottom:t.value})} />)}</div> : <div className="item-grid">{([{value:'none',label:'None'},{value:'sneakers',label:'White sneakers'},{value:'black',label:'Black sneakers'},{value:'boots',label:'Boots'},{value:'flipflops',label:'Flip-flops'}] as const).map(t => <Item key={t.value} selected={profile.look.shoes===t.value} label={t.label} icon={t.value==='none'?'○':t.value==='boots'?'▙':t.value==='flipflops'?'⩍':'◒'} onClick={() => set({shoes:t.value})}/>)}</div>}
            {clothes==='Top' && profile.look.top!=='none' && <div className="panel-colors"><b>Top color</b>{clothingColors.map(c => <button key={c} aria-label={'Top color '+c} aria-pressed={profile.look.topColor===c} style={{background:c}} onClick={() => set({topColor:c})} />)}</div>}
            {clothes==='Bottom' && profile.look.bottom!=='none' && <div className="panel-colors"><b>Bottom color</b>{['#4e526b',...clothingColors].map(c => <button key={c} aria-label={'Bottom color '+c} aria-pressed={profile.look.bottomColor===c} style={{background:c}} onClick={() => set({bottomColor:c})} />)}</div>}
            {clothes==='Top' && profile.look.top==='jersey' && <label className="jersey-number">Jersey number <input inputMode="numeric" maxLength={2} value={profile.look.jerseyNumber} onChange={e => set({jerseyNumber:e.target.value.replace(/[^0-9]/g,'').slice(0,2)})} placeholder="12" /></label>}
          </div>}
          {section === 'Hair & hats' && <div className="edit-panel"><div className="panel-title"><h2>◠ &nbsp; Hair & hats</h2></div><div className="item-grid">{hats.map(h => <Item key={h.value} selected={profile.look.headwear===h.value} label={h.label} icon={h.icon} onClick={() => set({headwear:h.value})}/>)}</div><p className="panel-hint">Choose one style at a time.</p></div>}
          {section === 'Accessories' && <div className="edit-panel"><div className="panel-title"><h2>✧ &nbsp; Accessories</h2></div><b>Glasses</b><div className="item-grid">{([{value:'none',label:'None'},{value:'glasses',label:'Round'},{value:'square',label:'Square'},{value:'rectangle',label:'Rectangular'}] as const).map(v => <Item key={v.value} selected={profile.look.accessory===v.value} label={v.label} icon={v.value==='none'?'○':'⚯'} onClick={() => set({accessory:v.value})}/>)}</div><p className="panel-hint"><b>Bag style</b></p><div className="item-grid">{([{value:'backpack',label:'Backpack'},{value:'sling',label:'Sling bag'}] as const).map(v => <Item key={v.value} selected={(profile.look.bagStyle??'backpack')===v.value} label={v.label} icon={v.value==='sling'?'◩':'▣'} onClick={() => set({bagStyle:v.value,bag:profile.look.bag==='none'?'black':profile.look.bag})}/>)}</div><p className="panel-hint"><b>Bag color</b></p><div className="item-grid">{([{value:'none',label:'None'},{value:'black',label:'Black'},{value:'cream',label:'Cream'},{value:'brown',label:'Brown'}] as const).map(v => <Item key={v.value} selected={profile.look.bag===v.value} label={v.label} icon={v.value==='none'?'○':'▣'} onClick={() => set({bag:v.value,backpack:false})}/>)}</div></div>}
          {section === 'Colors' && <div className="edit-panel"><div className="panel-title"><h2>◉ &nbsp; Body color</h2></div><div className="body-colors">{(Object.keys(PALETTE) as PaletteName[]).map(color => <button key={color} aria-label={color} aria-pressed={profile.look.color===color} style={{background:PALETTE[color]}} onClick={() => set({color})} />)}</div></div>}
          {section === 'Expression' && <div className="edit-panel"><div className="panel-title"><h2>☺ &nbsp; Expression</h2></div><div className="item-grid">{faces.map(f => <Item key={f.value} selected={profile.look.face===f.value} label={f.label} icon={f.icon} onClick={() => set({face:f.value})}/>)}</div></div>}
          <div className="edit-panel creator-tip"><b>MAKE IT YOURS</b><p>Start with a blank character and add the pieces you like. You can change your look later.</p><button onClick={() => onChange({...profile,look:{...DEFAULT_PROFILE.look}})}>Reset appearance</button></div>
          <button className="creator-save" onClick={onPlay}>{saveLabel ?? <>Save &amp; Continue</>} <span>→</span></button><p className="creator-save-note">Your character is saved in this browser on this device.</p>
        </div>
      </div>
    </section>}
  </main>
}
function Item({label, icon, selected, onClick}:{label:string;icon:string;selected:boolean;onClick:()=>void}) { return <button className="item" aria-pressed={selected} onClick={onClick}>{icon === '♧' || icon === 'KSU' ? <svg className="garment-icon" viewBox="0 0 60 52" aria-hidden="true"><path d="M18 6 L25 3 Q30 10 35 3 L42 6 L55 16 L49 26 L44 22 L44 46 L16 46 L16 22 L11 26 L5 16 Z" fill={icon === 'KSU' ? '#29292c' : '#e9e4dc'} stroke="#57605b" strokeWidth="2" />{icon === 'KSU' && <text x="30" y="32" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#ffc629">KSU</text>}</svg> : <span>{icon}</span>}<small>{label}</small></button> }
export function CharacterPreview({ look, rotation }: {look: AvatarLook;rotation:number}) {
  return <Canvas camera={{position:[0,0.3,5],fov:33}} dpr={[1,1.5]}><ambientLight intensity={2.2}/><directionalLight position={[4,6,5]} intensity={2}/><group position={[0,-0.7,0]} scale={1.3} rotation={[0,rotation,0]}><Character {...look} /></group></Canvas>
}

