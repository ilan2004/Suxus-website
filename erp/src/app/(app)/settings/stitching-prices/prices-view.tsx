"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveStitchingPrices } from "@/lib/actions/prices";
import { variantMl } from "@/lib/variants";
import { cn, rupees } from "@/lib/utils";

export type PriceLine = { garment: string; variant: string; customerRate: number | null; bulkRate: number | null; active: boolean; tailorRate: number | null; listed: boolean };
type Row = Omit<PriceLine, "customerRate" | "bulkRate"> & { customerRate: string; bulkRate: string };

const toRow = (l: PriceLine): Row => ({ ...l, customerRate: l.customerRate == null ? "" : String(l.customerRate), bulkRate: l.bulkRate == null ? "" : String(l.bulkRate) });
const n = (s: string) => (s.trim() === "" ? null : Number(s));

export function PricesView({ lines }: { lines: PriceLine[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(() => lines.map(toRow));
  const [pending, start] = React.useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(lines.map(toRow));
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // Totals over active rows that have a customer rate
  const priced = rows.filter((r) => r.active && n(r.customerRate) != null);
  const sum = (f: (r: Row) => number | null) => priced.reduce((s, r) => s + (f(r) ?? 0), 0);
  const totCustomer = sum((r) => n(r.customerRate));
  const totTailor = sum((r) => r.tailorRate);
  const totBulk = rows.filter((r) => r.active && n(r.bulkRate) != null).reduce((s, r) => s + (n(r.bulkRate) ?? 0), 0);

  const save = () =>
    start(async () => {
      const bad = rows.find((r) => [r.customerRate, r.bulkRate].some((v) => v.trim() !== "" && !(Number(v) >= 0)));
      if (bad) return void toast.error(`Check the rate for ${bad.garment}${bad.variant ? ` (${bad.variant})` : ""}`);
      const r = await saveStitchingPrices(rows.map((x) => ({ garment: x.garment, variant: x.variant, customerRate: n(x.customerRate), bulkRate: n(x.bulkRate), active: x.active })));
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.changed ? `Saved ${r.data.changed} price${r.data.changed === 1 ? "" : "s"}` : "Nothing changed");
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="prices-table">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-2">Garment</th>
                <th className="p-2">
                  Variant <span className="ml">തരം</span>
                </th>
                <th className="p-2 text-right">Customer rate (₹)</th>
                <th className="p-2 text-right">Bulk / institution (₹)</th>
                <th className="p-2 text-right">Tailor piece rate</th>
                <th className="p-2 text-right">Margin</th>
                <th className="p-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = n(r.customerRate);
                const margin = c != null && r.tailorRate != null ? c - r.tailorRate : null;
                return (
                  <tr key={`${r.garment}|${r.variant}`} className={cn("border-b last:border-0", !r.active && "opacity-50")}>
                    <td className="p-2 font-medium whitespace-nowrap">
                      {r.garment}
                      {!r.listed && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(not in the item list)</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {r.variant ? (
                        <>
                          {r.variant}
                          {variantMl(r.variant) !== r.variant && <span className="ml ml-1 text-xs">{variantMl(r.variant)}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Input aria-label={`Customer rate ${r.garment} ${r.variant}`} type="number" inputMode="decimal" min={0} step={10} className="ml-auto w-28 text-right" placeholder="not set" value={r.customerRate} onChange={(e) => set(i, { customerRate: e.target.value })} />
                    </td>
                    <td className="p-2">
                      <Input aria-label={`Bulk rate ${r.garment} ${r.variant}`} type="number" inputMode="decimal" min={0} step={10} className="ml-auto w-28 text-right" placeholder="optional" value={r.bulkRate} onChange={(e) => set(i, { bulkRate: e.target.value })} />
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.tailorRate != null ? rupees(r.tailorRate) : <span className="text-xs text-muted-foreground">not set</span>}</td>
                    <td className="p-2 text-right text-muted-foreground tabular-nums" data-testid="margin">
                      {margin != null ? rupees(margin) : "—"}
                    </td>
                    <td className="p-2 text-center">
                      <Switch aria-label={`Active ${r.garment} ${r.variant}`} checked={r.active} onCheckedChange={(v) => set(i, { active: v })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 font-medium">
              <tr>
                <td className="p-2" colSpan={2}>
                  Total <span className="text-xs font-normal text-muted-foreground">({priced.length} priced, active)</span>
                </td>
                <td className="p-2 text-right tabular-nums">{rupees(totCustomer)}</td>
                <td className="p-2 text-right tabular-nums">{totBulk ? rupees(totBulk) : "—"}</td>
                <td className="p-2 text-right tabular-nums">{rupees(totTailor)}</td>
                <td className="p-2 text-right text-muted-foreground tabular-nums" data-testid="margin-total">
                  {rupees(totCustomer - totTailor)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Margin = customer rate − tailor piece rate. The piece rate is read from <Link href="/wages" className="underline">Tailor Wages</Link> (Settings → Piece rates), not
          copied. Empty = not set: an order with that garment shows a warning instead of charging 0.
        </p>
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="animate-spin" />} Save prices
        </Button>
      </div>
    </div>
  );
}
