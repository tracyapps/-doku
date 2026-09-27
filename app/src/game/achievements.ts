// Achievements: a list of definitions, each a pure function over the
// player's play records. Awards are *derived* from history every time
// (nothing to migrate, new achievements count retroactively, and the
// server can run this same file once records sync).
//
// To add one: append a definition to ACHIEVEMENTS. That's it. Art goes in
// public/assets/badges/<id>.svg (or set `art`), and flip `draft` off once
// the name/art are final.
import type { Variant } from './engine.js';
import { addDays } from './daily.js';
import { periodEnd, periodStart, daysBetween } from './consistency.js';
import { dailyDays, type PlayRecord } from './records.js';

export type Category = 'milestone' | 'habit' | 'skill' | 'variety' | 'time' | 'return';

export type Award = {
  id: string;        // achievement id
  key: string;       // unique instance: id, or id:period for repeatables
  earnedAt: string;  // ISO time of the record that earned it (or period end)
  period?: string;   // e.g. "2026-09" for a perfect month
};

export type Progress = { current: number; target: number };

export type Ctx = {
  records: PlayRecord[]; // oldest → newest, finished games only
  today: string;         // player's local YYYY-MM-DD
};

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  category: Category;
  art?: string;          // defaults to /assets/badges/<id>.svg
  hidden?: boolean;      // show as a mystery until earned
  repeatable?: boolean;  // can be earned again each period
  draft?: boolean;       // placeholder name/art, waiting on final design
  awards(ctx: Ctx): Award[];
  progress?(ctx: Ctx): Progress;
};

// ---- helpers ---------------------------------------------------------------

const once = (id: string, r?: PlayRecord): Award[] =>
  r ? [{ id, key: id, earnedAt: r.completedAt }] : [];

/** The record at which a running count first reaches `target`. */
const nth = (list: PlayRecord[], target: number) => list[target - 1];

const count = (list: PlayRecord[], target: number): Progress =>
  ({ current: Math.min(list.length, target), target });

/** Periods in which every day had a daily, for finished periods only. */
function perfectPeriods(ctx: Ctx, period: 'week' | 'month'): Award[] {
  const days = dailyDays(ctx.records);
  if (!days.size) return [];
  const first = [...days].sort()[0];
  const out: Award[] = [];
  for (let start = periodStart(period, first); start <= ctx.today; ) {
    const end = periodEnd(period, start);
    if (end < ctx.today || (end === ctx.today && days.has(end))) {
      if (daysBetween(start, end).every((d) => days.has(d))) {
        const label = period === 'month' ? start.slice(0, 7) : start;
        const last = ctx.records.filter((r) => r.daily === end).at(-1)!;
        out.push({ id: `perfect-${period}`, key: `perfect-${period}:${label}`, earnedAt: last.completedAt, period: label });
      }
    }
    start = addDays(end, 1);
  }
  return out;
}

// ---- the list ---------------------------------------------------------------
// Placeholder names/descriptions until Sue's sketches land (draft: true).

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-solve', name: 'First Light', category: 'milestone', draft: true,
    description: 'Finish your first puzzle.',
    awards: ({ records }) => once('first-solve', records[0]),
  },
  {
    id: 'first-daily', name: 'Daily Dip', category: 'milestone', draft: true,
    description: "Finish one of today's puzzles.",
    awards: ({ records }) => once('first-daily', records.find((r) => r.kind === 'daily')),
  },
  {
    id: 'full-set', name: 'Full Set', category: 'habit', draft: true,
    description: "Finish easy, medium, and hard from the same day.",
    awards: ({ records }) => {
      const seen = new Map<string, Set<string>>();
      for (const r of records) {
        if (!r.daily) continue;
        const levels = seen.get(r.daily) ?? new Set();
        levels.add(r.difficulty);
        seen.set(r.daily, levels);
        if (levels.size === 3) return once('full-set', r);
      }
      return [];
    },
  },
  {
    id: 'perfect-week', name: 'Perfect Week', category: 'habit', repeatable: true, draft: true,
    description: 'Play a daily puzzle every day of a week (Monday–Sunday).',
    awards: (ctx) => perfectPeriods(ctx, 'week'),
  },
  {
    id: 'perfect-month', name: 'Perfect Month', category: 'habit', repeatable: true, draft: true,
    description: 'Play a daily puzzle every day of a calendar month.',
    awards: (ctx) => perfectPeriods(ctx, 'month'),
  },
  {
    id: 'early-puzzler', name: 'Early Puzzler', category: 'time', draft: true,
    description: 'Start 10 puzzles before 8 am.',
    awards: ({ records }) => once('early-puzzler', nth(records.filter((r) => r.startHour < 8 && r.startHour >= 4), 10)),
    progress: ({ records }) => count(records.filter((r) => r.startHour < 8 && r.startHour >= 4), 10),
  },
  {
    id: 'night-owl', name: 'Night Owl', category: 'time', draft: true,
    description: 'Start 10 puzzles between midnight and 4 am.',
    awards: ({ records }) => once('night-owl', nth(records.filter((r) => r.startHour < 4), 10)),
    progress: ({ records }) => count(records.filter((r) => r.startHour < 4), 10),
  },
  {
    id: 'back-from-the-dead', name: 'Back from the Dead', category: 'return', repeatable: true, hidden: true, draft: true,
    description: 'Come back and finish a puzzle after 30 days away.',
    awards: ({ records }) => {
      const out: Award[] = [];
      for (let i = 1; i < records.length; i++) {
        const gap = (Date.parse(records[i].completedAt) - Date.parse(records[i - 1].completedAt)) / 86400000;
        if (gap >= 30) out.push({ id: 'back-from-the-dead', key: `back-from-the-dead:${records[i].localDate}`, earnedAt: records[i].completedAt, period: records[i].localDate });
      }
      return out;
    },
  },
  {
    id: 'no-help-hard', name: 'All on My Own', category: 'skill', draft: true,
    description: 'Finish a hard puzzle without hints, checks, reveals, or autofill.',
    awards: ({ records }) => once('no-help-hard', records.find((r) => r.difficulty === 'hard' && !r.assisted)),
  },
  {
    id: 'sharpshooter', name: 'Sharpshooter', category: 'skill', draft: true,
    description: 'Finish a medium or hard puzzle with 100% first-entry accuracy.',
    awards: ({ records }) => once('sharpshooter', records.find((r) => r.difficulty !== 'easy' && r.accuracy === 100)),
  },
  {
    id: 'well-rounded', name: 'Well Rounded', category: 'variety', draft: true,
    description: 'Finish a sudoku, a huedoku, and a jigsadoku.',
    awards: ({ records }) => {
      const seen = new Set<Variant>();
      for (const r of records) {
        seen.add(r.variant);
        if (seen.size === 3) return once('well-rounded', r);
      }
      return [];
    },
    progress: ({ records }) => ({ current: new Set(records.map((r) => r.variant)).size, target: 3 }),
  },
  {
    id: 'centurion', name: 'Centurion', category: 'milestone', draft: true,
    description: 'Finish 100 puzzles.',
    awards: ({ records }) => once('centurion', nth(records, 100)),
    progress: ({ records }) => count(records, 100),
  },
];

// ---- evaluation -------------------------------------------------------------

/** Every award the records have earned, oldest first. */
export function evaluate(ctx: Ctx, defs: AchievementDef[] = ACHIEVEMENTS): Award[] {
  return defs
    .flatMap((d) => d.awards(ctx))
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
}

/** Awards not yet announced to the player (for a "new badge" moment). */
export const unseen = (awards: Award[], seen: string[]) => {
  const s = new Set(seen);
  return awards.filter((a) => !s.has(a.key));
};

export const artFor = (d: AchievementDef) => d.art ?? `/assets/badges/${d.id}.svg`;
export const byId = (id: string) => ACHIEVEMENTS.find((d) => d.id === id);
