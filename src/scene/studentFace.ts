import * as THREE from 'three'

// Shared face texture for lightweight background characters.
let face: THREE.CanvasTexture | null = null
export function studentFace() {
  if (face) return face
  const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=128
  const g=canvas.getContext('2d')!
  g.fillStyle='#24242a'
  for(const x of [40,88]) {g.beginPath();g.ellipse(x,48,7,10,0,0,Math.PI*2);g.fill()}
  g.strokeStyle='#24242a';g.lineWidth=6;g.lineCap='round'
  g.beginPath();g.arc(64,72,16,0.16,Math.PI-.16);g.stroke()
  face=new THREE.CanvasTexture(canvas);face.colorSpace=THREE.SRGBColorSpace
  return face
}
