/**
 * Runs database migrations against DATABASE_URL — on deploy, before `next build` (package.json "vercel-build").
 *
 * GUARD: on Vercel this script must succeed, or the build stops and nothing is deployed. A failed build leaves the
 * working site running; a deployed build whose database was not updated takes the site down. So on Vercel:
 *   - no DATABASE_URL                      → fail (it used to skip silently and deploy anyway)
 *   - after migrating, the database is not at the newest migration in ./drizzle → fail
 *   - a column / table the code needs is missing → fail
 * Off Vercel (local development) a missing DATABASE_URL still skips: PGlite migrates itself on start.
 * Escape hatch (only if you know why): ERP_SKIP_MIGRATIONS=1.
 */
import path from "node:path";
import fs from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { runDataFixes } from "../src/lib/data-fixes";
import { seedDefaults } from "../src/lib/db/seed";

const onVercel = !!process.env.VERCEL;
const stop = (msg: string): never => {
  console.error(`\n[migrate] BUILD STOPPED — ${msg}\n[migrate] Nothing will be deployed; the live site keeps running the previous version.\n`);
  process.exit(1);
};

/** Columns / tables the app reads directly (a missing one would take pages down) — checked after migrating. */
const REQUIRED: [string, string][] = [
  ["staff", "session_version"],
  ["fabrics", "pattern"],
  ["fabrics", "opening_mtr"],
  ["fabric_stock_moves", "id"],
  ["wearers", "id"],
  ["measurements", "wearer_id"],
  ["order_items", "wearer_id"],
  ["staff", "simple_mode"],
  ["measurement_drafts", "id"],
  ["job_slip_links", "token"],
  ["job_slip_events", "id"],
  ["order_item_fabrics", "fabric_id"],
  ["order_items", "variant"],
  ["stitching_prices", "id"],
  ["order_items", "list_rate"],
  ["bulk_order_items", "list_rate"],
  ["measurements", "pocket"],
  ["measurement_drafts", "pocket"],
  ["tryon_images", "data"],
  ["tryon_generations", "cost_usd"],
  ["tryon_enquiries", "contacted"],
  ["tryon_generations", "on_display"],
  ["tryon_generations", "sleeve"],
  ["fabrics", "suitable_for"],
  ["fabrics", "colour_bucket"],
];

async function main() {
  if (process.env.ERP_SKIP_MIGRATIONS === "1") {
    console.warn("[migrate] ERP_SKIP_MIGRATIONS=1 — migrations skipped on purpose.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (onVercel) stop("DATABASE_URL is not available to the build. In Vercel → Settings → Environment Variables, tick the Production environment for DATABASE_URL (and DATABASE_URL_DIRECT if used), then redeploy.");
    console.log("[migrate] DATABASE_URL not set — skipping (local PGlite migrates itself on start).");
    return;
  }
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  // Migrations need a session connection: use the direct / session pooler URL if provided.
  const client = postgres(process.env.DATABASE_URL_DIRECT || url, { max: 1, prepare: false });
  try {
    const db = drizzle(client);
    const before = await lastApplied(client);
    await migrate(db, { migrationsFolder });
    const after = await lastApplied(client);

    // Is the database now at the newest migration this code ships?
    const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
    const newest = journal.entries[journal.entries.length - 1];
    if (!after || after < newest.when) stop(`the database is not at the newest migration (${newest.tag}) after migrating.`);
    console.log(`[migrate] database at ${newest.tag}${before === after ? " (already up to date)" : ""}`);

    // Everything the code reads is really there?
    const have = new Set(
      (await client`select table_name || '.' || column_name as k from information_schema.columns where table_schema = current_schema()`).map((r) => r.k as string),
    );
    const missing = REQUIRED.filter(([t, c]) => !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`);
    if (missing.length) stop(`missing in the database after migrating: ${missing.join(", ")}.`);

    // One-time data fixes that need code (each runs once, recorded in counters)
    await runDataFixes(db, (s) => console.log(s));
    // Default settings that do not exist yet — once per deploy here, never on a request (getSettings() also falls
    // back to the built-in defaults for any row that is missing)
    await seedDefaults(db as unknown as Parameters<typeof seedDefaults>[0]);
    console.log("[migrate] done");
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** created_at of the newest applied migration (0 when none). */
async function lastApplied(client: postgres.Sql): Promise<number> {
  try {
    const rows = await client`select max(created_at)::bigint as at from drizzle.__drizzle_migrations`;
    return Number(rows[0]?.at ?? 0);
  } catch {
    return 0;
  }
}

main().catch((e) => {
  console.error(e);
  stop(`migration failed: ${(e as Error).message}`);
});
