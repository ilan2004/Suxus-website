import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getOrderFull } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { OrderView } from "./order-view";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const session = await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const settings = await getSettings();
  const db = await getDb();
  const measurements = order.customerId
    ? await db.select().from(schema.measurements).where(eq(schema.measurements.customerId, order.customerId)).orderBy(desc(schema.measurements.date))
    : [];
  const { print } = await searchParams;
  return (
    <OrderView
      order={order}
      shop={settings.shop}
      statuses={settings.lists.status}
      paymentModes={settings.lists.paymentMode}
      measurements={measurements}
      fits={settings.lists.fit}
      customerTypes={settings.lists.customerType}
      autoPrint={print === "1"}
      isPartner={session.role === "partner"}
    />
  );
}
