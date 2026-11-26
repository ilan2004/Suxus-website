import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { col, when } from "@/lib/db/ext";
import { features } from "@/lib/db/features";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { ordersWithBalance } from "@/lib/queries";
import { CustomerView } from "./customer-view";
import { listWearers } from "@/lib/actions/wearers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!customer) notFound();
  const hasWearers = (await features()).wearers;
  const [orders, bills, measurements, lists, messages, wearers] = await Promise.all([
    ordersWithBalance(eq(schema.orders.customerId, id)),
    db.select().from(schema.sales).where(eq(schema.sales.customerId, id)).orderBy(desc(schema.sales.id)),
    db
      .select({ ...getTableColumns(schema.measurements), wearerId: when(hasWearers, col.measurementWearer) })
      .from(schema.measurements)
      .where(eq(schema.measurements.customerId, id))
      .orderBy(desc(schema.measurements.date), desc(schema.measurements.id)),
    getSetting("lists"),
    db
      .select({
        id: schema.customerMessages.id,
        sentAt: schema.customerMessages.sentAt,
        templateName: schema.customerMessages.templateName,
        text: schema.customerMessages.text,
        phone: schema.customerMessages.phone,
        sentBy: schema.customerMessages.sentBy,
        orderNo: schema.orders.orderNo,
      })
      .from(schema.customerMessages)
      .leftJoin(schema.orders, eq(schema.orders.id, schema.customerMessages.orderId))
      .where(eq(schema.customerMessages.customerId, id))
      .orderBy(desc(schema.customerMessages.id)),
    listWearers(id),
  ]);
  return (
    <CustomerView
      customer={customer}
      orders={orders}
      bills={bills.map((b) => ({ id: b.id, billNo: b.billNo, date: b.date, net: b.net, paymentMode: b.paymentMode, cancelled: b.cancelled, stitchingHere: b.stitchingHere }))}
      measurements={measurements}
      wearers={wearers}
      messages={messages.map((m) => ({ ...m, sentAt: new Date(m.sentAt).toISOString() }))}
      lists={{ customerType: lists.customerType, fit: lists.fit }}
      canDelete={can(session.role, "delete")}
    />
  );
}
