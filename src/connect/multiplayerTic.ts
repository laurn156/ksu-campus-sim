import { boardResult, type Board } from '../activities/engineeringGames.ts'
export type Match={id:string;peer:string;host:boolean;phase:'inviting'|'incoming'|'waiting'|'syncing'|'active'|'declined'|'left';board:Board;pending:{index:number;revision:number}|null}
/** Every board transition must be exactly one legal turn from the correct player. */
export function remoteMove(match:Match,index:unknown,revision:unknown):Match|null{
 if(match.phase!=='active'||!Number.isInteger(index)||Number(index)<0||Number(index)>8||!Number.isInteger(revision)||boardResult(match.board))return null
 const n=match.board.filter(Boolean).length,expected=match.host?'O':'X'
 if(revision!==n+1||(n%2===0?'X':'O')!==expected||match.board[Number(index)])return null
 const board=match.board.slice();board[Number(index)]=expected;return {...match,board,pending:null}
}
export function localMove(match:Match,index:number):Match|null{
 if(match.phase!=='active'||!Number.isInteger(index)||index<0||index>8||match.pending||match.board[index]||boardResult(match.board))return null
 const n=match.board.filter(Boolean).length,mark=match.host?'X':'O';if((n%2===0?'X':'O')!==mark)return null
 const board=match.board.slice();board[index]=mark;return {...match,board,pending:{index,revision:n+1}}
}
