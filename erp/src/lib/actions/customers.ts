"use server";

import { revalidatePath } from "next/cache";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo } from "@/lib/numbering";
import { today } from "@/lib/utils";
import { fail, ok, optDate, optText, zodError, type Result } from "./util";

const CustomerInput = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  phone: optText,
  place: optText,
  type: optText,
  firstVisit: optDate,
  remarks: optText,
});
export type CustomerInput = z.input<typeof CustomerInput>;
type Saved = { id: number; code: string; name: string; phone: string | null; place: string | null };

export async function saveCustomer(input: CustomerInput): Promise<Result<Saved>> {
  const user = await requireUser();
  const parsed = CustomerInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const phone = d.phone ? d.phone.replace(/[^\d+]/g, "") : null;
  const db = await getDb();

  if (phone) {
    const dupe = await db
      .select({ id: schema.customers.id, name: schema.customers.name })
      .from(schema.customers)
      .where(eq(schema.customers.phone, phone));
    const other = dupe.find((c) => c.id !== d.id);
    if (other) return fail(`Phone already belongs to ${other.name}`);
  }

  const values = { name: d.name, phone, place: d.place, type: d.type, firstVisit: d.firstVisit ?? today(), remarks: d.remarks };
  let row;
  if (d.id) {
    [row] = await db.update(schema.customers).set(values).where(eq(schema.customers.id, d.id)).returning();
    await audit(db, user, "update", "customer", row.id, row.name);
  } else {
    const code = await nextDocNo(db, "C");
    [row] = await db.insert(schema.customers).values({ ...values, code }).returning();
    await audit(db, user, "create", "customer", row.id, row.name);
  }
  revalidatePath("/customers");
  return ok({ id: row.id, code: row.code, name: row.name, phone: row.phone, place: row.place });
}

export async function deleteCustomer(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const used = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.customerId, id))
    .limit(1);
  const usedSale = await db.select({ id: schema.sales.id }).from(schema.sales).where(eq(schema.sales.customerId, id)).limit(1);
  if (used.length || usedSale.length) return fail("This customer has bills or orders, so it cannot be deleted.");
  await db.delete(schema.customers).where(eq(schema.customers.id, id));
  await audit(db, user, "delete", "customer", id);
  revalidatePath("/customers");
  return ok(null);
}

export async function findCustomerByPhone(phone: string) {
  await requireUser();
  const p = phone.replace(/[^\d+]/g, "");
  if (p.length < 6) return null;
  const db = await getDb();
  const [c] = await db
    .select()
    .from(schema.customers)
    .where(or(eq(schema.customers.phone, p), eq(schema.customers.phone, p.slice(-10))));
  return c ?? null;
}
