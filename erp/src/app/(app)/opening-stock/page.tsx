import { asc, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { AssetsView } from "./assets-view";

export const metadata = { title: "Opening Stock & Assets" };

export default async function OpeningStockPage() {
  await requireUser({ can: "money" });
  const db = await getDb();
  const { stock } = await features();
  const [rows, lists, cloth] = await Promise.all([
    db.select().from(schema.openingStock).orderBy(asc(schema.openingStock.id)),
    getSetting("lists"),
    db
      .select({
        id: schema.fabrics.id,
        code: schema.fabrics.code,
        brand: schema.fabrics.brand,
        shade: schema.fabrics.shade,
        // the first entry — stock added later is a business purchase, not the partner's
        purchaseMtr: (stock ? sql<number>`coalesce("fabrics"."opening_mtr", "fabrics"."purchase_mtr")` : sql<number>`"fabrics"."purchase_mtr"`).mapWith(Number),
        costPerMtr: (stock ? sql<number>`coalesce("fabrics"."opening_cost_per_mtr", "fabrics"."cost_per_mtr")` : sql<number>`"fabrics"."cost_per_mtr"`).mapWith(Number),
        broughtInBy: schema.fabrics.broughtInBy,
        purchaseDate: schema.fabrics.purchaseDate,
        thumb: schema.fabrics.thumbnailUrl,
      })
      .from(schema.fabrics)
      .where(isNotNull(schema.fabrics.broughtInBy))
      .orderBy(asc(schema.fabrics.code)),
  ]);
  return (
    <>
      <PageHeader
        title="Opening Stock & Assets"
        ml="ബിസിനസ്സിലേക്ക് കൊണ്ടുവന്ന സ്റ്റോക്കും ആസ്തിയും"
        description="Machines, tables, shelves and stock each partner brought into the business, at today's fair value."
      />
      <AssetsView rows={rows.map((r) => ({ ...r, createdAt: undefined, updatedAt: undefined }))} lists={{ assetType: lists.assetType, partner: lists.partner }} cloth={cloth.map((c) => ({ ...c, broughtInBy: c.broughtInBy! }))} />
    </>
  );
}
