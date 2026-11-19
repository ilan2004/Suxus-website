import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { c } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { WagesView } from "./wages-view";

export const metadata = { title: "Tailor Wages" };

export default async function WagesPage() {
  const session = await requireUser();
  const db = await getDb();
  const { tailorWages, wagePayments, staff, orders, orderItems } = schema;
  const settings = await getSettings();
  const [wages, pays, people, pending] = await Promise.all([
    db
      .select({ w: tailorWages, tailorName: staff.name })
      .from(tailorWages)
      .innerJoin(staff, eq(staff.id, tailorWages.tailorId))
      .orderBy(desc(tailorWages.date), desc(tailorWages.id)),
    db
      .select({ p: wagePayments, tailorName: staff.name })
      .from(wagePayments)
      .innerJoin(staff, eq(staff.id, wagePayments.tailorId))
      .orderBy(desc(wagePayments.date), desc(wagePayments.id)),
    db
      .select({ id: staff.id, name: staff.name, role: staff.role, pieceRate: staff.pieceRate, status: staff.status })
      .from(staff)
      .orderBy(asc(staff.code)),
    db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        date: orders.date,
        status: orders.status,
        customerName: orders.customerName,
        tailorId: orders.tailorId,
        items: sql<{ item: string; qty: number }[]>`coalesce((select json_agg(json_build_object('item', ${c(orderItems.item)}, 'qty', ${c(orderItems.qty)})) from ${orderItems} where ${c(orderItems.orderId)} = ${c(orders.id)}), '[]'::json)`,
      })
      .from(orders)
      .where(
        and(
          isNotNull(orders.tailorId),
          inArray(orders.status, ["Ready", "Delivered"]),
          sql`not exists (select 1 from ${tailorWages} where ${c(tailorWages.orderNo)} = ${c(orders.orderNo)})`,
        ),
      )
      .orderBy(desc(orders.id))
      .limit(50),
  ]);

  const tailors = people
    .filter((p) => p.status === "Active" && (p.role === "Tailor" || p.role === "Cutting Master" || wages.some((w) => w.w.tailorId === p.id)))
    .map((p) => {
      const mine = wages.filter((w) => w.w.tailorId === p.id);
      const earned = mine.reduce((s, w) => s + w.w.amount, 0);
      const paidRows = mine.reduce((s, w) => s + w.w.paid, 0);
      const paidLater = pays.filter((x) => x.p.tailorId === p.id).reduce((s, x) => s + x.p.amount, 0);
      return { id: p.id, name: p.name, role: p.role, pieceRate: p.pieceRate, earned, paid: paidRows + paidLater, balance: Math.round((earned - paidRows - paidLater) * 100) / 100 };
    });

  return (
    <>
      <PageHeader title="Tailor Wages" ml="തയ്യൽ കൂലി (പീസ് റേറ്റ്)" description="Pieces stitched × piece rate. Pay tailors from here — every payout goes to the cash book." />
      <WagesView
        wages={wages.map((w) => ({ ...w.w, tailorName: w.tailorName }))}
        payments={pays.map((p) => ({ ...p.p, tailorName: p.tailorName }))}
        tailors={tailors}
        allStaff={people.filter((p) => p.status === "Active").map((p) => ({ id: p.id, name: p.name, pieceRate: p.pieceRate }))}
        pending={pending}
        items={settings.lists.item}
        rates={settings.pieceRates}
        modes={settings.lists.paymentMode}
        canDelete={can(session.role, "delete")}
      />
    </>
  );
}
