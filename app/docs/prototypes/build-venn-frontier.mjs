import {writeFile,readFile} from 'node:fs/promises';
import {prepare,solve,exactCoverCount,humanSolve,rng,shuffle,contains} from './circle-models.mjs';
const root=new URL('.',import.meta.url),models=[],samples=[];
function weave(n,h,w){
 const step=312/n,start=210-step*(n-1)/2,cells=Array.from({length:n*n},(_,i)=>({x:start+i%n*step,y:start+Math.floor(i/n)*step}));
 const groups=[],shapes=[];
 function add(name,ids,shape){groups.push({name,cells:ids});shapes.push({...shape,label:name});}
 for(let r=0;r<n;r++)add('Across oval '+(r+1),Array.from({length:n},(_,c)=>r*n+c),{type:'ellipse',x:210,y:start+r*step,rx:step*(n-1)/2+step*.42,ry:step*.34,family:0});
 for(let c=0;c<n;c++)add('Down oval '+(c+1),Array.from({length:n},(_,r)=>r*n+c),{type:'ellipse',x:start+c*step,y:210,rx:step*.34,ry:step*(n-1)/2+step*.42,family:1});
 for(let r=0;r<n;r+=h)for(let c=0;c<n;c+=w)add('Crossing oval '+(groups.length-2*n+1),Array.from({length:n},(_,k)=>(r+Math.floor(k/w))*n+c+k%w),{type:'ellipse',x:start+(c+(w-1)/2)*step,y:start+(r+(h-1)/2)*step,rx:step*(w-1)/2+step*.7,ry:step*(h-1)/2+step*.7,family:2});
 const d=prepare({id:'weave'+n,title:'Woven ovals · '+(n===12?'A–L':'1–'+n),size:n,cells,groups,geometry:{shapes},nodeRadius:Math.min(17,step*.39),symbols:n===12?'ABCDEFGHIJKL'.split(''):Array.from({length:n},(_,i)=>String(i+1)),rule:'Every outlined oval uses every symbol once. Each cell belongs to one across, one down and one crossing oval.',idea:n===6?'36 nodes, no arithmetic. Familiar crossing deductions in a network of overlapping ovals.':n===9?'81 nodes allow deeper deduction chains; phone density is the tradeoff.': '144 nodes and 12 letters. A desktop/tablet stress test, not an automatic hard mode.',solution:cells.map((_,i)=>(Math.floor(i/n)*w+Math.floor(Math.floor(i/n)/h)+i%n)%n+1)});
 for(let g=0;g<groups.length;g++)for(let i=0;i<cells.length;i++)if(contains(shapes[g],cells[i].x,cells[i].y)!==groups[g].cells.includes(i))throw Error('Outline membership mismatch '+d.id+' '+g+' '+i);
 return d;
}
function trim(d,solution,seed){const random=rng(d.id+seed),board=[...solution];for(const i of shuffle(board.map((_,i)=>i),random)){const old=board[i];board[i]=0;try{if(solve(d,board,2,null,300000).count!==1)board[i]=old;}catch{board[i]=old;}}return board;}
for(const [n,h,w,trials]of[[6,2,3,100],[9,3,3,70],[12,3,4,8]]){
 const d=weave(n,h,w),pool=[];models.push(d);
 for(let seed=1;seed<=trials;seed++){
  const givens=trim(d,d.solution,seed),human=humanSolve(d,givens);
  const rank=(!human.solved?100000:0)+human.counts.triple*1000+human.counts.pair*100+human.counts.intersection*10+human.counts.hidden;
  pool.push({givens,seed,rank,counts:human.counts,logicSolved:human.solved,remaining:human.remaining,hardest:human.hardest});
 }
 pool.sort((a,b)=>b.rank-a.rank);
 const chosen=[pool[0],pool[Math.floor(pool.length/2)],pool.at(-1)];
 for(const [i,s]of chosen.entries()){
  const unique=solve(d,s.givens,2).count,independent=exactCoverCount(d,s.givens,2);if(unique!==1||independent!==1)throw Error('Nonunique');
  samples.push({...s,id:d.id+'-'+i,model:d.id,profile:['Deepest found','Middle of this batch','Gentler from this batch'][i],unique,independent,solution:d.solution});
 }
 console.log(d.id,JSON.stringify(chosen.map(s=>({givens:s.givens.filter(Boolean).length,solved:s.logicSolved,counts:s.counts,remaining:s.remaining}))));
}
// A sum bridge is a separately tested optional rule, not implicit in the oval game.
// Independent counter enumerates group-compatible completions and tests sums at leaves.
function countSums(d,givens,sums,prune=true){let count=0,nodes=0;const b=[...givens];
 function valid(){return sums.every(s=>{const assigned=s.cells.filter(i=>b[i]),total=assigned.reduce((a,i)=>a+b[i],0),left=s.cells.length-assigned.length;return left?total+left<=s.total&&total+left*d.size>=s.total:total===s.total;});}
 function search(){if(++nodes>2000000)throw Error('Sum budget');if(prune&&!valid())return;let cell=-1,choices=null;for(let i=0;i<b.length;i++)if(!b[i]){const forbidden=new Set(d.peers[i].map(j=>b[j])),next=Array.from({length:d.size},(_,k)=>k+1).filter(v=>!forbidden.has(v));if(!next.length)return;if(!choices||next.length<choices.length){cell=i;choices=next;}}if(cell<0){if(valid())count++;return;}for(const v of choices){b[cell]=v;search();b[cell]=0;if(count>=2)return;}}
 search();return count;
}
const math=structuredClone(models[0]);math.id='sumweave6';math.title='Sum bridges · 1–6';math.idea='Optional arithmetic changes the information: a few sum links can replace givens. It is a different solving taste, not required to enjoy the oval family.';math.rule+=' The two linked nodes beside each sum badge add to that total.';math.sums=[{cells:[1,8],total:math.solution[1]+math.solution[8]},{cells:[15,22],total:math.solution[15]+math.solution[22]},{cells:[27,34],total:math.solution[27]+math.solution[34]}];
const start=samples.find(s=>s.model==='weave6'&&s.profile==='Gentler from this batch');let board=[...start.givens];for(const i of shuffle(board.map((_,i)=>i),rng('sums'))){if(!board[i])continue;const old=board[i];board[i]=0;try{if(countSums(math,board,math.sums)!==1)board[i]=old;}catch{board[i]=old;}}
if(countSums(math,board,math.sums)!==1||countSums(math,board,math.sums,false)!==1)throw Error('Sum verifier disagrees');
models.push(math);samples.push({id:'sumweave6-0',model:math.id,profile:'Sum bridge experiment',givens:board,solution:math.solution,unique:1,independent:1,withoutSums:solve(math,board,2).count,counts:null});
console.log('sumweave6',board.filter(Boolean).length,'givens; without sums',solve(math,board,2).count);
const bank={date:'2026-11-10',trials:178,models:models.map(({membership,peers,solution,...d})=>d),samples};
await writeFile(new URL('venn-frontier.json',root),JSON.stringify(bank));
const lines=['# Venndoku frontier — local exploration only','', 'These are new, uncalibrated prototypes. Nothing in this bank ships in the public playtest.','', 'Changing outlines or switching numbers to letters does not itself add deduction depth. The woven network changes memberships: every node belongs to three independently crossing groups. Its constraint graph is standard rectangular Sudoku re-expressed as intersecting ovals; it is not a newly invented mathematical puzzle. The original three-circle study had interchangeable exclusive nodes that forced many givens.','', '| Model | Nodes / symbols | Selected examples | Logical evidence |','| --- | --- | --- | --- |',...models.map(d=>{const s=samples.filter(s=>s.model===d.id);return `| ${d.title} | ${d.cells.length} / ${d.size} | ${s.map(a=>a.givens.filter(Boolean).length).join(', ')} givens | ${s.map(a=>a.counts?JSON.stringify(a.counts)+(a.logicSolved?' completes':' stalls with '+a.remaining+' blanks'):'Sum-aware counters agree; ordinary constraints allow '+a.withoutSums+'+ completions').join('; ')} |`;}),'', 'All 9 non-math examples have exactly one completion under two independent algorithms (cell-first bitmask and constraint-first exact cover). Every oval outline was checked against every node center. The math example uses two sum counters: one prunes incomplete sums, the second checks sums only at completed boards. Both return one. “2” without sums means at least two, because counting stops at two.','', 'The technique engine attempts singles, hidden singles, intersections, pairs and triples. A stall is a reason for human playtesting, not a claim that guessing is necessary or a calibrated hard rating. Across 178 bounded clue-removal trials, the selected samples span the highest, middle and lowest measured technique load in that batch, not a guarantee of broad subjective difficulty.','', 'Phone gate: 6 is the first candidate; 9 needs a selected-node note shelf; 12 letters is a desktop/tablet exploration because 144 nodes shrink touch targets. A letter alphabet adds no arithmetic.','', 'Other directions worth a later prototype: two smaller oval networks sharing a seam (longer cross-board chains while keeping six symbols); bounded inequality links between existing nodes (positional logic with no sums); and target sums confined to a few shared nodes (optional math mode). Adding decorative circles, triangles or oblongs with unchanged memberships should remain a visual skin comparison, not a difficulty tier.',''];
await writeFile(new URL('VENN-FRONTIER.md',root),lines.join('\n'));
