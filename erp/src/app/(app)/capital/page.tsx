import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { capitalAccount } from "@/lib/reports";
import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupees } from "@/lib/utils";

export const metadata = { title: "Capital Account" };

const SHARE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export default async function CapitalPage() {
  await requireUser({ partner: true });
  const rows = await capitalAccount();
  const total = (k: "setup" | "stock" | "capital" | "total" | "withdrawn" | "net") => rows.reduce((s, r) => s + r[k], 0);
  const lines: { key: "setup" | "stock" | "capital"; en: string; ml: string; href: string }[] = [
    { key: "setup", en: "Cash spent on setup", ml: "ഒരുക്കാൻ ചെലവാക്കിയ പണം", href: "/setup-expenses" },
    { key: "stock", en: "Stock & assets brought in", ml: "കൊണ്ടുവന്ന സ്റ്റോക്കും ആസ്തിയും", href: "/opening-stock" },
    { key: "capital", en: "Capital introduced (cash book)", ml: "മുതൽമുടക്കായി ഇട്ട പണം", href: "/cash-book" },
  ];
  return (
    <>
      <PageHeader
        title="Capital Account"
        ml="പാർട്ണർ വിഹിതം (ഓട്ടോമാറ്റിക്)"
        description="Nothing to type here — built from Setup Expenses, Opening Stock and Capital Introduced in the Cash Book. Use it to agree the partnership ratio."
      />

      <div className="mb-5 rounded-xl border bg-card p-5">
        <p className="mb-3 text-sm font-medium">
          Share of total contribution <span className="ml">വിഹിതം</span>
        </p>
        <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg">
          {rows
            .filter((r) => r.share > 0)
            .map((r, i) => (
              <div
                key={r.name}
                className="flex items-center justify-center text-sm font-semibold text-white"
                style={{ width: `${r.share * 100}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }}
                title={`${r.name}: ${(r.share * 100).toFixed(1)}%`}
              >
                {r.share > 0.12 && `${(r.share * 100).toFixed(1)}%`}
              </div>
            ))}
          {total("total") === 0 && <div className="flex w-full items-center justify-center bg-muted text-sm text-muted-foreground">No contributions recorded yet</div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {rows.map((r, i) => (
            <span key={r.name} className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
              {r.name} — <strong>{(r.share * 100).toFixed(1)}%</strong> ({rupees(r.total)})
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                Category <span className="ml">വിഭാഗം</span>
              </TableHead>
              {rows.map((r) => (
                <TableHead key={r.name} className="text-right">
                  {r.name}
                </TableHead>
              ))}
              <TableHead className="text-right">Total · ആകെ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.key}>
                <TableCell>
                  <Link href={l.href} className="font-medium hover:underline">
                    {l.en}
                  </Link>
                  <span className="ml ml-2">{l.ml}</span>
                </TableCell>
                {rows.map((r) => (
                  <TableCell key={r.name} className="text-right tabular-nums">
                    {rupees(r[l.key])}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{rupees(total(l.key))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">TOTAL CONTRIBUTION · ആകെ വിഹിതം</TableCell>
              {rows.map((r) => (
                <TableCell key={r.name} className="text-right font-semibold tabular-nums">
                  {rupees(r.total)}
                </TableCell>
              ))}
              <TableCell className="text-right font-semibold tabular-nums">{rupees(total("total"))}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Share %</TableCell>
              {rows.map((r) => (
                <TableCell key={r.name} className="text-right tabular-nums">
                  {(r.share * 100).toFixed(2)}%
                </TableCell>
              ))}
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Less: owner withdrawals (cash book)</TableCell>
              {rows.map((r) => (
                <TableCell key={r.name} className="text-right tabular-nums text-muted-foreground">
                  {r.withdrawn ? `−${rupees(r.withdrawn)}` : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-muted-foreground">{total("withdrawn") ? `−${rupees(total("withdrawn"))}` : "—"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Net capital in business</TableCell>
              {rows.map((r) => (
                <TableCell key={r.name} className="text-right font-medium tabular-nums">
                  {rupees(r.net)}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">{rupees(total("net"))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Partners come from Settings → Dropdown lists → Partners. Setup paid from “Business Account” is not anyone&apos;s capital.
      </p>
    </>
  );
}
