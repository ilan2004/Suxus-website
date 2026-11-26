"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field } from "@/components/app/field";
import { ListSelect, SearchSelect } from "@/components/app/search-select";
import { saveBulkOrder, type BulkInput } from "@/lib/actions/bulk";
import { addDays, cn, round2, rupees, today } from "@/lib/utils";
import { listPriceFor, rateChanged, type PriceRow } from "@/lib/stitching-prices";
import { variantsFor, type VariantLists } from "@/lib/variants";
import Link from "next/link";

type Line = { key: string; item: string; description: string; size: string; qty: string; rate: string; variant: string | null; listRate: number | null; rateChangedBy: string | null };
type Prices = { list: PriceRow[]; variants: VariantLists } | null;

/**
 * The bulk / institution rate (else the customer rate) filled in — never 0. A rate typed by hand is kept: on a new line
 * (size grid) it stays as typed, and on a changed line it stays when the new garment has no price.
 */
function priced(next: Line, prices: Prices, prev?: Line): Line {
  if (!prices) return next;
  const list = listPriceFor(prices.list, next.item, next.variant, true);
  let rate: string;
  if (!prev) rate = next.rate !== "" ? next.rate : list != null ? String(list) : "";
  else if (list != null) rate = String(list);
  else rate = prev.rate !== "" && Number(prev.rate) !== prev.listRate ? next.rate : "";
  return { ...next, listRate: list, rate, rateChangedBy: null };
}

export type BulkInitial = Omit<Partial<BulkInput>, "items"> & {
  id?: number;
  orderNo?: string;
  items?: { item: string; description: string | null; size: string | null; qty: number; rate: number; variant?: string | null; listRate?: number | null; rateChangedBy?: string | null }[];
};

const newLine = (p: Partial<Line> = {}): Line => ({ key: crypto.randomUUID(), item: "School Shirt", description: "", size: "", qty: "", rate: "", variant: null, listRate: null, rateChangedBy: null, ...p });

export function BulkForm({
  initial,
  staff,
  lists,
  institutions,
  prices = null,
}: {
  /** Stitching price list + variants (null before that database update) */
  prices?: Prices;
  initial?: BulkInitial;
  staff: { id: number; name: string }[];
  lists: { item: string[]; status: string[]; paymentMode: string[] };
  institutions: { institution: string; contactPerson: string | null; phone: string | null; address: string | null; gstin: string | null }[];
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [v, setV] = React.useState({
    date: initial?.date ?? today(),
    institution: initial?.institution ?? "",
    address: initial?.address ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    gstin: initial?.gstin ?? "",
    fabricBy: initial?.fabricBy ?? "Shop",
    deliveryDate: initial?.deliveryDate ?? addDays(today(), 21),
    status: initial?.status ?? "Booked",
    broughtById: initial?.broughtById ?? null,
    discount: initial?.discount ? String(initial.discount) : "",
    gstPct: initial?.gstPct ? String(initial.gstPct) : "",
    remarks: initial?.remarks ?? "",
  });
  const [lines, setLines] = React.useState<Line[]>(
    initial?.items?.length
      ? initial.items.map((i) => newLine({ item: i.item, description: i.description ?? "", size: i.size ?? "", qty: String(i.qty), rate: String(i.rate), variant: i.variant ?? null, listRate: i.listRate ?? null, rateChangedBy: i.rateChangedBy ?? null }))
      : [priced(newLine(), prices)],
  );
  const [advance, setAdvance] = React.useState("");
  const [advanceMode, setAdvanceMode] = React.useState(lists.paymentMode[0] ?? "Cash");
  const [pending, start] = React.useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const upd = (key: string, p: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...p };
        if (prices && "item" in p && next.variant && !variantsFor(next.item, prices.variants).includes(next.variant)) next.variant = null;
        // a different garment or variant: refill from the price list
        return prices && (next.item !== l.item || next.variant !== l.variant) ? priced(next, prices, l) : next;
      }),
    );
  const noRate = (l: Line) => !!prices && l.listRate == null && !(Number(l.rate) > 0) && !!l.item;

  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0));
  const taxable = round2(subtotal - (Number(v.discount) || 0));
  const gst = round2((taxable * (Number(v.gstPct) || 0)) / 100);
  const total = round2(taxable + gst);
  const pieces = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = lines.filter((l) => l.item && Number(l.qty) > 0);
    if (!filled.length) return void toast.error("Add at least one line with quantity");
    const unpriced = filled.filter(noRate);
    if (unpriced.length && !window.confirm(`No stitching rate for ${[...new Set(unpriced.map((l) => `${l.item}${l.variant ? ` (${l.variant})` : ""}`))].join(", ")} — those lines will be ₹0. Save anyway?`)) return;
    start(async () => {
      const r = await saveBulkOrder({
        id: initial?.id,
        ...v,
        broughtById: v.broughtById,
        discount: Number(v.discount) || 0,
        gstPct: Number(v.gstPct) || 0,
        items: filled.map((l) => ({ item: l.item, description: l.description || null, size: l.size || null, qty: Number(l.qty), rate: Number(l.rate) || 0, variant: l.variant, listRate: l.listRate, rateChangedBy: l.rateChangedBy })),
        advance: editing ? 0 : Number(advance) || 0,
        advanceMode,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Order updated" : `Bulk order ${r.data.orderNo} saved`);
      router.push(`/bulk/${r.data.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-5">
        <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-xs sm:grid-cols-2">
          <h2 className="font-display font-semibold sm:col-span-2">
            Institution <span className="ml">സ്ഥാപനം</span>
          </h2>
          <Field label="Institution / school" ml="സ്ഥാപനം" required className="sm:col-span-2">
            <SearchSelect
              options={institutions.map((i) => ({ value: i.institution, label: i.institution, sub: i.contactPerson ?? "" }))}
              value={v.institution || null}
              onChange={(val) => {
                const inst = institutions.find((i) => i.institution === val);
                setV((s) => ({
                  ...s,
                  institution: val ?? "",
                  contactPerson: inst?.contactPerson ?? s.contactPerson,
                  phone: inst?.phone ?? s.phone,
                  address: inst?.address ?? s.address,
                  gstin: inst?.gstin ?? s.gstin,
                }));
              }}
              onCreate={(q) => set("institution", q)}
              createLabel="Use new name"
              placeholder="Search or type a new institution"
            />
          </Field>
          <Field label="Contact person" ml="ബന്ധപ്പെടേണ്ടയാൾ">
            <Input value={v.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
          </Field>
          <Field label="Phone" ml="ഫോൺ">
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Address" ml="വിലാസം">
            <Input value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Their GSTIN" hint="Optional — printed on the invoice">
            <Input value={v.gstin} onChange={(e) => set("gstin", e.target.value)} />
          </Field>
          <Field label="Order date" ml="തീയതി">
            <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Delivery date" ml="ഡെലിവറി">
            <Input type="date" value={v.deliveryDate ?? ""} onChange={(e) => set("deliveryDate", e.target.value)} />
          </Field>
          <Field label="Fabric by" ml="തുണി ആര്">
            <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted p-0.5">
              {["Shop", "Institution"].map((f) => (
                <button key={f} type="button" onClick={() => set("fabricBy", f)} className={cn("h-8 rounded text-sm", v.fabricBy === f ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Brought by" ml="ആര് പിടിച്ചു" hint="Used for incentive">
            <SearchSelect
              options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
              value={v.broughtById ? String(v.broughtById) : null}
              onChange={(x) => set("broughtById", x ? Number(x) : null)}
              allowClear
              placeholder="Optional"
            />
          </Field>
          {editing && (
            <Field label="Status" ml="സ്റ്റാറ്റസ്">
              <ListSelect items={lists.status} value={v.status} onChange={(x) => set("status", x ?? "Booked")} />
            </Field>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold">
              Items · one line per size <span className="ml">ഓരോ സൈസിനും ഒരു വരി</span>
            </h2>
            <div className="flex gap-2">
              <SizeGrid items={lists.item} variants={prices?.variants ?? null} onAdd={(ls) => setLines((cur) => [...cur.filter((l) => l.qty || l.rate || l.size), ...ls.map((l) => priced(l, prices))])} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((ls) => {
                    const last = ls.at(-1);
                    return [...ls, newLine({ item: last?.item ?? "School Shirt", description: last?.description ?? "", rate: last?.rate ?? "", variant: last?.variant ?? null, listRate: last?.listRate ?? null })];
                  })
                }
              >
                <Plus /> Line
              </Button>
            </div>
          </div>
          <div className="hidden grid-cols-[1.2fr_1.4fr_70px_70px_90px_90px_32px] gap-2 px-1 text-xs text-muted-foreground md:grid">
            <span>Item</span>
            <span>Description (colour / design)</span>
            <span>Size</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-3 gap-2 border-b pb-3 md:grid-cols-[1.2fr_1.4fr_70px_70px_90px_90px_32px] md:items-center md:border-0 md:pb-0">
              <ListSelect items={lists.item} value={l.item} onChange={(x) => upd(l.key, { item: x ?? "" })} className="col-span-3 md:col-span-1" />
              <Input value={l.description} onChange={(e) => upd(l.key, { description: e.target.value })} placeholder="e.g. Blue check" className="col-span-3 md:col-span-1" />
              <Input value={l.size} onChange={(e) => upd(l.key, { size: e.target.value })} placeholder="Size" />
              <Input type="number" min={0} value={l.qty} onChange={(e) => upd(l.key, { qty: e.target.value })} className="text-right" placeholder="Qty" />
              <Input
                type="number"
                min={0}
                value={l.rate}
                aria-label="Rate"
                onChange={(e) => upd(l.key, { rate: e.target.value })}
                className={cn("text-right", noRate(l) && "border-warning", rateChanged(Number(l.rate) || 0, l.listRate) && "border-gold")}
                placeholder={noRate(l) ? "no rate" : "₹"}
              />
              <span className="self-center text-right text-sm font-medium tabular-nums">{rupees((Number(l.qty) || 0) * (Number(l.rate) || 0))}</span>
              <Button type="button" variant="ghost" size="icon-sm" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                <Trash2 className="text-muted-foreground" />
              </Button>
              {prices && variantsFor(l.item, prices.variants).length > 0 && (
                <div className="col-span-3 flex flex-wrap items-center gap-1.5 md:col-span-7">
                  <span className="text-xs text-muted-foreground">
                    <span className="ml">തരം</span> · Variant
                  </span>
                  {variantsFor(l.item, prices.variants).map((v) => (
                    <button key={v} type="button" aria-pressed={l.variant === v} onClick={() => upd(l.key, { variant: l.variant === v ? null : v })} className={cn("h-7 rounded border px-2 text-xs", l.variant === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
                      {v}
                    </button>
                  ))}
                </div>
              )}
              {noRate(l) && (
                <p className="col-span-3 rounded-md bg-warning/15 px-2 py-1 text-xs font-medium md:col-span-7" data-testid="no-rate">
                  ⚠ No stitching rate set for this garment ({l.item}
                  {l.variant ? ` — ${l.variant}` : ""}). Type the rate, or{" "}
                  <Link href="/settings/stitching-prices" target="_blank" className="underline">
                    set it in Stitching Prices
                  </Link>
                  .
                </p>
              )}
              {rateChanged(Number(l.rate) || 0, l.listRate) && (
                <p className="col-span-3 text-xs text-[#8a6a2a] md:col-span-7 dark:text-gold" data-testid="rate-changed">
                  Rate changed — list price {rupees(l.listRate!)}
                  {l.rateChangedBy ? ` · changed by ${l.rateChangedBy}` : ""}
                </p>
              )}
            </div>
          ))}
          <Field label="Remarks" ml="കുറിപ്പ്">
            <Textarea value={v.remarks} onChange={(e) => set("remarks", e.target.value)} rows={2} />
          </Field>
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-20">
        <div className="grid gap-2 rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-1 font-display font-semibold">{editing ? initial?.orderNo : "Summary"}</h2>
          <Row label={`Sub total · ${pieces} pcs`} value={rupees(subtotal, true)} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <Input type="number" min={0} value={v.discount} onChange={(e) => set("discount", e.target.value)} className="h-8 w-28 text-right" placeholder="0" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GST %</span>
            <Input type="number" min={0} max={28} value={v.gstPct} onChange={(e) => set("gstPct", e.target.value)} className="h-8 w-28 text-right" placeholder="0 (not registered)" />
          </div>
          {gst > 0 && <Row label="GST amount" value={rupees(gst, true)} />}
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{rupees(total, true)}</span>
          </div>
          {!editing && (
            <div className="mt-2 grid gap-2 rounded-lg bg-muted/50 p-3">
              <Field label="Advance received" ml="അഡ്വാൻസ്">
                <Input type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} className="text-right font-semibold" placeholder="0" />
              </Field>
              <div className="flex flex-wrap gap-1">
                {lists.paymentMode
                  .filter((m) => m !== "Credit (Due)")
                  .map((m) => (
                    <button key={m} type="button" onClick={() => setAdvanceMode(m)} className={cn("h-7 rounded border px-2 text-xs", advanceMode === m ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                      {m}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <Button type="submit" size="lg" className="mt-2 h-12 text-base" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} {editing ? "Save changes" : "Save bulk order"}
          </Button>
        </div>
      </aside>
    </form>
  );
}

function SizeGrid({ items, variants, onAdd }: { items: string[]; variants: VariantLists | null; onAdd: (lines: Line[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [item, setItem] = React.useState("School Shirt");
  const [variant, setVariant] = React.useState<string | null>(null);
  const options = variants ? variantsFor(item, variants) : [];
  const [desc, setDesc] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [sizes, setSizes] = React.useState("22, 24, 26, 28, 30, 32, 34, 36");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="gold" size="sm">
          <Grid3x3 /> Size grid
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <p className="text-sm font-medium">Add one line for every size</p>
        <ListSelect
          items={items}
          value={item}
          onChange={(x) => {
            setItem(x ?? "");
            setVariant(null);
          }}
        />
        {options.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {options.map((v) => (
              <button key={v} type="button" onClick={() => setVariant(variant === v ? null : v)} className={cn("h-7 rounded border px-2 text-xs", variant === v ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                {v}
              </button>
            ))}
          </div>
        )}
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (e.g. Blue check)" />
        <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={variants ? "Rate ₹ (empty = from Stitching Prices)" : "Rate per piece ₹"} />
        <Input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="Sizes, comma separated" />
        <Button
          type="button"
          onClick={() => {
            const list = sizes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
            if (!list.length) return;
            onAdd(list.map((size) => newLine({ item, description: desc, rate, size, variant })));
            setOpen(false);
          }}
        >
          Add {sizes.split(/[,\s]+/).filter(Boolean).length} lines
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
