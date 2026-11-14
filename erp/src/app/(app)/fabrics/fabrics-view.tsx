"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field } from "@/components/app/field";
import { ListSelect, SearchSelect } from "@/components/app/search-select";
import { deleteFabric, saveFabric, type FabricInput } from "@/lib/actions/fabrics";
import { cn, fmtDate, num, rupees, today } from "@/lib/utils";
import type { FabricRow } from "@/lib/queries";
import { PhotoPicker, photosFrom, type PhotoItem } from "@/components/forms/photo-picker";
import type { ColourSuggestion } from "@/lib/colour-detect";

export function FabricsView({
  rows,
  suppliers,
  lists,
  compositions,
  lowStock,
  showCost,
  photosEnabled,
}: {
  photosEnabled: boolean;
  rows: FabricRow[];
  suppliers: { id: number; name: string }[];
  lists: { fabricType: string[]; colourFamily: string[] };
  compositions: { name: string; prefix: string }[];
  lowStock: number;
  showCost: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<FabricInput | null>(null);
  const [showInactive, setShowInactive] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const data = rows.filter((r) => showInactive || r.active);
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const columns: ColumnDef<FabricRow>[] = [
    {
      id: "sel",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all"
          className="size-4 accent-[var(--primary)]"
          checked={data.length > 0 && data.every((r) => selected.has(r.id))}
          onChange={(e) => setSelected(e.target.checked ? new Set(data.map((r) => r.id)) : new Set())}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          data-no-row-click
          aria-label="Select"
          className="size-4 accent-[var(--primary)]"
          checked={selected.has(row.original.id)}
          onChange={() => toggle(row.original.id)}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5">
          {row.original.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.original.thumbnailUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="size-10 shrink-0 rounded-lg bg-muted" />
          )}
          <span className="font-mono text-xs font-medium">
            {row.original.code}
            {!row.original.active && <Badge variant="outline" className="ml-2">Inactive</Badge>}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "brand",
      header: "Fabric",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.brand}</div>
          <div className="text-xs text-muted-foreground">{[row.original.type, row.original.shade].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    { accessorKey: "composition", header: "Composition", cell: ({ row }) => <span className="text-xs">{row.original.composition}</span> },
    { accessorKey: "saleRate", header: "Rate/m", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.saleRate) },
    { accessorKey: "purchaseMtr", header: "Bought", meta: { align: "right" }, cell: ({ row }) => num(row.original.purchaseMtr) },
    { accessorKey: "soldMtr", header: "Sold", meta: { align: "right" }, cell: ({ row }) => num(row.original.soldMtr) },
    {
      accessorKey: "balanceMtr",
      header: "Balance",
      meta: { align: "right" },
      cell: ({ row }) => {
        const r = row.original;
        const pct = r.purchaseMtr > 0 ? Math.max(0, Math.min(100, (r.balanceMtr / r.purchaseMtr) * 100)) : 0;
        const low = r.balanceMtr <= lowStock;
        return (
          <div className="ml-auto w-24">
            <div className={cn("font-semibold", low && "text-warning", r.balanceMtr < 0 && "text-destructive")}>{num(r.balanceMtr)} m</div>
            <div className="mt-1 h-1 rounded-full bg-muted">
              <div className={cn("h-1 rounded-full", low ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    ...(showCost
      ? ([{ accessorKey: "stockValue", header: "Value", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.stockValue) }] as ColumnDef<FabricRow>[])
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search code, brand, shade, barcode…"
        rowHref={(r) => `/fabrics/${r.id}`}
        toolbar={
          <>
            <Label className="mr-2 text-xs text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive
            </Label>
            <Button
              variant="outline"
              disabled={!selected.size}
              onClick={() => window.open(`/print/labels?ids=${[...selected].join(",")}`, "_blank")}
            >
              <Tag /> Print labels {selected.size > 0 && `(${selected.size})`}
            </Button>
            <Button onClick={() => setEditing({ brand: "", composition: "Linen", purchaseDate: today(), purchaseMtr: 0, costPerMtr: 0, saleRate: 0, active: true })}>
              <Plus /> Add fabric
            </Button>
          </>
        }
        empty="No fabric in stock yet — add the first roll."
      />
      <FabricSheet
        value={editing}
        onClose={() => setEditing(null)}
        suppliers={suppliers}
        lists={lists}
        compositions={compositions}
        showCost={showCost}
        photosEnabled={photosEnabled}
        onSaved={() => router.refresh()}
        row={editing && "id" in editing ? rows.find((r) => r.id === editing.id) : undefined}
      />
    </>
  );
}

export function FabricSheet({
  value,
  onClose,
  suppliers,
  lists,
  compositions,
  showCost,
  onSaved,
  row,
  photosEnabled,
}: {
  photosEnabled: boolean;
  value: FabricInput | null;
  onClose: () => void;
  suppliers: { id: number; name: string }[];
  lists: { fabricType: string[]; colourFamily: string[] };
  compositions: { name: string; prefix: string }[];
  showCost: boolean;
  onSaved: () => void;
  row?: FabricRow;
}) {
  const [v, setV] = React.useState<FabricInput | null>(value);
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [suggestion, setSuggestion] = React.useState<(ColourSuggestion & { applied: string[] }) | null>(null);
  const [pending, start] = React.useTransition();
  /** Fill Colour family / Shade from the photo — only fields that are still empty, so nothing typed is overwritten. */
  const applyColour = React.useCallback(
    (c: ColourSuggestion) => {
      setV((cur) => {
        if (!cur) return cur;
        const applied: string[] = [];
        const next = { ...cur };
        const fam = lists.colourFamily.includes(c.family) ? c.family : lists.colourFamily.includes(c.baseFamily) ? c.baseFamily : null;
        if (!cur.colourFamily && fam) {
          next.colourFamily = fam;
          applied.push("Colour family");
        }
        if (!cur.shade) {
          next.shade = c.shade;
          applied.push("Shade");
        }
        setSuggestion((prev) => (prev ? prev : { ...c, applied }));
        return next;
      });
    },
    [lists.colourFamily],
  );
  React.useEffect(() => {
    setV(value);
    setPhotos(value?.id && row ? photosFrom(row.photoUrls ?? [], row.thumbUrls ?? []) : []);
    setSuggestion(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return <Sheet open={false} />;
  const busy = photos.some((p) => p.status === "processing" || p.status === "uploading");
  const failed = photos.some((p) => p.status === "error");

  const set = <K extends keyof FabricInput>(k: K, val: FabricInput[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  const prefix = compositions.find((c) => c.name === v.composition)?.prefix ?? "OTH";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return void toast.info("Photos are still uploading — one moment");
    if (failed) return void toast.error("A photo did not upload. Tap Retry on it, or remove it, then save.");
    start(async () => {
      const r = await saveFabric({ ...v, photos: photosEnabled ? photos.map((p) => ({ url: p.url!, thumb: p.thumb! })) : undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(v.id ? "Fabric updated" : `Fabric ${r.data.code} added`);
      onSaved();
      onClose();
    });
  };

  return (
    <Sheet open={!!value} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{v.id ? `Edit ${row?.code ?? "fabric"}` : "Add fabric"}</SheetTitle>
            <SheetDescription>
              {v.id ? "തുണി വിവരം മാറ്റുക" : `New code will be ${prefix}-xxx · കോഡ് ഓട്ടോമാറ്റിക്`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Photos" ml="ഫോട്ടോ" className="sm:col-span-2">
              {photosEnabled ? (
                <>
                  <PhotoPicker value={photos} onChange={setPhotos} disabled={pending} onColour={applyColour} />
                  {suggestion && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-xs">
                      <span className="size-7 shrink-0 rounded-md border" style={{ background: suggestion.hex }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          From photo: {suggestion.shade} · {suggestion.pattern}
                        </span>
                        <span className="text-muted-foreground">
                          {suggestion.applied.length ? `Filled ${suggestion.applied.join(" & ")} — change if not right` : "Suggestion only — your entries were kept"}
                          <span className="ml"> · ശരിയല്ലെങ്കിൽ മാറ്റാം</span>
                        </span>
                      </span>
                      {!suggestion.applied.length && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md border bg-card px-2 py-1 font-medium"
                          onClick={() => {
                            const fam = lists.colourFamily.includes(suggestion.family) ? suggestion.family : suggestion.baseFamily;
                            setV((cur) => (cur ? { ...cur, shade: suggestion.shade, colourFamily: lists.colourFamily.includes(fam) ? fam : cur.colourFamily } : cur));
                            setSuggestion({ ...suggestion, applied: ["Colour family", "Shade"] });
                          }}
                        >
                          Use
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Photo storage is not set up yet — add SUPABASE_SERVICE_ROLE_KEY in Vercel to enable photos. Saving works without photos.
                </p>
              )}
            </Field>
            <Field label="Brand / Quality" ml="ബ്രാൻഡ്" required className="sm:col-span-2">
              <Input value={v.brand} onChange={(e) => set("brand", e.target.value)} autoFocus required placeholder="e.g. Raymond Linen 60s" />
            </Field>
            <Field label="Composition" ml="ഘടന" required hint={v.id ? "Code stays the same after creation" : undefined}>
              <ListSelect items={compositions.map((c) => c.name)} value={v.composition} onChange={(c) => set("composition", c ?? "Other")} />
            </Field>
            <Field label="Type" ml="തരം">
              <ListSelect items={lists.fabricType} value={v.type} onChange={(c) => set("type", c)} allowClear />
            </Field>
            <Field label="Shade / Colour" ml="ഷേഡ്">
              <Input value={v.shade ?? ""} onChange={(e) => set("shade", e.target.value)} placeholder="e.g. Sea Green" />
            </Field>
            <Field label="Colour family" ml="കളർ വിഭാഗം">
              <ListSelect items={lists.colourFamily} value={v.colourFamily} onChange={(c) => set("colourFamily", c)} allowClear />
            </Field>
            <Field label="Barcode no." ml="ബാർകോഡ്">
              <Input value={v.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan or type" />
            </Field>
            <Field label="Supplier" ml="സപ്ലയർ">
              <SearchSelect
                options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                value={v.supplierId ? String(v.supplierId) : null}
                onChange={(s) => set("supplierId", s ? Number(s) : null)}
                allowClear
                placeholder="Optional"
              />
            </Field>
            <Field label="Purchase date" ml="വാങ്ങിയ തീയതി">
              <Input type="date" value={v.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value)} />
            </Field>
            <Field label="Purchased metres" ml="വാങ്ങിയ മീറ്റർ">
              <Input type="number" step="0.01" min={0} value={v.purchaseMtr ?? ""} onChange={(e) => set("purchaseMtr", e.target.value as unknown as number)} />
            </Field>
            {showCost && (
              <Field label="Cost / metre" ml="മുടക്ക്" hint={`Total cost ${rupees(Number(v.purchaseMtr || 0) * Number(v.costPerMtr || 0))}`}>
                <Input type="number" step="0.01" min={0} value={v.costPerMtr ?? ""} onChange={(e) => set("costPerMtr", e.target.value as unknown as number)} />
              </Field>
            )}
            <Field label="Sale rate / metre" ml="വിൽപ്പന റേറ്റ്" required>
              <Input type="number" step="0.01" min={0} value={v.saleRate ?? ""} onChange={(e) => set("saleRate", e.target.value as unknown as number)} />
            </Field>
            <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
              <Textarea value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} />
            </Field>
            {row && (
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center text-sm sm:col-span-2">
                <div>
                  <div className="text-xs text-muted-foreground">Sold</div>
                  <div className="font-semibold">{num(row.soldMtr)} m</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="font-semibold">{num(row.balanceMtr)} m</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Since</div>
                  <div className="font-semibold">{fmtDate(row.purchaseDate) || "—"}</div>
                </div>
              </div>
            )}
            {v.id && (
              <Label className="sm:col-span-2">
                <Switch checked={v.active ?? true} onCheckedChange={(c) => set("active", c)} /> Active (shows in sales)
              </Label>
            )}
          </div>
          <SheetFooter className="flex-row border-t">
            {v.id && showCost && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this fabric? If it has sales it will be marked inactive instead.")) return;
                  const r = await deleteFabric(v.id!);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.data === "deleted" ? "Deleted" : "Marked inactive (it has sales)");
                  onSaved();
                  onClose();
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="ml-auto">
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending || busy}>
              {(pending || busy) && <Loader2 className="animate-spin" />} {busy ? "Uploading…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
