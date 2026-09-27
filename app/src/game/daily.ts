// Today's puzzles: three separate puzzles per day (easy, medium, hard),
// seeded by the date + level so everyone gets the same set for a date.
import { createPuzzle, type Difficulty, type Puzzle, type Variant } from './engine.js';

export const DAILY_LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

// Which variant each weekday's set uses (0 = Sunday … 6 = Saturday).
// Edit freely; add new variants here as they ship.
export const DAILY_ROTATION: Variant[] = [
  'classic', // Sun
  'classic', // Mon
  'hue',     // Tue
  'classic', // Wed
  'jigsaw',  // Thu
  'classic', // Fri
  'hue',     // Sat
];

/** Local calendar date as YYYY-MM-DD (the player's own "today"). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD as a plain calendar date (UTC noon, so no DST drift). */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Shift a date key by n days. */
export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const dailyVariant = (key: string): Variant => DAILY_ROTATION[parseKey(key).getUTCDay()];
export const dailySeed = (key: string, level: Difficulty) => `daily:${key}:${level}`;
export const dailyPuzzle = (key: string, level: Difficulty): Puzzle =>
  createPuzzle(dailySeed(key, level), dailyVariant(key), level);

/** Is this seed one of the daily puzzles? Returns its date + level. */
export function parseDailySeed(seed: string): { date: string; level: Difficulty } | null {
  const m = /^daily:(\d{4}-\d{2}-\d{2}):(easy|medium|hard)$/.exec(seed);
  return m ? { date: m[1], level: m[2] as Difficulty } : null;
}
