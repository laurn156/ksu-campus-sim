import assert from 'node:assert/strict'
import {solveArm,smoothPath,newBattle,stepBattle} from '../src/activities/robotics.ts'
const p={x:2,y:1},angles=solveArm(p);assert(angles)
assert(Math.abs(1.5*Math.cos(angles.shoulder)+1.5*Math.cos(angles.shoulder+angles.elbow)-p.x)<1e-9)
assert(Math.abs(1.5*Math.sin(angles.shoulder)+1.5*Math.sin(angles.shoulder+angles.elbow)-p.y)<1e-9)
assert.equal(solveArm({x:4,y:0}),null);assert.equal(smoothPath([{x:1,y:1},{x:2,y:2}]).length,2)
const b=newBattle();b.player.x=0;b.enemy.x=1;b.player.heading=Math.PI/2;stepBattle(b,new Set([' ']),'Wedge','Horizontal spinner','Four wheels',.05);assert(b.enemy.health<100);assert(b.player.damage>0)
b.time=.01;stepBattle(b,new Set(),'Wedge','Pusher','Tracks',.05);assert(b.over)
console.log('Arm inverse kinematics, unreachable targets, combat and timer verified')
