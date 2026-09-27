// Client side of optional accounts. Guest play never touches this file.
// Web uses the session cookie; the bearer token is kept too so the Discord
// Activity and the native app (where cookies are unreliable) can sign in.
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import type { PlayRecord } from "./records.js";

const TOKEN = "doku.auth.token.v1";
const readToken = () => {
  try { return localStorage.getItem(TOKEN) || ""; } catch { return ""; }
};
const writeToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch { /* private mode */ }
};

export const authClient = createAuthClient({
  baseURL: typeof location === "undefined" ? "http://localhost" : location.origin,
  plugins: [magicLinkClient(), passkeyClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: readToken },
    onSuccess: (ctx) => {
      const t = ctx.response.headers.get("set-auth-token");
      if (t) writeToken(t);
    },
  },
});

export type Profile = {
  id: string;
  name: string;
  email: string;
  handle: string | null;
  image: string | null;
  featuredBadges: string[];
  publicProfile: boolean;
};
export type AccountConfig = {
  enabled: boolean;
  providers: { email?: boolean; passkey?: boolean; discord?: boolean; apple?: boolean };
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: response.status });
  return data as T;
}

export const getAccountConfig = () =>
  api<AccountConfig>("/account/config").catch((): AccountConfig => ({ enabled: false, providers: {} }));

/** The signed-in profile, or null for guests. */
export async function getMe(): Promise<Profile | null> {
  try {
    return (await api<{ profile: Profile }>("/me")).profile;
  } catch (e) {
    if ((e as { status?: number }).status === 401) return null;
    throw e;
  }
}

export const updateProfile = (patch: Partial<Pick<Profile, "name" | "handle" | "featuredBadges" | "publicProfile">>) =>
  api<{ profile: Profile }>("/me/profile", { method: "PUT", body: JSON.stringify(patch) }).then((r) => r.profile);

/** Send local records the server may not have; get back the full list. */
export const syncRecords = (records: PlayRecord[]) =>
  api<{ records: PlayRecord[]; added: number }>("/me/records", { method: "POST", body: JSON.stringify({ records }) });

export async function downloadMyData() {
  const token = readToken();
  const response = await fetch("/api/me/export", {
    credentials: "same-origin",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Couldn't prepare your data. Please try again.");
  const url = URL.createObjectURL(await response.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: "doku-data.json" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deleteAccount() {
  await api("/me", { method: "DELETE" });
  writeToken(null);
}

export async function signOut() {
  await authClient.signOut().catch(() => undefined);
  writeToken(null);
}

const back = "/profile/";
export async function sendMagicLink(email: string) {
  const { error } = await authClient.signIn.magicLink({ email, callbackURL: back, errorCallbackURL: `${back}?signin=error` });
  if (error) throw new Error(error.message || "Couldn't send the link. Check the address and try again.");
}
export async function signInWithPasskey() {
  const result = await authClient.signIn.passkey();
  if (result?.error) throw new Error(result.error.message || "Passkey sign-in didn't finish.");
}
export async function addPasskey() {
  const result = await authClient.passkey.addPasskey({ name: "*doku" });
  if (result?.error) throw new Error(result.error.message || "Couldn't add a passkey.");
}
export async function signInWithProvider(provider: "discord" | "apple") {
  await authClient.signIn.social({ provider, callbackURL: back, errorCallbackURL: `${back}?signin=error` });
}
export const passkeysSupported = () =>
  typeof window !== "undefined" && window.isSecureContext && "PublicKeyCredential" in window;
