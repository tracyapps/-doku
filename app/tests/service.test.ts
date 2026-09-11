import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeApp } from "../server/app.js";
import { createStore } from "../server/store.js";
import { createPuzzle } from "../src/game/engine.js";
test("roadmap has a safe unconfigured response before GitHub is connected", async () => {
  const previous = process.env.GITHUB_REPO,
    previousPublic = process.env.VITE_GITHUB_REPO;
  delete process.env.GITHUB_REPO;
  delete process.env.VITE_GITHUB_REPO;
  const dir = await mkdtemp(join(tmpdir(), "doku-roadmap-"));
  const server = makeApp(createStore(join(dir, "db.json"))).listen(0);
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address() as { port: number };
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/roadmap`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { configured: false, issues: [] });
  } finally {
    if (previous === undefined) delete process.env.GITHUB_REPO;
    else process.env.GITHUB_REPO = previous;
    if (previousPublic === undefined) delete process.env.VITE_GITHUB_REPO;
    else process.env.VITE_GITHUB_REPO = previousPublic;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
test("challenge credentials, completion replay, accuracy, persistence and idempotency", async () => {
  const dir = await mkdtemp(join(tmpdir(), "doku-service-"));
  const file = join(dir, "db.json");
  const server = makeApp(createStore(file)).listen(0);
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address() as { port: number };
  const call = async (path: string, body?: unknown) => {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal(
      (await call("/challenges", { seed: "s", variant: "bad" })).status,
      400,
    );
    const { data: challenge } = await call("/challenges", {
      seed: "service-test",
      variant: "classic",
    });
    const { data: attempt } = await call(
      `/challenges/${challenge.id}/attempts`,
      { difficulty: "easy", name: "Test" },
    );
    assert.equal(attempt.puzzle.solution, undefined);
    const path = `/challenges/${challenge.id}/results`;
    const payload = {
      attemptId: attempt.attemptId,
      token: attempt.token,
      actions: [] as any[],
      elapsedSeconds: 120,
    };
    assert.equal(
      (await call(path, { ...payload, token: "x".repeat(64) })).status,
      401,
    );
    assert.equal((await call(path, payload)).status, 400);
    const puzzle = createPuzzle("service-test", "classic", "easy");
    const first = puzzle.givens.findIndex((value) => !value);
    payload.actions.push(
      { kind: "set", cell: first, value: (puzzle.solution[first] % 9) + 1 },
      { kind: "autofill" },
      { kind: "conflicts", enabled: true },
    );
    puzzle.givens.forEach((value, cell) => {
      if (!value)
        payload.actions.push({
          kind: "set",
          cell,
          value: puzzle.solution[cell],
        });
    });
    const result = await call(path, payload);
    assert.equal(result.status, 200);
    assert.ok(result.data.accuracy < 100);
    assert.equal(result.data.autofills, 1);
    assert.equal(result.data.conflicts, true);
    assert.equal(result.data.verification, "self-reported");
    assert.deepEqual((await call(path, payload)).data, result.data);
    assert.equal(
      (await call(`/challenges/${challenge.id}`)).data.results.length,
      1,
    );
    const reopened = createStore(file);
    assert.equal(
      (await reopened.transaction((db) => db.challenges[challenge.id])).results
        .length,
      1,
    );
    const { data: second } = await call(
      `/challenges/${challenge.id}/attempts`,
      { difficulty: "easy" },
    );
    assert.match(second.puzzle.id, /classic/);
    const rest = puzzle.givens.flatMap((value, cell) =>
      !value && cell !== first
        ? [{ kind: "set", cell, value: puzzle.solution[cell] }]
        : [],
    );
    const secondPayload = {
      attemptId: second.attemptId,
      token: second.token,
      elapsedSeconds: 130,
      actions: [{ kind: "hint", cell: first }, ...rest],
    };
    assert.equal(
      (await call(path, secondPayload)).status,
      400,
      "Guidance hint must not fill the cell",
    );
    secondPayload.actions.push({
      kind: "set",
      cell: first,
      value: puzzle.solution[first],
    });
    const secondResult = await call(path, secondPayload);
    assert.equal(secondResult.status, 200);
    assert.equal(secondResult.data.hints, 1);
    assert.equal(secondResult.data.assisted, true);
    assert.match(secondResult.data.name, /^Player [a-f0-9]{6}$/);
    const { data: third } = await call(`/challenges/${challenge.id}/attempts`, {
      difficulty: "easy",
    });
    const thirdResult = await call(path, {
      attemptId: third.attemptId,
      token: third.token,
      elapsedSeconds: 140,
      actions: [
        { kind: "set", cell: first, value: (puzzle.solution[first] % 9) + 1 },
        { kind: "reveal", cell: first },
        { kind: "set", cell: first, value: (puzzle.solution[first] % 9) + 1 },
        { kind: "set", cell: first, value: puzzle.solution[first] },
        ...rest,
      ],
    });
    assert.equal(thirdResult.status, 200);
    assert.equal(
      thirdResult.data.accuracy,
      100,
      "Revealed cells excluded before and after reveal",
    );
    assert.equal(thirdResult.data.reveals, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
