// End-to-end: two players become friends by invite code, sync dailies, and
// see the friends / everyone leaderboards with the privacy rule applied.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join } from 'node:path';

test('friends + leaderboards respect the privacy rule', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doku-social-'));
  process.env.AUTH_SQLITE_FILE = join(dir, 'auth.sqlite');
  process.env.BETTER_AUTH_URL = 'http://127.0.0.1:5173';
  process.env.ADMIN_EMAILS = 'tapps@example.com';
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
  const signIn = async (email: string) => {
    await fetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...origin }, body: JSON.stringify({ email, callbackURL: '/' }) });
    const link = [...logs.join('\n').matchAll(/http\S+magic-link\/verify\S+/g)].pop()![0];
    const v = await fetch(link.replace('http://127.0.0.1:5173', base), { redirect: 'manual', headers: origin });
    const token = v.headers.get('set-auth-token');
    const cookie = v.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    return { ...origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : { Cookie: cookie }) };
  };
  const get = async (h: Record<string, string>, path: string) => (await fetch(`${base}/api${path}`, { headers: h })).json();
  const send = async (h: Record<string, string>, path: string, body: unknown, method = 'POST') =>
    (await fetch(`${base}/api${path}`, { method, headers: h, body: JSON.stringify(body) })).json();
  const daily = (id: string, seconds: number) => ({ id, kind: 'daily', daily: '2026-09-26', seed: 'daily:2026-09-26:easy', variant: 'classic', difficulty: 'easy', seconds, accuracy: 100, hints: 0, checks: 0, reveals: 0, autofills: 0, assisted: false, startedAt: '2026-09-26T12:00:00Z', completedAt: '2026-09-26T12:05:00Z', localDate: '2026-09-26', startHour: 7 });
  const q = '?period=week&today=2026-09-27';
  try {
    const tapps = await signIn('tapps@example.com'), sue = await signIn('sue@example.com'), stranger = await signIn('x@example.com');
    await send(tapps, '/me/profile', { name: 'Tapps' }, 'PUT');
    await send(sue, '/me/profile', { name: 'Sue', handle: 'sue_draws' }, 'PUT');
    await send(stranger, '/me/profile', { name: 'Stranger', handle: 'stranger', publicProfile: true }, 'PUT');
    await send(tapps, '/me/records', { records: [daily('t1', 300)] });
    await send(sue, '/me/records', { records: [daily('s1', 250)] });
    await send(stranger, '/me/records', { records: [daily('x1', 200)] });

    // Invite code → two-way friendship; your own code is refused.
    const { inviteCode } = await get(tapps, '/me/friends');
    assert.match((await send(tapps, '/me/friends', { code: inviteCode })).error, /your own/);
    assert.equal((await send(sue, '/me/friends', { code: inviteCode })).friend.name, 'Tapps');
    assert.deepEqual((await get(tapps, '/me/friends')).friends.map((f: { name: string }) => f.name), ['Sue']);

    // Friends board: you + friends only, ranked by the *doku score by default.
    const fb = await get(tapps, `/leaderboard${q}&scope=friends`);
    assert.equal(fb.view, 'points');
    assert.deepEqual(fb.players.map((p: { player: { name: string } }) => p.player.name).sort(), ['Sue', 'Tapps']);

    // Everyone board: opted-in players with a handle; your own row is shown
    // to you (marked hidden) but never to others.
    const gb = await get(tapps, `/leaderboard${q}&scope=global`);
    assert.deepEqual(gb.players.map((p: { player: { name: string }; hidden: boolean }) => [p.player.name, p.hidden]), [['Stranger', false], ['Tapps', true]]);
    const anon = await get(origin, `/leaderboard${q}&scope=global`);
    assert.deepEqual(anon.players.map((p: { player: { name: string } }) => p.player.name), ['Stranger']);
    assert.equal((await fetch(`${base}/api/leaderboard${q}&scope=friends`)).status, 401);

    // Par check is admin-only.
    assert.equal((await fetch(`${base}/api/admin/par`, { headers: sue })).status, 404);
    const par = await get(tapps, '/admin/par');
    assert.equal(par.lines.find((l: { variant: string; difficulty: string }) => l.variant === 'classic' && l.difficulty === 'easy').plays, 3);

    // Player profiles: friends and everyone-board players are visible;
    // private non-friends are not. Relationship is reported to the viewer.
    const sueProfile = await get(tapps, '/players/sue_draws?today=2026-09-27');
    assert.equal(sueProfile.relationship, 'friend');
    assert.equal(sueProfile.week.dailies, 1);
    assert.ok(Array.isArray(sueProfile.awards));
    assert.equal(sueProfile.records, undefined, 'raw games are never exposed');
    assert.equal((await get(stranger, '/players/sue_draws')).error !== undefined, true);
    assert.equal((await fetch(`${base}/api/players/sue_draws`)).status, 404);
    assert.equal((await get(origin, '/players/stranger')).relationship, 'none');
    assert.equal((await get(tapps, '/players/tapps')).error !== undefined, true); // no handle, looked up by id instead
    const tappsId = (await get(tapps, '/me')).profile.id;
    assert.equal((await get(tapps, `/players/${tappsId}`)).relationship, 'self');

    // Friend requests from a profile: request → pending both ways → accept.
    const strangerId = (await get(stranger, '/me')).profile.id;
    assert.equal((await send(sue, '/me/friend-requests', { userId: strangerId })).relationship, 'requested');
    assert.equal((await get(stranger, '/players/sue_draws')).relationship, 'incoming'); // requester becomes visible
    assert.equal((await get(stranger, '/me/friends')).incoming[0].name, 'Sue');
    assert.equal((await send(stranger, '/me/friend-requests', { userId: (await get(sue, '/me')).profile.id })).relationship, 'friend');
    assert.equal((await get(sue, '/me/friends')).outgoing.length, 0);
    // A private player can't be requested by a stranger.
    assert.equal((await fetch(`${base}/api/me/friend-requests`, { method: 'POST', headers: stranger, body: JSON.stringify({ userId: tappsId }) })).status, 404);

    // Removing a friend removes both directions.
    const sueId = (await get(sue, '/me')).profile.id;
    await fetch(`${base}/api/me/friends/${sueId}`, { method: 'DELETE', headers: tapps });
    assert.deepEqual((await get(sue, '/me/friends')).friends.map((f: { name: string }) => f.name), ['Stranger']);
  } finally {
    console.log = log;
    await new Promise<void>((r) => server.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
