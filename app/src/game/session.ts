import type { Puzzle } from './engine.js';
import { puzzleCandidates, puzzlePeers, puzzleSymbols } from './puzzle-rules.js';
import { newId } from './id.js';
export type PlayEvent = {kind:'set';cell:number;value:number} | {kind:'hint'|'reveal';cell:number} | {kind:'check'|'autofill'} | {kind:'autocheck'|'conflicts';enabled:boolean};
export type Snapshot = { values:number[]; notes:number[][] };
export type Session = Snapshot & { id:string; puzzle:Puzzle; first:(number|null)[]; events:PlayEvent[]; past:Snapshot[]; future:Snapshot[]; seconds:number; startedAt:string; completedAt?:string; challenge?:{id:string;attemptId:string;token:string}; submitted?:boolean; checked?:number[] };
export function newSession(puzzle:Puzzle):Session { return { id:newId(),puzzle,values:[...puzzle.givens],notes:puzzle.givens.map(()=>[]),first:puzzle.givens.map(()=>null),events:[],past:[],future:[],seconds:0,startedAt:new Date().toISOString() }; }
/** Clear the board, retaining this attempt's identity and result provenance. */
export function resetSession(s:Session):Session {
 if(s.completedAt)return s;
 const clears:PlayEvent[]=s.values.flatMap((v,cell)=>v&&!s.puzzle.givens[cell]?[{kind:'set' as const,cell,value:0}]:[]);
 return {...s,values:[...s.puzzle.givens],notes:s.notes.map(()=>[]),first:[...s.first],events:[...s.events,...clears],past:[],future:[],seconds:0,checked:[]};
}
/** Manual check markers follow the current board and clear as each entry is fixed. */
function answerErrors(s:Session, cells:Iterable<number>):number[] {
 const bad = new Set<number>();
 for (const cell of cells)
  if (s.values[cell] && !s.puzzle.givens[cell] && s.values[cell] !== s.puzzle.solution[cell]) bad.add(cell);
 return [...bad];
}
export function checkSession(s:Session, cell?:number):{session:Session; errors:number[]} {
 if (s.completedAt) return {session:s, errors:[]};
 const errors = answerErrors(s, cell === undefined ? s.values.keys() : [cell]);
 const checked = cell === undefined ? errors : answerErrors(s, [...(s.checked ?? []), ...errors]);
 return {session:{...s,checked,events:[...s.events,{kind:'check'}]},errors};
}
function keepUnfixed(s:Session):Session {
 if (s.checked?.length) s.checked = answerErrors(s, s.checked);
 return s;
}
function editable(s:Session, cell:number) {
 return !s.completedAt && Number.isInteger(cell) && cell >= 0 &&
   cell < s.puzzle.givens.length && !s.puzzle.givens[cell];
}
const snapshot=(s:Session):Snapshot=>({values:[...s.values],notes:s.notes.map(n=>[...n])});
function commit(s:Session):Session {return {...s,...snapshot(s),first:[...s.first],events:[...s.events],past:[...s.past.slice(-199),snapshot(s)],future:[]};}
export function enter(s:Session,cell:number,value:number,note=false,removeNotes=true):Session {
 if(!editable(s,cell) || (value !== 0 && !puzzleSymbols(s.puzzle).includes(value))) return s;
 if(note && (s.values[cell] || value===0)) return s;
 if(!note && s.values[cell]===value && (value!==0 || !s.notes[cell].length)) return s;
 const n=commit(s);
 if(note) n.notes[cell]=n.notes[cell].includes(value)?n.notes[cell].filter(v=>v!==value):[...n.notes[cell],value].sort((a,b)=>a-b);
 else { n.values[cell]=value;n.notes[cell]=[];if(value && n.first[cell]===null)n.first[cell]=value;n.events.push({kind:'set',cell,value});if(value&&removeNotes)for(const peer of puzzlePeers(n.puzzle,cell)) n.notes[peer]=n.notes[peer].filter(v=>v!==value); }
 return keepUnfixed(n);
}
export function eraseCell(s:Session,cell:number,notes=false):Session {
 if(!editable(s,cell)) return s;
 if(notes ? !s.notes[cell].length : !s.values[cell]) return s;
 const n=commit(s);
 if(notes) n.notes[cell]=[];
 else {n.values[cell]=0;n.events.push({kind:'set',cell,value:0});}
 return keepUnfixed(n);
}
export function autofill(s:Session):Session { if(s.completedAt)return s;const n=commit(s);n.notes=n.values.map((v,i)=>v?[]:puzzleCandidates(n.puzzle,n.values,i));n.events.push({kind:'autofill'});return n; }
export function restore(s:Session,redo=false):Session {
 if(s.completedAt)return s;const from=redo?s.future:s.past;if(!from.length)return s;
 const snap=from[from.length-1];const n={...s,values:[...snap.values],notes:snap.notes.map(a=>[...a]),events:[...s.events],past:redo?[...s.past,snapshot(s)]:s.past.slice(0,-1),future:redo?s.future.slice(0,-1):[...s.future,snapshot(s)]};
 n.values.forEach((v,i)=>{if(v!==s.values[i])n.events.push({kind:'set',cell:i,value:v});});return keepUnfixed(n);
}
export function reveal(s:Session,cell:number):Session { if(!editable(s,cell))return s;const n=enter(s,cell,s.puzzle.solution[cell]);if(n===s)return s; n.events[n.events.length-1]={kind:'reveal',cell};return n; }
export function stats(s:Session){const revealed=new Set(s.events.filter(e=>e.kind==='reveal').map(e=>(e as {cell:number}).cell));const cells=s.first.flatMap((v,i)=>v===null||revealed.has(i)?[]:[i]);const correct=cells.filter(i=>s.first[i]===s.puzzle.solution[i]).length;const count=(kind:string)=>s.events.filter(e=>e.kind===kind).length;const assisted=s.events.some(e=>['hint','reveal','check','autofill'].includes(e.kind)||(('enabled'in e)&&e.enabled));return {accuracy:cells.length?Math.round(correct/cells.length*100):null,evaluated:cells.length,hints:count('hint'),reveals:count('reveal'),checks:count('check'),autofills:count('autofill'),assisted};}
export const solved=(s:Session)=>s.values.every((v,i)=>v===s.puzzle.solution[i]);
export const formatTime=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
export function readSaved<T>(key:string,fallback:T):T{try {const s=localStorage.getItem(key);return s?JSON.parse(s):fallback;}catch{return fallback;}}
export function save(key:string,value:unknown):boolean{try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
