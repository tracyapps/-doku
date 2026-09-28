// The five result displays from the Open Design export, as React components.
// Each reads the game's theme tokens (--bg, --surface, --accent, …) so it
// follows whatever skin the player picked. Which ones show is a setting.
import { useState } from "react";
import type { Session } from "../game/session.js";
import {
  CELL_LABELS, LEVELS, achievements, clamp, fmtTime, gridRows, radarAxes, rowWinners,
  runCells, sameLevel, shareText, shortDate, srSummary, timeSegments, trackBest,
  trackPercent, tracksFor, variantName, type Player, type ResultView,
} from "./model.js";
import "./results.css";

const LIGHT_THEMES = new Set(["paper", "comic", "doodle", "rounded"]);
export const schemeFor = (theme: string) => (LIGHT_THEMES.has(theme) ? "light" : "dark");

/* ---------- shared atoms ---------- */
function Steps({ level, large = false }: { level: string; large?: boolean }) {
  const n = Math.max(0, LEVELS.indexOf(level as never)) + 1;
  return (
    <span className={`rv-steps${large ? " lg" : ""}`} role="img" aria-label={`Difficulty: ${level}, ${n} of 3`}>
      {[0, 1, 2].map((i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}
function Ring({ pct }: { pct: number | null }) {
  const r = 42, c = 2 * Math.PI * r;
  const off = pct == null ? c : c * (1 - clamp(pct, 0, 100) / 100);
  return (
    <div className="rv-ring" role="img" aria-label={`First-entry accuracy: ${pct == null ? "not measured" : `${pct}%`}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="bg" cx="50" cy="50" r={r} />
        <circle className="fg" cx="50" cy="50" r={r} strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
      </svg>
      <span className="val">{pct == null ? "—" : `${pct}%`}</span>
    </div>
  );
}
function Pips({ n, cap = 5 }: { n: number; cap?: number }) {
  return (
    <span className="rv-pips" role="img" aria-label={`${n} used`}>
      {Array.from({ length: cap }, (_, i) => <i key={i} className={i < Math.min(n, cap) ? "on" : ""} />)}
      <b>{n}</b>
    </span>
  );
}
function Seal({ assisted }: { assisted: boolean }) {
  return assisted ? (
    <span className="rv-seal sealed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
      Assisted
    </span>
  ) : (
    <span className="rv-seal clean">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
      Unassisted
    </span>
  );
}
function Context({ p }: { p: Player }) {
  return (
    <>
      <span className="rv-who">{variantName[p.variant]}</span>
      <span className="rv-difftag"><span>level</span><Steps level={p.difficulty} /> {p.difficulty}</span>
      <span className="rv-date">{shortDate(p.completedAt)}</span>
    </>
  );
}
function Card({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="rv-card" aria-labelledby={`rv-${id}`}>
      <h2 className="rv-title" id={`rv-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

/* ---------- 01 Run ---------- */
export function RunView({ session, you }: { session: Session; you: Player }) {
  const cells = runCells(session);
  return (
    <Card title="Run — your board, as the chart" id="run">
      <div className="rv-head"><span className="rv-who">{you.name}</span><Context p={you} /></div>
      <div className="rv-run-grid">
        <div className={`rv-fp${session.puzzle.variant === "jigsaw" ? " jigsaw" : ""}`} aria-hidden="true">
          {cells.map((c, i) => (
            <i key={i} className={`${c.kind}${c.right ? " r" : ""}${c.bottom ? " b" : ""}`} />
          ))}
        </div>
        <div className="rv-run-stats">
          <Ring pct={you.accuracy} />
          <div className="rv-col">
            <div className="rv-metric">
              <span className="k">Active time</span>
              <span className="v">{fmtTime(you.seconds)}</span>
              <span className="sub">
                {you.evaluated} squares evaluated
                {you.reveals ? ` · ${you.reveals} revealed` : ""}
                {you.autofills ? ` · ${you.autofills} note autofills` : ""}
              </span>
            </div>
            <div className="rv-metric"><span className="k">Hints</span><Pips n={you.hints} /></div>
            <div className="rv-metric"><span className="k">Answer checks</span><Pips n={you.checks} /></div>
            <div><Seal assisted={you.assisted} /></div>
          </div>
        </div>
      </div>
      <ul className="rv-legend" aria-label="Board key">
        {CELL_LABELS.map(([k, t]) => <li key={k}><span className={`sw ${k}`} />{t}</li>)}
      </ul>
      <p className="sr-only">{srSummary(you)}</p>
    </Card>
  );
}

/* ---------- 02 Radar ---------- */
const PCOL = ["--p1", "--p2", "--p3", "--p4"];
const polar = (c: number, r: number, i: number, n: number) => {
  const a = ((-90 + (360 / n) * i) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
};
// Crop the SVG to the shape plus its labels (a 3-axis triangle is top-heavy).
const radarBox = (n: number, c: number, maxR: number) => {
  const pts = Array.from({ length: n }, (_, i) => polar(c, maxR + 22, i, n));
  const ys = pts.map((p) => p[1]);
  const top = Math.min(...ys) - 12, bottom = Math.max(...ys) + 12;
  return `-30 ${top.toFixed(0)} 280 ${(bottom - top).toFixed(0)}`;
};
export function RadarView({ group }: { group: Player[] }) {
  const me = group[0];
  const axes = radarAxes(group);
  const n = axes.length, c = 110, maxR = 72;
  const diffIdx = Math.max(0, LEVELS.indexOf(me.difficulty));
  const points = (p: Player) =>
    axes.map((a, i) => polar(c, (maxR * clamp(a.get(p) ?? 0, 0, 100)) / 100, i, n).join(",")).join(" ");
  const label = `Skill shape for ${me.name}. ` + axes.map((a) => `${a.label} ${a.get(me) ?? "not scored"} of 100`).join(", ") + ".";
  return (
    <Card title="Radar — your shape against theirs" id="radar">
      <div className="rv-radar-wrap">
        <svg className="rv-radar" viewBox={radarBox(n, c, maxR)} role="img" aria-label={label}>
          {[0.33, 0.66, 1].map((f, i) => (
            <polygon key={i} className={i === diffIdx ? "diff-ring" : "grid-ring"}
              points={Array.from({ length: n }, (_, k) => polar(c, maxR * f, k, n).join(",")).join(" ")} />
          ))}
          {axes.map((_, i) => { const [x, y] = polar(c, maxR, i, n); return <line key={i} className="spoke" x1={c} y1={c} x2={x} y2={y} />; })}
          {axes.map((a, i) => { const [x, y] = polar(c, maxR + 22, i, n); return <text key={a.key} className="axis" x={x} y={y} textAnchor="middle" dominantBaseline="middle">{a.label}</text>; })}
          {group.slice(1).map((p, i) => (
            <polygon key={p.id} className="peer" points={points(p)} style={{ "--c": `var(${PCOL[(i + 1) % 4]})` } as React.CSSProperties} />
          ))}
          <polygon className="you" points={points(me)} />
          {axes.map((a, i) => { const [x, y] = polar(c, (maxR * clamp(a.get(me) ?? 0, 0, 100)) / 100, i, n); return <circle key={a.key} className="dot" cx={x} cy={y} r="3.5" />; })}
        </svg>
        <div className="rv-radar-key">
          {axes.map((a) => (
            <div className="row" key={a.key}><span className="who">{a.label}</span><span className="val">{a.get(me) ?? "—"}</span></div>
          ))}
          {group.length > 1 && (
            <div className="row">
              <span className="who">Overlaid</span>
              <span className="val">
                {group.slice(1).map((p, i) => (
                  <span key={p.id} className="rv-key-chip"><i style={{ background: `var(${PCOL[(i + 1) % 4]})` }} />{p.name}</span>
                ))}
              </span>
            </div>
          )}
          <p className="rv-note">
            Axes are 0–100. Hints and checks score against a 5-use ceiling. Speed is scaled between the
            fastest and slowest result at the same level{axes.length === 3 ? ", so a lone solve leaves it off" : ""}.
            The heavier ring marks this puzzle’s level.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ---------- 03 Tracks ---------- */
export function TracksView({ group }: { group: Player[] }) {
  const { tracks, timeWithheld } = tracksFor(group);
  const level = sameLevel(group) ? group[0].difficulty : null;
  return (
    <Card title="Tracks — everyone on the same scale" id="tracks">
      <div className="rv-head">
        <span className="rv-who">{level ? `Compared at ${level}` : "Mixed levels"}</span>
        {level && <span className="rv-difftag"><span>level</span><Steps level={level} large /> {level}</span>}
        <span className="rv-date">{group.length === 1 ? "just you so far" : `${group.length} players`}</span>
      </div>
      {tracks.map((t) => {
        const best = trackBest(t, group);
        return (
          <div className="rv-track-row" key={t.key}>
            <div className="rv-track-top">
              <span className="name">{t.label}</span>
              {group.length > 1 && best.length > 0 && (
                <span className="best">best: <em>{best.map((p) => p.name).join(" & ")}</em> · {t.bestWord}</span>
              )}
            </div>
            <div className="rv-track-words" aria-hidden="true">
              <span>← {t.lowWord}</span><span>{t.highWord} →</span>
            </div>
            <div
              className={`rv-track ${t.lowIsBest ? "low-best" : "high-best"}`}
              role="img"
              aria-label={`${t.label}, from ${t.endLabel(t.min)} to ${t.endLabel(t.max)}, ${t.lowIsBest ? "lower" : "higher"} is better. ${group.map((p) => `${p.name} ${t.display(p)}`).join("; ")}.`}
            >
              {t.mark && (
                <span className="mark" style={{ left: `${trackPercent(t, t.mark.value)}%` }}>
                  <span>{t.mark.label}</span>
                </span>
              )}
              {group.map((p, i) => {
                const v = t.value(p);
                if (v === null) return null;
                return (
                  <span key={p.id} className={`mk${p.you ? " you" : ""}`}
                    style={{ left: `${clamp(trackPercent(t, v), 3, 97)}%`, "--c": `var(${PCOL[i % 4]})`, zIndex: p.you ? 3 : 2 } as React.CSSProperties}
                    title={`${p.name}: ${t.display(p)}`}>
                    {p.name[0]}
                  </span>
                );
              })}
            </div>
            <div className="rv-track-scale" aria-hidden="true">
              <span>{t.endLabel(t.min)}</span>
              {group.length === 1 && <span className="you-val">{t.display(group[0])}</span>}
              <span>{t.endLabel(t.max)}</span>
            </div>
          </div>
        );
      })}
      <p className="rv-note">
        Every track runs from the lowest value on the left to the highest on the right. Green marks the
        better end, wherever it sits. Hints and checks run to at least 5.
        {timeWithheld ? " Time is left off because these results were played at different levels." : " The time track shows par for this level."}
      </p>
    </Card>
  );
}

/* ---------- 04 Tape ---------- */
export function TapeView({ you }: { you: Player }) {
  const [copied, setCopied] = useState("");
  const text = shareText(you);
  const seg = (filled: number, cls: "f" | "r" = "f") =>
    Array.from({ length: 10 }, (_, i) => <i key={i} className={i < filled ? cls : ""} />);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      setCopied("Select the text to copy");
    }
    setTimeout(() => setCopied(""), 1800);
  };
  return (
    <Card title="Tape — the shareable line" id="tape">
      <div className="rv-tape-grid">
        <div className="rv-receipt">
          <div className="rtop"><span>*doku · {variantName[you.variant]}</span><span className="d">{you.difficulty} · {shortDate(you.completedAt)}</span></div>
          <div className="rline"><span className="lab">Time</span><span className="val">{fmtTime(you.seconds)}</span>
            <span className="bar" role="img" aria-label={`Time: ${timeSegments(you)} of 10, full at par or faster`}>{seg(timeSegments(you))}</span></div>
          <div className="rline"><span className="lab">Accuracy</span><span className="val">{you.accuracy == null ? "—" : `${you.accuracy}%`}</span>
            <span className="bar" role="img" aria-label={`Accuracy ${you.accuracy ?? 0} percent`}>{seg(Math.round((you.accuracy ?? 0) / 10))}</span></div>
          <div className="rline"><span className="lab">Hints</span><span className="val">{you.hints}</span>
            <span className="bar" role="img" aria-label={`${you.hints} hints`}>{seg(Math.min(you.hints, 10), "r")}</span></div>
          <div className="rline"><span className="lab">Checks</span><span className="val">{you.checks}</span>
            <span className="bar" role="img" aria-label={`${you.checks} answer checks`}>{seg(Math.min(you.checks, 10), "r")}</span></div>
          <div className="rfoot"><span><Steps level={you.difficulty} large /> {you.difficulty}</span><Seal assisted={you.assisted} /></div>
        </div>
        <div className="rv-share-box">
          <div className="top">
            <span className="t">Copy-paste version</span>
            <button type="button" className="rv-copy" onClick={copy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              {copied || "Copy"}
            </button>
          </div>
          <pre className="rv-copy-text">{text}</pre>
          <p className="sr-only" aria-live="polite">{copied === "Copied" ? "Result copied to clipboard." : copied}</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------- 05 Grid ---------- */
const Star = () => (
  <svg className="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6L12 16.9 6.6 19.6l1.2-6L3.3 9.4l6.1-.8z" /></svg>
);
const achIcon = (k: string) =>
  k === "clock" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  : k === "target" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>;
export function GridView({ group }: { group: Player[] }) {
  if (group.length < 2) return null;
  const rows = gridRows(group);
  const level = sameLevel(group) ? group[0].difficulty : null;
  return (
    <Card title="Grid — the scorecard" id="grid">
      <div className="rv-matrix-scroll">
        <table className="rv-matrix">
          <caption>
            {level ? <>All played <b>{level}</b> — speed is compared only within a level.</> : "Mixed levels — time is left off; speed is compared only within a level."}
          </caption>
          <thead>
            <tr><th scope="col">Dimension</th>{group.map((p) => <th scope="col" key={p.id} className={p.you ? "you" : ""}>{p.name}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const winners = rowWinners(row, group);
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {group.map((p) => {
                    const win = winners.has(p.id);
                    return (
                      <td key={p.id} className={`${p.you ? "you " : ""}${win ? "win" : ""}`}
                        style={{ "--fill": Math.round(clamp(row.score(p), 0, 100) * 0.34) } as React.CSSProperties}>
                        {row.display(p)}{win && <Star />}
                        {win && <span className="sr-only">, best in row</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="rv-achievements" aria-label="Category achievements">
        {achievements(group).map((a) => (
          <li key={a.title} className="rv-ach">{achIcon(a.icon)}<span><b>{a.title}</b> · {a.who}</span></li>
        ))}
      </ul>
      <p className="rv-note">Fill shows how strong each result is within its row. Stars mark row bests, and ties earn more than one star.</p>
    </Card>
  );
}

/* ---------- the stack ---------- */
export function ResultViews({
  theme, enabled, session, group,
}: {
  theme: string;
  enabled: Record<ResultView, boolean>;
  session?: Session | null; // needed for Run (per-square data)
  group: Player[]; // group[0] is you (or the player being viewed)
}) {
  if (!group.length) return null;
  const you = group[0];
  return (
    <div className="rv" data-scheme={schemeFor(theme)}>
      {enabled.run && session && <RunView session={session} you={you} />}
      {enabled.radar && <RadarView group={group} />}
      {enabled.tracks && <TracksView group={group} />}
      {enabled.tape && you.you && <TapeView you={you} />}
      {enabled.grid && <GridView group={group} />}
    </div>
  );
}
