"use server";

import { revalidatePath } from "next/cache";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo } from "@/lib/numbering";
import { today } from "@/lib/utils";
import { erpMeasurement, type Unit, type WebOrderItem } from "@/lib/web-order";
import { saveMeasurement } from "./measurements";
import { fail, ok, type Result } from "./util";

/**
 * A website order → the customer (found by phone, or new) and one measurement record per garment, in the ERP's own
 * fields. Staff then make the stitching order as usual. Can be run once per website order.
 */
export async function saveWebOrderToCustomer(id: number): Promise<Result<{ customerId: number; measurements: number }>> {
  const user = await requireUser();
  const db = await getDb();
  const [o] = await db.select().from(schema.webOrders).where(eq(schema.webOrders.id, id));
  if (!o) return fail("Order not found");
  if (o.customerId) return fail("Already saved to the customer");
  const c = schema.customers;
  let [cust] = await db.select({ id: c.id }).from(c).where(or(eq(c.phone, o.phone), eq(c.altPhone, o.phone))).limit(1);
  if (!cust) {
    const code = await nextDocNo(db, "C");
    const place = o.address.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).pop() ?? null;
    [cust] = await db
      .insert(c)
      .values({ code, name: o.name, phone: o.phone, place, type: "Website", firstVisit: today(), remarks: `Website order #${o.id} · ${o.address} · PIN ${o.pincode}` })
      .returning({ id: c.id });
    await audit(db, user, "create", "customer", cust.id, `${o.name} (website order #${o.id})`);
  }
  let n = 0;
  // one record per garment type (two shirts in the same measurements make one record)
  const seen = new Set<string>();
  for (const it of o.items as WebOrderItem[]) {
    const m = erpMeasurement(it, o.unit as Unit);
    const key = `${m.garmentType}:${JSON.stringify(m.values)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = await saveMeasurement({ customerId: cust.id, date: today(), garmentType: m.garmentType, size: null, fit: m.fit, values: m.values, remarks: `${m.remarks} · website order #${o.id}`, pocket: m.pocket });
    if (!r.ok) return fail(`Measurement: ${r.error}`);
    n++;
  }
  await db.update(schema.webOrders).set({ customerId: cust.id, handledBy: user.name, handledAt: new Date() }).where(eq(schema.webOrders.id, id));
  await audit(db, user, "update", "web-order", id, `saved to customer ${cust.id} (${n} measurement${n === 1 ? "" : "s"})`);
  revalidatePath("/web-orders");
  revalidatePath(`/web-orders/${id}`);
  return ok({ customerId: cust.id, measurements: n });
}

/** New → confirmed (after the phone / WhatsApp call) or cancelled. */
export async function setWebOrderStatus(id: number, status: "new" | "confirmed" | "cancelled"): Promise<Result<null>> {
  const user = await requireUser();
  if (!["new", "confirmed", "cancelled"].includes(status)) return fail("Unknown status");
  const db = await getDb();
  await db.update(schema.webOrders).set({ status, handledBy: user.name, handledAt: new Date() }).where(eq(schema.webOrders.id, id));
  await audit(db, user, "update", "web-order", id, status);
  revalidatePath("/web-orders");
  revalidatePath(`/web-orders/${id}`);
  return ok(null);
}
