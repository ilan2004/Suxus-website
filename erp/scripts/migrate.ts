/** Runs database migrations against DATABASE_URL (used on deploy). Skips when no DATABASE_URL is set. */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set — skipping (local PGlite migrates itself on start).");
    return;
  }
  // Migrations need a session connection: use the direct / session pooler URL if provided.
  const client = postgres(process.env.DATABASE_URL_DIRECT || url, { max: 1, prepare: false });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await client.end();
  console.log("[migrate] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
