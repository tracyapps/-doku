import test from "node:test";
import assert from "node:assert/strict";
import { discordChallengeId } from "../src/game/network.js";

test("Discord challenge deep links accept only namespaced UUIDs", () => {
  const id = "01991f83-f4f1-7c8a-a5a4-e73dcb2193e2";
  assert.equal(discordChallengeId(`challenge:${id}`), id);
  assert.equal(discordChallengeId(id), undefined);
  assert.equal(discordChallengeId("challenge:../../history"), undefined);
  assert.equal(discordChallengeId(null), undefined);
});
