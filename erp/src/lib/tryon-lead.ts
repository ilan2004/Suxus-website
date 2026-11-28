import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import { features } from "./db/features";

/**
 * Website lock: the name and phone a website visitor gives before the free try-on, kept as a Try-on enquiry
 * (Settings > Try-on > Enquiries, marked "from the website") with the picture when it was made.
 */
export async function saveWebLead(o: { name: string; phone: string; device: string; resultId: string | null; fabricId?: number; variant?: string }) {
  if (!(await features()).tryonLeads) return;
  const db = await getDb();
  const e = schema.tryonEnquiries;
  if (o.resultId) {
    const [gen] = await db
      .select({ id: schema.tryonGenerations.id, fabricId: schema.tryonGenerations.fabricId, variant: schema.tryonGenerations.variant })
      .from(schema.tryonGenerations)
      .where(eq(schema.tryonGenerations.resultId, o.resultId));
    // an earlier failed attempt from this phone left an enquiry without a picture: complete that one
    const [open] = await db.select({ id: e.id }).from(e).where(and(eq(e.device, o.device), eq(e.phone, o.phone), isNull(e.resultId))).orderBy(desc(e.id)).limit(1);
    const v = { name: o.name, phone: o.phone, resultId: o.resultId, fabricId: gen?.fabricId ?? null, variant: gen?.variant ?? null, generationId: gen?.id ?? null };
    if (open) await db.update(e).set(v).where(eq(e.id, open.id));
    else await db.insert(e).values({ ...v, device: o.device });
    return;
  }
  // the failed attempt just logged for this phone (it carries source = web, so the list marks the website)
  const [last] = await db
    .select({ id: schema.tryonGenerations.id })
    .from(schema.tryonGenerations)
    .where(eq(schema.tryonGenerations.device, o.device))
    .orderBy(desc(schema.tryonGenerations.id))
    .limit(1);
  const [open] = await db.select({ id: e.id }).from(e).where(and(eq(e.device, o.device), eq(e.phone, o.phone), isNull(e.resultId))).limit(1);
  if (!open) await db.insert(e).values({ name: o.name, phone: o.phone, device: o.device, fabricId: o.fabricId ?? null, variant: o.variant ?? null, generationId: last?.id ?? null });
}
