import { candidates, peers, type Puzzle } from './engine';
export type PlayEvent = {kind:'set';cell:number;value:number} | {kind:'hint'|'reveal';cell:number} | {kind:'check'|'autofill'} | {kind:'autocheck'|'conflicts';enabled:boolean};
export type Snapshot = { values:number[]; notes:number[][] };
export type Session = Snapshot & { id:string; puzzle:Puzzle; first:(number|null)[]; events:PlayEvent[]; past:Snapshot[]; future:Snapshot[]; seconds:number; startedAt:string; completedAt?:string; challenge?:{id:string;attemptId:string;token:string}; submitted?:boolean };
export function newSession(puzzle:Puzzle):Session { return { id:crypto.randomUUID(),puzzle,values:[...puzzle.givens],notes:Array.from({length:81},()=>[]),first:Array(81).fill(null),events:[],past:[],future:[],seconds:0,startedAt:new Date().toISOString() }; }
const snapshot=(s:Session):Snapshot=>({values:[...s.values],notes:s.notes.map(n=>[...n])});
function commit(s:Session):Session {return {...s,...snapshot(s),first:[...s.first],events:[...s.events],past:[...s.past.slice(-199),snapshot(s)],future:[]};}
export function enter(s:Session,cell:number,value:number,note=false,removeNotes=true):Session {
 if(s.completedAt || cell<0 || cell>80 || s.puzzle.givens[cell] || value<0 || value>9) return s;
 if(note && (s.values[cell] || value===0)) return s;
 if(!note && s.values[cell]===value && (value!==0 || !s.notes[cell].length)) return s;
 const n=commit(s);
 if(note) n.notes[cell]=n.notes[cell].includes(value)?n.notes[cell].filter(v=>v!==value):[...n.notes[cell],value].sort();
 else { n.values[cell]=value;n.notes[cell]=[];if(value && n.first[cell]===null)n.first[cell]=value;n.events.push({kind:'set',cell,value});if(value&&removeNotes)for(const peer of peers(n.puzzle.regions,cell)) n.notes[peer]=n.notes[peer].filter(v=>v!==value); }
 return n;
}
export function eraseCell(s:Session,cell:number,notes=false):Session {
 if(s.completedAt || cell<0 || cell>80 || s.puzzle.givens[cell]) return s;
 if(notes ? !s.notes[cell].length : !s.values[cell]) return s;
 const n=commit(s);
 if(notes) n.notes[cell]=[];
 else {n.values[cell]=0;n.events.push({kind:'set',cell,value:0});}
 return n;
}
export function autofill(s:Session):Session { if(s.completedAt)return s;const n=commit(s);n.notes=n.values.map((v,i)=>v?[]:candidates(n.values,n.puzzle.regions,i));n.events.push({kind:'autofill'});return n; }
export function restore(s:Session,redo=false):Session {
 if(s.completedAt)return s;const from=redo?s.future:s.past;if(!from.length)return s;
 const snap=from[from.length-1];const n={...s,values:[...snap.values],notes:snap.notes.map(a=>[...a]),events:[...s.events],past:redo?[...s.past,snapshot(s)]:s.past.slice(0,-1),future:redo?s.future.slice(0,-1):[...s.future,snapshot(s)]};
 n.values.forEach((v,i)=>{if(v!==s.values[i])n.events.push({kind:'set',cell:i,value:v});});return n;
}
export function reveal(s:Session,cell:number):Session { if(s.completedAt||s.puzzle.givens[cell])return s;const n=enter(s,cell,s.puzzle.solution[cell]);if(n===s)return s; n.events[n.events.length-1]={kind:'reveal',cell};return n; }
export function stats(s:Session){const revealed=new Set(s.events.filter(e=>e.kind==='reveal').map(e=>(e as {cell:number}).cell));const cells=s.first.flatMap((v,i)=>v===null||revealed.has(i)?[]:[i]);const correct=cells.filter(i=>s.first[i]===s.puzzle.solution[i]).length;const count=(kind:string)=>s.events.filter(e=>e.kind===kind).length;const assisted=s.events.some(e=>['hint','reveal','check','autofill'].includes(e.kind)||(('enabled'in e)&&e.enabled));return {accuracy:cells.length?Math.round(correct/cells.length*100):null,evaluated:cells.length,hints:count('hint'),reveals:count('reveal'),checks:count('check'),autofills:count('autofill'),assisted};}
export const solved=(s:Session)=>s.values.every((v,i)=>v===s.puzzle.solution[i]);
export const formatTime=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
export function readSaved<T>(key:string,fallback:T):T{try {const s=localStorage.getItem(key);return s?JSON.parse(s):fallback;}catch{return fallback;}}
export function save(key:string,value:unknown):boolean{try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
