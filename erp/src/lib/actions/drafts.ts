"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { draftsPocket, orderItemsExt } from "@/lib/db/ext";
import type { Pocket } from "@/lib/pocket";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { wearerFor } from "@/lib/wearer-db";
import { fail, ok, type Result } from "./util";

export type Draft = {
  id: number;
  customerId: number;
  wearerId: number | null;
  measurementId: number | null;
  garmentType: string;
  size: string | null;
  fit: string | null;
  remarks: string | null;
  values: Record<string, number | null>;
  /** pocket choices in progress (shirt) */
  pocket?: Pocket | null;
  step: number;
  updatedAt: string;
};

const DraftInput = z.object({
  id: z.number().int().positive().optional(),
  customerId: z.number().int().positive(),
  wearerId: z.number().int().positive().nullable().optional(),
  measurementId: z.number().int().positive().nullable().optional(),
  garmentType: z.string().min(1),
  size: z.string().nullable().optional(),
  fit: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  values: z.record(z.string(), z.number().nullable()),
  pocket: z.any().optional(),
  step: z.number().int().min(0),
});
export type DraftInput = z.input<typeof DraftInput>;

/** Saves the measurement in progress (after every field). Returns the draft id to keep using. */
export async function saveDraft(input: DraftInput): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  if (!(await features()).simple) return fail("Drafts are not available yet — the database update for them has not run");
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("Could not save the draft");
  const { id, pocket, ...d } = parsed.data;
  const db = await getDb();
  const savePocket = async (draftId: number) => {
    if (pocket !== undefined && (await features()).pocket) await db.update(draftsPocket).set({ pocket: (pocket as Pocket | null) ?? null }).where(eq(draftsPocket.id, draftId));
  };
  const values = { ...d, wearerId: await wearerFor(db, d.customerId, d.wearerId), updatedAt: new Date() };
  if (id) {
    const [row] = await db
      .update(schema.measurementDrafts)
      .set(values)
      .where(and(eq(schema.measurementDrafts.id, id), eq(schema.measurementDrafts.staffId, user.id)))
      .returning({ id: schema.measurementDrafts.id });
    if (row) {
      await savePocket(row.id);
      return ok(row);
    }
  }
  const [row] = await db.insert(schema.measurementDrafts).values({ ...values, staffId: user.id }).returning({ id: schema.measurementDrafts.id });
  await savePocket(row.id);
  return ok(row);
}

export async function deleteDraft(id: number): Promise<Result<null>> {
  const user = await requireUser();
  if (!(await features()).simple) return ok(null);
  const db = await getDb();
  await db.delete(schema.measurementDrafts).where(and(eq(schema.measurementDrafts.id, id), eq(schema.measurementDrafts.staffId, user.id)));
  return ok(null);
}

/** Scan: an order number (SO-0042), a customer code (C-0001) or a phone number → whose measurements. */
export async function lookupCode(code: string): Promise<Result<{ customerId: number; wearerId: number | null }>> {
  await requireUser();
  const term = code.trim();
  if (!term) return fail("Nothing scanned");
  const db = await getDb();
  const [o] = await db
    .select({ customerId: schema.orders.customerId, id: schema.orders.id })
    .from(schema.orders)
    .where(ilike(schema.orders.orderNo, term))
    .limit(1);
  if (o?.customerId) {
    // An order for one person (other than the customer themself) opens that person
    const ws = (await features()).wearers
      ? await db.selectDistinct({ id: orderItemsExt.wearerId }).from(orderItemsExt).innerJoin(schema.orders, eq(schema.orders.id, sql`"order_items"."order_id"`)).where(eq(schema.orders.id, o.id))
      : [];
    return ok({ customerId: o.customerId, wearerId: ws.length === 1 ? ws[0].id : null });
  }
  const digits = term.replace(/\D/g, "");
  const [c] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(or(ilike(schema.customers.code, term), digits.length >= 6 ? sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '\\D', '', 'g') like ${"%" + digits.slice(-10)}` : sql`false`))
    .orderBy(desc(schema.customers.id))
    .limit(1);
  if (c) return ok({ customerId: c.id, wearerId: null });
  return fail(`Nothing found for ${term}`);
}
