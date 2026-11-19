import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Scale, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { summary } from "@/lib/reports";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";
import { cn, fmtDate, num, resolvePeriod, rupees } from "@/lib/utils";

export const metadata = { title: "Summary" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser({ can: "money" });
  const { from, to } = resolvePeriod(await searchParams);
  const s = await summary(from, to);
  const pendingIn = s.pending.stitching + s.pending.bulk;
  const pendingOut = s.pending.suppliers + s.pending.wages + s.pending.incentive;

  return (
    <div className="print:text-[11px]">
      <PageHeader
        title="Summary"
        ml="ചുരുക്കം"
        description={`${fmtDate(from)} → ${fmtDate(to)} · income and expenses for the period; pending, stock and capital as of today.`}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <PrintButton />
            <Button asChild variant="gold" size="sm">
              <a href={`/api/export?from=${from}&to=${to}`}>
                <Download /> Excel
              </a>
            </Button>
          </div>
        }
      />

      <div className="no-print mb-4">
        <PeriodPicker from={from} to={to} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total income" ml="ആകെ വരവ്" value={rupees(s.income.total)} icon={ArrowDownLeft} tone="success" />
        <StatCard label="Running expenses" ml="നടത്തിപ്പ് ചെലവ്" value={rupees(s.expenses.total)} icon={ArrowUpRight} tone="destructive" />
        <StatCard
          label="Surplus (income − expenses)"
          ml="മിച്ചം"
          value={rupees(s.surplus)}
          sub="Booking basis, before setup costs"
          icon={Scale}
          tone={s.surplus >= 0 ? "gold" : "destructive"}
        />
        <StatCard label="Cash book (in − out)" ml="പണം" value={rupees(s.cash.net)} sub={`In ${rupees(s.cash.in)} · Out ${rupees(s.cash.out)}`} icon={Wallet} href={`/cash-book?from=${from}&to=${to}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Income" ml="വരവ്">
          <Line label="Fabric sales" ml="തുണി വിൽപ്പന" value={s.income.fabricSales} note="excl. fabric for stitching here" href="/sales" />
          <Line label="Metres sold" ml="വിറ്റ മീറ്റർ" raw={`${num(s.income.metres)} m`} />
          <Line label="Stitching — shop fabric" ml="ഷോപ്പ് തുണി തയ്യൽ" value={s.income.shopStitch} href="/orders" />
          <Line label="Stitching — outside fabric" ml="പുറത്തെ തുണി തയ്യൽ" value={s.income.outsideStitch} href="/orders" />
          <Line label="Alteration" ml="ആൾട്ടറേഷൻ" value={s.income.alteration} href="/orders" />
          <Line label="Bulk / institution orders" ml="ബൾക്ക് ഓർഡർ" value={s.income.bulk} href="/bulk" />
          <Line label="TOTAL INCOME" ml="ആകെ വരവ്" value={s.income.total} total />
        </Section>

        <Section title="Running expenses" ml="നടത്തിപ്പ് ചെലവ്">
          <Line label="Fabric purchases" ml="തുണി വാങ്ങൽ" value={s.expenses.purchases} href="/purchases" />
          <Line label="Tailor wages" ml="തയ്യൽ കൂലി" value={s.expenses.wages} href="/wages" />
          <Line label="Incentive" ml="ഇൻസെന്റീവ്" value={s.expenses.incentive} href={`/incentive?from=${from}&to=${to}`} />
          <Line label="Other expenses (cash book)" ml="മറ്റ് ചെലവുകൾ" value={s.expenses.other} href={`/cash-book?from=${from}&to=${to}`} />
          {s.expenses.byCategory.map((c) => (
            <Line key={c.category} label={`— ${c.category}`} value={c.v} sub href={`/cash-book?from=${from}&to=${to}&category=${encodeURIComponent(c.category)}`} />
          ))}
          <Line label="TOTAL EXPENSES" ml="ആകെ ചെലവ്" value={s.expenses.total} total />
        </Section>

        <Section title="Pending (today)" ml="ബാക്കി">
          <Line label="Customer balance — stitching" ml="കസ്റ്റമർ ബാക്കി" value={s.pending.stitching} href="/orders?view=list&filter=balance" />
          <Line label="Customer balance — bulk" ml="ബൾക്ക് ബാക്കി" value={s.pending.bulk} href="/bulk" />
          <Line label="To collect" value={pendingIn} total />
          <Line label="Supplier balance" ml="സപ്ലയർക്ക് കൊടുക്കാനുള്ളത്" value={s.pending.suppliers} href="/suppliers" />
          <Line label="Tailor wage balance" ml="കൂലി ബാക്കി" value={s.pending.wages} href="/wages" />
          <Line label="Incentive balance" ml="ഇൻസെന്റീവ് ബാക്കി" value={s.pending.incentive} href="/incentive" />
          <Line label="To pay" value={pendingOut} total />
        </Section>

        <Section title="Stock, setup & capital" ml="സ്റ്റോക്കും മുതൽമുടക്കും">
          <Line label="Fabric balance metres" ml="ബാക്കി മീറ്റർ" raw={`${num(s.stock.metres)} m`} href="/fabrics" />
          <Line label="Fabric stock value (cost)" ml="സ്റ്റോക്ക് മൂല്യം" value={s.stock.value} href="/fabrics" />
          <Line label="Opening stock & assets" ml="കൊണ്ടുവന്ന ആസ്തി" value={s.stock.opening} href="/opening-stock" />
          <Line label="Total setup spend (all time)" ml="ആകെ ഒരുക്കൽ ചെലവ്" value={s.setup.total} href="/setup-expenses" />
          {s.setup.byPartner.map((p) => (
            <Line key={p.paidBy} label={`— ${p.paidBy}`} value={p.v} sub />
          ))}
          {s.capital.map((c) => (
            <Line key={c.name} label={`${c.name} share`} ml="വിഹിതം" raw={`${(c.share * 100).toFixed(1)}%  ·  ${rupees(c.total)}`} href="/capital" />
          ))}
        </Section>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Income counts orders by their order date (booking), like the Excel. Fabric sold for stitching here is inside the order total, so it is not counted twice.
        <Link href="/capital" className="ml-1 underline">
          Capital account →
        </Link>
      </p>
    </div>
  );
}

function Section({ title, ml, children }: { title: string; ml: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card break-inside-avoid">
      <h2 className="border-b bg-muted/40 px-4 py-2.5 font-display text-sm font-semibold tracking-wide uppercase">
        {title} <span className="ml normal-case">{ml}</span>
      </h2>
      <dl className="divide-y">{children}</dl>
    </section>
  );
}

function Line({ label, ml, value, raw, note, href, total, sub }: { label: string; ml?: string; value?: number; raw?: string; note?: string; href?: string; total?: boolean; sub?: boolean }) {
  const text = raw ?? rupees(value ?? 0);
  return (
    <div className={cn("flex items-baseline justify-between gap-4 px-4 py-2 text-sm", total && "bg-muted/30 font-semibold", sub && "py-1 pl-8 text-xs text-muted-foreground")}>
      <dt className="min-w-0">
        {href ? (
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
        {ml && <span className="ml ml-2">{ml}</span>}
        {note && <span className="ml-2 text-xs text-muted-foreground">({note})</span>}
      </dt>
      <dd className={cn("shrink-0 tabular-nums", total && "font-display text-base")}>{text}</dd>
    </div>
  );
}
