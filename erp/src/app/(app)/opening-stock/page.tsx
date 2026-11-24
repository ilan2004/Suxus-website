import { asc, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { AssetsView } from "./assets-view";

export const metadata = { title: "Opening Stock & Assets" };

export default async function OpeningStockPage() {
  await requireUser({ can: "money" });
  const db = await getDb();
  const [rows, lists, cloth] = await Promise.all([
    db.select().from(schema.openingStock).orderBy(asc(schema.openingStock.id)),
    getSetting("lists"),
    db
      .select({
        id: schema.fabrics.id,
        code: schema.fabrics.code,
        brand: schema.fabrics.brand,
        shade: schema.fabrics.shade,
        purchaseMtr: schema.fabrics.purchaseMtr,
        costPerMtr: schema.fabrics.costPerMtr,
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
