// Shared data + math for the five result displays (Run, Radar, Tracks, Tape,
// Grid). Pure functions only — the components in ResultViews.tsx draw them.
// Design source: design/Sudoku-Results-Sharing-System/result-card-concepts.html
import type { Difficulty, Variant } from "../game/engine.js";
import type { ChallengeResult } from "../game/network.js";
import { stats, formatTime, type Session } from "../game/session.js";
import { PAR_SECONDS } from "../game/scoring.js";

export type ResultView = "run" | "radar" | "tracks" | "tape" | "grid";
export const RESULT_VIEWS: { id: ResultView; label: string; description: string }[] = [
  { id: "run", label: "Run", description: "Your board as a chart: every square you filled, right or wrong." },
  { id: "radar", label: "Radar", description: "Your strengths as a shape, overlaid on friends’." },
  { id: "tracks", label: "Tracks", description: "Everyone placed on the same low-to-high scales." },
  { id: "tape", label: "Tape", description: "A spoiler-free text line to paste into any chat." },
  { id: "grid", label: "Grid", description: "A scorecard table when friends played the same level." },
];
export const DEFAULT_RESULT_VIEWS: Record<ResultView, boolean> = {
  run: true, radar: true, tracks: true, tape: true, grid: true,
};

export const LEVELS: Difficulty[] = ["easy", "medium", "hard"];
export const variantName: Record<Variant, string> = { classic: "sudoku", hue: "huedoku", jigsaw: "jigsadoku" };

/** One player's result, from your own session or a friend's challenge entry. */
export type Player = {
  id: string;
  name: string;
  you: boolean;
  variant: Variant;
  difficulty: Difficulty;
  seconds: number;
  accuracy: number | null;
  evaluated: number | null;
  hints: number;
  checks: number;
  reveals: number;
  autofills: number;
  assisted: boolean;
  completedAt: string;
};

export function playerFromSession(s: Session, name = "You"): Player {
  const st = stats(s);
  return {
    id: s.challenge?.attemptId || s.id,
    name,
    you: true,
    variant: s.puzzle.variant,
    difficulty: s.puzzle.difficulty,
    seconds: s.seconds,
    accuracy: st.accuracy,
    evaluated: st.evaluated,
    hints: st.hints,
    checks: st.checks,
    reveals: st.reveals,
    autofills: st.autofills,
    assisted: st.assisted,
    completedAt: s.completedAt || s.startedAt,
  };
}

export function playerFromChallenge(r: ChallengeResult, variant: Variant, youId?: string): Player {
  const you = !!youId && r.id === youId;
  return {
    id: r.id,
    name: you ? "You" : r.name || "A fellow puzzler",
    you,
    variant,
    difficulty: r.difficulty,
    seconds: r.elapsedSeconds || 0,
    accuracy: r.accuracy,
    evaluated: null,
    hints: r.hints ?? 0,
    checks: r.checks ?? 0,
    reveals: r.reveals ?? 0,
    autofills: r.autofills ?? 0,
    assisted: !!r.assisted,
    completedAt: r.completedAt,
  };
}

/** Your result first, then everyone else in finishing order. */
export function groupWithYou(you: Player, others: Player[]): Player[] {
  return [you, ...others.filter((p) => p.id !== you.id && !p.you)];
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const fmtTime = formatTime;
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const sameLevel = (group: Player[]) => group.every((p) => p.difficulty === group[0].difficulty);
export const names = (ps: Player[]) => ps.map((p) => p.name).join(" & ");

/* ---- Run: the 81-square fingerprint (real positions, not a shuffle) ---- */
export type CellKind = "given" | "correct" | "wrong" | "hint" | "reveal" | "blank";
export function runCells(s: Session): { kind: CellKind; right: boolean; bottom: boolean }[] {
  const { givens, solution, regions } = s.puzzle;
  const revealed = new Set<number>(), hinted = new Set<number>();
  for (const e of s.events) {
    if (e.kind === "reveal") revealed.add(e.cell);
    if (e.kind === "hint") hinted.add(e.cell);
  }
  return givens.map((g, i) => {
    const kind: CellKind = g
      ? "given"
      : revealed.has(i)
        ? "reveal"
        : hinted.has(i)
          ? "hint"
          : s.first[i] === null
            ? "blank"
            : s.first[i] === solution[i]
              ? "correct"
              : "wrong";
    const col = i % 9, row = Math.floor(i / 9);
    return {
      kind,
      right: col < 8 && regions[i] !== regions[i + 1],
      bottom: row < 8 && regions[i] !== regions[i + 9],
    };
  });
}
export const CELL_LABELS: [CellKind, string][] = [
  ["given", "Given"],
  ["correct", "First entry — right"],
  ["wrong", "First entry — wrong"],
  ["hint", "Hint used"],
  ["reveal", "Revealed"],
  ["blank", "Not evaluated"],
];

/* ---- Radar: 0–100 per axis, normalised only within the results shown ---- */
export const uses = (n: number, cap = 5) => Math.round(100 * (1 - clamp(n, 0, cap) / cap));
export function relativeSpeed(p: Player, group: Player[]): number | null {
  const peers = group.filter((g) => g.difficulty === p.difficulty);
  if (peers.length < 2) return null; // a lone solve has nothing to scale against
  const ts = peers.map((g) => g.seconds);
  const min = Math.min(...ts), max = Math.max(...ts);
  return max === min ? 100 : Math.round((100 * (max - p.seconds)) / (max - min));
}
export type Axis = { key: string; label: string; get: (p: Player) => number | null };
export function radarAxes(group: Player[]): Axis[] {
  const axes: Axis[] = [
    { key: "speed", label: "Speed", get: (p) => relativeSpeed(p, group) },
    { key: "accuracy", label: "Accuracy", get: (p) => (p.accuracy == null ? 0 : clamp(p.accuracy, 0, 100)) },
    { key: "independence", label: "Independence", get: (p) => uses(p.hints) },
    { key: "focus", label: "Focus", get: (p) => uses(p.checks) },
  ];
  const speedOk = group.some((p) => relativeSpeed(p, group) !== null);
  return speedOk ? axes : axes.slice(1);
}

/* ---- Tracks: every scale runs lowest → highest value. The "best" end is
   always the same green, whichever side it sits on. ---- */
export type Track = {
  key: string;
  label: string;
  value: (p: Player) => number | null;
  display: (p: Player) => string;
  min: number;
  max: number;
  lowIsBest: boolean;
  lowWord: string;
  highWord: string;
  bestWord: string;
  endLabel: (v: number) => string;
  mark?: { value: number; label: string }; // e.g. par time
};
export function tracksFor(group: Player[]): { tracks: Track[]; timeWithheld: boolean } {
  const level = sameLevel(group);
  const worst = (f: (p: Player) => number) => Math.max(...group.map(f));
  const tracks: Track[] = [];
  if (level) {
    const par = PAR_SECONDS[group[0].variant][group[0].difficulty];
    const max = Math.ceil(Math.max(par * 1.5, worst((p) => p.seconds) * 1.1) / 60) * 60;
    tracks.push({
      key: "time", label: "Active time", value: (p) => p.seconds, display: (p) => fmtTime(p.seconds),
      min: 0, max, lowIsBest: true, lowWord: "faster", highWord: "slower", bestWord: "fastest",
      endLabel: (v) => fmtTime(v), mark: { value: par, label: `par ${fmtTime(par)}` },
    });
  }
  tracks.push({
    key: "accuracy", label: "First-entry accuracy", value: (p) => p.accuracy,
    display: (p) => (p.accuracy == null ? "—" : `${p.accuracy}%`),
    min: 0, max: 100, lowIsBest: false, lowWord: "less accurate", highWord: "more accurate",
    bestWord: "sharpest", endLabel: (v) => `${v}%`,
  });
  const cap = (f: (p: Player) => number) => Math.max(5, worst(f) + 1);
  tracks.push({
    key: "hints", label: "Hints", value: (p) => p.hints, display: (p) => String(p.hints),
    min: 0, max: cap((p) => p.hints), lowIsBest: true, lowWord: "fewer hints", highWord: "more hints",
    bestWord: "fewest", endLabel: (v) => String(v),
  });
  tracks.push({
    key: "checks", label: "Answer checks", value: (p) => p.checks, display: (p) => String(p.checks),
    min: 0, max: cap((p) => p.checks), lowIsBest: true, lowWord: "fewer checks", highWord: "more checks",
    bestWord: "fewest", endLabel: (v) => String(v),
  });
  return { tracks, timeWithheld: !level };
}
export const trackPercent = (t: Track, v: number) => clamp(((v - t.min) / (t.max - t.min || 1)) * 100, 0, 100);
export function trackBest(t: Track, group: Player[]): Player[] {
  const vals = group.map((p) => t.value(p)).filter((v): v is number => v !== null);
  if (!vals.length) return [];
  const best = t.lowIsBest ? Math.min(...vals) : Math.max(...vals);
  return group.filter((p) => t.value(p) === best);
}

/* ---- Tape: fixed-width text that survives any chat ---- */
export const bar = (n: number, total = 10) => {
  const k = clamp(Math.round(n), 0, total);
  return "█".repeat(k) + "░".repeat(total - k);
};
/** Segments for the time bar: full at or under par, fewer the slower you go. */
export const timeSegments = (p: Player) =>
  clamp(Math.round(10 * Math.min(1, PAR_SECONDS[p.variant][p.difficulty] / Math.max(p.seconds, 1))), 1, 10);
export function shareText(p: Player): string {
  const acc = p.accuracy == null ? "—" : `${p.accuracy}%`;
  return (
    `*doku · ${variantName[p.variant]} · ${p.difficulty} · ${fmtTime(p.seconds)}\n` +
    `${bar(p.accuracy == null ? 0 : p.accuracy / 10)} ${acc} · hints ${p.hints} · checks ${p.checks} · ${p.assisted ? "assisted" : "unassisted"}`
  );
}

/* ---- Grid: stars for row bests (ties allowed) + named achievements ---- */
export type GridRow = { label: string; display: (p: Player) => string; score: (p: Player) => number };
export function gridRows(group: Player[]): GridRow[] {
  const rows: GridRow[] = [];
  if (sameLevel(group)) rows.push({ label: "Active time", display: (p) => fmtTime(p.seconds), score: (p) => relativeSpeed(p, group) ?? 0 });
  rows.push(
    { label: "First-entry accuracy", display: (p) => (p.accuracy == null ? "—" : `${p.accuracy}%`), score: (p) => p.accuracy ?? 0 },
    { label: "Hints", display: (p) => String(p.hints), score: (p) => uses(p.hints) },
    { label: "Answer checks", display: (p) => String(p.checks), score: (p) => uses(p.checks) },
  );
  return rows;
}
export function rowWinners(row: GridRow, group: Player[]): Set<string> {
  const best = Math.max(...group.map(row.score));
  return new Set(group.filter((p) => row.score(p) === best).map((p) => p.id));
}
export function achievements(group: Player[]): { title: string; who: string; icon: "clock" | "target" | "check" }[] {
  const out: { title: string; who: string; icon: "clock" | "target" | "check" }[] = [];
  if (sameLevel(group)) {
    const min = Math.min(...group.map((p) => p.seconds));
    out.push({ title: "Fastest solve", who: names(group.filter((p) => p.seconds === min)), icon: "clock" });
  }
  const acc = Math.max(...group.map((p) => p.accuracy ?? -1));
  if (acc >= 0) out.push({ title: "Sharpest solve", who: names(group.filter((p) => p.accuracy === acc)), icon: "target" });
  const clean = group.filter((p) => !p.assisted);
  if (clean.length) out.push({ title: "Unassisted finish", who: names(clean), icon: "check" });
  return out;
}

export function srSummary(p: Player) {
  return `${p.name}: ${variantName[p.variant]}, ${p.difficulty}, ${fmtTime(p.seconds)} active time, first-entry accuracy ${
    p.accuracy == null ? "not measured" : `${p.accuracy} percent`
  }, ${p.hints} hints, ${p.checks} answer checks, ${p.assisted ? "assisted" : "unassisted"}.`;
}
