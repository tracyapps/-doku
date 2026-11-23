import express from "express";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import catalog from "../src/testing/catalog.json" with { type: "json" };
import {
  createPlaytestStore,
  type PlaytestStore,
  type TestResponse,
} from "./playtest-store.js";
const fail = (message: string, status = 400): never => {
  throw Object.assign(Error(message), { status });
};
const models = new Set(catalog.models.map((m) => m.id)),
  samples = new Map(catalog.samples.map((s) => [s.id, s.model]));
const sign = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("base64url");
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const allowedMimes = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);
function ownerAuthorized(req:express.Request){
  const key=process.env.PLAYTEST_OWNER_KEY,authorization=req.get('authorization')||'';
  return !!key&&authorization.length===('Bearer '+key).length&&timingSafeEqual(Buffer.from(authorization),Buffer.from('Bearer '+key));
}
const audioValid = (b: Buffer, mime: string) =>
  mime === "audio/webm"
    ? b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : mime === "audio/ogg"
      ? b.subarray(0, 4).toString() === "OggS"
      : mime === "audio/wav"
        ? b.subarray(0, 4).toString() === "RIFF" &&
          b.subarray(8, 12).toString() === "WAVE"
        : b.subarray(4, 8).toString() === "ftyp";
export function playtestingRouter(
  options: {
    store?: PlaytestStore;
    now?: () => number;
    minimumAgeMs?: number;
    audioAudience?: "public" | "private";
  } = {},
) {
  const router = express.Router(),
    store = options.store || createPlaytestStore(),
    now = options.now || Date.now,
    minimum = options.minimumAgeMs ?? 4000;
  const audience =
    options.audioAudience ||
    (process.env.PLAYTEST_AUDIO_AUDIENCE === "private" ? "private" : "public");
  router.use(express.json({ limit: "3mb" }));
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    if (req.method !== "GET" && req.headers.origin) {
      let origin: string;
      try {
        origin = new URL(req.headers.origin).host;
      } catch {
        return next(Object.assign(Error("Invalid origin"), { status: 403 }));
      }
      if (origin !== req.get("host"))
        return next(
          Object.assign(Error("Use this testing site to send feedback"), {
            status: 403,
          }),
        );
    }
    next();
  });
  async function identity(req: express.Request) {
    const secret = await store.secret();
    const ip = process.env.VERCEL
      ? String(
          req.headers["x-vercel-forwarded-for"] || req.ip || "unknown",
        ).split(",")[0]
      : req.ip || "local";
    return { secret, key: sign(catalog.round + ":" + ip, secret).slice(0, 32) };
  }
  router.get("/config", (_req, res) =>
    res.json({
      round: catalog.round,
      audioAudience: audience,
      maxAudioBytes: 2 * 1024 * 1024,
      maxActiveSeconds: 300,
      publicResults: true,
    }),
  );
  router.get("/ticket", async (req, res, next) => {
    try {
      const { secret, key } = await identity(req);
      if (!(await store.limit("tickets:" + key, 80, 3600000, now())))
        fail("Please wait before requesting another submission check.", 429);
      const payload = Buffer.from(
        JSON.stringify({
          id: randomUUID(),
          issued: now(),
          key,
          nonce: randomBytes(16).toString("hex"),
        }),
      ).toString("base64url");
      res.json({
        ticket: payload + "." + sign(payload, secret),
        workPrefix: "000",
        expiresIn: 7200,
      });
    } catch (e) {
      next(e);
    }
  });
  router.post("/responses", async (req, res, next) => {
    try {
      const { secret, key } = await identity(req),
        b = req.body || {};
      // Owner-only deployment checks exercise real storage without becoming tester opinions.
      if(b.setupCheck===true&&!ownerAuthorized(req))fail('Owner access required for a setup check',403);
      if (b.website) fail("Submission could not be accepted");
      if (typeof b.ticket !== "string" || b.ticket.length > 1000)
        fail("Refresh the submission check");
      const [payload, signature] = b.ticket.split("."),
        expected = sign(payload, secret);
      if (
        !signature ||
        signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        fail("Invalid submission check", 403);
      let t: any;
      try {
        t = JSON.parse(Buffer.from(payload, "base64url").toString());
      } catch {
        fail("Invalid submission check");
      }
      if (
        t.key !== key ||
        typeof t.issued !== "number" ||
        now() - t.issued < minimum ||
        now() - t.issued > 7200000
      )
        fail(
          "This submission check expired or was sent too quickly. Please try again.",
          403,
        );
      if (
        !Number.isSafeInteger(b.work) ||
        b.work < 0 ||
        b.work > 10000000 ||
        !createHash("sha256")
          .update(t.nonce + ":" + b.work)
          .digest("hex")
          .startsWith("000")
      )
        fail("Browser submission check failed", 403);
      if (b.publicConsent !== true)
        fail("Confirm that your feedback may appear in the public results");
      if (b.round !== catalog.round || !["example", "ranking", "game"].includes(b.kind))
        fail("Unknown testing round");
      const model = text(b.model, 50),
        sample = text(b.sample, 80);
      if (
        b.kind === "example" &&
        (!models.has(model) || samples.get(sample) !== model)
      )
        fail("Unknown testing example");
      const inGame = b.kind === "game";
      if (inGame && (model !== "trinity4" || sample || b.audio))
        fail("Unknown Ringdoku feedback format");
      const ratings: Record<string, number> = {};
      if (
        !b.ratings ||
        typeof b.ratings !== "object" ||
        Array.isArray(b.ratings)
      )
        fail("Choose at least one rating");
      for (const [k, v] of Object.entries(b.ratings)) {
        if (
          inGame || !(b.kind === "ranking"
            ? models.has(k)
            : ["clarity", "enjoyment", "difficulty"].includes(k)) ||
          !Number.isInteger(v) ||
          Number(v) < 1 ||
          Number(v) > 5
        )
          fail("Invalid rating");
        ratings[k] = Number(v);
      }
      if (!inGame && !Object.keys(ratings).length) fail("Choose at least one rating");
      if (
        typeof b.notes !== "string" ||
        b.notes.length > 10000 ||
        typeof b.name !== "string" ||
        b.name.length > 60
      )
        fail("Notes or name are too long");
      if (inGame && !text(b.notes, 10000)) fail("Write some feedback before submitting");
      let audio: Buffer | undefined, audioMime: string | undefined;
      if (b.audio) {
        audioMime = text(b.audio.mime, 80).split(";")[0];
        if (
          !allowedMimes.has(audioMime) ||
          typeof b.audio.base64 !== "string" ||
          b.audio.base64.length > 2800000 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(b.audio.base64)
        )
          fail("Recording format or size is not supported");
        audio = Buffer.from(b.audio.base64, "base64");
        if (
          audio.length > 2 * 1024 * 1024 ||
          audio.length < 16 ||
          !audioValid(audio, audioMime)
        )
          fail("Recording is invalid or larger than 2 MB");
        if (audience === "public" && b.audioConsent !== true)
          fail("Confirm that this recording may be shared publicly");
      }
      const old = await store.get(t.id);
      if (old) return void res.json({ id: t.id, duplicate: true });
      if (
        !(await store.limit("responses:" + key, 40, 3600000, now())) ||
        !(await store.limit("global-responses", 200, 86400000, now()))
      )
        fail("The feedback limit has been reached. Please try later.", 429);
      const response: TestResponse = {
        id: t.id,
        createdAt: new Date(now()).toISOString(),
        round: catalog.round,
        kind: b.kind,
        model: b.kind === "ranking" ? "" : model,
        sample: b.kind === "ranking" ? "" : sample,
        name: text(b.name, 60),
        notes: text(b.notes, 10000),
        ratings,
        audioMime,
        audioPublic: !!audio && audience === "public" && b.audioConsent === true,
        audioBytes: audio?.length || 0,
        ...(b.setupCheck===true?{setupCheck:true,audioPublic:false}:{}),
      };
      await store.save(response, audio);
      res.status(201).json({ id: t.id });
    } catch (e) {
      next(e);
    }
  });
  router.get("/results", async (_req, res, next) => {
    try {
      const rows = await store.list();
      res.json({
        round: catalog.round,
        responses: rows.map((r) => ({
          ...r,
          audioAvailable: r.audioPublic && !!r.audioBytes,
        })),
      });
    } catch (e) {
      next(e);
    }
  });
  router.get("/audio/:id", async (req, res, next) => {
    try {
      const item = await store.get(String(req.params.id));
      if (!item?.audio) fail("Recording not found", 404);
      if (!item!.data.audioPublic&&!ownerAuthorized(req))fail('This recording is private',403);
      res.set(
        "Content-Type",
        item!.data.audioMime || "application/octet-stream",
      );
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      res.set("Content-Disposition", 'inline; filename="playtest-recording"');
      res.send(item!.audio);
    } catch (e) {
      next(e);
    }
  });
  return router;
}
