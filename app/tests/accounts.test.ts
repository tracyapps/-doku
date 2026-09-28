// End-to-end: fresh SQLite DB → migrate → magic-link sign-in → profile →
// record sync (dedupe + validation) → export → delete.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join } from 'node:path';

test('accounts: sign in by magic link, sync records, delete', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doku-auth-'));
  process.env.AUTH_SQLITE_FILE = join(dir, 'auth.sqlite');
  process.env.BETTER_AUTH_URL = 'http://127.0.0.1:5173';
  delete process.env.DATABASE_URL; delete process.env.RESEND_API_KEY;
  const { getMigrations } = await import('better-auth/db/migration');
  const { authOptions } = await import('../server/auth.ts');
  await (await getMigrations(authOptions)).runMigrations();
  const { makeApp } = await import('../server/app.ts');
  const { createStore } = await import('../server/store.ts');
  const server = makeApp(createStore(join(dir, 'db.json'))).listen(0);
  await new Promise<void>((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const origin = { Origin: 'http://127.0.0.1:5173' };
  const logs: string[] = []; const log = console.log; console.log = (...a) => { logs.push(a.join(' ')); };
  try {
    assert.equal((await (await fetch(`${base}/api/account/config`)).json()).enabled, true);
    assert.equal((await fetch(`${base}/api/me`)).status, 401);
    const send = await fetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...origin }, body: JSON.stringify({ email: 'sue@example.com', callbackURL: '/profile/' }) });
    assert.equal(send.status, 200, await send.text());
    const link = logs.join('\n').match(/http\S+magic-link\/verify\S+/)![0];
    const verify = await fetch(link.replace('http://127.0.0.1:5173', base), { redirect: 'manual', headers: origin });
    const token = verify.headers.get('set-auth-token');
    const cookie = verify.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    assert.ok(token || cookie, 'got a session');
    const auth = { ...origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : { Cookie: cookie }) };
    const me = await (await fetch(`${base}/api/me`, { headers: auth })).json();
    assert.equal(me.profile.email, 'sue@example.com');
    const prof = await (await fetch(`${base}/api/me/profile`, { method: 'PUT', headers: auth, body: JSON.stringify({ name: 'Sue', handle: 'sue_draws', featuredBadges: ['perfect-month'] }) })).json();
    assert.equal(prof.profile.handle, 'sue_draws');
    const rec = { id: 'r1', kind: 'daily', daily: '2026-09-26', seed: 'daily:2026-09-26:easy', variant: 'hue', difficulty: 'easy', seconds: 300, accuracy: 95, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false, startedAt: '2026-09-26T12:00:00Z', completedAt: '2026-09-26T12:05:00Z', localDate: '2026-09-26', startHour: 7 };
    const bad = { ...rec, id: 'r2', seed: 'daily:2026-09-27:easy' };
    const sync = await (await fetch(`${base}/api/me/records`, { method: 'POST', headers: auth, body: JSON.stringify({ records: [rec, rec, bad] }) })).json();
    assert.deepEqual([sync.added, sync.rejected, sync.records.length], [1, 1, 1]);
    const again = await (await fetch(`${base}/api/me/records`, { method: 'POST', headers: auth, body: JSON.stringify({ records: [rec] }) })).json();
    assert.equal(again.added, 0);
    // Regression: the in-game timer counts fractions of a second. Those
    // records used to be rejected silently; now they sync as whole seconds.
    const frac = await (await fetch(`${base}/api/me/records`, { method: 'POST', headers: auth, body: JSON.stringify({ records: [{ ...rec, id: 'r3', seconds: 169.87 }] }) })).json();
    assert.equal(frac.added, 1);
    assert.equal(frac.records.find((r: { id: string }) => r.id === 'r3').seconds, 170);
    const exp = await (await fetch(`${base}/api/me/export`, { headers: auth })).json();
    assert.equal(exp.records.length, 2);
    assert.equal((await fetch(`${base}/api/me`, { method: 'DELETE', headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/api/me`, { headers: auth })).status, 401);
  } finally {
    console.log = log;
    await new Promise<void>((r) => server.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
