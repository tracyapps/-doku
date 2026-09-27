// Leaderboard scoring. Every finished daily gets a few 0–1 "components";
// a score is simply the level's base points × the average of whichever
// components are switched on. Because it's a plain average, ANY mix of
// components can be ranked (the server can store per-component sums per
// player and combine them on request).
//
// Only daily puzzles count toward leaderboards: everyone plays the same
// three puzzles a day, so nobody can farm points with endless easy games,
// and showing up more days naturally earns more (capped at 3 a day).
import type { Difficulty, Variant } from './engine.js';
import { consistency, type Period, periodStart, periodEnd } from './consistency.js';
import type { PlayRecord } from './records.js';

export type Component = 'speed' | 'accuracy' | 'independence';
export const COMPONENTS: Component[] = ['speed', 'accuracy', 'independence'];

export const LEVEL_POINTS: Record<Difficulty, number> = { easy: 100, medium: 200, hard: 300 };

// "Par" solve times in seconds. Finishing at par scores 0.5 speed; faster
// approaches 1, slower eases toward 0 without ever going negative.
// Tune these once real play data exists (or replace with daily percentiles).
export const PAR_SECONDS: Record<Variant, Record<Difficulty, number>> = {
  classic: { easy: 360, medium: 720, hard: 1200 },
  hue: { easy: 420, medium: 840, hard: 1380 },
  jigsaw: { easy: 420, medium: 840, hard: 1380 },
};

export function components(r: PlayRecord): Record<Component, number> {
  const par = PAR_SECONDS[r.variant][r.difficulty];
  const speed = par / (par + Math.max(r.seconds, 1));
  const accuracy = (r.accuracy ?? 0) / 100;
  const penalty = 0.1 * r.hints + 0.05 * r.checks + 0.2 * r.reveals + 0.15 * r.autofills;
  const independence = r.assisted ? Math.max(0, Math.min(0.8, 1 - penalty)) : 1;
  return { speed, accuracy, independence };
}

/** Points for one daily, using the enabled components (all by default). */
export function points(r: PlayRecord, enabled: Component[] = COMPONENTS): number {
  if (!enabled.length) return 0;
  const c = components(r);
  const quality = enabled.reduce((sum, k) => sum + c[k], 0) / enabled.length;
  return Math.round(LEVEL_POINTS[r.difficulty] * quality);
}

export type BoardRow = {
  points: number;        // the default "*doku score" (or the custom mix)
  dailies: number;       // dailies finished in the period
  days: number;          // days with at least one daily
  consistency: number;   // % of days played (from the player's first daily)
  speed: number;         // averages, 0–100
  accuracy: number;
  independence: number;
  bestSeconds: Partial<Record<Difficulty, number>>; // fastest per level
};

/** One player's row for a period (week / month / year / all time). */
export function boardRow(
  records: PlayRecord[],
  period: Period | 'all',
  today: string,
  enabled: Component[] = COMPONENTS,
): BoardRow {
  const inPeriod = records.filter((r) => {
    if (r.kind !== 'daily' || !r.daily) return false;
    if (period === 'all') return r.daily <= today;
    return r.daily >= periodStart(period, today) && r.daily <= periodEnd(period, today);
  });
  const avg = (k: Component) =>
    inPeriod.length ? Math.round((inPeriod.reduce((s, r) => s + components(r)[k], 0) / inPeriod.length) * 100) : 0;
  const bestSeconds: BoardRow['bestSeconds'] = {};
  for (const r of inPeriod) {
    const prev = bestSeconds[r.difficulty];
    if (prev === undefined || r.seconds < prev) bestSeconds[r.difficulty] = r.seconds;
  }
  return {
    points: inPeriod.reduce((s, r) => s + points(r, enabled), 0),
    dailies: inPeriod.length,
    days: new Set(inPeriod.map((r) => r.daily)).size,
    consistency: period === 'all' ? 0 : consistency(records, period, today).percent,
    speed: avg('speed'),
    accuracy: avg('accuracy'),
    independence: avg('independence'),
    bestSeconds,
  };
}

/** Views a leaderboard can sort by. 'points' is the default. */
export type BoardView = 'points' | 'consistency' | 'speed' | 'accuracy' | 'independence';

export function rank<T extends { row: BoardRow }>(players: T[], view: BoardView = 'points'): T[] {
  return [...players].sort(
    (a, b) => b.row[view] - a.row[view] || b.row.dailies - a.row.dailies,
  );
}
