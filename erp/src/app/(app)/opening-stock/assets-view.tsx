"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { StatCard } from "@/components/app/stat-card";
import { deleteAsset, saveAsset, type AssetInput } from "@/lib/actions/business";
import { fmtDate, num, rupees, today } from "@/lib/utils";

type Row = { id: number; assetType: string; description: string; qty: number; unitValue: number; ownedBy: string; condition: string | null; valuationDate: string | null; remarks: string | null };

export function AssetsView({ rows, lists }: { rows: Row[]; lists: { assetType: string[]; partner: string[] } }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<AssetInput | null>(null);
  const value = (r: Row) => r.qty * r.unitValue;
  const total = rows.reduce((s, r) => s + value(r), 0);
  const unvalued = rows.filter((r) => !r.unitValue).length;
  const owners = lists.partner.map((p) => ({ p, v: rows.filter((r) => r.ownedBy === p).reduce((s, r) => s + value(r), 0) })).filter((x) => x.v);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "assetType", header: "Type", cell: ({ row }) => <Badge variant="secondary">{row.original.assetType}</Badge> },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="font-medium">{row.original.description}</span> },
    { accessorKey: "qty", header: "Qty / m", meta: { align: "right" }, cell: ({ row }) => num(row.original.qty) },
    {
      accessorKey: "unitValue",
      header: "Unit value",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.unitValue ? rupees(row.original.unitValue) : <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3" /> Add value</span>),
    },
    { id: "total", header: "Total value", meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{rupees(value(row.original))}</span> },
    { accessorKey: "ownedBy", header: "Owned by" },
    { accessorKey: "condition", header: "Age / condition", cell: ({ row }) => <span className="text-xs">{row.original.condition}</span> },
    { accessorKey: "valuationDate", header: "Valued on", cell: ({ row }) => fmtDate(row.original.valuationDate) },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total value" ml="ആകെ മൂല്യം" value={rupees(total)} sub={`${rows.length} items`} />
        {owners.slice(0, 2).map((o) => (
          <StatCard key={o.p} label={o.p} ml="കൊണ്ടുവന്നത്" value={rupees(o.v)} tone="gold" />
        ))}
        <StatCard label="Need a value" ml="വില ചേർക്കുക" value={unvalued} sub="Items with no unit value" tone={unvalued ? "warning" : "success"} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(r) => setEdit({ ...r })}
        toolbar={
          <Button onClick={() => setEdit({ assetType: lists.assetType[0], description: "", qty: 1, unitValue: 0, ownedBy: lists.partner[0], valuationDate: today() })}>
            <Plus /> Add item
          </Button>
        }
        footer={(rs) => (
          <TableRow>
            <TableCell colSpan={4}>{rs.length} items</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + value(r), 0))}</TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        )}
        empty="Nothing recorded yet."
      />
      <AssetDialog value={edit} onClose={() => setEdit(null)} lists={lists} onSaved={() => router.refresh()} />
    </div>
  );
}

function AssetDialog({ value, onClose, lists, onSaved }: { value: AssetInput | null; onClose: () => void; lists: { assetType: string[]; partner: string[] }; onSaved: () => void }) {
  const [v, setV] = React.useState(value);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setV(value), [value]);
  if (!v) return <Dialog open={false} />;
  const set = <K extends keyof AssetInput>(k: K, val: AssetInput[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>Use today&apos;s fair value (considering age) · ഇന്നത്തെ ന്യായമായ വില</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveAsset(v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              onSaved();
              onClose();
            });
          }}
        >
          <Field label="Type" ml="തരം">
            <ListSelect items={lists.assetType} value={v.assetType} onChange={(x) => set("assetType", x ?? "Other")} />
          </Field>
          <Field label="Owned by" ml="ആരുടേത്">
            <ListSelect items={lists.partner} value={v.ownedBy} onChange={(x) => set("ownedBy", x ?? "")} />
          </Field>
          <Field label="Description" ml="വിവരണം" required className="sm:col-span-2">
            <Input value={v.description} onChange={(e) => set("description", e.target.value)} required />
          </Field>
          <Field label="Qty / metres" ml="എണ്ണം">
            <Input type="number" min={0} step="0.01" value={v.qty || ""} onChange={(e) => set("qty", Number(e.target.value))} />
          </Field>
          <Field label="Unit value ₹" ml="ഒന്നിന്റെ വില" hint={`Total ${rupees((Number(v.qty) || 0) * (Number(v.unitValue) || 0))}`}>
            <Input type="number" min={0} value={v.unitValue || ""} onChange={(e) => set("unitValue", Number(e.target.value))} />
          </Field>
          <Field label="Age / condition" ml="പഴക്കം">
            <Input value={v.condition ?? ""} onChange={(e) => set("condition", e.target.value)} />
          </Field>
          <Field label="Valuation date" ml="തീയതി">
            <Input type="date" value={v.valuationDate ?? ""} onChange={(e) => set("valuationDate", e.target.value)} />
          </Field>
          <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
            <Textarea value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            {v.id && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={async () => {
                  if (!confirm("Delete this item?")) return;
                  await deleteAsset(v.id!);
                  onSaved();
                  onClose();
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
