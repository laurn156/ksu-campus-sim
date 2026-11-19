import * as THREE from 'three'

// Four reusable face textures keep the large crowd expressive without one material per student.
const faces: THREE.CanvasTexture[] = []
export function studentFace(variant = 0) {
  variant = ((variant % 4) + 4) % 4
  if (faces[variant]) return faces[variant]
  const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=128
  const g=canvas.getContext('2d')!
  g.strokeStyle='#24242a';g.fillStyle='#24242a';g.lineWidth=6;g.lineCap='round'
  for(const [index,x] of [40,88].entries()) {
    if(variant===1 || (variant===2 && index===1)) {g.beginPath();g.arc(x,52,10,Math.PI,Math.PI*2);g.stroke()}
    else {g.beginPath();g.ellipse(x,48,7,10,0,0,Math.PI*2);g.fill()}
  }
  if(variant===3){g.beginPath();g.ellipse(64,78,6,8,0,0,Math.PI*2);g.fill()}
  else {g.beginPath();g.arc(64,72,variant===1?19:16,.16,Math.PI-.16);g.stroke()}
  const face=new THREE.CanvasTexture(canvas);face.colorSpace=THREE.SRGBColorSpace;faces[variant]=face
  return face
}
export function studentVariant(i:number) { return Math.abs((i*73+19) % 97) }
let jersey: THREE.CanvasTexture | null = null
export function studentJersey() {
  if (jersey) return jersey
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128
  const g=canvas.getContext('2d')!;g.textAlign='center';g.font='bold 78px Georgia';g.lineWidth=8;g.strokeStyle='#222';g.strokeText('KSU',128,88);g.fillStyle='#ffc629';g.fillText('KSU',128,88)
  jersey=new THREE.CanvasTexture(canvas);jersey.colorSpace=THREE.SRGBColorSpace
  return jersey
}
