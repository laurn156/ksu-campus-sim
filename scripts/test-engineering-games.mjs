import assert from 'node:assert/strict'
import {boardResult,robotMove,machineHint,wireTargets,shuffleTerminals} from '../src/activities/engineeringGames.ts'
assert.match(machineHint({},true),/red/i)
assert.match(machineHint({...wireTargets,blue:'NC'},true),/blue/i)
assert.match(machineHint(wireTargets,true),/jammed/i)
assert.equal(machineHint(wireTargets,false),'')
assert.equal(new Set(shuffleTerminals(()=>.1)).size,5)
assert.equal(boardResult(['X','X','X',null,null,null,null,null,null]),'X')
assert.equal(boardResult(['X','O','X','X','O','O','O','X','X']),'tie')
assert.equal(robotMove(['O','O',null,'X','X',null,null,null,null]),2,'robot takes a winning move')
assert.equal(robotMove(['X','X',null,'O',null,null,null,null,null]),2,'robot blocks a winning move')
assert.equal(robotMove(Array(9).fill(null)),4,'robot favors the center')
assert.equal(robotMove(['X','X','X','O','O',null,null,null,null]),null,'no moves after a win')
console.log('Vending wiring and tic-tac-toe win, block and tie logic verified')
const {solveArmAbove}=await import('../src/activities/robotics.ts')
for(let i=0;i<9;i++){const x=(i%3-1)*.65,z=(Math.floor(i/3)-1)*.65;const wristHeight=.65,boardTop=.16,lowestFinger=wristHeight-.17-.22-.035;const a=solveArmAbove({x:Math.hypot(x+2,z),y:wristHeight-1.1});assert(a,`arm can reach square ${i}`);assert(1.1+1.5*Math.sin(a.shoulder)>boardTop+.27,`elbow stays above table for square ${i}`);assert(lowestFinger>boardTop,`gripper stays above board for square ${i}`)}
