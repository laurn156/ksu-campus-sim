import { useEffect, useMemo, useRef, useState } from 'react'
import { Collider, distToSeg, isCampusBuilding, type Campus } from '../campus'
import { approach, player } from '../scene/Player'
import { landmarkSpots } from '../scene/Landmarks'
import { scrappy } from '../scene/Scrappy'
import { busPositions } from '../scene/Buses'

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

export function Minimap({ campus }: { campus: Campus }) {
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
    <div className="minimap">
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
      <div className="mm-n">N</div>
    </div>
  )
}

/** "Go to" menu: jump straight to any campus building or landmark. */
function GoTo({ campus }: { campus: Campus }) {
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
        if (p) player.tp = p.go()
        e.target.blur() // keep WASD for walking
      }}
    >
      <option value="">📍 Go to…</option>
      {places.map((p, i) => (
        <option key={i} value={i}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

export function Hud({ campus, onEdit }: { campus: Campus; onEdit: () => void }) {
  const near = useNearby(campus)
  return (
    <>
      <div className="brandbar">
        <span className="ksu">KSU</span> Campus Life <span className="sub">Marietta</span>
      </div>
      <GoTo campus={campus} />
      <button className="edit-character" onClick={onEdit}>✦ Edit character</button>
      {near && (
        <div className="nearcard" key={near.name}>
          <div className="kicker">You're at</div>
          <div className="nname">
            {near.code && <b>{near.code}</b>} {near.name}
          </div>
        </div>
      )}
      <Minimap campus={campus} />
      <div className="controls">
        <b>WASD</b> walk · <b>Shift</b> run · <b>drag</b> look · <b>middle drag / Shift+drag</b> pan · <b>WASD</b> recenter · <b>Q/E</b> turn · <b>wheel</b> zoom · <b>M</b> mute
      </div>
      <div className="osm">{campus.attribution} · Aerial imagery: USDA NAIP (public domain)</div>
    </>
  )
}
