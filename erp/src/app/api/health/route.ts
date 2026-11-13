import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Setup check: which settings are present and whether the database answers. Never returns secret values. */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const info = (u: string) => {
    if (!u) return "missing";
    try {
      const p = new URL(u);
      return `${p.hostname}:${p.port || "5432"} (user ${decodeURIComponent(p.username)})`;
    } catch {
      return "set but not a valid URL — check for special characters in the password";
    }
  };
  const out: Record<string, unknown> = {
    DATABASE_URL: info(url),
    DATABASE_URL_DIRECT: info(process.env.DATABASE_URL_DIRECT ?? ""),
    ERP_SECRET: process.env.ERP_SECRET ? `set (${process.env.ERP_SECRET.length} chars)` : "missing",
    ERP_SETUP_CODE: process.env.ERP_SETUP_CODE ? "set" : "missing",
    region: process.env.VERCEL_REGION ?? "local",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    versionNote: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
  };
  if (url) {
    try {
      const { getDb } = await import("@/lib/db");
      const db = await getDb();
      const r = await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
      const rows = (r as unknown as { n: number }[]) ?? [];
      out.database = "connected";
      out.tables = rows[0]?.n ?? "?";
      if (!out.tables || out.tables === 0) out.hint = "Connected but no tables — the build did not run migrations. Check DATABASE_URL_DIRECT and redeploy.";
    } catch (e) {
      out.database = "ERROR";
      out.error = String((e as Error).message ?? e).replace(/:\/\/[^@]*@/g, "://***@");
    }
  }
  const ok = out.database === "connected" && out.ERP_SECRET !== "missing" && Number(out.tables) > 0;
  return NextResponse.json({ ok, ...out }, { status: ok ? 200 : 500 });
}
