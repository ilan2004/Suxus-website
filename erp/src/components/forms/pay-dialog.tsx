"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { cn, rupees, today } from "@/lib/utils";

type R = { ok: true } | { ok: false; error: string };

/** Generic "money in / money out" dialog used for bulk orders, suppliers and tailors. */
export function PayDialog({
  open,
  onOpenChange,
  title,
  description,
  suggested,
  modes,
  onSubmit,
  onDone,
  payers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  suggested?: number;
  modes: string[];
  onSubmit: (v: { amount: number; mode: string; date: string; note: string | null; ref: string | null; paidBy: string }) => Promise<R>;
  onDone?: () => void;
  /** When given, asks who paid (Business Account → cash book; a partner → their own money). */
  payers?: string[];
}) {
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState(modes[0] ?? "Cash");
  const [date, setDate] = React.useState(today());
  const [note, setNote] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [paidBy, setPaidBy] = React.useState("Business Account");
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (open) {
      setAmount(suggested && suggested > 0 ? String(suggested) : "");
      setDate(today());
      setNote("");
      setRef("");
      setPaidBy("Business Account");
    }
  }, [open, suggested]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await onSubmit({ amount: Number(amount), mode, date, note: note || null, ref: ref || null, paidBy });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onDone?.();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Amount" ml="തുക">
            <Input type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-right text-lg font-semibold" autoFocus required />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {modes
              .filter((m) => m !== "Credit (Due)")
              .map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-8 rounded-md border px-3 text-sm", mode === m ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                  {m}
                </button>
              ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          {payers && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paid by" ml="ആര് കൊടുത്തു" hint={paidBy === "Business Account" ? "Goes to the cash book" : "Partner's own money — not in the cash book"}>
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
                  {payers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="UPI / Ref no.">
                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
          )}
          {suggested != null && suggested > 0 && <p className="text-xs text-muted-foreground">Balance: {rupees(suggested, true)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
