"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { FabricSheet } from "../fabrics-view";
import type { FabricInput } from "@/lib/actions/fabrics";
import type { FabricRow } from "@/lib/queries";
import { cn, fmtDate, num, rupees } from "@/lib/utils";

type Line = { saleId: number; billNo: string; date: string; customerId: number | null; customer: string | null; metres: number; rate: number; amount: number; cancelled: boolean; orderId: number | null; soldBy: string | null };

export function FabricDetail({
  fabric: f,
  lines,
  supplier,
  suppliers,
  lists,
  compositions,
  lowStock,
  showCost,
}: {
  fabric: FabricRow;
  lines: Line[];
  supplier: { id: number; name: string } | null;
  suppliers: { id: number; name: string }[];
  lists: { fabricType: string[]; colourFamily: string[] };
  compositions: { name: string; prefix: string }[];
  lowStock: number;
  showCost: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<FabricInput | null>(null);
  const live = lines.filter((l) => !l.cancelled);
  const revenue = live.reduce((s, l) => s + l.amount, 0);
  const pct = f.purchaseMtr > 0 ? Math.max(0, Math.min(100, (f.balanceMtr / f.purchaseMtr) * 100)) : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fabrics" aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <p className="font-mono text-xs text-muted-foreground">{f.code}</p>
          <h1 className="font-display text-2xl font-semibold">
            {f.brand} {f.shade && <span className="text-muted-foreground">· {f.shade}</span>}
          </h1>
        </div>
        {!f.active && <Badge variant="outline">Inactive</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => window.open(`/print/labels?ids=${f.id}`, "_blank")}>
            <Tag /> Label
          </Button>
          <Button onClick={() => setEdit({ ...f, composition: f.composition ?? "Other" })}>
            <Pencil /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bought" ml="വാങ്ങിയത്" value={`${num(f.purchaseMtr)} m`} sub={fmtDate(f.purchaseDate) || undefined} />
        <StatCard label="Sold" ml="വിറ്റത്" value={`${num(f.soldMtr)} m`} sub={`${live.length} bill(s) · ${rupees(revenue)}`} tone="success" />
        <StatCard label="Balance" ml="ബാക്കി" value={`${num(f.balanceMtr)} m`} sub={`${Math.round(pct)}% left`} tone={f.balanceMtr <= lowStock ? "warning" : "default"} />
        <StatCard label="Sale rate" ml="റേറ്റ്" value={`${rupees(f.saleRate)}/m`} sub={showCost ? `Cost ${rupees(f.costPerMtr)}/m · stock value ${rupees(f.stockValue)}` : undefined} tone="gold" />
      </div>

      <div className="grid gap-x-8 gap-y-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-4">
        <Info label="Composition" value={f.composition} />
        <Info label="Type" value={f.type} />
        <Info label="Colour family" value={f.colourFamily} />
        <Info label="Barcode" value={f.barcode} />
        <Info label="Supplier" value={supplier ? <Link className="hover:underline" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link> : null} />
        <Info label="Remarks" value={f.remarks} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-medium">
          Sales of this fabric <span className="ml">ഈ തുണി വിറ്റ ബില്ലുകൾ</span>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Bill</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sold by</TableHead>
              <TableHead className="text-right">Metres</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  Not sold yet
                </TableCell>
              </TableRow>
            )}
            {lines.map((l, i) => (
              <TableRow key={i} className={cn("cursor-pointer", l.cancelled && "opacity-50")} onClick={() => router.push(`/sales/${l.saleId}`)}>
                <TableCell>{fmtDate(l.date)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {l.billNo} {l.cancelled && <Badge variant="destructive">Cancelled</Badge>} {l.orderId && <Badge variant="gold">Stitching</Badge>}
                </TableCell>
                <TableCell>
                  {l.customerId ? (
                    <Link href={`/customers/${l.customerId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {l.customer}
                    </Link>
                  ) : (
                    l.customer || <span className="text-muted-foreground">Walk-in</span>
                  )}
                </TableCell>
                <TableCell>{l.soldBy}</TableCell>
                <TableCell className="text-right tabular-nums">{num(l.metres)}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(l.rate)}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(l.amount, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {live.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>{live.length} bills</TableCell>
                <TableCell className="text-right tabular-nums">{num(live.reduce((s, l) => s + l.metres, 0))}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{rupees(revenue, true)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <FabricSheet value={edit} onClose={() => setEdit(null)} suppliers={suppliers} lists={lists} compositions={compositions} showCost={showCost} onSaved={() => router.refresh()} row={f} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value || "—"}</div>
    </div>
  );
}
