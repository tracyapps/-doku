import express from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createStore } from "./store.js";
import { createPuzzle } from "../src/game/engine.js";
import { toNodeHandler } from "better-auth/node";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const variants = ["classic", "hue", "jigsaw"];
const difficulties = ["easy", "medium", "hard"];
async function loadAccounts() {
  try {
    const { auth } = await import("./auth.js");
    const { accountRouter } = await import("./account.js");
    return { handler: toNodeHandler(auth), router: accountRouter() };
  } catch (error) {
    console.warn("Accounts disabled:", (error as Error).message);
    return null;
  }
}
export function makeApp(store = createStore()) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const limits = new Map<string, { count: number; until: number }>();
  app.use("/api", (req, res, next) => {
    const now = Date.now();
    if (limits.size > 10000)
      for (const [key, item] of limits)
        if (item.until < now) limits.delete(key);
    const key = req.ip || "local";
    let item = limits.get(key);
    if (!item || item.until < now) {
      item = { count: 0, until: now + 60000 };
      limits.set(key, item);
    }
    if (++item.count > 120) {
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    next();
  });
  // Accounts are optional and load lazily, so a missing DATABASE_URL on a
  // deployment only disables sign-in instead of taking the game offline.
  const accounts = loadAccounts();
  app.all("/api/auth/*splat", async (req, res, next) => {
    try {
      const a = await accounts;
      if (!a) fail("Accounts aren't set up on this server yet.", 503);
      // Awaited so a failure (e.g. database tables not migrated) becomes an
      // error response instead of an unhandled rejection that hangs the request.
      await a!.handler(req, res);
    } catch (e) {
      console.error("Auth request failed:", e);
      if ((e as { code?: string }).code === "SCHEMA_MISMATCH")
        return next(Object.assign(new Error("Accounts are being set up. Please try again later."), { status: 503 }));
      next(e);
    }
  });
  // Better Auth reads the raw body itself, so JSON parsing starts after it.
  const smallJson = express.json({ limit: "256kb" }),
    syncJson = express.json({ limit: "4mb" }); // record sync can be large once
  app.use((req, res, next) =>
    (req.path === "/api/me/records" ? syncJson : smallJson)(req, res, next),
  );
  app.use("/api", async (req, res, next) => {
    if (
      !req.path.startsWith("/me") &&
      !req.path.startsWith("/admin/") &&
      req.path !== "/leaderboard" &&
      !req.path.startsWith("/players/") &&
      req.path !== "/account/config"
    )
      return next();
    const a = await accounts;
    if (!a) {
      if (req.path === "/account/config") return void res.json({ enabled: false, providers: {} });
      return void res.status(503).json({ error: "Accounts aren't set up on this server yet." });
    }
    a.router(req, res, next);
  });
  app.get("/api/health", (_req, res) => {
    if (process.env.VERCEL && store.mode === "local-file") {
      res
        .status(503)
        .json({ ok: false, error: "DATABASE_URL required on Vercel" });
      return;
    }
    res.json({
      ok: true,
      storage: store.mode,
      discordConfigured: Boolean(
        process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
      ),
    });
  });
  app.get("/api/roadmap", async (_req, res, next) => {
    try {
      const repository = (
        process.env.GITHUB_REPO ||
        process.env.VITE_GITHUB_REPO ||
        ""
      ).trim();
      if (!repository) {
        res.json({ configured: false, issues: [] });
        return;
      }
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
        fail("GITHUB_REPO must use owner/repository format", 503);
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "wildcard-doku-roadmap",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (process.env.GITHUB_TOKEN)
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const response = await fetch(
        `https://api.github.com/repos/${repository}/issues?state=all&labels=roadmap&per_page=100`,
        { headers, signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok) fail("Roadmap is temporarily unavailable", 502);
      const data = (await response.json()) as Array<{
        id: number;
        number: number;
        title: string;
        body: string | null;
        html_url: string;
        state: "open" | "closed";
        updated_at: string;
        labels: Array<string | { name?: string }>;
        pull_request?: unknown;
      }>;
      const issues = data
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || "",
          url: issue.html_url,
          state: issue.state,
          updatedAt: issue.updated_at,
          labels: issue.labels
            .map((label) =>
              typeof label === "string" ? label : label.name || "",
            )
            .filter(Boolean),
        }));
      res.set(
        "Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=3600",
      );
      res.json({
        configured: true,
        repository,
        repositoryUrl: `https://github.com/${repository}`,
        issues,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/challenges", async (req, res, next) => {
    try {
      const { seed, variant } = req.body;
      if (
        typeof seed !== "string" ||
        !seed.length ||
        seed.length > 100 ||
        !variants.includes(variant)
      )
        fail("Invalid puzzle seed or variant");
      const challenge = {
        id: randomUUID(),
        seed,
        variant,
        createdAt: new Date().toISOString(),
        results: [],
      };
      await store.transaction((db) => {
        db.challenges[challenge.id] = challenge;
      });
      res.status(201).json(challenge);
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/challenges/:id", async (req, res, next) => {
    try {
      const item = await store.transaction(
        (db) =>
          db.challenges[req.params.id] || fail("Challenge not found", 404),
      );
      res.json(item);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/challenges/:id/attempts", async (req, res, next) => {
    try {
      const { difficulty, name } = req.body;
      if (
        !difficulties.includes(difficulty) ||
        (name !== undefined && (typeof name !== "string" || name.length > 40))
      )
        fail("Invalid difficulty or name");
      const token = randomBytes(32).toString("hex");
      const data = await store.transaction((db) => {
        const challenge =
          db.challenges[req.params.id] || fail("Challenge not found", 404);
        const puzzle = createPuzzle(
          challenge.seed,
          challenge.variant,
          difficulty,
        );
        const attemptId = randomUUID();
        db.attempts[attemptId] = {
          id: attemptId,
          challengeId: challenge.id,
          difficulty,
          name: name?.trim() || `Player ${attemptId.slice(0, 6)}`,
          tokenHash: hash(token),
          createdAt: Date.now(),
        };
        const { solution, ...publicPuzzle } = puzzle;
        return { attemptId, token, puzzle: publicPuzzle };
      });
      res.status(201).json(data);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/challenges/:id/results", async (req, res, next) => {
    try {
      const { attemptId, token, actions, elapsedSeconds } = req.body;
      if (
        typeof token !== "string" ||
        token.length !== 64 ||
        typeof attemptId !== "string" ||
        !Array.isArray(actions) ||
        actions.length > 10000 ||
        !Number.isFinite(elapsedSeconds) ||
        elapsedSeconds < 0 ||
        elapsedSeconds > 31536000
      )
        fail("Invalid result payload");
      const result = await store.transaction((db) => {
        const attempt = db.attempts[attemptId];
        if (
          !attempt ||
          attempt.challengeId !== req.params.id ||
          attempt.tokenHash !== hash(token)
        )
          fail("Invalid attempt credentials", 401);
        if (attempt.result) return attempt.result;
        const challenge = db.challenges[req.params.id];
        const puzzle = createPuzzle(
          challenge.seed,
          challenge.variant,
          attempt.difficulty,
        );
        const board = [...puzzle.givens];
        const first = new Map<number, boolean>();
        const revealed = new Set<number>();
        let hints = 0,
          checks = 0,
          autofills = 0,
          reveals = 0,
          autocheck = false,
          conflicts = false;
        for (const action of actions) {
          if (!action || typeof action !== "object") fail("Invalid action");
          if (action.kind === "autofill") {
            autofills++;
            continue;
          }
          if (
            action.kind === "conflicts" &&
            typeof action.enabled === "boolean"
          ) {
            if (action.enabled) conflicts = true;
            continue;
          }
          if (action.kind === "check") {
            checks++;
            continue;
          }
          if (
            action.kind === "autocheck" &&
            typeof action.enabled === "boolean"
          ) {
            if (action.enabled) autocheck = true;
            continue;
          }
          if (
            !["set", "hint", "reveal"].includes(action.kind) ||
            !Number.isInteger(action.cell) ||
            action.cell < 0 ||
            action.cell > 80 ||
            puzzle.givens[action.cell]
          )
            fail("Invalid cell action");
          if (action.kind === "hint") {
            hints++;
            continue;
          }
          if (action.kind === "reveal") {
            board[action.cell] = puzzle.solution[action.cell];
            reveals++;
            revealed.add(action.cell);
            first.delete(action.cell);
            continue;
          }
          if (
            !Number.isInteger(action.value) ||
            action.value < 0 ||
            action.value > 9
          )
            fail("Invalid value");
          if (
            action.value &&
            !revealed.has(action.cell) &&
            !first.has(action.cell)
          )
            first.set(
              action.cell,
              action.value === puzzle.solution[action.cell],
            );
          board[action.cell] = action.value;
        }
        if (!board.every((value, index) => value === puzzle.solution[index]))
          fail("Puzzle is not solved");
        const accuracy = first.size
          ? Math.round(
              ([...first.values()].filter(Boolean).length / first.size) * 100,
            )
          : null;
        const result = {
          id: attemptId,
          name: attempt.name,
          difficulty: attempt.difficulty,
          elapsedSeconds,
          accuracy,
          hints,
          checks,
          autocheck,
          autofills,
          reveals,
          conflicts,
          assisted: Boolean(
            hints || checks || autofills || reveals || autocheck || conflicts,
          ),
          verification: "self-reported",
          completedAt: new Date().toISOString(),
        };
        attempt.result = result;
        challenge.results.push(result);
        return result;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/discord/token", async (req, res, next) => {
    try {
      if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)
        fail("Discord is not configured", 503);
      if (typeof req.body.code !== "string" || req.body.code.length > 2048)
        fail("Invalid authorization code");
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID!,
          client_secret: process.env.DISCORD_CLIENT_SECRET!,
          grant_type: "authorization_code",
          code: req.body.code,
        }),
      });
      if (!response.ok) fail("Discord authorization failed", 401);
      const data = (await response.json()) as { access_token: string };
      res.json({ access_token: data.access_token });
    } catch (e) {
      next(e);
    }
  });
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : "Service unavailable. Please try again.",
      });
    },
  );
  return app;
}
export const app = makeApp();
