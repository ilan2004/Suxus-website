import Link from "next/link";
import { c } from "@/lib/db/sql";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { AlertTriangle, CalendarClock, CircleDollarSign, Layers, PackageCheck, Plus, Scissors, ShoppingBag, Wallet } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { bulkList, fabricsWithStock, ordersWithBalance } from "@/lib/queries";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { IncomeChart } from "./income-chart";
import { addDays, fmtDate, num, rupees, today } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const session = await requireUser();
  const db = await getDb();
  const t = today();
  const from30 = addDays(t, -29);
  const { sales, payments, saleItems } = schema;

  const [orders, fabrics, shop, todaySales, dailySales, dailyPays, todayPays, pendingSales, bulk] = await Promise.all([
    ordersWithBalance(),
    fabricsWithStock(),
    getSetting("shop"),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        net: sql<number>`coalesce(sum(${c(sales.net)}),0)`.mapWith(Number),
        metres: sql<number>`coalesce(sum((select sum(${c(saleItems.metres)}) from ${saleItems} where ${c(saleItems.saleId)} = ${c(sales.id)})),0)`.mapWith(Number),
      })
      .from(sales)
      .where(and(eq(sales.date, t), eq(sales.cancelled, false))),
    db
      .select({ date: sales.date, amount: sql<number>`coalesce(sum(${c(sales.net)}),0)`.mapWith(Number) })
      .from(sales)
      .where(and(gte(sales.date, from30), eq(sales.cancelled, false), eq(sales.stitchingHere, false)))
      .groupBy(sales.date),
    db
      .select({ date: payments.date, amount: sql<number>`coalesce(sum(${c(payments.amount)}),0)`.mapWith(Number) })
      .from(payments)
      .where(gte(payments.date, from30))
      .groupBy(payments.date),
    db
      .select({ amount: sql<number>`coalesce(sum(${c(payments.amount)}),0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.date, t)),
    db
      .select({ id: sales.id, billNo: sales.billNo, customerName: sales.customerName })
      .from(sales)
      .where(and(eq(sales.stitchingHere, true), isNull(sales.orderId), eq(sales.cancelled, false))),
    bulkList(),
  ]);

  const open = orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status));
  const dueToday = open.filter((o) => o.deliveryDate === t);
  const overdue = open.filter((o) => o.deliveryDate && o.deliveryDate < t);
  const ready = open.filter((o) => o.status === "Ready");
  const pending =
    orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + Math.max(0, o.balance), 0) +
    bulk.filter((b) => b.status !== "Cancelled").reduce((s, b) => s + Math.max(0, b.balance), 0);
  const low = fabrics.filter((f) => f.active && f.balanceMtr <= shop.lowStockMtr).sort((a, b) => a.balanceMtr - b.balanceMtr);

  const series = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from30, i);
    const amount = (dailySales.find((r) => r.date === d)?.amount ?? 0) + (dailyPays.find((r) => r.date === d)?.amount ?? 0);
    return { date: d, label: fmtDate(d).slice(0, 5), amount };
  });
  const collectedToday = (todaySales[0]?.net ?? 0) + (todayPays[0]?.amount ?? 0);
  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date())}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {greeting}, {session.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/sales/new">
              <ShoppingBag /> New sale
            </Link>
          </Button>
          <Button asChild size="lg" variant="gold">
            <Link href="/orders/new">
              <Scissors /> New order
            </Link>
          </Button>
        </div>
      </div>

      {pendingSales.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-warning" />
          <span>
            {pendingSales.length} fabric bill(s) marked “stitching here” have no order yet:{" "}
            {pendingSales.slice(0, 5).map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link className="font-medium underline" href={`/orders/new?sale=${s.id}`}>
                  {s.billNo}
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected today" ml="ഇന്നത്തെ വരവ്" value={rupees(collectedToday)} sub="Fabric bills + order payments" icon={Wallet} tone="success" href={`/cash-book?from=${t}&to=${t}`} />
        <StatCard label="Fabric sold today" ml="ഇന്ന് വിറ്റത്" value={`${num(todaySales[0]?.metres ?? 0)} m`} sub={`${todaySales[0]?.count ?? 0} bills · ${rupees(todaySales[0]?.net ?? 0)}`} icon={ShoppingBag} href="/sales?range=today" />
        <StatCard label="Open orders" ml="നടക്കുന്ന ഓർഡർ" value={open.length} sub={`${dueToday.length} due today · ${overdue.length} overdue`} icon={Scissors} tone={overdue.length ? "destructive" : "gold"} href={overdue.length ? "/orders?filter=overdue" : "/orders"} />
        <StatCard label="Balance to collect" ml="കിട്ടാനുള്ളത്" value={rupees(pending)} sub={`Orders + bulk · ${ready.length} ready to deliver`} icon={CircleDollarSign} tone="warning" href="/orders?view=list&filter=balance" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              Daily income · last 30 days <span className="ml">വരവ്</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Fabric bills (not for stitching) + payments received on stitching & bulk orders</p>
          </CardHeader>
          <CardContent>
            <IncomeChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Deliveries <span className="ml">ഡെലിവറി</span>
            </CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/orders">All orders</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-1">
            {[...overdue, ...dueToday, ...ready.filter((o) => !dueToday.includes(o) && !overdue.includes(o))].slice(0, 8).map((o) => {
              const late = o.deliveryDate && o.deliveryDate < t;
              return (
                <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${late ? "bg-destructive/15 text-destructive" : o.status === "Ready" ? "bg-gold/20 text-[#8a6a2a] dark:text-gold" : "bg-warning/15 text-warning"}`}>
                    {o.status === "Ready" ? <PackageCheck className="size-4" /> : <CalendarClock className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.customerName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.orderNo} · {o.items}
                    </span>
                  </span>
                  <span className="text-right">
                    <StatusBadge status={o.status} />
                    <span className={`mt-0.5 block text-[11px] ${late ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {late ? `Late · ${fmtDate(o.deliveryDate)}` : o.deliveryDate === t ? "Today" : fmtDate(o.deliveryDate)}
                    </span>
                  </span>
                </Link>
              );
            })}
            {overdue.length + dueToday.length + ready.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing due today 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Low stock <span className="ml">സ്റ്റോക്ക് കുറവ്</span>
            </CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/fabrics">Fabric stock</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-1">
            {low.slice(0, 6).map((f) => (
              <Link key={f.id} href={`/fabrics/${f.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <AlertTriangle className="size-4 text-warning" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{f.code}</span> {f.brand} {f.shade}
                </span>
                <span className="text-sm font-semibold tabular-nums text-warning">{num(f.balanceMtr)} m</span>
              </Link>
            ))}
            {!low.length && (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Layers className="size-4" /> {fabrics.length ? "All fabrics have enough stock." : "No fabrics added yet."}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { href: "/sales/new", label: "Fabric sale", ml: "തുണി ബിൽ", icon: ShoppingBag },
              { href: "/orders/new", label: "Stitching order", ml: "തയ്യൽ ഓർഡർ", icon: Scissors },
              { href: "/customers?new=1", label: "Customer", ml: "കസ്റ്റമർ", icon: Plus },
              { href: "/fabrics", label: "Add fabric", ml: "തുണി ചേർക്കുക", icon: Layers },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
                <a.icon className="size-5 text-primary" />
                <span className="leading-tight">
                  <span className="block text-sm font-medium">{a.label}</span>
                  <span className="ml">{a.ml}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
