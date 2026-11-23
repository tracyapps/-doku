export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "finished"
  | "error";
export class ThoughtRecorder {
  state: RecordingState = "idle";
  blob: Blob | null = null;
  error = "";
  seconds = 0;
  private chunks: Blob[] = [];
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private since = 0;
  private disposed = false;
  private finishing: Promise<Blob> | null = null;
  constructor(
    private changed: () => void,
    private save: (blob: Blob) => void = () => {},
    private deps = {
      media: () => navigator.mediaDevices,
      Recorder: () => globalThis.MediaRecorder,
      now: () => performance.now(),
    },
  ) {}
  private notify() {
    this.changed();
  }
  async record() {
    if (this.disposed) return;
    if (
      this.state === "requesting" ||
      this.state === "recording" ||
      this.state === "finished"
    )
      return;
    if (this.state === "paused" && this.recorder) {
      this.stream?.getAudioTracks().forEach((t) => (t.enabled = true));
      this.recorder.resume();
      this.since = this.deps.now();
      this.state = "recording";
      this.notify();
      return;
    }
    this.state = "requesting";
    this.error = "";
    this.notify();
    try {
      const Recorder = this.deps.Recorder(),
        media = this.deps.media();
      if (!media?.getUserMedia || !Recorder)
        throw Error(
          "Voice recording is unavailable in this browser. Written notes still work.",
        );
      this.stream = await media.getUserMedia({ audio: true });
      if (this.disposed) {
        this.cleanup();
        return;
      }
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => Recorder.isTypeSupported(m));
      this.recorder = new Recorder(this.stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 48000,
      });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) {
          this.chunks.push(e.data);
          this.blob = new Blob(this.chunks, {
            type: this.recorder?.mimeType || e.data.type,
          });
          this.save(this.blob);
          if (this.blob.size > 1750000 && this.state === "recording")
            void this.finish();
        }
        this.notify();
      };
      this.recorder.onerror = () => {
        this.error =
          "The microphone stopped unexpectedly. Your written notes are still here.";
        this.state = "error";
        this.cleanup();
        this.notify();
      };
      this.recorder.start(1000);
      this.since = this.deps.now();
      this.state = "recording";
      this.tick = setInterval(() => {
        if (this.state === "recording" && this.duration() >= 300)
          void this.finish();
        this.notify();
      }, 500);
      this.notify();
    } catch (e) {
      if (this.disposed) return;
      this.state = "error";
      this.error =
        e instanceof Error
          ? e.message
          : "Microphone permission was not granted. You can still send written notes.";
      this.cleanup();
      this.notify();
    }
  }
  duration() {
    return (
      this.seconds +
      (this.state === "recording" ? (this.deps.now() - this.since) / 1000 : 0)
    );
  }
  pause() {
    if (this.state !== "recording" || !this.recorder) return;
    this.seconds = this.duration();
    this.recorder.pause();
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
    this.state = "paused";
    this.recorder.requestData();
    this.notify();
  }
  async finish() {
    if (this.finishing) return this.finishing;
    if (!this.recorder || this.recorder.state === "inactive")
      return this.blob || new Blob();
    this.seconds = this.duration();
    this.state = "finished";
    this.finishing = new Promise<Blob>((resolve) => {
      this.recorder!.onstop = () => {
        this.blob = new Blob(this.chunks, {
          type: this.recorder?.mimeType || "audio/webm",
        });
        this.save(this.blob);
        this.cleanup();
        this.notify();
        resolve(this.blob);
      };
      this.recorder!.stop();
    });
    this.notify();
    return this.finishing;
  }
  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }
  dispose() {
    this.disposed = true;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.cleanup();
  }
}
let draftQueue: Promise<unknown> = Promise.resolve();
export function audioDraft(
  key: string,
  value?: Blob | null,
): Promise<Blob | null> {
  const job = draftQueue.then(() => accessAudioDraft(key, value));
  draftQueue = job.catch(() => {});
  return job;
}
async function accessAudioDraft(
  key: string,
  value?: Blob | null,
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("doku-playtest-audio-v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("recordings");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction(
          "recordings",
          value === undefined ? "readonly" : "readwrite",
        ),
        store = tx.objectStore("recordings");
      const req =
        value === undefined
          ? store.get(key)
          : value === null
            ? store.delete(key)
            : store.put(value, key);
      let result: Blob | null = null;
      req.onsuccess = () => {
        result = value === undefined ? req.result || null : value || null;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
