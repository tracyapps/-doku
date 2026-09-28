// Profile sections for signed-in players: friends (invite link, list),
// the everyone-leaderboard opt-in, and — for admins only — the par check.
import { useEffect, useState } from "react";
import {
  addFriend, cancelFriendRequest, getFriends, playerPath, sendFriendRequest, getParReport, inviteLink, newInviteCode, removeFriend, updateProfile,
  type Friend, type ParLine, type Profile,
} from "../game/account.js";
import { formatTime } from "../game/session.js";
import "./social.css";

export function FriendsPanel({
  profile, onProfile, notify, onOpenPlayer,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
  notify: (m: string) => void;
  onOpenPlayer: (p: { id: string; handle: string | null }) => void;
}) {
  const [code, setCode] = useState("");
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [incoming, setIncoming] = useState<Friend[]>([]);
  const [outgoing, setOutgoing] = useState<Friend[]>([]);
  const [entry, setEntry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = () =>
    getFriends()
      .then((r) => {
        setCode(r.inviteCode);
        setFriends(r.friends);
        setIncoming(r.incoming ?? []);
        setOutgoing(r.outgoing ?? []);
      })
      .catch((e: Error) => setNote(e.message));
  useEffect(() => { void load(); }, [profile.id]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote("");
    try { await fn(); } catch (e) { setNote(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };
  const link = code ? inviteLink(code) : "";
  const share = () =>
    act(async () => {
      const text = "Play *doku with me — tap to add me as a friend:";
      if (navigator.share) {
        try { await navigator.share({ title: "*doku", text, url: link }); return; }
        catch (e) { if ((e as DOMException).name === "AbortError") return; }
      }
      await navigator.clipboard.writeText(link);
      notify("Invite link copied.");
    });
  const canGoPublic = !!profile.handle;

  return (
    <>
      <section className="account-card social-card" aria-labelledby="friends-title">
        <h2 id="friends-title">Friends</h2>
        <p className="muted">
          Send your invite link to someone you know. When they open it and sign in, you’re friends — and you’ll
          see each other on the friends leaderboard.
        </p>
        <div className="invite-row">
          <input className="invite-link" readOnly value={link || "Loading…"} aria-label="Your invite link"
            onFocus={(e) => e.currentTarget.select()} />
          <button className="primary" disabled={!link || busy} onClick={share}>Share invite</button>
        </div>
        <button className="text-button" disabled={busy || !code}
          onClick={() => act(async () => { setCode(await newInviteCode()); notify("New invite link made. The old one no longer works."); })}>
          Make a new link (old one stops working)
        </button>

        <form className="account-form" onSubmit={(e) => {
          e.preventDefault();
          const c = entry.trim().split("friend=").pop() || "";
          void act(async () => {
            const f = await addFriend(c);
            setEntry("");
            notify(`You and ${f.name} are now friends.`);
            await load();
          });
        }}>
          <label htmlFor="friend-code">Got a friend’s link or code?</label>
          <div className="account-row">
            <input id="friend-code" value={entry} onChange={(e) => setEntry(e.target.value)} autoComplete="off" required />
            <button className="secondary" type="submit" disabled={busy}>Add friend</button>
          </div>
        </form>

        {incoming.length > 0 && (
          <>
            <h3 className="request-title">Friend requests</h3>
            <ul className="friend-rows request-rows" aria-label="Friend requests">
              {incoming.map((f) => (
                <li key={f.id}>
                  <span><PlayerLink f={f} open={onOpenPlayer} /> wants to be friends</span>
                  <span className="request-actions">
                    <button className="secondary" disabled={busy}
                      onClick={() => act(async () => { await sendFriendRequest(f.id); notify(`You and ${f.name} are now friends.`); await load(); })}>
                      Accept
                    </button>
                    <button className="text-button" disabled={busy}
                      onClick={() => act(async () => { await cancelFriendRequest(f.id); await load(); })}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {outgoing.length > 0 && (
          <ul className="friend-rows" aria-label="Requests you sent">
            {outgoing.map((f) => (
              <li key={f.id}>
                <span><PlayerLink f={f} open={onOpenPlayer} /> <small>· request sent</small></span>
                <button className="text-button" disabled={busy}
                  onClick={() => act(async () => { await cancelFriendRequest(f.id); await load(); })}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
        {friends && (
          friends.length === 0 ? (
            <p className="fine-print">No friends added yet.</p>
          ) : (
            <ul className="friend-rows" aria-label="Your friends">
              {friends.map((f) => (
                <li key={f.id}>
                  <span>
                    <PlayerLink f={f} open={onOpenPlayer} />
                    {f.handle && <small> @{f.handle}</small>}
                  </span>
                  {confirmRemove === f.id ? (
                    <span className="friend-confirm">
                      <button className="text-button danger-link" disabled={busy}
                        onClick={() => act(async () => { await removeFriend(f.id); setConfirmRemove(null); await load(); })}>
                        Remove {f.name}
                      </button>
                      <button className="text-button" onClick={() => setConfirmRemove(null)}>Keep</button>
                    </span>
                  ) : (
                    <span className="request-actions">
                      <a className="text-button" href={playerPath(f)} aria-label={`View ${f.name}’s profile`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          onOpenPlayer(f);
                        }}>
                        View profile
                      </a>
                      <button className="text-button" onClick={() => setConfirmRemove(f.id)} aria-label={`Remove ${f.name}`}>Remove</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        {note && <p className="lb-error" role="alert">{note}</p>}
      </section>

      <section className="account-card social-card" aria-labelledby="public-title">
        <h2 id="public-title">Everyone leaderboard</h2>
        <label className="setting-row">
          <span>
            Show me on the everyone leaderboard
            <small>
              {canGoPublic
                ? `Others will see your name, @${profile.handle}, and daily puzzle results. Friends always see you on the friends board.`
                : "Choose a @handle above first. Until then, only friends can see you."}
            </small>
          </span>
          <button type="button" role="switch" aria-checked={profile.publicProfile}
            aria-label="Show me on the everyone leaderboard"
            disabled={busy || (!canGoPublic && !profile.publicProfile)}
            className={`switch ${profile.publicProfile ? "on" : ""}`}
            onClick={() => act(async () => onProfile(await updateProfile({ publicProfile: !profile.publicProfile })))}>
            <span />
          </button>
        </label>
      </section>

      <ParCheck />
    </>
  );
}

function PlayerLink({ f, open }: { f: Friend; open: (p: Friend) => void }) {
  return (
    <a
      className="player-link"
      href={playerPath(f)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        open(f);
      }}
    >
      <strong>{f.name}</strong>
      <span className="sr-only">, view profile</span>
    </a>
  );
}

/** Only renders for admins (ADMIN_EMAILS on the server). */
function ParCheck() {
  const [report, setReport] = useState<Awaited<ReturnType<typeof getParReport>>>(null);
  useEffect(() => { void getParReport().then(setReport); }, []);
  if (!report) return null;
  const status: Record<ParLine["status"], string> = {
    "not-enough-data": "Not enough plays yet",
    ok: "Par fits",
    "par-too-fast": "Par is too fast",
    "par-too-slow": "Par is too slow",
  };
  const t = (s: number | null) => (s == null ? "—" : formatTime(s));
  return (
    <section className="account-card social-card" aria-labelledby="par-title">
      <h2 id="par-title">Par check <small className="muted">(admin)</small></h2>
      <p className="muted">
        Daily puzzles from the last {report.days} days. Par should sit near the typical (median) solve time, so a
        typical solve earns about 50 speed. A change is suggested once a level has {report.minPlays}+ plays and the
        median is more than {Math.round(report.drift * 100)}% away from par. Unassisted solves are used when there are enough.
      </p>
      <div className="par-scroll">
        <table className="par-table">
          <thead>
            <tr><th scope="col">Puzzle</th><th scope="col">Par</th><th scope="col">Median</th><th scope="col">Middle half</th>
              <th scope="col">Plays</th><th scope="col">Typical speed</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {report.lines.map((l) => (
              <tr key={`${l.variant}-${l.difficulty}`} className={l.status}>
                <th scope="row">{l.variant} · {l.difficulty}</th>
                <td>{t(l.par)}</td>
                <td>{t(l.median)}</td>
                <td>{l.p25 == null ? "—" : `${t(l.p25)}–${t(l.p75)}`}</td>
                <td>{l.plays} <small>({l.players} ppl)</small></td>
                <td>{l.medianSpeedScore ?? "—"}</td>
                <td>{status[l.status]}{l.suggestedPar != null && <small> → try {t(l.suggestedPar)}</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine-print">To change par, edit PAR_SECONDS in src/game/scoring.ts. Scores are recalculated from saved results, so past boards update too.</p>
    </section>
  );
}
