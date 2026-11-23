import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  prepare,
  solve,
  exactCoverCount,
} from "../docs/prototypes/circle-models.mjs";
test("Every released playtest fixture has exactly one completion under both counters", async () => {
  const data = JSON.parse(await readFile("src/testing/catalog.json", "utf8"));
  for (const raw of data.models) {
    const d = prepare(raw);
    for (const s of data.samples.filter((s) => s.model === d.id)) {
      assert.equal(solve(d, s.givens).count, 1, s.id);
      assert.equal(exactCoverCount(d, s.givens), 1, s.id);
    }
  }
});
