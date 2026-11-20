import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Character, type Face } from '../characters/Character'
import type { AvatarLook } from '../scene/Player'
import { ScrappyFigure } from '../scene/Scrappy'
import { GlobePlaza, KsuLetters, SlapTheRock } from '../scene/Landmarks'
import { owlMuralTexture } from '../scene/Campus'
import { activityState } from './activityState'
import './photobooth.css'
import { savePhonePhoto } from '../life/phonePhotos'

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------
type ThemeId = 'bus' | 'rock' | 'globe' | 'sign' | 'mural' | 'green' | 'graduation' | 'beach' | 'space' | 'snow' | 'blossom' | 'city' | 'disco' | 'underwater' | 'clouds' | 'halloween' | 'winter'
type Theme = { id: ThemeId; name: string; icon: string; swatch: string; suggest: AccessoryId[] }
const KSU_THEMES: Theme[] = [
  { id: 'bus', name: 'Big Owl Bus', icon: '🚌', swatch: 'linear-gradient(#bfe0f2,#e9eef0 60%,#7d8687 60%)', suggest: ['pennant', 'gradcap'] },
  { id: 'rock', name: 'Slap the Rock', icon: '🪨', swatch: 'radial-gradient(ellipse at 50% 70%,#1d1f20 0 28%,transparent 29%),linear-gradient(#bfe0f2,#e9f0dc 62%,#7fae5a 62%)', suggest: ['pennant', 'sunglasses'] },
  { id: 'globe', name: 'The Globe', icon: '🌐', swatch: 'radial-gradient(circle at 50% 45%,#c9ced3 0 22%,transparent 23%),linear-gradient(#bfe0f2,#e9eef0 62%,#b9b6ad 62%)', suggest: ['pennant', 'medal'] },
  { id: 'sign', name: 'KSU Sign', icon: '🔤', swatch: 'linear-gradient(#bfe0f2,#e9f0dc 45%,#f2c52e 45% 70%,#7fae5a 70%)', suggest: ['pennant', 'gradcap'] },
  { id: 'mural', name: 'Owl Mural', icon: '🦉', swatch: 'radial-gradient(circle at 50% 45%,#1b1d1c 0 20%,#f8c500 21% 26%,transparent 27%),linear-gradient(#a65a43,#8f4c39)', suggest: ['sunglasses', 'microphone'] },
  { id: 'green', name: 'Campus Green', icon: '🌳', swatch: 'linear-gradient(#bfe0f2,#dff0d0 58%,#79ad55 58%)', suggest: ['icecream', 'flowers'] },
  { id: 'graduation', name: 'KSU Graduation', icon: '🎓', swatch: 'linear-gradient(#1f2324,#1f2324 55%,#f2c52e 55%)', suggest: ['gradcap', 'diploma', 'medal'] },
]
const FUN_THEMES: Theme[] = [
  { id: 'beach', name: 'Tropical Beach', icon: '🏖️', swatch: 'linear-gradient(#7cc8ea,#bfe7f5 50%,#3fa7c9 50% 65%,#f1d9a0 65%)', suggest: ['beachball', 'lei', 'sunglasses'] },
  { id: 'space', name: 'Outer Space', icon: '🚀', swatch: 'radial-gradient(circle at 70% 30%,#8a6bd1 0 12%,transparent 13%),linear-gradient(#0b1030,#241a4f)', suggest: ['helmet'] },
  { id: 'snow', name: 'Snowy Mountains', icon: '🏔️', swatch: 'linear-gradient(#a9d3ef,#e8f4fb 55%,#fff 55%)', suggest: ['scarf', 'beanie', 'snowball'] },
  { id: 'blossom', name: 'Cherry Blossom Garden', icon: '🌸', swatch: 'linear-gradient(#fbe1ea,#f7c6d6 55%,#9cc489 55%)', suggest: ['flowers', 'icecream'] },
  { id: 'city', name: 'City at Night', icon: '🌃', swatch: 'linear-gradient(#141a3a,#2b2f6b 60%,#22243a 60%)', suggest: ['sunglasses', 'microphone'] },
  { id: 'disco', name: 'Disco Party', icon: '🪩', swatch: 'radial-gradient(circle at 50% 25%,#e7e7ef 0 10%,transparent 11%),linear-gradient(#3b1458,#7a2a8a)', suggest: ['microphone', 'heartglasses', 'partyhat'] },
  { id: 'underwater', name: 'Underwater', icon: '🐠', swatch: 'linear-gradient(#1f8fbf,#0d4f7a 70%,#d9c38f 70%)', suggest: ['snorkel', 'beachball'] },
  { id: 'clouds', name: 'Dreamy Clouds', icon: '☁️', swatch: 'linear-gradient(#ffd6e7,#d7e3ff 55%,#fff 75%)', suggest: ['balloon', 'crown'] },
  { id: 'halloween', name: 'Halloween', icon: '🎃', swatch: 'linear-gradient(#2a1440,#e0782f 120%)', suggest: ['witch', 'pumpkin'] },
  { id: 'winter', name: 'Winter Wonderland', icon: '⛄', swatch: 'linear-gradient(#cfe6f7,#eef7fd 55%,#fff 55%)', suggest: ['santa', 'scarf', 'snowball'] },
]
const ALL_THEMES = [...KSU_THEMES, ...FUN_THEMES]

type Slot = 'head' | 'face' | 'neck' | 'hand'
type AccessoryId = 'helmet' | 'partyhat' | 'gradcap' | 'witch' | 'flowers' | 'santa' | 'crown' | 'beanie' | 'sunglasses' | 'heartglasses' | 'goggles' | 'snorkel' | 'scarf' | 'lei' | 'bowtie' | 'medal' | 'beachball' | 'balloon' | 'pennant' | 'icecream' | 'diploma' | 'pumpkin' | 'microphone' | 'snowball'
const ACCESSORIES: { id: AccessoryId; slot: Slot; name: string; icon: string }[] = [
  { id: 'helmet', slot: 'head', name: 'Astronaut helmet', icon: '🧑‍🚀' }, { id: 'partyhat', slot: 'head', name: 'Party hat', icon: '🥳' },
  { id: 'gradcap', slot: 'head', name: 'Grad cap', icon: '🎓' }, { id: 'witch', slot: 'head', name: 'Witch hat', icon: '🧙' },
  { id: 'flowers', slot: 'head', name: 'Flower crown', icon: '🌸' }, { id: 'santa', slot: 'head', name: 'Santa hat', icon: '🎅' },
  { id: 'crown', slot: 'head', name: 'Crown', icon: '👑' }, { id: 'beanie', slot: 'head', name: 'Pom beanie', icon: '🧶' },
  { id: 'sunglasses', slot: 'face', name: 'Sunglasses', icon: '🕶️' }, { id: 'heartglasses', slot: 'face', name: 'Heart glasses', icon: '💖' },
  { id: 'goggles', slot: 'face', name: 'Lab goggles', icon: '🥽' }, { id: 'snorkel', slot: 'face', name: 'Snorkel mask', icon: '🤿' },
  { id: 'scarf', slot: 'neck', name: 'Winter scarf', icon: '🧣' }, { id: 'lei', slot: 'neck', name: 'Flower lei', icon: '🌺' },
  { id: 'bowtie', slot: 'neck', name: 'Bow tie', icon: '🎀' }, { id: 'medal', slot: 'neck', name: 'Gold medal', icon: '🥇' },
  { id: 'beachball', slot: 'hand', name: 'Beach ball', icon: '🏐' }, { id: 'balloon', slot: 'hand', name: 'Balloon', icon: '🎈' },
  { id: 'pennant', slot: 'hand', name: 'KSU pennant', icon: '🚩' }, { id: 'icecream', slot: 'hand', name: 'Ice cream', icon: '🍦' },
  { id: 'diploma', slot: 'hand', name: 'Diploma', icon: '📜' }, { id: 'pumpkin', slot: 'hand', name: 'Candy pumpkin', icon: '🎃' },
  { id: 'microphone', slot: 'hand', name: 'Microphone', icon: '🎤' }, { id: 'snowball', slot: 'hand', name: 'Snowball', icon: '❄️' },
]
const SLOT_NAMES: Record<Slot, string> = { head: 'Head', face: 'Face', neck: 'Neck', hand: 'Hold' }
type Pose = 'relaxed' | 'wave' | 'peace' | 'cheer' | 'point' | 'think' | 'jump'
const POSES: { id: Pose; name: string; icon: string }[] = [
  { id: 'relaxed', name: 'Relaxed', icon: '🙂' }, { id: 'wave', name: 'Wave', icon: '👋' }, { id: 'peace', name: 'Selfie', icon: '✌️' },
  { id: 'cheer', name: 'Cheer', icon: '🙌' }, { id: 'point', name: 'Point', icon: '👉' }, { id: 'think', name: 'Think', icon: '🤔' }, { id: 'jump', name: 'Jump', icon: '🤸' },
]
const FACES: { id: Face; name: string }[] = [{ id: 'happy', name: '😊 Happy' }, { id: 'dots', name: '🙂 Smile' }, { id: 'wink', name: '😉 Wink' }, { id: 'surprised', name: '😮 Wow' }, { id: 'angry', name: '😤 Fierce' }]
export type BoothFriend = { name: string; look: AvatarLook }
type Worn = Partial<Record<Slot, AccessoryId>>

// ---------------------------------------------------------------------------------------------
// Small 3D helpers
// ---------------------------------------------------------------------------------------------
type V = [number, number, number]
const Box = ({ p, s, c, r }: { p: V; s: V; c: string; r?: V }) => <mesh position={p} rotation={r}><boxGeometry args={s} /><meshStandardMaterial color={c} /></mesh>
const Ball = ({ p, r, c, e }: { p: V; r: number; c: string; e?: string }) => <mesh position={p}><sphereGeometry args={[r, 18, 14]} /><meshStandardMaterial color={c} emissive={e ?? '#000'} /></mesh>
function gradient(stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function label(text: string, bg: string, fg: string, w = 1024, h = 192) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!; g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(h * .5)}px system-ui, sans-serif`; g.fillText(text, w / 2, h / 2 + 4, w - 40)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function Sky({ stops }: { stops: [number, string][] }) {
  const tex = useMemo(() => gradient(stops), [stops])
  return <mesh position={[0, 6, -9]}><planeGeometry args={[90, 30]} /><meshBasicMaterial map={tex} /></mesh>
}
function Ground({ c, y = 0 }: { c: string; y?: number }) { return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 6]}><planeGeometry args={[90, 40]} /><meshStandardMaterial color={c} /></mesh> }
function Sign({ text, p, w, h, bg, fg }: { text: string; p: V; w: number; h: number; bg: string; fg: string }) {
  const tex = useMemo(() => label(text, bg, fg), [text, bg, fg])
  return <mesh position={p}><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} /></mesh>
}
function Tree({ p, c = '#5d8f43', s = 1 }: { p: V; c?: string; s?: number }) {
  return <group position={p} scale={s}><mesh position={[0, .7, 0]}><cylinderGeometry args={[.12, .16, 1.4, 8]} /><meshStandardMaterial color="#6b4f3a" /></mesh><mesh position={[0, 1.9, 0]}><icosahedronGeometry args={[.9, 1]} /><meshStandardMaterial color={c} flatShading /></mesh></group>
}
function Pine({ p, s = 1, snow }: { p: V; s?: number; snow?: boolean }) {
  return <group position={p} scale={s}><mesh position={[0, .3, 0]}><cylinderGeometry args={[.1, .12, .6, 8]} /><meshStandardMaterial color="#6b4f3a" /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, .9 + i * .5, 0]}><coneGeometry args={[.8 - i * .2, .9, 10]} /><meshStandardMaterial color={snow && i === 2 ? '#f4f8fb' : '#3f7a55'} /></mesh>)}</group>
}
function Spin({ children, speed = .5, axis = 'y' }: { children: ReactNode; speed?: number; axis?: 'x' | 'y' | 'z' }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation[axis] += dt * speed })
  return <group ref={g}>{children}</group>
}
function Bob({ children, amp = .15, speed = 1, phase = 0 }: { children: ReactNode; amp?: number; speed?: number; phase?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (g.current) g.current.position.y = Math.sin(clock.elapsedTime * speed + phase) * amp })
  return <group ref={g}>{children}</group>
}
const rand = (seed: number) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// ---------------------------------------------------------------------------------------------
// Backdrops (characters stand at the origin facing +z; the camera looks toward -z)
// ---------------------------------------------------------------------------------------------
function Backdrop({ id }: { id: ThemeId }) {
  switch (id) {
    case 'bus': return <><Sky stops={[[0, '#9fd2ee'], [1, '#eef4f2']]} /><Ground c="#8a9091" />
      <Box p={[0, .01, -1.6]} s={[30, .02, .25]} c="#f2c52e" />
      <group position={[0, 0, -4.2]}><Box p={[0, 1.75, 0]} s={[9, 2.9, 2.4]} c="#1c1e1f" /><Box p={[0, 1.1, 1.21]} s={[9, .5, .02]} c="#f2c52e" />
        {[-3.2, -1.6, 0, 1.6, 3.2].map(x => <Box key={x} p={[x, 2.15, 1.21]} s={[1.3, .8, .02]} c="#9cc3c8" />)}
        <Box p={[0, 3.05, 1.21]} s={[9, .5, .02]} c="#f2c52e" /><Sign text="BIG OWL BUS" p={[0, 3.05, 1.23]} w={4.4} h={.46} bg="#f2c52e" fg="#1c1e1f" />
        {[-3, 3].map(x => <mesh key={x} position={[x, .5, 1.1]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.5, .5, .3, 20]} /><meshStandardMaterial color="#111" /></mesh>)}</group>
      <group position={[5.2, 0, -2]}><Box p={[0, 1.2, 0]} s={[.08, 2.4, .08]} c="#4a5052" /><Sign text="BUS STOP" p={[0, 2.4, 0]} w={1} h={.4} bg="#2f6fb0" fg="#fff" /></group></>
    case 'rock': return <><Sky stops={[[0, '#8fcbee'], [1, '#f2f6e6']]} /><Ground c="#79ad55" /><Tree p={[-5, 0, -6]} /><Tree p={[5.5, 0, -6.5]} s={1.2} /><Tree p={[-7.5, 0, -7]} s={.9} />
      <group scale={.8}><SlapTheRock at={[1.7, -4.7]} /></group><Sign text="SLAP THE ROCK" p={[-2.1, 1.3, -3]} w={2} h={.45} bg="#1c1e1f" fg="#f2c52e" /><Box p={[-2.1, .55, -3.05]} s={[.08, 1.1, .08]} c="#2f3332" /></>
    case 'globe': return <><Sky stops={[[0, '#9fd2ee'], [1, '#eef4f2']]} /><Ground c="#c9c6bd" /><GlobePlaza at={[0, -9]} />
      <group position={[0, 0, -15]}><Box p={[0, 2, 0]} s={[22, 4, .3]} c="#a3533c" /><Box p={[0, 4.4, 0]} s={[22, .8, .32]} c="#dedfd8" />{[-8, -5, -2, 2, 5, 8].map(x => <Box key={x} p={[x, 2, .17]} s={[1.6, 2, .04]} c="#4f8f84" />)}</group>
      {[-3, -2.3, -1.6].map((x, i) => <group key={x} position={[x - 2, 0, -6]}><Box p={[0, 2.6, 0]} s={[.06, 5.2, .06]} c="#c9ced0" /><Box p={[.45, 4.8, 0]} s={[.8, .5, .02]} c={['#1c1e1f', '#c4473c', '#2f5d8a'][i]} /></group>)}
      <Tree p={[5, 0, -6]} s={1.2} /><Tree p={[-6.5, 0, -7]} /></>
    case 'sign': return <><Sky stops={[[0, '#8fcbee'], [1, '#f2f6e6']]} /><Ground c="#7fb35a" /><group position={[0, 1.1, 0]} scale={1.7}><KsuLetters at={[0, -3.2]} yaw={0} /></group><Box p={[0, .55, -5.4]} s={[6, 1.1, .6]} c="#3a4447" />
      <Tree p={[-5.5, 0, -6.5]} s={1.2} /><Tree p={[5.8, 0, -6]} /><Tree p={[0, 0, -9]} s={1.3} />
      {[-3.6, 3.6].map(x => <group key={x} position={[x, 0, -3]}>{[0, 1, 2].map(k => <Ball key={k} p={[(k - 1) * .3, .2, 0]} r={.18} c={k % 2 ? '#f2c52e' : '#5d8f43'} />)}</group>)}</>
    case 'mural': return <MuralBackdrop />
    case 'green': return <><Sky stops={[[0, '#8fcbee'], [1, '#f4f8ea']]} /><Ground c="#7fb35a" /><Box p={[0, .01, -2.5]} s={[2, .02, 14]} c="#d8d4c6" />
      {[[-4, -5, 1.2], [4.5, -5.5, 1.1], [-6.5, -7, 1], [6.5, -7.5, 1.3], [-2.5, -8, .9], [2.5, -8.5, 1]].map(([x, z, s], i) => <Tree key={i} p={[x, 0, z]} s={s} c={i % 2 ? '#5d8f43' : '#6a9a4b'} />)}
      <group position={[-3, 0, -2.5]}><Box p={[0, .45, 0]} s={[1.6, .08, .5]} c="#8a6a4c" /><Box p={[0, .8, -.22]} s={[1.6, .5, .06]} c="#8a6a4c" /></group>
      <group position={[3.4, 0, -3]}><Box p={[0, 1.5, 0]} s={[.08, 3, .08]} c="#2f3332" /><Ball p={[0, 3.05, 0]} r={.16} c="#fff6d8" e="#7a6a40" /></group></>
    case 'graduation': return <><color attach="background" args={['#1b1d20']} /><Ground c="#2a2d31" />
      <group position={[0, 0, -4]}><Box p={[0, .3, 0]} s={[12, .6, 3]} c="#3b3f45" /><Box p={[0, 3, -1.4]} s={[12, 5, .2]} c="#141617" />
        <Sign text="CONGRATULATIONS GRADUATES" p={[0, 3.9, -1.28]} w={6} h={.62} bg="#141617" fg="#f2c52e" />
        <Sign text="KENNESAW STATE UNIVERSITY" p={[0, 3.25, -1.28]} w={4.2} h={.4} bg="#141617" fg="#f4f1e6" />
        {[-5.5, 5.5].map(x => <group key={x}><Box p={[x, 2.5, -1.2]} s={[.8, 4, .05]} c="#f2c52e" /><Box p={[x, 2.5, -1.18]} s={[.3, 4, .05]} c="#1c1e1f" /></group>)}</group>
      <Confetti />{[[-2.5, 3.4], [2.8, 3.8], [.6, 4.2]].map(([x, y], i) => <Bob key={i} amp={.25} speed={1.2} phase={i}><group position={[x, y, -2.5]} rotation={[.3, i, .2]}><Box p={[0, 0, 0]} s={[.55, .04, .55]} c="#141617" /><Box p={[0, -.08, 0]} s={[.3, .12, .3]} c="#141617" /></group></Bob>)}</>
    case 'beach': return <><Sky stops={[[0, '#5cb6e4'], [.7, '#bfe7f5'], [1, '#fdf1d6']]} /><Ground c="#efd59a" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .02, -8]}><planeGeometry args={[40, 7]} /><meshStandardMaterial color="#3aa6c8" /></mesh>
      <Ball p={[4.5, 5, -8.8]} r={1} c="#ffd34d" e="#a07a10" />
      {[[-4.5, -3.5, .2], [5, -4.5, -.25]].map(([x, z, lean], i) => <group key={i} position={[x, 0, z]} rotation={[0, 0, lean]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[.12, .18, 2.8, 8]} /><meshStandardMaterial color="#9a7652" /></mesh>
        {[0, 1, 2, 3, 4].map(k => <mesh key={k} position={[Math.sin(k * 1.26) * .7, 2.8, Math.cos(k * 1.26) * .7]} rotation={[Math.cos(k * 1.26) * .6, 0, -Math.sin(k * 1.26) * .6]} scale={[.35, .06, 1]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#3f9a55" /></mesh>)}</group>)}
      <group position={[-2.6, 0, -2]}><mesh position={[0, 1, 0]}><cylinderGeometry args={[.03, .03, 2, 6]} /><meshStandardMaterial color="#eee" /></mesh><mesh position={[0, 2, 0]}><coneGeometry args={[1.1, .45, 10, 1, true]} /><meshStandardMaterial color="#e8604c" side={THREE.DoubleSide} /></mesh></group></>
    case 'space': return <><color attach="background" args={['#070b24']} /><Stars /><Ground c="#8a8f9a" />
      {[[-3, -3, .6], [2.5, -4, .9], [-1, -6, 1.2]].map(([x, z, r], i) => <mesh key={i} position={[x, .02, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r * .7, r, 24]} /><meshStandardMaterial color="#6d7280" /></mesh>)}
      <Spin speed={.15}><group position={[3.5, 4.2, -8]}><Ball p={[0, 0, 0]} r={1.3} c="#8a6bd1" /><mesh rotation={[1.2, .2, 0]}><ringGeometry args={[1.7, 2.3, 40]} /><meshStandardMaterial color="#e2b65a" side={THREE.DoubleSide} /></mesh></group></Spin>
      <Ball p={[-5, 5.2, -8.5]} r={.6} c="#4f86b0" /><group position={[-4, 0, -4]}><mesh position={[0, .9, 0]}><coneGeometry args={[.35, .8, 12]} /><meshStandardMaterial color="#f4f1e6" /></mesh><mesh position={[0, .35, 0]}><cylinderGeometry args={[.35, .4, .7, 12]} /><meshStandardMaterial color="#e8604c" /></mesh></group></>
    case 'snow': return <><Sky stops={[[0, '#93c7ea'], [1, '#eef6fb']]} /><Ground c="#f5f8fb" />
      {[[-5, -9, 4.5], [0, -10, 6], [5.5, -9, 5]].map(([x, z, h], i) => <group key={i} position={[x, 0, z]}><mesh position={[0, h / 2, 0]}><coneGeometry args={[h * .75, h, 6]} /><meshStandardMaterial color="#8a9db0" flatShading /></mesh><mesh position={[0, h * .82, 0]}><coneGeometry args={[h * .75 * .36, h * .36, 6]} /><meshStandardMaterial color="#fafcff" flatShading /></mesh></group>)}
      <Pine p={[-4, 0, -4]} snow /><Pine p={[4.4, 0, -4.5]} s={1.2} snow /><Pine p={[-6, 0, -6]} s={1.3} snow /><Snowfall /></>
    case 'blossom': return <><Sky stops={[[0, '#fbd9e5'], [1, '#fff3f6']]} /><Ground c="#9cc489" />
      {[[-4.2, -3.6, 1.2], [4.3, -4, 1.3], [-1.5, -7, 1.1], [2, -7.5, 1]].map(([x, z, s], i) => <Tree key={i} p={[x, 0, z]} s={s} c={i % 2 ? '#f4a9c0' : '#f7c3d4'} />)}
      <group position={[0, 0, -5.2]}><mesh position={[0, .9, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[1.6, .12, 8, 24, Math.PI]} /><meshStandardMaterial color="#c4473c" /></mesh>
        <Box p={[0, 1.62, 0]} s={[4, .14, 1.3]} c="#c4473c" /></group>
      <group position={[-2.8, 0, -1.8]}><Box p={[0, .5, 0]} s={[.2, 1, .2]} c="#9aa29e" /><Box p={[0, 1.15, 0]} s={[.5, .3, .5]} c="#f6e4b0" /><Box p={[0, 1.4, 0]} s={[.6, .1, .6]} c="#9aa29e" /></group><Petals /></>
    case 'city': return <><color attach="background" args={['#121735']} /><Stars dim /><Ground c="#24263a" /><Ball p={[-4.5, 5.2, -9]} r={.7} c="#fff6d8" e="#b9a978" /><CitySkyline /></>
    case 'disco': return <><color attach="background" args={['#2a0f40']} /><Ground c="#160a22" y={-.01} /><DiscoFloor />
      <Spin speed={.6}><mesh position={[0, 4.4, -2]}><icosahedronGeometry args={[.7, 1]} /><meshStandardMaterial color="#e7e7ef" metalness={.8} roughness={.15} flatShading emissive="#3a3a4a" /></mesh></Spin>
      {['#ff5fb0', '#4fd1ff', '#ffd34d'].map((c, i) => <Spin key={c} speed={.4 + i * .2}><mesh position={[(i - 1) * 3.5, 3.5, -4]} rotation={[0, 0, (i - 1) * .4]}><coneGeometry args={[1, 4, 16, 1, true]} /><meshBasicMaterial color={c} transparent opacity={.18} side={THREE.DoubleSide} depthWrite={false} /></mesh></Spin>)}
      <Sign text="DISCO NIGHT" p={[0, 2.8, -6]} w={5} h={.9} bg="#2a0f40" fg="#ff5fb0" /></>
    case 'underwater': return <><Sky stops={[[0, '#2ba7d6'], [1, '#0b3f66']]} /><fog attach="fog" args={['#15608f', 6, 16]} /><Ground c="#d9c38f" />
      {[-4.5, -3.8, 3.6, 4.4, -1.8, 2].map((x, i) => <Bob key={i} amp={.08} speed={1.4} phase={i}><mesh position={[x, .9, -3.5 - (i % 3)]} rotation={[0, 0, Math.sin(i) * .15]}><capsuleGeometry args={[.1, 1.6, 4, 8]} /><meshStandardMaterial color={i % 2 ? '#3f9a55' : '#5db36b'} /></mesh></Bob>)}
      {[[-2.5, 2.4, '#ff8c42'], [2.8, 3, '#ffd34d'], [-.5, 3.6, '#4fd1ff']].map(([x, y, c], i) => <Bob key={i} amp={.2} speed={.8} phase={i * 2}><group position={[x as number, y as number, -3]}><mesh scale={[1, .7, .5]}><sphereGeometry args={[.32, 14, 10]} /><meshStandardMaterial color={c as string} /></mesh><mesh position={[-.38, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[.18, .3, 4]} /><meshStandardMaterial color={c as string} /></mesh></group></Bob>)}
      <Bubbles /><group position={[3.8, 0, -2.4]}><mesh position={[0, .25, 0]} scale={[1, .6, 1]}><sphereGeometry args={[.45, 14, 10]} /><meshStandardMaterial color="#e86f8a" /></mesh></group></>
    case 'clouds': return <><Sky stops={[[0, '#ffd1e3'], [.6, '#dfe6ff'], [1, '#ffffff']]} /><Ground c="#f4f2fb" y={-.03} />
      {[[-4, .2, -3], [4, .3, -3.5], [0, .1, -6], [-6, 2.5, -7], [5.5, 3, -7], [0, 4.5, -8]].map(([x, y, z], i) => <Bob key={i} amp={.12} speed={.6} phase={i}><group position={[x, y, z]}>{[[-.9, 0, .7], [0, .25, 1], [.9, 0, .75], [.4, -.15, .6]].map(([dx, dy, r], k) => <Ball key={k} p={[dx, dy, 0]} r={r} c="#ffffff" />)}</group></Bob>)}
      <mesh position={[0, 0, -7]}><torusGeometry args={[4.5, .5, 8, 40, Math.PI]} /><meshStandardMaterial color="#ffb3c7" /></mesh><mesh position={[0, 0, -6.9]}><torusGeometry args={[3.7, .4, 8, 40, Math.PI]} /><meshStandardMaterial color="#c8b3ff" /></mesh>
      <mesh position={[0, 0, -6.8]}><torusGeometry args={[3, .35, 8, 40, Math.PI]} /><meshStandardMaterial color="#b3e5ff" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, -2]}><circleGeometry args={[3.5, 32]} /><meshStandardMaterial color="#ffffff" /></mesh></>
    case 'halloween': return <><Sky stops={[[0, '#1d0f33'], [.75, '#5a2a63'], [1, '#e0782f']]} /><Ground c="#2c2238" /><Ball p={[3.8, 5, -9]} r={1.1} c="#ffe9a6" e="#a8873a" />
      {[[-3.2, -1.8, .5], [3, -2, .42], [-1.6, -3, .35], [2, -3.4, .3]].map(([x, z, r], i) => <group key={i} position={[x, r, z]}><mesh scale={[1.15, .9, 1.15]}><sphereGeometry args={[r, 16, 12]} /><meshStandardMaterial color="#e2782d" /></mesh><mesh position={[0, r * .95, 0]}><cylinderGeometry args={[.04, .05, .18, 6]} /><meshStandardMaterial color="#3f5f2e" /></mesh>
        {i < 2 && <>{[-1, 1].map(s => <mesh key={s} position={[s * r * .35, r * .15, r * .95]} rotation={[0, 0, Math.PI]}><coneGeometry args={[r * .14, r * .22, 3]} /><meshBasicMaterial color="#ffd34d" /></mesh>)}</>}</group>)}
      {[-5, 5].map(x => <group key={x} position={[x, 0, -5]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[.12, .2, 2.8, 6]} /><meshStandardMaterial color="#1a1420" /></mesh>{[-1, 1].map(s => <mesh key={s} position={[s * .45, 2.4, 0]} rotation={[0, 0, -s * .8]}><cylinderGeometry args={[.05, .08, 1.2, 5]} /><meshStandardMaterial color="#1a1420" /></mesh>)}</group>)}
      {[[-2, 4], [1, 4.6], [2.5, 3.8]].map(([x, y], i) => <Bob key={i} amp={.2} speed={2} phase={i}><group position={[x, y, -4]}><Box p={[0, 0, 0]} s={[.6, .08, .05]} c="#111" /><Ball p={[0, 0, 0]} r={.1} c="#111" /></group></Bob>)}</>
    case 'winter': return <><Sky stops={[[0, '#bcdcf3'], [1, '#f4f9fd']]} /><Ground c="#f7fafc" /><Pine p={[-4.5, 0, -4]} s={1.3} snow /><Pine p={[4.6, 0, -4.4]} s={1.1} snow /><Pine p={[-1.5, 0, -7]} s={1.4} snow />
      <group position={[3, 0, -2.2]}><Ball p={[0, .45, 0]} r={.45} c="#fff" /><Ball p={[0, 1.1, 0]} r={.33} c="#fff" /><Ball p={[0, 1.6, 0]} r={.24} c="#fff" /><mesh position={[0, 1.6, .25]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.05, .2, 8]} /><meshStandardMaterial color="#e8822d" /></mesh>
        <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.22, .05, 8, 20]} /><meshStandardMaterial color="#c4473c" /></mesh></group>
      {[[-2.8, '#c4473c'], [-2.2, '#3f7a55'], [-2.5, '#2f6fb0']].map(([x, c], i) => <group key={i} position={[x as number, .25 + (i === 2 ? .45 : 0), -2 - (i === 2 ? 0 : 0)]}><Box p={[0, 0, 0]} s={[.5, .5, .5]} c={c as string} /><Box p={[0, 0, 0]} s={[.52, .52, .1]} c="#f2c52e" /></group>)}<Snowfall /></>
  }
}
function MuralBackdrop() {
  const tex = useMemo(() => owlMuralTexture(), [])
  return <><Sky stops={[[0, '#9fd2ee'], [1, '#eef4f2']]} /><Ground c="#c9c6bd" />
    <group position={[0, 0, -3.4]}><Box p={[0, 2.5, -.2]} s={[11, 5, .3]} c="#9c513b" /><Box p={[0, 5.05, -.2]} s={[11.2, .2, .4]} c="#dedfd8" />
      <mesh position={[0, 3.1, -.03]}><planeGeometry args={[7.7, 3.15]} /><meshStandardMaterial map={tex} transparent /></mesh></group>
    <Tree p={[-6.5, 0, -5]} /><Tree p={[6.8, 0, -5.5]} s={1.1} /></>
}
function Confetti() {
  const pieces = useMemo(() => { const r = rand(7); return Array.from({ length: 70 }, () => ({ p: [(r() - .5) * 12, r() * 6, -1.5 - r() * 3] as V, c: ['#f2c52e', '#fff', '#3f74b5', '#c4473c'][Math.floor(r() * 4)], s: r() })) }, [])
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => g.current?.children.forEach((m, i) => { m.position.y -= dt * (.4 + pieces[i].s * .5); m.rotation.x += dt * 2; if (m.position.y < 0) m.position.y = 6 }))
  return <group ref={g}>{pieces.map((q, i) => <mesh key={i} position={q.p}><planeGeometry args={[.08, .14]} /><meshBasicMaterial color={q.c} side={THREE.DoubleSide} /></mesh>)}</group>
}
function Stars({ dim }: { dim?: boolean }) {
  const geo = useMemo(() => { const r = rand(3), pts: number[] = []; for (let i = 0; i < 400; i++) pts.push((r() - .5) * 40, r() * 14 + (dim ? 3 : 0), -8.5 - r()); return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)) }, [dim])
  return <points geometry={geo}><pointsMaterial color="#ffffff" size={dim ? .05 : .08} /></points>
}
function Snowfall() {
  const geo = useMemo(() => { const r = rand(11), pts: number[] = []; for (let i = 0; i < 260; i++) pts.push((r() - .5) * 16, r() * 7, (r() - .5) * 6 - 1); return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)) }, [])
  useFrame((_, dt) => { const a = geo.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * .6; if (y < 0) y = 7; a.setY(i, y) } a.needsUpdate = true })
  return <points geometry={geo}><pointsMaterial color="#ffffff" size={.07} /></points>
}
function Petals() {
  const geo = useMemo(() => { const r = rand(5), pts: number[] = []; for (let i = 0; i < 160; i++) pts.push((r() - .5) * 14, r() * 6, (r() - .5) * 5 - 1.5); return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)) }, [])
  useFrame(({ clock }, dt) => { const a = geo.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * .35; if (y < 0) y = 6; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(clock.elapsedTime + i) * dt * .2) } a.needsUpdate = true })
  return <points geometry={geo}><pointsMaterial color="#f48fb1" size={.1} /></points>
}
function Bubbles() {
  const balls = useMemo(() => { const r = rand(9); return Array.from({ length: 24 }, () => ({ x: (r() - .5) * 10, y: r() * 6, z: -1 - r() * 4, s: .04 + r() * .08 })) }, [])
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => g.current?.children.forEach((m, i) => { m.position.y += dt * (.5 + balls[i].s * 4); if (m.position.y > 6) m.position.y = 0 }))
  return <group ref={g}>{balls.map((b, i) => <mesh key={i} position={[b.x, b.y, b.z]}><sphereGeometry args={[b.s, 10, 8]} /><meshStandardMaterial color="#d8f3ff" transparent opacity={.6} /></mesh>)}</group>
}
function CitySkyline() {
  const windows = useMemo(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#1e2240'; g.fillRect(0, 0, 64, 128); const r = rand(13); for (let y = 6; y < 128; y += 12) for (let x = 6; x < 64; x += 14) { g.fillStyle = r() > .45 ? '#ffd98a' : '#2c3158'; g.fillRect(x, y, 8, 6) } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }, [])
  const blocks = useMemo(() => { const r = rand(17); return Array.from({ length: 14 }, (_, i) => ({ x: -9 + i * 1.4 + r() * .4, h: 2.5 + r() * 5, w: 1 + r() * .6, z: -6 - r() * 2 })) }, [])
  return <>{blocks.map((b, i) => <mesh key={i} position={[b.x, b.h / 2, b.z]}><boxGeometry args={[b.w, b.h, 1]} /><meshStandardMaterial map={windows} emissive="#ffffff" emissiveMap={windows} emissiveIntensity={.55} /></mesh>)}
    {[-3.5, 3.5].map(x => <group key={x} position={[x, 0, -2]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[.05, .06, 2.8, 8]} /><meshStandardMaterial color="#2f3332" /></mesh><Ball p={[0, 2.85, 0]} r={.17} c="#fff2c4" e="#c9a656" /></group>)}</>
}
function DiscoFloor() {
  const g = useRef<THREE.Group>(null), colors = ['#ff5fb0', '#4fd1ff', '#ffd34d', '#9b6bff', '#5dff9e']
  useFrame(({ clock }) => g.current?.children.forEach((m, i) => { const k = Math.floor(clock.elapsedTime * 2 + i * .37) % colors.length; ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.set(colors[k]) }))
  return <group ref={g}>{Array.from({ length: 64 }, (_, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(i % 8 - 3.5) * 1.6, 0, -Math.floor(i / 8) * 1.6 + 2]}><planeGeometry args={[1.55, 1.55]} /><meshStandardMaterial color="#111" emissive="#ff5fb0" emissiveIntensity={.7} /></mesh>)}</group>
}

// ---------------------------------------------------------------------------------------------
// Accessories, in the character's local space (head centre at y 1.1, radius 0.37; facing +z)
// ---------------------------------------------------------------------------------------------
const HEAD_ITEMS = new Set<AccessoryId>(['helmet', 'partyhat', 'gradcap', 'witch', 'santa', 'crown', 'beanie', 'flowers'])
function holdPoint(pose: Pose, t: number): V {
  switch (pose) {
    case 'wave': return [-.55 + Math.sin(t * 6) * .12, 1.72, .25]
    case 'peace': return [-.32, 1.45, .62]
    case 'cheer': return [-.35, 1.85, .05]
    case 'point': return [-.3, 1.25, .6]
    case 'think': return [-.12, 1.0, .38]
    default: return [-.36, .62, .3]
  }
}
function HandItem({ id, at }: { id: AccessoryId; at: V }) {
  switch (id) {
    case 'beachball': return <group position={[at[0], at[1] + .2, at[2] + .05]}>{['#e8604c', '#ffffff', '#2f6fb0', '#ffd34d', '#ffffff', '#3f9a55'].map((c, i) => <mesh key={i}><sphereGeometry args={[.22, 16, 12, i * Math.PI / 3, Math.PI / 3]} /><meshStandardMaterial color={c} /></mesh>)}</group>
    case 'balloon': return <group position={at}><mesh position={[0, .55, 0]}><cylinderGeometry args={[.006, .006, 1.1, 4]} /><meshBasicMaterial color="#555" /></mesh><mesh position={[0, 1.25, 0]} scale={[1, 1.2, 1]}><sphereGeometry args={[.22, 18, 14]} /><meshStandardMaterial color="#e8404c" roughness={.3} /></mesh></group>
    case 'pennant': return <group position={at}><mesh position={[0, .25, 0]}><cylinderGeometry args={[.015, .015, .7, 6]} /><meshStandardMaterial color="#c9a54a" /></mesh><mesh position={[-.22, .45, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[.13, .42, 3]} /><meshStandardMaterial color="#1c1e1f" /></mesh><mesh position={[-.22, .45, .01]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[.07, .25, 3]} /><meshStandardMaterial color="#f2c52e" /></mesh></group>
    case 'icecream': return <group position={at}><mesh position={[0, .08, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.07, .22, 12]} /><meshStandardMaterial color="#d9a35f" /></mesh><Ball p={[0, .24, 0]} r={.09} c="#f7c3d4" /><Ball p={[0, .33, 0]} r={.07} c="#fff6e0" /></group>
    case 'diploma': return <group position={at} rotation={[0, 0, .5]}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.05, .05, .4, 12]} /><meshStandardMaterial color="#f4ecd8" /></mesh><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.055, .055, .06, 12]} /><meshStandardMaterial color="#c4473c" /></mesh></group>
    case 'pumpkin': return <group position={[at[0], at[1] - .14, at[2]]}><mesh scale={[1.1, .85, 1.1]}><sphereGeometry args={[.15, 14, 10]} /><meshStandardMaterial color="#e2782d" /></mesh><mesh position={[0, .16, 0]}><torusGeometry args={[.13, .012, 6, 16, Math.PI]} /><meshStandardMaterial color="#2b2f30" /></mesh></group>
    case 'microphone': return <group position={at} rotation={[.5, 0, 0]}><mesh><cylinderGeometry args={[.025, .02, .22, 8]} /><meshStandardMaterial color="#2b2f30" /></mesh><Ball p={[0, .14, 0]} r={.055} c="#9aa1a3" /></group>
    case 'snowball': return <Ball p={[at[0], at[1] + .1, at[2]]} r={.09} c="#ffffff" />
    default: return null
  }
}
function Worn({ worn }: { worn: Worn }) {
  return <>
    {worn.head === 'helmet' && <group><mesh position={[0, 1.1, 0]}><sphereGeometry args={[.5, 28, 20]} /><meshStandardMaterial color="#dff3ff" transparent opacity={.28} roughness={.05} metalness={.2} depthWrite={false} /></mesh><mesh position={[0, .76, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.32, .07, 10, 28]} /><meshStandardMaterial color="#f4f4f0" /></mesh><Box p={[.36, .9, -.2]} s={[.1, .1, .1]} c="#e8604c" /></group>}
    {worn.head === 'partyhat' && <group position={[.06, 1.42, 0]} rotation={[0, 0, -.25]}><mesh position={[0, .16, 0]}><coneGeometry args={[.14, .36, 18]} /><meshStandardMaterial color="#9b6bff" /></mesh><mesh position={[0, .12, 0]}><coneGeometry args={[.1, .03, 18]} /><meshStandardMaterial color="#ffd34d" /></mesh><Ball p={[0, .36, 0]} r={.05} c="#ff5fb0" /></group>}
    {worn.head === 'gradcap' && <group position={[0, 1.43, 0]} rotation={[-.12, 0, 0]}><mesh><cylinderGeometry args={[.25, .27, .14, 20]} /><meshStandardMaterial color="#141617" /></mesh><Box p={[0, .09, 0]} s={[.62, .03, .62]} c="#141617" r={[0, Math.PI / 4, 0]} /><Ball p={[0, .115, 0]} r={.03} c="#f2c52e" /><mesh position={[.28, -.02, .1]}><capsuleGeometry args={[.015, .18, 4, 6]} /><meshStandardMaterial color="#f2c52e" /></mesh></group>}
    {worn.head === 'witch' && <group position={[0, 1.4, 0]} rotation={[-.1, 0, .1]}><mesh><cylinderGeometry args={[.5, .5, .03, 28]} /><meshStandardMaterial color="#3b1d5a" /></mesh><mesh position={[0, .3, 0]} rotation={[0, 0, -.15]}><coneGeometry args={[.27, .6, 20]} /><meshStandardMaterial color="#3b1d5a" /></mesh><mesh position={[0, .05, 0]}><cylinderGeometry args={[.275, .28, .06, 20]} /><meshStandardMaterial color="#f2c52e" /></mesh></group>}
    {worn.head === 'santa' && <group position={[0, 1.38, 0]} rotation={[-.15, 0, -.2]}><mesh position={[0, .2, 0]}><coneGeometry args={[.3, .5, 20]} /><meshStandardMaterial color="#c4342b" /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.3, .06, 10, 28]} /><meshStandardMaterial color="#fff" /></mesh><Ball p={[0, .47, 0]} r={.07} c="#fff" /></group>}
    {worn.head === 'crown' && <group position={[0, 1.42, 0]}><mesh><cylinderGeometry args={[.22, .22, .12, 20, 1, true]} /><meshStandardMaterial color="#f2c52e" metalness={.5} roughness={.3} side={THREE.DoubleSide} /></mesh>{Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[Math.sin(i * Math.PI / 3) * .22, .11, Math.cos(i * Math.PI / 3) * .22]}><coneGeometry args={[.04, .1, 4]} /><meshStandardMaterial color="#f2c52e" metalness={.5} roughness={.3} /></mesh>)}<Ball p={[0, 0, .225]} r={.03} c="#c4473c" /></group>}
    {worn.head === 'beanie' && <group position={[0, 1.1, 0]} rotation={[-.5, 0, 0]}><mesh scale={[1.07, 1.02, 1.02]}><sphereGeometry args={[.37, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#c4473c" /></mesh><mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.4]}><torusGeometry args={[.37, .05, 10, 32]} /><meshStandardMaterial color="#f4f1e6" /></mesh><Ball p={[0, .4, 0]} r={.08} c="#f4f1e6" /></group>}
    {worn.head === 'flowers' && <group position={[0, 1.35, 0]} rotation={[-.35, 0, 0]}>{Array.from({ length: 12 }, (_, i) => <Ball key={i} p={[Math.sin(i * Math.PI / 6) * .31, 0, Math.cos(i * Math.PI / 6) * .31]} r={.055} c={['#f48fb1', '#fff6e0', '#ffd34d'][i % 3]} />)}</group>}
    {worn.face === 'sunglasses' && <group>{[-1, 1].map(s => <Box key={s} p={[s * .13, 1.13, .37]} s={[.17, .1, .02]} c="#111" r={[0, s * .3, 0]} />)}<Box p={[0, 1.15, .375]} s={[.08, .02, .02]} c="#111" /></group>}
    {worn.face === 'heartglasses' && <group>{[-1, 1].map(s => <group key={s} position={[s * .13, 1.12, .37]} rotation={[0, s * .3, 0]}>{[-1, 1].map(k => <Ball key={k} p={[k * .035, .02, 0]} r={.05} c="#ff4f9a" />)}<mesh position={[0, -.025, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.08, .09, 4]} /><meshStandardMaterial color="#ff4f9a" /></mesh></group>)}</group>}
    {worn.face === 'goggles' && <group><mesh position={[0, 1.13, 0]} rotation={[0, 0, 0]}><torusGeometry args={[.372, .025, 8, 40]} /><meshStandardMaterial color="#2b2f30" /></mesh>{[-1, 1].map(s => <mesh key={s} position={[s * .13, 1.13, .36]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.08, .08, .05, 16]} /><meshStandardMaterial color="#bfe3ee" transparent opacity={.6} /></mesh>)}</group>}
    {worn.face === 'snorkel' && <group><Box p={[0, 1.13, .37]} s={[.36, .15, .04]} c="#2fb7d6" /><Box p={[0, 1.13, .39]} s={[.3, .1, .01]} c="#cdeff7" /><mesh position={[.3, 1.35, .15]}><cylinderGeometry args={[.025, .025, .5, 8]} /><meshStandardMaterial color="#ffd34d" /></mesh></group>}
    {worn.neck === 'scarf' && <group><mesh position={[0, .79, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, .86, 1]}><torusGeometry args={[.19, .065, 10, 28]} /><meshStandardMaterial color="#c4342b" /></mesh><Box p={[.1, .62, .25]} s={[.12, .3, .05]} c="#c4342b" r={[.1, 0, .1]} />{[.5, .56].map(y => <Box key={y} p={[.11, y, .27]} s={[.13, .025, .052]} c="#f4f1e6" r={[.1, 0, .1]} />)}</group>}
    {worn.neck === 'lei' && <group position={[0, .74, 0]} rotation={[-.35, 0, 0]}>{Array.from({ length: 16 }, (_, i) => <Ball key={i} p={[Math.sin(i * Math.PI / 8) * .25, 0, Math.cos(i * Math.PI / 8) * .23]} r={.045} c={['#ff6fa5', '#ffd34d', '#ff8c42', '#fff'][i % 4]} />)}</group>}
    {worn.neck === 'bowtie' && <group position={[0, .74, .26]}>{[-1, 1].map(s => <mesh key={s} position={[s * .06, 0, 0]} rotation={[0, 0, s * Math.PI / 2]}><coneGeometry args={[.05, .1, 4]} /><meshStandardMaterial color="#c4342b" /></mesh>)}<Ball p={[0, 0, .01]} r={.025} c="#a42a22" /></group>}
    {worn.neck === 'medal' && <group><mesh position={[0, .75, .05]} rotation={[.3, 0, 0]}><torusGeometry args={[.2, .015, 6, 24, Math.PI]} /><meshStandardMaterial color="#2f6fb0" /></mesh><mesh position={[0, .55, .27]} rotation={[Math.PI / 2 - .2, 0, 0]}><cylinderGeometry args={[.07, .07, .02, 20]} /><meshStandardMaterial color="#f2c52e" metalness={.6} roughness={.25} /></mesh></group>}
  </>
}

/** A posed student in the booth. Wraps Character so accessory positions share the character's local space. */
function Posed({ look, pose, face, worn, position, rotation = 0, phase = 0 }: { look: AvatarLook; pose: Pose; face?: Face; worn: Worn; position: V; rotation?: number; phase?: number }) {
  const g = useRef<THREE.Group>(null), reach = useRef<THREE.Vector3 | null>(null), point = useRef(0), think = useRef(0)
  useFrame(({ clock }) => {
    const time = clock.elapsedTime + phase
    if (!g.current) return
    g.current.position.y = pose === 'jump' ? Math.abs(Math.sin(time * 3)) * .35 : 0
    point.current = pose === 'point' ? 1 : 0
    think.current = pose === 'think' ? 1 : 0
    const usesReach = pose === 'wave' || pose === 'peace' || (pose === 'relaxed' && !!worn.hand)
    if (usesReach) { const p = holdPoint(pose, time); reach.current = g.current.localToWorld(new THREE.Vector3(...p)) } else reach.current = null
  })
  const hideHat = worn.head && HEAD_ITEMS.has(worn.head)
  return <group ref={g} position={position} rotation={[0, rotation, 0]}>
    <Character {...look} headwear={hideHat ? 'none' : look.headwear} accessory={worn.face ? 'none' : look.accessory} face={face ?? look.face} reach={reach} point={point} eat={think} armsUp={pose === 'cheer' || pose === 'jump'} hold={worn.hand ? <HandItem id={worn.hand} at={[0, 0, 0]} /> : undefined}>
      <Worn worn={worn} />
    </Character>
  </group>
}

function BoothCamera({ zoom, height, shift, width }: { zoom: number; height: number; shift: number; width: number }) {
  const { camera } = useThree(), target = useRef(new THREE.Vector3(0, 1, 0))
  useFrame((_, dt) => {
    // Always back off far enough to fit everyone (portrait frame: horizontal half-FOV is narrow).
    const fit = width > 0 ? (width + .8) / (Math.tan(THREE.MathUtils.degToRad(22)) * .8) : 0
    const dist = Math.max(THREE.MathUtils.lerp(2, 8.5, zoom), fit)
    const look = new THREE.Vector3(shift, (fit ? 1.3 : THREE.MathUtils.lerp(1.15, 1.6, zoom)) + height, 0)
    const want = new THREE.Vector3(shift, look.y + (fit ? .3 : .15), dist)
    camera.position.lerp(want, 1 - Math.exp(-dt * 8)); target.current.lerp(look, 1 - Math.exp(-dt * 8)); camera.lookAt(target.current)
  })
  return null
}

// ---------------------------------------------------------------------------------------------
// The booth UI
// ---------------------------------------------------------------------------------------------
type Tab = 'Background' | 'People' | 'Pose' | 'Props' | 'Camera'
const TABS: { id: Tab; icon: string }[] = [{ id: 'Background', icon: '🖼️' }, { id: 'People', icon: '👥' }, { id: 'Pose', icon: '🤸' }, { id: 'Props', icon: '🎩' }, { id: 'Camera', icon: '🎥' }]
const SPOTS: V[] = [[-1, 0, -.25], [1, 0, -.25], [-1.9, 0, -.6], [1.9, 0, -.6]]

export type SharedPhoto={host:boolean;companion:BoothFriend;send:(type:'photo-state'|'photo-shoot'|'photo-ready',state?:unknown)=>void;leave:()=>void}
type PhotoState={theme:ThemeId;pose:Pose;face?:Face;worn:Worn;withScrappy:boolean;zoom:number;height:number;shift:number}
export function PhotoBooth({ look, name, friends, shared }: { look: AvatarLook; name: string; friends: BoothFriend[]; shared?:SharedPhoto }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('Background'), [category, setCategory] = useState<'ksu' | 'fun'>('ksu')
  const [theme, setTheme] = useState<ThemeId>('globe')
  const [pose, setPose] = useState<Pose>('peace'), [face, setFace] = useState<Face | undefined>(undefined)
  const [worn, setWorn] = useState<Worn>({})
  const [withScrappy, setWithScrappy] = useState(false), [crew, setCrew] = useState<number[]>([])
  const [zoom, setZoom] = useState(.6), [height, setHeight] = useState(0), [shift, setShift] = useState(0)
  const [savedToPhone,setSavedToPhone]=useState('')
  const [countdown, setCountdown] = useState(0), [flash, setFlash] = useState(false), [photo, setPhoto] = useState<string | null>(null)
  const gl = useRef<THREE.WebGLRenderer | null>(null), timers = useRef<number[]>([])
  const sharedRef=useRef(shared);sharedRef.current=shared
  const localFriends=shared?[shared.host?shared.companion:{name,look}]:friends
  const mainLook=shared&&!shared.host?shared.companion.look:look
  const themeInfo = ALL_THEMES.find(t => t.id === theme)!
  const people = 1 + crew.length + (withScrappy ? 1 : 0)

  useEffect(() => {
    const show = () => { setOpen(true); setPhoto(null); setSavedToPhone(''); activityState.locked = true }
    window.addEventListener('open-photo-booth', show)
    return () => window.removeEventListener('open-photo-booth', show)
  }, [])
  useEffect(()=>{if(shared){setOpen(true);setPhoto(null);setCrew([0]);activityState.locked=true;if(!shared.host)shared.send('photo-ready')}},[!!shared])
  const close = () => { if(sharedRef.current)sharedRef.current.leave(); timers.current.forEach(clearTimeout); timers.current = []; setCountdown(0); setOpen(false); activityState.locked = false }
  useEffect(() => { if (!open) return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (photo) setPhoto(null); else close() } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) })
  useEffect(() => () => { timers.current.forEach(clearTimeout); if (open) activityState.locked = false }, [open])

  useEffect(()=>{if(!open||!shared?.host)return;shared.send('photo-state',{theme,pose,face,worn,withScrappy,zoom,height,shift})},[open,shared?.host,theme,pose,face,worn,withScrappy,zoom,height,shift])
  useEffect(()=>{const ready=()=>{if(sharedRef.current?.host)sharedRef.current.send('photo-state',{theme,pose,face,worn,withScrappy,zoom,height,shift})};window.addEventListener('shared-photo-ready',ready);return()=>window.removeEventListener('shared-photo-ready',ready)},[theme,pose,face,worn,withScrappy,zoom,height,shift])
  useEffect(()=>{const receive=(event:Event)=>{if(!sharedRef.current||sharedRef.current.host)return;const value=(event as CustomEvent<PhotoState>).detail;if(!value||!ALL_THEMES.some(t=>t.id===value.theme)||!POSES.some(p=>p.id===value.pose))return;setTheme(value.theme);setPose(value.pose);setFace(FACES.some(f=>f.id===value.face)?value.face:undefined);setWorn(value.worn||{});setWithScrappy(value.withScrappy===true);setZoom(Math.max(0,Math.min(1,Number(value.zoom)||0)));setHeight(Math.max(-.4,Math.min(.6,Number(value.height)||0)));setShift(Math.max(-1.5,Math.min(1.5,Number(value.shift)||0)))};const remoteClose=()=>{timers.current.forEach(clearTimeout);timers.current=[];setCountdown(0);setOpen(false);activityState.locked=false};window.addEventListener('shared-photo-state',receive);window.addEventListener('close-shared-photo',remoteClose);return()=>{window.removeEventListener('shared-photo-state',receive);window.removeEventListener('close-shared-photo',remoteClose)}},[])
  const toggleAccessory = (id: AccessoryId, slot: Slot) => setWorn(w => ({ ...w, [slot]: w[slot] === id ? undefined : id }))
  const shoot = () => {
    if (countdown) return
    if(sharedRef.current?.host)sharedRef.current.send('photo-shoot')
    setCountdown(3)
    timers.current.push(window.setTimeout(() => setCountdown(2), 800), window.setTimeout(() => setCountdown(1), 1600), window.setTimeout(capture, 2400))
  }
  useEffect(()=>{const remoteShoot=()=>{if(!sharedRef.current||sharedRef.current.host)return;setCountdown(3);timers.current.push(window.setTimeout(()=>setCountdown(2),800),window.setTimeout(()=>setCountdown(1),1600),window.setTimeout(capture,2400))};window.addEventListener('shared-photo-shoot',remoteShoot);return()=>window.removeEventListener('shared-photo-shoot',remoteShoot)})
  const capture = () => {
    setCountdown(0)
    const canvas = gl.current?.domElement
    if (!canvas) return
    // Polaroid: the WebGL frame (backdrop included) inside a white card with a caption.
    const W = 900, pad = 50, photoH = 1000, card = document.createElement('canvas')
    card.width = W; card.height = pad + photoH + 190
    const g = card.getContext('2d')!
    g.fillStyle = '#fbf9f2'; g.fillRect(0, 0, card.width, card.height)
    const pw = W - pad * 2, ratio = Math.max(pw / canvas.width, photoH / canvas.height), sw = pw / ratio, sh = photoH / ratio
    g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, pad, pad, pw, photoH)
    g.fillStyle = '#26302c'; g.textAlign = 'center'; g.font = '800 46px "Trebuchet MS", system-ui, sans-serif'
    g.fillText(`${name || 'Owl'} · ${themeInfo.name}`, W / 2, pad + photoH + 82, W - 80)
    g.fillStyle = '#8a8470'; g.font = '700 26px system-ui, sans-serif'
    g.fillText(`NEST LIFE · KSU MARIETTA · ${new Date().toLocaleDateString()}`, W / 2, pad + photoH + 132, W - 80)
    setFlash(true); timers.current.push(window.setTimeout(() => setFlash(false), 450))
    setSavedToPhone('');setPhoto(card.toDataURL('image/png'))
  }

  if (!open) return null
  const themes = category === 'ksu' ? KSU_THEMES : FUN_THEMES
  return <div className="booth" role="dialog" aria-modal="true" aria-label="Campus Photo Booth">
    <div className="booth-stage">
      <div className="booth-frame">
        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} dpr={[1, 2]} camera={{ fov: 44, position: [0, 1.2, 5] }} onCreated={s => { gl.current = s.gl }}>
          <ambientLight intensity={1.6} /><directionalLight position={[3, 6, 5]} intensity={1.8} /><hemisphereLight args={['#ffffff', '#88a', .5]} />
          <Backdrop id={theme} />
          <Posed look={mainLook} pose={pose} face={face} worn={worn} position={[0, 0, .2]} />
          {crew.map((idx, k) => localFriends[idx] && <Posed key={idx} look={localFriends[idx].look} pose={pose} face={(['happy', 'wink', 'dots', 'surprised'] as Face[])[k % 4]} worn={{}} position={SPOTS[k]} rotation={SPOTS[k][0] < 0 ? .25 : -.25} phase={k + 1} />)}
          {withScrappy && <group position={SPOTS[crew.length] ?? [2.2, 0, -.6]} rotation={[0, (SPOTS[crew.length]?.[0] ?? 1) < 0 ? .3 : -.3, 0]} scale={.72}><Bob amp={.04} speed={2}><ScrappyFigure /></Bob></group>}
          <BoothCamera zoom={zoom} height={height} shift={shift} width={people === 1 ? 0 : Math.abs(SPOTS[Math.min(people - 2, 3)][0])} />
        </Canvas>
        {countdown > 0 && <div className="booth-count" key={countdown}>{countdown}</div>}
        {flash && <div className="booth-flash" />}
      </div>
      <button className="booth-shoot" onClick={shoot} disabled={countdown > 0 || !!shared&&!shared.host}>📸 {countdown ? 'Smile!' : shared&&!shared.host?'Your friend controls the camera':'Take photo'}</button>
    </div>
    <aside className="booth-panel">
      <header><div><small>NEST LIFE</small><h2>Campus Photo Booth</h2></div><button className="booth-x" onClick={close} aria-label="Close photo booth">×</button></header>
      <nav className="booth-tabs" aria-label="Photo booth options">{TABS.map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}><span aria-hidden="true">{t.icon}</span>{t.id}</button>)}</nav>
      <div className="booth-body" style={shared&&!shared.host?{pointerEvents:'none',opacity:.7}:undefined}>
        {tab === 'Background' && <>
          <div className="booth-seg"><button aria-pressed={category === 'ksu'} onClick={() => setCategory('ksu')}>KSU Locations</button><button aria-pressed={category === 'fun'} onClick={() => setCategory('fun')}>Fun Themes</button></div>
          <div className="booth-thumbs">{themes.map(t => <button key={t.id} className="booth-thumb" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}><span className="thumb-art" style={{ background: t.swatch }}><span aria-hidden="true">{t.icon}</span></span><span>{t.name}</span></button>)}</div>
        </>}
        {tab === 'People' && <>
          <p className="booth-hint">{people === 1 ? 'Solo selfie' : `Group photo · ${people} in frame`}</p>
          <label className="booth-toggle"><input type="checkbox" checked={withScrappy} onChange={e => setWithScrappy(e.target.checked)} /> <span>🦉 Add Scrappy</span></label>
          <h3>Friends <small>(up to 3)</small></h3>
          <div className="booth-chips">{localFriends.map((f, i) => { const on = crew.includes(i); return <button key={i} aria-pressed={on} disabled={!!shared||(!on && crew.length >= 3)} onClick={() => setCrew(c => on ? c.filter(x => x !== i) : [...c, i])}>{on ? '✓ ' : '+ '}{f.name}</button> })}</div>
          {!shared && crew.length > 0 && <button className="booth-link" onClick={() => setCrew([])}>Back to solo</button>}
        </>}
        {tab === 'Pose' && <>
          <h3>Pose</h3><div className="booth-grid">{POSES.map(p => <button key={p.id} aria-pressed={pose === p.id} onClick={() => setPose(p.id)}><span aria-hidden="true">{p.icon}</span>{p.name}</button>)}</div>
          <h3>Expression</h3><div className="booth-chips">{FACES.map(f => <button key={f.id} aria-pressed={face === f.id} onClick={() => setFace(face === f.id ? undefined : f.id)}>{f.name}</button>)}</div>
        </>}
        {tab === 'Props' && <>
          {themeInfo.suggest.length > 0 && <p className="booth-hint">✨ Suggested for {themeInfo.name}: {themeInfo.suggest.map(id => ACCESSORIES.find(a => a.id === id)!.name).join(', ')}</p>}
          {(['head', 'face', 'neck', 'hand'] as Slot[]).map(slot => <div key={slot}><h3>{SLOT_NAMES[slot]}</h3><div className="booth-grid">{ACCESSORIES.filter(a => a.slot === slot).map(a => <button key={a.id} aria-pressed={worn[slot] === a.id} className={themeInfo.suggest.includes(a.id) ? 'suggested' : ''} onClick={() => toggleAccessory(a.id, slot)}><span aria-hidden="true">{a.icon}</span>{a.name}</button>)}</div></div>)}
          <button className="booth-link" onClick={() => setWorn({})}>Remove all props</button>
        </>}
        {tab === 'Camera' && <>
          <div className="booth-seg">{[['Close-up', .15], ['Half', .4], ['Wide', .6], ['Scene', .9]].map(([n, z]) => <button key={n} aria-pressed={Math.abs(zoom - (z as number)) < .02} onClick={() => setZoom(z as number)}>{n}</button>)}</div>
          <label className="booth-range">Zoom<input type="range" min={0} max={1} step={.01} value={zoom} onChange={e => setZoom(+e.target.value)} /></label>
          <label className="booth-range">Height<input type="range" min={-.4} max={.6} step={.01} value={height} onChange={e => setHeight(+e.target.value)} /></label>
          <label className="booth-range">Left / right<input type="range" min={-1.5} max={1.5} step={.01} value={shift} onChange={e => setShift(+e.target.value)} /></label>
          <button className="booth-link" onClick={() => { setZoom(.6); setHeight(0); setShift(0) }}>Reset framing</button>
        </>}
      </div>
    </aside>
    {photo && <div className="booth-result" role="dialog" aria-label="Your photo">
      <div className="polaroid"><img src={photo} alt={`Photo of ${name} at ${themeInfo.name}`} /></div>
      {savedToPhone&&<p role="status" style={{color:'white'}}>{savedToPhone}</p>}<div className="booth-result-actions">
        <button className="booth-shoot small" disabled={savedToPhone==='Saved to phone!'} onClick={()=>{void savePhonePhoto(photo,`${name || 'Owl'} · ${themeInfo.name}`).then(ok=>setSavedToPhone(ok?'Saved to phone!':'Could not save; browser storage may be full.'))}}>📱 Save to phone</button>
        <button className="booth-secondary" onClick={() => setPhoto(null)}>Retake</button>
        <button className="booth-secondary" onClick={close}>Done</button>
      </div>
    </div>}
  </div>
}
