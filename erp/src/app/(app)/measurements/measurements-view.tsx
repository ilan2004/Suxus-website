"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeasurementDialog, type MeasurementRow } from "@/components/forms/measurement-dialog";
import type { CustomerLite } from "@/components/forms/customer-dialog";
import { deleteMeasurement } from "@/lib/actions/measurements";
import { fieldsFor } from "@/lib/measurements";
import { formatPhone } from "@/lib/phone";
import { cn, fmtDate } from "@/lib/utils";

type Row = MeasurementRow & { customerName: string; phone: string | null };
type Group = { customerId: number; name: string; phone: string | null; latest: string; garments: Row[] };

const PAGE = 50;
/** Distinct garments (an older record of the same garment is history, not another garment). */
const garmentCount = (g: { garments: { garmentType: string }[] }) => new Set(g.garments.map((m) => m.garmentType)).size;
const plural = (n: number) => `${n} garment${n === 1 ? "" : "s"}`;

/** One row per customer; tap to see that customer's garments (one saved record per garment underneath). */
export function MeasurementsView({ rows, customers, lists }: { rows: Row[]; customers: CustomerLite[]; lists: { customerType: string[]; fit: string[] } }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<Partial<MeasurementRow> | null>(null);
  const [q, setQ] = React.useState("");
  const query = React.useDeferredValue(q.trim().toLowerCase());
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  const [limit, setLimit] = React.useState(PAGE);

  const groups = React.useMemo(() => {
    const map = new Map<number, Group>();
    for (const r of rows) {
      const g = map.get(r.customerId) ?? { customerId: r.customerId, name: r.customerName, phone: r.phone, latest: r.date, garments: [] };
      g.garments.push(r);
      if (r.date > g.latest) g.latest = r.date;
      map.set(r.customerId, g);
    }
    return [...map.values()].sort((a, b) => b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name));
  }, [rows]);

  // Search by customer name, phone number (any format) or garment
  const shown = React.useMemo(() => {
    if (!query) return groups;
    const digits = query.replace(/\D/g, "");
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        (digits.length >= 3 && (g.phone ?? "").replace(/\D/g, "").includes(digits)) ||
        g.garments.some((m) => m.garmentType.toLowerCase().includes(query)),
    );
  }, [groups, query]);

  React.useEffect(() => setLimit(PAGE), [query]);
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // When a search matches by garment, open those customers so the garment is visible
  const garmentHit = (g: Group) => !!query && g.garments.some((m) => m.garmentType.toLowerCase().includes(query)) && !g.name.toLowerCase().includes(query);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or garment…" className="pr-9 pl-9" inputMode="search" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {shown.length} customer{shown.length === 1 ? "" : "s"} · {plural(shown.reduce((s, g) => s + garmentCount(g), 0))}
        </span>
        <Button className="ml-auto" onClick={() => setDialog({})}>
          <Plus /> Add measurements
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {!shown.length && <p className="p-8 text-center text-sm text-muted-foreground">{q ? "No customer matches that search." : "No measurements saved yet."}</p>}
        <ul className="divide-y">
          {shown.slice(0, limit).map((g) => {
            const isOpen = open.has(g.customerId) || garmentHit(g);
            return (
              <li key={g.customerId}>
                <button type="button" onClick={() => toggle(g.customerId)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.name}</span>
                    <span className="block truncate text-xs text-muted-foreground sm:hidden">
                      {formatPhone(g.phone)} · {plural(garmentCount(g))}
                    </span>
                  </span>
                  <span className="hidden w-40 shrink-0 font-mono text-xs text-muted-foreground sm:block">{formatPhone(g.phone)}</span>
                  <span className="hidden w-24 shrink-0 text-sm sm:block">{plural(garmentCount(g))}</span>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{fmtDate(g.latest)}</span>
                </button>
                {isOpen && (
                  <div className="grid gap-2 bg-muted/20 px-4 pt-1 pb-3 sm:pl-11">
                    {g.garments
                      .slice()
                      .sort((a, b) => a.garmentType.localeCompare(b.garmentType) || b.date.localeCompare(a.date))
                      .map((m, i, all) => (
                        <GarmentRow
                          key={m.id}
                          m={m}
                          earlier={i > 0 && all[i - 1].garmentType === m.garmentType}
                          onEdit={() => setDialog(m)}
                          onDelete={async () => {
                            if (!confirm(`Delete ${m.garmentType} measurements of ${g.name} (${fmtDate(m.date)})?`)) return;
                            const r = await deleteMeasurement(m.id);
                            if (!r.ok) return void toast.error(r.error);
                            router.refresh();
                          }}
                        />
                      ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setDialog({ customerId: g.customerId })}>
                        <Plus /> Add garment
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/customers/${g.customerId}`}>Open customer →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {shown.length > limit && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more · {shown.length - limit} left
            </Button>
          </div>
        )}
      </div>

      <MeasurementDialog
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            router.refresh();
          }
        }}
        initial={dialog ?? undefined}
        customers={customers}
        customerTypes={lists.customerType}
        fits={lists.fit}
        history={rows}
      />
    </div>
  );
}

function GarmentRow({ m, earlier, onEdit, onDelete }: { m: Row; earlier?: boolean; onEdit: () => void; onDelete: () => void }) {
  const fields = fieldsFor(m.garmentType, m.values).filter((f) => m.values[f.key] != null);
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border bg-card p-3", earlier && "opacity-70")}>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{m.garmentType}</span>
          {earlier && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground uppercase">earlier</span>}
          {(m.size || m.fit) && <span className="text-xs text-muted-foreground">{[m.size && `Size ${m.size}`, m.fit].filter(Boolean).join(" · ")}</span>}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{fmtDate(m.date)}</span>
        </span>
        <span className={cn("mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs", fields.length ? "" : "text-muted-foreground")}>
          {fields.length
            ? fields.map((f) => (
                <span key={f.key}>
                  <span className="text-muted-foreground">{f.en}</span> <b className="tabular-nums">{m.values[f.key]}</b>
                </span>
              ))
            : "No measurements filled in"}
        </span>
        {m.remarks && <span className="mt-1 block text-xs text-muted-foreground italic">{m.remarks}</span>}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={onDelete}>
        <Trash2 className="text-muted-foreground" />
      </Button>
    </div>
  );
}
