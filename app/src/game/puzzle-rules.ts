import { candidates, completedUnits, conflicts, GRID_SYMBOLS, peers, type Puzzle } from './engine.js';
import { ringCandidates, ringConflicts, ringLayoutForSeed, ringPeers } from './ringdoku.js';

export function puzzleRing(puzzle: Pick<Puzzle, 'variant' | 'seed'>) {
  return puzzle.variant === 'ring' ? ringLayoutForSeed(puzzle.seed) : undefined;
}

export function puzzleSymbols(puzzle: Pick<Puzzle, 'variant' | 'seed'>) {
  return puzzleRing(puzzle)?.symbols ?? GRID_SYMBOLS;
}

export function puzzleCandidates(puzzle: Puzzle, values: number[], cell: number) {
  const ring = puzzleRing(puzzle);
  return ring ? ringCandidates(ring, values, cell) : candidates(values, puzzle.regions, cell);
}

export function puzzlePeers(puzzle: Puzzle, cell: number) {
  const ring = puzzleRing(puzzle);
  return ring ? ringPeers(ring, cell) : peers(puzzle.regions, cell);
}

export function puzzleConflicts(puzzle: Puzzle, values: number[]) {
  const ring = puzzleRing(puzzle);
  return ring ? ringConflicts(ring, values) : conflicts(values, puzzle.regions);
}

export function puzzleCompletedGroups(puzzle: Puzzle, values: number[]) {
  const ring = puzzleRing(puzzle);
  if (!ring) return completedUnits(values, puzzle.regions);
  return ring.groups.flatMap(({ cells }) => {
    const entries = cells.map(i => values[i]);
    return entries.every(n => ring.symbols.includes(n)) && new Set(entries).size === cells.length ? [cells] : [];
  });
}
