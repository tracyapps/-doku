// Someone's public profile: who they are, how often they play, this week's
// board numbers, earned badges, and where you stand as friends.
import { useEffect, useState, type ReactNode } from "react";
import {
  cancelFriendRequest, getPlayer, removeFriend, sendFriendRequest,
  type PlayerProfile, type Relationship,
} from "../game/account.js";
import "./social.css";

type Awards = PlayerProfile["awards"];

export function PlayerProfileScreen({
  playerKey, today, signedIn, onOpenOwnProfile, onSignIn, notify, renderBadges,
}: {
  playerKey: string;
  today: string;
  signedIn: boolean;
  onOpenOwnProfile: () => void;
  onSignIn: () => void;
  notify: (m: string) => void;
  renderBadges: (awards: Awards, featured: string[]) => ReactNode;
}) {
  const [data, setData] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    getPlayer(playerKey, today)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [playerKey, today, signedIn]);

  if (error)
    return (
      <div className="empty-state">
        <h1 className="page-title">Profile not available</h1>
        <p>{error}</p>
        {!signedIn && (
          <p>
            If this is a friend, <button className="text-link" onClick={onSignIn}>sign in</button> to see their profile.
          </p>
        )}
      </div>
    );
  if (!data) return <p aria-live="polite">Loading profile…</p>;

  const { player, relationship: rel } = data;
  const setRel = (relationship: Relationship) => setData((d) => (d ? { ...d, relationship } : d));
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { notify(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };
  const initial = (player.name || player.handle || "?")[0].toUpperCase();
  const joined = new Date(player.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const periods = [["week", "This week"], ["month", "This month"], ["year", "This year"]] as const;

  return (
    <>
      <header className="player-head">
        <span className="player-avatar" aria-hidden="true">
          {player.image ? <img src={player.image} alt="" /> : initial}
        </span>
        <div className="player-id">
          <p className="eyebrow">{rel === "self" ? "YOUR PUBLIC PROFILE" : "PLAYER PROFILE"}</p>
          <h1 className="page-title">{player.name}</h1>
          <p className="muted">
            {player.handle && <>@{player.handle} · </>}Playing since {joined}
          </p>
        </div>
      </header>

      <div className="player-relation" role="group" aria-label="Friendship">
        {rel === "self" && (
          <>
            <span className="rel-badge">This is you</span>
            <p className="fine-print">This is how friends and other players see your profile.</p>
            <button className="secondary" onClick={onOpenOwnProfile}>Edit your profile</button>
          </>
        )}
        {rel === "friend" && (
          <>
            <span className="rel-badge friend">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
              Friends
            </span>
            {!confirmRemove ? (
              <button className="text-button" onClick={() => setConfirmRemove(true)}>Remove friend</button>
            ) : (
              <span className="friend-confirm">
                <button className="text-button danger-link" disabled={busy}
                  onClick={() => act(async () => { await removeFriend(player.id); setRel("none"); setConfirmRemove(false); notify(`Removed ${player.name} from your friends.`); })}>
                  Yes, remove {player.name}
                </button>
                <button className="text-button" onClick={() => setConfirmRemove(false)}>Keep</button>
              </span>
            )}
          </>
        )}
        {rel === "requested" && (
          <>
            <span className="rel-badge pending">Friend request sent</span>
            <button className="text-button" disabled={busy}
              onClick={() => act(async () => setRel((await cancelFriendRequest(player.id)).relationship))}>
              Cancel request
            </button>
          </>
        )}
        {rel === "incoming" && (
          <>
            <span className="rel-badge pending">{player.name} wants to be friends</span>
            <button className="primary" disabled={busy}
              onClick={() => act(async () => { setRel((await sendFriendRequest(player.id)).relationship); notify(`You and ${player.name} are now friends.`); })}>
              Accept
            </button>
            <button className="secondary" disabled={busy}
              onClick={() => act(async () => setRel((await cancelFriendRequest(player.id)).relationship))}>
              Decline
            </button>
          </>
        )}
        {rel === "none" &&
          (signedIn ? (
            <button className="primary" disabled={busy}
              onClick={() => act(async () => {
                const r = (await sendFriendRequest(player.id)).relationship;
                setRel(r);
                notify(r === "friend" ? `You and ${player.name} are now friends.` : `Friend request sent to ${player.name}.`);
              })}>
              Add friend
            </button>
          ) : (
            <button className="primary" onClick={onSignIn}>Sign in to add as a friend</button>
          ))}
      </div>

      <section aria-labelledby="pp-often">
        <h2 id="pp-often" className="section-label">How often they play</h2>
        <div className="consistency-grid">
          {periods.map(([k, label]) => {
            const c = data.consistency[k];
            return (
              <div key={k} className="consistency-tile">
                <span className="tile-label">{label}</span>
                <strong>{c.percent}%</strong>
                <meter min={0} max={c.elapsed} value={c.played} aria-label={`${label}: ${c.played} of ${c.elapsed} days`} />
                <small>{c.played} of {c.elapsed} {c.elapsed === 1 ? "day" : "days"}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pp-week">
        <h2 id="pp-week" className="section-label">This week’s daily puzzles</h2>
        {data.week.dailies === 0 ? (
          <p className="muted">No daily puzzles yet this week.</p>
        ) : (
          <dl className="player-stats">
            <div><dt>*doku score</dt><dd>{data.week.points.toLocaleString()}</dd></div>
            <div><dt>Dailies</dt><dd>{data.week.dailies}</dd></div>
            <div><dt>Speed</dt><dd>{data.week.speed}</dd></div>
            <div><dt>Accuracy</dt><dd>{data.week.accuracy}%</dd></div>
            <div><dt>Independence</dt><dd>{data.week.independence}%</dd></div>
          </dl>
        )}
        <p className="fine-print">
          {data.totals.puzzles} puzzles finished in all · {data.totals.dailies} daily puzzles
        </p>
      </section>

      <section aria-labelledby="pp-badges">
        <h2 id="pp-badges" className="section-label">Badges</h2>
        {data.awards.length === 0 ? (
          <p className="muted">No badges yet.</p>
        ) : (
          renderBadges(data.awards, data.featuredBadges)
        )}
      </section>
    </>
  );
}
