"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, optText, reqDate, zodError, type Result } from "./util";

const MeasurementInput = z.object({
  id: z.number().int().optional(),
  customerId: z.number().int().positive("Choose a customer"),
  date: reqDate,
  garmentType: z.string().min(1, "Choose the garment type"),
  size: optText,
  fit: optText,
  values: z.record(z.string(), z.number().nullable()),
  remarks: optText,
});
export type MeasurementInput = z.input<typeof MeasurementInput>;

export async function saveMeasurement(input: MeasurementInput): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  const parsed = MeasurementInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  const values = Object.fromEntries(Object.entries(d.values).filter(([, v]) => v != null && !Number.isNaN(v)));
  let row;
  if (id) {
    [row] = await db.update(schema.measurements).set({ ...d, values }).where(eq(schema.measurements.id, id)).returning();
  } else {
    [row] = await db.insert(schema.measurements).values({ ...d, values }).returning();
  }
  await audit(db, user, id ? "update" : "create", "measurement", row.id, d.garmentType);
  revalidatePath("/measurements");
  revalidatePath(`/customers/${d.customerId}`);
  return ok({ id: row.id });
}

export async function deleteMeasurement(id: number): Promise<Result<null>> {
  const user = await requireUser();
  const db = await getDb();
  const [row] = await db.delete(schema.measurements).where(eq(schema.measurements.id, id)).returning();
  await audit(db, user, "delete", "measurement", id);
  revalidatePath("/measurements");
  if (row) revalidatePath(`/customers/${row.customerId}`);
  return ok(null);
}
