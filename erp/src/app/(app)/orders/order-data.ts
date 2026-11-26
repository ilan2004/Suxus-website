import "server-only";
import { c } from "@/lib/db/sql";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { customerOptions, fabricsWithStock, staffOptions } from "@/lib/queries";
import { features } from "@/lib/db/features";
import { loadPrices } from "@/lib/actions/prices";
import type { LinkedSale } from "@/components/forms/order-form";

const itemsAgg = sql<string>`coalesce((select string_agg(${c(schema.saleItems.description)} || ' ' || ${c(schema.saleItems.metres)} || 'm', ', ') from ${schema.saleItems} where ${c(schema.saleItems.saleId)} = ${c(schema.sales.id)}),'')`;

const saleCols = {
  id: schema.sales.id,
  billNo: schema.sales.billNo,
  date: schema.sales.date,
  net: schema.sales.net,
  items: itemsAgg,
  customerId: schema.sales.customerId,
  customerName: schema.sales.customerName,
  phone: schema.sales.phone,
  // fabric and metres on the bill (fabric requirement: what this order's bill already set aside)
  fabrics: sql<{ fabricId: number | null; metres: number }[]>`coalesce((select json_agg(json_build_object('fabricId', ${c(schema.saleItems.fabricId)}, 'metres', ${c(schema.saleItems.metres)})) from ${schema.saleItems} where ${c(schema.saleItems.saleId)} = ${c(schema.sales.id)}), '[]'::json)`,
};

export async function loadOrderFormData(saleId?: number | null) {
  const db = await getDb();
  const [customers, staff, settings, unlinked, stock, feat, prices] = await Promise.all([
    customerOptions(),
    staffOptions(),
    getSettings(),
    db
      .select(saleCols)
      .from(schema.sales)
      .where(and(isNull(schema.sales.orderId), eq(schema.sales.cancelled, false)))
      .orderBy(desc(schema.sales.id))
      .limit(60),
    fabricsWithStock(),
    features(),
    loadPrices(),
  ]);
  let sale: LinkedSale | null = null;
  if (saleId) {
    [sale] = await db.select(saleCols).from(schema.sales).where(eq(schema.sales.id, saleId));
  }
  return {
    customers,
    staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role })),
    lists: {
      workType: settings.lists.workType,
      item: settings.lists.item,
      status: settings.lists.status,
      paymentMode: settings.lists.paymentMode,
      customerType: settings.lists.customerType,
    },
    unlinkedSales: unlinked as LinkedSale[],
    sale: sale ?? null,
    rates: settings.pieceRates,
    // Settings → Variants (null until the database has the variant column)
    variants: feat.variant ? settings.variants : null,
    // Stitching price list (null until the database has it): fills the charge when a garment is added
    prices: feat.prices ? prices : null,
    days: { normal: settings.shop.normalDays, express: settings.shop.expressDays },
    // Fabric requirement: the tables, the fabrics to choose from (with balance), and whether a garment can have a fabric
    fabricReq: {
      tables: settings.fabricRequirement,
      enabled: feat.itemFabric,
      fabrics: stock.filter((f) => f.active).map((f) => ({ id: f.id, code: f.code, name: [f.brand, f.shade].filter(Boolean).join(" · "), balance: f.balanceMtr })),
    },
  };
}
