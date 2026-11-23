import test from 'node:test';
import assert from 'node:assert/strict';
import { defineRingLayout, generateRing, linkedThirds, ringToSeed, solveRing } from '../src/game/ringdoku.ts';
import { puzzleCandidates, puzzleConflicts, puzzleCompletedGroups } from '../src/game/puzzle-rules.ts';
import { createPuzzle, countSolutions, candidates, peers, conflicts, completedUnits, type Variant } from '../src/game/engine.ts';

test('seeded puzzle families have unique solutions and nested clue masks across levels', () => {
  for (const variant of ['classic', 'hue', 'jigsaw'] as Variant[]) {
    for (const seed of ['friends', 'another challenge', '42', '🌟']) {
      const levels = (['easy', 'medium', 'hard'] as const).map(level => createPuzzle(seed, variant, level));
      for (const puzzle of levels) {
        assert.equal(countSolutions(puzzle.givens, puzzle.regions), 1);
        assert.equal(completedUnits(puzzle.solution, puzzle.regions).length, 27);
        assert.deepEqual(conflicts(puzzle.solution, puzzle.regions), []);
        assert.deepEqual(puzzle, createPuzzle(seed, variant, puzzle.difficulty));
        assert.deepEqual(puzzle.solution, levels[0].solution);
        assert.deepEqual(puzzle.regions, levels[0].regions);
        assert.match(puzzle.rating, /approximate/);
      }
      for (let i = 0; i < 81; i++) {
        if (levels[2].givens[i]) assert.equal(levels[2].givens[i], levels[1].givens[i]);
        if (levels[1].givens[i]) assert.equal(levels[1].givens[i], levels[0].givens[i]);
      }
    }
  }
});

test('jigsaw has nine connected, genuinely irregular regions', () => {
  const { regions } = createPuzzle('shape', 'jigsaw', 'easy');
  let irregular = 0;
  for (let region = 0; region < 9; region++) {
    const cells = regions.flatMap((r, i) => r === region ? [i] : []);
    assert.equal(cells.length, 9);
    const seen = new Set([cells[0]]), stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of [i - 9, i + 9, i - 1, i + 1]) {
        if (j >= 0 && j < 81 && Math.abs(Math.floor(i / 9) - Math.floor(j / 9)) + Math.abs(i % 9 - j % 9) === 1 && regions[j] === region && !seen.has(j)) {
          seen.add(j); stack.push(j);
        }
      }
    }
    assert.equal(seen.size, 9);
    if (new Set(cells.map(i => Math.floor(i / 9))).size !== 3 || new Set(cells.map(i => i % 9)).size !== 3) irregular++;
  }
  assert.ok(irregular >= 4);
});

test('candidates, peers, conflicts and completion obey row/column/region rules', () => {
  for (const variant of ['classic', 'jigsaw'] as Variant[]) {
    const { solution, regions } = createPuzzle('rules', variant, 'easy');
    const values = [...solution]; values[0] = 0;
    assert.deepEqual(candidates(values, regions, 0), [solution[0]]);
    assert.deepEqual(candidates(values, regions, 1), []);
    assert.equal(completedUnits(values, regions).length, 24);
    assert.ok(!peers(regions, 0).includes(0));
    values[0] = values[1];
    assert.ok(conflicts(values, regions).includes(0));
    assert.ok(conflicts(values, regions).includes(1));
    assert.equal(countSolutions(values, regions), 0);
  }
});

test('solver caps multiple solutions and never mutates input', () => {
  const { regions } = createPuzzle('limit', 'classic', 'easy');
  const empty = Array(81).fill(0);
  assert.equal(countSolutions(empty, regions, 2), 2);
  assert.deepEqual(empty, Array(81).fill(0));
  assert.equal(countSolutions([1], regions), 0);
});

test('linked thirds has the four playtest groups per cell, including the bridge across the top seam', () => {
  const { memberships, groups } = linkedThirds;
  assert.equal(memberships.length, 48);
  assert.equal(groups.length, 48);
  assert.ok(memberships.every(cellGroups => cellGroups.length === 4));
  assert.deepEqual(Object.fromEntries(memberships[0].map(g => [g.kind, g.cells])), {
    ring: [0, 1, 2, 3],
    bridge: [10, 11, 0, 1],
    spoke: [0, 12, 24, 36],
    region: [0, 1, 12, 13],
  });

  const puzzle = createPuzzle(ringToSeed('groups'), 'ring', 'medium');
  const board = puzzle.solution.map((n, i) => i === 0 ? 0 : n);
  assert.deepEqual(puzzleCandidates(puzzle, board, 0), [puzzle.solution[0]]);
  assert.equal(puzzleCompletedGroups(puzzle, board).length, 44);
  const bridgeConflict = board.map((_, i) => i === 0 || i === 11 || i === 5 ? 1 : 0);
  assert.deepEqual(puzzleConflicts(puzzle, bridgeConflict), [0, 11]);
});

test('seeded Ringdoku is deterministic, unique and uses nested clue masks at every level', () => {
  const solutions = new Set<string>();
  for (const id of ['test', 'test-2', 'links', '🌟']) {
    const seed = ringToSeed(id);
    const puzzles = (['easy', 'medium', 'hard'] as const).map(level => createPuzzle(seed, 'ring', level));
    solutions.add(puzzles[0].solution.join(''));
    for (const [i, p] of puzzles.entries()) {
      assert.deepEqual(p, createPuzzle(seed, 'ring', p.difficulty));
      assert.deepEqual(solveRing(linkedThirds, p.givens), { count: 1, solution: p.solution });
      assert.deepEqual(p.solution, puzzles[0].solution);
      if (i) {
        assert.ok(p.givens.filter(Boolean).length < puzzles[i - 1].givens.filter(Boolean).length);
        assert.ok(p.givens.every((n, j) => !n || n === puzzles[i - 1].givens[j]));
      }
    }
  }
  assert.ok(solutions.size > 1);
  assert.throws(() => createPuzzle('ring-v99:unsupported', 'ring', 'easy'), /layout version/);
});

test('changing the Ringdoku definition changes board shape and group membership', () => {
  const { symbols, rings, spokesPerDivision, regionRings, regionSpokes, bridgeOffset, inner, outer } = linkedThirds;
  for (const divisions of [2, 4]) {
    const layout = defineRingLayout('experiment', { symbols, rings, divisions, spokesPerDivision, regionRings, regionSpokes, bridgeOffset, inner, outer });
    const { givens, solution } = generateRing(layout, 'reconfigured', 0.35);
    assert.equal(givens.length, divisions * 16);
    assert.equal(solveRing(layout, givens).count, 1);
    assert.ok(layout.groups.every(group => new Set(group.cells.map(i => solution[i])).size === 4));
  }
  const shorter = defineRingLayout('experiment-2', {
    symbols: [2, 4, 6, 8], rings: 2, divisions: 3, spokesPerDivision: 4,
    regionRings: 2, regionSpokes: 2, bridgeOffset: 1, inner, outer,
  });
  const { givens, solution } = generateRing(shorter, 'values', 0.42);
  assert.equal(givens.length, 24);
  assert.deepEqual(new Set(solution), new Set([2, 4, 6, 8]));
  assert.equal(solveRing(shorter, givens).count, 1);
});
