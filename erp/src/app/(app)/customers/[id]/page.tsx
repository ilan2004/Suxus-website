import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { ordersWithBalance } from "@/lib/queries";
import { CustomerView } from "./customer-view";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!customer) notFound();
  const [orders, bills, measurements, lists] = await Promise.all([
    ordersWithBalance(eq(schema.orders.customerId, id)),
    db.select().from(schema.sales).where(eq(schema.sales.customerId, id)).orderBy(desc(schema.sales.id)),
    db.select().from(schema.measurements).where(eq(schema.measurements.customerId, id)).orderBy(desc(schema.measurements.date), desc(schema.measurements.id)),
    getSetting("lists"),
  ]);
  return (
    <CustomerView
      customer={customer}
      orders={orders}
      bills={bills.map((b) => ({ id: b.id, billNo: b.billNo, date: b.date, net: b.net, paymentMode: b.paymentMode, cancelled: b.cancelled, stitchingHere: b.stitchingHere }))}
      measurements={measurements}
      lists={{ customerType: lists.customerType, fit: lists.fit }}
      canDelete={session.role === "partner"}
    />
  );
}
