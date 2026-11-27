import Link from "next/link";
import { Printer, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { features } from "@/lib/db/features";
import { tryonStats } from "@/lib/tryon-admin";
import { monthSpendInr } from "@/lib/tryon";
import { TryonControls } from "./controls";
import { TRYON_HEAD, TRYON_URL, tryonQrSvg } from "@/lib/tryon-qr";
import { PageHeader } from "@/components/app/page-header";
import { rupees } from "@/lib/utils";

export const metadata = { title: "Try-on" };

/** Settings > Try-on: the counter QR code (A4 and 60 × 40 mm label) and how the try-on is used. Partners only. */
export default async function TryonSettingsPage() {
  await requireUser({ can: "prices" });
  const feat = await features();
  const [shop, qr, stats, controls, spent] = await Promise.all([
    getSetting("shop"),
    tryonQrSvg(),
    feat.tryon ? tryonStats() : Promise.resolve(null),
    getSetting("tryon"),
    feat.tryon ? monthSpendInr() : Promise.resolve(0),
  ]);
  const tvLink = controls.displayToken ? `${TRYON_URL}/display?key=${controls.displayToken}` : null;
  return (
    <>
      <PageHeader
        title="Try-on"
        ml="ട്രൈ-ഓൺ"
        description="The fabric try-on customers open on their own phone. Print the QR for the counter and the fabric shelves."
        actions={
          <Link href="/settings/tryon/enquiries" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Users className="size-4" /> Try-on enquiries
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="grid content-start gap-4 rounded-xl border bg-card p-5 text-center">
          <div>
            <p className="font-display text-lg font-semibold tracking-[0.14em] text-primary">SUXUS HERITAGE TAILOR</p>
            <p className="font-ml text-base">{TRYON_HEAD.ml}</p>
            <p className="text-sm text-muted-foreground">{TRYON_HEAD.en}</p>
          </div>
          <div className="mx-auto w-64 rounded-lg border bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} data-testid="tryon-qr" />
          <p className="text-sm">{shop.phone}</p>
          <p className="text-xs break-all text-muted-foreground">{TRYON_URL}</p>
          <div className="grid grid-cols-2 gap-2">
            <a href="/print/tryon-qr" target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium hover:bg-accent">
              <Printer className="size-4" /> A4 poster
            </a>
            <a href="/print/tryon-label" target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium hover:bg-accent">
              <Printer className="size-4" /> 60 × 40 mm label
            </a>
          </div>
          <p className="text-xs text-muted-foreground">Print the A4 poster at 100% (actual size), not &quot;fit to page&quot;. The label prints on the TSC label printer like the fabric labels.</p>
        </section>

        <section className="grid content-start gap-4">
          <TryonControls
            value={{ enabled: controls.enabled, perDevice: controls.perDevice, shopPerDay: controls.shopPerDay, monthlyCapInr: controls.monthlyCapInr }}
            spentInr={spent}
            todayOk={stats?.today.ok ?? 0}
            tvLink={tvLink}
          />
          {!stats ? (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Usage appears here after the next database update.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="tryon-stats">
                <Stat label="Today" ml="ഇന്ന്" value={String(stats.today.ok)} sub={stats.today.failed ? `${stats.today.failed} failed` : "try-ons"} />
                <Stat label="This month" ml="ഈ മാസം" value={String(stats.month.ok)} sub={stats.month.failed ? `${stats.month.failed} failed` : "try-ons"} />
                <Stat label="Cost this month" ml="ചെലവ്" value={rupees(stats.month.costInr, true)} sub={`at ₹${stats.usdToInr} / US$`} />
                <Stat label="Average time" ml="സമയം" value={stats.month.avgMs ? `${Math.round(stats.month.avgMs / 1000)} s` : "—"} sub="per try-on" />
              </div>
              <div className="rounded-xl border bg-card">
                <p className="border-b px-4 py-3 font-medium">
                  Most-tried fabrics this month <span className="ml">കൂടുതൽ ട്രൈ ചെയ്ത തുണി</span>
                </p>
                {stats.top.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No try-ons yet this month.</p>
                ) : (
                  <ol className="divide-y text-sm">
                    {stats.top.map((f, i) => (
                      <li key={f.code + i} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="min-w-0 truncate">
                          <b className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</b>
                          <b>{f.code}</b> {f.name}
                        </span>
                        <span className="shrink-0 tabular-nums">{f.tries}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {stats.model && <p className="text-xs text-muted-foreground">Model: {stats.model}. Failed attempts are not counted against the limits. Photos are deleted after 7 days.</p>}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, ml, value, sub }: { label: string; ml: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">
        {label} <span className="ml">{ml}</span>
      </p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
