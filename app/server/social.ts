// Friends, leaderboards, and the par-time check.
//
// Friends: every account gets a private invite code. Sharing the link
// (…/profile/?friend=CODE) and having the other person accept makes a
// two-way friendship. No contact lists, no searching for people.
//
// Leaderboards: only daily puzzles count (everyone plays the same three a
// day). Privacy rule:
//   • Friends board → you + your friends.
//   • Global board  → only players who switched on "show me on global
//     leaderboards" AND have a @handle. You always see your own row, marked,
//     even if you haven't opted in (nobody else does).
//
// Par check (admins only, ADMIN_EMAILS): real median solve times per variant
// and level next to the current par, so par can be tuned as players join.
import express from "express";
import { randomBytes } from "node:crypto";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import type { PlayRecord } from "../src/game/records.js";
import type { Difficulty, Variant } from "../src/game/engine.js";
import { periodEnd, periodStart, type Period } from "../src/game/consistency.js";
import { COMPONENTS, PAR_SECONDS, boardRow, rank, type BoardView, type Component } from "../src/game/scoring.js";
import { consistency } from "../src/game/consistency.js";
import { evaluate } from "../src/game/achievements.js";

type Req = express.Request & { userId?: string };
type Row = Record<string, any>;
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const adapter = async () => (await auth.$context).adapter;
const sessionUser = async (req: express.Request) =>
  (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))?.user ?? null;

const newCode = () => randomBytes(6).toString("base64url"); // 8 chars, URL-safe
const publicPlayer = (u: Row) => ({
  id: u.id as string,
  name: (u.name as string) || "Player",
  handle: (u.handle ?? null) as string | null,
  image: (u.image ?? null) as string | null,
});

async function inviteCodeFor(userId: string): Promise<string> {
  const db = await adapter();
  const user = await db.findOne<Row>({ model: "user", where: [{ field: "id", value: userId }] });
  if (user?.inviteCode) return user.inviteCode;
  const code = newCode();
  await db.update({ model: "user", where: [{ field: "id", value: userId }], update: { inviteCode: code } });
  return code;
}

export async function friendIds(userId: string): Promise<string[]> {
  const db = await adapter();
  const rows = await db.findMany<Row>({ model: "friendship", where: [{ field: "userId", value: userId }], limit: 5000 });
  return rows.map((r) => r.friendId);
}

/** Removes every friendship and request that mentions this user (account deletion). */
export async function deleteFriendships(userId: string) {
  const db = await adapter();
  await db.deleteMany({ model: "friendship", where: [{ field: "userId", value: userId }] });
  await db.deleteMany({ model: "friendship", where: [{ field: "friendId", value: userId }] });
  await db.deleteMany({ model: "friendRequest", where: [{ field: "fromId", value: userId }] });
  await db.deleteMany({ model: "friendRequest", where: [{ field: "toId", value: userId }] });
}

async function clearRequests(a: string, b: string) {
  const db = await adapter();
  await db.deleteMany({ model: "friendRequest", where: [{ field: "fromId", value: a }, { field: "toId", value: b }] });
  await db.deleteMany({ model: "friendRequest", where: [{ field: "fromId", value: b }, { field: "toId", value: a }] });
}

async function befriend(a: string, b: string) {
  const db = await adapter();
  if (!(await friendIds(a)).includes(b)) {
    const createdAt = new Date();
    await db.create({ model: "friendship", data: { userId: a, friendId: b, createdAt } });
    await db.create({ model: "friendship", data: { userId: b, friendId: a, createdAt } });
  }
  await clearRequests(a, b);
}

export type Relationship = "self" | "friend" | "requested" | "incoming" | "none";
async function relationship(me: string | undefined, other: string): Promise<Relationship> {
  if (!me) return "none";
  if (me === other) return "self";
  if ((await friendIds(me)).includes(other)) return "friend";
  const db = await adapter();
  const req = await db.findMany<Row>({
    model: "friendRequest",
    where: [{ field: "fromId", value: [me, other], operator: "in" }, { field: "toId", value: [me, other], operator: "in" }],
    limit: 4,
  });
  if (req.some((r) => r.fromId === me && r.toId === other)) return "requested";
  if (req.some((r) => r.fromId === other && r.toId === me)) return "incoming";
  return "none";
}
/** Profiles are visible to yourself, friends, anyone you have a request
 *  with, and — for players on the everyone board — to all. */
const visible = (u: Row, rel: Relationship) =>
  rel !== "none" || (!!u.publicProfile && !!u.handle);

async function findPlayer(key: string): Promise<Row | null> {
  const db = await adapter();
  const handle = key.startsWith("@") ? key.slice(1) : key;
  if (/^[a-z0-9_]{3,20}$/.test(handle)) {
    const byHandle = await db.findOne<Row>({ model: "user", where: [{ field: "handle", value: handle }] });
    if (byHandle) return byHandle;
  }
  return db.findOne<Row>({ model: "user", where: [{ field: "id", value: key }] });
}

/** Routes that need a signed-in player (mounted under /me). */
export function friendRoutes(router: express.Router) {
  router.get("/me/friends", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const ids = await friendIds(req.userId!);
      const users = ids.length
        ? await db.findMany<Row>({ model: "user", where: [{ field: "id", value: ids, operator: "in" }], limit: 5000 })
        : [];
      const reqs = [
        ...(await db.findMany<Row>({ model: "friendRequest", where: [{ field: "toId", value: req.userId! }], limit: 500 })),
        ...(await db.findMany<Row>({ model: "friendRequest", where: [{ field: "fromId", value: req.userId! }], limit: 500 })),
      ];
      const otherIds = reqs.map((r) => (r.fromId === req.userId ? r.toId : r.fromId));
      const others = otherIds.length
        ? await db.findMany<Row>({ model: "user", where: [{ field: "id", value: otherIds, operator: "in" }], limit: 1000 })
        : [];
      const who = (id: string) => others.find((u) => u.id === id);
      res.json({
        inviteCode: await inviteCodeFor(req.userId!),
        friends: users.map(publicPlayer),
        incoming: reqs.filter((r) => r.toId === req.userId && who(r.fromId)).map((r) => publicPlayer(who(r.fromId)!)),
        outgoing: reqs.filter((r) => r.fromId === req.userId && who(r.toId)).map((r) => publicPlayer(who(r.toId)!)),
      });
    } catch (e) {
      next(e);
    }
  });

  // Accept a friend's invite code.
  router.post("/me/friends", async (req: Req, res, next) => {
    try {
      const code = req.body?.code;
      if (typeof code !== "string" || !/^[A-Za-z0-9_-]{6,16}$/.test(code)) fail("That invite code doesn’t look right.");
      const db = await adapter();
      const other = await db.findOne<Row>({ model: "user", where: [{ field: "inviteCode", value: code }] });
      if (!other) fail("That invite has expired or doesn’t exist. Ask your friend for a new link.", 404);
      if (other!.id === req.userId) fail("That’s your own invite link — send it to a friend instead.");
      await befriend(req.userId!, other!.id);
      res.json({ friend: publicPlayer(other!) });
    } catch (e) {
      next(e);
    }
  });

  router.delete("/me/friends/:id", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const a = req.userId!, b = String(req.params.id);
      await db.deleteMany({ model: "friendship", where: [{ field: "userId", value: a }, { field: "friendId", value: b }] });
      await db.deleteMany({ model: "friendship", where: [{ field: "userId", value: b }, { field: "friendId", value: a }] });
      res.json({ removed: true });
    } catch (e) {
      next(e);
    }
  });

  // Send a friend request from someone's profile. If they already asked
  // you, this accepts it and you're friends.
  router.post("/me/friend-requests", async (req: Req, res, next) => {
    try {
      const me = req.userId!, to = req.body?.userId;
      if (typeof to !== "string" || !to || to === me) fail("Choose someone to add.");
      const db = await adapter();
      const other = await db.findOne<Row>({ model: "user", where: [{ field: "id", value: to }] });
      const rel = other ? await relationship(me, other.id) : "none";
      if (!other || !visible(other, rel)) fail("That player can’t be found.", 404);
      if (rel === "incoming") await befriend(me, other!.id);
      else if (rel === "none")
        await db.create({ model: "friendRequest", data: { fromId: me, toId: other!.id, createdAt: new Date() } });
      res.json({ relationship: await relationship(me, other!.id) });
    } catch (e) {
      next(e);
    }
  });

  // Cancel a request you sent, or decline one you received.
  router.delete("/me/friend-requests/:id", async (req: Req, res, next) => {
    try {
      await clearRequests(req.userId!, String(req.params.id));
      res.json({ relationship: await relationship(req.userId!, String(req.params.id)) });
    } catch (e) {
      next(e);
    }
  });

  // New invite code; old links stop working. Existing friends stay.
  router.post("/me/friends/invite", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const code = newCode();
      await db.update({ model: "user", where: [{ field: "id", value: req.userId! }], update: { inviteCode: code } });
      res.json({ inviteCode: code });
    } catch (e) {
      next(e);
    }
  });
}

const PERIODS = ["week", "month", "year", "all"] as const;
const VIEWS: BoardView[] = ["points", "consistency", "speed", "accuracy", "independence"];
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function dailyRecords(userIds: string[], through: string): Promise<Map<string, PlayRecord[]>> {
  const out = new Map<string, PlayRecord[]>(userIds.map((id) => [id, []]));
  if (!userIds.length) return out;
  const db = await adapter();
  const rows = await db.findMany<Row>({
    model: "playRecord",
    where: [
      { field: "userId", value: userIds, operator: "in" },
      { field: "kind", value: "daily" },
      { field: "daily", value: through, operator: "lte" },
    ],
    limit: 200000,
  });
  for (const r of rows) out.get(r.userId)?.push(JSON.parse(r.data));
  return out;
}

/** Public-ish routes (mounted at /leaderboard and /admin). */
export function boardRoutes(router: express.Router) {
  // GET /api/leaderboard?period=week&scope=friends&view=points&today=YYYY-MM-DD
  //   &mix=speed,accuracy  (optional: a custom mix of score components)
  router.get("/leaderboard", async (req, res, next) => {
    try {
      const q = req.query;
      const period = (PERIODS as readonly string[]).includes(String(q.period)) ? (String(q.period) as Period | "all") : "week";
      const scope = q.scope === "global" ? "global" : "friends";
      const view = VIEWS.includes(q.view as BoardView) ? (q.view as BoardView) : "points";
      const today = isDay(q.today) ? q.today : new Date().toISOString().slice(0, 10);
      const mix = String(q.mix || "").split(",").filter((c): c is Component => COMPONENTS.includes(c as Component));
      const enabled = mix.length ? mix : COMPONENTS;

      const me = await sessionUser(req);
      if (scope === "friends" && !me) fail("Sign in to see your friends’ board.", 401);

      const db = await adapter();
      let users: Row[];
      if (scope === "friends") {
        const ids = [me!.id, ...(await friendIds(me!.id))];
        users = await db.findMany<Row>({ model: "user", where: [{ field: "id", value: ids, operator: "in" }], limit: 5000 });
      } else {
        users = (await db.findMany<Row>({ model: "user", where: [{ field: "publicProfile", value: true }], limit: 5000 }))
          .filter((u) => !!u.handle);
        if (me && !users.some((u) => u.id === me.id)) {
          const mine = await db.findOne<Row>({ model: "user", where: [{ field: "id", value: me.id }] });
          if (mine) users.push(mine);
        }
      }
      const through = period === "all" ? today : periodEnd(period, today);
      const records = await dailyRecords(users.map((u) => u.id), through);
      const rows = rank(
        users.map((u) => ({
          player: publicPlayer(u),
          you: u.id === me?.id,
          hidden: scope === "global" && u.id === me?.id && !(u.publicProfile && u.handle),
          row: boardRow(records.get(u.id) || [], period, today, enabled),
        })),
        view,
      ).filter((p) => p.row.dailies > 0 || p.you);
      res.json({
        period, scope, view, today,
        start: period === "all" ? null : periodStart(period, today),
        end: period === "all" ? null : periodEnd(period, today),
        components: enabled,
        players: rows.map((p, i) => ({ rank: i + 1, ...p })),
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/players/:key?today=YYYY-MM-DD — someone's public profile
  // (key = @handle or id). Summary stats and badges only, never raw games.
  router.get("/players/:key", async (req, res, next) => {
    try {
      const me = await sessionUser(req);
      const u = await findPlayer(String(req.params.key));
      const rel = u ? await relationship(me?.id, u.id) : "none";
      if (!u || !visible(u, rel)) fail("This profile is private or doesn’t exist.", 404);
      const today = isDay(req.query.today) ? req.query.today : new Date().toISOString().slice(0, 10);
      const db = await adapter();
      const rows = await db.findMany<Row>({ model: "playRecord", where: [{ field: "userId", value: u!.id }], limit: 100000 });
      const records = rows
        .map((r) => JSON.parse(r.data) as PlayRecord)
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
      const awards = new Map<string, { id: string; count: number; lastEarnedAt: string }>();
      for (const a of evaluate({ records, today })) {
        const cur = awards.get(a.id);
        awards.set(a.id, { id: a.id, count: (cur?.count ?? 0) + 1, lastEarnedAt: a.earnedAt });
      }
      let featured: string[] = [];
      try { featured = u!.featuredBadges ? JSON.parse(u!.featuredBadges) : []; } catch { /* ignore */ }
      const period = (p: Period) => {
        const c = consistency(records, p, today);
        return { played: c.played, elapsed: c.elapsed, percent: c.percent };
      };
      res.json({
        player: { ...publicPlayer(u!), joined: u!.createdAt },
        relationship: rel,
        featuredBadges: featured,
        awards: [...awards.values()],
        consistency: { week: period("week"), month: period("month"), year: period("year") },
        week: boardRow(records, "week", today),
        month: boardRow(records, "month", today),
        totals: { puzzles: records.length, dailies: records.filter((r) => r.kind === "daily").length },
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/admin/par — real solve times vs the current par values.
  router.get("/admin/par", async (req, res, next) => {
    try {
      const me = await sessionUser(req);
      const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!me || !admins.includes(me.email.toLowerCase())) fail("Not found.", 404);
      const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const db = await adapter();
      const rows = await db.findMany<Row>({
        model: "playRecord",
        where: [{ field: "kind", value: "daily" }, { field: "daily", value: since, operator: "gte" }],
        limit: 500000,
      });
      res.json({ since, days, ...parReport(rows.map((r) => ({ ...(JSON.parse(r.data) as PlayRecord), userId: r.userId }))) });
    } catch (e) {
      next(e);
    }
  });
}

/* ---- par report (exported for tests) ---- */
export const PAR_MIN_PLAYS = 30; // don't suggest changes from a handful of games
export const PAR_DRIFT = 0.2; // suggest a change when the median is 20%+ off par
const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
};
export type ParLine = {
  variant: Variant; difficulty: Difficulty; par: number;
  plays: number; players: number; unassistedPlays: number;
  median: number | null; p25: number | null; p75: number | null;
  medianSpeedScore: number | null; // what a typical solve earns for speed (0–100); ~50 means par fits
  status: "not-enough-data" | "ok" | "par-too-fast" | "par-too-slow";
  suggestedPar: number | null;
};
export function parReport(records: (PlayRecord & { userId?: string })[]) {
  const lines: ParLine[] = [];
  for (const variant of Object.keys(PAR_SECONDS) as Variant[])
    for (const difficulty of Object.keys(PAR_SECONDS[variant]) as Difficulty[]) {
      const par = PAR_SECONDS[variant][difficulty];
      const all = records.filter((r) => r.variant === variant && r.difficulty === difficulty);
      // Unassisted solves are the fairest yardstick; fall back to all when few.
      const clean = all.filter((r) => !r.assisted);
      const basis = (clean.length >= PAR_MIN_PLAYS ? clean : all).map((r) => r.seconds).sort((a, b) => a - b);
      const median = quantile(basis, 0.5);
      let status: ParLine["status"] = "not-enough-data";
      let suggestedPar: number | null = null;
      if (median !== null && basis.length >= PAR_MIN_PLAYS) {
        const drift = (median - par) / par;
        status = drift > PAR_DRIFT ? "par-too-fast" : drift < -PAR_DRIFT ? "par-too-slow" : "ok";
        if (status !== "ok") suggestedPar = Math.round(median / 30) * 30;
      }
      lines.push({
        variant, difficulty, par,
        plays: all.length,
        players: new Set(all.map((r) => r.userId)).size,
        unassistedPlays: clean.length,
        median, p25: quantile(basis, 0.25), p75: quantile(basis, 0.75),
        medianSpeedScore: median === null ? null : Math.round((100 * par) / (par + median)),
        status, suggestedPar,
      });
    }
  return { minPlays: PAR_MIN_PLAYS, drift: PAR_DRIFT, lines };
}
