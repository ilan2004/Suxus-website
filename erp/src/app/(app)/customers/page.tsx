import { desc, sql } from "drizzle-orm";
import { c } from "@/lib/db/sql";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import Link from "next/link";
import { ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { CustomersTable } from "./customers-table";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireUser();
  const db = await getDb();
  const { customers, orders, sales, payments } = schema;
  const rows = await db
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      phone: customers.phone,
      place: customers.place,
      type: customers.type,
      firstVisit: customers.firstVisit,
      orders: sql<number>`(select count(*) from ${orders} where ${c(orders.customerId)} = ${c(customers.id)})`.mapWith(Number),
      spent: sql<number>`coalesce((select sum(${c(sales.net)}) from ${sales} where ${c(sales.customerId)} = ${c(customers.id)} and ${c(sales.cancelled)} = false and ${c(sales.stitchingHere)} = false),0)
        + coalesce((select sum(${c(orders.total)}) from ${orders} where ${c(orders.customerId)} = ${c(customers.id)} and ${c(orders.status)} <> 'Cancelled'),0)`.mapWith(Number),
      due: sql<number>`coalesce((select sum(${c(orders.total)}) from ${orders} where ${c(orders.customerId)} = ${c(customers.id)} and ${c(orders.status)} <> 'Cancelled'),0)
        - coalesce((select sum(${c(payments.amount)}) from ${payments} join ${orders} o2 on o2.id = ${c(payments.orderId)} where o2.customer_id = ${c(customers.id)} and o2.status <> 'Cancelled'),0)`.mapWith(Number),
    })
    .from(customers)
    .orderBy(desc(customers.id));
  const lists = await getSetting("lists");
  const { new: openNew } = await searchParams;

  return (
    <>
      <PageHeader
        title="Customers"
        ml="കസ്റ്റമർ ലിസ്റ്റ്"
        description={`${rows.length} customers`}
        actions={
          <Button asChild variant="outline">
            <Link href="/customers/import">
              <ContactRound /> Import contacts <span className="ml">കോൺടാക്ട് ചേർക്കുക</span>
            </Link>
          </Button>
        }
      />
      <CustomersTable rows={rows} types={lists.customerType} openNew={openNew === "1"} />
    </>
  );
}
