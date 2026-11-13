"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, GripVertical, Loader2, Plus, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { importExcelAction, updateSetting } from "@/lib/actions/settings";
import { LIST_LABELS, type ListKey } from "@/lib/defaults";
import type { AppSettings } from "@/lib/settings";

function useSave() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const save = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    start(async () => {
      const r = await updateSetting(key, value);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });
  return { pending, save };
}

export function SettingsView({ settings }: { settings: AppSettings }) {
  return (
    <Tabs defaultValue="shop">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="shop">Shop & bills</TabsTrigger>
        <TabsTrigger value="lists">Dropdown lists</TabsTrigger>
        <TabsTrigger value="rates">Piece rates</TabsTrigger>
        <TabsTrigger value="codes">Fabric codes</TabsTrigger>
        <TabsTrigger value="slabs">Incentive slabs</TabsTrigger>
        <TabsTrigger value="import">Import / Backup</TabsTrigger>
      </TabsList>
      <TabsContent value="shop">
        <ShopForm shop={settings.shop} />
      </TabsContent>
      <TabsContent value="lists">
        <ListsForm lists={settings.lists} />
      </TabsContent>
      <TabsContent value="rates">
        <RatesForm rates={settings.pieceRates} items={settings.lists.item} />
      </TabsContent>
      <TabsContent value="codes">
        <CodesForm comps={settings.compositions} />
      </TabsContent>
      <TabsContent value="slabs">
        <SlabsForm slabs={settings.slabs} />
      </TabsContent>
      <TabsContent value="import">
        <div className="grid gap-4">
          <ImportForm />
          <div className="flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div className="text-sm">
              <p className="font-medium">Backup — download everything as Excel</p>
              <p className="text-muted-foreground">Every table as a sheet, like the Daily Operations Book. Keep a copy on Google Drive weekly.</p>
            </div>
            <Button asChild variant="gold">
              <a href="/api/export">
                <FileSpreadsheet /> Download .xlsx
              </a>
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function ShopForm({ shop }: { shop: AppSettings["shop"] }) {
  const [v, setV] = React.useState(shop);
  const { pending, save } = useSave();
  const f = (k: keyof typeof v, label: string, ml?: string, hint?: string) => (
    <Field label={label} ml={ml} hint={hint}>
      <Input value={String(v[k] ?? "")} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} />
    </Field>
  );
  return (
    <div className="grid max-w-3xl gap-4 rounded-xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {f("name", "Shop name", "ഷോപ്പ് പേര്")}
        {f("tagline", "Tagline")}
        {f("services", "Services line")}
        {f("phone", "Phone")}
        {f("address1", "Address line 1")}
        {f("address2", "Address line 2")}
        {f("email", "Email")}
        {f("gstin", "GSTIN", "ജി.എസ്.ടി", "Only if registered — empty hides it on bills")}
        {f("footer", "Footer line")}
        {f("lowStockMtr", "Low-stock warning (metres)")}
        {f("normalDays", "Normal delivery (days)", "സാധാരണ")}
        {f("expressDays", "Express delivery (days)", "എക്സ്പ്രസ്സ്")}
      </div>
      <Field label="Thermal bill terms" hint="Keep each line under 40 characters so it prints without cutting">
        <Textarea value={v.billTerms} onChange={(e) => setV((s) => ({ ...s, billTerms: e.target.value }))} rows={2} />
      </Field>
      <Field label="A4 invoice terms">
        <Textarea value={v.invoiceTerms} onChange={(e) => setV((s) => ({ ...s, invoiceTerms: e.target.value }))} rows={2} />
      </Field>
      <Button className="w-fit" disabled={pending} onClick={() => save("shop", v)}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />} Save shop details
      </Button>
    </div>
  );
}

function ListsForm({ lists }: { lists: AppSettings["lists"] }) {
  const [v, setV] = React.useState(lists);
  const { pending, save } = useSave();
  const keys = Object.keys(LIST_LABELS) as ListKey[];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => (
          <ListEditor key={k} title={LIST_LABELS[k].en} ml={LIST_LABELS[k].ml} items={v[k] ?? []} onChange={(items) => setV((s) => ({ ...s, [k]: items }))} />
        ))}
      </div>
      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" disabled={pending} onClick={() => save("lists", v)} className="shadow-lg">
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save all lists
        </Button>
      </div>
    </div>
  );
}

function ListEditor({ title, ml, items, onChange }: { title: string; ml: string; items: string[]; onChange: (i: string[]) => void }) {
  const [draft, setDraft] = React.useState("");
  const [drag, setDrag] = React.useState<number | null>(null);
  const add = () => {
    const d = draft.trim();
    if (!d || items.includes(d)) return;
    onChange([...items, d]);
    setDraft("");
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 text-sm font-medium">
        {title} <span className="ml">{ml}</span>
      </p>
      <ul className="mb-2 grid max-h-64 gap-1 overflow-y-auto">
        {items.map((it, i) => (
          <li
            key={it}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag == null || drag === i) return;
              const next = [...items];
              const [m] = next.splice(drag, 1);
              next.splice(i, 0, m);
              onChange(next);
              setDrag(null);
            }}
            className="group flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-sm"
          >
            <GripVertical className="size-3.5 cursor-grab text-muted-foreground" />
            <span className="flex-1 truncate">{it}</span>
            <button onClick={() => onChange(items.filter((x) => x !== it))} className="opacity-50 hover:text-destructive hover:opacity-100" aria-label={`Remove ${it}`}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="Add…" className="h-8" />
        <Button size="icon-sm" variant="outline" onClick={add} aria-label="Add">
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function RatesForm({ rates, items }: { rates: Record<string, number>; items: string[] }) {
  const [v, setV] = React.useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i, rates[i] != null ? String(rates[i]) : ""])));
  const { pending, save } = useSave();
  return (
    <div className="grid max-w-2xl gap-4 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Tailor wage per piece for each item (Piece Rate Master). Used automatically in Tailor Wages. <span className="ml">പീസ് റേറ്റ്</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm">{i}</span>
            <Input type="number" min={0} value={v[i] ?? ""} onChange={(e) => setV((s) => ({ ...s, [i]: e.target.value }))} className="h-8 w-24 text-right" placeholder="₹" />
          </div>
        ))}
      </div>
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() => save("pieceRates", Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "").map(([k, x]) => [k, Number(x)])))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />} Save piece rates
      </Button>
    </div>
  );
}

function CodesForm({ comps }: { comps: AppSettings["compositions"] }) {
  const [v, setV] = React.useState(comps);
  const { pending, save } = useSave();
  return (
    <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Each composition gets a code prefix: Linen → LIN-001, LIN-002 … <span className="ml">കോഡ് പ്രിഫിക്സ്</span>
      </p>
      {v.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={c.name} onChange={(e) => setV((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input value={c.prefix} onChange={(e) => setV((s) => s.map((x, j) => (j === i ? { ...x, prefix: e.target.value.toUpperCase() } : x)))} className="w-24 font-mono" />
          <Button variant="ghost" size="icon-sm" onClick={() => setV((s) => s.filter((_, j) => j !== i))} aria-label="Remove">
            <X />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setV((s) => [...s, { name: "", prefix: "" }])}>
          <Plus /> Add
        </Button>
        <Button disabled={pending} onClick={() => save("compositions", v.filter((c) => c.name && c.prefix))}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save codes
        </Button>
      </div>
    </div>
  );
}

function ImportForm() {
  const router = useRouter();
  const [report, setReport] = React.useState<Record<string, string> | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <div className="grid max-w-2xl gap-4 rounded-xl border bg-card p-5">
      <div className="flex gap-3">
        <FileSpreadsheet className="mt-0.5 size-6 shrink-0 text-success" />
        <div className="text-sm">
          <p className="font-medium">Import the SUXUS Daily Operations Book (.xlsx)</p>
          <p className="mt-1 text-muted-foreground">
            Brings in dropdown lists, shop info, piece rates, staff, suppliers, setup expenses, opening stock, and any customers, fabric stock,
            purchases and cash book rows. Tables that already have data are skipped, so it is safe to run again.
          </p>
          <p className="ml mt-1">എക്സൽ ഫയലിലെ വിവരങ്ങൾ ഇവിടേക്ക് കൊണ്ടുവരാം.</p>
        </div>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/40">
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm">{file ? file.name : "Click to choose the .xlsx file"}</span>
        <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Button
        className="w-fit"
        disabled={!file || pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("file", file!);
            const r = await importExcelAction(fd);
            if (!r.ok) return void toast.error(r.error);
            setReport(r.data);
            toast.success("Import finished");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Import
      </Button>
      {report && (
        <ul className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
          {Object.entries(report).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4">
              <span className="font-medium">{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlabsForm({ slabs }: { slabs: AppSettings["slabs"] }) {
  const [v, setV] = React.useState(slabs.map((s) => ({ from: String(s.from), to: String(s.to), rate: String(Math.round(s.rate * 10000) / 100) })));
  const { pending, save } = useSave();
  return (
    <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Rate on the money collected in a month. A person with “Own incentive %” on the Staff page uses that instead. <span className="ml">സ്ലാബ് ശതമാനം</span>
      </p>
      <div className="grid grid-cols-[1fr_1fr_90px_32px] gap-2 text-xs text-muted-foreground">
        <span>From ₹</span>
        <span>To ₹</span>
        <span>Rate %</span>
        <span />
      </div>
      {v.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_90px_32px] gap-2">
          <Input type="number" value={s.from} onChange={(e) => setV((x) => x.map((y, j) => (j === i ? { ...y, from: e.target.value } : y)))} />
          <Input type="number" value={s.to} onChange={(e) => setV((x) => x.map((y, j) => (j === i ? { ...y, to: e.target.value } : y)))} />
          <Input type="number" step="0.1" value={s.rate} onChange={(e) => setV((x) => x.map((y, j) => (j === i ? { ...y, rate: e.target.value } : y)))} />
          <Button variant="ghost" size="icon-sm" onClick={() => setV((x) => x.filter((_, j) => j !== i))} aria-label="Remove">
            <X />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setV((x) => [...x, { from: "", to: "", rate: "" }])}>
          <Plus /> Slab
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            save(
              "slabs",
              v.filter((s) => s.from !== "" && s.to !== "" && s.rate !== "").map((s) => ({ from: Number(s.from), to: Number(s.to), rate: Number(s.rate) / 100 })),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save slabs
        </Button>
      </div>
    </div>
  );
}
