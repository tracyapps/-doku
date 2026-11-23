// Experimental all-different models. No production engine, saves, scores or APIs.
export function rng(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => { state += 0x6d2b79f5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(values, random) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pop = mask => { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; };
export const digits = (mask, size) => Array.from({length:size}, (_,i) => i + 1).filter(n => mask & 1 << n - 1);
export function prepare(d) {
  const membership = Array.from({length:d.cells.length}, (_,i) => d.groups.flatMap((g,j) => g.cells.includes(i) ? [j] : []));
  return {...d, membership, peers:membership.map((gs,i) => [...new Set(gs.flatMap(g => d.groups[g].cells))].filter(j => j !== i))};
}
export function candidates(d, board, i) {
  if (board[i]) return [];
  const used = new Set(d.peers[i].map(j => board[j]));
  return Array.from({length:d.size}, (_,i) => i + 1).filter(n => !used.has(n));
}
export function conflicts(d, board) {
  return d.groups.filter(g => { const a = g.cells.map(i => board[i]).filter(Boolean); return new Set(a).size !== a.length; });
}
export function solve(d, givens, limit = 2, random = null, budget = 1000000) {
  const board = [...givens], full = (1 << d.size) - 1, used = d.groups.map(() => 0);
  let count = 0, nodes = 0, solution = null;
  for (let i = 0; i < board.length; i++) if (board[i]) {
    const bit = 1 << board[i] - 1;
    if (d.membership[i].some(g => used[g] & bit)) return {count:0, nodes, solution};
    for (const g of d.membership[i]) used[g] |= bit;
  }
  const order = random ? shuffle(board.map((_,i) => i), random) : board.map((_,i) => i);
  function search() {
    if (++nodes > budget) throw Error('Search budget exceeded for ' + d.id);
    let at = -1, options = 0, best = d.size + 1;
    for (const i of order) if (!board[i]) {
      let mask = full;
      for (const g of d.membership[i]) mask &= ~used[g];
      const n = pop(mask);
      if (!n) return;
      if (n < best) { at = i; options = mask; best = n; if (n === 1) break; }
    }
    if (at < 0) { count++; solution ??= [...board]; return; }
    const choices = random ? shuffle(digits(options, d.size), random) : digits(options, d.size);
    for (const v of choices) {
      const bit = 1 << v - 1; board[at] = v;
      for (const g of d.membership[at]) used[g] |= bit;
      search();
      for (const g of d.membership[at]) used[g] &= ~bit;
      board[at] = 0;
      if (count >= limit) return;
    }
  }
  search(); return {count, nodes, solution};
}

// Independent verifier: exact cover over cell + (group,digit) columns.
// Its branching variable is an uncovered constraint, not a Sudoku cell.
export function exactCoverCount(d, givens, limit = 2) {
  const columns = d.cells.length + d.groups.length * d.size;
  const rows = [], byColumn = Array.from({length:columns}, () => []);
  for (let cell = 0; cell < d.cells.length; cell++) for (let value = 1; value <= d.size; value++) {
    if (givens[cell] && givens[cell] !== value) continue;
    if (d.peers[cell].some(i => givens[i] === value)) continue;
    const row = [cell, ...d.membership[cell].map(g => d.cells.length + g * d.size + value - 1)];
    const index = rows.push(row) - 1;
    for (const c of row) byColumn[c].push(index);
  }
  let total = 0, visits = 0;
  const active = Array(columns).fill(true);
  function search(left) {
    if (++visits > 2000000) throw Error('Independent verification budget exceeded');
    if (!left) { total++; return; }
    let choices = null;
    for (let col = 0; col < columns; col++) if (active[col]) {
      const available = byColumn[col].filter(r => rows[r].every(c => active[c]));
      if (!available.length) return;
      if (!choices || available.length < choices.length) { choices = available; if (choices.length === 1) break; }
    }
    for (const r of choices) {
      for (const c of rows[r]) active[c] = false;
      search(left - rows[r].length);
      for (const c of rows[r]) active[c] = true;
      if (total >= limit) return;
    }
  }
  search(columns); return total;
}

export function humanSolve(d, initial) {
  const board = [...initial], full = (1 << d.size) - 1;
  const masks = board.map((v,i) => v ? 0 : candidates(d, board, i).reduce((m,n) => m | 1 << n - 1, 0));
  const trace = [], counts = {single:0, hidden:0, intersection:0, pair:0, triple:0};
  const add = (kind, data) => { counts[kind]++; trace.push({kind, ...data}); };
  function place(i,v,kind,group) {
    board[i] = v; masks[i] = 0;
    for (const j of d.peers[i]) masks[j] &= ~(1 << v - 1);
    add(kind, {cell:i, value:v, group});
  }
  let guard = 0;
  outer: while (board.some(v => !v) && guard++ < 5000) {
    for (let i = 0; i < board.length; i++) if (!board[i] && pop(masks[i]) === 1) { place(i, digits(masks[i], d.size)[0], 'single'); continue outer; }
    for (let g = 0; g < d.groups.length; g++) for (let v = 1; v <= d.size; v++) {
      if (d.groups[g].cells.some(i => board[i] === v)) continue;
      const cells = d.groups[g].cells.filter(i => masks[i] & 1 << v - 1);
      if (cells.length === 1) { place(cells[0], v, 'hidden', g); continue outer; }
    }
    for (let a = 0; a < d.groups.length; a++) for (let v = 1; v <= d.size; v++) {
      const possible = d.groups[a].cells.filter(i => masks[i] & 1 << v - 1);
      if (possible.length < 2) continue;
      for (let b = 0; b < d.groups.length; b++) if (a !== b && possible.every(i => d.groups[b].cells.includes(i))) {
        const removed = d.groups[b].cells.filter(i => !d.groups[a].cells.includes(i) && masks[i] & 1 << v - 1);
        if (removed.length) { for (const i of removed) masks[i] &= ~(1 << v - 1); add('intersection', {value:v, groups:[a,b], cells:removed}); continue outer; }
      }
    }
    for (let g = 0; g < d.groups.length; g++) {
      const cells = d.groups[g].cells.filter(i => !board[i]);
      for (const size of [2,3]) {
        const eligible = cells.filter(i => pop(masks[i]) >= 2 && pop(masks[i]) <= size);
        for (let a = 0; a < eligible.length; a++) for (let b = a + 1; b < eligible.length; b++) {
          const combinations = size === 2 ? [[eligible[a],eligible[b]]] : eligible.slice(b+1).map(c => [eligible[a],eligible[b],c]);
          for (const subset of combinations) {
            const union = subset.reduce((m,i) => m | masks[i], 0);
            if (pop(union) !== size) continue;
            const removed = cells.filter(i => !subset.includes(i) && masks[i] & union);
            if (removed.length) { for (const i of removed) masks[i] &= ~union; add(size === 2 ? 'pair' : 'triple', {group:g, subset, cells:removed, values:digits(union,d.size)}); continue outer; }
          }
        }
      }
    }
    break;
  }
  return {solved:board.every(Boolean), remaining:board.filter(v => !v).length, counts, trace, board, hardest:counts.triple?'triple':counts.pair?'pair':counts.intersection?'intersection':counts.hidden?'hidden':'single'};
}

const group = (name,cells) => ({name,cells});
function ring(id,title,size,rings,sectors,{split = 1, linked = false, wide = false, boxH = 2, boxW = size / 2, ...info} = {}) {
  const cells = Array.from({length:rings*sectors}, (_,i) => ({ring:Math.floor(i/sectors), sector:i%sectors}));
  const groups = [];
  if (wide) {
    for (let r = 0; r < rings; r++) groups.push(group('Ring '+(r+1), Array.from({length:sectors}, (_,c) => r*sectors+c)));
    for (let c = 0; c < sectors; c += 2) groups.push(group('Two-spoke wedge '+(c/2+1), cells.flatMap((cell,i) => cell.sector === c || cell.sector === c+1 ? [i] : [])));
  } else for (let half = 0; half < split; half++) {
    for (let r = 0; r < rings; r++) groups.push(group(`${split>1?'Section '+(half+1)+' · ':''}ring ${r+1}`, Array.from({length:size}, (_,c) => r*sectors+half*size+c)));
    for (let c = 0; c < size; c++) groups.push(group('Spoke '+(half*size+c+1), Array.from({length:rings}, (_,r) => r*sectors+half*size+c)));
    for (let r = 0; r < rings; r += boxH) for (let c = 0; c < size; c += boxW) groups.push(group(`Curved region ${groups.filter(g=>g.name.startsWith('Curved')).length+1}`, Array.from({length:size}, (_,k) => (r+Math.floor(k/boxW))*sectors+half*size+c+k%boxW)));
  }
  if (linked) for (let section = 0; section < split; section++) for (let r = 0; r < rings; r++) {
    const start = (section * size - 2 + sectors) % sectors;
    groups.push(group(`Bridge ${section+1} · ring ${r+1}`, Array.from({length:4}, (_,k) => r*sectors+(start+k)%sectors)));
  }
  const inner = sectors >= 12 ? 50 : size === 8 && !wide ? 50 : size === 6 && !wide ? 42 : 35;
  const solution = cells.map(({ring:r,sector:c}) => wide ? (2*r+c)%size+1 : ((r*boxW+Math.floor(r/boxH)+(c%size))%size)+1);
  return prepare({id,title,family:'ring',size,cells,groups,geometry:{type:'ring',rings,sectors,inner,outer:205,split,linked,wide,boxH,boxW},solution,...info});
}
function circleShape(x,y,r) { return {type:'circle',x,y,r}; }
function polygonContains(vertices,x,y) {
  let inside = false;
  for (let i=0,j=vertices.length-1;i<vertices.length;j=i++) { const [xi,yi]=vertices[i],[xj,yj]=vertices[j]; if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside; }
  return inside;
}
export function contains(shape,x,y) {
  return shape.type==='polygon' ? polygonContains(shape.vertices,x,y) : shape.type==='ellipse' ? ((x-shape.x)/shape.rx)**2+((y-shape.y)/shape.ry)**2<1 : Math.hypot(x-shape.x,y-shape.y)<shape.r;
}
function boundaryDistance(s,x,y) {
  if (s.type==='circle') return Math.abs(Math.hypot(x-s.x,y-s.y)-s.r);
  if (s.type==='ellipse') return Math.abs(Math.hypot((x-s.x)/s.rx,(y-s.y)/s.ry)-1)*Math.min(s.rx,s.ry);
  return Math.min(...s.vertices.map(([ax,ay],i)=>{const [bx,by]=s.vertices[(i+1)%s.vertices.length],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}));
}
function overlap(id,title,size,shapes,layout,info={}) {
  const wanted=[];
  for(let g=0;g<shapes.length;g++)for(let j=0;j<layout.exclusive;j++)wanted.push(1<<g);
  for(const mask of layout.pairs)wanted.push(mask);
  if(layout.triples)wanted.push(...layout.triples);
  if(layout.hub)wanted.push((1<<shapes.length)-1);
  const cells=[],bins=new Map();
  for(let y=24;y<=396;y+=4)for(let x=24;x<=396;x+=4){const mask=shapes.reduce((m,s,i)=>contains(s,x,y)?m|1<<i:m,0);if(wanted.includes(mask)){const margin=Math.min(...shapes.map(s=>boundaryDistance(s,x,y)));if(!bins.has(mask))bins.set(mask,[]);bins.get(mask).push({x,y,margin});}}
  const order=wanted.map((mask,i)=>({mask,i})).sort((a,b)=>pop(b.mask)-pop(a.mask));
  for(const {mask,i} of order){const candidates=bins.get(mask);if(!candidates?.length)throw Error('Missing geometric intersection '+mask+' for '+id);let best,score=-1;for(const p of candidates){const distance=cells.filter(Boolean).length?Math.min(...cells.filter(Boolean).map(q=>Math.hypot(p.x-q.x,p.y-q.y))):100;const s=Math.min(p.margin*2.0,distance*.72);if(s>score){score=s;best=p;}}cells[i]={...best,mask};}
  const groups=shapes.map((_,g)=>group((shapes[g].label||'Shape '+(g+1)),cells.flatMap((p,i)=>p.mask&1<<g?[i]:[])));
  const d=prepare({id,title,family:'venn',size,cells,groups,geometry:{type:'overlap',shapes},...info});
  if(groups.some(g=>g.cells.length!==size))throw Error('Incorrect unit size for '+id);
  const result=solve(d,Array(cells.length).fill(0),1,rng(id));if(!result.solution)throw Error('Unsatisfiable overlap '+id);d.solution=result.solution;return d;
}
export function makeModels() {
  const ruleClassic=n=>`Use 1–${n} once in each ring, each spoke and each outlined curved region.`;
  const models=[
    ring('ring4','Ringdoku · 4 × 4',4,4,4,{rule:ruleClassic(4),idea:'The familiar starting point. Fewer givens can change the deduction sequence without increasing the symbol set.'}),
    ring('ring6','Ringdoku · 6 × 6',6,6,6,{rule:ruleClassic(6),idea:'36 cells and 1–6. More crossing groups; the six radial layers reduce the space for notes.'}),
    ring('ring8','Ringdoku · 8 × 8',8,8,8,{rule:ruleClassic(8),idea:'64 cells and 1–8. A useful density stress test; the inner ring notes become very small on a phone.'}),
    ring('wide6','Wide rings · 1–6',6,3,6,{wide:true,rule:'Use 1–6 once in each ring and each two-spoke wedge. An individual spoke has three cells and is not a separate 1–6 group.',idea:'Three wider radial layers keep the cells larger. The changed group structure has more interchangeable positions, so unique puzzles need more givens.'}),
    ring('wide8','Wide rings · 1–8',8,4,8,{wide:true,rule:'Use 1–8 once in each ring and each two-spoke wedge. An individual spoke has four cells and is not a separate 1–8 group.',idea:'Eight symbols without eight thin radial layers. It trades some crossing constraints for roomier cells.'}),
    ring('split4','Two independent 1–4 halves',4,4,8,{split:2,rule:'Each half is its own 1–4 Ringdoku: half-rings, spokes and curved regions use 1–4 once. No group crosses the divider.',idea:'Exactly the two-simple-puzzles idea: more cells to fill, but two independent constraint components.'}),
    ring('linked4','Linked halves · 1–4',4,4,8,{split:2,linked:true,rule:'Use 1–4 once in each half-ring, spoke, curved region and selected bridge band. Bridge bands cross the two seams; tap a Bridge group to inspect it.',idea:'The halves exchange information through bridge bands. Keep four candidate slots while adding interlocking deductions.'}),
    ring('trinity4','Three linked sections · 1–4',4,4,12,{split:3,linked:true,rule:'Each third uses 1–4 in its ring segments, spokes and curved regions. Four-cell bridge bands cross all three seams.',idea:'A mandala-like 48-cell option. Four note slots stay manageable; inner angular slices still need a phone-width check.'}),
  ];
  const three=[circleShape(150,150,125),circleShape(270,150,125),circleShape(210,250,125)];three.forEach((s,i)=>s.label=['Left circle','Right circle','Lower circle'][i]);
  const tripleLayout=n=>({exclusive:n-3,pairs:[3,5,6],hub:true});
  models.push(overlap('venn6','Venndoku · three circles / 1–6',6,three,tripleLayout(6),{rule:'Each large circle contains 1–6 once. A cell belongs to every shape containing its center.',idea:'The original overlap structure, now with varied uniquely solvable clue masks.'}));
  models.push(overlap('venn8','Venndoku · three circles / 1–8',8,three,tripleLayout(8),{rule:'Each large circle contains 1–8 once. A cell belongs to every shape containing its center.',idea:'Five exclusive cells per circle add capacity, but four of each five must be given to avoid interchangeable blank positions.'}));
  const four=[circleShape(150,150,110),circleShape(270,150,110),circleShape(270,270,110),circleShape(150,270,110)];four.forEach((s,i)=>s.label='Circle '+(i+1));
  models.push(overlap('clover4','Four-circle clover · 1–4',4,four,{exclusive:1,pairs:[3,6,12,9],hub:true},{rule:'Each of the four large circles contains 1–4 once. The center belongs to all four circles.',idea:'One exclusive cell per circle; extra shared groups rather than extra symbols.'}));
  models.push(overlap('mesh6','Four-circle mesh · 1–6',6,four,{exclusive:1,pairs:[3,6,12,9],triples:[7,14,13,11],hub:false},{rule:'Each large circle contains 1–6 once. Some cells belong to three circles. The central all-four area has no cell.',idea:'Twelve highly shared cells. Stronger coupling without filling the board with exclusive cells; triple intersections can be visually tight.'}));
  const petals=Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;return {...circleShape(210+83*Math.cos(a),210+83*Math.sin(a),104),label:'Petal '+(i+1)};});
  models.push(overlap('petals4','Five-petal mandala · 1–4',4,petals,{exclusive:1,pairs:[3,6,12,24,17],hub:true},{rule:'Each petal circle contains 1–4 once. Neighboring petals share a cell, and the center belongs to all five.',idea:'Eleven cells, five overlapping groups and four candidate slots. Explore more interlock before increasing the symbol range.'}));
  const ovalShapes=three.map(s=>({type:'ellipse',x:s.x,y:210+(s.y-210)*.72,rx:s.r,ry:s.r*.72,label:s.label.replace('circle','oval')}));
  models.push(overlap('ovals6','Three ovals · 1–6',6,ovalShapes,tripleLayout(6),{equivalent:'venn6',rule:'Each large oval contains 1–6 once. Shared cells count in every containing oval.',idea:'Same memberships as the three-circle model. Changing the outline alone does not create a harder logical puzzle.'}));
  const triangles=[{type:'polygon',vertices:[[145,10],[5,265],[285,265]],label:'Left triangle'},{type:'polygon',vertices:[[275,10],[135,265],[415,265]],label:'Right triangle'},{type:'polygon',vertices:[[210,410],[35,195],[385,195]],label:'Lower triangle'}];
  models.push(overlap('triangles6','Three triangles · 1–6',6,triangles,tripleLayout(6),{equivalent:'venn6',rule:'Each large triangle contains 1–6 once. Shared cells count in every triangle containing their center.',idea:'Same group structure as the three-circle example. Pointed boundaries make some intersections narrower; this is a geometry comparison, not a new difficulty tier.'}));
  for(const d of models) {
    if(conflicts(d,d.solution).length||d.groups.some(g=>g.cells.length!==d.size))throw Error('Invalid model '+d.id);
    const signatures=new Map();d.membership.forEach((gs,i)=>{const k=gs.join(',');if(!signatures.has(k))signatures.set(k,[]);signatures.get(k).push(i);});
    d.clueFloor=[...signatures.values()].reduce((n,cells)=>n+Math.max(0,cells.length-1),0);
    const seen=new Set();let components=0;
    for(let i=0;i<d.cells.length;i++)if(!seen.has(i)){components++;const stack=[i];seen.add(i);while(stack.length)for(const j of d.peers[stack.pop()])if(!seen.has(j)){seen.add(j);stack.push(j);}}
    d.components=components;
  }
  return models;
}
