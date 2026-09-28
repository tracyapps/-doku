// Accounts (optional — guest play never needs one).
//
// Sign-in methods:
//   • Email magic link (creates the account on first use; no passwords)
//   • Passkey (added from the profile after the first sign-in)
//   • Discord and Sign in with Apple, when their keys are configured
//
// Storage: Postgres when DATABASE_URL is set (required on Vercel), otherwise
// a local SQLite file at .data/auth.sqlite so `npm run dev:api` just works.
// The same Better Auth schema also holds *doku's own tables (see dokuSchema),
// so one migration step (`npm run db:migrate`) creates everything.
import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { bearer, magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const env = process.env;
const production = env.NODE_ENV === "production" || !!env.VERCEL;
export const publicURL =
  env.BETTER_AUTH_URL ||
  // On Vercel, fall back to the production domain so passkeys and OAuth
  // callbacks never point at the local dev address.
  (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:5173");

/** *doku's own tables, created by the same migration as the auth tables. */
export const dokuSchema = {
  id: "doku",
  schema: {
    user: {
      fields: {
        // public @handle for friends and leaderboards (optional, unique)
        handle: { type: "string", required: false, unique: true },
        // JSON array of up to 3 achievement ids shown on the profile
        featuredBadges: { type: "string", required: false },
        // leaderboards: show this player on global boards (opt-in)
        publicProfile: { type: "boolean", required: false, defaultValue: false },
        // private code behind the "add me as a friend" link
        inviteCode: { type: "string", required: false, unique: true },
      },
    },
    // Two rows per friendship (one each way) so "my friends" is one lookup.
    friendship: {
      fields: {
        userId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
        friendId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
        createdAt: { type: "date", required: true },
      },
    },
    // A friend request sent from someone's profile (invite links skip this:
    // opening a friend's link is already consent on both sides).
    friendRequest: {
      fields: {
        fromId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
        toId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
        createdAt: { type: "date", required: true },
      },
    },
    playRecord: {
      fields: {
        userId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
        recordId: { type: "string", required: true },
        kind: { type: "string", required: true },
        daily: { type: "string", required: false, index: true },
        variant: { type: "string", required: true },
        difficulty: { type: "string", required: true },
        completedAt: { type: "date", required: true },
        data: { type: "string", required: true }, // the full PlayRecord JSON
      },
    },
  },
} satisfies BetterAuthPlugin;

function database(): BetterAuthOptions["database"] {
  if (env.DATABASE_URL) return new Pool({ connectionString: env.DATABASE_URL });
  if (production) throw new Error("DATABASE_URL is required in production");
  mkdirSync(".data", { recursive: true });
  return new DatabaseSync(env.AUTH_SQLITE_FILE || ".data/auth.sqlite");
}

async function sendEmail(to: string, url: string) {
  if (!env.RESEND_API_KEY) {
    // Development: no email service yet — print the link instead.
    console.log(`\n✉️  Magic link for ${to}:\n${url}\n`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM || "*doku <hello@stardoku.app>",
      to,
      subject: "Your *doku sign-in link",
      text: `Tap to sign in to *doku:\n\n${url}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Tap to sign in to <strong>*doku</strong>:</p><p><a href="${url}">Sign in to *doku</a></p><p style="color:#666">This link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) throw new Error("Could not send the sign-in email");
}

const socialProviders: BetterAuthOptions["socialProviders"] = {};
if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET)
  socialProviders.discord = { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET };
if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET)
  socialProviders.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET };

const trusted = [
  publicURL,
  ...(env.AUTH_TRUSTED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  // The Discord Activity runs on <client id>.discordsays.com and proxies to us.
  ...(env.DISCORD_CLIENT_ID ? [`https://${env.DISCORD_CLIENT_ID}.discordsays.com`] : []),
  ...(production ? [] : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"]),
  "https://appleid.apple.com",
];

export const authOptions = {
  appName: "*doku",
  baseURL: publicURL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET || (production ? undefined : "dev-only-secret-change-me-dev-only-secret"),
  database: database(),
  trustedOrigins: trusted,
  socialProviders,
  account: { accountLinking: { enabled: true, trustedProviders: ["discord", "apple"] } },
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 }, // 60 days, refreshed daily
  plugins: [
    dokuSchema,
    magicLink({ expiresIn: 15 * 60, sendMagicLink: ({ email, url }) => sendEmail(email, url) }),
    passkey({ rpID: new URL(publicURL).hostname, rpName: "*doku", origin: publicURL }),
    bearer(), // Discord Activity + native app send a token instead of cookies
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);
export const accountProviders = () => ({
  email: true,
  passkey: true,
  discord: !!socialProviders.discord,
  apple: !!socialProviders.apple,
});
