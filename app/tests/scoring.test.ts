import test from 'node:test'; import assert from 'node:assert/strict';
import { components, points, boardRow, rank, PAR_SECONDS } from '../src/game/scoring.ts';
import type { PlayRecord } from '../src/game/records.ts';

const rec = (p: Partial<PlayRecord>): PlayRecord => ({
  id: Math.random().toString(36), kind: 'daily', daily: '2026-09-26', seed: 's', variant: 'classic', difficulty: 'easy',
  seconds: PAR_SECONDS.classic.easy, accuracy: 100, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false,
  startedAt: '2026-09-26T12:00:00Z', completedAt: '2026-09-26T12:06:00Z', localDate: '2026-09-26', startHour: 12, ...p,
});

test('components are bounded 0–1; par = 0.5 speed; assistance lowers independence', () => {
  const c = components(rec({}));
  assert.equal(c.speed, 0.5); assert.equal(c.accuracy, 1); assert.equal(c.independence, 1);
  assert.ok(components(rec({ seconds: 60 })).speed > 0.8);
  assert.ok(components(rec({ seconds: 5000 })).speed > 0);
  assert.ok(components(rec({ assisted: true, hints: 2 })).independence <= 0.8);
  assert.equal(components(rec({ assisted: true, reveals: 10 })).independence, 0);
});

test('points = level base × average of enabled components; any mix works', () => {
  assert.equal(points(rec({ difficulty: 'hard', seconds: PAR_SECONDS.classic.hard })), Math.round(300 * (0.5 + 1 + 1) / 3));
  assert.equal(points(rec({}), ['accuracy']), 100);
  assert.equal(points(rec({}), ['speed']), 50);
  assert.equal(points(rec({}), []), 0);
});

test('board rows count dailies only, per period; ranking by any view', () => {
  const mine = [rec({}), rec({ difficulty: 'hard' }), rec({ kind: 'free', daily: undefined }), rec({ daily: '2026-08-01' })];
  const row = boardRow(mine, 'month', '2026-09-26');
  assert.equal(row.dailies, 2); assert.equal(row.days, 1);
  assert.equal(boardRow(mine, 'all', '2026-09-26').dailies, 3);
  const a = { name: 'a', row }, b = { name: 'b', row: { ...row, points: row.points + 1, accuracy: 0 } };
  assert.equal(rank([a, b])[0].name, 'b');
  assert.equal(rank([a, b], 'accuracy')[0].name, 'a');
});
