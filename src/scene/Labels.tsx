import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { centroid, isCampusBuilding, type Campus } from '../campus'
import { player } from './Player'

/** Floating name tags over campus buildings near the player (refreshed a few times a second). */
export function Labels({ campus }: { campus: Campus }) {
  const items = useMemo(
    () => campus.buildings.filter(isCampusBuilding).map((b) => ({ b, c: centroid(b.poly) })),
    [campus],
  )
  const [near, setNear] = useState<string[]>([])
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (t.current < 0.25) return
    t.current = 0
    const ids = items.filter(({ c }) => Math.hypot(c[0] - player.x, c[1] - player.z) < 90).map(({ b }) => b.id)
    if (ids.join() !== near.join()) setNear(ids)
  })
  return (
    <group>
      {items
        .filter(({ b }) => near.includes(b.id))
        .map(({ b, c }) => (
          <Html key={b.id} position={[c[0], b.h + 4, c[1]]} center distanceFactor={55} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className="tag">
              {b.code && <b>{b.code}</b>}
              <span>{b.short || b.name}</span>
            </div>
          </Html>
        ))}
    </group>
  )
}
