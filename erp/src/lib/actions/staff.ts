"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
  // Sign-in (access / PIN) is managed only in Settings → Users; these are accepted but ignored here
  access: z.string().optional(),
  pin: z.string().optional(),
  /** Set after the user confirmed the "already exists" warning on Add staff. */
  allowDuplicate: z.boolean().optional(),
});
export type StaffInput = z.input<typeof StaffInput>;
const DUPLICATE_PREFIX = "DUPLICATE: ";

export async function saveStaff(input: StaffInput): Promise<Result<{ id: number }>> {
  const user = await requireUser({ can: "staff" });
  const parsed = StaffInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, pin, access, allowDuplicate, ownIncentivePct, ...d } = parsed.data;
  const db = await getDb();

  // Add staff: warn when the name (ignoring capitals/spaces) or the phone number is already in Staff
  if (!id && !allowDuplicate) {
    const digits = (d.phone ?? "").replace(/\D/g, "").slice(-10);
    const dupes = await db
      .select({ code: schema.staff.code, name: schema.staff.name, phone: schema.staff.phone })
      .from(schema.staff)
      .where(
        or(
          sql`lower(regexp_replace(trim(${schema.staff.name}), '[[:space:]]+', ' ', 'g')) = ${d.name.trim().toLowerCase().replace(/\s+/g, " ")}`,
          digits.length === 10 ? sql`right(regexp_replace(coalesce(${schema.staff.phone}, ''), '[^0-9]', '', 'g'), 10) = ${digits}` : sql`false`,
        ),
      );
    if (dupes.length) {
      const list = dupes.map((x) => `${x.code} ${x.name}${x.phone ? ` (${x.phone})` : ""}`).join(", ");
      return fail(`${DUPLICATE_PREFIX}Already in Staff: ${list}. Open that record instead, or add anyway if this is a different person.`);
    }
  }

  const values = {
    ...d,
    monthlySalary: d.monthlySalary ?? null,
    pieceRate: d.pieceRate ?? null,
    // entered as % (4) → stored as fraction (0.04), like the Excel
    ownIncentivePct: ownIncentivePct ? ownIncentivePct / 100 : null,
  };

  if (id) {
    const [existing] = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
    if (!existing) return fail("Not found");
    // never lock out the last owner (marking them "Left" would end their sign-in)
    if (existing.access === "owner" && values.status !== "Active") {
      const others = await db
        .select({ id: schema.staff.id })
        .from(schema.staff)
        .where(and(eq(schema.staff.access, "owner"), eq(schema.staff.status, "Active"), ne(schema.staff.id, id)));
      if (!others.length) return fail("At least one active Owner login is required");
    }
    await db.update(schema.staff).set(values).where(eq(schema.staff.id, id));
    await audit(db, user, "update", "staff", id, d.name);
  } else {
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
