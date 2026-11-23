import { useEffect, useRef, useState } from "react";
import { RingBoard } from "./RingBoard";
import {
  catalog,
  createGame,
  visitCell,
  putValue,
  restoreGame,
  inspectedGroups,
  badCells,
  possible,
  type TestGame,
} from "./rules";
import { ThoughtRecorder, audioDraft } from "./recorder";
import { playtestingRequest as api, proofOfWork } from "./feedback-client";
import {findConflicts,describeConflict} from './conflicts.mjs';
type Config = {
  round: string;
  audioAudience: "public" | "private";
  maxAudioBytes: number;
};
type ResponseRow = {
  id: string;
  createdAt: string;
  kind: string;
  model: string;
  sample: string;
  name: string;
  notes: string;
  ratings: Record<string, number>;
  audioAvailable: boolean;
  audioBytes: number;
};
const titles: Record<string, string> = {
  linked4: "Linked halves · 1–4",
  trinity4: "Linked thirds · 1–4",
  wide8: "Wide rings · 1–8",
  ring4: "Original 4×4 · optional comparison",
};
const instructions: Record<string, { lead: string; points: string[] }> = {
  linked4: {
    lead: "Watch left/right and top/bottom at the same time.",
    points: [
      "Purple divides the left and right halves. The amber horizontal line divides the top and bottom halves.",
      "On each ring, the four cells in each of those fixed halves use 1–4 once. A half is not one 16-cell group.",
      "Each spoke uses 1–4 once. Each curved 2×2 region, separated by the middle circle and diameters, also uses 1–4 once.",
    ],
  },
  trinity4: {
    lead: "Two fixed sets of three wedges overlap.",
    points: [
      "Purple boundaries mark the first three wedges. Amber dashed boundaries mark a second set, shifted by two spokes.",
      "There are six fixed four-spoke wedges in total. These are not rolling windows starting at every spoke.",
      "On each ring, the four cells within any purple or amber wedge use 1–4 once. Each spoke and each curved 2×2 region also uses 1–4 once.",
    ],
  },
  wide8: {
    lead: "The full ring and the fixed two-spoke wedge both count.",
    points: [
      "Each complete ring uses 1–8 once.",
      "The stronger radial lines outline four fixed wedges, each containing two spokes and eight cells. Each wedge also uses 1–8 once.",
      "The paired spokes are fixed: 1–2, 3–4, 5–6 and 7–8. They do not roll to 2–3, 4–5 or across the seam. A single spoke has only four cells and is not an eight-value group.",
    ],
  },
  ring4: {
    lead: "An optional comparison with four curved regions.",
    points: [
      "Each ring and each spoke uses 1–4 once.",
      "The thicker purple middle circle and vertical diameter outline four curved 2×2 regions: inner left, inner right, outer left and outer right. Each region also uses 1–4 once.",
      "Try the other directions first if these curved regions are harder to read.",
    ],
  },
};
const draftKey = (id: string) =>
  "doku.playtesting.v1:" + catalog.round + ":" + id;
function readDraft(id: string) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) || "null");
  } catch {
    return null;
  }
}
function Rating({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="rating" disabled={disabled}>
      <legend>{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={label + ": " + n + " out of 5"}
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          {n}
        </button>
      ))}
    </fieldset>
  );
}
function Header({ results = false }: { results?: boolean }) {
  return (
    <header className="testing-header">
      <a href="/testing/" className="testing-brand">
        <img src="/assets/brand/doku-icon.png" alt="*doku" />
        <span>
          Game testing<small>Small experiments. Your honest thoughts.</small>
        </span>
      </a>
      <nav aria-label="Testing">
        <a href={results ? "/testing/" : "/testing/results/"}>
          {results ? "Try the games" : "See feedback"}
        </a>
        <a href="https://stardoku.app/">Main site</a>
      </nav>
    </header>
  );
}
export function TestingApp() {
  return location.pathname.includes("/results") ? <Results /> : <Playtesting />;
}
function Playtesting() {
  const initial = catalog.samples.find(
    (s) => s.model === "linked4" && s.profile === "guided",
  )!;
  const [sampleId, setSampleId] = useState(initial.id),
    sample = catalog.samples.find((s) => s.id === sampleId) || initial,
    model = catalog.models.find((m) => m.id === sample.model)!;
  const [game, setGame] = useState<TestGame>(() => createGame(initial)),
    [notes, setNotes] = useState(""),
    [name, setName] = useState(""),
    [ratings, setRatings] = useState<Record<string, number>>({}),
    [view, setView] = useState<"play" | "compare">("play");
  const [config, setConfig] = useState<Config | null>(null),
    [ticket, setTicket] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false),
    [consent, setConsent] = useState(false),
    [audioConsent, setAudioConsent] = useState(false),
    [audio, setAudio] = useState<Blob | null>(null),
    [audioURL, setAudioURL] = useState(""),
    [, refreshRecorder] = useState(0),
    [recordingNotice, setRecordingNotice] = useState(""),
    [website, setWebsite] = useState("");
  const recorder = useRef<ThoughtRecorder | null>(null),
    savedAudio = useRef<Blob | null>(null);
  const [readyKey, setReadyKey] = useState("");
  const key = view === "compare" ? "ranking" : sample.id,
    canRecord = view === "play",
    recordState = recorder.current?.state || "idle";
  useEffect(() => {
    api<Config>("/config")
      .then(setConfig)
      .catch((e) => setNotice(e.message));
    void api<{ ticket: string }>("/ticket")
      .then((r) => setTicket(r.ticket))
      .catch((e) => setNotice(e.message));
  }, []);
  useEffect(() => {
    recorder.current?.dispose();
    recorder.current = null;
    setAudio(null);
    savedAudio.current = null;
    setAudioURL("");
    setRecordingNotice("");
    setConsent(false);
    setAudioConsent(false);
    const draft = readDraft(key);
    setNotes(typeof draft?.notes === "string" ? draft.notes : "");
    setName(typeof draft?.name === "string" ? draft.name : "");
    setRatings(draft?.ratings || {});
    const fresh = createGame(sample);
    if (
      view === "play" &&
      draft?.game &&
      Array.isArray(draft.game.values) &&
      draft.game.values.length === fresh.values.length &&
      draft.game.values.every(
        (v: unknown) =>
          Number.isInteger(v) && Number(v) >= 0 && Number(v) <= model.size,
      ) &&
      Array.isArray(draft.game.notes) &&
      draft.game.notes.length === fresh.notes.length &&
      draft.game.notes.every(
        (a: unknown) =>
          Array.isArray(a) &&
          a.every(
            (v) =>
              Number.isInteger(v) && Number(v) >= 1 && Number(v) <= model.size,
          ),
      )
    ) {
      fresh.values = draft.game.values;
      fresh.notes = draft.game.notes;
      sample.givens.forEach((v, i) => {
        if (v) fresh.values[i] = v;
      });
    }
    setGame(fresh);
    setReadyKey(key);
    let cancelled = false;
    audioDraft(draftKey(key))
      .then((blob) => {
        if (!cancelled && blob) {
          setAudio(blob);
          savedAudio.current = blob;
          setRecordingNotice(
            "Saved recording restored. Listen below, or remove it to make a new one.",
          );
        }
      })
      .catch(() => {});
    const r = new ThoughtRecorder(
      () => refreshRecorder((v) => v + 1),
      (blob) => {
        if (cancelled) return;
        setAudio(blob);
        savedAudio.current = blob;
        void audioDraft(draftKey(key), blob).catch(() =>
          setRecordingNotice(
            "This browser could not save the recording locally. Keep this page open until you send or download it.",
          ),
        );
      },
    );
    recorder.current = r;
    return () => {
      cancelled = true;
      r.dispose();
      recorder.current?.dispose();
    };
  }, [key]);
  useEffect(() => {
    if (readyKey !== key || (view === "play" && game.sample !== sample.id))
      return;
    try {
      localStorage.setItem(
        draftKey(key),
        JSON.stringify({
          notes,
          name,
          ratings,
          ...(view === "play"
            ? { game: { values: game.values, notes: game.notes } }
            : {}),
        }),
      );
    } catch {
      setNotice(
        "This browser could not save your draft. Keep this page open until you send it.",
      );
    }
  }, [key, readyKey, game, notes, name, ratings, view]);
  useEffect(() => {
    if (!audio) return;
    const url = URL.createObjectURL(audio);
    setAudioURL(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) recorder.current?.pause();
    };
    const leave = () => recorder.current?.dispose();
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  useEffect(() => {
    const type = (e: KeyboardEvent) => {
      if (
        sending ||
        view !== "play" ||
        game.inspector ||
        (e.target as HTMLElement).matches("input,textarea,select") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (/^[1-8]$/.test(e.key) && +e.key <= model.size) {
        e.preventDefault();
        setGame((g) => putValue(g, model, sample.givens, +e.key));
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setGame((g) => putValue(g, model, sample.givens, 0));
      }
    };
    document.addEventListener("keydown", type);
    return () => document.removeEventListener("keydown", type);
  }, [game.inspector, model, sample, sending, view]);
  const inspected = inspectedGroups(game, model),
    conflicts=findConflicts(model.groups,game.values),
    completed =
      game.values.every(Boolean) && badCells(model, game.values).size === 0;
  const sampleOptions = catalog.samples.filter((s) => s.model === model.id),
    profileLabel = (profile: string) =>
      ({
        guided: "Gentle start",
        pattern: "More to untangle",
        sparse: "Fewest clues",
      })[profile] || profile;
  const changeSample = (id: string) => {
    if (["recording", "paused", "requesting"].includes(recordState)) {
      setNotice(
        "Finish and send this recording, or remove it, before changing examples.",
      );
      return;
    }
    const next = catalog.samples.find((s) => s.id === id);
    if (!next) return;
    setGame(createGame(next));
    setSampleId(id);
    setNotice("");
  };
  const changeView = (next: "play" | "compare") => {
    if (sending) return;
    if (["recording", "paused", "requesting"].includes(recordState)) {
      setNotice(
        "Finish and send this recording, or remove it, before switching views.",
      );
      return;
    }
    setView(next);
    setNotice("");
  };
  async function toggleRecord() {
    if (savedAudio.current && !recorder.current?.blob) {
      setRecordingNotice(
        "Remove the restored recording before starting another.",
      );
      return;
    }
    if (recordState === "recording") recorder.current?.pause();
    else await recorder.current?.record();
  }
  async function finishAudio() {
    if (
      recorder.current &&
      ["recording", "paused"].includes(recorder.current.state)
    ) {
      const blob = await recorder.current.finish();
      setAudio(blob);
      savedAudio.current = blob;
    }
  }
  function removeAudio() {
    recorder.current?.dispose();
    recorder.current = new ThoughtRecorder(
      () => refreshRecorder((v) => v + 1),
      (blob) => {
        setAudio(blob);
        savedAudio.current = blob;
        void audioDraft(draftKey(key), blob).catch(() => {});
      },
    );
    setAudio(null);
    savedAudio.current = null;
    setAudioURL("");
    setRecordingNotice("");
    void audioDraft(draftKey(key), null).catch(() => {});
    refreshRecorder((v) => v + 1);
  }
  async function send() {
    if (!ticket) {
      setNotice(
        "Refreshing the submission check. Please try again in a few seconds.",
      );
      void api<{ ticket: string }>("/ticket")
        .then((r) => setTicket(r.ticket))
        .catch((e) => setNotice(e.message));
      return;
    }
    if (!consent || !Object.values(ratings).some((v) => v > 0)) {
      setNotice(
        "Choose at least one rating and confirm the public-feedback notice.",
      );
      return;
    }
    setSending(true);
    setNotice("Preparing your feedback…");
    try {
      await finishAudio();
      const blob = savedAudio.current;
      if (blob && blob.size > (config?.maxAudioBytes || 2097152))
        throw Error(
          "This recording is larger than 2 MB. Download it, then remove it to send your written feedback.",
        );
      if (blob && config?.audioAudience === "public" && !audioConsent)
        throw Error(
          "Confirm that this recording may appear with the public feedback.",
        );
      let encoded: string | undefined;
      if (blob) {
        encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(Error("Could not read this recording"));
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(blob);
        });
      }
      setNotice("Checking and sending…");
      const work = await proofOfWork(ticket);
      await api("/responses", {
        ticket,
        work,
        round: catalog.round,
        kind: view === "compare" ? "ranking" : "example",
        model: model.id,
        sample: sample.id,
        name,
        notes,
        ratings: Object.fromEntries(
          Object.entries(ratings).filter(([, v]) => v > 0),
        ),
        website,
        publicConsent: consent,
        audioConsent,
        ...(blob ? { audio: { mime: blob.type, base64: encoded } } : {}),
      });
      setTicket("");
      setNotice(
        "Thank you — your feedback was sent. Your puzzle can stay open.",
      );
      setNotes("");
      setRatings({});
      setConsent(false);
      setAudioConsent(false);
      removeAudio();
      void api<{ ticket: string }>("/ticket")
        .then((next) => setTicket(next.ticket))
        .catch(() =>
          setNotice(
            "Your feedback was sent. Reload this page before sending another response.",
          ),
        );
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Could not send. Your draft is still here.";
      setNotice(message);
      if (message.includes("expired"))
        void api<{ ticket: string }>("/ticket")
          .then((r) => setTicket(r.ticket))
          .catch(() => {});
    } finally {
      setSending(false);
    }
  }
  return (
    <main className="testing-shell">
      <Header />
      <section className="testing-intro">
        <p className="testing-eyebrow">Help shape the next *doku</p>
        <h1>A little play. A few honest thoughts.</h1>
        <p>
          Try a few examples, tell us what clicks and what gets in your way. You
          don’t need to finish a puzzle or sign in. Feedback is about the
          design, not your performance.
        </p>
        <div className="test-view-switch">
          <button
            aria-pressed={view === "play"}
            onClick={() => changeView("play")}
          >
            Try an example
          </button>
          <button
            aria-pressed={view === "compare"}
            onClick={() => changeView("compare")}
          >
            Compare & rate directions
          </button>
        </div>
      </section>
      {view === "play" ? (
        <>
          <div className="testing-pickers">
            <label>
              Game direction
              <select
                disabled={sending}
                value={model.id}
                onChange={(e) =>
                  changeSample(
                    catalog.samples.find(
                      (s) =>
                        s.model === e.target.value && s.profile === "guided",
                    )!.id,
                  )
                }
              >
                {catalog.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {titles[m.id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Example
              <select
                disabled={sending}
                value={sample.id}
                onChange={(e) => changeSample(e.target.value)}
              >
                {sampleOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {profileLabel(s.profile)} · {s.seed}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="testing-play-layout">
            <section className="testing-game">
              <h2>{titles[model.id]}</h2>
              <div className="inspector-toggle">
                <button
                  className={game.inspector ? "active" : ""}
                  aria-pressed={game.inspector}
                  onClick={() =>
                    setGame((g) => ({
                      ...g,
                      inspector: !g.inspector,
                      inspectCell: null,
                    }))
                  }
                >
                  {game.inspector ? "Exit inspector" : "Inspect a cell"}
                </button>
                <p>
                  {game.inspector
                    ? "Tap any cell to see all its groups. Entry tools are paused."
                    : "Inspector is off. Playing only highlights your selected cell or value."}
                </p>
              </div>
              <RingBoard
                model={model}
                state={game}
                givens={sample.givens}
                onCell={(i) =>
                  setGame((g) => visitCell(g, model, sample.givens, i))
                }
              />
              {(game.inspector ? game.inspectCell : game.selected) !== null && (
                <div
                  className="test-note-shelf"
                  aria-label="Selected cell notes"
                >
                  <span>Cell notes · larger view</span>
                  <div
                    style={{
                      gridTemplateColumns: `repeat(${model.size === 8 ? 4 : 2},1fr)`,
                    }}
                  >
                    {Array.from({ length: model.size }, (_, i) => (
                      <b
                        key={i}
                        className={
                          game.notes[
                            (game.inspector ? game.inspectCell : game.selected)!
                          ]?.includes(i + 1)
                            ? "present"
                            : ""
                        }
                      >
                        {i + 1}
                      </b>
                    ))}
                  </div>
                  <small>
                    Lit numbers are notes you entered. Dim positions are empty.
                  </small>
                </div>
              )}
              <div className="test-edit-tools">
                <button
                  disabled={game.inspector || sending}
                  aria-pressed={!game.pencil}
                  onClick={() => setGame((g) => ({ ...g, pencil: false }))}
                >
                  Pen
                </button>
                <button
                  disabled={game.inspector || sending}
                  aria-pressed={game.pencil}
                  onClick={() => setGame((g) => ({ ...g, pencil: true }))}
                >
                  Notes
                </button>
                <button
                  disabled={game.inspector || sending || !game.past.length}
                  onClick={() => setGame(restoreGame)}
                >
                  Undo
                </button>
                <button
                  disabled={game.inspector || sending}
                  onClick={() =>
                    setGame((g) => putValue(g, model, sample.givens, 0))
                  }
                >
                  Erase
                </button>
              </div>
              <div
                className="test-keypad"
                style={{
                  gridTemplateColumns: `repeat(${model.size === 8 ? 4 : model.size},1fr)`,
                }}
              >
                {Array.from({ length: model.size }, (_, i) => (
                  <button
                    key={i}
                    disabled={game.inspector || sending}
                    aria-label={"Select " + (i + 1)}
                    aria-pressed={game.active === i + 1}
                    onClick={() =>
                      setGame((g) => ({
                        ...g,
                        active: g.active === i + 1 ? null : i + 1,
                      }))
                    }
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              {conflicts.length>0&&<div className="test-conflict" role="status" aria-live="polite"><strong>Number conflict</strong><ul>{conflicts.slice(0,3).map(c=><li key={c.group.name+':'+c.value}>{describeConflict(c,i=>`ring ${model.cells[i].ring+1}, spoke ${model.cells[i].sector+1}`)}</li>)}</ul>{conflicts.length>3&&<details><summary>{conflicts.length-3} more conflicts</summary><ul>{conflicts.slice(3).map(c=><li key={c.group.name+':'+c.value}>{describeConflict(c,i=>`ring ${model.cells[i].ring+1}, spoke ${model.cells[i].sector+1}`)}</li>)}</ul></details>}<p>Each group uses 1–{model.size} once. Change or erase one of your highlighted entries.</p></div>}
              <p className="test-board-status" role="status">
                {completed
                  ? "Every group is complete. Nicely done!"
                  : badCells(model, game.values).size
                    ? "Repeated entries are outlined and underlined on the board."
                    : game.inspector
                      ? inspected.length
                        ? "All of this cell’s groups are outlined above."
                        : "Choose a cell to inspect."
                      : game.selected !== null
                        ? `Ring ${model.cells[game.selected].ring + 1}, spoke ${model.cells[game.selected].sector + 1}. ${game.values[game.selected] ? "Value " + game.values[game.selected] : game.notes[game.selected].length ? "Notes " + game.notes[game.selected].join(", ") : "Empty cell."}`
                        : "Choose a value, then an empty cell. You can also select a cell and type."}
              </p>
              <details>
                <summary>More playing tools</summary>
                <button
                  disabled={game.inspector || sending}
                  onClick={() =>
                    setGame((g) => ({
                      ...g,
                      notes: g.values.map((v, i) =>
                        v ? [] : possible(model, g.values, i),
                      ),
                    }))
                  }
                >
                  Fill possible notes
                </button>
                <button
                  disabled={game.inspector || sending}
                  onClick={() => {
                    if (
                      window.confirm("Clear this sample’s entries and notes?")
                    )
                      setGame(createGame(sample));
                  }}
                >
                  Reset this example
                </button>
              </details>
            </section>
            <aside className="testing-instructions">
              <h2>How this one works</h2>
              <p className="instruction-lead">{instructions[model.id].lead}</p>
              <ol>
                {instructions[model.id].points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {model.geometry.linked && (
                <p className="region-key">
                  <span>━ Purple: first set</span>
                  <span>┄ Amber: overlapping set</span>
                </p>
              )}
              <p>
                Every example has one solution. These clue sets are experiments,
                not a final difficulty scale.
              </p>
              <p>
                Choose <strong>Inspect a cell</strong> whenever you want to
                follow the groups without placing anything. All groups for that
                cell appear together; turn the inspector off to keep playing.
              </p>
            </aside>
          </div>
        </>
      ) : (
        <section className="testing-comparison">
          <h2>Which directions would you play again?</h2>
          <p>
            Rate only the ones you tried. 1 means “not for me”; 5 means “I’d
            like more.”
          </p>
          {catalog.models.map((m) => (
            <Rating
              key={m.id}
              label={titles[m.id]}
              value={ratings[m.id] || 0}
              disabled={sending}
              onChange={(n) => setRatings((r) => ({ ...r, [m.id]: n }))}
            />
          ))}
        </section>
      )}
      <section className="testing-feedback" aria-label="Your feedback">
        <h2>
          {view === "play" ? "What are you noticing?" : "Your overall thoughts"}
        </h2>
        <p>
          Jot something down while you play. What feels satisfying? Which
          boundary or rule is confusing? What would make this easier to read?
        </p>
        {view === "play" && (
          <div className="test-ratings">
            <Rating
              label="Rule clarity"
              value={ratings.clarity || 0}
              disabled={sending}
              onChange={(n) => setRatings((r) => ({ ...r, clarity: n }))}
            />
            <Rating
              label="Enjoyment"
              value={ratings.enjoyment || 0}
              disabled={sending}
              onChange={(n) => setRatings((r) => ({ ...r, enjoyment: n }))}
            />
            <Rating
              label="Difficulty"
              value={ratings.difficulty || 0}
              disabled={sending}
              onChange={(n) => setRatings((r) => ({ ...r, difficulty: n }))}
            />
            <small>
              1 = low · 5 = high. Difficulty describes this sample, not your
              skill.
            </small>
          </div>
        )}
        <label>
          Notes
          <textarea
            disabled={sending}
            value={notes}
            maxLength={10000}
            rows={6}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="This feels… / I got confused when… / I’d like…"
          />
        </label>
        <label>
          Name or nickname (optional)
          <input
            disabled={sending}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="testing-honeypot" aria-hidden="true">
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
        {canRecord && (
          <div className="testing-recording">
            <h3>Say a thought instead — or add one</h3>
            <p>
              Record, pause, then continue the same recording. Only active
              recording time counts. Finish to listen before sending. Nothing is
              uploaded until you send.
            </p>
            {config?.audioAudience === "public" && (
              <p>Recordings appear on the public feedback page only with your separate consent below. You can listen to or remove your recording before sending.</p>
            )}
            <div className="record-controls">
              <button
                disabled={
                  sending ||
                  recordState === "requesting" ||
                  recordState === "finished" ||
                  (!!audio && recordState === "idle")
                }
                onClick={() => void toggleRecord()}
              >
                {recordState === "requesting"
                  ? "Requesting microphone…"
                  : recordState === "recording"
                    ? "Pause recording"
                    : recordState === "paused"
                      ? "Continue recording"
                      : "Record a thought"}
              </button>
              <button
                disabled={
                  sending || !["recording", "paused"].includes(recordState)
                }
                onClick={() => void finishAudio()}
              >
                Finish & listen
              </button>
              <button
                disabled={sending || (!audio && recordState === "idle")}
                onClick={removeAudio}
              >
                Remove recording
              </button>
              <span role="status">
                {recordState === "recording"
                  ? "● Recording"
                  : recordState === "paused"
                    ? "Paused"
                    : recordState === "finished"
                      ? "Ready to review"
                      : ""}{" "}
                {recorder.current?.duration()
                  ? Math.floor(recorder.current.duration()) + "s"
                  : ""}
              </span>
            </div>
            {audioURL && recordState !== "recording" && (
              <audio controls src={audioURL} />
            )}
            <p className="record-note">
              {recorder.current?.error ||
                recordingNotice ||
                "Up to five active minutes or 2 MB. Microphone access ends when you finish, remove the recording or leave this page."}
            </p>
            {audioURL && (
              <a
                href={audioURL}
                download={
                  "doku-thought." +
                  (audio?.type.includes("mp4")
                    ? "m4a"
                    : audio?.type.includes("ogg")
                      ? "ogg"
                      : "webm")
                }
              >
                Download your recording
              </a>
            )}
          </div>
        )}
        <label className="test-consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={sending}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I understand my ratings, written notes and optional nickname will
          appear on the public feedback page.
        </label>
        {audio && config?.audioAudience === "public" && (
          <label className="test-consent">
            <input
              type="checkbox"
              disabled={sending}
              checked={audioConsent}
              onChange={(e) => setAudioConsent(e.target.checked)}
            />
            I also agree to share this recording on the public feedback page.
          </label>
        )}
        {audio && config?.audioAudience === "private" && (
          <p>
            Recordings are kept private and are not included in the public
            feedback page.
          </p>
        )}
        <button
          className="test-primary"
          disabled={sending || !config || recordState === "requesting"}
          onClick={() => void send()}
        >
          {sending ? "Sending…" : "Send feedback"}
        </button>
        <p className="test-notice" role="status" aria-live="polite">
          {notice}
        </p>
        <p className="draft-note">
          Unsent written notes and puzzle progress stay on this device.
          Recording drafts use this browser’s local storage when available.
        </p>
      </section>
      <footer>
        Thanks for helping these experiments find their shape.{" "}
        <a href="/testing/results/">See the feedback so far</a>.
      </footer>
    </main>
  );
}
function Results() {
  const [rows, setRows] = useState<ResponseRow[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [ownerKey, setOwnerKey] = useState(""),
    [privateAudio, setPrivateAudio] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  useEffect(() => {
    api<{ responses: ResponseRow[] }>("/results")
      .then((r) => setRows(r.responses))
      .catch((e) => setError(e.message));
    return () => urls.current.forEach(URL.revokeObjectURL);
  }, []);
  const visible = rows.filter(
    (r) => filter === "all" || r.model === filter || r.kind === "ranking",
  );
  async function loadPrivate(id: string) {
    try {
      const r = await fetch("/api/playtesting/audio/" + id, {
        headers: { Authorization: "Bearer " + ownerKey },
      });
      if (!r.ok) throw Error("Owner access was not accepted.");
      const url = URL.createObjectURL(await r.blob());
      urls.current.push(url);
      setPrivateAudio((a) => ({ ...a, [id]: url }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="testing-shell">
      <Header results />
      <section className="testing-intro">
        <p className="testing-eyebrow">Feedback so far</p>
        <h1>What’s finding its shape?</h1>
        <p>
          These are early opinions from a small test group, not a representative
          poll. Responses are anonymous unless the tester adds a nickname.
        </p>
      </section>
      <section className="testing-summary">
        <h2>Direction ratings</h2>
        {catalog.models.map((m) => {
          const r = rows.flatMap((row) => {
            const value =
              row.kind === "ranking"
                ? row.ratings[m.id]
                : row.kind === "example" && row.model === m.id
                  ? row.ratings.enjoyment
                  : 0;
            return value ? [value] : [];
          });
          return (
            <div key={m.id}>
              <h3>{titles[m.id]}</h3>
              <strong>
                {r.length
                  ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) +
                    " / 5"
                  : "No ratings yet"}
              </strong>
              <small>
                {r.length} {r.length === 1 ? "rating" : "ratings"} · combines
                enjoyment and “play again” ratings
              </small>
            </div>
          );
        })}
      </section>
      <section>
        <h2>Notes from testers</h2>
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All directions</option>
            {catalog.models.map((m) => (
              <option key={m.id} value={m.id}>
                {titles[m.id]}
              </option>
            ))}
          </select>
        </label>
        {!visible.length && !error && (
          <p>No responses yet. Yours can be the first.</p>
        )}
        {visible.map((r) => (
          <article className="test-response" key={r.id}>
            <h3>
              {r.kind === "ranking"
                ? "Overall direction ratings"
                : r.kind === "game" ? "Ringdoku · in-game feedback" : titles[r.model] || r.model}
            </h3>
            <p className="response-meta">
              {r.name || "A tester"} · {new Date(r.createdAt).toLocaleString()}
              {r.sample ? " · " + r.sample : ""}
            </p>
            {Object.keys(r.ratings).length > 0 && (
              <p>{Object.entries(r.ratings).map(([k, v]) => (titles[k] || k) + ": " + v + "/5").join(" · ")}</p>
            )}
            {r.notes && <p className="response-notes">{r.notes}</p>}
            {r.audioAvailable ? (
              <audio
                controls
                preload="none"
                src={"/api/playtesting/audio/" + r.id}
              />
            ) : (
              r.audioBytes > 0 && (
                <>
                  <p className="response-meta">Private recording attached.</p>
                  {ownerKey && (
                    <button onClick={() => void loadPrivate(r.id)}>
                      Load private recording
                    </button>
                  )}
                  {privateAudio[r.id] && (
                    <audio controls src={privateAudio[r.id]} />
                  )}
                </>
              )
            )}
          </article>
        ))}
        <p role="status">{error}</p>
      </section>
      <details className="owner-recordings">
        <summary>Owner access to private recordings</summary>
        <p>
          Written feedback and ratings stay public. An owner access key is
          required only to listen to recordings that were submitted privately.
        </p>
        <label>
          Owner key
          <input
            type="password"
            autoComplete="off"
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
          />
        </label>
      </details>
    </main>
  );
}
