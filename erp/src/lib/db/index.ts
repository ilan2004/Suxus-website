import "server-only";
import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { seedDefaults } from "./seed";

export type DB = ReturnType<typeof drizzlePg<typeof schema>>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __suxusDb?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (url) {
    // Supabase / any Postgres. Migrations run at deploy time (scripts/migrate.ts);
    // `prepare: false` is required for Supabase's transaction pooler.
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePg(client, { schema });
    await seedDefaults(db);
    return db;
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
