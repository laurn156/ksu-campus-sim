import { useEffect, useMemo, useRef, useState } from 'react'
import { centroid, Collider, distToSeg, isCampusBuilding, type Campus } from '../campus'
import { approach, player } from '../scene/Player'
import { landmarkSpots } from '../scene/Landmarks'
import { scrappy } from '../scene/Scrappy'
import { busPositions } from '../scene/Buses'
import { community } from '../scene/Community'
import type { Mode } from './GameFlow'

/** Closest campus building to the player (within ~30 m of its walls). */
function useNearby(campus: Campus) {
  const [near, setNear] = useState<{ name: string; code: string } | null>(null)
  useEffect(() => {
    const bs = campus.buildings.filter(isCampusBuilding)
    const spots = landmarkSpots(campus)
    const id = setInterval(() => {
      const lm = spots.find((s) => Math.hypot(s.at[0] - player.x, s.at[1] - player.z) < s.r)
      if (lm) {
        setNear((cur) => (cur?.name === lm.name ? cur : { name: lm.name, code: '★' }))
        return
      }
      let best: (typeof bs)[number] | null = null
      let bd = 30
      for (const b of bs) {
        for (let i = 0, j = b.poly.length - 1; i < b.poly.length; j = i++) {
          const d = distToSeg(player.x, player.z, b.poly[j], b.poly[i])
          if (d < bd) {
            bd = d
            best = b
          }
        }
      }
      setNear((cur) => (cur?.name === best?.name ? cur : best ? { name: best.short || best.name, code: best.code } : null))
    }, 250)
    return () => clearInterval(id)
  }, [campus])
  return near
}

export function Minimap({ campus, onOpen }: { campus: Campus; onOpen: () => void }) {
  const SIZE = 230
  const [x0, z0, x1, z1] = campus.extent
  const s = SIZE / Math.max(x1 - x0, z1 - z0)
  const P = (x: number, z: number) => `${((x - x0) * s).toFixed(1)},${((z - z0) * s).toFixed(1)}`
  const shapes = useMemo(
    () => ({
      boundary: campus.boundary.map(([x, z]) => P(x, z)).join(' '),
      buildings: campus.buildings.map((b) => ({ id: b.id, pts: b.poly.map(([x, z]) => P(x, z)).join(' '), ksu: isCampusBuilding(b) })),
      paths: campus.paths.map((p) => p.pts.map(([x, z]) => P(x, z)).join(' ')),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campus],
  )
  const dot = useRef<SVGGElement>(null)
  useEffect(() => {
    let id = 0
    const tick = () => {
      if (dot.current) dot.current.setAttribute('transform', `translate(${P(player.x, player.z)}) rotate(${(-player.heading * 180) / Math.PI + 180})`)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus])
  return (
    <button className="minimap" onClick={onOpen} aria-label="Open campus map" title="Open campus map">
      <svg width={SIZE} height={((z1 - z0) / (x1 - x0)) * SIZE} viewBox={`0 0 ${SIZE} ${((z1 - z0) * s).toFixed(0)}`}>
        <polygon points={shapes.boundary} className="mm-campus" />
        {shapes.paths.map((p, i) => (
          <polyline key={i} points={p} className="mm-path" />
        ))}
        {shapes.buildings.map((b) => (
          <polygon key={b.id} points={b.pts} className={b.ksu ? 'mm-ksu' : 'mm-bldg'} />
        ))}
        <g ref={dot}>
          <path d="M0,-6 L4.5,5 L0,2.5 L-4.5,5 Z" className="mm-me" />
        </g>
      </svg>
      <span className="mm-n">N</span>
    </button>
  )
}

/** "Go to" menu: jump straight to any campus building or landmark. */
function GoTo({ campus, onView }: { campus: Campus; onView: (target:{x:number;z:number;yaw:number})=>void }) {
  const places = useMemo(() => {
    const bs = campus.buildings
      .filter(isCampusBuilding)
      .map((b) => ({ label: `${b.code ? b.code + ' · ' : ''}${b.short || b.name}`, go: () => approach(campus, b.poly) }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    const lm = landmarkSpots(campus).map((l) => ({ label: `★ ${l.name}`, go: () => ({ x: l.at[0] + 6, z: l.at[1] + 6, yaw: Math.PI / 4 }) }))
    const collider = new Collider(campus.buildings)
    const near = (x: number, z: number) => {
      for (let r = 6; r <= 25; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r
        if (!collider.blocked(px, pz, 1)) return { x: px, z: pz, yaw: a }
      }
      return { x, z: z + 12, yaw: 0 }
    }
    const moving = [
      { label: '★ Big Owl Bus', go: () => { const b = busPositions.filter(Boolean).reduce((best, p) => Math.hypot(p.x-player.x,p.z-player.z) < Math.hypot(best.x-player.x,best.z-player.z) ? p : best, busPositions.find(Boolean) ?? { x: -90, z: -311 }); return near(b.x, b.z) } },
      { label: '★ Scrappy the Owl', go: () => near(scrappy.x, scrappy.z) },
    ]
    return [...moving, ...lm, ...bs]
  }, [campus])
  return (
    <select
      className="goto"
      value=""
      onChange={(e) => {
        const p = places[Number(e.target.value)]
        if (p) onView(p.go())
        e.target.blur() // keep WASD for walking
      }}
    >
      <option value="">📍 View location…</option>
      {places.map((p, i) => (
        <option key={i} value={i}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

function CampusMap({campus,onClose}:{campus:Campus;onClose:()=>void}) {
  const [x0,z0,x1,z1]=campus.extent
  const [,refresh]=useState(0)
  useEffect(()=>{const id=setInterval(()=>refresh(n=>n+1),250);return ()=>clearInterval(id)},[])
  const locations=campus.buildings.filter(b=>['A','C','J','S1','X'].includes(b.code))
  return <div className="map-shade" role="dialog" aria-modal="true" aria-label="Campus map"><div className="map-sheet"><header><div><b>Campus map</b><small>North is up · your position is the blue dot</small></div><button onClick={onClose}>Close ✕</button></header>
    <svg viewBox={x0+' '+z0+' '+(x1-x0)+' '+(z1-z0)} role="img" aria-label="Marietta campus map">
      <polygon points={campus.boundary.map(p=>p.join(',')).join(' ')} fill="#dae5d0" stroke="#9caf92" strokeWidth="4"/>
      {campus.paths.map((p,i)=><polyline key={i} points={p.pts.map(pt=>pt.join(',')).join(' ')} fill="none" stroke="#b8b8a9" strokeWidth="3"/>)}
      {campus.buildings.map(b=><polygon key={b.id} points={b.poly.map(p=>p.join(',')).join(' ')} fill="#b99173"/>)}
      {locations.map(b=>{const [x,z]=centroid(b.poly);return <g key={b.id}><circle cx={x} cy={z} r="13" fill="#202e25"/><text x={x} y={z+5} textAnchor="middle" fontSize="17" fontWeight="bold" fill="#fff">{b.code}</text></g>})}
      {busPositions.filter(Boolean).map((b,i)=><circle key={i} cx={b.x} cy={b.z} r="8" fill="#e5ad19" stroke="#242424" strokeWidth="3"/>)}
      <circle cx={scrappy.x} cy={scrappy.z} r="9" fill="#151515" stroke="#e5ad19" strokeWidth="4"/>
      <circle cx={player.x} cy={player.z} r="13" fill="#397ac0" stroke="white" strokeWidth="5"/>
    </svg><div className="map-legend">{locations.map(b=><span key={b.id}><b>{b.code}</b> {b.short||b.name}</span>)}</div><p>Blue: you · gold: buses · black and gold: Scrappy. Moving markers update live. The map does not move your character.</p></div></div>
}

export function Hud({ campus, onEdit, mode, onModes }: { campus: Campus; onEdit: () => void; mode: Mode; onModes: () => void }) {
  const near = useNearby(campus)
  const [nearby,setNearby] = useState<{kind:'student'|'scrappy'|'bus';name:string;line:string;index?:number}|null>(null)
  const [message,setMessage] = useState('')
  const [mapOpen,setMapOpen] = useState(false)
  const [viewing,setViewing] = useState(false)
  const savedYaw=useRef(0)
  const viewLocation=(target:{x:number;z:number;yaw:number})=>{
    if(!player.view) savedYaw.current=player.yaw
    player.view=target;player.yaw=target.yaw;player.viewChanged=true;setViewing(true)
  }
  const returnToPlayer=()=>{player.view=null;player.yaw=savedYaw.current;player.viewChanged=true;setViewing(false)}
  useEffect(()=>()=>{player.view=null},[])
  useEffect(() => {
    if (mode !== 'life') return
    const closest = () => {
      const candidates: {kind:'student'|'scrappy'|'bus';name:string;line:string;distance:number;index?:number}[] = []
      candidates.push({kind:'scrappy',name:'Scrappy',line:'Hooty Hoo! Thanks for stopping by!',distance:Math.hypot(scrappy.x-player.x,scrappy.z-player.z)})
      busPositions.forEach((b,i)=>{if(b)candidates.push({kind:'bus',name:'Big Owl Bus',line:'On board! Enjoy the ride.',distance:Math.hypot(b.x-player.x,b.z-player.z),index:i})})
      return candidates.filter(c=>c.distance<(c.kind==='bus'?7:5)).sort((a,b)=>a.distance-b.distance)[0] ?? null
    }
    const interval=setInterval(()=>{const next=closest();setNearby(old=>old?.name===next?.name?old:next);if(!next && !player.busRide)setMessage('')},200)
    const key=(e:KeyboardEvent)=>{
      if(e.key.toLowerCase()!=='f'||e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||player.busRide||player.view)return
      if(community.students.some(s=>Math.hypot(s.x-player.x,s.z-player.z)<5))return
      const next=closest(); if(!next)return
      if(next.kind==='bus' && next.index!==undefined) {player.busRide={index:next.index,until:performance.now()+10000};player.rides++}
      setMessage(next.line)
      window.dispatchEvent(new CustomEvent('campus-action',{detail:{kind:next.kind,allowed:!player.travelOrigin}}))
    }
    window.addEventListener('keydown',key)
    return()=>{clearInterval(interval);window.removeEventListener('keydown',key)}
  },[mode])
  return (
    <>
      <div className="brandbar">
        <span className="ksu">KSU</span> Campus Life <span className="sub">Marietta</span>
      </div>
      <GoTo campus={campus} onView={viewLocation} />
      <button className="edit-character" onClick={onEdit}>✦ Edit character</button>
      <button className="mode-return" onClick={onModes}>← Choose mode</button>
      {viewing && <div className="view-banner">Viewing location only · your character stayed where you left them <button onClick={returnToPlayer}>Return to character</button></div>}
      {mapOpen && <CampusMap campus={campus} onClose={()=>setMapOpen(false)}/>}
      {mode === 'connect' && <div className="mode-hint">KSU Connect · limited online test</div>}
      {mode === 'life' && !viewing && nearby && <div className="conversation"><b>{nearby.name}</b><span>{message || (nearby.kind === 'bus' ? 'Press F to board for a short ride' : 'Press F to say hello')}</span>{message && <button onClick={() => setMessage('')}>Close</button>}</div>}
      {near && (
        <div className="nearcard" key={near.name}>
          <div className="kicker">You're at</div>
          <div className="nname">
            {near.code && <b>{near.code}</b>} {near.name}
          </div>
        </div>
      )}
      <Minimap campus={campus} onOpen={()=>setMapOpen(true)} />
      <div className="controls">
        <b>WASD</b> walk · <b>Shift</b> run · <b>drag</b> look · <b>middle drag / Shift+drag</b> pan · <b>WASD</b> recenter · <b>Q/E</b> turn · <b>wheel</b> zoom · <b>M</b> mute
      </div>
      <div className="osm">{campus.attribution} · Aerial imagery: USDA NAIP (public domain)</div>
    </>
  )
}
