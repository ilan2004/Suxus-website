import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getOrderFull } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { OrderView } from "./order-view";
import { jobSlipFileName, jobSlipPages, jobSlipToken } from "@/lib/job-slip";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const session = await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const settings = await getSettings();
  const db = await getDb();
  const measurements = order.customerId
    ? await db.select().from(schema.measurements).where(eq(schema.measurements.customerId, order.customerId)).orderBy(desc(schema.measurements.date))
    : [];
  const [last] = await db
    .select()
    .from(schema.orderStatusChanges)
    .where(eq(schema.orderStatusChanges.orderId, order.id))
    .orderBy(desc(schema.orderStatusChanges.id))
    .limit(1);
  const { print } = await searchParams;
  // Job slip PDF links (made once, kept): one per item, one for the whole order
  const pages = (await jobSlipPages(order.id)) ?? [];
  const slips = {
    order: { url: `/j/${await jobSlipToken(order.id, null)}`, fileName: pages.length ? jobSlipFileName(pages, true) : "" },
    items: Object.fromEntries(
      await Promise.all(pages.map(async (pg) => [pg.itemId, { url: `/j/${await jobSlipToken(order.id, pg.itemId)}`, fileName: jobSlipFileName([pg], false) }] as const)),
    ),
  };
  const slipLog = await db
    .select({ id: schema.jobSlipEvents.id, action: schema.jobSlipEvents.action, via: schema.jobSlipEvents.via, staffName: schema.jobSlipEvents.staffName, detail: schema.jobSlipEvents.detail, at: schema.jobSlipEvents.at })
    .from(schema.jobSlipEvents)
    .where(eq(schema.jobSlipEvents.orderId, order.id))
    .orderBy(desc(schema.jobSlipEvents.id))
    .limit(200);
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
      slips={slips}
      slipLog={slipLog.map((e) => ({ ...e, at: new Date(e.at).toISOString() }))}
      isPartner={can(session.role, "delete")}
      lastChange={last ? { from: last.fromStatus, to: last.toStatus, by: last.changedBy, at: new Date(last.changedAt).toISOString() } : null}
    />
  );
}
