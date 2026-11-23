import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
export type TestResponse = {
  id: string;
  createdAt: string;
  round: string;
  kind: "example" | "ranking" | "game";
  model: string;
  sample: string;
  name: string;
  notes: string;
  ratings: Record<string, number>;
  audioMime?: string;
  audioPublic: boolean;
  audioBytes: number;
  setupCheck?: boolean;
};
type Local = {
  secret: string;
  responses: Array<TestResponse & { audio?: string }>;
  limits: Record<string, { count: number; until: number }>;
};
export function createPlaytestStore(
  file = process.env.PLAYTEST_DATA_FILE || ".data/playtests.json",
  databaseUrl = process.env.DATABASE_URL,
) {
  let connectionString=databaseUrl;
  if(databaseUrl){
    const url=new URL(databaseUrl);
    // Keep pg's current certificate-verifying behavior explicit across driver upgrades.
    if(['prefer','require','verify-ca'].includes(url.searchParams.get('sslmode')||''))url.searchParams.set('sslmode','verify-full');
    connectionString=url.toString();
  }
  const pool = databaseUrl
    ? new Pool({
        connectionString,
        max: 2,
      })
    : null;
  let queue: Promise<unknown> = Promise.resolve(),
    initialized: Promise<void> | null = null;
  const init = () =>
    (initialized ??= (async () => {
      if (pool)
        await pool.query(
          `CREATE SCHEMA IF NOT EXISTS doku_playtesting; CREATE TABLE IF NOT EXISTS doku_playtesting.doku_playtest_response (id text PRIMARY KEY,created_at timestamptz NOT NULL,data jsonb NOT NULL,audio bytea); CREATE TABLE IF NOT EXISTS doku_playtesting.doku_playtest_limit (key text PRIMARY KEY,count integer NOT NULL,until_at bigint NOT NULL); CREATE TABLE IF NOT EXISTS doku_playtesting.doku_playtest_meta (key text PRIMARY KEY,value text NOT NULL)`,
        );
      else if (process.env.VERCEL)
        throw Error("Durable playtest storage is not configured");
    })().catch((e) => {
      initialized = null;
      throw e;
    }));
  async function local<T>(fn: (db: Local) => T) {
    const job = queue.then(async () => {
      let db: Local;
      try {
        db = JSON.parse(await readFile(file, "utf8"));
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
        db = {
          secret: randomBytes(32).toString("hex"),
          responses: [],
          limits: {},
        };
      }
      const out = fn(db);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file + ".tmp", JSON.stringify(db), { mode: 0o600 });
      await rename(file + ".tmp", file);
      return out;
    });
    queue = job.catch(() => {});
    return job;
  }
  return {
    async secret() {
      await init();
      if (!pool) return local((db) => db.secret);
      await pool.query(
        "INSERT INTO doku_playtesting.doku_playtest_meta(key,value) VALUES ('ticket-secret',$1) ON CONFLICT DO NOTHING",
        [randomBytes(32).toString("hex")],
      );
      return (
        await pool.query(
          "SELECT value FROM doku_playtesting.doku_playtest_meta WHERE key='ticket-secret'",
        )
      ).rows[0].value as string;
    },
    async limit(key: string, maximum: number, windowMs: number, now: number) {
      await init();
      if (!pool)
        return local((db) => {
          for (const [k, v] of Object.entries(db.limits))
            if (v.until < now) delete db.limits[k];
          let v = db.limits[key];
          if (!v || v.until <= now)
            v = db.limits[key] = { count: 0, until: now + windowMs };
          return ++v.count <= maximum;
        });
      const r = await pool.query(
        `INSERT INTO doku_playtesting.doku_playtest_limit AS bucket(key,count,until_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bucket.until_at<=$3 THEN 1 ELSE bucket.count+1 END,until_at=CASE WHEN bucket.until_at<=$3 THEN $2 ELSE bucket.until_at END RETURNING count`,
        [key, now + windowMs, now],
      );
      if (Math.random() < 0.02)
        await pool.query("DELETE FROM doku_playtesting.doku_playtest_limit WHERE until_at<$1", [
          now,
        ]);
      return r.rows[0].count <= maximum;
    },
    async save(response: TestResponse, audio?: Buffer) {
      await init();
      const full = () =>
        Object.assign(
          Error(
            "This testing round is full. Your draft is still on this device.",
          ),
          { status: 429 },
        );
      if (!pool)
        return local((db) => {
          const old = db.responses.find((r) => r.id === response.id);
          if (old) return old.id;
          if (
            db.responses.length >= 1000 ||
            db.responses.reduce((sum, r) => sum + r.audioBytes, 0) +
              (audio?.length || 0) >
              64 * 1024 * 1024
          )
            throw full();
          db.responses.unshift({
            ...response,
            ...(audio ? { audio: audio.toString("base64") } : {}),
          });
          return response.id;
        });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Serialize admission across function instances so the storage cap is durable.
        await client.query("SELECT pg_advisory_xact_lock(785101147)");
        const old = await client.query(
          "SELECT id FROM doku_playtesting.doku_playtest_response WHERE id=$1",
          [response.id],
        );
        if (!old.rowCount) {
          const totals = (
            await client.query(
              "SELECT count(*)::int AS responses,coalesce(sum(octet_length(audio)),0)::bigint AS bytes FROM doku_playtesting.doku_playtest_response",
            )
          ).rows[0];
          if (
            totals.responses >= 1000 ||
            Number(totals.bytes) + (audio?.length || 0) > 64 * 1024 * 1024
          )
            throw full();
          await client.query(
            "INSERT INTO doku_playtesting.doku_playtest_response(id,created_at,data,audio) VALUES($1,$2,$3,$4)",
            [
              response.id,
              response.createdAt,
              JSON.stringify(response),
              audio || null,
            ],
          );
        }
        await client.query("COMMIT");
        return response.id;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    async list() {
      await init();
      if (!pool)
        return local((db) =>
          db.responses.filter(r=>!r.setupCheck).slice(0, 300).map(({ audio, ...r }) => r),
        );
      return (
        await pool.query(
          "SELECT data FROM doku_playtesting.doku_playtest_response WHERE data->>'setupCheck' IS DISTINCT FROM 'true' ORDER BY created_at DESC LIMIT 300",
        )
      ).rows.map((r) => r.data as TestResponse);
    },
    async get(id: string) {
      await init();
      if (!pool)
        return local((db) => {
          const r = db.responses.find((r) => r.id === id);
          return r
            ? {
                data: (({ audio, ...v }) => v)(r),
                audio: r.audio ? Buffer.from(r.audio, "base64") : null,
              }
            : null;
        });
      const r = (
        await pool.query(
          "SELECT data,audio FROM doku_playtesting.doku_playtest_response WHERE id=$1",
          [id],
        )
      ).rows[0];
      return r
        ? { data: r.data as TestResponse, audio: r.audio as Buffer | null }
        : null;
    },
    close: () => pool?.end(),
  };
}
export type PlaytestStore = ReturnType<typeof createPlaytestStore>;
