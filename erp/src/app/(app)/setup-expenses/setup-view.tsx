"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { ListSelect, SearchSelect } from "@/components/app/search-select";
import { StatCard } from "@/components/app/stat-card";
import { deleteSetupExpense, saveSetupExpense, type SetupInput } from "@/lib/actions/business";
import { cn, fmtDate, rupees, today } from "@/lib/utils";

type Row = {
  id: number;
  date: string;
  category: string;
  description: string | null;
  paidTo: string | null;
  supplierId: number | null;
  paidBy: string;
  amount: number;
  mode: string | null;
  billNo: string | null;
  hasBill: boolean;
  remarks: string | null;
};

export function SetupView({
  rows,
  suppliers,
  lists,
}: {
  rows: Row[];
  suppliers: { id: number; name: string }[];
  lists: { setupCategory: string[]; partner: string[]; paymentMode: string[] };
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<SetupInput | null>(null);
  const [cat, setCat] = React.useState<string | null>(null);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byPartner = lists.partner.map((p) => ({ p, v: rows.filter((r) => r.paidBy === p).reduce((s, r) => s + r.amount, 0) })).filter((x) => x.v !== 0);
  const byCat = Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] ?? 0) + r.amount), a), {})).sort((a, b) => b[1] - a[1]);
  const noBill = rows.filter((r) => !r.hasBill).length;
  const data = rows.filter((r) => !cat || r.category === cat);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    { accessorKey: "category", header: "Category", cell: ({ row }) => <span className="text-xs">{row.original.category}</span> },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-80">
          <div className="truncate">{row.original.description}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.paidTo}</div>
        </div>
      ),
    },
    { accessorKey: "paidBy", header: "Paid by", cell: ({ row }) => <Badge variant={row.original.paidBy === "Business Account" ? "secondary" : "gold"}>{row.original.paidBy}</Badge> },
    { accessorKey: "mode", header: "Mode", cell: ({ row }) => <span className="text-xs">{row.original.mode}</span> },
    {
      accessorKey: "hasBill",
      header: "Bill",
      cell: ({ row }) => (row.original.hasBill ? <FileCheck2 className="size-4 text-success" /> : <span className="text-xs text-muted-foreground">No</span>),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => <span className={cn("font-medium", row.original.amount < 0 && "text-success")}>{rupees(row.original.amount)}</span>,
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total setup spend" ml="ആകെ" value={rupees(total)} sub={`${rows.length} entries`} />
        {byPartner.slice(0, 2).map((x) => (
          <StatCard key={x.p} label={x.p} ml="കൊടുത്തത്" value={rupees(x.v)} sub={total ? `${Math.round((x.v / total) * 100)}% of setup` : undefined} tone="gold" />
        ))}
        <StatCard label="Without bill" ml="ബിൽ ഇല്ലാത്തത്" value={noBill} sub="Collect bills for GST / records" tone={noBill ? "warning" : "success"} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={!cat ? "default" : "outline"} onClick={() => setCat(null)}>
          All
        </Button>
        {byCat.map(([k, v]) => (
          <Button key={k} size="sm" variant={cat === k ? "default" : "outline"} onClick={() => setCat(cat === k ? null : k)}>
            {k} <span className="text-[10px] opacity-70">{rupees(v)}</span>
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data}
        onRowClick={(r) => setEdit({ ...r })}
        searchPlaceholder="Search description, paid to, bill no…"
        toolbar={
          <Button onClick={() => setEdit({ date: today(), category: lists.setupCategory[0], paidBy: lists.partner[0], amount: 0, mode: "Cash", hasBill: false })}>
            <Plus /> Add expense
          </Button>
        }
        footer={(rs) => (
          <TableRow>
            <TableCell colSpan={6}>{rs.length} entries</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.amount, 0))}</TableCell>
          </TableRow>
        )}
        empty="No setup expenses yet — or import them from Settings → Import Excel."
      />
      <SetupSheet value={edit} onClose={() => setEdit(null)} suppliers={suppliers} lists={lists} onSaved={() => router.refresh()} />
    </div>
  );
}

function SetupSheet({
  value,
  onClose,
  suppliers,
  lists,
  onSaved,
}: {
  value: SetupInput | null;
  onClose: () => void;
  suppliers: { id: number; name: string }[];
  lists: { setupCategory: string[]; partner: string[]; paymentMode: string[] };
  onSaved: () => void;
}) {
  const [v, setV] = React.useState(value);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setV(value), [value]);
  if (!v) return <Sheet open={false} />;
  const set = <K extends keyof SetupInput>(k: K, val: SetupInput[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  return (
    <Sheet open={!!value} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveSetupExpense(v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              onSaved();
              onClose();
            });
          }}
        >
          <SheetHeader>
            <SheetTitle>{v.id ? "Edit setup expense" : "New setup expense"}</SheetTitle>
            <SheetDescription>Use a minus amount for goods returned · തിരിച്ചു കൊടുത്താൽ മൈനസ്</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Amount" ml="തുക" required>
              <Input type="number" step="1" value={v.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="text-right font-semibold" required />
            </Field>
            <Field label="Category" ml="വിഭാഗം" className="sm:col-span-2">
              <ListSelect items={lists.setupCategory} value={v.category} onChange={(x) => set("category", x ?? "Other Setup")} />
            </Field>
            <Field label="Description" ml="വിവരണം" className="sm:col-span-2">
              <Input value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Paid to" ml="ആർക്ക് കൊടുത്തു">
              <Input value={v.paidTo ?? ""} onChange={(e) => set("paidTo", e.target.value)} />
            </Field>
            <Field label="Supplier (optional)" hint="Links it to the supplier's page">
              <SearchSelect
                options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                value={v.supplierId ? String(v.supplierId) : null}
                onChange={(x) => set("supplierId", x ? Number(x) : null)}
                allowClear
              />
            </Field>
            <Field label="Paid by" ml="ആര് കൊടുത്തു" required hint="Business Account → cash book; a partner → their capital">
              <ListSelect items={lists.partner} value={v.paidBy} onChange={(x) => set("paidBy", x ?? "")} />
            </Field>
            <Field label="Mode" ml="രീതി">
              <ListSelect items={lists.paymentMode} value={v.mode} onChange={(x) => set("mode", x)} />
            </Field>
            <Field label="Bill no." ml="ബിൽ നം.">
              <Input value={v.billNo ?? ""} onChange={(e) => set("billNo", e.target.value)} />
            </Field>
            <Label className="self-end pb-2">
              <Switch checked={!!v.hasBill} onCheckedChange={(c) => set("hasBill", c)} /> Bill received · ബിൽ ഉണ്ട്
            </Label>
            <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
              <Textarea value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} />
            </Field>
          </div>
          <SheetFooter className="flex-row border-t">
            {v.id && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this expense?")) return;
                  await deleteSetupExpense(v.id!);
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
