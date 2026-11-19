"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { SearchSelect } from "@/components/app/search-select";
import { deletePurchase, savePurchase, type PurchaseInput } from "@/lib/actions/purchases";
import type { PurchaseRow } from "@/lib/queries";
import { cn, fmtDate, monthStart, num, round2, rupees, today } from "@/lib/utils";

export function PurchasesView({
  rows,
  suppliers,
  modes,
  owed,
  canDelete,
  showCosts,
}: {
  rows: PurchaseRow[];
  suppliers: { id: number; name: string; place: string | null }[];
  modes: string[];
  owed: { id: number; name: string; balance: number }[];
  canDelete: boolean;
  /** Owner: amounts, owed list, add / edit. Others see what was bought, not what it cost. */
  showCosts: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<PurchaseInput | null>(null);
  const [range, setRange] = React.useState<"month" | "all">("all");
  const data = rows.filter((r) => range === "all" || r.date >= monthStart());

  const allColumns: ColumnDef<PurchaseRow>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      accessorKey: "supplierName",
      header: "Supplier",
      cell: ({ row }) =>
        row.original.supplierId ? (
          <Link href={`/suppliers/${row.original.supplierId}`} className="font-medium hover:underline" data-no-row-click>
            {row.original.supplierName}
          </Link>
        ) : (
          "—"
        ),
    },
    { accessorKey: "invoiceNo", header: "Bill no." },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="block max-w-64 truncate">{row.original.description}</span> },
    { accessorKey: "qty", header: "Qty / m", meta: { align: "right" }, cell: ({ row }) => num(row.original.qty) },
    { accessorKey: "taxable", header: "Taxable", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.taxable) },
    { accessorKey: "gstAmount", header: "GST", meta: { align: "right" }, cell: ({ row }) => (row.original.gstAmount ? `${rupees(row.original.gstAmount)} (${num(row.original.gstPct)}%)` : "—") },
    { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{rupees(row.original.total, true)}</span> },
    { accessorKey: "paid", header: "Paid then", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.paid) },
  ];
  const COST_COLS = ["taxable", "gstAmount", "total", "paid"];
  const columns = showCosts ? allColumns : allColumns.filter((c) => !COST_COLS.includes((c as { accessorKey?: string }).accessorKey ?? ""));

  return (
    <div className="grid gap-5">
      {showCosts && owed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
          <span className="text-muted-foreground">To pay · കൊടുക്കാനുള്ളത്:</span>
          {owed.slice(0, 6).map((o) => (
            <Link key={o.id} href={`/suppliers/${o.id}`} className="rounded-md border px-2 py-1 hover:bg-accent">
              {o.name} <span className="font-semibold text-destructive">{rupees(o.balance)}</span>
            </Link>
          ))}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(r) =>
          showCosts &&
          setEdit({ id: r.id, date: r.date, supplierId: r.supplierId, invoiceNo: r.invoiceNo, description: r.description, qty: r.qty, rate: r.rate, gstPct: r.gstPct, paid: r.paid, remarks: r.remarks })
        }
        searchPlaceholder="Search supplier, bill no., description…"
        toolbar={
          <>
            <Button size="sm" variant={range === "month" ? "default" : "outline"} onClick={() => setRange("month")}>
              This month
            </Button>
            <Button size="sm" variant={range === "all" ? "default" : "outline"} onClick={() => setRange("all")}>
              All
            </Button>
            {showCosts && (
              <Button onClick={() => setEdit({ date: today(), qty: 0, rate: 0, gstPct: 0, paid: 0 })}>
                <Plus /> New purchase
              </Button>
            )}
          </>
        }
        footer={(rs) => (
          showCosts ? (
          <TableRow>
            <TableCell colSpan={5}>{rs.length} bills</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.taxable, 0))}</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.gstAmount, 0))}</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.total, 0))}</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.paid, 0))}</TableCell>
          </TableRow>
          ) : (
            <TableRow>
              <TableCell colSpan={5}>{rs.length} bills</TableCell>
            </TableRow>
          )
        )}
        empty="No purchases recorded yet."
      />
      <PurchaseSheet value={edit} onClose={() => setEdit(null)} suppliers={suppliers} modes={modes} canDelete={canDelete} onSaved={() => router.refresh()} />
    </div>
  );
}

function PurchaseSheet({
  value,
  onClose,
  suppliers,
  modes,
  canDelete,
  onSaved,
}: {
  value: PurchaseInput | null;
  onClose: () => void;
  suppliers: { id: number; name: string; place: string | null }[];
  modes: string[];
  canDelete: boolean;
  onSaved: () => void;
}) {
  const [v, setV] = React.useState<PurchaseInput | null>(value);
  const [newSupplier, setNewSupplier] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    setV(value);
    setNewSupplier(null);
  }, [value]);
  if (!v) return <Sheet open={false} />;
  const set = <K extends keyof PurchaseInput>(k: K, val: PurchaseInput[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  const taxable = round2((Number(v.qty) || 0) * (Number(v.rate) || 0));
  const gst = round2((taxable * (Number(v.gstPct) || 0)) / 100);
  const total = round2(taxable + gst);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await savePurchase({ ...v, supplierName: newSupplier });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Purchase saved");
      onSaved();
      onClose();
    });
  };

  return (
    <Sheet open={!!value} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{v.id ? "Edit purchase" : "New purchase"}</SheetTitle>
            <SheetDescription>സപ്ലയർ ബിൽ</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Supplier" ml="സപ്ലയർ" required className="sm:col-span-2">
              <SearchSelect
                options={[...suppliers.map((s) => ({ value: String(s.id), label: s.name, sub: s.place ?? "" })), ...(newSupplier ? [{ value: "new", label: newSupplier, sub: "new" }] : [])]}
                value={newSupplier ? "new" : v.supplierId ? String(v.supplierId) : null}
                onChange={(x) => {
                  if (x !== "new") setNewSupplier(null);
                  set("supplierId", x && x !== "new" ? Number(x) : null);
                }}
                onCreate={(q) => {
                  setNewSupplier(q);
                  set("supplierId", null);
                }}
                createLabel="New supplier"
              />
            </Field>
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Bill / invoice no." ml="ബിൽ നം.">
              <Input value={v.invoiceNo ?? ""} onChange={(e) => set("invoiceNo", e.target.value)} />
            </Field>
            <Field label="Description" ml="വിവരണം" className="sm:col-span-2">
              <Input value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="e.g. PV suiting navy, 3 pieces" />
            </Field>
            <Field label="Qty / metres" ml="അളവ്">
              <Input type="number" min={0} step="0.01" value={v.qty || ""} onChange={(e) => set("qty", Number(e.target.value))} />
            </Field>
            <Field label="Rate" ml="റേറ്റ്">
              <Input type="number" min={0} step="0.01" value={v.rate || ""} onChange={(e) => set("rate", Number(e.target.value))} />
            </Field>
            <Field label="GST %" ml="ജി.എസ്.ടി">
              <div className="flex gap-1">
                {[0, 5, 12, 18].map((g) => (
                  <button key={g} type="button" onClick={() => set("gstPct", g)} className={cn("h-9 flex-1 rounded-md border text-sm", Number(v.gstPct) === g ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                    {g}%
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid content-end gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable</span>
                <span className="tabular-nums">{rupees(taxable, true)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST</span>
                <span className="tabular-nums">{rupees(gst, true)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{rupees(total, true)}</span>
              </div>
            </div>
            <Field label="Paid now" ml="കൊടുത്തത്" hint="Later payments: Suppliers → Pay">
              <div className="flex gap-1.5">
                <Input type="number" min={0} value={v.paid || ""} onChange={(e) => set("paid", Number(e.target.value))} placeholder="0" />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => set("paid", total)}>
                  Full
                </Button>
              </div>
            </Field>
            <Field label="Paid by" ml="രീതി">
              <SearchSelect options={modes.filter((m) => m !== "Credit (Due)").map((m) => ({ value: m, label: m }))} value={v.paidMode ?? "Cash"} onChange={(m) => set("paidMode", m ?? "Cash")} />
            </Field>
            <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
              <Textarea value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} />
            </Field>
          </div>
          <SheetFooter className="flex-row border-t">
            {v.id && canDelete && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this purchase?")) return;
                  await deletePurchase(v.id!);
                  onSaved();
                  onClose();
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
