import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const routes = [
  "api/discord/token.ts",
  "api/challenges/[id].ts",
  "api/challenges/[id]/attempts.ts",
  "api/challenges/[id]/results.ts",
  "api/auth/[...all].ts",
  "api/me.ts",
  "api/me/[...all].ts",
  "api/account/config.ts",
  "api/playtesting/[...all].ts",
];

test("nested API routes have explicit Vercel function entrypoints", async () => {
  await Promise.all(routes.map((route) => access(route)));
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.trailingSlash, undefined);
  assert.ok(config.redirects.every(({ source }) => !source.startsWith("/api")));
});

test("public testing routes are separate entries and research stays out of deployment", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  for (const source of ["/testing/", "/testing/results/"])
    assert.equal(
      config.rewrites.find((r) => r.source === source)?.destination,
      "/testing.html",
    );
  const page = await readFile("testing.html", "utf8");
  assert.match(page, /noindex/);
  assert.match(page, /src\/testing\/main.tsx/);
  const ignore = await readFile(".vercelignore", "utf8");
  assert.match(ignore, /^docs$/m);
  const web = await readFile("src/web.tsx", "utf8");
  assert.doesNotMatch(web, /href=["']\/testing/);
});
