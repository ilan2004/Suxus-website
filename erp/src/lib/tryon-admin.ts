import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { USD_TO_INR, todayStartIST } from "./tryon";

/* Settings > Try-on (stats) and the Try-on enquiries list. Partners only — checked by the pages / actions using these. */

/** First day of this month in India. */
function monthStartIST() {
  const d = todayStartIST();
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCDate(1);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000);
}

export async function tryonStats() {
  const db = await getDb();
  const g = schema.tryonGenerations;
  const today = todayStartIST();
  const month = monthStartIST();
  const [t] = await db
    .select({ ok: sql<number>`count(*) filter (where ${g.ok})`.mapWith(Number), failed: sql<number>`count(*) filter (where not ${g.ok})`.mapWith(Number) })
    .from(g)
    .where(gte(g.createdAt, today));
  const [m] = await db
    .select({
      ok: sql<number>`count(*) filter (where ${g.ok})`.mapWith(Number),
      failed: sql<number>`count(*) filter (where not ${g.ok})`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${g.costUsd}), 0)`.mapWith(Number),
      avgMs: sql<number>`coalesce(avg(${g.ms}) filter (where ${g.ok}), 0)`.mapWith(Number),
    })
    .from(g)
    .where(gte(g.createdAt, month));
  const top = await db
    .select({ fabricId: g.fabricId, code: schema.fabrics.code, brand: schema.fabrics.brand, shade: schema.fabrics.shade, tries: count() })
    .from(g)
    .leftJoin(schema.fabrics, eq(schema.fabrics.id, g.fabricId))
    .where(and(gte(g.createdAt, month), eq(g.ok, true)))
    .groupBy(g.fabricId, schema.fabrics.code, schema.fabrics.brand, schema.fabrics.shade)
    .orderBy(desc(count()))
    .limit(8);
  const model = (await db.select({ model: g.model }).from(g).orderBy(desc(g.id)).limit(1))[0]?.model ?? null;
  return {
    today: t,
    month: { ...m, costInr: Math.round(m.cost * USD_TO_INR * 100) / 100 },
    usdToInr: USD_TO_INR,
    model,
    top: top.map((r) => ({ code: r.code ?? "(removed)", name: [r.brand, r.shade].filter(Boolean).join(" · "), tries: r.tries })),
  };
}

export async function tryonEnquiries() {
  const db = await getDb();
  const e = schema.tryonEnquiries;
  const rows = await db
    .select({
      id: e.id,
      createdAt: e.createdAt,
      name: e.name,
      phone: e.phone,
      variant: e.variant,
      contacted: e.contacted,
      contactedBy: e.contactedBy,
      contactedAt: e.contactedAt,
      fabricId: e.fabricId,
      code: schema.fabrics.code,
      brand: schema.fabrics.brand,
      shade: schema.fabrics.shade,
      // the image is kept 7 days like every try-on photo; after that the enquiry stays without it
      hasImage: sql<boolean>`exists (select 1 from ${schema.tryonImages} where ${schema.tryonImages.id} = ${e.resultId})`,
    })
    .from(e)
    .leftJoin(schema.fabrics, eq(schema.fabrics.id, e.fabricId))
    .orderBy(desc(e.id))
    .limit(500);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString(), contactedAt: r.contactedAt ? new Date(r.contactedAt).toISOString() : null, fabric: r.code ? `${r.code} · ${[r.brand, r.shade].filter(Boolean).join(" · ")}` : "—" }));
}
export type TryonEnquiry = Awaited<ReturnType<typeof tryonEnquiries>>[number];

/** The generated image of an enquiry, for staff. */
export async function enquiryImage(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ mime: schema.tryonImages.mime, data: schema.tryonImages.data })
    .from(schema.tryonEnquiries)
    .innerJoin(schema.tryonImages, eq(schema.tryonImages.id, schema.tryonEnquiries.resultId))
    .where(eq(schema.tryonEnquiries.id, id));
  return row ?? null;
}
