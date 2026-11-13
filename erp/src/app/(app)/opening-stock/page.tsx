import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { AssetsView } from "./assets-view";

export const metadata = { title: "Opening Stock & Assets" };

export default async function OpeningStockPage() {
  await requireUser({ partner: true });
  const db = await getDb();
  const [rows, lists] = await Promise.all([db.select().from(schema.openingStock).orderBy(asc(schema.openingStock.id)), getSetting("lists")]);
  return (
    <>
      <PageHeader
        title="Opening Stock & Assets"
        ml="ബിസിനസ്സിലേക്ക് കൊണ്ടുവന്ന സ്റ്റോക്കും ആസ്തിയും"
        description="Machines, tables, shelves and stock each partner brought into the business, at today's fair value."
      />
      <AssetsView rows={rows.map((r) => ({ ...r, createdAt: undefined, updatedAt: undefined }))} lists={{ assetType: lists.assetType, partner: lists.partner }} />
    </>
  );
}
