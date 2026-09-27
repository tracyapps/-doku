// A play record is the compact, permanent summary of one finished game.
// Consistency, achievements, profiles, and (later) leaderboards are all
// computed from these, on the device now and on the server once synced.
import type { Difficulty, Variant } from './engine.js';
import { dateKey, parseDailySeed } from './daily.js';
import { stats, type Session } from './session.js';

export type PlayKind = 'daily' | 'free' | 'challenge';

export type PlayRecord = {
  id: string;              // same as the session id
  kind: PlayKind;
  daily?: string;          // YYYY-MM-DD of the daily set, for kind 'daily'
  seed: string;
  variant: Variant;
  difficulty: Difficulty;
  seconds: number;         // active solve time
  accuracy: number | null; // first-entry accuracy %, like result cards
  hints: number;
  checks: number;
  reveals: number;
  autofills: number;
  assisted: boolean;
  startedAt: string;       // ISO
  completedAt: string;     // ISO
  localDate: string;       // player's calendar date at completion
  startHour: number;       // player's local hour (0–23) when they started
};

export function recordFromSession(s: Session): PlayRecord | null {
  if (!s.completedAt) return null;
  const daily = parseDailySeed(s.puzzle.seed);
  const st = stats(s);
  return {
    id: s.id,
    kind: daily ? 'daily' : s.challenge ? 'challenge' : 'free',
    ...(daily ? { daily: daily.date } : {}),
    seed: s.puzzle.seed,
    variant: s.puzzle.variant,
    difficulty: s.puzzle.difficulty,
    seconds: s.seconds,
    accuracy: st.accuracy,
    hints: st.hints,
    checks: st.checks,
    reveals: st.reveals,
    autofills: st.autofills,
    assisted: st.assisted,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    localDate: dateKey(new Date(s.completedAt)),
    startHour: new Date(s.startedAt).getHours(),
  };
}

/** Add a record once (by id), keeping the list ordered oldest → newest. */
export function addRecord(list: PlayRecord[], r: PlayRecord): PlayRecord[] {
  if (list.some((x) => x.id === r.id)) return list;
  return [...list, r].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/** Days (YYYY-MM-DD) on which at least one of that day's dailies was finished. */
export function dailyDays(records: PlayRecord[]): Set<string> {
  return new Set(records.flatMap((r) => (r.kind === 'daily' && r.daily ? [r.daily] : [])));
}

/** Levels finished for one day's set. */
export function dailyLevelsDone(records: PlayRecord[], day: string): Set<Difficulty> {
  return new Set(records.filter((r) => r.daily === day).map((r) => r.difficulty));
}
