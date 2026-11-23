import { and, asc, desc, eq, gte, inArray, isNotNull, like, sql } from "drizzle-orm";
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
  // What the "tailor per item" migration did (Owner, 30 days): orders migrated, wage total before and after
  const migrationNotes = can(session.role, "settings")
    ? await db
        .select({ summary: schema.auditLog.summary })
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.entity, "order"), like(schema.auditLog.summary, "Tailor per item%"), gte(schema.auditLog.at, new Date(Date.now() - 30 * 86400_000))))
        .orderBy(asc(schema.auditLog.id))
    : [];
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
    // Finished items with a tailor and no wage entry yet for that order + tailor (tailor is per item, so one
    // order can wait for several tailors). Grouped below into one entry per order and tailor.
    db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        date: orders.date,
        status: orders.status,
        customerName: orders.customerName,
        tailorId: orderItems.tailorId,
        item: orderItems.item,
        qty: orderItems.qty,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          isNotNull(orderItems.tailorId),
          inArray(orders.status, ["Ready", "Delivered"]),
          sql`not exists (select 1 from ${tailorWages} where ${c(tailorWages.orderNo)} = ${c(orders.orderNo)} and ${c(tailorWages.tailorId)} = ${c(orderItems.tailorId)})`,
        ),
      )
      .orderBy(desc(orders.id), asc(orderItems.id))
      .limit(300),
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
      {migrationNotes.length > 0 && (
        <div className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          {migrationNotes.map((n, i) => (
            <p key={i}>{n.summary}</p>
          ))}
        </div>
      )}
      <WagesView
        wages={wages.map((w) => ({ ...w.w, tailorName: w.tailorName }))}
        payments={pays.map((p) => ({ ...p.p, tailorName: p.tailorName }))}
        tailors={tailors}
        allStaff={people.filter((p) => p.status === "Active").map((p) => ({ id: p.id, name: p.name, pieceRate: p.pieceRate }))}
        pending={groupPending(pending).slice(0, 50)}
        items={settings.lists.item}
        rates={settings.pieceRates}
        modes={settings.lists.paymentMode}
        canDelete={can(session.role, "delete")}
      />
    </>
  );
}

type PendingLine = { id: number; orderNo: string; date: string; status: string; customerName: string | null; tailorId: number | null; item: string; qty: number };

/** One entry per order + tailor, with that tailor's items. */
function groupPending(lines: PendingLine[]) {
  const out: { id: number; orderNo: string; date: string; status: string; customerName: string | null; tailorId: number | null; items: { item: string; qty: number }[] }[] = [];
  for (const l of lines) {
    let g = out.find((x) => x.id === l.id && x.tailorId === l.tailorId);
    if (!g) out.push((g = { id: l.id, orderNo: l.orderNo, date: l.date, status: l.status, customerName: l.customerName, tailorId: l.tailorId, items: [] }));
    g.items.push({ item: l.item, qty: l.qty });
  }
  return out;
}
