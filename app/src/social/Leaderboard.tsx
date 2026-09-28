// Leaderboards: week / month / year / all time × friends / global.
// The default ranking is the calculated *doku score; the other views sort
// by one dimension. Only daily puzzles count.
import { useEffect, useState } from "react";
import {
  getLeaderboard, playerPath, type Board, type BoardPeriod, type BoardScope, type BoardViewName,
} from "../game/account.js";
import { dateKey } from "../game/daily.js";
import { formatTime } from "../game/session.js";
import { LEVEL_POINTS, PAR_SECONDS } from "../game/scoring.js";
import "./social.css";

const PERIODS: { id: BoardPeriod; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];
const SCOPES: { id: BoardScope; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "global", label: "Everyone" },
];
const VIEWS: { id: BoardViewName; label: string; unit: (v: number) => string }[] = [
  { id: "points", label: "*doku score", unit: (v) => `${v.toLocaleString()} pts` },
  { id: "speed", label: "Fastest", unit: (v) => `${v} speed` },
  { id: "accuracy", label: "Most accurate", unit: (v) => `${v}%` },
  { id: "independence", label: "Most independent", unit: (v) => `${v}%` },
  { id: "consistency", label: "Most consistent", unit: (v) => `${v}% of days` },
];

function Segmented<T extends string>({
  name, label, value, options, onChange,
}: { name: string; label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="lb-seg">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.id} className={value === o.id ? "on" : ""}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

const rangeLabel = (b: Board) => {
  if (!b.start || !b.end) return "All daily puzzles so far";
  const f = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(b.period === "year" ? { year: "numeric" } : {}) });
  return b.period === "year" ? f(b.start).slice(-4) : `${f(b.start)} – ${f(b.end)}`;
};

export function LeaderboardScreen({
  signedIn, onOpenProfile, onOpenPlayer,
}: {
  signedIn: boolean;
  onOpenProfile: () => void;
  onOpenPlayer: (p: { id: string; handle: string | null }) => void;
}) {
  const [scope, setScope] = useState<BoardScope>(signedIn ? "friends" : "global");
  // Sign-in finishes loading after first render: default to friends once
  // it does, unless the player already picked a board.
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (signedIn && !picked) setScope("friends");
  }, [signedIn, picked]);
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [view, setView] = useState<BoardViewName>("points");
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scope === "friends" && !signedIn) {
      setBoard(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    getLeaderboard({ period, scope, view, today: dateKey() })
      .then((b) => live && setBoard(b))
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [scope, period, view, signedIn]);

  const unit = VIEWS.find((v) => v.id === view)!.unit;
  const you = board?.players.find((p) => p.you);
  const others = board?.players.filter((p) => !p.you).length ?? 0;

  return (
    <>
      <p className="eyebrow">FRIENDLY COMPETITION</p>
      <h1 className="page-title">Leaderboards</h1>
      <p className="muted">
        Built from the daily puzzles, which everyone plays the same way. Results are self-reported — play for fun.
      </p>

      <div className="lb-controls">
        <Segmented name="lb-scope" label="Who to compare with" value={scope} options={SCOPES} onChange={(v) => { setPicked(true); setScope(v); }} />
        <Segmented name="lb-period" label="Time period" value={period} options={PERIODS} onChange={setPeriod} />
        <label className="lb-view">
          <span>Rank by</span>
          <select value={view} onChange={(e) => setView(e.target.value as BoardViewName)}>
            {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
      </div>

      {scope === "friends" && !signedIn ? (
        <div className="empty-state">
          <h2>Sign in to compare with friends</h2>
          <p>Your friends board shows you and the people you’ve added. Guest play keeps working without an account.</p>
          <button className="primary" onClick={onOpenProfile}>Sign in or create an account</button>
        </div>
      ) : error ? (
        <p className="lb-error" role="alert">{error}</p>
      ) : !board ? (
        <p aria-live="polite">Loading…</p>
      ) : (
        <section aria-labelledby="lb-title" aria-busy={loading}>
          <h2 id="lb-title" className="section-label">
            {SCOPES.find((s) => s.id === scope)!.label} · {rangeLabel(board)}
          </h2>
          {board.players.length === 0 || (board.players.length === 1 && you && you.row.dailies === 0) ? (
            <div className="empty-state">
              <h2>No daily puzzles yet{period === "week" ? " this week" : ""}.</h2>
              <p>
                {scope === "friends" && others === 0
                  ? "Add friends from your profile, then finish a daily puzzle to get on the board."
                  : "Finish one of today’s puzzles to get on the board."}
              </p>
              {scope === "friends" && others === 0 && (
                <button className="secondary" onClick={onOpenProfile}>Add friends</button>
              )}
            </div>
          ) : (
            <ol className="lb-list">
              {board.players.map((p) => (
                <li key={p.player.id} className={p.you ? "you" : ""} aria-current={p.you ? "true" : undefined}>
                  <span className="lb-rank" aria-label={`Rank ${p.rank}`}>{p.rank}</span>
                  <span className="lb-name">
                    <a
                      className="player-link"
                      href={playerPath(p.player)}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        onOpenPlayer(p.player);
                      }}
                    >
                      <strong>{p.you ? `${p.player.name || "You"} (you)` : p.player.name}</strong>
                      <span className="sr-only">, view profile</span>
                    </a>
                    <small>
                      {p.player.handle ? `@${p.player.handle} · ` : ""}
                      {p.row.dailies} {p.row.dailies === 1 ? "daily" : "dailies"}
                      {period !== "all" ? ` · ${p.row.consistency}% of days` : ""}
                    </small>
                  </span>
                  <span className="lb-value">{unit(p.row[view])}</span>
                </li>
              ))}
            </ol>
          )}
          {you?.hidden && (
            <p className="fine-print lb-hidden">
              Only you can see your row here. To appear on the everyone board, choose a @handle and turn on
              “Show me on the everyone leaderboard” in your{" "}
              <button className="text-button" onClick={onOpenProfile}>profile</button>.
            </p>
          )}
        </section>
      )}

      <details className="lb-how">
        <summary>How the *doku score works</summary>
        <p>
          Each finished daily puzzle earns up to {LEVEL_POINTS.easy} points on easy, {LEVEL_POINTS.medium} on
          medium, and {LEVEL_POINTS.hard} on hard. You earn that amount multiplied by the average of three parts:
        </p>
        <ul>
          <li><strong>Speed:</strong> finishing at par earns 50%. Faster moves toward 100%; slower eases toward 0 but never goes negative.</li>
          <li><strong>Accuracy:</strong> your first-entry accuracy.</li>
          <li><strong>Independence:</strong> 100% with no help. Hints, checks, reveals, and note autofills lower it, to at most 80%.</li>
        </ul>
        <p>
          Par for classic sudoku is {formatTime(PAR_SECONDS.classic.easy)} easy, {formatTime(PAR_SECONDS.classic.medium)} medium,
          and {formatTime(PAR_SECONDS.classic.hard)} hard (a little longer for huedoku and jigsadoku). Par will be adjusted as more
          people play so a typical solve keeps earning about half the speed points.
        </p>
        <p>
          Showing up more days earns more, capped at three dailies a day. The other rankings sort by one part
          on its own, so a slow, careful solver can still top “Most accurate”.
        </p>
      </details>
    </>
  );
}
