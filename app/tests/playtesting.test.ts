import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playtestingRouter } from "../server/playtesting.js";
import { createPlaytestStore } from "../server/playtest-store.js";
import {
  catalog,
  createGame,
  visitCell,
  putValue,
  restoreGame,
  inspectedGroups,
  groupsAt,
} from "../src/testing/rules.js";
import {findConflicts,describeConflict} from '../src/testing/conflicts.mjs';
import { ThoughtRecorder } from "../src/testing/recorder.js";

for (const pencil of [false, true])
  test(`Inspector cannot change armed ${pencil ? "notes" : "pen"} entries or history`, () => {
    const sample = catalog.samples[0],
      model = catalog.models.find((m) => m.id === sample.model)!;
    let game = createGame(sample);
    const cell = sample.givens.findIndex((v) => !v);
    assert.deepEqual(inspectedGroups(game, model), []);
    game = { ...game, active: 2, pencil };
    game = visitCell(game, model, sample.givens, cell);
    const before = structuredClone(game);
    game = { ...game, inspector: true };
    for (let i = 0; i < game.values.length; i++) {
      game = visitCell(game, model, sample.givens, i);
      assert.deepEqual(inspectedGroups(game, model), groupsAt(model, i));
      assert.deepEqual(game.values, before.values);
      assert.deepEqual(game.notes, before.notes);
      assert.deepEqual(game.past, before.past);
      assert.equal(putValue(game, model, sample.givens, 3), game);
      assert.equal(restoreGame(game), game);
    }
    assert.deepEqual(inspectedGroups({ ...game, inspector: false }, model), []);
    const given = sample.givens.findIndex(Boolean);
    assert.equal(
      putValue(
        { ...game, inspector: false, selected: given },
        model,
        sample.givens,
        1,
      ).values[given],
      sample.givens[given],
    );
  });

test("Public samples are rings only, have independent unique-solution evidence, and contain no solution", () => {
  assert.deepEqual(
    catalog.models.map((m) => m.id),
    ["linked4", "trinity4", "wide8", "ring4"],
  );
  assert.equal(catalog.samples.length, 24);
  for (const sample of catalog.samples) {
    assert.equal(sample.unique, 1);
    assert.equal(sample.independent, 1);
    assert.equal("solution" in sample, false);
  }
});

test("Voice pause/resume uses one recorder, excludes pauses, flushes all chunks, and releases the mic", async () => {
  let now = 0,
    stops = 0,
    created = 0;
  const snapshots: Blob[] = [];
  const track = {
    enabled: true,
    stop() {
      stops++;
    },
  };
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: any;
    onstop: any;
    onerror: any;
    constructor() {
      created++;
    }
    start() {
      this.state = "recording";
    }
    pause() {
      this.state = "paused";
    }
    resume() {
      this.state = "recording";
    }
    requestData() {
      this.ondataavailable?.({ data: new Blob(["thought one"]) });
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["thought two"]) });
      this.onstop?.();
    }
  }
  const controller = new ThoughtRecorder(
    () => {},
    (b) => snapshots.push(b),
    {
      media: () =>
        ({
          getUserMedia: async () => ({
            getTracks: () => [track],
            getAudioTracks: () => [track],
          }),
        }) as any,
      Recorder: () => Recorder as any,
      now: () => now,
    },
  );
  await controller.record();
  now = 2000;
  controller.pause();
  assert.equal(track.enabled, false);
  assert.equal(controller.duration(), 2);
  now = 12000;
  await controller.record();
  assert.equal(track.enabled, true);
  now = 15000;
  const blob = await controller.finish();
  assert.equal(created, 1);
  assert.equal(controller.duration(), 5);
  assert.equal(await blob.text(), "thought onethought two");
  assert.equal(stops, 1);
  assert.equal(snapshots.at(-1), blob);
  controller.dispose();
});

test("Leaving while microphone permission is pending cannot start an orphan recording", async () => {
  let allow: any,
    stops = 0,
    created = 0;
  class Recorder {
    constructor() {
      created++;
    }
    static isTypeSupported() {
      return true;
    }
  }
  const controller = new ThoughtRecorder(
    () => {},
    () => {},
    {
      media: () =>
        ({
          getUserMedia: () => new Promise((resolve) => (allow = resolve)),
        }) as any,
      Recorder: () => Recorder as any,
      now: () => 0,
    },
  );
  const pending = controller.record();
  controller.dispose();
  allow({
    getTracks: () => [
      {
        stop() {
          stops++;
        },
      },
    ],
  });
  await pending;
  assert.equal(stops, 1);
  assert.equal(created, 0);
});

function work(ticket: string) {
  const { nonce } = JSON.parse(
    Buffer.from(ticket.split(".")[0], "base64url").toString(),
  );
  let n = 0;
  while (
    !createHash("sha256")
      .update(nonce + ":" + n)
      .digest("hex")
      .startsWith("000")
  )
    n++;
  return n;
}
async function fixture(audience: "private" | "public" | "configured" = "private") {
  const dir = await mkdtemp(join(tmpdir(), "doku-playtest-")),
    file = join(dir, "responses.json"),
    store = createPlaytestStore(file, "");
  let now = 100000;
  const app = express();
  app.use(
    "/api/playtesting",
    playtestingRouter({ store, now: () => now, audioAudience: audience === 'configured' ? undefined : audience }),
  );
  app.use((e: any, _req: any, res: any, _next: any) =>
    res.status(e.status || 500).json({ error: e.message }),
  );
  const server = app.listen(0);
  await new Promise<void>((r) => server.on("listening", r));
  const port = (server.address() as any).port;
  const call = (
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(`http://127.0.0.1:${port}/api/playtesting${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const payload = async () => {
    const { ticket } = await (await call("/ticket")).json();
    now += 5000;
    return {
      ticket,
      work: work(ticket),
      round: catalog.round,
      kind: "example",
      model: catalog.samples[0].model,
      sample: catalog.samples[0].id,
      name: "QA",
      notes: "<script>literal feedback</script>",
      ratings: { clarity: 3 },
      website: "",
      publicConsent: true,
    };
  };
  return {
    call,
    payload,
    store,
    file,
    advance: (ms: number) => (now += ms),
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("Feedback validates origin, proof, honeypot, consent and model; retries persist only one response", async () => {
  const f = await fixture();
  try {
    const p = await f.payload();
    assert.equal((await f.call("/responses", { ...p, work: -1 })).status, 403);
    assert.equal(
      (await f.call("/responses", { ...p, website: "spam" })).status,
      400,
    );
    assert.equal(
      (await f.call("/responses", { ...p, publicConsent: false })).status,
      400,
    );
    assert.equal(
      (await f.call("/responses", { ...p, model: "venn12" })).status,
      400,
    );
    assert.equal(
      (await f.call("/responses", p, { Origin: "https://other.example" }))
        .status,
      403,
    );
    const first = await f.call("/responses", p);
    assert.equal(first.status, 201);
    const { id } = await first.json();
    const retry = await (await f.call("/responses", p)).json();
    assert.equal(retry.id, id);
    assert.equal(retry.duplicate, true);
    const reopened = createPlaytestStore(f.file, "");
    assert.equal((await reopened.list()).length, 1);
    assert.equal((await reopened.list())[0].notes, p.notes);
    const before = await f.store.secret();
    assert.equal(await reopened.secret(), before);
    assert.equal(await f.store.limit("persisted-limit", 1, 10000, 1000), true);
    assert.equal(
      await reopened.limit("persisted-limit", 1, 10000, 1000),
      false,
    );
  } finally {
    await f.close();
  }
});

test("Private audio is retained but never exposed through public results or audio URLs", async () => {
  const f = await fixture();
  try {
    const p = await f.payload(),
      wav = Buffer.alloc(44);
    wav.write("RIFF");
    wav.write("WAVE", 8);
    assert.equal(
      (
        await f.call("/responses", {
          ...p,
          audio: {
            mime: "audio/wav",
            base64: Buffer.alloc(44).toString("base64"),
          },
        })
      ).status,
      400,
    );
    const r = await f.call("/responses", {
      ...p,
      audio: { mime: "audio/wav", base64: wav.toString("base64") },
    });
    assert.equal(r.status, 201);
    const { id } = await r.json();
    assert.deepEqual((await f.store.get(id))?.audio, wav);
    const result = await (await f.call("/results")).json();
    assert.equal(result.responses[0].audioAvailable, false);
    assert.equal("audio" in result.responses[0], false);
    assert.equal((await f.call("/audio/" + id)).status, 403);
  } finally {
    await f.close();
  }
});

test("Public recordings require separate explicit consent and are playable after acceptance", async () => {
  const f = await fixture("public");
  try {
    const p = await f.payload(),
      wav = Buffer.alloc(44);
    wav.write("RIFF");
    wav.write("WAVE", 8);
    const body = {
      ...p,
      audio: { mime: "audio/wav", base64: wav.toString("base64") },
    };
    assert.equal((await f.call("/responses", body)).status, 400);
    const response = await f.call("/responses", {
      ...body,
      audioConsent: true,
    });
    assert.equal(response.status, 201);
    const { id } = await response.json();
    const audio = await f.call("/audio/" + id);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get("content-type"), "audio/wav");
    assert.deepEqual(Buffer.from(await audio.arrayBuffer()), wav);
  } finally {
    await f.close();
  }
});

test('Owner setup checks use the real save path without appearing in public opinions',async()=>{
 const previous=process.env.PLAYTEST_OWNER_KEY;process.env.PLAYTEST_OWNER_KEY='test-owner-only';const f=await fixture();try{
  const p={...await f.payload(),setupCheck:true};assert.equal((await f.call('/responses',p)).status,403);
  const accepted=await f.call('/responses',p,{Authorization:'Bearer test-owner-only'});assert.equal(accepted.status,201);
  const {id}=await accepted.json();assert.equal((await f.store.get(id))?.data.setupCheck,true);
  assert.equal((await(await f.call('/results')).json()).responses.length,0);
 }finally{await f.close();if(previous===undefined)delete process.env.PLAYTEST_OWNER_KEY;else process.env.PLAYTEST_OWNER_KEY=previous;}
});

test('Public-by-default configuration preserves previously private recordings',async()=>{
 const previous=process.env.PLAYTEST_AUDIO_AUDIENCE;delete process.env.PLAYTEST_AUDIO_AUDIENCE;
 const f=await fixture('configured');try{
  assert.equal((await(await f.call('/config')).json()).audioAudience,'public');
  const wav=Buffer.alloc(44);wav.write('RIFF');wav.write('WAVE',8);
  await f.store.save({id:'previous-private-recording',createdAt:new Date().toISOString(),round:catalog.round,kind:'example',model:catalog.samples[0].model,sample:catalog.samples[0].id,name:'',notes:'Private under the previous policy',ratings:{clarity:3},audioMime:'audio/wav',audioPublic:false,audioBytes:wav.length},wav);
  assert.equal((await f.call('/audio/previous-private-recording')).status,403);
  assert.equal((await(await f.call('/results')).json()).responses[0].audioAvailable,false);
 }finally{await f.close();if(previous===undefined)delete process.env.PLAYTEST_AUDIO_AUDIENCE;else process.env.PLAYTEST_AUDIO_AUDIENCE=previous;}
});

test('Conflict explanations identify repeated digits and only the cells that duplicate them',()=>{
 const groups=[{name:'ring 1',cells:[0,1,2,3]},{name:'Spoke 1',cells:[0,4,8,12]}];
 const values=Array(16).fill(0);values[0]=3;values[1]=1;values[2]=3;values[4]=2;
 const issues=findConflicts(groups,values);assert.equal(issues.length,1);assert.equal(issues[0].value,3);assert.deepEqual(issues[0].cells,[0,2]);
 assert.equal(describeConflict(issues[0],i=>'cell '+(i+1)),'3 appears twice in Ring 1: cell 1; cell 3.');
 values[8]=3;assert.deepEqual(findConflicts(groups,values).map(c=>c.cells),[[0,2],[0,8]]);
 values[2]=0;values[8]=0;assert.deepEqual(findConflicts(groups,values),[]);
});

test("In-game Ringdoku feedback accepts opt-in written comments without ratings", async () => {
  const f = await fixture();
  try {
    const p = {
      ...await f.payload(), kind: "game", model: "trinity4", sample: "", name: "",
      notes: "I could follow the dashed wedges.", ratings: {},
    };
    assert.equal((await f.call("/responses", { ...p, publicConsent: false })).status, 400);
    assert.equal((await f.call("/responses", { ...p, notes: "  " })).status, 400);
    assert.equal((await f.call("/responses", { ...p, model: "wide8" })).status, 400);
    assert.equal((await f.call("/responses", p)).status, 201);
    assert.equal((await f.call("/responses", p)).status, 200);
    const { responses } = await (await f.call("/results")).json();
    assert.equal(responses.length, 1);
    assert.equal(responses[0].kind, "game");
    assert.equal(responses[0].notes, p.notes);
    assert.deepEqual(responses[0].ratings, {});
  } finally {
    await f.close();
  }
});
