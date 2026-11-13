"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerDialog } from "@/components/forms/customer-dialog";
import { fmtDate, rupees, waLink } from "@/lib/utils";

type Row = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  place: string | null;
  type: string | null;
  firstVisit: string | null;
  orders: number;
  spent: number;
  due: number;
};

export function CustomersTable({ rows, types, openNew }: { rows: Row[]; types: string[]; openNew: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(openNew);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span> },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.place}</div>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const wa = waLink(row.original.phone);
        return row.original.phone ? (
          <span className="inline-flex items-center gap-2">
            {row.original.phone}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="text-success" title="WhatsApp">
                <MessageCircle className="size-4" />
              </a>
            )}
          </span>
        ) : null;
      },
    },
    { accessorKey: "type", header: "Type", cell: ({ row }) => row.original.type && <Badge variant="secondary">{row.original.type}</Badge> },
    { accessorKey: "orders", header: "Orders", meta: { align: "right" } },
    { accessorKey: "spent", header: "Business", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.spent) },
    {
      accessorKey: "due",
      header: "Due",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.due > 0 ? <span className="font-medium text-destructive">{rupees(row.original.due)}</span> : <span className="text-muted-foreground">—</span>),
    },
    { accessorKey: "firstVisit", header: "Since", cell: ({ row }) => fmtDate(row.original.firstVisit) },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search name, phone, place…"
        rowHref={(r) => `/customers/${r.id}`}
        toolbar={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New customer
          </Button>
        }
        empty="No customers yet — add your first one."
      />
      <CustomerDialog open={open} onOpenChange={setOpen} types={types} onSaved={(c) => router.push(`/customers/${c.id}`)} />
    </>
  );
}
