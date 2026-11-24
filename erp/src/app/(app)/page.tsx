import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, KanbanSquare, CircleDollarSign, Layers, PackageCheck, Plus, Scissors, ShoppingBag, Wallet } from "lucide-react";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { SupplierDuesList } from "@/components/app/supplier-dues";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { CardBoundary, CardFailed } from "@/components/app/card-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { IncomeChart } from "./income-chart";
import { addDays, fmtDate, num, rupees, today } from "@/lib/utils";
import { loadBulk, loadDues, loadFabrics, loadIncome, loadLists, loadOrders, loadPendingSales, loadShop, loadToday } from "./dashboard-data";

export const metadata = { title: "Dashboard" };

/**
 * The Dashboard is built from independent cards. Each one loads its own data (shared loaders run once per
 * request), shows a placeholder while it loads, and if it fails it shows "couldn't load" on its own — the
 * rest of the page still appears. Failures are logged with the card's name ("[dashboard] …") for the server logs.
 */
export default async function Dashboard() {
  const session = await requireUser();
  // Simple measurement mode: the app opens on Measurements (also when reopened from the home screen)
  if (session.simple) redirect("/measurements");
  const t = today();
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

      <Section name="Bills waiting for an order" fallback={null}>
        <PendingSalesBanner />
      </Section>

      <Section name="Order board strip" fallback={<Skeleton className="h-11 rounded-xl" />}>
        <OrderStrip t={t} />
      </Section>

      <Section name="Today's figures" fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}>
        <StatCards t={t} />
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section name="Daily income" fallback={<Skeleton className="h-80 rounded-xl" />}>
          <IncomeCard t={t} />
        </Section>
        <Section name="Deliveries" fallback={<Skeleton className="h-80 rounded-xl" />}>
          <DeliveriesCard t={t} />
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section name="Low stock" fallback={<Skeleton className="h-56 rounded-xl" />}>
          <LowStockCard />
        </Section>
        <QuickActions />
      </div>

      {can(session.role, "money") && (
        <Section name="Balance to pay suppliers" fallback={<Skeleton className="h-48 rounded-xl" />}>
          <SupplierDuesCard t={t} />
        </Section>
      )}
    </div>
  );
}

/** Error boundary + loading placeholder around one card. */
function Section({ name, fallback, children }: { name: string; fallback: React.ReactNode; children: React.ReactNode }) {
  return (
    <CardBoundary name={name}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </CardBoundary>
  );
}

/** Runs a card's data loading; on failure logs it with the card name and returns null so the card shows "couldn't load". */
async function attempt<T>(name: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (e) {
    console.error(`[dashboard] card "${name}" failed to load:`, e);
    return null;
  }
}

async function PendingSalesBanner() {
  const pendingSales = await attempt("Bills waiting for an order", loadPendingSales);
  if (!pendingSales?.length) return null;
  return (
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
  );
}

function splitOrders(orders: Awaited<ReturnType<typeof loadOrders>>, t: string) {
  const open = orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status));
  return {
    open,
    dueToday: open.filter((o) => o.deliveryDate === t),
    overdue: open.filter((o) => o.deliveryDate && o.deliveryDate < t),
    ready: open.filter((o) => o.status === "Ready"),
  };
}

async function OrderStrip({ t }: { t: string }) {
  const orders = await attempt("Order board strip", loadOrders);
  if (!orders) return <CardFailed name="Order board strip" />;
  const { dueToday, overdue } = splitOrders(orders, t);
  return (
    <div className="flex overflow-hidden rounded-xl border bg-card text-sm">
      <Link href="/orders/board?due=today" className="flex flex-1 items-center gap-2 px-4 py-2.5 hover:bg-muted/60">
        <CalendarClock className={dueToday.length ? "size-4 text-warning" : "size-4 text-muted-foreground"} />
        <span>
          Delivering today: <b className="tabular-nums">{dueToday.length}</b>
        </span>
      </Link>
      <Link href="/orders/board?due=late" className="flex flex-1 items-center gap-2 border-l px-4 py-2.5 hover:bg-muted/60">
        <AlertTriangle className={overdue.length ? "size-4 text-destructive" : "size-4 text-muted-foreground"} />
        <span className={overdue.length ? "font-medium text-destructive" : undefined}>
          Late: <b className="tabular-nums">{overdue.length}</b>
        </span>
      </Link>
      <Link href="/orders/board" className="hidden items-center gap-1.5 border-l px-4 py-2.5 text-muted-foreground hover:bg-muted/60 sm:flex">
        <KanbanSquare className="size-4" /> Order board
      </Link>
    </div>
  );
}

async function StatCards({ t }: { t: string }) {
  const data = await attempt("Today's figures", () => Promise.all([loadOrders(), loadBulk(), loadToday()]));
  if (!data) return <CardFailed name="Today's figures" />;
  const [orders, bulk, todays] = data;
  const { open, dueToday, overdue, ready } = splitOrders(orders, t);
  const pending =
    orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + Math.max(0, o.balance), 0) +
    bulk.filter((b) => b.status !== "Cancelled").reduce((s, b) => s + Math.max(0, b.balance), 0);
  const collectedToday = todays.salesNet + todays.paysToday;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Collected today" ml="ഇന്നത്തെ വരവ്" value={rupees(collectedToday)} sub="Fabric bills + order payments" icon={Wallet} tone="success" href={`/cash-book?from=${t}&to=${t}`} />
      <StatCard label="Fabric sold today" ml="ഇന്ന് വിറ്റത്" value={`${num(todays.metres)} m`} sub={`${todays.bills} bills · ${rupees(todays.salesNet)}`} icon={ShoppingBag} href="/sales?range=today" />
      <StatCard label="Open orders" ml="നടക്കുന്ന ഓർഡർ" value={open.length} sub={`${dueToday.length} due today · ${overdue.length} overdue`} icon={Scissors} tone={overdue.length ? "destructive" : "gold"} href={overdue.length ? "/orders?filter=overdue" : "/orders"} />
      <StatCard label="Balance to collect" ml="കിട്ടാനുള്ളത്" value={rupees(pending)} sub={`Orders + bulk · ${ready.length} ready to deliver`} icon={CircleDollarSign} tone="warning" href="/orders?view=list&filter=balance" />
    </div>
  );
}

async function IncomeCard({ t }: { t: string }) {
  const income = await attempt("Daily income", () => loadIncome(t));
  if (!income) return <CardFailed name="Daily income" className="h-full" />;
  const from30 = addDays(t, -29);
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from30, i);
    const amount = (income.sales.find((r) => r.date === d)?.amount ?? 0) + (income.pays.find((r) => r.date === d)?.amount ?? 0);
    return { date: d, label: fmtDate(d).slice(0, 5), amount };
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Daily income · last 30 days <span className="ml">വരവ്</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Fabric bills (not for stitching) + payments received on stitching & bulk orders</p>
      </CardHeader>
      <CardContent>
        <CardBoundary name="Daily income chart">
          <IncomeChart data={series} />
        </CardBoundary>
      </CardContent>
    </Card>
  );
}

async function DeliveriesCard({ t }: { t: string }) {
  const orders = await attempt("Deliveries", loadOrders);
  if (!orders) return <CardFailed name="Deliveries" className="h-full" />;
  const { dueToday, overdue, ready } = splitOrders(orders, t);
  return (
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
        {overdue.length + dueToday.length + ready.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing due today 🎉</p>}
      </CardContent>
    </Card>
  );
}

async function LowStockCard() {
  const data = await attempt("Low stock", () => Promise.all([loadFabrics(), loadShop()]));
  if (!data) return <CardFailed name="Low stock" className="h-full" />;
  const [fabrics, shop] = data;
  const low = fabrics.filter((f) => f.active && f.balanceMtr <= shop.lowStockMtr).sort((a, b) => a.balanceMtr - b.balanceMtr);
  return (
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
  );
}

function QuickActions() {
  return (
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
  );
}

async function SupplierDuesCard({ t }: { t: string }) {
  const data = await attempt("Balance to pay suppliers", () => Promise.all([loadDues(), loadLists()]));
  if (!data) return <CardFailed name="Balance to pay suppliers" />;
  const [dues, lists] = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-ml">കൊടുക്കാനുള്ളത്</CardTitle>
        <p className="text-sm text-muted-foreground">Balance to pay suppliers · largest first</p>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/suppliers">Suppliers</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <CardBoundary name="Balance to pay suppliers">
          <SupplierDuesList rows={dues.rows} total={dues.total} today={t} payers={["Business Account", ...lists.partner.filter((p) => p !== "Business Account")]} />
        </CardBoundary>
      </CardContent>
    </Card>
  );
}
