// Discord Activity sign-in: SDK code → server exchange → *doku session.
// Discord's API is stubbed; everything else runs for real on SQLite.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join } from 'node:path';

test('Discord Activity sign-in finds, links, or creates the account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doku-dact-'));
  Object.assign(process.env, { AUTH_SQLITE_FILE: join(dir, 'auth.sqlite'), BETTER_AUTH_URL: 'http://127.0.0.1:5173', DISCORD_CLIENT_ID: '1548073007950602303', DISCORD_CLIENT_SECRET: 'test-secret' });
  delete process.env.DATABASE_URL; delete process.env.RESEND_API_KEY;
  const users: Record<string, object> = {
    'code-a': { id: '111', username: 'tapps', global_name: 'Tapps', avatar: null },
    'code-b': { id: '222', username: 'sue', global_name: 'Sue', avatar: null, email: 'Sue@Example.com', verified: true },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://discord.com/api/oauth2/token') {
      const code = new URLSearchParams(String(init?.body)).get('code')!;
      return users[code] ? Response.json({ access_token: `tok-${code}`, scope: 'identify email' }) : new Response('bad', { status: 400 });
    }
    if (url === 'https://discord.com/api/users/@me') {
      const code = String((init?.headers as Record<string, string>).Authorization).replace('Bearer tok-', '');
      return Response.json(users[code]);
    }
    return realFetch(input, init);
  }) as typeof fetch;
  const { getMigrations } = await import('better-auth/db/migration');
  const { authOptions } = await import('../server/auth.ts');
  await (await getMigrations(authOptions)).runMigrations();
  const { makeApp } = await import('../server/app.ts');
  const { createStore } = await import('../server/store.ts');
  const server = makeApp(createStore(join(dir, 'db.json'))).listen(0);
  await new Promise<void>((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const discordOrigin = { Origin: 'https://1548073007950602303.discordsays.com' };
  const logs: string[] = []; const log = console.log; console.log = (...a) => { logs.push(a.join(' ')); };
  const signIn = async (code: string) => {
    const r = await realFetch(`${base}/api/account/discord-activity`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...discordOrigin }, body: JSON.stringify({ code }) });
    return { status: r.status, body: await r.json() };
  };
  const me = async (token: string) => (await (await realFetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${token}` } })).json()).profile;
  try {
    // The Activity's origin may now use the auth API (email links were refused before).
    const ml = await realFetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...discordOrigin }, body: JSON.stringify({ email: 'sue@example.com', callbackURL: '/profile/' }) });
    assert.equal(ml.status, 200, await ml.text());

    // No email shared → a new account; signing in again finds the same one.
    const a1 = await signIn('code-a');
    assert.equal(a1.status, 200);
    const p1 = await me(a1.body.token);
    assert.equal(p1.name, 'Tapps');
    assert.equal(p1.id, (await me((await signIn('code-a')).body.token)).id);

    // Verified email matching an existing account → linked, not duplicated.
    const link = logs.join('\n').match(/http\S+magic-link\/verify\S+/)![0];
    const v = await realFetch(link.replace('http://127.0.0.1:5173', base), { redirect: 'manual' });
    const webToken = v.headers.get('set-auth-token')!;
    const webId = (await me(webToken)).id;
    const b = await signIn('code-b');
    assert.equal((await me(b.body.token)).id, webId);

    // A bad code is refused cleanly.
    assert.equal((await signIn('nope')).status, 401);
  } finally {
    console.log = log; globalThis.fetch = realFetch;
    await new Promise<void>((r) => server.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
