import { writeFile } from 'node:fs/promises';
import { prepare, solve, exactCoverCount, humanSolve, rng, shuffle } from './circle-models.mjs';

const directions = [
  {
    id: 'crossings', title: 'Short and long ovals', size: 5, count: 20, groupCount: 8,
    idea: 'Short ovals cross longer horizontal and diagonal ones. A cell can belong to several groups, and each oval stops at its own boundary.',
  },
  {
    id: 'clusters', title: 'Linked clusters', size: 5, count: 24, groupCount: 10,
    idea: 'Two clusters share cells through diagonal ovals. A placement in one cluster can change the available symbols in the other.',
  },
  {
    id: 'uneven', title: 'Deep overlaps', size: 6, count: 27, groupCount: 12,
    idea: 'Wide ovals overlap shorter, steeper ovals. The busiest crossings connect several groups at once.',
  },
];

const symbols = size => Array.from({ length: size }, (_, i) => String(i + 1));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function level(shape, point) {
  const angle = shape.angle * Math.PI / 180;
  const dx = point.x - shape.x, dy = point.y - shape.y;
  const x = dx * Math.cos(angle) + dy * Math.sin(angle);
  const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.hypot(x / shape.rx, y / shape.ry);
}
function scatter(direction, random) {
  const cells = [];
  for (let attempt = 0; cells.length < direction.count && attempt < 10000; attempt++) {
    const x = Math.round(37 + random() * 346);
    const y = Math.round(38 + random() * 344);
    const point = { x, y };
    const cluster = direction.id === 'clusters';
    const inside = cluster
      ? Math.hypot((x - 123) / 104, (y - 145) / 123) < 1 ||
        Math.hypot((x - 295) / 100, (y - 268) / 119) < 1
      : Math.hypot((x - 210) / 178, (y - 210) / 181) < 1;
    if (inside && cells.every(c => distance(c, point) >= 35)) cells.push(point);
  }
  if (cells.length !== direction.count) throw Error('Could not space the circles for ' + direction.id);
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function possibleOutlines(cells, size, random) {
  const distinct = new Map();
  for (let i = 0; i < 65000; i++) {
    const shape = {
      type: 'ellipse',
      x: Math.round(60 + random() * 300),
      y: Math.round(60 + random() * 300),
      rx: Math.round(59 + random() * 103),
      ry: Math.round(29 + random() * 54),
      angle: [0, 20, 38, 57, 90, 119, 143, 161][Math.floor(random() * 8)],
    };
    if (shape.rx < shape.ry * 1.14) continue;
    const a = shape.angle * Math.PI / 180;
    const dx = Math.hypot(shape.rx * Math.cos(a), shape.ry * Math.sin(a));
    const dy = Math.hypot(shape.rx * Math.sin(a), shape.ry * Math.cos(a));
    if (shape.x - dx < 10 || shape.x + dx > 410 || shape.y - dy < 10 || shape.y + dy > 410) continue;
    const levels = cells.map(cell => level(shape, cell));
    const members = levels.flatMap((v, j) => v < 1 ? [j] : []);
    if (members.length !== size) continue;
    const clearance = Math.min(...levels.map(v => Math.abs(1 - v) * shape.ry));
    if (clearance < 4) continue;
    const key = members.join(',');
    if ((distinct.get(key)?.clearance ?? 0) < clearance) distinct.set(key, { shape, members, clearance });
  }
  return [...distinct.values()];
}

function chooseOutlines(direction, cells, pool, random) {
  const selected = [];
  const counts = cells.map(() => 0);
  const used = new Set();
  const angles = new Set();
  for (let g = 0; g < direction.groupCount; g++) {
    let best, score = -Infinity;
    for (const candidate of pool) {
      if (used.has(candidate)) continue;
      const { members, shape, clearance } = candidate;
      let grade = random() * 12 + clearance * .3;
      for (const c of members) grade += counts[c] === 0 ? 10 : counts[c] === 1 ? 4 : 1 - counts[c];
      for (const existing of selected) {
        const shared = existing.members.filter(c => members.includes(c)).length;
        grade += shared === 2 ? 1.6 : shared >= direction.size - 1 ? -3 : 0;
      }
      if (!angles.has(shape.angle)) grade += 3;
      if (grade > score) { score = grade; best = candidate; }
    }
    if (!best) return null;
    selected.push(best);
    used.add(best);
    angles.add(best.shape.angle);
    best.members.forEach(c => counts[c]++);
  }
  return counts.every(Boolean) && new Set(counts).size >= 3 && angles.size >= 4 ? selected : null;
}

function layout(direction) {
  const { id, size, title, idea } = direction;
  const random = rng(id);
  let best;
  for (let trial = 0; trial < 16; trial++) {
    const cells = scatter(direction, random);
    const pool = possibleOutlines(cells, size, random);
    if (pool.length < direction.groupCount) continue;
    for (let attempt = 0; attempt < 65; attempt++) {
      const outlines = chooseOutlines(direction, cells, pool, random);
      if (!outlines) continue;
      const shapes = outlines.map(({ shape }, i) => ({
        ...shape, label: 'Oval ' + String.fromCharCode(65 + i), family: i % 6,
      }));
      const groups = outlines.map(({ members }, i) => ({ name: shapes[i].label, cells: members }));
      const model = prepare({
        id, title, size, idea, cells, groups, geometry: { shapes }, nodeRadius: 15, symbols: symbols(size),
        rule: `Use 1–${size} once inside each oval. A circle counts in every oval that contains its center.`,
      });
      const seen = new Set([0]);
      for (const cell of seen) model.peers[cell].forEach(peer => seen.add(peer));
      if (seen.size !== cells.length) continue;
      const distinct = new Set(model.membership.map(g => g.join(','))).size;
      if (distinct < cells.length - 2) continue;
      const pairs = groups.flatMap((group, i) => groups.slice(i + 1).map(other =>
        group.cells.filter(c => other.cells.includes(c)).length));
      const score = distinct * 4 + pairs.filter(n => n === 2).length +
        outlines.reduce((sum, o) => sum + o.clearance, 0) * .12;
      if (best && score <= best.score) continue;
      const solution = solve(model, cells.map(() => 0), 1).solution;
      if (solution) best = { model, score, solution };
    }
  }
  if (!best) throw Error('No valid geometry found for ' + id);
  return best;
}

function samplesFor(model, initial) {
  const empty = Array(model.cells.length).fill(0);
  const pool = [];
  for (let trial = 0; trial < 180; trial++) {
    const random = rng(model.id + trial);
    const solution = trial ? solve(model, empty, 1, random).solution : initial;
    const givens = [...solution];
    for (const i of shuffle(givens.keys(), random)) {
      givens[i] = 0;
      if (solve(model, givens).count !== 1) givens[i] = solution[i];
    }
    const audit = humanSolve(model, givens);
    if (audit.solved) pool.push({ givens, solution, audit });
  }
  const rank = ({ audit }) => audit.counts.triple * 50 + audit.counts.pair * 20 + audit.counts.intersection * 10 + audit.counts.hidden;
  const stretch = pool.sort((a, b) => rank(b) - rank(a))[0];
  if (!stretch) throw Error('No sample completed by the explanation engine for ' + model.id);
  const guided = { solution: stretch.solution, givens: [...stretch.givens] };
  const blanks = shuffle(guided.givens.keys(), rng(model.id + '-guided')).filter(i => !guided.givens[i]);
  for (const cell of blanks.slice(0, Math.ceil(model.cells.length * .16))) guided.givens[cell] = guided.solution[cell];

  return [guided, stretch].map(({ givens, solution }, i) => {
    const checked = solve(model, givens);
    const independent = exactCoverCount(model, givens);
    const audit = humanSolve(model, givens);
    if (checked.count !== 1 || independent !== 1 || checked.solution.some((v, j) => v !== solution[j])) {
      throw Error('Solution counters disagree for ' + model.id);
    }
    return { id: model.id + '-' + i, model: model.id, profile: i ? 'Fewer clues' : 'More clues',
      givens, solution, unique: checked.count, independent, counts: audit.counts,
      logicSolved: audit.solved, remaining: audit.remaining };
  });
}

const models = [], samples = [];
for (const direction of directions) {
  const { model, solution } = layout(direction);
  model.groups.forEach((group, i) => {
    const geometric = model.cells.flatMap((cell, j) => level(model.geometry.shapes[i], cell) < 1 ? [j] : []);
    if (group.cells.length !== model.size || geometric.join() !== group.cells.join()) {
      throw Error('Outline membership mismatch for ' + group.name);
    }
  });
  const fixtures = samplesFor(model, solution);
  console.log(model.title, model.cells.length, 'cells, memberships', [...new Set(model.membership.map(x => x.length))].sort().join('/'),
    JSON.stringify(fixtures.map(s => ({ givens: s.givens.filter(Boolean).length, counts: s.counts }))));
  const { membership, peers, ...serializable } = model;
  models.push(serializable);
  samples.push(...fixtures);
}
await writeFile(new URL('venn-overlaps.json', import.meta.url), JSON.stringify({ models, samples }) + '\n');
