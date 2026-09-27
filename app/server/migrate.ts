// Creates/updates every table accounts need (auth + *doku's own).
// Run with: npm run db:migrate   (uses DATABASE_URL if set, else local SQLite)
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "./auth.js";

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(authOptions);
if (!toBeCreated.length && !toBeAdded.length) console.log("Database is up to date.");
else {
  console.log("Creating:", toBeCreated.map((t) => t.table).join(", ") || "—");
  console.log("Adding columns to:", toBeAdded.map((t) => t.table).join(", ") || "—");
  await runMigrations();
  console.log("Done.");
}
process.exit(0);
