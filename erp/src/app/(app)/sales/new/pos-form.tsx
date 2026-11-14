"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2, Minus, Plus, ScanBarcode, Scissors, Trash2, X } from "lucide-react";
import { BarcodeScanner } from "@/components/app/barcode-scanner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/field";
import { SearchSelect } from "@/components/app/search-select";
import { CustomerPicker } from "@/components/forms/customer-picker";
import type { CustomerLite } from "@/components/forms/customer-dialog";
import { createSale } from "@/lib/actions/sales";
import { cn, num, round2, rupees, today } from "@/lib/utils";

type Fabric = { id: number; code: string; barcode: string | null; brand: string; shade: string | null; type: string | null; saleRate: number; balanceMtr: number };
type Line = { key: string; fabricId: number | null; code: string; description: string; metres: string; rate: string; balance: number | null };

const QUICK_METRES = [1, 1.25, 1.6, 2.25, 2.5, 3];

export function PosForm({
  fabrics,
  customers,
  staff,
  paymentModes,
  customerTypes,
  currentUserId,
  initialCustomerId,
  orderId,
}: {
  fabrics: Fabric[];
  customers: CustomerLite[];
  staff: { id: number; name: string }[];
  paymentModes: string[];
  customerTypes: string[];
  currentUserId: number;
  initialCustomerId: number | null;
  orderId: number | null;
}) {
  const router = useRouter();
  const scanRef = React.useRef<HTMLInputElement>(null);
  const [scan, setScan] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [customer, setCustomer] = React.useState<CustomerLite | null>(customers.find((c) => c.id === initialCustomerId) ?? null);
  const [walkInName, setWalkInName] = React.useState("");
  const [walkInPhone, setWalkInPhone] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [discount, setDiscount] = React.useState("");
  const [mode, setMode] = React.useState(paymentModes[0] ?? "Cash");
  const [soldBy, setSoldBy] = React.useState<number | null>(staff.some((s) => s.id === currentUserId) ? currentUserId : null);
  const [stitchingHere, setStitchingHere] = React.useState(!!orderId);
  const [remarks, setRemarks] = React.useState("");
  const [pending, start] = React.useTransition();
  const [camera, setCamera] = React.useState(false);

  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.metres) || 0) * (Number(l.rate) || 0), 0));
  const net = round2(subtotal - (Number(discount) || 0));
  const totalMetres = round2(lines.reduce((s, l) => s + (Number(l.metres) || 0), 0));

  const addFabric = (f: Fabric) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.fabricId === f.id);
      if (existing) {
        toast.info(`${f.code} is already on the bill — adjust metres`);
        return ls;
      }
      return [
        ...ls,
        {
          key: crypto.randomUUID(),
          fabricId: f.id,
          code: f.code,
          description: [f.brand, f.shade].filter(Boolean).join(" "),
          metres: "",
          rate: String(f.saleRate),
          balance: f.balanceMtr,
        },
      ];
    });
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-metres="${f.id}"]`)?.focus(), 30);
  };

  const findFabric = (raw: string) => {
    const q = raw.trim().toLowerCase();
    return fabrics.find((x) => x.code.toLowerCase() === q || (x.barcode && x.barcode.toLowerCase() === q));
  };

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = scan.trim().toLowerCase();
    if (!q) return;
    const f = fabrics.find((x) => x.code.toLowerCase() === q || (x.barcode && x.barcode.toLowerCase() === q));
    if (f) {
      addFabric(f);
      setScan("");
    } else toast.error(`No fabric with code "${scan}"`);
  };

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = React.useCallback(
    (force = false) => {
      if (!lines.length) return void toast.error("Add at least one fabric");
      if (lines.some((l) => !(Number(l.metres) > 0))) return void toast.error("Enter metres for every fabric");
      start(async () => {
        const r = await createSale({
          date,
          customerId: customer?.id ?? null,
          customerName: customer ? null : walkInName || null,
          phone: customer ? null : walkInPhone || null,
          items: lines.map((l) => ({ fabricId: l.fabricId, description: l.description, metres: Number(l.metres), rate: Number(l.rate) })),
          discount: Number(discount) || 0,
          paymentMode: mode,
          soldById: soldBy,
          stitchingHere,
          orderId,
          remarks: remarks || null,
          force,
        });
        if (!r.ok) return void toast.error(r.error);
        if (r.data.needsConfirm) {
          if (confirm(`Stock is short:\n${r.data.needsConfirm.join("\n")}\n\nSave the bill anyway?`)) save(true);
          return;
        }
        toast.success(`Bill ${r.data.billNo} saved`);
        if (orderId) router.push(`/orders/${orderId}`);
        else if (stitchingHere) router.push(`/orders/new?sale=${r.data.id}`);
        else router.push(`/sales/${r.data.id}?print=1`);
      });
    },
    [lines, date, customer, walkInName, walkInPhone, discount, mode, soldBy, stitchingHere, orderId, remarks, router],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* Left: fabric lines */}
      <div className="grid content-start gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="flex gap-2">
              <form onSubmit={onScan} className="relative flex-1">
                <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={scanRef}
                  autoFocus
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  placeholder="Scan barcode / type code + Enter (F2)"
                  className="h-11 pl-10 text-base"
                />
              </form>
              <Button type="button" variant="gold" className="h-11 px-3" onClick={() => setCamera(true)} aria-label="Scan with camera">
                <Camera className="size-5" /> <span className="hidden sm:inline">Camera</span>
              </Button>
            </div>
            <SearchSelect
              className="h-11"
              options={fabrics.map((f) => ({
                value: String(f.id),
                label: `${f.code} · ${f.brand}`,
                sub: `${f.shade ?? ""} · ${num(f.balanceMtr)}m · ₹${f.saleRate}`,
                keywords: [f.barcode ?? "", f.type ?? ""],
              }))}
              value={null}
              onChange={(v) => {
                const f = fabrics.find((x) => String(x.id) === v);
                if (f) addFabric(f);
              }}
              placeholder="…or search fabric by name / shade"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="grid grid-cols-[1fr_auto] items-center border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Fabric · തുണി</span>
            <span>{lines.length} item(s)</span>
          </div>
          {lines.length === 0 ? (
            <div className="grid place-items-center gap-2 px-6 py-16 text-center text-muted-foreground">
              <ScanBarcode className="size-10 opacity-40" />
              <p className="text-sm">Scan or search a fabric to start the bill</p>
              <p className="ml">ബാർകോഡ് സ്കാൻ ചെയ്യുക അല്ലെങ്കിൽ കോഡ് ടൈപ്പ് ചെയ്യുക</p>
            </div>
          ) : (
            <ul className="divide-y">
              {lines.map((l) => {
                const m = Number(l.metres) || 0;
                const short = l.balance != null && m > l.balance;
                return (
                  <li key={l.key} className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{l.code}</p>
                        <Input
                          value={l.description}
                          onChange={(e) => update(l.key, { description: e.target.value })}
                          className="mt-1 h-8 border-transparent px-0 font-medium shadow-none focus-visible:border-input focus-visible:px-2"
                        />
                        {l.balance != null && (
                          <p className={cn("mt-0.5 text-xs", short ? "font-medium text-destructive" : "text-muted-foreground")}>
                            {short && <AlertTriangle className="mr-1 inline size-3" />}
                            Available {num(l.balance)} m{m > 0 && !short && ` · after sale ${num(round2(l.balance - m))} m`}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Metres · മീറ്റർ</span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" onClick={() => update(l.key, { metres: String(Math.max(0, round2(m - 0.25))) })}>
                            <Minus />
                          </Button>
                          <Input
                            data-metres={l.fabricId ?? undefined}
                            type="number"
                            inputMode="decimal"
                            step="0.05"
                            min={0}
                            value={l.metres}
                            onChange={(e) => update(l.key, { metres: e.target.value })}
                            className={cn("h-9 w-24 text-center text-base font-semibold", short && "border-destructive")}
                          />
                          <Button variant="outline" size="icon" onClick={() => update(l.key, { metres: String(round2(m + 0.25)) })}>
                            <Plus />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {QUICK_METRES.map((q) => (
                          <button
                            key={q}
                            onClick={() => update(l.key, { metres: String(q) })}
                            className={cn("h-7 rounded-md border px-2 text-xs hover:bg-accent", m === q && "border-primary bg-primary/10")}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Rate/m</span>
                        <Input type="number" step="1" min={0} value={l.rate} onChange={(e) => update(l.key, { rate: e.target.value })} className="h-9 w-24 text-right" />
                      </div>
                      <div className="ml-auto text-right">
                        <span className="text-xs text-muted-foreground">Amount</span>
                        <p className="font-display text-lg font-semibold tabular-nums">{rupees(round2(m * (Number(l.rate) || 0)), true)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={camera}
        onClose={() => setCamera(false)}
        title="Scan fabric label"
        onResult={(code) => {
          const f = findFabric(code);
          if (!f) {
            toast.error(`No fabric with code "${code}"`);
            return false; // keep the camera open for the next try
          }
          addFabric(f);
          toast.success(`${f.code} added — enter metres`);
          setCamera(false);
        }}
      />

      {/* Right: checkout */}
      <div className="grid content-start gap-4 lg:sticky lg:top-20">
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs">
          <Field label="Customer" ml="കസ്റ്റമർ">
            <CustomerPicker customers={customers} types={customerTypes} value={customer?.id} onChange={setCustomer} />
          </Field>
          {!customer && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Walk-in name (optional)" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
              <Input placeholder="Phone (optional)" inputMode="tel" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Sold by" ml="ആര് വിറ്റു">
              <SearchSelect
                options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
                value={soldBy ? String(soldBy) : null}
                onChange={(v) => setSoldBy(v ? Number(v) : null)}
                placeholder="Choose"
              />
            </Field>
          </div>
          <Field label="Payment" ml="പേയ്‌മെന്റ്">
            <div className="flex flex-wrap gap-1.5">
              {paymentModes.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMode(p)}
                  className={cn(
                    "h-8 rounded-md border px-3 text-sm transition-colors",
                    mode === p ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className={cn("flex items-start gap-3 rounded-lg border p-3", stitchingHere && "border-gold bg-gold/10")}>
            <Scissors className="mt-0.5 size-4 text-[#8a6a2a] dark:text-gold" />
            <div className="flex-1">
              <Label htmlFor="sh" className="cursor-pointer">
                Stitching here? <span className="ml">ഇവിടെ തയ്ക്കുന്നോ</span>
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {orderId
                  ? "This bill will be added to the order."
                  : "After saving you'll go straight to the stitching order — the fabric amount is added there (not counted twice)."}
              </p>
            </div>
            <Switch id="sh" checked={stitchingHere} onCheckedChange={setStitchingHere} disabled={!!orderId} />
          </div>
          <Textarea placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </div>

        <div className="grid gap-2 rounded-xl border bg-card p-4 shadow-xs">
          <Row label="Subtotal" value={rupees(subtotal, true)} />
          <Row label={`Metres`} value={`${num(totalMetres)} m`} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Discount · കിഴിവ്</span>
            <div className="relative w-28">
              <Input type="number" min={0} step="1" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 pr-7 text-right" placeholder="0" />
              {discount && (
                <button className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setDiscount("")} aria-label="Clear discount">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Net amount · നെറ്റ് തുക</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{rupees(net, true)}</span>
          </div>
          <Button size="lg" className="mt-2 h-12 text-base" disabled={pending || !lines.length} onClick={() => save()}>
            {pending && <Loader2 className="animate-spin" />}
            {stitchingHere && !orderId ? "Save & create order" : "Save & print bill"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Ctrl + Enter to save · F2 to scan</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
