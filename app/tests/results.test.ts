import test from 'node:test'; import assert from 'node:assert/strict';
import { tracksFor, trackBest, trackPercent, shareText, radarAxes, achievements, type Player } from '../src/results/model.ts';
import { parReport } from '../server/social.ts';
import { PAR_SECONDS } from '../src/game/scoring.ts';

const p = (o: Partial<Player>): Player => ({ id: Math.random().toString(36), name: 'P', you: false, variant: 'classic', difficulty: 'easy', seconds: 300, accuracy: 100, evaluated: 40, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false, completedAt: '2026-09-26T12:00:00Z', ...o });

test('tracks run lowest → highest; the best end depends on the track', () => {
  const g = [p({ name: 'You', you: true, seconds: 200, accuracy: 90 }), p({ name: 'Mira', seconds: 100, accuracy: 100, hints: 2 })];
  const { tracks, timeWithheld } = tracksFor(g);
  assert.equal(timeWithheld, false);
  const time = tracks.find((t) => t.key === 'time')!, acc = tracks.find((t) => t.key === 'accuracy')!;
  assert.equal(time.lowIsBest, true); assert.equal(acc.lowIsBest, false);
  assert.ok(trackPercent(time, 100) < trackPercent(time, 200)); // faster sits left
  assert.equal(trackBest(time, g)[0].name, 'Mira');
  assert.equal(trackBest(acc, g)[0].name, 'Mira');
  assert.equal(time.mark?.value, PAR_SECONDS.classic.easy);
  assert.equal(tracksFor([g[0], p({ difficulty: 'hard' })]).timeWithheld, true);
});

test('radar drops speed for a lone solve; tape text is spoiler-free', () => {
  assert.equal(radarAxes([p({})]).some((a) => a.key === 'speed'), false);
  assert.equal(radarAxes([p({}), p({ seconds: 100 })]).some((a) => a.key === 'speed'), true);
  assert.equal(shareText(p({ seconds: 169 })), '*doku · sudoku · easy · 02:49\n██████████ 100% · hints 0 · checks 0 · unassisted');
  assert.deepEqual(achievements([p({ name: 'A', seconds: 100 }), p({ name: 'B', assisted: true })]).map((a) => a.title), ['Fastest solve', 'Sharpest solve', 'Unassisted finish']);
});

test('par report waits for enough plays, then suggests a new par', () => {
  const rec = (seconds: number) => ({ id: 'x', kind: 'daily' as const, daily: '2026-09-26', seed: 's', variant: 'classic' as const, difficulty: 'easy' as const, seconds, accuracy: 100, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false, startedAt: '', completedAt: '', localDate: '2026-09-26', startHour: 1 });
  const few = parReport(Array.from({ length: 5 }, () => rec(600))).lines[0];
  assert.equal(few.status, 'not-enough-data');
  const slow = parReport(Array.from({ length: 40 }, () => rec(600))).lines[0];
  assert.deepEqual([slow.status, slow.suggestedPar, slow.medianSpeedScore], ['par-too-fast', 600, 38]);
  const ok = parReport(Array.from({ length: 40 }, () => rec(PAR_SECONDS.classic.easy))).lines[0];
  assert.equal(ok.status, 'ok');
});
