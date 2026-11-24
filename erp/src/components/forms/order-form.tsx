"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShoppingBag, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/field";
import { ListSelect, SearchSelect } from "@/components/app/search-select";
import { CustomerPicker } from "./customer-picker";
import { AddPersonForm, WearerSelect, useWearers } from "./wearer-picker";
import { measurementsForRequirement } from "@/lib/actions/fabric-req";
import { fabricRequirement, measureFor, metres, requirementText, shortText, type FabricRequirementTables, type ReqMeasure, type Requirement } from "@/lib/fabric-requirement";
import type { CustomerLite } from "./customer-dialog";
import { saveOrder, type OrderInput } from "@/lib/actions/orders";
import { addDays, cn, fmtDate, num, round2, rupees, today } from "@/lib/utils";

type Item = { key: string; /** existing order item (kept on save, so its bundle label stays valid) */ id?: number; item: string; qty: string; rate: string; tailorId: number | null; /** whose garment (null = Self) */ wearerId: number | null; /** fabric it is cut from (fabric requirement) */ fabricId?: number | null };
export type LinkedSale = { id: number; billNo: string; date: string; net: number; items: string; customerId: number | null; customerName: string | null; phone: string | null; /** fabric + metres on the bill */ fabrics?: { fabricId: number | null; metres: number }[] };
export type OrderInitial = Omit<Partial<OrderInput>, "items"> & { id?: number; orderNo?: string; items?: { id?: number; item: string; qty: number; rate: number; tailorId?: number | null; wearerId?: number | null; fabricId?: number | null }[] };

export function OrderForm({
  initial,
  customers,
  staff,
  lists,
  sale,
  unlinkedSales,
  rates,
  days,
  fabricReq,
}: {
  initial?: OrderInitial;
  customers: CustomerLite[];
  staff: { id: number; name: string; role: string | null }[];
  lists: { workType: string[]; item: string[]; status: string[]; paymentMode: string[]; customerType: string[] };
  sale?: LinkedSale | null;
  unlinkedSales: LinkedSale[];
  rates: Record<string, number>;
  days: { normal: number; express: number };
  /** Fabric requirement: tables (Settings), fabrics with balance, and whether a garment can have its own fabric */
  fabricReq?: { tables: FabricRequirementTables; enabled: boolean; fabrics: { id: number; code: string; name: string; balance: number }[] };
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [customer, setCustomer] = React.useState<CustomerLite | null>(
    customers.find((c) => c.id === (initial?.customerId ?? sale?.customerId)) ?? null,
  );
  const [walkIn, setWalkIn] = React.useState({ name: initial?.customerName ?? sale?.customerName ?? "", phone: initial?.phone ?? sale?.phone ?? "" });
  const [date, setDate] = React.useState(initial?.date ?? today());
  const [workType, setWorkType] = React.useState(initial?.workType ?? (sale ? "Shop Fabric Stitching" : lists.workType[0]));
  const [urgency, setUrgency] = React.useState(initial?.urgency ?? "Normal");
  const [deliveryDate, setDeliveryDate] = React.useState(initial?.deliveryDate ?? addDays(today(), days.normal));
  const [deliveryTouched, setDeliveryTouched] = React.useState(editing);
  const [trialDate, setTrialDate] = React.useState(initial?.trialDate ?? "");
  const [status, setStatus] = React.useState(initial?.status ?? "Booked");
  const [broughtById, setBroughtById] = React.useState<number | null>(initial?.broughtById ?? null);
  const [linked, setLinked] = React.useState<LinkedSale | null>(sale ?? null);
  const [discount, setDiscount] = React.useState(initial?.discount ? String(initial.discount) : "");
  const [advance, setAdvance] = React.useState("");
  const [advanceMode, setAdvanceMode] = React.useState(lists.paymentMode[0] ?? "Cash");
  const [remarks, setRemarks] = React.useState(initial?.remarks ?? "");
  const [items, setItems] = React.useState<Item[]>(
    initial?.items?.length
      ? initial.items.map((i) => ({ key: crypto.randomUUID(), id: i.id, fabricId: i.fabricId ?? null, item: i.item, qty: String(i.qty), rate: String(i.rate), tailorId: i.tailorId ?? null, wearerId: i.wearerId ?? null }))
      : [{ key: crypto.randomUUID(), item: workType === "Alteration" ? "Alteration - Other" : "Shirt", qty: "1", rate: "", tailorId: null, wearerId: null }],
  );
  // People measured under this customer: the "whose garment" picker appears once there is more than Self
  const people = useWearers(customer?.id);
  const [addingPerson, setAddingPerson] = React.useState(false);
  const showWho = !!customer && people.many;
  const whoOf = (i: Item) => i.wearerId ?? people.self?.id ?? null;
  // A different customer → their people; items go back to Self
  const prevCustomer = React.useRef(customer?.id);
  React.useEffect(() => {
    if (prevCustomer.current === customer?.id) return;
    prevCustomer.current = customer?.id;
    setItems((is) => is.map((i) => ({ ...i, wearerId: null })));
    setAddingPerson(false);
  }, [customer?.id]);
  const [pending, start] = React.useTransition();
  // ── Fabric requirement (estimate only — stock is reduced by the bill, never by the order) ──
  const [reqData, setReqData] = React.useState<{ measures: ReqMeasure[]; selfId: number | null }>({ measures: [], selfId: null });
  React.useEffect(() => {
    let live = true;
    if (!customer?.id || !fabricReq) return void setReqData({ measures: [], selfId: null });
    measurementsForRequirement(customer.id).then((d) => live && setReqData(d));
    return () => {
      live = false;
    };
  }, [customer?.id, fabricReq]);

  // Expected delivery = order date + 2 days (Normal) or + 1 day (Express), unless typed by hand.
  React.useEffect(() => {
    if (!deliveryTouched) setDeliveryDate(addDays(date, urgency === "Express" ? days.express : days.normal));
  }, [date, urgency, deliveryTouched, days]);

  const stitching = round2(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0));
  const fabricPlan = React.useMemo(() => {
    if (!fabricReq) return null;
    // the order's bill: those metres are already off the stock balance but set aside for this order
    const billed = new Map<number, number>();
    for (const f of linked?.fabrics ?? []) if (f.fabricId) billed.set(f.fabricId, (billed.get(f.fabricId) ?? 0) + Number(f.metres));
    const onlyBill = billed.size === 1 ? [...billed.keys()][0] : null;
    const per = new Map<string, { req: Requirement | null; fabricId: number | null }>();
    const sums = new Map<number, number>();
    for (const i of items) {
      const m = measureFor(reqData.measures, i.item, customer ? (i.wearerId ?? reqData.selfId) : null, reqData.selfId);
      const req = fabricRequirement(fabricReq.tables, i.item, Number(i.qty) || 1, m);
      const fabricId = i.fabricId ?? onlyBill;
      per.set(i.key, { req, fabricId });
      if (fabricId && req?.ok) sums.set(fabricId, (sums.get(fabricId) ?? 0) + req.total);
    }
    const totals = [...sums.entries()].map(([id, need]) => {
      const f = fabricReq.fabrics.find((x) => x.id === id);
      const available = round2((f?.balance ?? 0) + (billed.get(id) ?? 0));
      return { id, code: f?.code ?? "?", name: f?.name ?? "", need: round2(need), available, short: available < need };
    });
    return { per, totals, onlyBill };
  }, [fabricReq, items, reqData, linked, customer]);
  const fabric = linked?.net ?? 0;
  const total = round2(stitching + fabric - (Number(discount) || 0));
  const adv = Number(advance) || 0;

  const updateItem = (key: string, patch: Partial<Item>) => setItems((is) => is.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const tailors = staff;
  const tailorName = (id: number | null) => (id ? (staff.find((x) => x.id === id)?.name ?? "?") : null);
  // A new item takes the tailor picked last — one tap for the usual "same tailor for everything"
  const lastTailor = React.useRef<number | null>(initial?.items?.findLast?.((i) => i.tailorId)?.tailorId ?? null);
  // "With: Shamshu (shirt), Mujeeb (pant)" — read only, from the item rows
  const withSummary = (() => {
    const by = new Map<string, string[]>();
    for (const i of items) {
      const n = tailorName(i.tailorId) ?? "Not assigned";
      by.set(n, [...(by.get(n) ?? []), (i.item || "item").toLowerCase()]);
    }
    return [...by.entries()].map(([n, its]) => `${n} (${[...new Set(its)].join(", ")})`).join(", ");
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.item || !(Number(i.qty) > 0))) return void toast.error("Every item needs a name and quantity");
    start(async () => {
      const r = await saveOrder({
        id: initial?.id,
        date,
        customerId: customer?.id ?? null,
        customerName: customer ? null : walkIn.name || null,
        phone: customer ? null : walkIn.phone || null,
        workType,
        urgency,
        trialDate: trialDate || null,
        deliveryDate: deliveryDate || null,
        status,
        broughtById,
        saleId: linked?.id ?? null,
        discount: Number(discount) || 0,
        remarks: remarks || null,
        items: items.map((i) => ({ id: i.id, fabricId: fabricReq?.enabled ? (i.fabricId ?? null) : null, item: i.item, qty: Number(i.qty), rate: Number(i.rate) || 0, tailorId: i.tailorId, wearerId: customer ? whoOf(i) : null })),
        advance: editing ? 0 : adv,
        advanceMode,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Order updated" : `Order ${r.data.orderNo} booked`);
      router.push(`/orders/${r.data.id}${editing ? "" : "?print=1"}`);
    });
  };

  const candidateSales = unlinkedSales.filter((s) => !customer || s.customerId === customer.id || !s.customerId);

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="grid content-start gap-5">
        <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="font-display font-semibold">Customer & work <span className="ml">കസ്റ്റമർ / വർക്ക്</span></h2>
          <Field label="Customer" ml="കസ്റ്റമർ" required>
            <CustomerPicker customers={customers} types={lists.customerType} value={customer?.id} onChange={setCustomer} />
          </Field>
          {!customer && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="or type name" value={walkIn.name} onChange={(e) => setWalkIn((w) => ({ ...w, name: e.target.value }))} />
              <Input placeholder="phone (+971… if abroad)" inputMode="tel" value={walkIn.phone} onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))} />
            </div>
          )}
          <Field label="Work type" ml="വർക്ക് തരം" required>
            <div className="flex flex-wrap gap-1.5">
              {lists.workType
                .filter((w) => !["Bulk / Institution", "Readymade Sale"].includes(w))
                .map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWorkType(w)}
                    className={cn("h-9 rounded-md border px-3 text-sm", workType === w ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
                  >
                    {w}
                  </button>
                ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Order date" ml="തീയതി">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Urgency" ml="അടിയന്തരം">
              <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted p-0.5">
                {["Normal", "Express"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUrgency(u);
                      setDeliveryTouched(false);
                    }}
                    className={cn("h-8 rounded text-sm", urgency === u ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
                  >
                    {u === "Express" && <Zap className="mr-1 inline size-3.5 text-warning" />}
                    {u}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Trial date" ml="ട്രയൽ">
              <Input type="date" value={trialDate ?? ""} onChange={(e) => setTrialDate(e.target.value)} />
            </Field>
            <Field label="Delivery date" ml="ഡെലിവറി" hint={!deliveryTouched ? "Auto · ഓട്ടോ" : undefined}>
              <Input
                type="date"
                value={deliveryDate ?? ""}
                onChange={(e) => {
                  setDeliveryDate(e.target.value);
                  setDeliveryTouched(true);
                }}
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Items <span className="ml">ഐറ്റം</span></h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((is) => [...is, { key: crypto.randomUUID(), item: "Pant", qty: "1", rate: "", tailorId: lastTailor.current ?? is.findLast((x) => x.tailorId)?.tailorId ?? null, wearerId: is.at(-1)?.wearerId ?? null }])}
            >
              <Plus /> Add item
            </Button>
          </div>
          <div className="hidden grid-cols-[1fr_70px_100px_150px_100px_36px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span>Tailor</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {items.map((i) => (
            <div key={i.key} className="grid grid-cols-[1fr_70px_90px] gap-2 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_70px_100px_150px_100px_36px] sm:items-center sm:border-0 sm:pb-0">
              {showWho && (
                <div className="col-span-3 flex items-center gap-2 sm:col-span-6">
                  <span className="shrink-0 text-xs text-muted-foreground">For · ആൾ</span>
                  <WearerSelect wearers={people.wearers} value={whoOf(i)} onChange={(id) => updateItem(i.key, { wearerId: id })} className="flex-1 sm:max-w-xs" />
                </div>
              )}
              <ListSelect items={lists.item} value={i.item} onChange={(v) => updateItem(i.key, { item: v ?? "" })} className="col-span-3 sm:col-span-1" />
              <Input type="number" min={1} step={1} value={i.qty} onChange={(e) => updateItem(i.key, { qty: e.target.value })} className="text-right" />
              <Input type="number" min={0} step={10} value={i.rate} onChange={(e) => updateItem(i.key, { rate: e.target.value })} className="text-right" placeholder="0" />
              <select
                aria-label="Tailor"
                value={i.tailorId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  if (id) lastTailor.current = id;
                  updateItem(i.key, { tailorId: id });
                }}
                className={cn("col-span-2 h-9 min-w-0 rounded-md border border-input bg-card px-2 text-sm sm:col-span-1 sm:order-none", !i.tailorId && "text-muted-foreground")}
              >
                <option value="">Tailor: not assigned</option>
                {tailors.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tailor: {t.name}
                  </option>
                ))}
              </select>
              <span className="self-center text-right font-medium tabular-nums">{rupees((Number(i.qty) || 0) * (Number(i.rate) || 0))}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={items.length === 1}
                onClick={() => setItems((is) => is.filter((x) => x.key !== i.key))}
                aria-label="Remove item"
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
              {fabricReq && fabricPlan && (
                <FabricReqLine
                  plan={fabricPlan.per.get(i.key)}
                  totals={fabricPlan.totals}
                  qty={Number(i.qty) || 1}
                  enabled={fabricReq.enabled}
                  fabrics={fabricReq.fabrics}
                  value={i.fabricId ?? null}
                  fromBill={fabricPlan.onlyBill}
                  onChange={(id) => updateItem(i.key, { fabricId: id })}
                />
              )}
            </div>
          ))}
          {fabricPlan && fabricPlan.totals.length > 0 && items.length > 1 && <FabricTotals totals={fabricPlan.totals} />}
          {customer && people.wearers.length > 0 &&
            (addingPerson ? (
              <AddPersonForm
                customerId={customer.id}
                onCancel={() => setAddingPerson(false)}
                onAdded={(w) => {
                  people.add(w);
                  setAddingPerson(false);
                  // a new item row for the new person (existing items keep their person)
                  setItems((is) => {
                    const last = is.at(-1);
                    return [...is, { key: crypto.randomUUID(), item: last?.item ?? "Shirt", qty: "1", rate: "", tailorId: last?.tailorId ?? null, wearerId: w.id }];
                  });
                }}
              />
            ) : (
              <button type="button" onClick={() => setAddingPerson(true)} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Plus className="size-3.5" /> Add another person (son, daughter…)
              </button>
            ))}
        </section>

        {(workType === "Shop Fabric Stitching" || linked) && (
        <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="font-display font-semibold">
            Shop fabric <span className="ml">ഷോപ്പ് തുണി (Fabric Sale ബിൽ)</span>
          </h2>
          {linked ? (
            <div className="flex items-center gap-3 rounded-lg border border-gold/50 bg-gold/10 p-3">
              <ShoppingBag className="size-5 text-[#8a6a2a] dark:text-gold" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {linked.billNo} · {fmtDate(linked.date)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{linked.items}</p>
              </div>
              <span className="font-semibold tabular-nums">{rupees(linked.net, true)}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setLinked(null)} aria-label="Unlink">
                <X />
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <SearchSelect
                options={candidateSales.map((s) => ({ value: String(s.id), label: `${s.billNo} · ${s.customerName ?? "Walk-in"}`, sub: `${rupees(s.net)} · ${s.items}` }))}
                value={null}
                onChange={(v) => setLinked(candidateSales.find((s) => String(s.id) === v) ?? null)}
                placeholder="Link an existing fabric bill (FS-…)"
              />
              {editing && initial?.id ? (
                <Button type="button" variant="outline" asChild>
                  <Link href={`/sales/new?order=${initial.id}${customer ? `&customer=${customer.id}` : ""}`}>
                    <Plus /> Sell fabric for this order
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            The fabric amount is added to this order&apos;s total and removed from separate fabric income — counted once.
          </p>
        </section>
        )}

        <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-xs sm:grid-cols-3">
          <Field label="With" ml="ആരുടെ കയ്യിൽ" hint="Set the tailor on each item above">
            <p className="min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm">{withSummary}</p>
          </Field>
          <Field label="Brought by" ml="ആര് കൊണ്ടുവന്നു" hint="Used for incentive">
            <SearchSelect
              options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
              value={broughtById ? String(broughtById) : null}
              onChange={(v) => setBroughtById(v ? Number(v) : null)}
              allowClear
              placeholder="Optional"
            />
          </Field>
          {editing && (
            <Field label="Status" ml="സ്റ്റാറ്റസ്">
              <ListSelect items={lists.status} value={status} onChange={(v) => setStatus(v ?? "Booked")} />
            </Field>
          )}
          <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-3">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Style, collar, pocket, special instructions…" />
          </Field>
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-20">
        <div className="grid gap-2 rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-1 font-display font-semibold">{editing ? initial?.orderNo : "Summary"}</h2>
          <Sum label="Stitching" value={rupees(stitching, true)} />
          <Sum label="Fabric (linked bill)" value={rupees(fabric, true)} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discount · കിഴിവ്</span>
            <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-28 text-right" placeholder="0" />
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total · തുക</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{rupees(total, true)}</span>
          </div>
          {!editing && (
            <>
              <div className="mt-2 grid gap-2 rounded-lg bg-muted/50 p-3">
                <Field label="Advance received" ml="അഡ്വാൻസ്">
                  <Input type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} className="text-right text-base font-semibold" placeholder="0" />
                </Field>
                <div className="flex flex-wrap gap-1">
                  {lists.paymentMode
                    .filter((m) => m !== "Credit (Due)")
                    .map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAdvanceMode(m)}
                        className={cn("h-7 rounded border px-2 text-xs", advanceMode === m ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
                      >
                        {m}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Balance · ബാക്കി</span>
                <span className={cn("font-display text-lg font-semibold tabular-nums", total - adv > 0 && "text-destructive")}>{rupees(round2(total - adv), true)}</span>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">Delivery {fmtDate(deliveryDate)} · {num(items.reduce((s, i) => s + (Number(i.qty) || 0), 0))} pcs</p>
          <Button type="submit" size="lg" className="mt-2 h-12 text-base" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} {editing ? "Save changes" : "Book order & print"}
          </Button>
        </div>
      </aside>
    </form>
  );
}

function Sum({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Under a garment: "തുണി വേണ്ടത്: 1.70 മീറ്റർ" with the rule that decided it, the fabric it is cut from, and a warning
 * (never a block) when that fabric is short.
 */
function FabricReqLine({
  plan,
  totals,
  qty,
  enabled,
  fabrics,
  value,
  fromBill,
  onChange,
}: {
  plan: { req: Requirement | null; fabricId: number | null } | undefined;
  totals: { id: number; need: number; available: number; short: boolean }[];
  qty: number;
  enabled: boolean;
  fabrics: { id: number; code: string; name: string; balance: number }[];
  value: number | null;
  fromBill: number | null;
  onChange: (id: number | null) => void;
}) {
  const req = plan?.req ?? null;
  const total = plan?.fabricId ? totals.find((t) => t.id === plan.fabricId) : undefined;
  if (!req && !enabled) return null;
  return (
    <div className="col-span-3 grid gap-1.5 rounded-lg bg-muted/40 px-3 py-2 sm:col-span-6" data-testid="fabric-req">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {req?.ok ? (
          <>
            <span className="ml text-sm font-semibold !text-foreground">{requirementText(req, qty)}</span>
            <span className="ml text-xs">
              ({req.rule}
              {req.sleeveGuessed ? ` · ഫുൾ കൈ കണക്കാക്കി — ഹാഫ് കൈ ${metres((req.halfPerPiece ?? 0) * qty)}` : ""})
            </span>
          </>
        ) : req ? (
          <span className="ml text-sm font-semibold !text-warning">{req.missing}</span>
        ) : null}
      </div>
      {enabled && (
        <select
          aria-label="Fabric for this garment"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="h-8 w-full max-w-md rounded-md border border-input bg-card px-2 text-xs sm:w-fit"
        >
          <option value="">{fromBill ? `Fabric: from the linked bill (${fabrics.find((f) => f.id === fromBill)?.code ?? ""})` : "Fabric: not chosen"}</option>
          {fabrics.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code} · {f.name} — {metres(f.balance)} m in stock
            </option>
          ))}
        </select>
      )}
      {total?.short && <p className="ml rounded-md bg-warning/15 px-2 py-1 text-sm font-semibold !text-foreground">⚠ {shortText(total.available, total.need)}</p>}
    </div>
  );
}

/** Several garments: metres needed per fabric, against what is available. */
function FabricTotals({ totals }: { totals: { id: number; code: string; name: string; need: number; available: number; short: boolean }[] }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-sm" data-testid="fabric-totals">
      <p className="font-medium">
        Fabric for this order <span className="ml">ഈ ഓർഡറിന് വേണ്ട തുണി</span>
      </p>
      {totals.map((t) => (
        <p key={t.id} className={cn("flex flex-wrap justify-between gap-2 tabular-nums", t.short && "font-semibold text-warning")}>
          <span>
            {t.code} · {t.name}
          </span>
          <span>
            {metres(t.need)} m needed · {metres(t.available)} m available {t.short ? "— short" : "✓"}
          </span>
        </p>
      ))}
    </div>
  );
}
