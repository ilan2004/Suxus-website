import "server-only";
import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seedDefaults } from "./seed";
import { pgConnection } from "./pg-config";

export type DB = ReturnType<typeof drizzlePg<typeof schema>>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __suxusDb?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (url) {
    // Supabase / any Postgres. Migrations and default settings are done at deploy time (scripts/migrate.ts) —
    // nothing is written on start, so a cold start costs no database round trip.
    //
    // Vercel pauses idle function instances (Fluid compute). A connection left open across a pause can be dead
    // when the instance wakes, and a query on it never answers: the request then hangs until Vercel's 300 s limit
    // (the "Task timed out after 300 seconds" errors). So:
    //   - attachDatabasePool: Vercel keeps the instance alive just long enough to close idle connections before
    //     it pauses (supported for the `pg` pool; the old `postgres` client kept idle connections forever);
    //   - idleTimeoutMillis: idle connections close after 5 s anyway;
    //   - connectionTimeoutMillis / query_timeout: a stuck connect or query fails in seconds instead of hanging.
    // No server-side settings are sent at connect (Supabase's transaction pooler can refuse startup parameters).
    const pg = await import("pg");
    const Pool = pg.Pool ?? pg.default.Pool;
    const pool = new Pool({
      // same TLS behaviour as the previous client (see pg-config.ts)
      ...pgConnection(url),
      max: 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 25_000,
      keepAlive: true,
    });
    // An idle connection dropped by the pooler must not crash the instance
    pool.on("error", (e) => console.error("[db] idle connection closed:", e.message));
    const { attachDatabasePool } = await import("@vercel/functions");
    attachDatabasePool(pool);
    return drizzlePg(pool, { schema });
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production" && process.env.ERP_ALLOW_PGLITE !== "1") {
    throw new Error("DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.");
  }

  // Local development: embedded Postgres (PGlite) persisted in ./.data
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  const typed = db as unknown as DB;
  const { runDataFixes } = await import("../data-fixes");
  await runDataFixes(typed, (s) => console.log(s));
  await seedDefaults(typed);
  return typed;
}

export function getDb(): Promise<DB> {
  if (!g.__suxusDb) {
    g.__suxusDb = create().catch((e) => {
      g.__suxusDb = undefined;
      throw e;
    });
  }
  return g.__suxusDb;
}

export { schema };
