import { asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { SetupView } from "./setup-view";

export const metadata = { title: "Setup Expenses" };

export default async function SetupExpensesPage() {
  await requireUser({ can: "money" });
  const db = await getDb();
  const [rows, suppliers, lists] = await Promise.all([
    db.select().from(schema.setupExpenses).orderBy(desc(schema.setupExpenses.date), desc(schema.setupExpenses.id)),
    db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers).orderBy(asc(schema.suppliers.name)),
    getSetting("lists"),
  ]);
  return (
    <>
      <PageHeader
        title="Setup & Renovation"
        ml="ഷോപ്പ് ഒരുക്കാനുള്ള ചെലവുകൾ"
        description="Partition, ceiling, flooring, electrical, sign board, catalogues, supplier advances… 'Paid by' decides each partner's capital."
      />
      <SetupView
        rows={rows.map((r) => ({ ...r, createdAt: undefined, updatedAt: undefined }))}
        suppliers={suppliers}
        lists={{ setupCategory: lists.setupCategory, partner: lists.partner, paymentMode: lists.paymentMode }}
      />
    </>
  );
}
