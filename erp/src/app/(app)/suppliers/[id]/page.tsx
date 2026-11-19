import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { desc, eq, ilike, isNull, and, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { purchasesList, suppliersWithBalance } from "@/lib/queries";
import { SupplierView } from "./supplier-view";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const id = Number((await params).id);
  const all = await suppliersWithBalance();
  const s = all.find((x) => x.id === id);
  if (!s) notFound();
  const db = await getDb();
  const [purchases, pays, setup, lists] = await Promise.all([
    purchasesList().then((r) => r.filter((p) => p.supplierId === id)),
    db.select().from(schema.supplierPayments).where(eq(schema.supplierPayments.supplierId, id)).orderBy(desc(schema.supplierPayments.date), desc(schema.supplierPayments.id)),
    db
      .select()
      .from(schema.setupExpenses)
      .where(or(eq(schema.setupExpenses.supplierId, id), and(isNull(schema.setupExpenses.supplierId), ilike(schema.setupExpenses.paidTo, `%${s.name.split("(")[0].trim()}%`))))
      .orderBy(desc(schema.setupExpenses.date)),
    getSetting("lists"),
  ]);
  return <SupplierView supplier={s} purchases={purchases} payments={pays} setup={setup} partners={lists.partner} isPartner={can(session.role, "delete")} />;
}
