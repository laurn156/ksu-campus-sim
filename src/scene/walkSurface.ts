import * as THREE from 'three'

/** Walkable surfaces sampled from the rendered scene: stairs, terraces, landings, plazas and other raised pieces.
 *  Low static meshes are indexed in a coarse grid; a downward ray against the nearby ones gives the surface height.
 *  Objects (or their ancestors) with userData.noWalk are ignored, e.g. characters. */
const CELL = 8
export class WalkSurface {
  private grid = new Map<string, THREE.Mesh[]>()
  private ray = new THREE.Raycaster()
  private down = new THREE.Vector3(0, -1, 0)
  private origin = new THREE.Vector3()
  private box = new THREE.Box3()
  private normal = new THREE.Vector3()
  private scene: THREE.Object3D
  constructor(scene: THREE.Object3D) { this.scene = scene }

  rebuild() {
    const grid = new Map<string, THREE.Mesh[]>()
    this.scene.updateMatrixWorld(true)
    const visit = (o: THREE.Object3D) => {
      if (o.userData?.noWalk || !o.visible) return
      const m = o as THREE.Mesh
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
        const b = this.box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld)
        const h = b.max.y - b.min.y, area = (b.max.x - b.min.x) * (b.max.z - b.min.z)
        // Keep low pieces you could stand on or bump into; skip tall walls/poles, high roofs and huge flat ground sheets.
        if (b.max.y > 0.06 && b.min.y < 2 && h < 2.6 && !(area > 600 && h < 0.4) && area < 4000) {
          for (let gx = Math.floor(b.min.x / CELL); gx <= Math.floor(b.max.x / CELL); gx++)
            for (let gz = Math.floor(b.min.z / CELL); gz <= Math.floor(b.max.z / CELL); gz++) {
              const k = gx + ',' + gz
              let list = grid.get(k); if (!list) grid.set(k, list = [])
              list.push(m)
            }
        }
      }
      for (const c of o.children) visit(c)
    }
    visit(this.scene)
    this.grid = grid
  }

  /** Highest surface at (x, z) at or below fromY, or null when there is only the ground. */
  heightAt(x: number, z: number, fromY: number): number | null {
    const list = this.grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL))
    if (!list) return null
    this.ray.set(this.origin.set(x, fromY, z), this.down)
    this.ray.far = fromY + 1
    const hit = this.ray.intersectObjects(list, false).find(h => h.face && h.face.normal.y !== 0 && this.normal.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.5)
    return hit ? hit.point.y : null
  }
}
