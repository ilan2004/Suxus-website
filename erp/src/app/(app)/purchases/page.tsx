import { asc } from "drizzle-orm";
import { can } from "@/lib/permissions";
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
  const costs = can(session.role, "costs");
  const owed = costs ? balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance) : [];
  return (
    <>
      <PageHeader title="Purchases" ml="വാങ്ങൽ / സപ്ലയർ ബില്ലുകൾ" description={costs ? "Supplier bills with GST. Amount paid at purchase goes to the cash book; pay balances from Suppliers." : "What was bought from which supplier."} />
      <PurchasesView rows={costs ? rows : rows.map((r) => ({ ...r, rate: 0, taxable: 0, gstAmount: 0, total: 0, paid: 0 }))} showCosts={costs} suppliers={suppliers} modes={lists.paymentMode} owed={owed.map((o) => ({ id: o.id, name: o.name, balance: o.balance }))} canDelete={can(session.role, "delete")} />
    </>
  );
}
