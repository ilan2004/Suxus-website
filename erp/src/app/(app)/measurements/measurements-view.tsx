"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeasurementDialog, type MeasurementRow } from "@/components/forms/measurement-dialog";
import type { CustomerLite } from "@/components/forms/customer-dialog";
import { AddPersonForm } from "@/components/forms/wearer-picker";
import { deleteMeasurement } from "@/lib/actions/measurements";
import { fieldsFor, measureText } from "@/lib/measurements";
import { formatPhone } from "@/lib/phone";
import { wearerTitle, type WearerLite } from "@/lib/wearers";
import { cn, fmtDate } from "@/lib/utils";

type Row = MeasurementRow & { customerName: string; phone: string | null };
type Person = { wearer: WearerLite; garments: Row[] };
type Group = { customerId: number; name: string; phone: string | null; latest: string; garments: Row[]; people: Person[]; wearerCount: number };

const PAGE = 50;
/** Distinct garments per person (an older record of the same garment for the same person is history). */
const garmentCount = (g: Group) => g.people.reduce((n, p) => n + new Set(p.garments.map((m) => m.garmentType)).size, 0);
const plural = (n: number) => `${n} garment${n === 1 ? "" : "s"}`;
/** "Shirt ×2, Pant" — one entry per garment type, ×n when that person has more than one record of it. */
const garmentSummary = (rows: Row[]) => {
  const n = new Map<string, number>();
  for (const r of rows) n.set(r.garmentType, (n.get(r.garmentType) ?? 0) + 1);
  return [...n.entries()].map(([g, c]) => (c > 1 ? `${g} ×${c}` : g)).join(", ");
};

/** Customer → wearer → garments. A customer with only the Self wearer looks exactly as before (garments directly). */
export function MeasurementsView({
  rows,
  customers,
  wearers,
  lists,
}: {
  rows: Row[];
  customers: CustomerLite[];
  wearers: WearerLite[];
  lists: { customerType: string[]; fit: string[] };
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<Partial<MeasurementRow> | null>(null);
  const [q, setQ] = React.useState("");
  const query = React.useDeferredValue(q.trim().toLowerCase());
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  const [adding, setAdding] = React.useState<number | null>(null);
  const [limit, setLimit] = React.useState(PAGE);

  const groups = React.useMemo(() => {
    const byCustomer = new Map<number, WearerLite[]>();
    for (const w of wearers) byCustomer.set(w.customerId, [...(byCustomer.get(w.customerId) ?? []), w]);
    const map = new Map<number, Group>();
    for (const r of rows) {
      const g = map.get(r.customerId) ?? { customerId: r.customerId, name: r.customerName, phone: r.phone, latest: r.date, garments: [], people: [], wearerCount: 0 };
      g.garments.push(r);
      if (r.date > g.latest) g.latest = r.date;
      map.set(r.customerId, g);
    }
    for (const g of map.values()) {
      const ws = byCustomer.get(g.customerId) ?? [];
      const self = ws.find((w) => w.isSelf) ?? { id: -g.customerId, customerId: g.customerId, name: "Self", relation: "Self", school: null, note: null, isSelf: true };
      const people = new Map<number, Person>();
      // Self first, then the others in the order they were added — every wearer is listed, even with nothing saved yet
      for (const w of [self, ...ws.filter((x) => !x.isSelf)]) people.set(w.id, { wearer: w, garments: [] });
      for (const r of g.garments) {
        const p = people.get(r.wearerId ?? self.id) ?? people.get(self.id)!;
        p.garments.push(r);
      }
      // Self is only listed when it has something (or is the only person)
      g.people = [...people.values()].filter((p) => !p.wearer.isSelf || p.garments.length || people.size === 1);
      g.wearerCount = people.size;
    }
    return [...map.values()].sort((a, b) => b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name));
  }, [rows, wearers]);

  // Search by customer name, phone number (any format), wearer name or garment
  const personHit = React.useCallback((p: Person) => !p.wearer.isSelf && p.wearer.name.toLowerCase().includes(query), [query]);
  const shown = React.useMemo(() => {
    if (!query) return groups;
    const digits = query.replace(/\D/g, "");
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        (digits.length >= 3 && (g.phone ?? "").replace(/\D/g, "").includes(digits)) ||
        g.people.some(personHit) ||
        g.garments.some((m) => m.garmentType.toLowerCase().includes(query)),
    );
  }, [groups, query, personHit]);

  React.useEffect(() => setLimit(PAGE), [query]);
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // When a search matches a garment or a wearer (not the customer's own name), open that customer
  const innerHit = (g: Group) => !!query && !g.name.toLowerCase().includes(query) && (g.people.some(personHit) || g.garments.some((m) => m.garmentType.toLowerCase().includes(query)));

  const remove = async (m: Row, who: string) => {
    if (!confirm(`Delete ${m.garmentType} measurements of ${who} (${fmtDate(m.date)})?`)) return;
    const r = await deleteMeasurement(m.id);
    if (!r.ok) return void toast.error(r.error);
    router.refresh();
  };
  const garmentList = (g: Group, list: Row[], who: string) =>
    list
      .slice()
      .sort((a, b) => a.garmentType.localeCompare(b.garmentType) || b.date.localeCompare(a.date))
      .map((m, i, all) => <GarmentRow key={m.id} m={m} earlier={i > 0 && all[i - 1].garmentType === m.garmentType} onEdit={() => setDialog(m)} onDelete={() => remove(m, who)} />);

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
            const isOpen = open.has(g.customerId) || innerHit(g);
            const multi = g.wearerCount > 1;
            const self = g.people.find((p) => p.wearer.isSelf)?.wearer;
            return (
              <li key={g.customerId}>
                <button type="button" onClick={() => toggle(g.customerId)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {g.name}
                      {multi && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-foreground">{g.wearerCount} wearers</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground sm:hidden">
                      {formatPhone(g.phone)} · {plural(garmentCount(g))}
                    </span>
                    {multi && !isOpen && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {g.people.map((p) => `${p.wearer.isSelf ? "Self" : p.wearer.name}: ${garmentSummary(p.garments) || "—"}`).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="hidden w-40 shrink-0 font-mono text-xs text-muted-foreground sm:block">{formatPhone(g.phone)}</span>
                  <span className="hidden w-24 shrink-0 text-sm sm:block">{plural(garmentCount(g))}</span>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{fmtDate(g.latest)}</span>
                </button>
                {isOpen && (
                  <div className="grid gap-2 bg-muted/20 px-4 pt-1 pb-3 sm:pl-11">
                    {multi
                      ? g.people.map((p) => (
                          <section key={p.wearer.id} className="grid gap-2 rounded-xl border bg-card/60 p-2.5">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
                              <h3 className={cn("font-semibold", personHit(p) && query && "rounded bg-gold/25 px-1")}>{wearerTitle(p.wearer)}</h3>
                              <span className="text-xs text-muted-foreground">{garmentSummary(p.garments) || "No measurements yet"}</span>
                              <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setDialog({ customerId: g.customerId, wearerId: p.wearer.id })}>
                                <Plus className="size-3.5" /> Add garment
                              </Button>
                            </div>
                            {p.wearer.note && <p className="px-1 text-xs text-muted-foreground italic">{p.wearer.note}</p>}
                            {garmentList(g, p.garments, p.wearer.isSelf ? g.name : p.wearer.name)}
                          </section>
                        ))
                      : garmentList(g, g.garments, g.name)}
                    {adding === g.customerId && (
                      <AddPersonForm
                        customerId={g.customerId}
                        onCancel={() => setAdding(null)}
                        onAdded={(w) => {
                          setAdding(null);
                          setOpen((s) => new Set(s).add(g.customerId));
                          router.refresh();
                          setDialog({ customerId: g.customerId, wearerId: w.id });
                        }}
                      />
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!multi && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ customerId: g.customerId, wearerId: self?.id && self.id > 0 ? self.id : null })}>
                          <Plus /> Add garment
                        </Button>
                      )}
                      {adding !== g.customerId && (
                        <Button size="sm" variant="ghost" onClick={() => setAdding(g.customerId)}>
                          <UserPlus /> Add another person
                        </Button>
                      )}
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
                  <span className="text-muted-foreground">{f.part ? f.key : f.en}</span> <b className="tabular-nums">{measureText(f, m.values[f.key])}</b>
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
