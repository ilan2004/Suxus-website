"use client";

import * as React from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { CustomerPicker } from "./customer-picker";
import { WearerField, useWearers } from "./wearer-picker";
import type { CustomerLite } from "./customer-dialog";
import { GARMENTS, GARMENT_TYPES, fieldsFor, wholeOf } from "@/lib/measurements";
import { saveMeasurement, type MeasurementInput } from "@/lib/actions/measurements";
import { today } from "@/lib/utils";
import { wearerTitle } from "@/lib/wearers";

export type MeasurementRow = {
  id: number;
  customerId: number;
  /** Whose measurements (null on rows saved before wearers = Self). */
  wearerId?: number | null;
  date: string;
  garmentType: string;
  size: string | null;
  fit: string | null;
  values: Record<string, number | null>;
  remarks: string | null;
};

export function MeasurementDialog({
  open,
  onOpenChange,
  initial,
  customers,
  customerTypes,
  fits,
  history = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<MeasurementRow>;
  customers?: CustomerLite[];
  customerTypes: string[];
  fits: string[];
  history?: MeasurementRow[];
}) {
  const blank = (): MeasurementInput => ({
    customerId: 0,
    date: today(),
    garmentType: "Shirt",
    fit: "Regular",
    values: {},
    ...initial,
  });
  const [v, setV] = React.useState<MeasurementInput>(blank);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (open) setV(blank());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useWearers(v.customerId || null);
  const wearerId = v.wearerId ?? people.self?.id ?? null;
  const fields = GARMENTS[v.garmentType] ?? GARMENTS.Other;
  // "Copy last" only from the same person's earlier record of this garment
  const sameWearer = (h: MeasurementRow) => (h.wearerId ?? null) === (wearerId ?? null) || (!h.wearerId && wearerId === people.self?.id);
  const previous = history.find((h) => h.garmentType === v.garmentType && h.customerId === v.customerId && h.id !== v.id && sameWearer(h));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveMeasurement({ ...v, wearerId });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Measurements saved");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {v.id ? "Edit measurements" : "New measurements"}
            {people.many && wearerId && <span className="ml-2 text-base font-normal text-muted-foreground">· {wearerTitle(people.wearers.find((w) => w.id === wearerId) ?? { name: "", relation: "", isSelf: true })}</span>}
          </DialogTitle>
          <DialogDescription>All values in inches · അളവുകൾ ഇഞ്ചിൽ</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {customers && (
              <Field label="Customer" ml="കസ്റ്റമർ" required className="sm:col-span-2">
                <CustomerPicker
                  customers={customers}
                  types={customerTypes}
                  value={v.customerId || null}
                  onChange={(c) => setV((s) => ({ ...s, customerId: c?.id ?? 0, wearerId: null }))}
                />
              </Field>
            )}
            <WearerField customerId={v.customerId || null} value={wearerId} onChange={(id) => setV((s) => ({ ...s, wearerId: id }))} hook={people} />
            <Field label="Garment" ml="ഗാർമെന്റ് തരം" required>
              <ListSelect items={GARMENT_TYPES} value={v.garmentType} onChange={(g) => setV((s) => ({ ...s, garmentType: g ?? "Other" }))} />
            </Field>
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={v.date} onChange={(e) => setV((s) => ({ ...s, date: e.target.value }))} />
            </Field>
            <Field label="Size" ml="സൈസ്">
              <Input value={v.size ?? ""} onChange={(e) => setV((s) => ({ ...s, size: e.target.value }))} placeholder="e.g. 40 / L" />
            </Field>
            <Field label="Fit" ml="ഫിറ്റ്">
              <ListSelect items={fits} value={v.fit} onChange={(f) => setV((s) => ({ ...s, fit: f }))} />
            </Field>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{v.garmentType}</p>
              {previous && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setV((s) => ({ ...s, values: { ...previous.values }, size: previous.size, fit: previous.fit }))}
                >
                  <Copy /> Copy last ({previous.date})
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.en}
                  ml={f.ml}
                  className={f.part ? "col-span-2" : undefined}
                  // Part-of-whole (chest): show the whole as it is typed — worked out, never stored
                  hint={f.part ? (v.values[f.key] != null ? `${v.values[f.key]} → ${f.part.whole} ${wholeOf(f, v.values[f.key])} in` : `× ${f.part.factor}${f.part.add ? ` + ${f.part.add}` : ""} = ${f.part.whole}`) : undefined}
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min={0}
                    value={v.values[f.key] ?? ""}
                    onChange={(e) =>
                      setV((s) => ({ ...s, values: { ...s.values, [f.key]: e.target.value === "" ? null : Number(e.target.value) } }))
                    }
                    className="text-right font-medium tabular-nums"
                  />
                </Field>
              ))}
            </div>
          </div>

          <Field label="Remarks" ml="കുറിപ്പ്">
            <Textarea value={v.remarks ?? ""} onChange={(e) => setV((s) => ({ ...s, remarks: e.target.value }))} rows={2} placeholder="Style notes, pocket, collar…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !v.customerId}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MeasurementCard({ m, onEdit }: { m: MeasurementRow; onEdit?: () => void }) {
  const fields = fieldsFor(m.garmentType, m.values);
  return (
    <button onClick={onEdit} className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-medium">{m.garmentType}</p>
        <p className="text-xs text-muted-foreground">
          {[m.size && `Size ${m.size}`, m.fit, m.date].filter(Boolean).join(" · ")}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key}>
            <dt className="text-[11px] text-muted-foreground">{f.en}</dt>
            <dd className="font-display text-base font-semibold tabular-nums">
              {m.values[f.key] ?? "—"}
              {wholeOf(f, m.values[f.key]) != null && <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">({f.part!.whole} {wholeOf(f, m.values[f.key])})</span>}
            </dd>
          </div>
        ))}
      </dl>
      {m.remarks && <p className="mt-3 text-xs text-muted-foreground">{m.remarks}</p>}
    </button>
  );
}
