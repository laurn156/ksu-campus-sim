export type Wire='red'|'black'|'blue'|'yellow'
export type Terminal='+12V'|'GND'|'MOTOR'|'SIGNAL'|'NC'
export const wireTargets:Record<Wire,Terminal>={red:'+12V',black:'GND',blue:'MOTOR',yellow:'SIGNAL'}
export const wires:Wire[]=['red','black','blue','yellow']
export const terminals:Terminal[]=['+12V','GND','MOTOR','SIGNAL','NC']
export function machineHint(connections:Partial<Record<Wire,Terminal>>,jammed:boolean){
 const missing=wires.find(w=>!connections[w]);if(missing)return `Connect the ${missing} wire using the service notes.`
 const incorrect=wires.find(w=>connections[w]!==wireTargets[w]);if(incorrect)return `Check the ${incorrect} wire against the service notes. NC stays unused.`
 if(jammed)return 'Power is restored, but the dispenser is jammed. Remove the stuck snack, then test again.'
 return ''
}
export function shuffleTerminals(random:()=>number=Math.random):Terminal[]{const order=[...terminals];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}return order}
export type Cell='X'|'O'|null
export type Board=Cell[]
const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
export function boardResult(board:Board):'X'|'O'|'tie'|null{for(const [a,b,c] of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return board.every(Boolean)?'tie':null}
/** Win or block immediately, then favor the center and corners. */
export function robotMove(board:Board):number|null{
 if(boardResult(board))return null
 for(const mark of ['O','X'] as const)for(let i=0;i<9;i++){if(board[i])continue;const copy=board.slice();copy[i]=mark;if(boardResult(copy)===mark)return i}
 return [4,0,2,6,8,1,3,5,7].find(i=>!board[i])??null
}
