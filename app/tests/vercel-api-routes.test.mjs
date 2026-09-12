import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const routes = [
  "api/discord/token.ts",
  "api/challenges/[id].ts",
  "api/challenges/[id]/attempts.ts",
  "api/challenges/[id]/results.ts",
];

test("nested API routes have explicit Vercel function entrypoints", async () => {
  await Promise.all(routes.map((route) => access(route)));
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.trailingSlash, undefined);
  assert.ok(config.redirects.every(({ source }) => !source.startsWith("/api")));
});
