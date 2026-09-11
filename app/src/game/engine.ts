export type Variant = 'classic' | 'hue' | 'jigsaw';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Puzzle = {
  id: string; seed: string; variant: Variant; difficulty: Difficulty;
  givens: number[]; solution: number[]; regions: number[]; rating: string;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BASE = [4,9,8,3,2,1,6,5,7,3,6,5,7,9,8,2,4,1,1,2,7,4,5,6,8,3,9,2,4,6,8,1,9,3,7,5,5,7,1,6,3,2,4,9,8,9,8,3,5,4,7,1,6,2,7,5,4,2,8,3,9,1,6,8,3,9,1,6,5,7,2,4,6,1,2,9,7,4,5,8,3];
// A curated irregular partition: nine connected nine-cell regions, each with 1–9.
const JIGSAW = [0,0,0,1,1,1,2,2,2,0,0,0,0,1,4,2,2,2,0,0,1,1,1,4,2,2,2,3,3,1,1,4,4,5,5,5,3,3,3,3,4,4,5,8,5,3,3,3,4,4,4,5,8,5,6,6,6,7,7,7,5,8,5,6,6,7,7,7,7,8,8,8,6,6,6,6,7,7,8,8,8];

function random(seed: string) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function peers(regions: number[], index: number): number[] {
  return regions.flatMap((region, i) => i !== index &&
    (Math.floor(i / 9) === Math.floor(index / 9) || i % 9 === index % 9 || region === regions[index]) ? [i] : []);
}

export function candidates(values: number[], regions: number[], index: number): number[] {
  if (values[index]) return [];
  const used = new Set(peers(regions, index).map(i => values[i]));
  return DIGITS.filter(n => !used.has(n));
}

function units(regions: number[]): number[][] {
  return [
    ...DIGITS.map((_, row) => DIGITS.map((_, col) => row * 9 + col)),
    ...DIGITS.map((_, col) => DIGITS.map((_, row) => row * 9 + col)),
    ...DIGITS.map((_, region) => regions.flatMap((r, i) => r === region ? [i] : [])),
  ];
}

export function completedUnits(values: number[], regions: number[]): number[][] {
  return units(regions).filter(unit => unit.length === 9 && unit.every(i => values[i] >= 1 && values[i] <= 9) && new Set(unit.map(i => values[i])).size === 9);
}

export function conflicts(values: number[], regions: number[]): number[] {
  return values.flatMap((n, i) => n && peers(regions, i).some(j => values[j] === n) ? [i] : []);
}

/** Counts valid completions without changing the caller's board. Stops at limit. */
export function countSolutions(values: number[], regions: number[], limit = 2): number {
  if (values.length !== 81 || regions.length !== 81 || limit < 1) return 0;
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const remaining: number[] = [];
  for (let i = 0; i < 81; i++) {
    const n = values[i], r = Math.floor(i / 9), c = i % 9, b = regions[i];
    if (!Number.isInteger(n) || n < 0 || n > 9 || !Number.isInteger(b) || b < 0 || b > 8) return 0;
    if (!n) { remaining.push(i); continue; }
    const bit = 1 << (n - 1);
    if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let total = 0;
  function search(depth: number) {
    if (depth === remaining.length) { total++; return; }
    let best = depth, mask = 0, smallest = 10;
    for (let k = depth; k < remaining.length; k++) {
      const i = remaining[k];
      const available = 511 & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[regions[i]]);
      let bits = available, size = 0;
      while (bits) { bits &= bits - 1; size++; }
      if (size === 0) return;
      if (size < smallest) { best = k; mask = available; smallest = size; }
      if (size === 1) break;
    }
    [remaining[depth], remaining[best]] = [remaining[best], remaining[depth]];
    const i = remaining[depth], r = Math.floor(i / 9), c = i % 9, b = regions[i];
    while (mask && total < limit) {
      const bit = mask & -mask; mask &= mask - 1;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      search(depth + 1);
      rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
    }
    [remaining[depth], remaining[best]] = [remaining[best], remaining[depth]];
  }
  search(0);
  return total;
}

/** Levels currently describe clue density, not a calibrated human technique rating. */
export function createPuzzle(seed: string, variant: Variant, difficulty: Difficulty): Puzzle {
  const rng = random(seed);
  const symbols = shuffle(DIGITS, rng);
  const turns = Math.floor(rng() * 4), reflect = rng() < 0.5;
  const sourceRegions = variant === 'jigsaw' ? JIGSAW : BASE.map((_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
  const solution = Array<number>(81), regions = Array<number>(81);
  for (let i = 0; i < 81; i++) {
    let r = Math.floor(i / 9), c = i % 9;
    if (reflect) c = 8 - c;
    for (let t = 0; t < turns; t++) [r, c] = [c, 8 - r];
    solution[r * 9 + c] = symbols[BASE[i] - 1];
    regions[r * 9 + c] = sourceRegions[i];
  }
  const givens = [...solution];
  const target = { easy: 43, medium: 35, hard: 29 }[difficulty];
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, n) => n), rng)) {
    const previous = givens[i]; givens[i] = 0;
    if (countSolutions(givens, regions) === 1) clues--;
    else givens[i] = previous;
    if (clues <= target) break;
  }
  return { id: `v1:${variant}:${difficulty}:${encodeURIComponent(seed)}`, seed, variant, difficulty, givens, solution, regions,
    rating: `${clues} clues · approximate ${difficulty} (clue density; technique rating pending)` };
}
