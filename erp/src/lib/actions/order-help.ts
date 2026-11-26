"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { col, when } from "@/lib/db/ext";
import { features } from "@/lib/db/features";

export type PreviousVariant = { wearerId: number | null; item: string; variant: string };

/**
 * For the order form: the variant each person last had for each garment (latest order first), so a new item starts
 * with the wearer's previous choice. Wearer null = the customer themself (or before Wearers).
 */
export async function previousVariants(customerId: number): Promise<PreviousVariant[]> {
  await requireUser();
  const f = await features();
  if (!customerId || !f.variant) return [];
  const db = await getDb();
  const rows = await db
    .select({ item: schema.orderItems.item, variant: col.orderItemVariant, wearerId: when(f.wearers, col.orderItemWearer) })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(and(eq(schema.orders.customerId, customerId), isNotNull(col.orderItemVariant)))
    .orderBy(desc(schema.orders.date), desc(schema.orderItems.id))
    .limit(300);
  const seen = new Set<string>();
  const out: PreviousVariant[] = [];
  for (const r of rows) {
    if (!r.variant) continue;
    const k = `${r.wearerId ?? ""}|${r.item}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ wearerId: r.wearerId ?? null, item: r.item, variant: r.variant });
  }
  return out;
}
