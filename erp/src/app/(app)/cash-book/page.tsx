import { isNotNull, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { cashBookRows } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { CashBookView } from "./cash-book-view";

export const metadata = { title: "Cash Book" };

export default async function CashBookPage() {
  const session = await requireUser();
  const db = await getDb();
  const [rows, lists, pays, supPays] = await Promise.all([
    cashBookRows(),
    getSetting("lists"),
    db
      .select({ id: schema.payments.id, orderId: schema.payments.orderId, bulkOrderId: schema.payments.bulkOrderId })
      .from(schema.payments)
      .where(or(isNotNull(schema.payments.orderId), isNotNull(schema.payments.bulkOrderId))),
    db.select({ id: schema.supplierPayments.id, supplierId: schema.supplierPayments.supplierId }).from(schema.supplierPayments),
  ]);
  const payMap = new Map(pays.map((p) => [p.id, p]));
  const supMap = new Map(supPays.map((p) => [p.id, p.supplierId]));
  const link = (source: string | null, id: number | null): string | null => {
    if (!source || id == null) return null;
    switch (source) {
      case "sale":
        return `/sales/${id}`;
      case "payment": {
        const p = payMap.get(id);
        return p?.orderId ? `/orders/${p.orderId}` : p?.bulkOrderId ? `/bulk/${p.bulkOrderId}` : null;
      }
      case "purchase":
        return "/purchases";
      case "supplier_payment":
        return supMap.get(id) ? `/suppliers/${supMap.get(id)}` : "/suppliers";
      case "wage":
      case "wage_payment":
        return "/wages";
      default:
        return null;
    }
  };
  return (
    <>
      <PageHeader
        title="Cash Book"
        ml="ദിവസേനയുള്ള ക്യാഷ് ബുക്ക്"
        description="Bills, order payments, purchases and wages are added automatically. Add rent, electricity, capital etc. by hand."
      />
      <CashBookView
        rows={rows.map((r) => ({ ...r, href: link(r.source, r.sourceId), createdAt: undefined, updatedAt: undefined }))}
        categories={lists.cashCategory}
        modes={lists.paymentMode}
        partners={lists.partner}
        canDelete={session.role === "partner"}
      />
    </>
  );
}
