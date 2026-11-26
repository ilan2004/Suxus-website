"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { measurementsExt, orderItemsExt } from "@/lib/db/ext";
import { features } from "@/lib/db/features";

const NOT_YET = "Adding people is not available yet — the database update for it has not run";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { selfWearerId } from "@/lib/wearer-db";
import { RELATIONS, type WearerLite } from "@/lib/wearers";
import { fail, ok, optText, zodError, type Result } from "./util";

/** The customer's wearers, Self first (creates Self if the customer has none yet). */
export async function listWearers(customerId: number): Promise<WearerLite[]> {
  await requireUser();
  if (!customerId || !(await features()).wearers) return [];
  const db = await getDb();
  await selfWearerId(db, customerId);
  return db
    .select({
      id: schema.wearers.id,
      customerId: schema.wearers.customerId,
      name: schema.wearers.name,
      relation: schema.wearers.relation,
      school: schema.wearers.school,
      note: schema.wearers.note,
      isSelf: schema.wearers.isSelf,
    })
    .from(schema.wearers)
    .where(eq(schema.wearers.customerId, customerId))
    .orderBy(desc(schema.wearers.isSelf), asc(schema.wearers.id));
}

const WearerInput = z.object({
  id: z.number().int().optional(),
  customerId: z.number().int().positive("Choose a customer first"),
  name: z.string().trim().min(1, "Name is required"),
  relation: z.enum(RELATIONS).default("Other"),
  school: optText,
  note: optText,
});
export type WearerInput = z.input<typeof WearerInput>;

export async function saveWearer(input: WearerInput): Promise<Result<WearerLite>> {
  const user = await requireUser();
  if (!(await features()).wearers) return fail(NOT_YET);
  const parsed = WearerInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, customerId, ...d } = parsed.data;
  const db = await getDb();
  let row;
  if (id) {
    const [w] = await db.select().from(schema.wearers).where(and(eq(schema.wearers.id, id), eq(schema.wearers.customerId, customerId)));
    if (!w) return fail("Person not found");
    // Self stays "Self": only school / note change on it
    const patch = w.isSelf ? { school: d.school, note: d.note } : { ...d, relation: d.relation === "Self" ? "Other" : d.relation };
    [row] = await db.update(schema.wearers).set({ ...patch, updatedAt: new Date() }).where(eq(schema.wearers.id, id)).returning();
  } else {
    await selfWearerId(db, customerId);
    [row] = await db
      .insert(schema.wearers)
      .values({ customerId, ...d, relation: d.relation === "Self" ? "Other" : d.relation, isSelf: false })
      .returning();
  }
  await audit(db, user, id ? "update" : "create", "wearer", row.id, `${row.name} (${row.relation})`);
  revalidatePath("/measurements");
  revalidatePath(`/customers/${customerId}`);
  return ok({ id: row.id, customerId: row.customerId, name: row.name, relation: row.relation, school: row.school, note: row.note, isSelf: row.isSelf });
}

/** Removes a person — only when nothing is recorded for them (Self is never removed). */
export async function deleteWearer(id: number): Promise<Result<null>> {
  const user = await requireUser();
  if (!(await features()).wearers) return fail(NOT_YET);
  const db = await getDb();
  const [w] = await db.select().from(schema.wearers).where(eq(schema.wearers.id, id));
  if (!w) return ok(null);
  if (w.isSelf) return fail("Self cannot be removed");
  const [m] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(measurementsExt).where(eq(measurementsExt.wearerId, id));
  const [o] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(orderItemsExt).where(eq(orderItemsExt.wearerId, id));
  if (m.n || o.n) return fail(`${w.name} has ${m.n} measurement record(s) and ${o.n} order item(s) — cannot remove`);
  await db.delete(schema.wearers).where(eq(schema.wearers.id, id));
  await audit(db, user, "delete", "wearer", id, w.name);
  revalidatePath("/measurements");
  revalidatePath(`/customers/${w.customerId}`);
  return ok(null);
}
