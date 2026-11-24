"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, History, Pencil, Plus, Ruler, ScanBarcode, Search, Shirt, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/app/barcode-scanner";
import { CustomerDialog, type CustomerLite } from "@/components/forms/customer-dialog";
import { AddPersonForm } from "@/components/forms/wearer-picker";
import { deleteDraft, lookupCode, type Draft } from "@/lib/actions/drafts";
import { jobSlipByCode } from "@/lib/actions/job-slip";
import { parseItemCode } from "@/lib/job-slip-code";
import { setSimpleMode } from "@/lib/actions/profile";
import { GARMENT_TYPES, fromSizeChart, measuringOrder, wholeOf } from "@/lib/measurements";
import { formatPhone } from "@/lib/phone";
import { wearerTitle, RELATION_ML, type WearerLite } from "@/lib/wearers";
import { cn, fmtDate } from "@/lib/utils";
import { SimpleEntry, enOf, fromDraft, mlOf, type EntryState } from "./entry";

export type SimpleRow = {
  id: number;
  customerId: number;
  wearerId: number | null;
  date: string;
  garmentType: string;
  size: string | null;
  fit: string | null;
  values: Record<string, number | null>;
  remarks: string | null;
  updatedAt: string;
};
/** The latest tailor given each person's garments (order items), newest first. */
export type TailorLine = { wearerId: number; item: string; tailor: string; orderNo: string };

const GARMENT_ML: Record<string, string> = {
  Shirt: "ഷർട്ട്",
  "Pant / Trouser": "പാന്റ്",
  "School Uniform Trouser": "സ്കൂൾ പാന്റ്",
  "Churidar Top": "ചുരിദാർ ടോപ്പ്",
  "Churidar Bottom": "ചുരിദാർ ബോട്ടം",
  Blouse: "ബ്ലൗസ്",
  Frock: "ഫ്രോക്ക്",
  Other: "മറ്റുള്ളവ",
};
const fmt = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n * 100) / 100));
/** "Shirt" matches order items "Shirt", "School Shirt", "Shirt+Pant Set"; "Pant / Trouser" matches "Pant". */
const itemMatches = (garment: string, item: string) =>
  garment
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4)
    .some((w) => item.toLowerCase().includes(w));

type Person = { customer: CustomerLite; wearer: WearerLite | null; latest: string };

/**
 * Simple measurement mode: big search, unfinished entries, the last 20 people measured, Scan — then a person's
 * garments as large cards, and a one-field-at-a-time entry. Same data as the detailed view.
 */
export function SimpleMeasurements({
  rows,
  customers,
  wearers,
  drafts,
  tailors,
  sizeChart,
  order,
  autoAdvance = false,
  customerTypes,
}: {
  rows: SimpleRow[];
  customers: CustomerLite[];
  wearers: WearerLite[];
  drafts: Draft[];
  tailors: TailorLine[];
  sizeChart: { sizes: string[]; rows: { label: string; values: number[] }[] };
  order: Record<string, string[]>;
  autoAdvance?: boolean;
  customerTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const cId = Number(sp.get("c")) || null;
  const wId = Number(sp.get("w")) || null;
  const [q, setQ] = React.useState("");
  const [scan, setScan] = React.useState(false);
  const [entry, setEntry] = React.useState<{ state: EntryState; who: string } | null>(null);
  const [start, setStart] = React.useState<{ garment: string } | null>(null);
  const [pickGarment, setPickGarment] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState(false);
  const [addPerson, setAddPerson] = React.useState(false);
  const [list, setList] = React.useState(customers);
  React.useEffect(() => setList(customers), [customers]);

  const open = (c: number, w?: number | null) => router.push(`${pathname}?c=${c}${w ? `&w=${w}` : ""}`, { scroll: true });
  const home = () => router.push(pathname);
  const customerOf = (id: number) => list.find((c) => c.id === id);
  const wearersOf = (id: number) => wearers.filter((w) => w.customerId === id);
  const selfOf = (id: number) => wearersOf(id).find((w) => w.isSelf) ?? null;
  const wearerOf = (id: number | null) => (id ? (wearers.find((w) => w.id === id) ?? null) : null);
  const nameOf = (customer: CustomerLite | undefined, w: WearerLite | null) => (w && !w.isSelf ? w.name : (customer?.name ?? ""));

  // Records from before wearers count as the customer's Self
  const rowsOf = (customerId: number, wearerId: number | null) => {
    const self = selfOf(customerId)?.id ?? null;
    return rows.filter((r) => r.customerId === customerId && (r.wearerId ?? self) === (wearerId ?? self));
  };

  // ── Recent: the last 20 people measured, newest first ──
  const recent = React.useMemo(() => {
    const seen = new Map<string, Person>();
    for (const r of [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      const customer = list.find((c) => c.id === r.customerId);
      if (!customer) continue;
      const w = wearers.find((x) => x.id === r.wearerId) ?? null;
      const key = `${r.customerId}:${w && !w.isSelf ? w.id : "self"}`;
      if (!seen.has(key)) seen.set(key, { customer, wearer: w && !w.isSelf ? w : null, latest: r.updatedAt });
      if (seen.size >= 20) break;
    }
    return [...seen.values()];
  }, [rows, list, wearers]);

  // ── Search: part of a name (customer or wearer) or part of a phone number ──
  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const digits = t.replace(/\D/g, "");
    const out: Person[] = [];
    for (const c of list) {
      const phoneHit = digits.length >= 3 && [c.phone, c.code].some((p) => (p ?? "").replace(/\D/g, "").includes(digits));
      if (c.name.toLowerCase().includes(t) || phoneHit || c.code.toLowerCase() === t) out.push({ customer: c, wearer: null, latest: "" });
    }
    for (const w of wearers) {
      if (w.isSelf || !w.name.toLowerCase().includes(t)) continue;
      const c = list.find((x) => x.id === w.customerId);
      if (c) out.push({ customer: c, wearer: w, latest: "" });
    }
    return out.slice(0, 30);
  }, [q, list, wearers]);

  // ── Starting an entry ──
  const begin = (garment: string, how: "last" | "chart" | "empty", chartIndex?: number) => {
    if (!cId) return;
    const wearerId = wId ?? selfOf(cId)?.id ?? null;
    const last = rowsOf(cId, wearerId)
      .filter((r) => r.garmentType === garment)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
    const values = how === "last" && last ? { ...last.values } : how === "chart" && chartIndex != null ? fromSizeChart(garment, sizeChart, chartIndex) : {};
    setStart(null);
    setPickGarment(false);
    setEntry({
      who: `${nameOf(customerOf(cId), wearerOf(wearerId))} · ${garment}`,
      state: {
        customerId: cId,
        wearerId,
        garmentType: garment,
        size: how === "chart" && chartIndex != null ? (sizeChart.sizes[chartIndex] ?? null) : how === "last" ? (last?.size ?? null) : null,
        fit: how === "last" ? (last?.fit ?? "Regular") : "Regular",
        remarks: how === "last" ? (last?.remarks ?? null) : null,
        values,
        previous: last?.values ?? null,
        step: 0,
      },
    });
  };
  const edit = (r: SimpleRow) =>
    setEntry({
      who: `${nameOf(customerOf(r.customerId), wearerOf(r.wearerId))} · ${r.garmentType}`,
      state: {
        customerId: r.customerId,
        wearerId: r.wearerId,
        measurementId: r.id,
        original: { date: r.date, size: r.size, fit: r.fit, remarks: r.remarks, values: r.values },
        garmentType: r.garmentType,
        size: r.size,
        fit: r.fit,
        remarks: r.remarks,
        values: { ...r.values },
        previous: r.values,
        step: 0,
      },
    });
  const resume = (d: Draft) => setEntry({ who: `${nameOf(customerOf(d.customerId), wearerOf(d.wearerId))} · ${d.garmentType}`, state: fromDraft(d) });

  const saved = (who: string) => (r: { id: number; undo: () => Promise<EntryState | null> }) => {
    const reopen = entry;
    setEntry(null);
    router.refresh();
    toast.success("Saved · സേവ് ചെയ്തു", {
      description: who,
      duration: 10_000,
      // Big Undo, no small close button (simple mode: nothing under 56 px)
      closeButton: false,
      classNames: { title: "!text-lg", description: "!text-base", actionButton: "!h-14 !min-w-28 !rounded-xl !px-4 !text-base !font-bold" },
      action: {
        label: "Undo · തിരികെ",
        onClick: async () => {
          const back = await r.undo();
          router.refresh();
          if (back && reopen) setEntry({ who: reopen.who, state: back });
        },
      },
    });
  };

  const scanned = async (code: string) => {
    setScan(false);
    // A bundle label → that garment's job slip PDF
    if (parseItemCode(code)) {
      const j = await jobSlipByCode(code);
      if (!j.ok) return void toast.error(j.error);
      return void (window.location.href = j.data.url);
    }
    const r = await lookupCode(code);
    if (!r.ok) return void toast.error(r.error);
    open(r.data.customerId, r.data.wearerId);
  };

  // ───────────────────────── Screens ─────────────────────────
  const customer = cId ? customerOf(cId) : undefined;
  const people = cId ? wearersOf(cId) : [];
  const multi = people.length > 1;
  // A customer with only Self opens straight on their garments
  const wearer = cId ? (wId ? wearerOf(wId) : multi ? null : selfOf(cId)) : null;

  let screen: React.ReactNode;
  if (!cId) {
    screen = (
      <div className="grid gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="പേര് അല്ലെങ്കിൽ ഫോൺ നമ്പർ"
            aria-label="Name or phone number"
            className="h-16 w-full rounded-2xl border-2 bg-card pr-14 pl-14 font-ml text-xl outline-none focus:border-primary"
            inputMode="search"
          />
          {q && (
            <button type="button" aria-label="Clear" onClick={() => setQ("")} className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-xl hover:bg-muted">
              <X className="size-6" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BigButton onClick={() => setScan(true)} icon={ScanBarcode} ml="സ്കാൻ" en="Scan slip" />
          <BigButton onClick={() => setNewCustomer(true)} icon={UserPlus} ml="പുതിയ കസ്റ്റമർ" en="New customer" />
        </div>

        {drafts.length > 0 && (
          <section className="grid gap-2">
            <h2 className="font-ml text-xl font-bold text-warning">
              തീരാത്തവ <span className="font-sans text-sm font-normal text-muted-foreground">Unfinished — tap to continue</span>
            </h2>
            {drafts.map((d) => {
              const c = customerOf(d.customerId);
              const total = measuringOrder(d.garmentType, order).length;
              return (
                <div key={d.id} className="flex items-stretch gap-2">
                  <button type="button" onClick={() => resume(d)} className="flex min-h-16 flex-1 items-center gap-3 rounded-2xl border-2 border-warning/60 bg-warning/10 px-4 text-left">
                    <History className="size-7 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">
                        {nameOf(c, wearerOf(d.wearerId))} · {d.garmentType}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {Math.min(d.step, total)} / {total} done · {fmtDate(d.updatedAt.slice(0, 10))}
                      </span>
                    </span>
                    <ChevronRight className="size-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Throw away this unfinished entry"
                    onClick={async () => {
                      if (!confirm("Throw away this unfinished entry?")) return;
                      await deleteDraft(d.id);
                      router.refresh();
                    }}
                    className="grid w-14 shrink-0 place-items-center rounded-2xl border-2 text-muted-foreground"
                  >
                    <Trash2 className="size-6" />
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <section className="grid gap-2">
          <h2 className="font-ml text-xl font-bold">
            {q.trim().length >= 2 ? "കണ്ടെത്തിയവ" : "അടുത്തിടെ"} <span className="font-sans text-sm font-normal text-muted-foreground">{q.trim().length >= 2 ? `Found ${results.length}` : "Recent"}</span>
          </h2>
          {(q.trim().length >= 2 ? results : recent).map((p) => (
            <PersonCard key={`${p.customer.id}:${p.wearer?.id ?? "c"}`} p={p} onClick={() => open(p.customer.id, p.wearer?.id)} />
          ))}
          {q.trim().length >= 2 && results.length === 0 && <p className="rounded-2xl border-2 border-dashed p-6 text-center text-lg text-muted-foreground">No one found · ആരെയും കണ്ടില്ല</p>}
          {q.trim().length < 2 && recent.length === 0 && <p className="rounded-2xl border-2 border-dashed p-6 text-center text-lg text-muted-foreground">No measurements yet</p>}
        </section>
        <button
          type="button"
          onClick={async () => {
            await setSimpleMode(false);
            router.refresh();
          }}
          className="mx-auto mt-2 min-h-14 px-4 text-sm text-muted-foreground underline"
        >
          Detailed form · വിശദമായ ഫോം
        </button>
      </div>
    );
  } else if (!customer) {
    screen = <p className="p-6 text-center text-lg">Customer not found.</p>;
  } else if (!wearer) {
    // Choose the person (customer has more than one)
    screen = (
      <div className="grid gap-3">
        <Header title={customer.name} sub={formatPhone(customer.phone)} onBack={home} />
        <p className="font-ml text-xl font-bold">
          ആരുടെ അളവ്? <span className="font-sans text-sm font-normal text-muted-foreground">Whose measurements?</span>
        </p>
        {people.map((w) => (
          <button key={w.id} type="button" onClick={() => open(cId!, w.id)} className="flex min-h-20 items-center gap-3 rounded-2xl border-2 bg-card px-4 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-2xl font-bold">{w.isSelf ? customer.name : w.name}</span>
              <span className="block text-base text-muted-foreground">
                <span className="font-ml">{RELATION_ML[w.relation] ?? w.relation}</span> · {w.isSelf ? "Self" : wearerTitle(w).replace(`${w.name} `, "").replace(/^\(|\)$/g, "")}
              </span>
            </span>
            <span className="shrink-0 text-base text-muted-foreground">{new Set(rowsOf(cId!, w.id).map((r) => r.garmentType)).size} garments</span>
            <ChevronRight className="size-7" />
          </button>
        ))}
        {addPerson ? (
          <AddPersonForm
            customerId={cId!}
            onCancel={() => setAddPerson(false)}
            onAdded={(w) => {
              setAddPerson(false);
              router.refresh();
              open(cId!, w.id);
            }}
          />
        ) : (
          <BigButton onClick={() => setAddPerson(true)} icon={UserPlus} ml="മറ്റൊരാളെ ചേർക്കുക" en="Add another person" />
        )}
      </div>
    );
  } else {
    // One person's garments
    const mine = rowsOf(cId!, wearer.id);
    const latest = mine.filter((r, i) => mine.findIndex((x) => x.garmentType === r.garmentType) === i);
    const title = wearer.isSelf ? customer.name : wearer.name;
    screen = (
      <div className="grid gap-3">
        <Header
          title={title}
          sub={wearer.isSelf ? formatPhone(customer.phone) : `${wearerTitle(wearer).replace(wearer.name, "").trim()} · of ${customer.name} · ${formatPhone(customer.phone)}`}
          onBack={() => (multi ? open(cId!) : home())}
        />
        {drafts
          .filter((d) => d.customerId === cId && (d.wearerId ?? selfOf(cId!)?.id) === wearer.id)
          .map((d) => (
            <button key={d.id} type="button" onClick={() => resume(d)} className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-warning/60 bg-warning/10 px-4 text-left">
              <History className="size-7 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <span className="block font-ml text-lg font-bold">തീരാത്ത {GARMENT_ML[d.garmentType] ?? d.garmentType} — തുടരുക</span>
                <span className="block text-sm text-muted-foreground">
                  Unfinished {d.garmentType} · {Math.min(d.step, measuringOrder(d.garmentType, order).length)} / {measuringOrder(d.garmentType, order).length} done — continue
                </span>
              </span>
              <ChevronRight className="size-6" />
            </button>
          ))}
        <BigButton onClick={() => setPickGarment(true)} icon={Plus} ml="പുതിയ അളവ്" en="New measurement" primary />
        {latest.length === 0 && <p className="rounded-2xl border-2 border-dashed p-6 text-center text-lg text-muted-foreground">No measurements yet · അളവുകൾ ഇല്ല</p>}
        {latest.map((r) => {
          const tailor = tailors.find((t) => t.wearerId === (r.wearerId ?? selfOf(cId!)?.id) && itemMatches(r.garmentType, t.item));
          const earlier = mine.filter((x) => x.garmentType === r.garmentType && x.id !== r.id).length;
          return (
            <BigCard
              key={r.id}
              r={r}
              who={title}
              order={order}
              tailor={tailor ? `${tailor.tailor} · ${tailor.orderNo}` : null}
              earlier={earlier}
              onAgain={() => setStart({ garment: r.garmentType })}
              onEdit={() => edit(r)}
            />
          );
        })}
        {!multi && !addPerson && (
          <button type="button" onClick={() => setAddPerson(true)} className="mx-auto flex min-h-14 items-center gap-2 px-4 text-base text-primary">
            <UserPlus className="size-5" /> Add another person (son, daughter…)
          </button>
        )}
        {addPerson && (
          <AddPersonForm
            customerId={cId!}
            onCancel={() => setAddPerson(false)}
            onAdded={(w) => {
              setAddPerson(false);
              router.refresh();
              open(cId!, w.id);
            }}
          />
        )}
      </div>
    );
  }

  const lastOf = (garment: string) =>
    cId
      ? rowsOf(cId, wId ?? selfOf(cId)?.id ?? null)
          .filter((r) => r.garmentType === garment)
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0]
      : undefined;

  return (
    <div className="mx-auto grid max-w-xl gap-3 pb-10 text-base">
      {screen}

      {/* Which garment */}
      {pickGarment && (
        <Sheet title="ഏത് വസ്ത്രം?" sub="Which garment?" onClose={() => setPickGarment(false)}>
          <div className="grid grid-cols-2 gap-2">
            {GARMENT_TYPES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setPickGarment(false);
                  setStart({ garment: g });
                }}
                className="flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 bg-card px-2 text-center"
              >
                <span className="font-ml text-xl font-bold">{GARMENT_ML[g] ?? g}</span>
                <span className="text-sm text-muted-foreground">{g}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Start from something, not from blank */}
      {start && (
        <StartChoice
          garment={start.garment}
          last={lastOf(start.garment)}
          chart={fromSizeChart(start.garment, sizeChart, 0) && Object.keys(fromSizeChart(start.garment, sizeChart, 0)).length >= 2 ? sizeChart : null}
          onClose={() => setStart(null)}
          onPick={(how, i) => begin(start.garment, how, i)}
        />
      )}

      {entry && <SimpleEntry key={entry.state.draftId ?? entry.who} initial={entry.state} who={entry.who} order={order} autoAdvance={autoAdvance} onClose={() => (setEntry(null), router.refresh())} onSaved={saved(entry.who)} />}

      <BarcodeScanner open={scan} onClose={() => setScan(false)} title="Scan the customer's slip" onResult={scanned} />
      <CustomerDialog
        open={newCustomer}
        onOpenChange={setNewCustomer}
        types={customerTypes}
        onSaved={(c) => {
          setList((l) => [...l, c]);
          setNewCustomer(false);
          router.refresh();
          open(c.id);
        }}
      />
    </div>
  );
}

function Header({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label="Back" className="grid size-14 shrink-0 place-items-center rounded-2xl border-2">
        <ArrowLeft className="size-7" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-3xl leading-tight font-bold">{title}</h1>
        <p className="truncate text-base text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function BigButton({ onClick, icon: Icon, ml, en, primary }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; ml: string; en: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 px-4", primary ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
    >
      <Icon className="size-7 shrink-0" />
      <span className="text-left leading-tight">
        <span className="block font-ml text-lg font-bold">{ml}</span>
        <span className={cn("block text-sm", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{en}</span>
      </span>
    </button>
  );
}

function PersonCard({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border-2 bg-card px-4 text-left active:bg-muted">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xl font-bold">
          {p.wearer ? p.wearer.name : p.customer.name}
          {p.wearer && <span className="ml-2 font-ml text-base font-normal text-muted-foreground">{RELATION_ML[p.wearer.relation] ?? p.wearer.relation}</span>}
        </span>
        <span className="block truncate text-base text-muted-foreground">
          {p.wearer ? `${p.customer.name} · ` : ""}
          {formatPhone(p.customer.phone) || p.customer.code}
        </span>
      </span>
      <ChevronRight className="size-7 shrink-0" />
    </button>
  );
}

/** A saved garment for reading at arm's length: big labelled numbers in two columns. */
function BigCard({
  r,
  who,
  order,
  tailor,
  earlier,
  onAgain,
  onEdit,
}: {
  r: SimpleRow;
  who: string;
  order: Record<string, string[]>;
  tailor: string | null;
  earlier: number;
  onAgain: () => void;
  onEdit: () => void;
}) {
  const fields = measuringOrder(r.garmentType, order).filter((f) => r.values[f.key] != null);
  return (
    <article className="rounded-2xl border-2 bg-card p-4" aria-label={`${who} ${r.garmentType}`}>
      <header className="mb-3 flex items-start gap-2">
        <Shirt className="mt-1 size-7 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-tight font-bold">
            {who} · <span className="font-ml">{GARMENT_ML[r.garmentType] ?? r.garmentType}</span>
          </h2>
          <p className="text-base text-muted-foreground">
            {r.garmentType} · {fmtDate(r.date)}
            {r.size ? ` · Size ${r.size}` : ""}
          </p>
          <p className="text-base">
            <span className="font-ml">തയ്യൽക്കാരൻ</span> <span className="text-muted-foreground">Tailor:</span> <b>{tailor ?? "—"}</b>
          </p>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((f) => {
          const whole = wholeOf(f, r.values[f.key]);
          return (
            <div key={f.key} className="rounded-xl bg-muted/40 px-3 py-2">
              <dt className="font-ml text-lg leading-tight font-semibold">
                {mlOf(f)} <span className="font-sans text-xs font-normal text-muted-foreground">{enOf(f)}</span>
              </dt>
              <dd className="text-4xl leading-tight font-bold tabular-nums">{fmt(r.values[f.key])}</dd>
              {whole != null && <dd className="text-base text-muted-foreground">{f.part!.whole} {whole}</dd>}
            </div>
          );
        })}
      </dl>
      {fields.length === 0 && <p className="text-lg text-muted-foreground">No numbers filled in.</p>}
      {r.remarks && <p className="mt-3 rounded-xl bg-muted/40 p-3 text-lg">{r.remarks}</p>}
      {earlier > 0 && <p className="mt-2 text-sm text-muted-foreground">+ {earlier} earlier record{earlier === 1 ? "" : "s"}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onAgain} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary/10 text-left text-primary">
          <Ruler className="size-6 shrink-0" />
          <span className="leading-tight">
            <span className="block font-ml text-lg font-bold">വീണ്ടും അളക്കുക</span>
            <span className="block text-xs">Measure again</span>
          </span>
        </button>
        <button type="button" onClick={onEdit} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 text-left">
          <Pencil className="size-6 shrink-0" />
          <span className="leading-tight">
            <span className="block font-ml text-lg font-bold">തിരുത്തുക</span>
            <span className="block text-xs text-muted-foreground">Correct this</span>
          </span>
        </button>
      </div>
    </article>
  );
}

/** Three ways to begin: same as last time (default when there is one), from the size chart, or empty. */
function StartChoice({
  garment,
  last,
  chart,
  onPick,
  onClose,
}: {
  garment: string;
  last: SimpleRow | undefined;
  chart: { sizes: string[] } | null;
  onPick: (how: "last" | "chart" | "empty", chartIndex?: number) => void;
  onClose: () => void;
}) {
  const [sizes, setSizes] = React.useState(false);
  return (
    <Sheet title={GARMENT_ML[garment] ?? garment} sub={`${garment} — how to start?`} onClose={onClose}>
      {sizes && chart ? (
        <div className="grid gap-2">
          <p className="font-ml text-lg font-bold">
            സൈസ് <span className="font-sans text-sm font-normal text-muted-foreground">Size from the chart</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {chart.sizes.map((s, i) => (
              <button key={s} type="button" onClick={() => onPick("chart", i)} className="min-h-16 rounded-2xl border-2 bg-card text-2xl font-bold">
                {s}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSizes(false)} className="min-h-14 text-base text-muted-foreground underline">
            Back
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {last && (
            <button type="button" autoFocus onClick={() => onPick("last")} className="flex min-h-20 items-center gap-3 rounded-2xl border-[3px] border-primary bg-primary text-left text-primary-foreground">
              <History className="ml-4 size-8 shrink-0" />
              <span className="leading-tight">
                <span className="block font-ml text-xl font-bold">കഴിഞ്ഞ തവണത്തെ പോലെ</span>
                <span className="block text-base">Same as last time · {fmtDate(last.date)}</span>
              </span>
            </button>
          )}
          {chart && (
            <button type="button" onClick={() => setSizes(true)} className="flex min-h-20 items-center gap-3 rounded-2xl border-2 bg-card text-left">
              <Sparkles className="ml-4 size-8 shrink-0 text-gold" />
              <span className="leading-tight">
                <span className="block font-ml text-xl font-bold">സൈസ് ചാർട്ടിൽ നിന്ന്</span>
                <span className="block text-base text-muted-foreground">From size chart (S / M / L / XL…)</span>
              </span>
            </button>
          )}
          <button type="button" onClick={() => onPick("empty")} className="flex min-h-20 items-center gap-3 rounded-2xl border-2 bg-card text-left">
            <Plus className="ml-4 size-8 shrink-0" />
            <span className="leading-tight">
              <span className="block font-ml text-xl font-bold">ഒഴിഞ്ഞതിൽ തുടങ്ങുക</span>
              <span className="block text-base text-muted-foreground">Start empty</span>
            </span>
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** A bottom sheet with big targets (no small close icon: the whole top bar closes it). */
function Sheet({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={sub}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-4 sm:max-w-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-ml text-2xl font-bold">{title}</p>
            <p className="text-base text-muted-foreground">{sub}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-14 shrink-0 place-items-center rounded-2xl border-2">
            <X className="size-7" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
