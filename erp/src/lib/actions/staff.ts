"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { hashPin, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { fail, ok, optDate, optText, zodError, type Result } from "./util";

const StaffInput = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  role: optText,
  phone: optText,
  joinDate: optDate,
  payType: optText,
  monthlySalary: z.coerce.number<number>().min(0).nullable().optional(),
  pieceRate: z.coerce.number<number>().min(0).nullable().optional(),
  incentive: z.boolean().default(false),
  ownIncentivePct: z.coerce.number<number>().min(0).max(100).nullable().optional(),
  status: z.enum(["Active", "Left"]).default("Active"),
  remarks: optText,
  access: z.enum(["owner", "partner", "staff", "none"]).default("none"),
  pin: z
    .string()
    .regex(/^(\d{4,6})?$/, "PIN must be 4–6 digits")
    .optional(),
});
export type StaffInput = z.input<typeof StaffInput>;

export async function saveStaff(input: StaffInput): Promise<Result<{ id: number }>> {
  const user = await requireUser({ can: "staff" });
  const parsed = StaffInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, pin, ownIncentivePct, ...d } = parsed.data;
  const db = await getDb();

  const values = {
    ...d,
    monthlySalary: d.monthlySalary ?? null,
    pieceRate: d.pieceRate ?? null,
    // entered as % (4) → stored as fraction (0.04), like the Excel
    ownIncentivePct: ownIncentivePct ? ownIncentivePct / 100 : null,
    ...(pin ? { pinHash: await hashPin(pin) } : {}),
  };

  if (id) {
    const [existing] = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
    if (!existing) return fail("Not found");
    if (values.access !== "none" && !existing.pinHash && !pin) return fail("Set a PIN so this person can sign in");
    // never lock out the last owner
    if (existing.access === "owner" && (values.access !== "owner" || values.status !== "Active")) {
      const others = await db
        .select({ id: schema.staff.id })
        .from(schema.staff)
        .where(and(eq(schema.staff.access, "owner"), eq(schema.staff.status, "Active"), ne(schema.staff.id, id)));
      if (!others.length) return fail("At least one active Owner login is required");
    }
    await db.update(schema.staff).set(values).where(eq(schema.staff.id, id));
    await audit(db, user, "update", "staff", id, d.name);
  } else {
    if (values.access !== "none" && !pin) return fail("Set a PIN so this person can sign in");
    const n = await nextNumber(db, "staff");
    const [row] = await db
      .insert(schema.staff)
      .values({ ...values, code: `S${String(n).padStart(2, "0")}` })
      .returning();
    await audit(db, user, "create", "staff", row.id, d.name);
  }
  revalidatePath("/staff");
  return ok({ id: id ?? 0 });
}
