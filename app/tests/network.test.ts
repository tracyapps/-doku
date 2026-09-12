import test from "node:test";
import assert from "node:assert/strict";
import {
  discordChallengeId,
  discordChallengeMessage,
} from "../src/game/network.js";

test("Discord challenge deep links accept only namespaced UUIDs", () => {
  const id = "01991f83-f4f1-7c8a-a5a4-e73dcb2193e2";
  assert.equal(discordChallengeId(`challenge:${id}`), id);
  assert.equal(discordChallengeId(id), undefined);
  assert.equal(discordChallengeId("challenge:../../history"), undefined);
  assert.equal(discordChallengeId(null), undefined);
});

test("Discord challenge messages are compact and escape the product asterisk", () => {
  assert.equal(
    discordChallengeMessage("classic", "easy"),
    "🧩 **Classic · Easy** \\*doku complete!\nThink you can solve the same puzzle?",
  );
});
