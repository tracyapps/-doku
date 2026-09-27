import test from 'node:test'; import assert from 'node:assert/strict';
import { dailyPuzzle, dailyVariant, parseDailySeed, addDays, DAILY_LEVELS } from '../src/game/daily.ts';
import { consistency, periodStart, periodEnd } from '../src/game/consistency.ts';
import { evaluate, ACHIEVEMENTS } from '../src/game/achievements.ts';
import type { PlayRecord } from '../src/game/records.ts';

let n = 0;
const rec = (p: Partial<PlayRecord> & { day: string; hour?: number }): PlayRecord => ({
  id: `r${n++}`, kind: 'daily', daily: p.day, seed: `daily:${p.day}:easy`, variant: 'classic', difficulty: 'easy',
  seconds: 300, accuracy: 90, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false,
  startedAt: `${p.day}T${String(p.hour ?? 12).padStart(2, '0')}:00:00.000Z`,
  completedAt: `${p.day}T${String(p.hour ?? 12).padStart(2, '0')}:10:00.000Z`,
  localDate: p.day, startHour: p.hour ?? 12, ...p,
});
const ids = (records: PlayRecord[], today: string) => evaluate({ records, today }).map((a) => a.key);

test('daily puzzles: same for a date, different per level, rotation by weekday', () => {
  const day = '2026-09-26';
  assert.deepEqual(dailyPuzzle(day, 'easy').givens, dailyPuzzle(day, 'easy').givens);
  const sets = DAILY_LEVELS.map((l) => dailyPuzzle(day, l).solution.join(''));
  assert.notEqual(sets[0], sets[1]);
  assert.equal(dailyVariant('2026-09-29'), 'hue');    // Tuesday
  assert.equal(dailyVariant('2026-10-01'), 'jigsaw'); // Thursday
  assert.deepEqual(parseDailySeed('daily:2026-09-26:hard'), { date: '2026-09-26', level: 'hard' });
  assert.equal(parseDailySeed('abc'), null);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('periods: weeks start Monday; month and year bounds', () => {
  assert.equal(periodStart('week', '2026-09-26'), '2026-09-21');
  assert.equal(periodEnd('week', '2026-09-26'), '2026-09-27');
  assert.equal(periodEnd('month', '2026-02-10'), '2026-02-28');
  assert.equal(periodStart('year', '2026-09-26'), '2026-01-01');
});

test('consistency counts days played so far, not streaks', () => {
  const records = ['2026-09-01', '2026-09-02', '2026-09-04'].map((day) => rec({ day }));
  const c = consistency(records, 'month', '2026-09-04');
  assert.deepEqual([c.played, c.elapsed, c.percent, c.total], [3, 4, 75, 30]);
  // two levels on one day still count as one day
  const c2 = consistency([...records, rec({ day: '2026-09-04', difficulty: 'hard' })], 'month', '2026-09-04');
  assert.equal(c2.played, 3);
  // days before the first daily don't count against you
  const late = consistency([rec({ day: '2026-09-20' })], 'year', '2026-09-21');
  assert.deepEqual([late.played, late.elapsed, late.percent], [1, 2, 50]);
});

test('perfect month and week are earned once the period is complete, per period', () => {
  const sept = Array.from({ length: 30 }, (_, i) => rec({ day: `2026-09-${String(i + 1).padStart(2, '0')}` }));
  assert.ok(!ids(sept.slice(0, 29), '2026-09-29').includes('perfect-month:2026-09'));
  assert.ok(ids(sept, '2026-09-30').includes('perfect-month:2026-09'));
  assert.ok(ids(sept, '2026-10-05').includes('perfect-week:2026-09-21'));
  // missing one day breaks only that month; nothing "resets"
  const gap = sept.filter((r) => r.daily !== '2026-09-15');
  const keys = ids(gap, '2026-10-01');
  assert.ok(!keys.includes('perfect-month:2026-09'));
  assert.ok(keys.includes('perfect-week:2026-09-21'));
});

test('time, return, skill, and variety achievements', () => {
  const early = Array.from({ length: 10 }, (_, i) => rec({ day: `2026-08-${String(i + 1).padStart(2, '0')}`, hour: 6 }));
  assert.ok(ids(early, '2026-08-10').includes('early-puzzler'));
  assert.ok(!ids(early.slice(0, 9), '2026-08-10').includes('early-puzzler'));
  const back = [rec({ day: '2026-06-01' }), rec({ day: '2026-07-15' })];
  assert.ok(ids(back, '2026-07-15').includes('back-from-the-dead:2026-07-15'));
  const skill = [rec({ day: '2026-09-01', difficulty: 'hard', assisted: false, accuracy: 100 })];
  assert.ok(ids(skill, '2026-09-01').includes('no-help-hard'));
  assert.ok(ids(skill, '2026-09-01').includes('sharpshooter'));
  const variety = (['classic', 'hue', 'jigsaw'] as const).map((variant, i) => rec({ day: `2026-09-0${i + 1}`, variant }));
  assert.ok(ids(variety, '2026-09-03').includes('well-rounded'));
});

test('every achievement has a unique id and returns sane awards on empty history', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  assert.deepEqual(evaluate({ records: [], today: '2026-09-26' }), []);
});
