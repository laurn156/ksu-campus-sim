import assert from 'node:assert/strict'
import {localMove,remoteMove} from '../src/connect/multiplayerTic.ts'
import {boardResult} from '../src/activities/engineeringGames.ts'
const initial={id:'match',peer:'other',phase:'active',board:Array(9).fill(null),pending:null}
let a={...initial,host:true},b={...initial,host:false}
assert.equal(localMove(b,0),null,'only X starts')
a=localMove(a,0);assert(a);b=remoteMove(b,0,1);assert(b);assert.deepEqual(a.board,b.board)
assert.equal(remoteMove(b,1,2),null,'remote X cannot play twice')
assert.equal(localMove(a,1),null,'a move cannot be sent twice before acknowledgement')
a={...a,pending:null};b=localMove(b,4);a=remoteMove(a,4,2);assert.deepEqual(a.board,b.board)
b={...b,pending:null};a=localMove(a,1);b=remoteMove(b,1,3);a={...a,pending:null};b=localMove(b,3);a=remoteMove(a,3,4);b={...b,pending:null};a=localMove(a,2);b=remoteMove(b,2,5)
assert.deepEqual(a.board,b.board);assert.equal(boardResult(a.board),'X');assert.equal(localMove(b,5),null,'game stops after a win')
assert.equal(remoteMove({...initial,host:false},99,1),null,'invalid squares are rejected')
assert.equal(remoteMove({...initial,host:false},0,2),null,'out-of-order moves are rejected')
console.log('Two-player turns, move validation and shared game result verified')
