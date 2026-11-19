import { useEffect, useMemo, useRef, useState } from 'react'
import { distToSeg, isCampusBuilding, type Campus } from '../campus'
import { player } from '../scene/Player'

/** Closest campus building to the player (within ~30 m of its walls). */
function useNearby(campus: Campus) {
  const [near, setNear] = useState<{ name: string; code: string } | null>(null)
  useEffect(() => {
    const bs = campus.buildings.filter(isCampusBuilding)
    const id = setInterval(() => {
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

export function Hud({ campus }: { campus: Campus }) {
  const near = useNearby(campus)
  return (
    <>
      <div className="brandbar">
        <span className="ksu">KSU</span> Campus Life <span className="sub">Marietta</span>
      </div>
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
        <b>WASD</b> walk · <b>Shift</b> run · <b>click</b> to walk there · <b>Q/E</b> or right-drag to turn · <b>wheel</b> zoom · <b>M</b> mute
      </div>
      <div className="osm">{campus.attribution}</div>
    </>
  )
}
