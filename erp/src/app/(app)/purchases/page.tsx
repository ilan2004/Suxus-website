import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { purchasesList, suppliersWithBalance } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { PurchasesView } from "./purchases-view";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage() {
  const session = await requireUser();
  const db = await getDb();
  const [rows, suppliers, lists, balances] = await Promise.all([
    purchasesList(),
    db.select({ id: schema.suppliers.id, name: schema.suppliers.name, place: schema.suppliers.place }).from(schema.suppliers).orderBy(asc(schema.suppliers.name)),
    getSetting("lists"),
    suppliersWithBalance(),
  ]);
  const owed = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
  return (
    <>
      <PageHeader title="Purchases" ml="വാങ്ങൽ / സപ്ലയർ ബില്ലുകൾ" description="Supplier bills with GST. Amount paid at purchase goes to the cash book; pay balances from Suppliers." />
      <PurchasesView rows={rows} suppliers={suppliers} modes={lists.paymentMode} owed={owed.map((o) => ({ id: o.id, name: o.name, balance: o.balance }))} canDelete={session.role === "partner"} />
    </>
  );
}
