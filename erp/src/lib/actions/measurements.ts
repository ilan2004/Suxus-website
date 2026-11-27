"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { LEGACY_GARMENTS } from "@/lib/measurements";
import { wearerFor } from "@/lib/wearer-db";
import { measurementsExt, measurementsPocket } from "@/lib/db/ext";
import { cleanPocket, hasPocket } from "@/lib/pocket";
import { features } from "@/lib/db/features";
import { fail, ok, optText, reqDate, zodError, type Result } from "./util";

const MeasurementInput = z.object({
  id: z.number().int().optional(),
  customerId: z.number().int().positive("Choose a customer"),
  /** Whose measurements (empty = the customer's Self wearer). */
  wearerId: z.number().int().positive().nullable().optional(),
  date: reqDate,
  garmentType: z.string().min(1, "Choose the garment type"),
  size: optText,
  fit: optText,
  values: z.record(z.string(), z.number().nullable()),
  remarks: optText,
  /** Pocket choices (shirt records only); null / missing = not recorded */
  pocket: z
    .object({
      count: z.enum(["none", "one", "two"]),
      size: z.enum(["small", "medium", "large"]).nullable(),
      width: z.number().nullable(),
      depth: z.number().nullable(),
      shape: z.enum(["flat", "pointed", "cut", "rounded"]).nullable(),
      flap: z.boolean(),
      button: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});
export type MeasurementInput = z.input<typeof MeasurementInput>;

export async function saveMeasurement(input: MeasurementInput): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  const parsed = MeasurementInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...rest } = parsed.data;
  const db = await getDb();
  let values = Object.fromEntries(Object.entries(rest.values).filter(([, v]) => v != null && !Number.isNaN(v)));
  // An old "Shirt Full/Half Sleeve" record (e.g. from an old link) is saved as the one Shirt garment
  const legacy = LEGACY_GARMENTS[rest.garmentType];
  if (legacy && values.Sleeve != null) {
    const { Sleeve, ...others } = values;
    values = { ...others, [legacy.sleeve]: Sleeve };
  }
  const { wearerId: wantedWearer, pocket, ...base } = rest;
  const d = { ...base, garmentType: legacy?.to ?? rest.garmentType };
  let row;
  if (id) {
    [row] = await db.update(schema.measurements).set({ ...d, values }).where(eq(schema.measurements.id, id)).returning({ id: schema.measurements.id });
  } else {
    [row] = await db.insert(schema.measurements).values({ ...d, values }).returning({ id: schema.measurements.id });
  }
  // Whose measurements (Wearers) — only once the database has it
  // Pocket (shirt records only) — once the database has it; another garment keeps none
  const feat = await features();
  if (feat.pocket && pocket !== undefined) await db.update(measurementsPocket).set({ pocket: hasPocket(d.garmentType) ? cleanPocket(pocket) : null }).where(eq(measurementsPocket.id, row.id));
  if (feat.wearers) await db.update(measurementsExt).set({ wearerId: await wearerFor(db, rest.customerId, wantedWearer) }).where(eq(measurementsExt.id, row.id));
  await audit(db, user, id ? "update" : "create", "measurement", row.id, d.garmentType);
  revalidatePath("/measurements");
  revalidatePath(`/customers/${d.customerId}`);
  return ok({ id: row.id });
}

export async function deleteMeasurement(id: number): Promise<Result<null>> {
  const user = await requireUser();
  const db = await getDb();
  const [row] = await db.delete(schema.measurements).where(eq(schema.measurements.id, id)).returning({ customerId: schema.measurements.customerId });
  await audit(db, user, "delete", "measurement", id);
  revalidatePath("/measurements");
  if (row) revalidatePath(`/customers/${row.customerId}`);
  return ok(null);
}
