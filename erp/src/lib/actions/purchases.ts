"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { postCash, removeCash } from "@/lib/cashbook";
import { round2 } from "@/lib/utils";
import { suppliersWithBalance } from "@/lib/queries";
import { linkSetupExpenses, tidySupplierNames } from "@/lib/supplier-link";
import { rememberDeleted } from "@/lib/import-tombstone";
import { fail, money, ok, optId, optText, reqDate, zodError, type Result } from "./util";

/* ───── Purchases (supplier bills) ───── */

const PurchaseInput = z.object({
  id: z.number().int().optional(),
  date: reqDate,
  supplierId: optId,
  supplierName: optText,
  invoiceNo: optText,
  description: optText,
  qty: money,
  rate: money,
  gstPct: z.coerce.number<number>().min(0).max(28).default(0),
  paid: money,
  paidMode: z.string().default("Cash"),
  remarks: optText,
});
export type PurchaseInput = z.input<typeof PurchaseInput>;

export async function savePurchase(input: PurchaseInput): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  const parsed = PurchaseInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, supplierName, paidMode, ...d } = parsed.data;
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    let supplierId = d.supplierId ?? null;
    if (!supplierId && supplierName) {
      const [s] = await tx.insert(schema.suppliers).values({ name: supplierName, type: "Fabric supplier" }).returning();
      supplierId = s.id;
    }
    if (!supplierId) throw new Error("Choose a supplier");
    const taxable = round2(d.qty * d.rate);
    const gstAmount = round2((taxable * d.gstPct) / 100);
    const total = round2(taxable + gstAmount);
    if (d.paid > total) throw new Error("Paid is more than the bill total");
    const values = { ...d, supplierId, taxable, gstAmount, total };
    let row;
    if (id) [row] = await tx.update(schema.purchases).set(values).where(eq(schema.purchases.id, id)).returning();
    else [row] = await tx.insert(schema.purchases).values(values).returning();
    const [sup] = await tx.select({ name: schema.suppliers.name }).from(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
    await postCash(tx, {
      source: "purchase",
      sourceId: row.id,
      date: d.date,
      particulars: `Purchase ${d.invoiceNo ?? ""} · ${sup?.name ?? ""}`.replace("  ", " "),
      category: "Fabric Purchase",
      amountOut: d.paid,
      mode: paidMode,
    });
    await audit(tx, user, id ? "update" : "create", "purchase", row.id, `${sup?.name} ₹${total}`);
    return { id: row.id };
  }).catch((e: Error) => e);
  if (res instanceof Error) return fail(res.message);
  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  return ok(res);
}

export async function deletePurchase(id: number): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  await rememberDeleted(db, "purchase", [id]);
  await db.delete(schema.purchases).where(eq(schema.purchases.id, id));
  await removeCash(db, "purchase", id);
  await audit(db, user, "delete", "purchase", id);
  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  return ok(null);
}

/* ───── Suppliers ───── */

const SupplierInput = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Name is required"),
  type: optText,
  place: optText,
  phone: optText,
  upi: optText,
  bank: optText,
  gstNo: optText,
  supplies: optText,
  aliases: optText,
  openingBalance: z.coerce.number<number>().min(0, "Opening balance cannot be negative").default(0),
  notes: optText,
});
export type SupplierInput = z.input<typeof SupplierInput>;

export async function saveSupplier(input: SupplierInput): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  const parsed = SupplierInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  let row;
  if (id) [row] = await db.update(schema.suppliers).set(d).where(eq(schema.suppliers.id, id)).returning();
  else [row] = await db.insert(schema.suppliers).values(d).returning();
  await linkSetupExpenses(db); // a new name / other name may match setup expenses that had no supplier
  await audit(db, user, id ? "update" : "create", "supplier", row.id, row.name);
  revalidatePath("/suppliers");
  return ok({ id: row.id });
}

export async function deleteSupplier(id: number): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  const used = await db.select({ id: schema.purchases.id }).from(schema.purchases).where(eq(schema.purchases.supplierId, id)).limit(1);
  if (used.length) return fail("This supplier has purchases, so it cannot be deleted.");
  const pays = await db.select({ id: schema.supplierPayments.id }).from(schema.supplierPayments).where(eq(schema.supplierPayments.supplierId, id));
  for (const p of pays) await removeCash(db, "supplier_payment", p.id);
  await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
  await audit(db, user, "delete", "supplier", id);
  revalidatePath("/suppliers");
  return ok(null);
}

const SupplierPay = z.object({
  supplierId: z.number().int().positive(),
  date: reqDate,
  amount: z.coerce.number<number>().positive("Amount must be more than 0"),
  mode: z.string().min(1),
  ref: optText,
  paidBy: z.string().default("Business Account"),
  note: optText,
});

async function balanceOf(id: number) {
  return (await suppliersWithBalance()).find((x) => x.id === id)?.balance ?? 0;
}

export type SupplierPaid = { id: number; name: string; amount: number; before: number; after: number };

export async function paySupplier(input: z.input<typeof SupplierPay>): Promise<Result<SupplierPaid>> {
  const user = await requireUser();
  const parsed = SupplierPay.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  const before = await balanceOf(d.supplierId);
  let paymentId = 0;
  let name = "";
  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(schema.suppliers).where(eq(schema.suppliers.id, d.supplierId));
    if (!s) throw new Error("Supplier not found");
    const [p] = await tx.insert(schema.supplierPayments).values(d).returning();
    paymentId = p.id;
    name = s.name;
    // Fabric suppliers → "Fabric Purchase"; shops / tradesmen for the setup → "Setup / Renovation"
    const [hasPurchases] = await tx.select({ id: schema.purchases.id }).from(schema.purchases).where(eq(schema.purchases.supplierId, d.supplierId)).limit(1);
    if (d.paidBy === "Business Account") {
      await postCash(tx, {
        source: "supplier_payment",
        sourceId: p.id,
        date: d.date,
        particulars: `Paid ${s?.name ?? "supplier"}${d.ref ? ` · ${d.ref}` : ""}${d.note ? ` · ${d.note}` : ""}`,
        category: hasPurchases ? "Fabric Purchase" : "Setup / Renovation",
        amountOut: d.amount,
        mode: d.mode,
      });
    }
    await audit(tx, user, "create", "supplier_payment", p.id, `${s?.name} ₹${d.amount}`);
  });
  revalidateSupplierPages(d.supplierId);
  return ok({ id: paymentId, name, amount: d.amount, before, after: await balanceOf(d.supplierId) });
}

function revalidateSupplierPages(supplierId?: number) {
  revalidatePath("/suppliers");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/purchases");
  revalidatePath("/cash-book");
  revalidatePath("/");
}

/** "Undo" right after saving — removes the payment as if it was never entered (no import tombstone). */
export async function undoSupplierPayment(id: number): Promise<Result<null>> {
  const user = await requireUser();
  const db = await getDb();
  const [p] = await db.select().from(schema.supplierPayments).where(eq(schema.supplierPayments.id, id));
  if (!p) return ok(null);
  if (Date.now() - new Date(p.createdAt).getTime() > 3 * 60_000) return fail("Too late to undo — delete it from the supplier's payment history.");
  await db.delete(schema.supplierPayments).where(eq(schema.supplierPayments.id, id));
  await removeCash(db, "supplier_payment", id);
  await audit(db, user, "delete", "supplier_payment", id, "undo");
  revalidateSupplierPages(p.supplierId);
  return ok(null);
}

export async function deleteSupplierPayment(id: number): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  await rememberDeleted(db, "supplier_payment", [id]);
  const [p] = await db.delete(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).returning();
  await removeCash(db, "supplier_payment", id);
  await audit(db, user, "delete", "supplier_payment", id);
  revalidateSupplierPages(p?.supplierId);
  return ok(null);
}

/** Tidies "(…)" notes out of supplier names and links setup expenses to suppliers by "Paid to". */
export async function relinkSuppliers(): Promise<Result<{ linked: number; unlinked: number; tidied: number }>> {
  const user = await requireUser({ can: "money" });
  const db = await getDb();
  const tidied = await tidySupplierNames(db);
  const r = await linkSetupExpenses(db);
  await audit(db, user, "update", "supplier", null, `relink: ${r.linked} linked, ${tidied} tidied`);
  revalidatePath("/suppliers");
  return ok({ ...r, tidied });
}
