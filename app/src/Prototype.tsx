import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Gear,
  DotsThree,
  Timer,
  ArrowCounterClockwise,
  ArrowClockwise,
  Eraser,
  CaretDown,
  CaretLeft,
  X,
  Check,
  ArrowRight,
  Triangle,
  Circle,
  Square,
  Diamond,
  Plus,
  Star,
  Moon,
  Heart,
  Hexagon,
  PuzzlePiece,
  Palette,
  Hash,
  ClockCounterClockwise,
  Trophy,
  Link as LinkIcon,
  Lightbulb,
  Eye,
  EyeSlash,
  CheckCircle,
  Play,
  House,
  Users,
  Lock,
  RoadHorizon,
  Bug,
  ChatCircleDots,
  GithubLogo,
  RocketLaunch,
} from "@phosphor-icons/react";
import { BottomSheet, MobileScroll, KeyboardInput } from "./mobile";
import {
  candidates,
  completedUnits,
  conflicts,
  createPuzzle,
  type Variant,
  type Difficulty,
} from "./game/engine";
import { selectCell, toggleValue } from "./game/selection";
import {
  autofill,
  enter,
  eraseCell,
  formatTime,
  newSession,
  readSaved,
  restore,
  reveal,
  save,
  solved,
  stats,
  type Session,
} from "./game/session";
import {
  createChallenge,
  getChallenge,
  startChallengeAttempt,
  submitChallengeResult,
  initializeDiscord,
  getRoadmap,
  openExternalUrl,
  type RoadmapFeed,
  type RoadmapIssue,
} from "./game/network";
import "@fontsource/outfit/latin-800.css";
import "@fontsource/outfit/latin-900.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";

type Screen =
  | "home"
  | "setup"
  | "game"
  | "history"
  | "results"
  | "how"
  | "friends"
  | "roadmap"
  | "terms"
  | "privacy";
type Theme =
  | "night"
  | "paper"
  | "retro"
  | "comic"
  | "doodle"
  | "glass"
  | "rounded"
  | "contrast"
  | "plum";
type Settings = {
  theme: Theme;
  input: "cell" | "value";
  timer: boolean;
  matches: boolean;
  conflicts: boolean;
  autocheck: boolean;
  removeNotes: boolean;
  celebrations: boolean;
  size: number;
  noteSize: number;
  weight: "theme" | number;
  font: "theme" | "sans" | "serif" | "mono";
};
const defaults: Settings = {
  theme: "night",
  input: "cell",
  timer: true,
  matches: true,
  conflicts: false,
  autocheck: false,
  removeNotes: true,
  celebrations: true,
  size: 1,
  noteSize: 1,
  weight: "theme",
  font: "theme",
};
const themeOptions: { id: Theme; label: string }[] = [
  { id: "retro", label: "Retro" },
  { id: "comic", label: "Comic book" },
  { id: "doodle", label: "Doodle" },
  { id: "glass", label: "Glass" },
  { id: "rounded", label: "Web 2.0" },
  { id: "night", label: "Night" },
  { id: "paper", label: "Paper" },
  { id: "contrast", label: "Contrast" },
  { id: "plum", label: "Plum" },
];
const labels: Record<Variant, string> = {
  classic: "sudoku",
  hue: "huedoku",
  jigsaw: "jigsadoku",
};
const types: [Variant, string, string, typeof Hash][] = [
  [
    "classic",
    "sudoku",
    "The familiar numbers. A fresh little challenge.",
    Hash,
  ],
  [
    "hue",
    "huedoku",
    "Nine colors. Nine shapes. A different way to see.",
    Palette,
  ],
  [
    "jigsaw",
    "jigsadoku",
    "Same logic, wonderfully irregular regions.",
    PuzzlePiece,
  ],
];
const symbols = [
  Triangle,
  Circle,
  Square,
  Diamond,
  Plus,
  Star,
  Moon,
  Heart,
  Hexagon,
];
const colorNames = [
  "red triangle",
  "orange circle",
  "gold square",
  "green diamond",
  "teal cross",
  "blue star",
  "indigo crescent",
  "purple heart",
  "rose hexagon",
];
const colors = [
  "#fa726c",
  "#f6a355",
  "#e8c95b",
  "#7acd87",
  "#62ccc5",
  "#79b4ff",
  "#ad9dfb",
  "#d896ed",
  "#f394bb",
];
const ACTIVE = "doku.active.v1",
  HISTORY = "doku.history.v1",
  SETTINGS = "doku.settings.v1";
const DISCORD_APP_ID = "1548073007950602303";
type RoadmapStatus = "planned" | "progress" | "shipped";
type RoadmapCard = {
  id: string;
  number?: number;
  title: string;
  body: string;
  url?: string;
  status: RoadmapStatus;
  updatedAt?: string;
};
const builtInRoadmap: RoadmapCard[] = [
  {
    id: "feedback",
    title: "Public roadmap & feedback",
    body: "Follow what is planned, suggest an idea, or report a bug from the site and the in-game menu.",
    status: "shipped",
  },
  {
    id: "discord-share",
    title: "Discord challenge sharing",
    body: "Share a finished puzzle deliberately, with friendly comparisons that keep time, accuracy, level, and assistance separate.",
    status: "progress",
  },
  {
    id: "sync",
    title: "Optional Discord sync",
    body: "Keep guest play local and accountless, while Discord sign-in can carry your own progress and history between devices.",
    status: "planned",
  },
  {
    id: "group-cards",
    title: "Live group result cards",
    body: "Update one channel card as friends finish the same puzzle, without posting a new message for every game.",
    status: "planned",
  },
];
const roadmapLanes: Array<{
  id: RoadmapStatus;
  label: string;
  description: string;
}> = [
  { id: "progress", label: "In motion", description: "Being shaped now" },
  { id: "planned", label: "Up next", description: "Accepted, not dated" },
  { id: "shipped", label: "Shipped", description: "Ready to try" },
];
const issueStatus = (issue: RoadmapIssue): RoadmapStatus => {
  const labels = issue.labels.map((label) => label.toLowerCase());
  if (labels.includes("status:shipped") || issue.state === "closed")
    return "shipped";
  if (labels.includes("status:in-progress")) return "progress";
  return "planned";
};
const roadmapCards = (feed: RoadmapFeed | null): RoadmapCard[] =>
  feed?.configured
    ? feed.issues.map((issue) => ({
        id: String(issue.id),
        number: issue.number,
        title: issue.title,
        body:
          issue.body
            .split("\n")
            .find((line) => line.trim() && !line.startsWith("#"))
            ?.replace(/^[-*]\s*/, "")
            .slice(0, 240) || "Open the issue for the latest notes.",
        url: issue.url,
        status: issueStatus(issue),
        updatedAt: issue.updatedAt,
      }))
    : builtInRoadmap;
function Brand({ variant }: { variant?: Variant }) {
  const prefix = variant ? labels[variant].slice(0, -4) : "*";
  return (
    <span className="brand">
      <span>{prefix}</span>doku
    </span>
  );
}
function BrandArtwork({ footer = false }: { footer?: boolean }) {
  return (
    <img
      className={`brand-artwork ${footer ? "footer-logo" : ""}`}
      src="/assets/brand/doku-logo.svg"
      alt="*doku"
    />
  );
}
function Symbol({
  value,
  small = false,
  pattern = false,
}: {
  value: number;
  small?: boolean;
  pattern?: boolean;
}) {
  const Icon = symbols[value - 1];
  return (
    <span
      className={`symbol ${small ? "small" : ""} ${pattern ? "pattern" : ""}`}
      style={{ color: pattern ? undefined : colors[value - 1] }}
      aria-hidden="true"
    >
      {pattern ? (
        <>
          {Array.from({ length: 4 }, (_, i) => (
            <Icon key={i} weight="fill" />
          ))}
        </>
      ) : (
        <Icon weight="fill" />
      )}
    </span>
  );
}
function Modal({
  preview,
  open,
  title,
  children,
  onClose,
}: {
  preview: boolean;
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (preview)
    return (
      <BottomSheet
        open={open}
        onOpenChange={(v) => !v && onClose()}
        title={title}
      >
        <div className="doku-sheet">
          {children}
          <button className="secondary wide" onClick={onClose}>
            Done
          </button>
        </div>
      </BottomSheet>
    );
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={22} />
            </Dialog.Close>
          </div>
          <div className="doku-sheet">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`switch ${value ? "on" : ""}`}
      >
        <span />
      </button>
    </label>
  );
}
function InputModeDemo() {
  return (
    <figure
      className="input-mode-demo"
      aria-label="Animated comparison of cell-first and value-first entry"
    >
      <figcaption>
        Watch the order change—the same 7 lands in the same square.
      </figcaption>
      <div className="input-demo-grid">
        <div className="input-demo-card cell-first-demo">
          <strong>Cell first</strong>
          <div className="input-demo-stage" aria-hidden="true">
            <span className="demo-cell demo-target">
              <b>7</b>
            </span>
            <span className="demo-cell" />
            <span className="demo-cell" />
            <span className="demo-cell" />
            <span className="demo-key">7</span>
          </div>
          <small>Square, then value</small>
        </div>
        <div className="input-demo-card value-first-demo">
          <strong>Value first</strong>
          <div className="input-demo-stage" aria-hidden="true">
            <span className="demo-cell demo-target">
              <b>7</b>
            </span>
            <span className="demo-cell" />
            <span className="demo-cell" />
            <span className="demo-cell" />
            <span className="demo-key">7</span>
          </div>
          <small>Value, then squares</small>
        </div>
      </div>
    </figure>
  );
}
export default function Prototype() {
  return (
    <MobileScroll className="doku-preview">
      <DokuApp preview />
    </MobileScroll>
  );
}
export function DokuApp({ preview = false }: { preview?: boolean }) {
  const marketingSite =
    !preview && !new URLSearchParams(location.search).has("frame_id");
  const [playerName, setPlayerName] = useState(() =>
    readSaved<string>("doku.name.v1", ""),
  );
  const [settings, setSettings] = useState<Settings>(() => ({
    ...defaults,
    ...readSaved(SETTINGS, {}),
  }));
  const [session, setSession] = useState<Session | null>(() =>
    readSaved(ACTIVE, null),
  );
  const [history, setHistory] = useState<Session[]>(() =>
    readSaved(HISTORY, []),
  );
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(location.search),
      page = params.get("page");
    return page === "privacy" ||
      page === "terms" ||
      page === "how" ||
      page === "roadmap"
      ? page
      : params.has("challenge")
        ? "setup"
        : params.has("play")
          ? "game"
          : "home";
  });
  const [howReturn, setHowReturn] = useState<Screen>("home");
  const [sheet, setSheet] = useState<"settings" | "more" | null>(null),
    [confirm, setConfirm] = useState<"restart" | "new" | "reveal" | null>(null);
  const [variant, setVariant] = useState<Variant>("classic"),
    [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [selected, setSelected] = useState<number | null>(null),
    [active, setActive] = useState<number | null>(null),
    [eraseActive, setEraseActive] = useState(false),
    [notes, setNotes] = useState(false),
    [hideNotes, setHideNotes] = useState(false),
    [timerShown, setTimerShown] = useState(settings.timer);
  const [toast, setToast] = useState(""),
    [checked, setChecked] = useState<number[]>([]),
    [celebrate, setCelebrate] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Session | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("challenge"),
  );
  const [challengeData, setChallengeData] = useState<Awaited<
    ReturnType<typeof getChallenge>
  > | null>(null);
  const [shareUrl, setShareUrl] = useState(""),
    [discord, setDiscord] = useState(""),
    [storageError, setStorageError] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapFeed | null>(null),
    [roadmapLoading, setRoadmapLoading] = useState(true),
    [roadmapProblem, setRoadmapProblem] = useState(false);

  const celebrationSeen = useRef(new Set<string>());
  const notify = (message: string) => setToast(message);
  const selectedGiven = selected !== null && !!session?.puzzle.givens[selected];
  const clearSelection = () => {
    setSelected(null);
    setActive(null);
    setEraseActive(false);
  };
  useEffect(() => {
    save("doku.name.v1", playerName);
  }, [playerName]);
  useEffect(() => {
    if (!save(SETTINGS, settings)) setStorageError(true);
    document.documentElement.dataset.dokuTheme = settings.theme;
  }, [settings]);
  useEffect(() => {
    if (!save(ACTIVE, session)) setStorageError(true);
  }, [session]);
  useEffect(() => {
    if (!save(HISTORY, history)) setStorageError(true);
  }, [history]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!celebrate.length) return;
    const timer = setTimeout(() => setCelebrate([]), 900);
    return () => clearTimeout(timer);
  }, [celebrate]);
  useEffect(() => {
    initializeDiscord()
      .then((s) => {
        if (s.status === "connected" && s.username) setPlayerName(s.username);
        if (s.status === "unavailable")
          setDiscord(
            "Discord connection is not configured. Solo play is available.",
          );
      })
      .catch(() =>
        setDiscord("Discord could not connect. Solo play is available."),
      );
  }, []);
  useEffect(() => {
    let cancelled = false;
    getRoadmap()
      .then((data) => {
        if (!cancelled) setRoadmap(data);
      })
      .catch(() => {
        if (!cancelled) setRoadmapProblem(true);
      })
      .finally(() => {
        if (!cancelled) setRoadmapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    getChallenge(challengeId)
      .then((data) => {
        if (!cancelled) {
          setChallengeData(data);
          setVariant(data.variant);
        }
      })
      .catch(() => {
        if (!cancelled)
          notify(
            "That challenge could not be loaded. Check the link or try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [challengeId]);
  useEffect(() => {
    if (screen === "game" && !session) {
      setScreen("setup");
    }
  }, [screen, session]);
  // Time tracks active visible solving. Hiding the timer never pauses it.
  useEffect(() => {
    if (screen !== "game" || !session || session.completedAt) return;
    let last = performance.now();
    const tick = setInterval(() => {
      const now = performance.now(),
        delta = (now - last) / 1000;
      last = now;
      if (document.visibilityState === "visible")
        setSession((s) =>
          s && !s.completedAt ? { ...s, seconds: s.seconds + delta } : s,
        );
    }, 1000);
    return () => clearInterval(tick);
  }, [screen, session?.id, session?.completedAt]);
  useEffect(() => {
    if (!session || session.completedAt || !solved(session)) return;
    const finished = {
      ...session,
      past: [],
      future: [],
      completedAt: new Date().toISOString(),
    };
    setSession(finished);
    setResult(finished);
    setHistory((h) =>
      h.some((s) => s.id === finished.id) ? h : [finished, ...h],
    );
    notify("Beautifully done. Your puzzle is complete.");
  }, [session]);
  const setPreference = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
    if (
      (key === "autocheck" || key === "conflicts") &&
      session &&
      !session.completedAt
    )
      setSession((s) =>
        s
          ? { ...s, events: [...s.events, { kind: key, enabled: !!value }] }
          : s,
      );
  };
  const start = async (seed?: string) => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const family = seed || challengeData?.seed || crypto.randomUUID();
      const puzzle = createPuzzle(family, variant, difficulty);
      let next = newSession(puzzle);
      if (challengeId) {
        if (!challengeData)
          throw new Error("Load the challenge before starting.");
        const attempt = await startChallengeAttempt(
          challengeId,
          difficulty,
          playerName || undefined,
        );
        next.challenge = {
          id: challengeId,
          attemptId: attempt.attemptId,
          token: attempt.token,
        };
        if (
          JSON.stringify(attempt.puzzle.givens) !==
          JSON.stringify(puzzle.givens)
        )
          throw new Error("Puzzle version mismatch. Refresh before joining.");
      }
      if (settings.autocheck)
        next.events.push({ kind: "autocheck", enabled: true });
      if (settings.conflicts)
        next.events.push({ kind: "conflicts", enabled: true });
      setSession(next);
      setSelected(null);
      setActive(null);
      setEraseActive(false);
      setNotes(false);
      setHideNotes(false);
      setChecked([]);
      setTimerShown(settings.timer);
      setScreen("game");
      setSheet(null);
      setConfirm(null);
      setShareUrl("");
      celebrationSeen.current = new Set(
        completedUnits(next.values, next.puzzle.regions).map((u) =>
          u.join(","),
        ),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not start the puzzle.");
    } finally {
      setBusy(false);
    }
  };
  const move = (index: number, value: number) => {
    if (!session) return;
    const next = enter(session, index, value, notes, settings.removeNotes);
    if (next === session) return;
    setSession(next);
    setChecked([]);
    if (settings.celebrations) {
      const before = new Set(
        completedUnits(session.values, session.puzzle.regions).map((u) =>
          u.join(","),
        ),
      );
      const fresh = completedUnits(next.values, next.puzzle.regions).filter(
        (u) =>
          !before.has(u.join(",")) && !celebrationSeen.current.has(u.join(",")),
      );
      for (const u of fresh) celebrationSeen.current.add(u.join(","));
      if (fresh.length) setCelebrate([...new Set(fresh.flat())]);
    }
  };
  const cellClick = (i: number) => {
    if (!session) return;
    const given = !!session.puzzle.givens[i];
    setSelected(i);
    if (given) {
      setEraseActive(false);
      setActive(session.values[i] || null);
      return;
    }
    if (settings.input === "value" && eraseActive) {
      setSession((s) => (s ? eraseCell(s, i, notes) : s));
      setChecked([]);
      return;
    }
    setEraseActive(false);
    const choice = selectCell(settings.input, active, session.values[i], given);
    setActive(choice.active);
    if (choice.place && choice.active) move(i, choice.active);
  };
  const keyClick = (v: number) => {
    if (active === v && !eraseActive) {
      clearSelection();
      return;
    }
    if (selectedGiven) return;
    setEraseActive(false);
    setActive(toggleValue(active, v));
    if (settings.input === "cell" && selected !== null) move(selected, v);
    if (settings.input === "value") setSelected(null);
  };
  const erase = () => {
    if (settings.input === "value") {
      setEraseActive((v) => !v);
      setActive(null);
      setSelected(null);
      setChecked([]);
      return;
    }
    if (selected === null)
      return notify(
        `Choose a square whose ${notes ? "notes" : "number"} you want to erase.`,
      );
    if (selectedGiven)
      return notify("That square is part of the puzzle and cannot be changed.");
    setSession((s) => (s ? eraseCell(s, selected, notes) : s));
    setChecked([]);
  };
  useEffect(() => {
    if (screen !== "game" || sheet || confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("select,input,textarea")) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        keyClick(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        erase();
      } else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        setSession((s) => (s ? restore(s, e.shiftKey) : s));
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -9,
          ArrowDown: 9,
        }[e.key]!;
        const next = Math.max(0, Math.min(80, (selected ?? 0) + step));
        setSelected(next);
        if (settings.input === "cell") setActive(session?.values[next] || null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const checkAnswers = (cellOnly = false) => {
    if (!session) return;
    const errors = session.values.flatMap((v, i) =>
      v &&
      !session.puzzle.givens[i] &&
      v !== session.puzzle.solution[i] &&
      (!cellOnly || i === selected)
        ? [i]
        : [],
    );
    setChecked(errors);
    setSession((s) =>
      s ? { ...s, events: [...s.events, { kind: "check" }] } : s,
    );
    notify(
      errors.length
        ? `${errors.length} ${errors.length === 1 ? "entry needs" : "entries need"} another look.`
        : "All checked entries look good.",
    );
    setSheet(null);
  };
  const hint = () => {
    if (!session) return;
    const empty = session.values.flatMap((v, i) => (v ? [] : [i]));
    const forced = empty.find(
      (i) => candidates(session.values, session.puzzle.regions, i).length === 1,
    );
    setSession((s) =>
      s
        ? {
            ...s,
            events: [
              ...s.events,
              { kind: "hint", cell: forced ?? empty[0] ?? 0 },
            ],
          }
        : s,
    );
    if (forced !== undefined) {
      setSelected(forced);
      notify(
        `Look at row ${Math.floor(forced / 9) + 1}, column ${(forced % 9) + 1}. Only one candidate fits its row, column and region.`,
      );
    } else if (empty.length) {
      setSelected(empty[0]);
      notify(
        "Try comparing the missing values in this square’s row, column and region. Notes can help you narrow them down.",
      );
    }
    setSheet(null);
  };
  const share = async (s: Session) => {
    setBusy(true);
    try {
      let linked = s;
      if (!s.challenge) {
        const c = await createChallenge(s.puzzle.seed, s.puzzle.variant);
        const attempt = await startChallengeAttempt(
          c.id,
          s.puzzle.difficulty,
          playerName || undefined,
        );
        await submitChallengeResult(c.id, {
          attemptId: attempt.attemptId,
          token: attempt.token,
          actions: s.events,
          elapsedSeconds: Math.round(s.seconds),
        });
        linked = {
          ...s,
          challenge: {
            id: c.id,
            attemptId: attempt.attemptId,
            token: attempt.token,
          },
          submitted: true,
        };
        setHistory((h) => h.map((v) => (v.id === s.id ? linked : v)));
        setResult(linked);
        setSession((v) => (v?.id === s.id ? linked : v));
      }
      const url = new URL("/web.html", location.origin);
      url.searchParams.set("challenge", linked.challenge!.id);
      setShareUrl(url.toString());
      try {
        await navigator.clipboard.writeText(url.toString());
        notify(
          "Challenge link copied. Your result is included; your friend can choose their level.",
        );
      } catch {
        notify("Your challenge link is ready below.");
      }
    } catch {
      notify(
        "Could not create a challenge. Make sure the challenge service is running.",
      );
    } finally {
      setBusy(false);
    }
  };
  const sendResult = async (s: Session) => {
    if (!s.challenge) return;
    setBusy(true);
    try {
      await submitChallengeResult(s.challenge.id, {
        attemptId: s.challenge.attemptId,
        token: s.challenge.token,
        actions: s.events,
        elapsedSeconds: Math.round(s.seconds),
      });
      setHistory((h) =>
        h.map((v) => (v.id === s.id ? { ...v, submitted: true } : v)),
      );
      setResult({ ...s, submitted: true });
      setSession((v) => (v?.id === s.id ? { ...v, submitted: true } : v));
      notify("Your result is on the challenge board.");
    } catch {
      notify(
        "Could not submit yet. Your completed puzzle is saved; you can retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const friends = async () => {
    const id = session?.challenge?.id || challengeId;
    setSheet(null);
    setScreen("friends");
    if (id) {
      setBusy(true);
      try {
        setChallengeData(await getChallenge(id));
      } catch {
        notify("Could not load the latest results.");
      } finally {
        setBusy(false);
      }
    }
  };
  const roadmapRepo =
    roadmap?.repository || import.meta.env.VITE_GITHUB_REPO?.trim() || "";
  const visibleRoadmap = roadmapCards(roadmap);
  const feedback = async (kind: "suggestion" | "bug") => {
    setSheet(null);
    if (!roadmapRepo) {
      go("roadmap");
      notify(
        "Connect the GitHub repository after it is created to turn on submissions.",
      );
      return;
    }
    await openExternalUrl(
      `https://github.com/${roadmapRepo}/issues/new?template=${kind === "bug" ? "bug_report.yml" : "suggestion.yml"}`,
    );
  };
  const conflictSet = useMemo(
    () =>
      new Set(session ? conflicts(session.values, session.puzzle.regions) : []),
    [session?.values, session?.puzzle.regions],
  );
  const activeSession = screen === "results" ? result : session;
  const themeStyle = {
    "--value-scale": settings.size,
    "--note-scale": settings.noteSize,
    "--value-weight":
      settings.weight === "theme"
        ? "var(--theme-value-weight)"
        : settings.weight,
    "--value-font":
      settings.font === "theme"
        ? "var(--theme-value-font)"
        : settings.font === "serif"
          ? "Georgia, serif"
          : settings.font === "mono"
            ? "ui-monospace, monospace"
            : '"DM Sans", sans-serif',
  } as CSSProperties;
  const go = (next: Screen) => {
    setSheet(null);
    setScreen(next);
    setShareUrl("");
    if (marketingSite) {
      const url = new URL(location.href);
      if (
        next === "privacy" ||
        next === "terms" ||
        next === "how" ||
        next === "roadmap"
      )
        url.searchParams.set("page", next);
      else url.searchParams.delete("page");
      window.history.replaceState(null, "", url);
    }
  };
  const showHomeSection = (id: string) => {
    go("home");
    requestAnimationFrame(() =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const openHow = (from: Screen) => {
    setHowReturn(from);
    go("how");
  };
  useEffect(() => {
    if (preview) {
      const scroller = document.querySelector(".doku-preview .mobile-scroll");
      if (scroller) scroller.scrollTop = 0;
    } else window.scrollTo(0, 0);
  }, [screen, preview]);
  const Back = ({ to = "home" }: { to?: Screen }) => (
    <button className="back-link" onClick={() => go(to)}>
      <CaretLeft size={18} /> {to === "game" ? "Back to puzzle" : "Back"}
    </button>
  );
  const renderResult = (s: Session) => {
    const st = stats(s);
    return (
      <>
        <p className="eyebrow">YOUR KIND OF WIN</p>
        <h1 className="page-title">Beautifully solved.</h1>
        <p className="muted">
          {labels[s.puzzle.variant]} · {s.puzzle.difficulty} ·{" "}
          {new Date(s.completedAt || s.startedAt).toLocaleDateString(
            undefined,
            { month: "short", day: "numeric" },
          )}
        </p>
        <div className="result-grid">
          <div>
            <Timer />
            <strong>{formatTime(s.seconds)}</strong>
            <span>Active time</span>
          </div>
          <div>
            <CheckCircle />
            <strong>{st.accuracy === null ? "—" : `${st.accuracy}%`}</strong>
            <span>First-entry accuracy</span>
          </div>
          <div>
            <Lightbulb />
            <strong>{st.hints}</strong>
            <span>Hints used</span>
          </div>
          <div>
            <Eye />
            <strong>{st.checks}</strong>
            <span>Answer checks</span>
          </div>
        </div>
        <div className="achievement">
          <Trophy size={30} />
          <div>
            <strong>
              {!st.assisted
                ? "All you. No assistance."
                : st.accuracy === 100
                  ? "A precise finish."
                  : "Another puzzle, solved."}
            </strong>
            <p>
              {!st.assisted
                ? "Take your time. That accomplishment is yours."
                : "Every completed puzzle is worth celebrating."}
            </p>
          </div>
        </div>
        <details>
          <summary>What goes into your result?</summary>
          <p>
            Accuracy measures the first pen entry in each of {st.evaluated}{" "}
            evaluated squares. Revealed squares are excluded. Notes and erasures
            do not count as guesses.
          </p>
          <p>
            {st.autofills} note autofills · {st.reveals} reveals.{" "}
            {s.events.some((e) => e.kind === "autocheck" && e.enabled)
              ? "Automatic answer checking was used."
              : "Automatic answer checking was not used."}
          </p>
          <p>
            Time counts while the board is open and this tab is visible. Results
            are friendly, self-reported comparisons, not proof of independent
            play. Compare speed within the same level.
          </p>
        </details>
        {s.challenge && !s.submitted && (
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => sendResult(s)}
          >
            Add my result to the challenge <ArrowRight />
          </button>
        )}
        {s.submitted && <p className="success">Your result has been shared.</p>}
        <button
          className="primary wide"
          disabled={busy}
          onClick={() => share(s)}
        >
          <Users size={21} /> Challenge a friend
        </button>
        {shareUrl && (
          <a className="share-link" href={shareUrl}>
            {shareUrl}
          </a>
        )}
        <button
          className="secondary wide"
          onClick={() => {
            setChallengeId(null);
            setChallengeData(null);
            go("setup");
          }}
        >
          Play another puzzle
        </button>
      </>
    );
  };
  return (
    <div
      className={`doku ${preview ? "in-preview" : ""}`}
      data-theme={settings.theme}
      data-font={settings.font}
      style={themeStyle}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".board,.keypad")) return;
        setActive(null);
        if (!target.closest(".editing-controls")) {
          setSelected(null);
          setEraseActive(false);
        }
      }}
    >
      {screen !== "game" && (
        <header className="site-header">
          <button
            className={`brand-button ${marketingSite ? "artwork-button" : ""}`}
            aria-label="Home"
            onClick={() => go("home")}
          >
            {marketingSite ? <BrandArtwork /> : <Brand />}
          </button>
          <nav>
            {marketingSite && (
              <>
                <button
                  className="desktop-nav-link"
                  onClick={() => showHomeSection("discord")}
                >
                  Discord
                </button>
                <button onClick={() => go("roadmap")}>Roadmap</button>
              </>
            )}
            <button
              className={marketingSite ? "desktop-nav-link" : undefined}
              onClick={() => openHow(screen)}
            >
              How to play
            </button>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => setSheet("settings")}
            >
              <Gear size={23} />
            </button>
          </nav>
        </header>
      )}
      {storageError && (
        <div className="notice" role="alert">
          Browser storage is full or unavailable. This session may not survive a
          reload.
        </div>
      )}
      {discord && <div className="notice">{discord}</div>}
      {screen === "home" && (
        <main className="home-content">
          <section className="home-hero">
            <div>
              <p className="eyebrow">A LITTLE LOGIC. A LOT OF POSSIBILITY.</p>
              <h1>
                Your puzzle.
                <br />
                Your pace.
                <br />
                <em>Your kind of win.</em>
              </h1>
              <p>
                Numbers, colors, unexpected shapes. Settle into a puzzle that
                feels like you—and challenge a friend when you’re ready.
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setChallengeId(null);
                    setChallengeData(null);
                    go("setup");
                  }}
                >
                  Find your puzzle <ArrowRight size={21} />
                </button>
                {session && !session.completedAt && (
                  <button className="secondary" onClick={() => go("game")}>
                    <Play size={20} /> Resume puzzle
                  </button>
                )}
              </div>
              <p className="quiet">
                Unlimited puzzles. No lives. Room to think.
              </p>
            </div>
            <div className="hero-sample" aria-hidden="true">
              <span className="sample-caption">
                A different way to see sudoku
              </span>
              <div className="sample-grid">
                {[1, 0, 3, 0, 5, 0, 7, 0, 9].map((v, i) => (
                  <div key={i}>
                    {v ? (
                      <Symbol value={v} />
                    ) : (
                      <span className="sample-notes">
                        <Symbol value={2} small />
                        <Symbol value={4} small />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="sample-caption">
                Same satisfying logic. More possibilities.
              </span>
            </div>
          </section>
          <section className="home-links">
            <button onClick={() => go("history")}>
              <ClockCounterClockwise size={26} />
              <span>
                <strong>Your puzzle history</strong>
                <small>Revisit a win. Pass on a challenge.</small>
              </span>
              <ArrowRight />
            </button>
            <button onClick={() => openHow("home")}>
              <Lightbulb size={26} />
              <span>
                <strong>A little guidance</strong>
                <small>Learn the rules, notes, and controls.</small>
              </span>
              <ArrowRight />
            </button>
          </section>
          <section className="home-principles">
            <h2>More than a race against a clock.</h2>
            <p>
              Speed is one kind of accomplishment. Precision is another. So is
              figuring it out without a hint. Your results make room for all of
              them.
            </p>
            <div>
              <span>
                <CheckCircle /> Celebrate accuracy
              </span>
              <span>
                <EyeSlash /> Hide the timer
              </span>
              <span>
                <Heart /> Play without penalties
              </span>
            </div>
          </section>
          {marketingSite && (
            <>
              <section
                className="marketing-section theme-story"
                aria-labelledby="theme-story-title"
              >
                <div className="section-copy">
                  <p className="eyebrow">ONE GAME. VERY DIFFERENT MOODS.</p>
                  <h2 id="theme-story-title">
                    Make the whole puzzle feel like yours.
                  </h2>
                  <p>
                    Classic numbers, colorful symbols, or irregular regions—then
                    dress every square and control in a theme with an actual
                    point of view.
                  </p>
                </div>
                <div className="theme-gallery" aria-label="Five visual themes">
                  {(
                    ["retro", "comic", "doodle", "glass", "rounded"] as const
                  ).map((theme, themeIndex) => (
                    <article
                      key={theme}
                      className={`theme-peek theme-peek-${theme}`}
                    >
                      <span>
                        {theme === "rounded"
                          ? "Web 2.0"
                          : theme === "comic"
                            ? "Comic book"
                            : theme}
                      </span>
                      <div aria-hidden="true">
                        {[8, 0, 2, 0, 5, 0, 7, 0, 4].map((value, i) => (
                          <b
                            key={i}
                            className={i === themeIndex || i === 4 ? "lit" : ""}
                          >
                            {value || ""}
                          </b>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <section
                className="marketing-section play-story"
                aria-labelledby="play-story-title"
              >
                <div className="section-copy">
                  <p className="eyebrow">
                    PLAY THE WAY YOUR BRAIN REACHES FOR IT.
                  </p>
                  <h2 id="play-story-title">
                    Square first or number first. Both make sense.
                  </h2>
                  <p>
                    Choose one square and fill it, or arm a value and place it
                    everywhere it belongs. The game remembers your preference.
                  </p>
                  <button className="text-link" onClick={() => openHow("home")}>
                    See every way to play <ArrowRight size={16} />
                  </button>
                </div>
                <InputModeDemo />
              </section>
              <section
                className="marketing-section score-story"
                aria-labelledby="score-story-title"
              >
                <div
                  className="score-preview"
                  aria-label="Example friendly challenge card"
                >
                  <header>
                    <img src="/assets/brand/doku-icon.png" alt="" />
                    <span>
                      <strong>Friday’s jigsadoku</strong>
                      <small>3 friends solved this puzzle</small>
                    </span>
                  </header>
                  <div className="score-players">
                    <div>
                      <i>AL</i>
                      <span>
                        <strong>100%</strong>
                        <small>first-entry accuracy</small>
                      </span>
                      <em>8:42</em>
                    </div>
                    <div>
                      <i>JD</i>
                      <span>
                        <strong>No hints</strong>
                        <small>all their own</small>
                      </span>
                      <em>11:06</em>
                    </div>
                    <div>
                      <i>MK</i>
                      <span>
                        <strong>Hard</strong>
                        <small>difficulty</small>
                      </span>
                      <em>14:18</em>
                    </div>
                  </div>
                  <div className="score-mosaic" aria-hidden="true">
                    {Array.from({ length: 27 }, (_, i) => (
                      <span key={i} className={`tone-${(i * 7) % 5}`} />
                    ))}
                  </div>
                </div>
                <div className="section-copy">
                  <p className="eyebrow">FRIENDLY, NOT FLATTENED.</p>
                  <h2 id="score-story-title">
                    More ways to win than “fastest.”
                  </h2>
                  <p>
                    Challenge cards keep time, accuracy, difficulty, and
                    assistance visible as separate strengths. No mystery score
                    pretending every solve is the same.
                  </p>
                  <div className="metric-pills">
                    <span>Active time</span>
                    <span>First-entry accuracy</span>
                    <span>Hints & checks</span>
                    <span>Difficulty</span>
                  </div>
                </div>
              </section>
              <section
                id="discord"
                className="marketing-section discord-story"
                aria-labelledby="discord-story-title"
              >
                <img src="/assets/brand/doku-icon.png" alt="" />
                <div className="section-copy">
                  <p className="eyebrow">COMING TO A CHANNEL NEAR YOU.</p>
                  <h2 id="discord-story-title">
                    Open together. Share results on purpose.
                  </h2>
                  <p>
                    Launching the Activity can announce that the game is open.
                    Finished puzzles stay private until you choose{" "}
                    <strong>Challenge your friends</strong>, so a puzzle binge
                    never becomes channel spam.
                  </p>
                  <ol>
                    <li>
                      Add *doku to Discord and allow application commands.
                    </li>
                    <li>Open it from the App Launcher in a server channel.</li>
                    <li>
                      Share a completed puzzle when you actually want company.
                    </li>
                  </ol>
                  <div className="hero-actions">
                    <a
                      className="primary"
                      href={`https://discord.com/oauth2/authorize?client_id=${DISCORD_APP_ID}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Add to Discord <ArrowRight size={20} />
                    </a>
                    <button
                      className="secondary"
                      onClick={() => openHow("home")}
                    >
                      Setup & permissions
                    </button>
                  </div>
                  <p className="fine-print">
                    The basic Activity does not need permission to read your
                    message history. Rich, automatically updated group cards
                    will be an optional later feature for servers that install
                    the bot.
                  </p>
                </div>
              </section>
            </>
          )}
          <footer>
            {marketingSite ? <BrandArtwork footer /> : <Brand />}
            <button onClick={() => openHow("home")}>
              How to play & Discord setup
            </button>
            {marketingSite && (
              <>
                <button onClick={() => go("roadmap")}>
                  Roadmap & feedback
                </button>
                <button onClick={() => go("privacy")}>Privacy</button>
                <button onClick={() => go("terms")}>Terms</button>
              </>
            )}
            <span>Made for the love of puzzles.</span>
          </footer>
        </main>
      )}
      {screen === "setup" && (
        <main className="page setup-page">
          <Back />
          <p className="eyebrow">
            {challengeId
              ? "A FRIEND LEFT YOU A PUZZLE"
              : "MAKE A LITTLE SPACE FOR PLAY"}
          </p>
          <h1 className="page-title">
            {challengeId ? "Same puzzle. Your pace." : "What feels good today?"}
          </h1>
          <p className="muted">
            {challengeId
              ? "Choose your own level. It will appear beside your result."
              : "Choose a puzzle and a level before you begin."}
          </p>
          <div className="type-options" role="group" aria-label="Puzzle type">
            {types.map(([v, title, desc, Icon]) => (
              <button
                key={v}
                disabled={!!challengeId}
                aria-pressed={variant === v}
                className={`type-option ${variant === v ? "chosen" : ""}`}
                onClick={() => setVariant(v)}
              >
                <Icon size={30} />
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                {variant === v && <Check size={22} />}
              </button>
            ))}
          </div>
          {challengeId && (
            <label className="setting-stack">
              Your name
              {preview ? (
                <KeyboardInput
                  aria-label="Your name"
                  value={playerName}
                  maxLength={40}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              ) : (
                <input
                  aria-label="Your name"
                  value={playerName}
                  maxLength={40}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              )}
            </label>
          )}
          <h2 className="section-label">Your level</h2>
          <div className="level-options">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                className={difficulty === d ? "chosen" : ""}
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="fine-print">
            Levels currently vary clue density; logical difficulty ratings are
            still being calibrated. Every puzzle has one solution.
          </p>
          <button
            className="primary wide"
            disabled={busy || (!!challengeId && !challengeData)}
            onClick={() =>
              session && !session.completedAt ? setConfirm("new") : start()
            }
          >
            {busy ? "Preparing your puzzle…" : "Let’s play"}{" "}
            <ArrowRight size={22} />
          </button>
          <p className="quiet">
            You can change your theme anytime. Changing level starts a new game.
          </p>
        </main>
      )}
      {screen === "game" && session && (
        <main className="game-page" data-variant={session.puzzle.variant}>
          <header className="game-header">
            <button
              className="game-menu-link"
              onClick={() => {
                clearSelection();
                go("home");
              }}
            >
              <CaretLeft size={16} /> Back to menu
            </button>
            <div className="game-heading">
              <h1>
                <Brand variant={session.puzzle.variant} />
              </h1>
            </div>
            <div className="game-meta">
              <div className="game-context">
                <span>
                  {session.puzzle.variant === "jigsaw"
                    ? "Jigsaw"
                    : session.puzzle.variant === "hue"
                      ? "Colors"
                      : "Classic"}{" "}
                  ·{" "}
                  <span className="capitalize">
                    {session.puzzle.difficulty}
                  </span>
                </span>
                <button
                  className="timer"
                  aria-label={timerShown ? "Hide timer" : "Show timer"}
                  onClick={() => setTimerShown((v) => !v)}
                >
                  <Timer size={16} />
                  {timerShown ? (
                    <span>{formatTime(session.seconds)}</span>
                  ) : (
                    <span className="sr-only">Show time</span>
                  )}
                </button>
              </div>
              <div className="game-header-actions">
                <button
                  className="icon-button"
                  aria-label="Settings"
                  onClick={() => setSheet("settings")}
                >
                  <Gear size={26} weight="bold" />
                </button>
                <button
                  className="icon-button"
                  aria-label="More options"
                  onClick={() => setSheet("more")}
                >
                  <DotsThree size={30} weight="bold" />
                </button>
              </div>
            </div>
          </header>
          <div className="play-layout">
            <div className="board-wrap">
              <div
                className="board"
                data-variant={session.puzzle.variant}
                role="group"
                aria-label={`${labels[session.puzzle.variant]} board`}
              >
                {session.values.map((value, i) => {
                  const r = Math.floor(i / 9),
                    c = i % 9,
                    reg = session.puzzle.regions[i],
                    given = !!session.puzzle.givens[i];
                  const isConflict = settings.conflicts && conflictSet.has(i);
                  const error =
                    checked.includes(i) ||
                    isConflict ||
                    (settings.autocheck &&
                      value !== 0 &&
                      value !== session.puzzle.solution[i]);
                  const matching =
                    settings.matches && active !== null && value === active;
                  const borders = {
                    borderRightWidth:
                      c === 8
                        ? 0
                        : reg !== session.puzzle.regions[i + 1]
                          ? 2
                          : 1,
                    borderBottomWidth:
                      r === 8
                        ? 0
                        : reg !== session.puzzle.regions[i + 9]
                          ? 2
                          : 1,
                    borderRightColor:
                      c < 8 && reg !== session.puzzle.regions[i + 1]
                        ? "var(--region-line)"
                        : "var(--grid-line)",
                    borderBottomColor:
                      r < 8 && reg !== session.puzzle.regions[i + 9]
                        ? "var(--region-line)"
                        : "var(--grid-line)",
                  };
                  return (
                    <button
                      key={i}
                      data-cell={i}
                      data-region={reg}
                      className={`cell ${given ? "given" : "entry"} ${matching ? "matching" : ""} ${selected === i ? "selected" : ""} ${error ? "error" : ""} ${celebrate.includes(i) ? "celebrating" : ""} region-${reg % 2} ${value && session.puzzle.variant === "hue" ? "hue-filled" : ""}`}
                      style={
                        {
                          ...borders,
                          "--hue-color": value ? colors[value - 1] : undefined,
                        } as CSSProperties
                      }
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${value ? (session.puzzle.variant === "hue" ? colorNames[value - 1] : value) : "empty"}${given ? ", given and locked" : ""}${error ? ", needs review" : ""}${!value && session.notes[i].length ? ", notes " + session.notes[i].join(", ") : ""}`}
                      aria-pressed={selected === i}
                      onClick={() => cellClick(i)}
                    >
                      {value ? (
                        <>
                          {session.puzzle.variant === "hue" ? (
                            <Symbol value={value} pattern />
                          ) : (
                            <span className="cell-value">{value}</span>
                          )}
                          {given && (
                            <Lock
                              className="cell-lock"
                              size={10}
                              weight="fill"
                              aria-hidden="true"
                            />
                          )}
                        </>
                      ) : (
                        !hideNotes && (
                          <span className="notes-grid" aria-hidden="true">
                            {Array.from({ length: 9 }, (_, n) => {
                              const hasNote = session.notes[i].includes(n + 1);
                              return (
                                <span
                                  key={n}
                                  className={
                                    hasNote &&
                                    settings.matches &&
                                    active === n + 1
                                      ? "note-match"
                                      : ""
                                  }
                                >
                                  {hasNote ? (
                                    session.puzzle.variant === "hue" ? (
                                      <Symbol value={n + 1} small />
                                    ) : (
                                      n + 1
                                    )
                                  ) : (
                                    ""
                                  )}
                                </span>
                              );
                            })}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
              {session.completedAt && (
                <div className="solved-banner">
                  <CheckCircle size={21} /> Beautifully solved.
                </div>
              )}
            </div>
            <div className="game-controls">
              <div className="editing-controls">
                <button
                  className="labeled-icon"
                  disabled={!session.past.length || !!session.completedAt}
                  onClick={() => {
                    setSession((s) => (s ? restore(s) : s));
                    setChecked([]);
                  }}
                >
                  <span>
                    <ArrowCounterClockwise size={29} />
                  </span>
                  <small>Undo</small>
                </button>
                <div className="pen-toggle">
                  <button
                    aria-pressed={!notes}
                    className={!notes ? "chosen" : ""}
                    onClick={() => setNotes(false)}
                  >
                    Pen
                  </button>
                  <button
                    aria-pressed={notes}
                    className={notes ? "chosen" : ""}
                    onClick={() => setNotes(true)}
                  >
                    Notes
                  </button>
                </div>
                <button
                  data-erase-control
                  className={`labeled-icon erase-control ${eraseActive ? "active" : ""}`}
                  aria-pressed={eraseActive}
                  disabled={
                    !!session.completedAt ||
                    (settings.input === "cell" && selectedGiven)
                  }
                  onClick={erase}
                >
                  <span>
                    <Eraser size={29} />
                  </span>
                  <small>Erase</small>
                </button>
              </div>
              <div
                className={`keypad ${selectedGiven ? "locked" : ""}`}
                role="group"
                aria-label="Value keypad"
              >
                {Array.from({ length: 9 }, (_, i) => {
                  const v = i + 1;
                  const done =
                    Array.from(
                      { length: 9 },
                      (_, region) =>
                        session.values.filter(
                          (value, index) =>
                            session.puzzle.regions[index] === region &&
                            value === v,
                        ).length === 1,
                    ).every(Boolean) &&
                    ![...conflictSet].some(
                      (index) => session.values[index] === v,
                    );
                  return (
                    <button
                      key={v}
                      disabled={
                        !!session.completedAt || (selectedGiven && active !== v)
                      }
                      aria-label={`Select ${session.puzzle.variant === "hue" ? colorNames[i] : v}${done ? ", complete" : ""}`}
                      aria-pressed={active === v}
                      className={`${active === v ? "active" : ""} ${done ? "complete" : ""}`}
                      onClick={() => keyClick(v)}
                    >
                      {session.puzzle.variant === "hue" ? (
                        <Symbol value={v} />
                      ) : (
                        <span className="key-value">{v}</span>
                      )}
                      {done && <Check className="key-complete" size={13} />}
                    </button>
                  );
                })}
              </div>
              <div className="input-mode-row">
                <label className="input-order">
                  <select
                    aria-label="Input order"
                    value={settings.input}
                    onChange={(e) => {
                      setPreference(
                        "input",
                        e.target.value as Settings["input"],
                      );
                      clearSelection();
                    }}
                  >
                    <option value="cell">Cell first</option>
                    <option value="value">Value first</option>
                  </select>
                  <CaretDown size={18} />
                </label>
                <p
                  className={`input-helper ${selectedGiven ? "locked-helper" : ""}`}
                >
                  <span>
                    {selectedGiven ? (
                      <>
                        <Lock size={15} weight="fill" /> This is a given square.
                        Choose another square to make changes.
                      </>
                    ) : eraseActive ? (
                      `Erase is active. Tap a square to clear its ${notes ? "notes" : "number"}.`
                    ) : settings.input === "cell" ? (
                      "Choose a square, then a " +
                      (session.puzzle.variant === "hue" ? "color." : "number.")
                    ) : (
                      "Choose a " +
                      (session.puzzle.variant === "hue" ? "color" : "number") +
                      ", then tap squares."
                    )}
                  </span>
                  <button
                    className="input-help-link"
                    onClick={() => openHow("game")}
                  >
                    See how it works <ArrowRight size={14} />
                  </button>
                </p>
              </div>
              {hideNotes && (
                <button
                  className="text-button"
                  onClick={() => setHideNotes(false)}
                >
                  Notes hidden · Show notes
                </button>
              )}
              {session.completedAt && (
                <button
                  className="primary wide"
                  onClick={() => {
                    setResult(session);
                    go("results");
                  }}
                >
                  See your results <ArrowRight />
                </button>
              )}
            </div>
          </div>
        </main>
      )}
      {screen === "history" && (
        <main className="page">
          <Back />
          <p className="eyebrow">YOUR COLLECTION OF LITTLE WINS</p>
          <h1 className="page-title">Puzzle history</h1>
          {!history.length ? (
            <div className="empty-state">
              <ClockCounterClockwise size={48} />
              <h2>Your first win belongs here.</h2>
              <p>
                Completed puzzles will be saved here, along with their results
                and a way to challenge a friend.
              </p>
              <button className="primary" onClick={() => go("setup")}>
                Find a puzzle <ArrowRight />
              </button>
            </div>
          ) : (
            <div className="history-list">
              {history.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setResult(s);
                    go("results");
                  }}
                >
                  <span className="history-icon">
                    {s.puzzle.variant === "hue" ? (
                      <Palette />
                    ) : s.puzzle.variant === "jigsaw" ? (
                      <PuzzlePiece />
                    ) : (
                      <Hash />
                    )}
                  </span>
                  <span>
                    <strong>
                      {labels[s.puzzle.variant]}{" "}
                      <small className="capitalize">
                        · {s.puzzle.difficulty}
                      </small>
                    </strong>
                    <small>
                      {new Date(s.completedAt!).toLocaleDateString()} ·{" "}
                      {formatTime(s.seconds)} · {stats(s).accuracy ?? "—"}%
                      accuracy
                    </small>
                  </span>
                  <CaretDown className="rotate" />
                </button>
              ))}
            </div>
          )}
        </main>
      )}
      {screen === "results" && activeSession && (
        <main className="page results-page">
          <Back to="history" />
          {renderResult(activeSession)}
        </main>
      )}
      {screen === "friends" && (
        <main className="page">
          <Back to={session ? "game" : "home"} />
          <p className="eyebrow">DIFFERENT STRENGTHS. SHARED PUZZLES.</p>
          <h1 className="page-title">Friends’ results</h1>
          <p className="muted">
            Speed, precision, and independence each deserve their moment.
            Compare times at the same level.
          </p>
          {busy ? (
            <p>Loading results…</p>
          ) : !challengeData?.results.length ? (
            <div className="empty-state">
              <Users size={45} />
              <h2>No results here yet.</h2>
              <p>
                {challengeData
                  ? "Complete your puzzle to add your result."
                  : "Open a friend’s challenge link, or share a completed puzzle from your history."}
              </p>
              <button className="secondary" onClick={() => go("history")}>
                Open history
              </button>
            </div>
          ) : (
            <div className="friend-list">
              {challengeData.results.map((r, i) => (
                <article key={r.id || i}>
                  <h2>
                    {r.name || "A fellow puzzler"}{" "}
                    <small className="capitalize">{r.difficulty}</small>
                  </h2>
                  <div className="friend-metrics">
                    <span>
                      {formatTime(r.elapsedSeconds || 0)}
                      <small>active time</small>
                    </span>
                    <span>
                      {r.accuracy ?? "—"}%<small>accuracy</small>
                    </span>
                    <span>
                      {r.hints ?? 0}
                      <small>hints</small>
                    </span>
                  </div>
                  <p className="fine-print">
                    {r.assisted ? "Solved with assistance" : "Unassisted solve"}{" "}
                    · self-reported
                  </p>
                </article>
              ))}
            </div>
          )}
        </main>
      )}
      {screen === "roadmap" && (
        <main className="page roadmap-page">
          <Back />
          <p className="eyebrow">BUILT IN PUBLIC</p>
          <h1 className="page-title">What *doku is becoming.</h1>
          <p className="roadmap-lede">
            Play now without an account. Your current puzzle, preferences, and
            history stay saved in this browser. Optional Discord sign-in will
            add cross-device sync later; it will not become a ticket to play.
          </p>
          <div className="roadmap-actions" aria-label="Share feedback">
            <button className="primary" onClick={() => feedback("suggestion")}>
              <ChatCircleDots size={20} /> Suggest an idea
            </button>
            <button className="secondary" onClick={() => feedback("bug")}>
              <Bug size={20} /> Report a bug
            </button>
          </div>
          {!roadmap?.configured && !roadmapLoading && (
            <div className="roadmap-note">
              <GithubLogo size={24} />
              <div>
                <strong>Showing the launch plan for now.</strong>
                <p>
                  Add the repository name in Vercel after GitHub is created and
                  this page will replace these cards with live roadmap issues.
                </p>
              </div>
            </div>
          )}
          {roadmapLoading && (
            <p className="roadmap-sync" role="status">
              Checking GitHub for the latest roadmap…
            </p>
          )}
          {roadmapProblem && (
            <p className="roadmap-sync" role="status">
              GitHub is taking a breather. The launch plan is shown instead.
            </p>
          )}
          {roadmap?.configured && !roadmapLoading && !visibleRoadmap.length ? (
            <div className="empty-state roadmap-empty">
              <RoadHorizon size={48} />
              <h2>The next stretch is being mapped.</h2>
              <p>
                Roadmap issues will appear here as soon as they carry the
                <strong> roadmap</strong> label in GitHub.
              </p>
            </div>
          ) : (
            <div className="roadmap-columns">
              {roadmapLanes.map((lane) => (
                <section key={lane.id} className={`roadmap-lane ${lane.id}`}>
                  <header>
                    {lane.id === "shipped" ? (
                      <RocketLaunch size={20} />
                    ) : (
                      <RoadHorizon size={20} />
                    )}
                    <div>
                      <h2>{lane.label}</h2>
                      <p>{lane.description}</p>
                    </div>
                    <span>
                      {
                        visibleRoadmap.filter((card) => card.status === lane.id)
                          .length
                      }
                    </span>
                  </header>
                  <div>
                    {visibleRoadmap
                      .filter((card) => card.status === lane.id)
                      .map((card) => (
                        <article key={card.id} className="roadmap-card">
                          <h3>{card.title}</h3>
                          <p>{card.body}</p>
                          <footer>
                            {card.updatedAt && (
                              <small>
                                Updated{" "}
                                {new Date(card.updatedAt).toLocaleDateString()}
                              </small>
                            )}
                            {card.url && (
                              <button
                                onClick={() => openExternalUrl(card.url!)}
                              >
                                View #{card.number} <ArrowRight size={14} />
                              </button>
                            )}
                          </footer>
                        </article>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          <p className="fine-print roadmap-fine-print">
            Suggestions are public GitHub issues so people can search, discuss,
            and avoid duplicates. A GitHub account is needed to submit one; it
            is never needed to play or keep browser-local progress.
          </p>
        </main>
      )}
      {screen === "how" && (
        <main className="page instructions">
          <Back to={howReturn} />
          <p className="eyebrow">A LITTLE GUIDANCE</p>
          <h1 className="page-title">Make yourself at home.</h1>
          <h2>One of each. Everywhere.</h2>
          <p>
            Fill every row, column, and outlined region with each of the nine
            values exactly once. In sudoku, those values are numbers. In
            huedoku, they’re colors and shapes. Jigsadoku changes the shape of
            the regions.
          </p>
          <h2>Two ways to put things in place.</h2>
          <p>
            <strong>Cell first:</strong> select a square, then a keypad value.{" "}
            <strong>Value first:</strong> choose a keypad value, then tap as
            many squares as you need. Tap the active value again—or tap away—to
            clear it.
          </p>
          <InputModeDemo />
          <h2>Leave yourself a little note.</h2>
          <p>
            Switch to Notes to add or remove candidates. Their positions match
            the keypad. In huedoku, each note is a single colored shape. More
            has Autofill Notes and Hide Notes; hiding notes keeps them saved.
          </p>
          <h2>Help is here when you want it.</h2>
          <p>
            More includes hints and manual answer checks. Turn on{" "}
            <strong>Auto-check entries</strong> in Settings to mark an incorrect
            pen entry immediately. There are no lives to lose, and your result
            remembers assistance used even if you turn it off later.
          </p>
          <h2>Your time is your business.</h2>
          <p>
            Tap the timer to hide or show it. Choose its default in Settings.
            Time counts only while you’re on the visible game screen. Hiding the
            timer changes its display, not its measurement.
          </p>
          <h2>Pass a good puzzle along.</h2>
          <p>
            Open a completed puzzle from History and choose Challenge a friend.
            They get the same puzzle family and can pick their own level.
            Results show difficulty, first-entry accuracy, hints, and active
            solve time.
          </p>
          <h2>Keyboard shortcuts</h2>
          <p>
            Use 1–9 for values, arrow keys to select a square, N for notes,
            Delete to erase, and Command/Ctrl + Z to undo. Add Shift to redo.
          </p>
          <h2>Playing in Discord</h2>
          <p>
            Add *doku with the <strong>applications.commands</strong> scope,
            then open it from Discord’s App Launcher in a server channel. The
            default Activity launch can post its own “playing” message. Basic
            play and user-approved sharing do not need access to read channel
            history.
          </p>
          <p>
            For a later live group card, a server admin would install the
            optional bot with only View Channel, Send Messages, Embed Links, and
            Attach Files where the card should live. Read Message History is not
            needed if *doku keeps the message ID it created.
          </p>
          {marketingSite && (
            <p>
              <a
                href="https://docs.discord.com/developers/activities/building-an-activity"
                target="_blank"
                rel="noreferrer"
              >
                Discord’s Activity setup guide
              </a>{" "}
              ·{" "}
              <a
                href="https://docs.discord.com/developers/platform/oauth2-and-permissions"
                target="_blank"
                rel="noreferrer"
              >
                OAuth and permissions reference
              </a>
            </p>
          )}
          <h2>Your progress</h2>
          <p>
            Solo progress, preferences, history, and unfinished games are saved
            in this browser. Back to menu is always safe; choose Resume puzzle
            when you return. Clearing browser data removes local progress.
            Optional Discord sign-in and cross-device history are planned, but
            not enabled yet.
          </p>
          <button
            className="primary"
            onClick={() =>
              session && !session.completedAt ? go("game") : go("setup")
            }
          >
            {session && !session.completedAt ? "Back to puzzle" : "Let’s play"}{" "}
            <ArrowRight />
          </button>
        </main>
      )}
      {screen === "privacy" && (
        <main className="page instructions legal-page">
          <Back />
          <p className="eyebrow">PRIVACY · EFFECTIVE SEPTEMBER 11, 2026</p>
          <h1 className="page-title">Your puzzles are not ad inventory.</h1>
          <p>
            This is a plain-language launch policy for *doku. It will be updated
            before any material change to the data the game collects or how that
            data is used.
          </p>
          <h2>What stays on your device</h2>
          <p>
            Without an account, your unfinished puzzle, preferences, display
            name, and local history are stored in your browser. Clearing site
            data removes that local information.
          </p>
          <h2>What reaches the service</h2>
          <p>
            When you create or join a challenge, the service stores the puzzle
            identifier, chosen difficulty, display name, submitted play events,
            completion time, and the result metrics calculated from those
            events. Notes are not submitted. Friendly results are labeled
            self-reported.
          </p>
          <h2>Discord information</h2>
          <p>
            Inside Discord, *doku requests basic identity so it can show your
            Discord name and, when account sync is added, connect your own
            history across places. The current build does not read channel
            message history, contacts, or private messages.
          </p>
          <h2>Public feedback</h2>
          <p>
            Suggest an idea and Report a bug open GitHub Issue Forms. Anything
            submitted there is public and handled under GitHub’s account and
            privacy terms. Playing *doku never requires a GitHub account.
          </p>
          <h2>How information is used</h2>
          <p>
            Information is used to run puzzles, resume play, compare invited
            challenge results, prevent abuse, and diagnose service problems.
            *doku does not sell personal information or use puzzle history for
            targeted advertising.
          </p>
          <h2>Sharing and visibility</h2>
          <p>
            A result is shared only when you choose to submit or challenge
            friends. People with a challenge link can see the display names and
            result metrics attached to that challenge. Do not use a display name
            you do not want others to see.
          </p>
          <h2>Retention and deletion</h2>
          <p>
            Local data remains until you clear it. Hosted challenge data is
            retained while the challenge service operates so links and
            comparisons continue to work. A deletion-request process and final
            retention schedule must be published before broad public launch.
          </p>
          <h2>Contact and changes</h2>
          <p>
            Privacy requests can be sent through the support contact on *doku’s
            official Discord application listing. Material policy changes will
            be dated on this page.
          </p>
        </main>
      )}
      {screen === "terms" && (
        <main className="page instructions legal-page">
          <Back />
          <p className="eyebrow">TERMS · EFFECTIVE SEPTEMBER 11, 2026</p>
          <h1 className="page-title">Play nice. Puzzle freely.</h1>
          <p>
            These launch terms govern use of *doku on the web and as a Discord
            Activity. By playing, you agree to use the service lawfully and
            without interfering with anyone else’s play.
          </p>
          <h2>The game</h2>
          <p>
            *doku provides unlimited logic puzzles, optional assistance, local
            history, and friendly challenge comparisons. Features may change as
            the game is tested and improved.
          </p>
          <h2>Friendly results, not certified competition</h2>
          <p>
            Times and play histories originate from the client. The service
            validates completed grids and calculates submitted metrics, but
            results are not anti-cheat verified and must not be used for
            gambling, prizes, rankings with material consequences, or claims of
            independent achievement.
          </p>
          <h2>Your responsibilities</h2>
          <p>
            Do not attack the service, automate abusive traffic, impersonate
            another person, post unlawful or harassing names or content, or
            attempt to expose private challenge credentials. Discord use is also
            subject to Discord’s own terms and community rules.
          </p>
          <p>
            Roadmap discussions, suggestions, and bug reports submitted on
            GitHub are public and are also subject to GitHub’s terms.
          </p>
          <h2>Availability</h2>
          <p>
            The service is provided as available during its early release.
            Puzzles or history may occasionally be unavailable, and locally
            stored data can be lost when browser storage is cleared. Keep
            anything important somewhere else.
          </p>
          <h2>Intellectual property</h2>
          <p>
            The *doku name, artwork, interface, and original game presentation
            belong to their respective owner. You may share the challenge links
            and result graphics that the product provides for personal,
            noncommercial play.
          </p>
          <h2>Enforcement and changes</h2>
          <p>
            Access may be limited for abuse, security threats, or legal
            requirements. Material changes to these terms will be dated here.
            Questions can be sent through the support contact on the official
            Discord application listing.
          </p>
        </main>
      )}
      <Modal
        preview={preview}
        open={sheet === "settings"}
        title="Make it yours"
        onClose={() => setSheet(null)}
      >
        <h3>Appearance</h3>
        <div className="theme-options">
          {themeOptions.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch theme-${t.id} ${settings.theme === t.id ? "chosen" : ""}`}
              aria-pressed={settings.theme === t.id}
              onClick={() => setPreference("theme", t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <h3>Your name</h3>
        <label className="setting-stack">
          Challenge name
          {preview ? (
            <KeyboardInput
              aria-label="Challenge name"
              value={playerName}
              maxLength={40}
              placeholder="A fellow puzzler"
              onChange={(e) => setPlayerName(e.target.value)}
            />
          ) : (
            <input
              aria-label="Challenge name"
              value={playerName}
              maxLength={40}
              placeholder="A fellow puzzler"
              onChange={(e) => setPlayerName(e.target.value)}
            />
          )}
        </label>
        <label className="setting-stack">
          Number size{" "}
          <input
            aria-label="Number size"
            type="range"
            min="0.85"
            max="1.2"
            step="0.05"
            value={settings.size}
            onChange={(e) => setPreference("size", Number(e.target.value))}
          />
        </label>
        <label className="setting-stack">
          Note size{" "}
          <input
            aria-label="Note size"
            type="range"
            min="1"
            max="1.35"
            step="0.05"
            value={settings.noteSize}
            onChange={(e) => setPreference("noteSize", Number(e.target.value))}
          />
        </label>
        <label className="setting-row">
          Number font
          <select
            aria-label="Number font"
            value={settings.font}
            onChange={(e) =>
              setPreference("font", e.target.value as Settings["font"])
            }
          >
            <option value="theme">Theme default</option>
            <option value="sans">Clean</option>
            <option value="serif">Bookish</option>
            <option value="mono">Monospace</option>
          </select>
        </label>
        <label className="setting-row">
          Number weight
          <select
            aria-label="Number weight"
            value={settings.weight}
            onChange={(e) =>
              setPreference(
                "weight",
                e.target.value === "theme" ? "theme" : Number(e.target.value),
              )
            }
          >
            <option value="theme">Theme default</option>
            <option value={400}>Regular</option>
            <option value={500}>Medium</option>
            <option value={700}>Bold</option>
          </select>
        </label>
        <h3>Gameplay</h3>
        <Toggle
          label="Show timer by default"
          description="For new games. Tap the current timer anytime."
          value={settings.timer}
          onChange={(v) => setPreference("timer", v)}
        />
        <Toggle
          label="Highlight matching values"
          value={settings.matches}
          onChange={(v) => setPreference("matches", v)}
        />
        <Toggle
          label="Show conflicts"
          description="Highlight duplicates in rows, columns, or regions."
          value={settings.conflicts}
          onChange={(v) => setPreference("conflicts", v)}
        />
        <Toggle
          label="Auto-check entries"
          description="Show an incorrect pen entry immediately. Counts as assistance."
          value={settings.autocheck}
          onChange={(v) => setPreference("autocheck", v)}
        />
        <Toggle
          label="Automatically remove notes"
          description="Clear matching candidates from related squares."
          value={settings.removeNotes}
          onChange={(v) => setPreference("removeNotes", v)}
        />
        <Toggle
          label="Little celebrations"
          description="Highlight completed rows, columns, and regions."
          value={settings.celebrations}
          onChange={(v) => setPreference("celebrations", v)}
        />
      </Modal>
      <Modal
        preview={preview}
        open={sheet === "more"}
        title="A little help, if you need it"
        onClose={() => setSheet(null)}
      >
        <div className="menu-list">
          <button
            onClick={() => {
              setSession((s) => (s ? restore(s, true) : s));
              setSheet(null);
            }}
            disabled={!session?.future.length}
          >
            <ArrowClockwise /> Redo
          </button>
          <button
            disabled={!!session?.completedAt}
            onClick={() => {
              setSession((s) => (s ? autofill(s) : s));
              setHideNotes(false);
              setSheet(null);
              notify("Candidate notes filled. You can undo this.");
            }}
          >
            <Hash /> Autofill notes
          </button>
          <button
            onClick={() => {
              setHideNotes((v) => !v);
              setSheet(null);
            }}
          >
            {hideNotes ? <Eye /> : <EyeSlash />}
            {hideNotes ? "Show notes" : "Hide notes"}
          </button>
          <button disabled={!!session?.completedAt} onClick={hint}>
            <Lightbulb /> Get a hint
          </button>
          <button
            disabled={selected === null || !!session?.completedAt}
            onClick={() => checkAnswers(true)}
          >
            <CheckCircle /> Check this square
          </button>
          <button
            disabled={!!session?.completedAt}
            onClick={() => checkAnswers()}
          >
            <Check /> Check puzzle
          </button>
          <button
            disabled={selected === null || !!session?.completedAt}
            onClick={() => {
              setSheet(null);
              setConfirm("reveal");
            }}
          >
            <Eye /> Reveal this square
          </button>
          <hr />
          <button onClick={friends}>
            <Users /> Friends’ results
          </button>
          <button onClick={() => go("history")}>
            <ClockCounterClockwise /> Puzzle history
          </button>
          <button onClick={() => openHow("game")}>
            <Lightbulb /> How to play
          </button>
          <button onClick={() => go("roadmap")}>
            <RoadHorizon /> Roadmap & updates
          </button>
          <button onClick={() => feedback("suggestion")}>
            <ChatCircleDots /> Suggest an idea
          </button>
          <button onClick={() => feedback("bug")}>
            <Bug /> Report a bug
          </button>
          <button
            onClick={() => {
              setSheet(null);
              setConfirm("restart");
            }}
          >
            <ArrowCounterClockwise /> Change level / restart
          </button>
          <button onClick={() => go("home")}>
            <House /> Home · progress saved
          </button>
        </div>
      </Modal>
      <Modal
        preview={preview}
        open={confirm !== null}
        title={
          confirm === "reveal"
            ? "Reveal this square?"
            : confirm === "new"
              ? "Start a new puzzle?"
              : "Change level or restart?"
        }
        onClose={() => setConfirm(null)}
      >
        <p>
          {confirm === "reveal"
            ? "This will enter the answer and record a reveal on your result."
            : confirm === "new"
              ? "This replaces your unfinished puzzle. Completed puzzles stay in History."
              : "Your current entries and notes will be reset when you start again. The same puzzle family will be used."}
        </p>
        <div className="dialog-actions">
          <button className="secondary" onClick={() => setConfirm(null)}>
            Keep playing
          </button>
          <button
            className="primary"
            onClick={() => {
              if (confirm === "reveal") {
                if (selected !== null)
                  setSession((s) => (s ? reveal(s, selected) : s));
                setConfirm(null);
              } else if (confirm === "new") start();
              else {
                if (session) {
                  setVariant(session.puzzle.variant);
                  setChallengeData({
                    id: session.challenge?.id || "",
                    seed: session.puzzle.seed,
                    variant: session.puzzle.variant,
                    results: [],
                  } as any);
                }
                setConfirm(null);
                setScreen("setup");
              }
            }}
          >
            {confirm === "reveal"
              ? "Reveal answer"
              : confirm === "new"
                ? "Start new puzzle"
                : "Choose level"}
          </button>
        </div>
      </Modal>
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
