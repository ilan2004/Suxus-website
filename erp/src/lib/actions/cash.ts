"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, money, ok, optText, reqDate, zodError, type Result } from "./util";
import { rememberDeleted } from "@/lib/import-tombstone";

const CashInput = z
  .object({
    id: z.number().int().optional(),
    date: reqDate,
    particulars: z.string().trim().min(1, "Write what this entry is for"),
    category: z.string().min(1, "Choose a category"),
    amountIn: money,
    amountOut: money,
    mode: z.string().default("Cash"),
    partner: optText,
    remarks: optText,
  })
  .refine((v) => (v.amountIn > 0) !== (v.amountOut > 0), { message: "Enter either money in or money out", path: ["amountIn"] })
  .refine((v) => !["Capital Introduced", "Owner Withdrawal"].includes(v.category) || !!v.partner, {
    message: "Choose the partner for capital / withdrawal",
    path: ["partner"],
  });
export type CashInput = z.input<typeof CashInput>;

/** Manual cash-book entries (rent, electricity, capital …). Automatic ones are edited at their source. */
export async function saveCashEntry(input: CashInput): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = CashInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  if (id) {
    const [row] = await db
      .update(schema.cashBook)
      .set(d)
      .where(and(eq(schema.cashBook.id, id), isNull(schema.cashBook.source)))
      .returning();
    if (!row) return fail("Automatic entries can only be changed from their bill / payment.");
  } else {
    await db.insert(schema.cashBook).values(d);
  }
  await audit(db, user, id ? "update" : "create", "cash_book", id ?? null, `${d.category} ${d.amountIn || -d.amountOut}`);
  revalidatePath("/cash-book");
  return ok(null);
}

export async function deleteCashEntry(id: number): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  await rememberDeleted(db, "cash_book", [id]);
  const [row] = await db
    .delete(schema.cashBook)
    .where(and(eq(schema.cashBook.id, id), isNull(schema.cashBook.source)))
    .returning();
  if (!row) return fail("Automatic entries are removed by deleting their bill / payment.");
  await audit(db, user, "delete", "cash_book", id, row.particulars);
  revalidatePath("/cash-book");
  return ok(null);
}
