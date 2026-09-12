import type { Puzzle, Variant, Difficulty } from "./engine";
export type ChallengeAction =
  | { kind: "set"; cell: number; value: number }
  | { kind: "hint" | "reveal"; cell: number }
  | { kind: "check" | "autofill" }
  | { kind: "autocheck" | "conflicts"; enabled: boolean };
export type ChallengeResult = {
  id: string;
  name: string;
  difficulty: Difficulty;
  elapsedSeconds: number;
  accuracy: number | null;
  hints: number;
  checks: number;
  autocheck: boolean;
  autofills: number;
  reveals: number;
  conflicts: boolean;
  assisted: boolean;
  verification: "self-reported";
  completedAt: string;
};
export type Challenge = {
  id: string;
  seed: string;
  variant: Variant;
  results: ChallengeResult[];
};
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Challenge service unavailable" }));
  if (!response.ok)
    throw new Error(data.error || "Challenge service unavailable");
  return data as T;
}
export const createChallenge = (seed: string, variant: Variant) =>
  request<Challenge>("/challenges", { seed, variant });
export const getChallenge = (id: string) =>
  request<Challenge>(`/challenges/${encodeURIComponent(id)}`);
export const startChallengeAttempt = (
  id: string,
  difficulty: Difficulty,
  name?: string,
) =>
  request<{
    attemptId: string;
    token: string;
    puzzle: Omit<Puzzle, "solution">;
  }>(`/challenges/${encodeURIComponent(id)}/attempts`, { difficulty, name });
export const submitChallengeResult = (
  id: string,
  data: {
    attemptId: string;
    token: string;
    actions: ChallengeAction[];
    elapsedSeconds: number;
  },
) =>
  request<ChallengeResult>(
    `/challenges/${encodeURIComponent(id)}/results`,
    data,
  );
export type RoadmapIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  state: "open" | "closed";
  labels: string[];
  updatedAt: string;
};
export type RoadmapFeed = {
  configured: boolean;
  repository?: string;
  repositoryUrl?: string;
  issues: RoadmapIssue[];
};
export const getRoadmap = () => request<RoadmapFeed>("/roadmap");
export type DiscordStatus = {
  status: "browser" | "unavailable" | "connected";
  message: string;
  username?: string;
  challengeId?: string;
};
export type DiscordShareOutcome =
  | "not-discord"
  | "sent"
  | "copied"
  | "cancelled"
  | "unavailable";
const CHALLENGE_CUSTOM_ID = "challenge:";
const CHALLENGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const discordChallengeId = (customId: string | null) => {
  if (!customId?.startsWith(CHALLENGE_CUSTOM_ID)) return undefined;
  const id = customId.slice(CHALLENGE_CUSTOM_ID.length);
  return CHALLENGE_ID.test(id) ? id : undefined;
};
let discordSdkPromise: Promise<
  import("@discord/embedded-app-sdk").DiscordSDK
> | null = null;
const isDiscordActivity = () =>
  new URLSearchParams(location.search).has("frame_id");
const getDiscordSdk = () =>
  (discordSdkPromise ??= (async () => {
    const clientId =
      import.meta.env.VITE_DISCORD_CLIENT_ID || "1548073007950602303";
    const { DiscordSDK } = await import("@discord/embedded-app-sdk");
    const sdk = new DiscordSDK(clientId);
    await Promise.race([
      sdk.ready(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Discord connection timed out")),
          10000,
        ),
      ),
    ]);
    return sdk;
  })());
export async function initializeDiscord(): Promise<DiscordStatus> {
  if (!isDiscordActivity())
    return { status: "browser", message: "Playing on the web" };
  const clientId =
    import.meta.env.VITE_DISCORD_CLIENT_ID || "1548073007950602303";
  let challengeId: string | undefined;
  try {
    const sdk = await getDiscordSdk();
    challengeId = discordChallengeId(sdk.customId);
    const { code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });
    const { access_token } = await request<{ access_token: string }>(
      "/discord/token",
      { code },
    );
    const auth = await sdk.commands.authenticate({ access_token });
    return {
      status: "connected",
      message: "Connected to Discord",
      username: auth.user.username,
      challengeId,
    };
  } catch {
    return {
      status: "unavailable",
      message: "Discord connection unavailable. Solo play is available.",
      challengeId,
    };
  }
}
export async function shareDiscordChallenge(
  challengeId: string,
  message: string,
): Promise<DiscordShareOutcome> {
  if (!isDiscordActivity()) return "not-discord";
  try {
    const sdk = await getDiscordSdk();
    const result = await sdk.commands.shareLink({
      message,
      custom_id: `${CHALLENGE_CUSTOM_ID}${challengeId}`,
    });
    if (result.didSendMessage) return "sent";
    if (result.didCopyLink) return "copied";
    return result.success ? "sent" : "cancelled";
  } catch {
    return "unavailable";
  }
}
export async function openExternalUrl(url: string): Promise<void> {
  if (!isDiscordActivity()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const sdk = await getDiscordSdk();
    await sdk.commands.openExternalLink({ url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
