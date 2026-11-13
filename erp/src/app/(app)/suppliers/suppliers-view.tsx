"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { relinkSuppliers } from "@/lib/actions/purchases";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupplierDialog } from "@/components/forms/supplier-dialog";
import type { SupplierInput } from "@/lib/actions/purchases";
import type { SupplierRow } from "@/lib/queries";
import { fmtDate, rupees } from "@/lib/utils";

export function SuppliersView({ rows }: { rows: SupplierRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<SupplierInput | null>(null);
  const [linking, startLink] = React.useTransition();
  const columns: ColumnDef<SupplierRow>[] = [
    {
      accessorKey: "name",
      header: "Supplier",
      cell: ({ row }) => (
        <div className="max-w-72">
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[row.original.aliases && `aka ${row.original.aliases}`, row.original.supplies, row.original.place].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    { accessorKey: "type", header: "Type", cell: ({ row }) => row.original.type && <Badge variant="secondary" className="max-w-40 truncate">{row.original.type}</Badge> },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) =>
        row.original.phone ? (
          <a href={`tel:${row.original.phone.split("/")[0].trim()}`} className="inline-flex items-center gap-1.5 text-xs hover:underline" data-no-row-click>
            <Phone className="size-3" /> {row.original.phone}
          </a>
        ) : null,
    },
    { accessorKey: "upi", header: "UPI", cell: ({ row }) => <span className="text-xs">{row.original.upi}</span> },
    { accessorKey: "owed", header: "On credit", meta: { align: "right" }, cell: ({ row }) => (row.original.owed ? rupees(row.original.owed) : "—") },
    { accessorKey: "paid", header: "Paid on a/c", meta: { align: "right" }, cell: ({ row }) => (row.original.paid ? rupees(row.original.paid) : "—") },
    { accessorKey: "setupPaid", header: "Paid on spot", meta: { align: "right" }, cell: ({ row }) => (row.original.setupPaid ? rupees(row.original.setupPaid) : "—") },
    {
      accessorKey: "balance",
      header: "Balance due",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.balance > 0 ? <span className="font-semibold text-destructive">{rupees(row.original.balance)}</span> : <span className="text-muted-foreground">—</span>),
    },
    { accessorKey: "lastPaid", header: "Last paid", cell: ({ row }) => fmtDate(row.original.lastPaid) },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        rowHref={(r) => `/suppliers/${r.id}`}
        searchPlaceholder="Search name, supplies, place…"
        toolbar={
          <>
            <Button
              variant="outline"
              disabled={linking}
              title="Match setup expenses to suppliers by 'Paid to' and other names"
              onClick={() =>
                startLink(async () => {
                  const r = await relinkSuppliers();
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`${r.data.linked} setup expenses linked${r.data.tidied ? ` · ${r.data.tidied} names tidied` : ""}`);
                  router.refresh();
                })
              }
            >
              {linking ? <Loader2 className="animate-spin" /> : <Link2 />} Link payments
            </Button>
            <Button onClick={() => setEdit({ name: "" })}>
              <Plus /> New supplier
            </Button>
          </>
        }
        empty="No suppliers yet."
      />
      <SupplierDialog value={edit} onClose={() => setEdit(null)} onSaved={(id) => router.push(`/suppliers/${id}`)} />
    </>
  );
}
