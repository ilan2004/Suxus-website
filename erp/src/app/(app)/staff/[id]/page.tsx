import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { ArrowLeft, BadgePercent, HandCoins, Scissors, ShoppingBag } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { c } from "@/lib/db/sql";
import { requireUser } from "@/lib/auth";
import { incentiveFor } from "@/lib/reports";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, num, resolvePeriod, rupees } from "@/lib/utils";

export default async function StaffProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser({ can: "staff" });
  const id = Number((await params).id);
  const { from, to } = resolvePeriod(await searchParams);
  const db = await getDb();
  const s = schema;
  const [person] = await db.select().from(s.staff).where(eq(s.staff.id, id));
  if (!person) notFound();

  const [tailoring, brought, bulk, sold, wages, payouts, incentive] = await Promise.all([
    db
      .select({ id: s.orders.id, orderNo: s.orders.orderNo, date: s.orders.date, customer: s.orders.customerName, status: s.orders.status, total: s.orders.total, delivery: s.orders.deliveryDate })
      .from(s.orders)
      // Orders where this person has at least one item (tailor is per item)
      .where(and(sql`exists (select 1 from ${s.orderItems} where ${c(s.orderItems.orderId)} = ${c(s.orders.id)} and ${c(s.orderItems.tailorId)} = ${id})`, gte(s.orders.date, from), lte(s.orders.date, to)))
      .orderBy(desc(s.orders.date)),
    db
      .select({ id: s.orders.id, orderNo: s.orders.orderNo, date: s.orders.date, customer: s.orders.customerName, status: s.orders.status, total: s.orders.total })
      .from(s.orders)
      .where(and(eq(s.orders.broughtById, id), gte(s.orders.date, from), lte(s.orders.date, to), ne(s.orders.status, "Cancelled")))
      .orderBy(desc(s.orders.date)),
    db
      .select({ id: s.bulkOrders.id, orderNo: s.bulkOrders.orderNo, date: s.bulkOrders.date, customer: s.bulkOrders.institution, status: s.bulkOrders.status, total: s.bulkOrders.total })
      .from(s.bulkOrders)
      .where(and(eq(s.bulkOrders.broughtById, id), gte(s.bulkOrders.date, from), lte(s.bulkOrders.date, to), ne(s.bulkOrders.status, "Cancelled")))
      .orderBy(desc(s.bulkOrders.date)),
    db
      .select({ id: s.sales.id, billNo: s.sales.billNo, date: s.sales.date, customer: s.sales.customerName, net: s.sales.net, stitchingHere: s.sales.stitchingHere })
      .from(s.sales)
      .where(and(eq(s.sales.soldById, id), gte(s.sales.date, from), lte(s.sales.date, to), eq(s.sales.cancelled, false)))
      .orderBy(desc(s.sales.date)),
    db.select().from(s.tailorWages).where(eq(s.tailorWages.tailorId, id)).orderBy(desc(s.tailorWages.date)),
    db.select().from(s.wagePayments).where(eq(s.wagePayments.tailorId, id)).orderBy(desc(s.wagePayments.date)),
    incentiveFor(from, to).then((r) => r.find((x) => x.staffId === id) ?? null),
  ]);

  const inPeriod = (d: string) => d >= from && d <= to;
  const wagesPeriod = wages.filter((w) => inPeriod(w.date));
  const earnedAll = wages.reduce((a, w) => a + w.amount, 0);
  const paidAll = wages.reduce((a, w) => a + w.paid, 0) + payouts.reduce((a, p) => a + p.amount, 0);
  const orderIdByNo = new Map([...tailoring].map((o) => [o.orderNo, o.id]));

  return (
    <>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/staff">
            <ArrowLeft /> Staff
          </Link>
        </Button>
      </div>
      <PageHeader title={person.name} ml={person.role ?? undefined} description={[person.code, person.payType, person.phone].filter(Boolean).join(" · ")} />
      <div className="mb-5">
        <PeriodPicker from={from} to={to} presets={["month", "last", "year", "all"]} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders stitched" ml="തുന്നിയത്" value={tailoring.length} sub={`${wagesPeriod.reduce((a, w) => a + w.qty, 0)} pieces in wages`} icon={Scissors} />
        <StatCard label="Wages earned" ml="കൂലി" value={rupees(wagesPeriod.reduce((a, w) => a + w.amount, 0))} sub={`Balance due (all time) ${rupees(earnedAll - paidAll)}`} icon={HandCoins} tone={earnedAll - paidAll > 0 ? "warning" : "success"} href="/wages" />
        <StatCard label="Business brought" ml="കൊണ്ടുവന്നത്" value={rupees(incentive?.business ?? 0)} sub={`Collected ${rupees(incentive?.collected ?? 0)}`} icon={ShoppingBag} tone="gold" />
        <StatCard
          label="Incentive"
          ml="ഇൻസെന്റീവ്"
          value={rupees(incentive?.incentive ?? 0)}
          sub={incentive ? `${(incentive.rate * 100).toFixed(1)}%${incentive.eligible ? "" : " · not marked for incentive"}` : undefined}
          icon={BadgePercent}
          href={`/incentive?from=${from}&to=${to}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Stitching assigned" ml="തയ്യൽ" empty="No orders assigned in this period">
          {tailoring.map((o) => (
            <Row key={o.id} href={`/orders/${o.id}`} cells={[fmtDate(o.date), o.orderNo, o.customer, <StatusBadge key="s" status={o.status} />, rupees(o.total)]} />
          ))}
        </Section>
        <Section title="Orders brought" ml="ആര് കൊണ്ടുവന്നു" empty="No orders brought in this period">
          {[...brought.map((o) => ({ ...o, href: `/orders/${o.id}` })), ...bulk.map((o) => ({ ...o, href: `/bulk/${o.id}` }))].map((o) => (
            <Row key={o.href} href={o.href} cells={[fmtDate(o.date), o.orderNo, o.customer, <StatusBadge key="s" status={o.status} />, rupees(o.total)]} />
          ))}
        </Section>
        <Section title="Fabric sold" ml="വിറ്റ തുണി" empty="No fabric bills in this period">
          {sold.map((x) => (
            <Row key={x.id} href={`/sales/${x.id}`} cells={[fmtDate(x.date), x.billNo, x.customer ?? "Walk-in", x.stitchingHere ? "for stitching" : "", rupees(x.net)]} />
          ))}
        </Section>
        <Section title="Wage lines" ml="കൂലി" empty="No wage entries in this period">
          {wagesPeriod.map((w) => (
            <Row
              key={w.id}
              href={w.orderNo ? (orderIdByNo.get(w.orderNo) ? `/orders/${orderIdByNo.get(w.orderNo)}` : `/go/${w.orderNo}`) : "/wages"}
              cells={[fmtDate(w.date), w.orderNo ?? "—", `${w.qty} × ${w.item}`, `@ ${rupees(w.rate)}`, rupees(w.amount)]}
            />
          ))}
        </Section>
      </div>
      {payouts.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Last wage payout: {rupees(payouts[0].amount)} on {fmtDate(payouts[0].date)} · total paid {rupees(paidAll)} of {rupees(earnedAll)} earned ({num(wages.reduce((a, w) => a + w.qty, 0))} pcs all time)
        </p>
      )}
    </>
  );
}

function Section({ title, ml, empty, children }: { title: string; ml: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <p className="border-b px-4 py-3 text-sm font-medium">
        {title} <span className="ml">{ml}</span> <span className="text-muted-foreground">({children.length})</span>
      </p>
      <Table>
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>No.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {children.length ? (
            children
          ) : (
            <TableRow>
              <TableCell className="h-16 text-center text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function Row({ href, cells }: { href: string; cells: React.ReactNode[] }) {
  return (
    <TableRow>
      {cells.map((c, i) => (
        <TableCell key={i} className={i === cells.length - 1 ? "text-right tabular-nums" : i === 2 ? "max-w-48 truncate" : ""}>
          {i === 1 ? (
            <Link href={href} className="font-mono text-xs font-medium hover:underline">
              {c}
            </Link>
          ) : (
            c
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}
