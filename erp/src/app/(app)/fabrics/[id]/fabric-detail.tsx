"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle, Pencil, Plus, SlidersHorizontal, Tag, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PhotoGallery } from "@/components/app/photo-gallery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { fabricToInput, FabricSheet } from "../fabrics-view";
import type { FabricInput } from "@/lib/actions/fabrics";
import type { FabricRow } from "@/lib/queries";
import { cn, fmtDate, num, round2, rupees } from "@/lib/utils";
import { StockDialog, mtr } from "@/components/forms/stock-dialogs";
import { undoStockMove } from "@/lib/actions/fabric-stock";

export type StockMove = {
  id: number;
  kind: string;
  date: string;
  metres: number;
  rate: number | null;
  supplier: string | null;
  supplierId: number | null;
  billNo: string | null;
  remarks: string | null;
  boughtAfter: number;
  balanceAfter: number;
  rateBefore: number | null;
  rateAfter: number | null;
  createdBy: string | null;
};

type Line = { saleId: number; billNo: string; date: string; customerId: number | null; customer: string | null; metres: number; rate: number; amount: number; cancelled: boolean; orderId: number | null; soldBy: string | null };

export function FabricDetail({
  fabric: f,
  lines,
  moves,
  canAdjust,
  supplier,
  suppliers,
  lists,
  compositions,
  lowStock,
  showCost,
  photosEnabled,
  shopName,
}: {
  photosEnabled: boolean;
  shopName: string;
  fabric: FabricRow;
  lines: Line[];
  moves: StockMove[];
  /** Owner / Partner: corrections (Adjust stock) and undoing older entries. */
  canAdjust: boolean;
  supplier: { id: number; name: string } | null;
  suppliers: { id: number; name: string }[];
  lists: { fabricType: string[]; colourFamily: string[]; partner: string[] };
  compositions: { name: string; prefix: string }[];
  lowStock: number;
  showCost: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<FabricInput | null>(null);
  const [sharing, setSharing] = React.useState(false);
  const [stock, setStock] = React.useState<"add" | "adjust" | null>(null);

  /** Shares the main photo + name, shade and rate. Uses the phone's share sheet (WhatsApp) when it can send files. */
  const share = async () => {
    const text = [`*${f.brand}*${f.shade ? ` — ${f.shade}` : ""}`, `Code ${f.code} · ₹${num(f.saleRate)} per metre`, shopName].join("\n");
    const main = f.photoUrls?.[0];
    setSharing(true);
    try {
      if (main && navigator.canShare) {
        const abs = new URL(main, window.location.origin).toString();
        const blob = await (await fetch(abs)).blob();
        const file = new File([blob], `${f.code}.${blob.type.includes("webp") ? "webp" : "jpg"}`, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      }
      const link = main ? `\n${new URL(main, window.location.origin).toString()}` : "";
      window.open(`https://wa.me/?text=${encodeURIComponent(text + link)}`, "_blank");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Could not share — try again");
    } finally {
      setSharing(false);
    }
  };
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={share} disabled={sharing}>
            {sharing ? <Loader2 className="animate-spin" /> : <MessageCircle className="text-success" />} Share on WhatsApp
          </Button>
          <Button variant="outline" onClick={() => window.open(`/print/labels?ids=${f.id}`, "_blank")}>
            <Tag /> Label
          </Button>
          <Button variant="outline" onClick={() => setEdit(fabricToInput(f))}>
            <Pencil /> Edit
          </Button>
          <Button onClick={() => setStock("add")}>
            <Plus /> Add stock <span className="ml text-primary-foreground/80">സ്റ്റോക്ക് ചേർക്കുക</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bought" ml="വാങ്ങിയത്" value={`${num(f.purchaseMtr)} m`} sub={fmtDate(f.purchaseDate) || undefined} />
        <StatCard label="Sold" ml="വിറ്റത്" value={`${num(f.soldMtr)} m`} sub={`${live.length} bill(s) · ${rupees(revenue)}`} tone="success" />
        <StatCard label="Balance" ml="ബാക്കി" value={`${num(f.balanceMtr)} m`} sub={`${Math.round(pct)}% left`} tone={f.balanceMtr <= lowStock ? "warning" : "default"} />
        <StatCard label="Sale rate" ml="റേറ്റ്" value={`${rupees(f.saleRate)}/m`} sub={showCost ? `Cost ${rupees(f.costPerMtr, true)}/m · stock value ${rupees(f.stockValue)}` : undefined} tone="gold" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <PhotoGallery photos={f.photoUrls ?? []} thumbs={f.thumbUrls ?? []} alt={`${f.code} ${f.brand}`} />
      <div className="grid content-start gap-x-8 gap-y-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
        <Info label="Composition" value={f.composition} />
        <Info label="Type" value={f.type} />
        <Info label="Colour family" value={f.colourFamily} />
        <Info label="Barcode" value={f.barcode} />
        <Info label="Supplier" value={supplier ? <Link className="hover:underline" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link> : null} />
        {showCost && (
          <Info
            label="Opening stock"
            value={f.broughtInBy ? <Link href="/opening-stock" className="hover:underline">Brought in by {f.broughtInBy} · {rupees((f.openingMtr ?? f.purchaseMtr) * (f.openingCostPerMtr ?? f.costPerMtr))}</Link> : "Business purchase"}
          />
        )}
        <Info label="Remarks" value={f.remarks} />
      </div>
      </div>

      <StockHistory f={f} moves={moves} showCost={showCost} canAdjust={canAdjust} onAdjust={() => setStock("adjust")} onChanged={() => router.refresh()} />

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

      {stock && <StockDialog mode={stock} fabric={f} onClose={() => setStock(null)} suppliers={suppliers} showCost={showCost} />}
      <FabricSheet value={edit} onClose={() => setEdit(null)} suppliers={suppliers} lists={lists} compositions={compositions} showCost={showCost} photosEnabled={photosEnabled} onSaved={() => router.refresh()} row={f} />
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

/** Where the stock came from: the first entry, every receipt — and, kept apart, every correction. */
function StockHistory({
  f,
  moves,
  showCost,
  canAdjust,
  onAdjust,
  onChanged,
}: {
  f: FabricRow;
  moves: StockMove[];
  showCost: boolean;
  canAdjust: boolean;
  onAdjust: () => void;
  onChanged: () => void;
}) {
  const receipts = moves.filter((m) => m.kind === "receipt");
  const adjusts = moves.filter((m) => m.kind === "adjust");
  const latestId = moves.at(-1)?.id;
  // First entry: the snapshot taken before the first movement (older fabrics: Bought as it is)
  const firstMtr = f.openingMtr ?? round2(f.purchaseMtr - moves.reduce((s, m) => s + m.metres, 0));
  const firstRate = f.openingCostPerMtr ?? (moves.length ? (moves[0].rateBefore ?? null) : f.costPerMtr);
  const [busy, setBusy] = React.useState<number | null>(null);

  const undo = async (m: StockMove) => {
    if (!window.confirm(`Take back this entry of ${mtr(Math.abs(m.metres))}?`)) return;
    setBusy(m.id);
    const r = await undoStockMove(m.id);
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Entry taken back. Balance is now ${mtr(r.data.balanceAfter)}.`);
    onChanged();
  };
  const undoBtn = (m: StockMove) =>
    canAdjust && m.id === latestId ? (
      <Button variant="ghost" size="icon" className="size-7" title="Undo this entry (latest only)" disabled={busy === m.id} onClick={() => undo(m)}>
        {busy === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
      </Button>
    ) : null;

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm font-medium">
            Stock received <span className="ml">വന്ന സ്റ്റോക്ക്</span>
          </p>
          {canAdjust && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onAdjust}>
              <SlidersHorizontal className="size-3.5" /> Adjust stock <span className="ml">സ്റ്റോക്ക് തിരുത്തുക</span>
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Metres</TableHead>
              {showCost && <TableHead className="text-right">Rate</TableHead>}
              <TableHead>Supplier</TableHead>
              <TableHead>Bill no.</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30">
              <TableCell>{fmtDate(f.purchaseDate) || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{num(firstMtr)}</TableCell>
              {showCost && <TableCell className="text-right tabular-nums">{firstRate != null ? rupees(firstRate, true) : "—"}</TableCell>}
              <TableCell colSpan={3} className="text-muted-foreground">
                First entry (when the fabric was added){f.broughtInBy ? ` · brought in by ${f.broughtInBy}` : ""}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell />
            </TableRow>
            {receipts.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{fmtDate(m.date)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-success">+{num(m.metres)}</TableCell>
                {showCost && (
                  <TableCell className="text-right tabular-nums">
                    {m.rate != null ? rupees(m.rate, true) : "—"}
                    {m.rateBefore != null && m.rateAfter != null && m.rateBefore !== m.rateAfter && (
                      <span className="block text-[11px] text-muted-foreground">
                        cost {rupees(m.rateBefore, true)} → {rupees(m.rateAfter, true)}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell>{m.supplier ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{m.billNo ?? "—"}</TableCell>
                <TableCell className="max-w-56 text-xs">
                  {m.remarks}
                  {m.createdBy && <span className="block text-[11px] text-muted-foreground">by {m.createdBy}</span>}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{mtr(m.balanceAfter)}</TableCell>
                <TableCell>{undoBtn(m)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Bought</TableCell>
              <TableCell className="text-right tabular-nums">{num(round2(firstMtr + receipts.reduce((s, m) => s + m.metres, 0)))}</TableCell>
              <TableCell colSpan={showCost ? 6 : 5} className="text-xs font-normal text-muted-foreground">
                {adjusts.length > 0 && `${adjusts.reduce((s, m) => s + m.metres, 0) < 0 ? "−" : "+"} corrections ${num(Math.abs(round2(adjusts.reduce((s, m) => s + m.metres, 0))))} m = ${num(f.purchaseMtr)} m · `}
                Balance = Bought − Sold = {num(f.purchaseMtr)} − {num(f.soldMtr)} = <b className="text-foreground">{mtr(f.balanceMtr)}</b>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {adjusts.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <p className="border-b px-4 py-3 text-sm font-medium">
            Stock corrections <span className="ml">സ്റ്റോക്ക് തിരുത്തലുകൾ</span>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Metres</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjusts.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{fmtDate(m.date)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", m.metres < 0 ? "text-destructive" : "text-success")}>
                    {m.metres > 0 ? "+" : "−"}
                    {num(Math.abs(m.metres))}
                  </TableCell>
                  <TableCell className="text-sm">{m.remarks}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.createdBy}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{mtr(m.balanceAfter)}</TableCell>
                  <TableCell>{undoBtn(m)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
