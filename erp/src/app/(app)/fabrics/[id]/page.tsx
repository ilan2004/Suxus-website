import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fabricsWithStock, withoutFabricCosts } from "@/lib/queries";
import { FabricDetail } from "./fabric-detail";
import { storageMode } from "@/lib/storage";

export default async function FabricPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const id = Number((await params).id);
  const all = await fabricsWithStock();
  const fabric = (can(session.role, "costs") ? all : withoutFabricCosts(all)).find((f) => f.id === id);
  if (!fabric) notFound();
  const db = await getDb();
  const s = schema;
  // Add stock / Adjust stock and the stock history appear once the database has them
  const { stock } = await features();
  const [lines, settings, suppliers, moves] = await Promise.all([
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
    !stock ? Promise.resolve([]) : db
      .select({
        id: s.fabricStockMoves.id,
        kind: s.fabricStockMoves.kind,
        date: s.fabricStockMoves.date,
        metres: s.fabricStockMoves.metres,
        rate: s.fabricStockMoves.rate,
        supplier: s.suppliers.name,
        supplierId: s.fabricStockMoves.supplierId,
        billNo: s.fabricStockMoves.billNo,
        remarks: s.fabricStockMoves.remarks,
        boughtAfter: s.fabricStockMoves.boughtAfter,
        balanceAfter: s.fabricStockMoves.balanceAfter,
        rateBefore: s.fabricStockMoves.rateBefore,
        rateAfter: s.fabricStockMoves.rateAfter,
        createdBy: s.fabricStockMoves.createdBy,
      })
      .from(s.fabricStockMoves)
      .leftJoin(s.suppliers, eq(s.suppliers.id, s.fabricStockMoves.supplierId))
      .where(eq(s.fabricStockMoves.fabricId, id))
      .orderBy(asc(s.fabricStockMoves.id)),
  ]);
  const seesCost = can(session.role, "costs");
  const supplier = suppliers.find((x) => x.id === fabric.supplierId) ?? null;
  return (
    <FabricDetail
      fabric={fabric}
      lines={lines}
      moves={seesCost ? moves : moves.map((m) => ({ ...m, rate: null, rateBefore: null, rateAfter: null }))}
      canAdjust={can(session.role, "delete")}
      stockEnabled={stock}
      supplier={supplier}
      suppliers={suppliers}
      lists={{ fabricType: settings.lists.fabricType, colourFamily: settings.lists.colourFamily, partner: settings.lists.partner }}
      compositions={settings.compositions}
      lowStock={settings.shop.lowStockMtr}
      showCost={can(session.role, "costs")}
      photosEnabled={storageMode() !== "off"}
      shopName={`${settings.shop.name} ${settings.shop.tagline}`.trim()}
    />
  );
}
