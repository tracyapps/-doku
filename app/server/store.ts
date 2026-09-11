import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
export type Database = { challenges: Record<string, any>; attempts: Record<string, any> };
const empty = (): Database => ({ challenges: {}, attempts: {} });
export function createStore(file = process.env.STARDOKU_DATA_FILE || '.data/challenges.json', databaseUrl = process.env.DATABASE_URL) {
  let queue: Promise<unknown> = Promise.resolve();
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  async function run<T>(fn: (db: Database) => T): Promise<T> {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(73428113)');
        await client.query('CREATE TABLE IF NOT EXISTS stardoku_store (id integer PRIMARY KEY, data jsonb NOT NULL)');
        const rows = await client.query('SELECT data FROM stardoku_store WHERE id = 1 FOR UPDATE');
        const db = rows.rows[0]?.data || empty();
        const result = fn(db);
        await client.query('INSERT INTO stardoku_store (id,data) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET data = EXCLUDED.data', [JSON.stringify(db)]);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    if (process.env.VERCEL) throw new Error('DATABASE_URL required on Vercel');
    let db: Database;
    try { db = JSON.parse(await readFile(file, 'utf8')); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; db = empty(); }
    const result = fn(db);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(db), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    return result;
  }
  return { transaction<T>(fn: (db: Database) => T): Promise<T> { const job = queue.then(() => run(fn)); queue = job.catch(() => {}); return job; }, close: () => pool?.end(), mode: pool ? 'postgres' : 'local-file' };
}
