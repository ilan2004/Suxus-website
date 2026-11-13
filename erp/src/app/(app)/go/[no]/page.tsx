import { notFound, redirect } from "next/navigation";
import { eq, ilike } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Short link for any document number: /go/SO-0012, /go/FS-0040, /go/BO-0003, /go/LIN-001, /go/C-0005 */
export default async function Go({ params }: { params: Promise<{ no: string }> }) {
  await requireUser();
  const no = decodeURIComponent((await params).no).trim().toUpperCase();
  const db = await getDb();
  const s = schema;
  if (no.startsWith("SO-")) {
    const [o] = await db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.orderNo, no));
    if (o) redirect(`/orders/${o.id}`);
  } else if (no.startsWith("FS-")) {
    const [o] = await db.select({ id: s.sales.id }).from(s.sales).where(eq(s.sales.billNo, no));
    if (o) redirect(`/sales/${o.id}`);
  } else if (no.startsWith("BO-")) {
    const [o] = await db.select({ id: s.bulkOrders.id }).from(s.bulkOrders).where(eq(s.bulkOrders.orderNo, no));
    if (o) redirect(`/bulk/${o.id}`);
  } else if (no.startsWith("C-")) {
    const [o] = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.code, no));
    if (o) redirect(`/customers/${o.id}`);
  } else {
    const [f] = await db.select({ id: s.fabrics.id }).from(s.fabrics).where(ilike(s.fabrics.code, no));
    if (f) redirect(`/fabrics/${f.id}`);
  }
  notFound();
}
