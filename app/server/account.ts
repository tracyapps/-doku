// Signed-in player endpoints: profile, synced play records, export, delete.
// Every route here requires a session (cookie or bearer token).
import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, accountProviders } from "./auth.js";
import type { PlayRecord } from "../src/game/records.js";

type Req = express.Request & { userId?: string };
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const adapter = async () => (await auth.$context).adapter;

const KINDS = ["daily", "free", "challenge"], VARIANTS = ["classic", "hue", "jigsaw"], LEVELS = ["easy", "medium", "hard"];
const iso = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const day = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 100000;

/** Shape check only. Results are self-reported (friendly comparison). */
export function validRecord(r: any): r is PlayRecord {
  return (
    r && typeof r === "object" &&
    typeof r.id === "string" && r.id.length > 0 && r.id.length <= 64 &&
    KINDS.includes(r.kind) && VARIANTS.includes(r.variant) && LEVELS.includes(r.difficulty) &&
    typeof r.seed === "string" && r.seed.length <= 120 &&
    (r.kind !== "daily" || (day(r.daily) && r.seed === `daily:${r.daily}:${r.difficulty}`)) &&
    Number.isInteger(r.seconds) && r.seconds >= 1 && r.seconds < 86400 * 7 &&
    (r.accuracy === null || (Number.isInteger(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100)) &&
    [r.hints, r.checks, r.reveals, r.autofills].every(count) &&
    typeof r.assisted === "boolean" && iso(r.startedAt) && iso(r.completedAt) &&
    day(r.localDate) && Number.isInteger(r.startHour) && r.startHour >= 0 && r.startHour <= 23
  );
}

export function accountRouter() {
  const router = express.Router();

  // Which sign-in buttons to show. Public.
  router.get("/account/config", (_req, res) => {
    res.json({ enabled: true, providers: accountProviders() });
  });

  // Everything below needs a session.
  router.use("/me", async (req: Req, _res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) fail("Sign in to continue.", 401);
      req.userId = session!.user.id;
      next();
    } catch (e) {
      next(e);
    }
  });

  router.get("/me", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const user = await db.findOne<Record<string, any>>({ model: "user", where: [{ field: "id", value: req.userId! }] });
      if (!user) fail("Account not found.", 404);
      res.json({ profile: profileOut(user!) });
    } catch (e) {
      next(e);
    }
  });

  router.put("/me/profile", async (req: Req, res, next) => {
    try {
      const { name, handle, featuredBadges, publicProfile } = req.body ?? {};
      const update: Record<string, unknown> = {};
      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim() || name.length > 40) fail("Names can be 1–40 characters.");
        update.name = name.trim();
      }
      if (handle !== undefined) {
        if (handle === null || handle === "") update.handle = null;
        else {
          if (typeof handle !== "string" || !/^[a-z0-9_]{3,20}$/.test(handle))
            fail("Handles use 3–20 lowercase letters, numbers, or underscores.");
          const db = await adapter();
          const taken = await db.findOne<{ id: string }>({ model: "user", where: [{ field: "handle", value: handle }] });
          if (taken && taken.id !== req.userId) fail("That handle is taken.", 409);
          update.handle = handle;
        }
      }
      if (featuredBadges !== undefined) {
        if (!Array.isArray(featuredBadges) || featuredBadges.length > 3 || !featuredBadges.every((b) => typeof b === "string" && b.length <= 60))
          fail("Choose up to three badges.");
        update.featuredBadges = JSON.stringify(featuredBadges);
      }
      if (publicProfile !== undefined) {
        if (typeof publicProfile !== "boolean") fail("Invalid setting.");
        update.publicProfile = publicProfile;
      }
      const db = await adapter();
      const user = await db.update<Record<string, any>>({ model: "user", where: [{ field: "id", value: req.userId! }], update: { ...update, updatedAt: new Date() } });
      res.json({ profile: profileOut(user!) });
    } catch (e) {
      next(e);
    }
  });

  // Sync: the client sends any records the server might not have; the
  // server stores new ones (by id) and returns the complete list.
  router.post("/me/records", async (req: Req, res, next) => {
    try {
      const incoming = req.body?.records;
      if (!Array.isArray(incoming) || incoming.length > 5000) fail("Invalid records.");
      const valid: PlayRecord[] = (incoming as unknown[]).filter(validRecord);
      const db = await adapter();
      const existing = await loadRecords(req.userId!);
      const have = new Set(existing.map((r) => r.id));
      const fresh = valid.filter((r) => !have.has(r.id) && (have.add(r.id), true));
      for (const r of fresh)
        await db.create({
          model: "playRecord",
          forceAllowId: true,
          data: {
            id: `${req.userId}:${r.id}`,
            userId: req.userId!, recordId: r.id, kind: r.kind, daily: r.daily ?? null,
            variant: r.variant, difficulty: r.difficulty, completedAt: new Date(r.completedAt),
            data: JSON.stringify(r),
          },
        });
      res.json({ added: fresh.length, rejected: incoming.length - valid.length, records: [...existing, ...fresh].sort(byTime) });
    } catch (e) {
      next(e);
    }
  });

  router.get("/me/records", async (req: Req, res, next) => {
    try {
      res.json({ records: await loadRecords(req.userId!) });
    } catch (e) {
      next(e);
    }
  });

  // Your data, all of it, as JSON.
  router.get("/me/export", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const user = await db.findOne<Record<string, any>>({ model: "user", where: [{ field: "id", value: req.userId! }] });
      res.set("Content-Disposition", 'attachment; filename="doku-data.json"');
      res.json({ exportedAt: new Date().toISOString(), profile: { ...profileOut(user!), email: user!.email }, records: await loadRecords(req.userId!) });
    } catch (e) {
      next(e);
    }
  });

  // Delete the account and everything tied to it. Local guest data on the
  // device is left alone.
  router.delete("/me", async (req: Req, res, next) => {
    try {
      const db = await adapter();
      const id = req.userId!;
      for (const model of ["playRecord", "passkey", "session", "account"])
        await db.deleteMany({ model, where: [{ field: "userId", value: id }] });
      await db.delete({ model: "user", where: [{ field: "id", value: id }] });
      res.json({ deleted: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

const byTime = (a: PlayRecord, b: PlayRecord) => a.completedAt.localeCompare(b.completedAt);

async function loadRecords(userId: string): Promise<PlayRecord[]> {
  const db = await adapter();
  const rows = await db.findMany<{ data: string }>({ model: "playRecord", where: [{ field: "userId", value: userId }], limit: 100000 });
  return rows.map((r) => JSON.parse(r.data) as PlayRecord).sort(byTime);
}

function profileOut(u: Record<string, any>) {
  let featured: string[] = [];
  try { featured = u.featuredBadges ? JSON.parse(u.featuredBadges) : []; } catch { /* ignore */ }
  return {
    id: u.id as string,
    name: u.name as string,
    email: u.email as string,
    handle: (u.handle ?? null) as string | null,
    image: (u.image ?? null) as string | null,
    featuredBadges: featured,
    publicProfile: !!u.publicProfile,
    createdAt: u.createdAt,
  };
}
