import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fabricsWithStock } from "@/lib/queries";
import { FabricDetail } from "./fabric-detail";

export default async function FabricPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const id = Number((await params).id);
  const fabric = (await fabricsWithStock()).find((f) => f.id === id);
  if (!fabric) notFound();
  const db = await getDb();
  const s = schema;
  const [lines, settings, suppliers] = await Promise.all([
    db
      .select({
        saleId: s.sales.id,
        billNo: s.sales.billNo,
        date: s.sales.date,
        customerId: s.sales.customerId,
        customer: s.sales.customerName,
        metres: s.saleItems.metres,
        rate: s.saleItems.rate,
        amount: s.saleItems.amount,
        cancelled: s.sales.cancelled,
        orderId: s.sales.orderId,
        soldBy: s.staff.name,
      })
      .from(s.saleItems)
      .innerJoin(s.sales, eq(s.sales.id, s.saleItems.saleId))
      .leftJoin(s.staff, eq(s.staff.id, s.sales.soldById))
      .where(eq(s.saleItems.fabricId, id))
      .orderBy(desc(s.sales.date), desc(s.sales.id)),
    getSettings(),
    db.select({ id: s.suppliers.id, name: s.suppliers.name }).from(s.suppliers).orderBy(asc(s.suppliers.name)),
  ]);
  const supplier = suppliers.find((x) => x.id === fabric.supplierId) ?? null;
  return (
    <FabricDetail
      fabric={fabric}
      lines={lines}
      supplier={supplier}
      suppliers={suppliers}
      lists={{ fabricType: settings.lists.fabricType, colourFamily: settings.lists.colourFamily }}
      compositions={settings.compositions}
      lowStock={settings.shop.lowStockMtr}
      showCost={session.role === "partner"}
    />
  );
}
