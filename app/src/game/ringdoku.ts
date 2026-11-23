import { random, shuffle } from './random.js';

export type RingGroupKind = 'ring' | 'spoke' | 'region' | 'bridge';

export type RingGroup = {
  kind: RingGroupKind;
  label: string;
  cells: number[];
  firstRing: number;
  ringCount: number;
  firstSpoke: number;
  spokeCount: number;
};

type RingRules = {
  symbols: readonly number[];
  rings: number;
  divisions: number;
  spokesPerDivision: number;
  regionRings: number;
  regionSpokes: number;
  bridgeOffset: number;
  inner: number;
  outer: number;
};

export type RingLayout = RingRules & {
  version: string;
  spokes: number;
  groups: RingGroup[];
  memberships: RingGroup[][];
};

export function defineRingLayout(version: string, rules: RingRules): RingLayout {
  const { rings, divisions, spokesPerDivision, regionRings, regionSpokes, bridgeOffset, symbols } = rules;
  const spokes = divisions * spokesPerDivision;
  const wrap = (spoke: number) => (spoke + spokes) % spokes;
  if (
    ![rings, divisions, spokesPerDivision, regionRings, regionSpokes].every(n => Number.isInteger(n) && n > 0) ||
    rings % regionRings || spokesPerDivision % regionSpokes ||
    !Number.isInteger(bridgeOffset) || bridgeOffset < 0 || bridgeOffset >= spokesPerDivision ||
    (bridgeOffset > 0 && divisions < 2) ||
    new Set(symbols).size !== symbols.length || !symbols.every(n => Number.isInteger(n) && n >= 1 && n <= 9) ||
    Math.max(rings, spokesPerDivision, regionRings * regionSpokes) > symbols.length ||
    rules.inner <= 0 || rules.outer <= rules.inner
  ) throw Error('Invalid Ringdoku rules');

  const groups: RingGroup[] = [];
  const memberships: RingGroup[][] = Array.from({ length: rings * spokes }, () => []);

  function add(kind: RingGroupKind, label: string, firstRing: number, ringCount: number, start: number, spokeCount: number) {
    const firstSpoke = wrap(start);
    const cells = Array.from({ length: ringCount * spokeCount }, (_, i) =>
      (firstRing + Math.floor(i / spokeCount)) * spokes + wrap(firstSpoke + i % spokeCount),
    );
    const group = { kind, label, cells, firstRing, ringCount, firstSpoke, spokeCount };
    groups.push(group);
    for (const cell of cells) memberships[cell].push(group);
  }

  for (let section = 0; section < divisions; section++) {
    const start = section * spokesPerDivision;
    for (let ring = 0; ring < rings; ring++) {
      add('ring', `Ring ${ring + 1} · wedge ${section + 1}`, ring, 1, start, spokesPerDivision);
      if (bridgeOffset) add('bridge', `Ring ${ring + 1} · shifted wedge ${section + 1}`, ring, 1, start - bridgeOffset, spokesPerDivision);
    }
    for (let spoke = start; spoke < start + spokesPerDivision; spoke++) {
      add('spoke', `Spoke ${spoke + 1}`, 0, rings, spoke, 1);
    }
    for (let ring = 0; ring < rings; ring += regionRings) {
      for (let spoke = start; spoke < start + spokesPerDivision; spoke += regionSpokes) {
        const number = (ring / regionRings) * (spokesPerDivision / regionSpokes) + (spoke - start) / regionSpokes + 1;
        add('region', `Curved region ${number} · wedge ${section + 1}`, ring, regionRings, spoke, regionSpokes);
      }
    }
  }

  return { ...rules, version, spokes, groups, memberships };
}

// Keep released layouts addressable by version. To change the puzzle rules or
// generation, add a new version and point the new-game picker at it.
export const linkedThirds = defineRingLayout('ring-v1', {
  symbols: [1, 2, 3, 4],
  rings: 4,
  divisions: 3,
  spokesPerDivision: 4,
  regionRings: 2,
  regionSpokes: 2,
  bridgeOffset: 2,
  inner: 54,
  outer: 198,
});
const layouts: Record<string, RingLayout> = { [linkedThirds.version]: linkedThirds };
export const ringLayoutVersions = Object.keys(layouts);

export const ringToSeed = (seed: string) => `${linkedThirds.version}:${seed}`;
export function ringLayoutForSeed(seed: string): RingLayout | undefined {
  const version = seed.split(':', 1)[0];
  return seed.length > version.length + 1 && Object.hasOwn(layouts, version) ? layouts[version] : undefined;
}
export function ringCellLabel(layout: RingLayout, cell: number) {
  return `Ring ${Math.floor(cell / layout.spokes) + 1}, spoke ${cell % layout.spokes + 1}`;
}

export function ringPeers(layout: RingLayout, cell: number) {
  return [...new Set(layout.memberships[cell].flatMap(group => group.cells))].filter(index => index !== cell);
}

export function ringCandidates(layout: RingLayout, values: number[], cell: number) {
  if (values[cell]) return [];
  const used = new Set(ringPeers(layout, cell).map(index => values[index]));
  return layout.symbols.filter(value => !used.has(value));
}

export function ringConflicts(layout: RingLayout, values: number[]) {
  return values.flatMap((value, index) =>
    value && ringPeers(layout, index).some(peer => values[peer] === value) ? [index] : [],
  );
}

// Search the overlapping all-different groups directly, with the most
// constrained blank first. Stop at two solutions when checking clue removal.
export function solveRing(layout: RingLayout, givens: number[], limit = 2, order?: readonly (readonly number[])[]) {
  const { symbols, memberships } = layout;
  const board = [...givens];
  let count = 0;
  let solution: number[] | undefined;
  if (limit < 1 || board.length !== memberships.length || board.some(n => n !== 0 && !symbols.includes(n))) return { count, solution };
  const peers = memberships.map((_, i) => ringPeers(layout, i));
  if (board.some((n, i) => n && peers[i].some(j => board[j] === n))) return { count, solution };

  function search() {
    let cell = -1;
    let options: readonly number[] = symbols;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const available = (order?.[i] ?? symbols).filter(n => !peers[i].some(j => board[j] === n));
      if (!available.length) return;
      if (cell < 0 || available.length < options.length) {
        cell = i;
        options = available;
        if (options.length === 1) break;
      }
    }
    if (cell < 0) {
      count++;
      solution ??= [...board];
      return;
    }
    for (const n of options) {
      board[cell] = n;
      search();
      if (count >= limit) break;
    }
    board[cell] = 0;
  }

  search();
  return { count, solution };
}

export function generateRing(layout: RingLayout, seed: string, clueFraction: number) {
  const rng = random(seed);
  const indices = layout.memberships.map((_, i) => i);
  const order = indices.map(() => shuffle([...layout.symbols], rng));
  const solution = solveRing(layout, indices.map(() => 0), 1, order).solution;
  if (!solution) throw Error('These Ringdoku rules have no solution.');
  const givens = [...solution];
  const target = Math.round(givens.length * clueFraction);
  let clues = givens.length;
  for (const cell of shuffle(indices, rng)) {
    if (clues <= target) break;
    givens[cell] = 0;
    if (solveRing(layout, givens).count === 1) clues--;
    else givens[cell] = solution[cell];
  }
  return { solution, givens, clues };
}
