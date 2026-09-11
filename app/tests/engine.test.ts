import test from 'node:test';
import assert from 'node:assert/strict';
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
