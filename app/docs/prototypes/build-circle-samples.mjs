import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeModels,prepare,rng,shuffle,solve,exactCoverCount,humanSolve,conflicts} from './circle-models.mjs';

const root = fileURLToPath(new URL('.',import.meta.url));
const models=makeModels(), samples=[], report=[];
const copies=Number(process.env.CIRCLE_SAMPLE_COPIES||3);
const poolSize=Number(process.env.CIRCLE_SEARCH_POOL||300);
function metrics(d) {
  if(d.geometry.type==='ring') {
    const {rings,sectors,inner,outer}=d.geometry,step=(outer-inner)/rings,angle=Math.PI*2/sectors;
    const columns=d.size===4?2:d.size===6?3:4,rows=2;
    let font=12;
    for(const cell of d.cells){const r0=inner+cell.ring*step,r1=r0+step,a=-Math.PI/2+cell.sector*angle,mid=a+angle/2,r=(r0+r1)/2,x=210+r*Math.cos(mid),y=210+r*Math.sin(mid);
      function fits(f){const w=((columns-1)*1.15+.7)*f/2,h=((rows-1)*1.3+.95)*f/2;return [-w,w].every(dx=>[-h,h].every(dy=>{const radius=Math.hypot(x+dx-210,y+dy-210);let theta=Math.atan2(y+dy-210,x+dx-210)-a;while(theta<0)theta+=Math.PI*2;return radius>r0+1&&radius<r1-1&&theta>0&&theta<angle;}));}
      let lo=0,hi=12;for(let k=0;k<20;k++){const m=(lo+hi)/2;if(fits(m))lo=m;else hi=m;}font=Math.min(font,lo);
    }
    return {noteFontSVG:+font.toFixed(2),minCellSVG:+step.toFixed(1),mobileNotePx:+(font*360/420).toFixed(1),nodeSpacingPx:null};
  }
  const minDistance=Math.min(...d.cells.flatMap((a,i)=>d.cells.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));
  return {noteFontSVG:d.size===8?10:12,minCellSVG:44,mobileNotePx:+((d.size===8?10:12)*360/420).toFixed(1),nodeSpacingPx:+(minDistance*360/420).toFixed(1),minBoundarySVG:+Math.min(...d.cells.map(c=>c.margin)).toFixed(1)};
}
function removeClues(d,solution,random) {
  const puzzle=[...solution];
  for(const i of shuffle(puzzle.map((_,i)=>i),random)) {
    const old=puzzle[i];puzzle[i]=0;
    try {if(solve(d,puzzle,2).count!==1)puzzle[i]=old;}catch{puzzle[i]=old;}
  }
  return puzzle;
}
function addClues(d,solution,start,order,target,simple=false) {
  const puzzle=[...start];let at=0;
  while(at<order.length){const h=humanSolve(d,puzzle);if(puzzle.filter(Boolean).length>=target&&h.solved&&(!simple||!h.counts.intersection&&!h.counts.pair&&!h.counts.triple))break;const cell=order[at++];if(!puzzle[cell])puzzle[cell]=solution[cell];}
  return puzzle;
}
const started=performance.now();
for(const d of models) {
  const geometryMetrics=metrics(d);Object.assign(d,geometryMetrics);
  const own=[];
  const base=d.geometry.linked?prepare({...d,groups:d.groups.filter(g=>!g.name.startsWith('Bridge'))}):null;
  const pool=[];
  if(!d.equivalent)for(let trial=0;trial<poolSize;trial++){
    const random=rng(d.id+':hunt:'+trial);
    let solution;
    try{solution=solve(d,Array(d.cells.length).fill(0),1,random,200000).solution;}catch{solution=null;}
    if(!solution){const symbols=shuffle(Array.from({length:d.size},(_,i)=>i+1),random);solution=d.solution.map(v=>symbols[v-1]);}
    const sparse=removeClues(d,solution,random),h=humanSolve(d,sparse),essential=!!base&&solve(base,sparse,2).count>1;
    const rank=h.counts.triple*1000+h.counts.pair*500+h.counts.intersection*100+h.counts.hidden*10+(essential?5:0);
    pool.push({trial,solution,sparse,h,rank,essential});
  }
  const sorter=(a,b)=>b.rank-a.rank||a.sparse.filter(Boolean).length-b.sparse.filter(Boolean).length||a.trial-b.trial;
  const explained=pool.filter(p=>p.h.solved).sort(sorter),stalled=pool.filter(p=>!p.h.solved).sort(sorter);
  const selected=[];const seenMasks=new Set();
  for(const p of [...explained.slice(0,2),...stalled,...explained.slice(2)]){const key=p.sparse.map(v=>v?'1':'0').join('');if(!seenMasks.has(key)){selected.push(p);seenMasks.add(key);}if(selected.length===copies)break;}
  for(let seed=1;seed<=copies;seed++) {
    if(d.equivalent){for(const source of samples.filter(s=>s.model===d.equivalent&&s.seed===seed)){if(solve(d,source.givens,2).count!==1||exactCoverCount(d,source.givens,2)!==1)throw Error('Equivalent geometry failed verification');const sample={...source,id:`${d.id}-${source.profile}-${seed}`,model:d.id};own.push(sample);samples.push(sample);}continue;}
    const random=rng(d.id+':'+seed);
    const {solution,sparse,trial}=selected[seed-1];
    if(conflicts(d,solution).length)throw Error('Invalid generated answer');
    const order=shuffle(solution.map((_,i)=>i),random),minimum=sparse.filter(Boolean).length;
    const pattern=addClues(d,solution,sparse,order,Math.min(d.cells.length-2,minimum+Math.max(1,Math.round(d.cells.length*.06))));
    const guided=addClues(d,solution,pattern,order,Math.min(d.cells.length-2,Math.max(Math.ceil(d.cells.length*.55),minimum+Math.ceil(d.cells.length*.17))),true);
    for(const [profile,givens] of [['guided',guided],['pattern',pattern],['sparse',sparse]]) {
      const count=solve(d,givens,2).count,independent=exactCoverCount(d,givens,2);
      if(count!==1||independent!==1)throw Error(`Non-unique fixture ${d.id}/${profile}/${seed}`);
      const h=humanSolve(d,givens);
      if(h.solved&&h.board.some((v,i)=>v!==solution[i]))throw Error('Logical analysis differs from unique answer');
      const sample={id:`${d.id}-${profile}-${seed}`,model:d.id,profile,seed,searchSeed:trial,givens,solution,counts:h.counts,hardest:h.hardest,logicSolved:h.solved,remaining:h.remaining,firstSteps:h.trace.slice(0,4),unique:count,independent,bridgeNeeded:base?solve(base,givens,2).count>1:null};
      own.push(sample);samples.push(sample);
    }
  }
  const masks=new Set(own.map(s=>s.givens.map(v=>v?'1':'0').join(''))).size;
  const solved=own.filter(s=>s.logicSolved).length;
  const empty=Array(d.cells.length).fill(0),invalid=[...empty];invalid[d.groups[0].cells[0]]=1;invalid[d.groups[0].cells[1]]=1;
  if(solve(d,empty,2).count!==2||exactCoverCount(d,empty,2)!==2||solve(d,invalid,2).count!==0||exactCoverCount(d,invalid,2)!==0)throw Error('Solution counter controls failed for '+d.id);
  report.push({id:d.id,title:d.title,cells:d.cells.length,groups:d.groups.length,symbols:d.size,components:d.components,clueFloor:d.clueFloor,samples:own.length,searched:d.equivalent?0:pool.length,sourceEquivalent:d.equivalent||null,bridgeNeeded:own.filter(s=>s.bridgeNeeded).length,distinctMasks:masks,minGivens:Math.min(...own.map(s=>s.givens.filter(Boolean).length)),maxGivens:Math.max(...own.map(s=>s.givens.filter(Boolean).length)),logicSolved:solved,advanced:own.length-solved,...geometryMetrics,techniques:Object.fromEntries(['single','hidden','intersection','pair','triple'].map(k=>[k,own.reduce((n,s)=>n+s.counts[k],0)]))});
  console.log(`${d.id}: ${own.length} unique, independently verified; ${masks} clue masks; logic ${solved}/${own.length}; notes ~${geometryMetrics.mobileNotePx}px at 360px`);
}
const serializable=models.map(({membership,peers,...d})=>d);
const bank={generated:'2026-11-09',copies,searched:report.reduce((n,r)=>n+r.searched,0),profiles:['guided','pattern','sparse'],models:serializable,samples,report,elapsedMs:Math.round(performance.now()-started)};
await writeFile(root+'circle-samples.json',JSON.stringify(bank));
const text=[
 '# Circle sample computation — November 9, 2026',
 '',`Searched ${bank.searched} generated candidates and selected ${samples.length} playable fixtures across ${models.length} models, ${copies} samples per profile. Each playable fixture has one completion under both the cell-based bit-mask solver and an independently implemented exact-cover counter. Equivalent ovals/triangles reuse the three-circle givens and answers for a controlled shape comparison.`,
 '', 'Profiles are clue-density/teaching presets, not calibrated easy/medium/hard ratings. The technique audit attempts naked singles, hidden singles, locked candidates across intersecting groups, naked pairs and naked triples. A stall means this limited explanation engine needs more techniques; it does not prove guessing is necessary. Search node counts are not used as human difficulty scores.',
 '', '| Model | Cells / symbols | Givens range | Unique samples | Distinct masks | Logic completes | Min notes at 360px | Forced clue floor | Components |',
 '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
 ...report.map(r=>`| ${r.title} | ${r.cells} / ${r.symbols} | ${r.minGivens}–${r.maxGivens} | ${r.samples} | ${r.distinctMasks} | ${r.logicSolved}/${r.samples} | ~${r.mobileNotePx}px | ${r.clueFloor} | ${r.components} |`),
 '', 'The forced clue floor is a structural lower bound from identical membership signatures: if two blank cells belong to exactly the same groups, swapping their different values gives a second solution. At least k−1 of k such interchangeable cells must therefore be givens. This is a lower bound, not an assertion that the bound is attainable or that these givens alone establish uniqueness.',
 '', 'Distinct masks count clue positions only, not independently proven classes of solving experience. Digit relabeling, symmetry and repeated logical structures can still relate samples. This finite batch does not prove an unlimited generator, uniform sampling or a stable difficulty ladder.',
 '', 'Counter controls also passed for every model: both methods return at least two completions (capped at two) for an empty board and zero completions for a board with a repeated given inside a group. All stored complete answers satisfy every group.',
 '', 'The note-size estimates fit an upright candidate block inside each ring wedge. They are geometric font budgets, not measured text legibility or screen-reader/touch validation. The overlap node-spacing metric is center-to-center distance at a 360px board, not a certified touch-target size.',
 '', 'Ovals and triangles intentionally retain the three-circle membership graph. Their independent clue samples vary, but the change of outline is not a new logical constraint. Their geometry can still change reading difficulty.',
 '', 'Computation completed in '+(bank.elapsedMs/1000).toFixed(2)+' seconds. Run node app/docs/prototypes/build-circle-samples.mjs to reproduce the bounded sample bank. No production files, persistence, scores or daily rotation are read or changed.',
 ];
await writeFile(root+'CIRCLE-COMPUTATION.md',text.join('\n')+'\n');
console.log(`Saved ${samples.length} fixtures in ${bank.elapsedMs}ms.`);
