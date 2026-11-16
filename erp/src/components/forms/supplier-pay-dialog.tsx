"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Landmark, Loader2, Phone, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { paySupplier, undoSupplierPayment } from "@/lib/actions/purchases";
import { rupees, today } from "@/lib/utils";

export const SUPPLIER_PAY_MODES = ["Cash", "GPay/UPI", "Bank Transfer", "Card"] as const;

export type PayableSupplier = {
  id: number;
  name: string;
  balance: number;
  phone: string | null;
  upi: string | null;
  bank: string | null;
  lastMode: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** upi://pay link — opens GPay / PhonePe with the amount filled. Saves nothing. */
export function upiLink(upi: string, name: string, amount: number) {
  const q = [`pa=${encodeURIComponent(upi.trim()).replace(/%40/g, "@")}`, `pn=${encodeURIComponent(name)}`];
  if (amount > 0) q.push(`am=${amount.toFixed(2)}`);
  q.push("cu=INR");
  return `upi://pay?${q.join("&")}`;
}

/** Record a payment on account to a supplier, pre-filled so normally only "Save" is needed. */
export function SupplierPayDialog({
  supplier: s,
  open,
  onOpenChange,
  payers,
}: {
  supplier: PayableSupplier | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** "Business Account" plus partner names; a partner paying from their own pocket stays out of the cash book. */
  payers?: string[];
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [mode, setMode] = React.useState<string>("GPay/UPI");
  const [ref, setRef] = React.useState("");
  const [note, setNote] = React.useState("");
  const [paidBy, setPaidBy] = React.useState("Business Account");
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (!open || !s) return;
    setAmount(s.balance > 0 ? String(r2(s.balance)) : "");
    setDate(today());
    setMode(s.lastMode && (SUPPLIER_PAY_MODES as readonly string[]).includes(s.lastMode) ? s.lastMode : "GPay/UPI");
    setRef("");
    setNote("");
    setPaidBy("Business Account");
  }, [open, s]);

  if (!s) return null;
  const amt = Number(amount);
  const valid = amount !== "" && Number.isFinite(amt) && amt > 0;
  const extra = valid ? r2(amt - Math.max(0, s.balance)) : 0;

  const copy = (label: string, t: string) =>
    navigator.clipboard?.writeText(t).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Could not copy"),
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return void toast.error("Enter an amount more than 0");
    start(async () => {
      const r = await paySupplier({ supplierId: s.id, date, amount: amt, mode, ref: ref || null, note: note || null, paidBy });
      if (!r.ok) return void toast.error(r.error);
      const { id, name, before, after } = r.data;
      const fmtBal = (n: number) => (n < 0 ? `${rupees(-n)} advance` : rupees(n));
      toast.success(`${rupees(amt)} paid to ${name} recorded.`, {
        description: `Balance now ${fmtBal(before)} → ${fmtBal(after)}.`,
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const u = await undoSupplierPayment(id);
            if (!u.ok) return void toast.error(u.error);
            toast("Payment removed", { description: `Balance back to ${fmtBal(before)}.` });
            router.refresh();
          },
        },
      });
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay supplier</DialogTitle>
          <DialogDescription>
            Payment on account <span className="ml">സപ്ലയർക്ക് കൊടുത്തത്</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p className="truncate font-medium">{s.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance due</p>
              <p className="font-semibold tabular-nums text-destructive">{rupees(Math.max(0, s.balance))}</p>
            </div>
          </div>

          {(s.phone || s.upi || s.bank) && (
            <div className="grid gap-1.5 rounded-lg border p-2 text-sm">
              {s.phone && <CopyLine icon={Phone} label="Phone" value={s.phone} onCopy={copy} />}
              {s.upi && <CopyLine icon={Smartphone} label="UPI ID" value={s.upi} onCopy={copy} />}
              {s.bank && <CopyLine icon={Landmark} label="Bank" value={s.bank} onCopy={copy} />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" ml="തുക" className="col-span-2 sm:col-span-1">
              <Input
                type="number"
                inputMode="decimal"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 text-right text-lg font-semibold"
                required
              />
            </Field>
            <Field label="Date" ml="തീയതി" className="col-span-2 sm:col-span-1">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" required />
            </Field>
          </div>
          {amount !== "" && !valid && <p className="-mt-2 text-xs text-destructive">Amount must be more than 0.</p>}
          {extra > 0 && (
            <p className="-mt-2 text-xs text-warning">
              {rupees(extra)} more than the balance — will be carried as an advance.
            </p>
          )}

          {s.upi && valid && (
            <a
              href={upiLink(s.upi, s.name, amt)}
              className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <ExternalLink className="size-4" /> Pay {rupees(amt)} by UPI
              <span className="text-xs font-normal text-muted-foreground">(then come back and Save)</span>
            </a>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode" ml="രീതി">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
                {SUPPLIER_PAY_MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="UPI / Ref no.">
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Notes" ml="കുറിപ്പ്" className={payers ? "" : "col-span-2"}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </Field>
            {payers && (
              <Field label="Paid by" ml="ആര് കൊടുത്തു">
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
                  {payers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {payers && paidBy !== "Business Account" && <p className="-mt-2 text-xs text-muted-foreground">Partner&apos;s own money — not entered in the cash book.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !valid}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyLine({ icon: Icon, label, value, onCopy }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; onCopy: (label: string, v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={() => onCopy(label, value)}>
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}
