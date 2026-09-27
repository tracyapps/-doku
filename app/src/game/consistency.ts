// "How often do I play?" — shown as a share of days, never as a streak.
// Missing a day doesn't reset anything; it's just one day of the period.
import { addDays, parseKey } from './daily.js';
import { dailyDays, type PlayRecord } from './records.js';

export type Period = 'week' | 'month' | 'year';

/** First day of the period containing `day`. Weeks start Monday. */
export function periodStart(period: Period, day: string): string {
  if (period === 'month') return `${day.slice(0, 7)}-01`;
  if (period === 'year') return `${day.slice(0, 4)}-01-01`;
  const weekday = (parseKey(day).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(day, -weekday);
}

/** Last day of the period containing `day`. */
export function periodEnd(period: Period, day: string): string {
  if (period === 'week') return addDays(periodStart('week', day), 6);
  if (period === 'year') return `${day.slice(0, 4)}-12-31`;
  const d = parseKey(periodStart('month', day));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Every date key from a to b inclusive. */
export function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export type Consistency = {
  period: Period;
  start: string;
  end: string;
  played: number;   // days with a daily finished so far
  elapsed: number;  // days of the period up to and including today
  total: number;    // days in the whole period
  percent: number;  // played / elapsed, whole number
  complete: boolean;// every day of a finished period was played
};

export function consistency(records: PlayRecord[], period: Period, today: string): Consistency {
  const start = periodStart(period, today), end = periodEnd(period, today);
  const days = dailyDays(records);
  // Only count days since the player's first daily, so someone who joins
  // in September isn't shown as "3% of the year".
  const first = [...days].sort()[0] ?? today;
  const soFar = daysBetween(first > start ? first : start, today);
  const played = soFar.filter((d) => days.has(d)).length;
  const total = daysBetween(start, end).length;
  return {
    period, start, end, played, elapsed: soFar.length, total,
    percent: Math.round((played / soFar.length) * 100),
    complete: played === total,
  };
}
