"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { SearchSelect } from "@/components/app/search-select";
import { addStock, adjustStock, undoStockMove, type StockMoveResult } from "@/lib/actions/fabric-stock";
import { cn, round2, rupees, today } from "@/lib/utils";

export type StockFabric = {
  id: number;
  code: string;
  brand: string;
  shade: string | null;
  purchaseMtr: number;
  soldMtr: number;
  balanceMtr: number;
  costPerMtr: number;
  supplierId: number | null;
  thumbnailUrl: string | null;
};

/** "5.0 m", "6.6 m", "12.25 m" */
export const mtr = (n: number) => `${n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m`;

/** Same formula as the server: (old balance × old rate + new metres × new rate) / (old balance + new metres). */
export function weightedRate(balance: number, oldRate: number, metres: number, lotRate: number) {
  if (lotRate === oldRate || !(metres > 0)) return oldRate;
  if (oldRate === 0) return lotRate;
  const onHand = Math.max(0, balance);
  return round2((onHand * oldRate + metres * lotRate) / (onHand + metres));
}

/**
 * Add stock: only the NEW metres are typed; the app adds them to Bought.
 * Adjust stock: a + / − correction with a required reason, logged apart from receipts.
 */
export function StockDialog({
  fabric: f,
  mode,
  onClose,
  suppliers,
  showCost,
  onScanNext,
}: {
  fabric: StockFabric | null;
  mode: "add" | "adjust";
  onClose: () => void;
  suppliers: { id: number; name: string }[];
  /** Owner only: sees and enters the cost / metre (weighted average). Others: the current cost is kept. */
  showCost: boolean;
  /** Opened from a scan: offer "Save & scan next" for unloading a delivery. */
  onScanNext?: () => void;
}) {
  const router = useRouter();
  const metresRef = React.useRef<HTMLInputElement>(null);
  const [metres, setMetres] = React.useState("");
  const [sign, setSign] = React.useState<1 | -1>(-1);
  const [rate, setRate] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [supplierId, setSupplierId] = React.useState<number | null>(null);
  const [billNo, setBillNo] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (!f) return;
    setMetres("");
    setSign(-1);
    setRate(f.costPerMtr ? String(f.costPerMtr) : "");
    setDate(today());
    setSupplierId(f.supplierId);
    setBillNo("");
    setRemarks("");
  }, [f, mode]);

  if (!f) return null;
  const add = mode === "add";
  const m = Number(metres);
  const valid = metres !== "" && Number.isFinite(m) && m > 0;
  const delta = valid ? round2(add ? m : sign * m) : 0;
  const lotRate = showCost && rate !== "" ? Number(rate) : f.costPerMtr;
  const newRate = add ? weightedRate(f.balanceMtr, f.costPerMtr, m, lotRate) : f.costPerMtr;
  const boughtAfter = round2(f.purchaseMtr + delta);
  const balanceAfter = round2(f.balanceMtr + delta);
  const tooMuch = !add && balanceAfter < 0;
  const reasonOk = add || remarks.trim().length >= 3;

  const confirm = (r: StockMoveResult) => {
    const rateLine = r.rateBefore != null && r.rateAfter != null && r.rateBefore !== r.rateAfter ? ` Cost/m ${rupees(r.rateBefore, true)} → ${rupees(r.rateAfter, true)} (weighted average).` : "";
    const title = add
      ? `${mtr(r.metres)} added. Balance is now ${mtr(r.balanceAfter)}.`
      : `Stock ${r.metres > 0 ? "increased" : "reduced"} by ${mtr(Math.abs(r.metres))}. Balance is now ${mtr(r.balanceAfter)}.`;
    toast.success(title, {
      description: `${r.code} · Bought ${mtr(r.boughtBefore)} → ${mtr(r.boughtAfter)}.${rateLine}`,
      duration: 12_000,
      action: {
        label: "Undo",
        onClick: async () => {
          const u = await undoStockMove(r.id);
          if (!u.ok) return void toast.error(u.error);
          toast(`${u.data.code}: taken back`, { description: `Balance back to ${mtr(u.data.balanceAfter)}.` });
          router.refresh();
        },
      },
    });
  };

  const save = (next: boolean) => {
    if (!valid) return void (toast.error(add ? "Enter the metres that arrived" : "Enter the metres to correct"), metresRef.current?.focus());
    if (!reasonOk) return void toast.error("A reason is required");
    if (tooMuch) return void toast.error(`Only ${mtr(f.balanceMtr)} is in stock`);
    start(async () => {
      const r = add
        ? await addStock({ fabricId: f.id, metres: m, rate: showCost && rate !== "" ? Number(rate) : null, date, supplierId, billNo: billNo || null, remarks: remarks || null })
        : await adjustStock({ fabricId: f.id, metres: delta, date, reason: remarks });
      if (!r.ok) return void toast.error(r.error);
      confirm(r.data);
      onClose();
      router.refresh();
      if (next) onScanNext?.();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          metresRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {add ? "Add stock" : "Adjust stock"} <span className="ml">{add ? "സ്റ്റോക്ക് ചേർക്കുക" : "സ്റ്റോക്ക് തിരുത്തുക"}</span>
          </DialogTitle>
          <DialogDescription>{add ? "More of the same cloth arrived." : "Corrections only — damage, shortage, a counting mistake."}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(!!onScanNext);
          }}
          className="grid gap-4"
        >
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            {f.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="size-10 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-muted-foreground">{f.code}</p>
              <p className="truncate font-medium">
                {f.brand}
                {f.shade && <span className="text-muted-foreground"> · {f.shade}</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">In stock</p>
              <p className="font-semibold tabular-nums">{mtr(f.balanceMtr)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={add ? "Metres received" : "Correction (metres)"}
              ml={add ? "വന്ന മീറ്റർ" : "തിരുത്ത് (മീറ്റർ)"}
              required
              className="col-span-2"
              hint={add ? "ഇപ്പോൾ വന്ന മീറ്റർ മാത്രം എഴുതുക. ആകെ എത്രയെന്ന് കണക്കാക്കേണ്ട." : undefined}
            >
              <div className="flex gap-2">
                {!add && (
                  <div className="flex shrink-0 overflow-hidden rounded-md border" role="radiogroup" aria-label="Plus or minus">
                    {([-1, 1] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={sign === s}
                        onClick={() => setSign(s)}
                        className={cn("h-11 w-16 text-sm font-semibold", sign === s ? (s < 0 ? "bg-destructive text-white" : "bg-success text-white") : "bg-card text-muted-foreground")}
                      >
                        {s < 0 ? "− Less" : "+ More"}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  ref={metresRef}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  value={metres}
                  onChange={(e) => setMetres(e.target.value.replace("-", ""))}
                  placeholder="0.0"
                  className="h-11 text-right text-lg font-semibold"
                  aria-label={add ? "Metres received" : "Correction metres"}
                  required
                />
              </div>
            </Field>
            {add && showCost && (
              <Field label="Rate per metre" ml="മീറ്റർ റേറ്റ്" hint={f.costPerMtr ? `Current cost ${rupees(f.costPerMtr, true)}/m` : "No cost entered yet"}>
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="₹ / m" />
              </Field>
            )}
            <Field label="Date" ml="തീയതി" className={add && showCost ? "" : "col-span-2"}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} required />
            </Field>
            {add && (
              <>
                <Field label="Supplier" ml="സപ്ലയർ">
                  <SearchSelect
                    options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                    value={supplierId ? String(supplierId) : null}
                    onChange={(s) => setSupplierId(s ? Number(s) : null)}
                    allowClear
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Bill number" ml="ബിൽ നമ്പർ">
                  <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Optional" />
                </Field>
              </>
            )}
            <Field label={add ? "Remarks" : "Reason"} ml={add ? "കുറിപ്പ്" : "കാരണം"} required={!add} className="col-span-2">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={add ? "Optional" : "Damage, shortage, counting mistake…"} required={!add} />
            </Field>
          </div>

          {valid && (
            <div className={cn("grid gap-1 rounded-lg border px-3 py-2 text-sm tabular-nums", tooMuch ? "border-destructive/50 bg-destructive/5" : "bg-muted/30")}>
              <Line label="Bought" from={mtr(f.purchaseMtr)} to={mtr(boughtAfter)} />
              <Line label="Balance" from={mtr(f.balanceMtr)} to={mtr(balanceAfter)} strong />
              {add && showCost && newRate !== f.costPerMtr && <Line label="Cost / m" from={rupees(f.costPerMtr, true)} to={rupees(newRate, true)} note="weighted average" />}
              {tooMuch && <p className="text-xs text-destructive">Only {mtr(f.balanceMtr)} is in stock.</p>}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {onScanNext && add ? (
              <>
                <Button type="button" variant="outline" disabled={pending || !valid} onClick={() => save(false)}>
                  Save
                </Button>
                <Button type="submit" disabled={pending || !valid}>
                  {pending ? <Loader2 className="animate-spin" /> : <ScanBarcode />} Save &amp; scan next
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={pending || !valid || !reasonOk || tooMuch}>
                {pending && <Loader2 className="animate-spin" />} {add ? "Add stock" : "Save correction"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, from, to, strong, note }: { label: string; from: string; to: string; strong?: boolean; note?: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(strong && "font-semibold")}>
        {from} → {to}
        {note && <span className="ml-1 text-xs font-normal text-muted-foreground">({note})</span>}
      </span>
    </p>
  );
}
