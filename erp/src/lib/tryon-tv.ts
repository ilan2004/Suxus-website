import "server-only";
import crypto from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getSetting } from "./settings";

/*
 * The shop TV (/tryon/display). A customer's image reaches it ONLY when that customer pressed "Show on the shop TV"
 * on their own phone (on_display) — default off, and "Remove from TV" takes it off again.
 */

/** How long ago a "show" may still be picked up by the TV. */
const FRESH_MINUTES = 10;

/** The TV may read: a signed-in staff member, or the secret token set in Settings > Try-on. */
export async function tvAllowed(key: string | null | undefined) {
  const c = await getSetting("tryon");
  if (key && c.displayToken.length >= 32 && key.length === c.displayToken.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(c.displayToken))) return true;
  try {
    const { getSession } = await import("./auth");
    return !!(await getSession());
  } catch {
    return false;
  }
}

/** The customer's own choice for one of THEIR results. */
export async function setOnDisplay(device: string, resultId: string, show: boolean) {
  const db = await getDb();
  const rows = await db
    .update(schema.tryonGenerations)
    .set({ onDisplay: show, displayAt: show ? new Date() : null })
    .where(and(eq(schema.tryonGenerations.resultId, resultId), eq(schema.tryonGenerations.device, device), eq(schema.tryonGenerations.ok, true)))
    .returning({ id: schema.tryonGenerations.id });
  return rows.length > 0;
}

/** Recently shown results (newest first) — only ones the customer chose to show, whose image still exists. */
export async function tvFeed() {
  const db = await getDb();
  const g = schema.tryonGenerations;
  const rows = await db
    .select({ id: g.id, at: g.displayAt, variant: g.variant, code: schema.fabrics.code, brand: schema.fabrics.brand, shade: schema.fabrics.shade, rate: schema.fabrics.saleRate })
    .from(g)
    .leftJoin(schema.fabrics, eq(schema.fabrics.id, g.fabricId))
    .where(
      and(
        eq(g.onDisplay, true),
        gte(g.displayAt, new Date(Date.now() - FRESH_MINUTES * 60_000)),
        sql`exists (select 1 from ${schema.tryonImages} where ${schema.tryonImages.id} = ${g.resultId})`,
      ),
    )
    .orderBy(desc(g.displayAt))
    .limit(5);
  return rows.map((r) => ({ id: r.id, at: r.at ? new Date(r.at).getTime() : 0, code: r.code ?? "", name: [r.brand, r.shade].filter(Boolean).join(" · "), variant: r.variant, rate: r.rate ?? 0 }));
}

/** The image of a shown result — refused when the customer has not chosen (or has removed) it. */
export async function tvImage(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ mime: schema.tryonImages.mime, data: schema.tryonImages.data })
    .from(schema.tryonGenerations)
    .innerJoin(schema.tryonImages, eq(schema.tryonImages.id, schema.tryonGenerations.resultId))
    .where(and(eq(schema.tryonGenerations.id, id), eq(schema.tryonGenerations.onDisplay, true)));
  return row ?? null;
}

export const newDisplayToken = () => crypto.randomBytes(32).toString("base64url");
