/** Runs database migrations against DATABASE_URL (used on deploy). Skips when no DATABASE_URL is set. */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { runDataFixes } from "../src/lib/data-fixes";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set — skipping (local PGlite migrates itself on start).");
    return;
  }
  // Migrations need a session connection: use the direct / session pooler URL if provided.
  const client = postgres(process.env.DATABASE_URL_DIRECT || url, { max: 1, prepare: false });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // One-time data fixes that need code (each runs once, recorded in counters)
  await runDataFixes(db, (s) => console.log(s));
  await client.end();
  console.log("[migrate] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
