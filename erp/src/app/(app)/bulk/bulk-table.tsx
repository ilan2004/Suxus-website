"use client";

import { WhatsAppTemplateButton, orderMessageValues } from "@/components/app/whatsapp-template-button";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { BulkRow } from "@/lib/queries";
import { cn, fmtDate, rupees, today } from "@/lib/utils";

export function BulkTable({ rows }: { rows: BulkRow[] }) {
  const t = today();
  const columns: ColumnDef<BulkRow>[] = [
    { accessorKey: "orderNo", header: "Order", cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.orderNo}</span> },
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      accessorKey: "institution",
      header: "Institution",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.institution}</div>
          <div className="text-xs text-muted-foreground">{[row.original.contactPerson, row.original.phone].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    { accessorKey: "items", header: "Items", cell: ({ row }) => <span className="block max-w-56 truncate text-xs">{row.original.items}</span> },
    { accessorKey: "pieces", header: "Pcs", meta: { align: "right" } },
    {
      accessorKey: "deliveryDate",
      header: "Delivery",
      cell: ({ row }) => {
        const late = row.original.deliveryDate && row.original.deliveryDate < t && !["Delivered", "Cancelled"].includes(row.original.status);
        return <span className={cn(late && "font-medium text-destructive")}>{fmtDate(row.original.deliveryDate)}</span>;
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "broughtBy", header: "Brought by" },
    { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.total) },
    {
      accessorKey: "balance",
      header: "Balance",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.balance > 0 ? <span className="font-medium text-destructive">{rupees(row.original.balance)}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "wa",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original;
        const name = o.contactPerson || o.institution;
        return <WhatsAppTemplateButton variant="icon" phone={o.phone} values={orderMessageValues({ ...o, name })} bulkOrderId={o.id} to={name} />;
      },
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowHref={(r) => `/bulk/${r.id}`}
      searchPlaceholder="Search institution, order, item…"
      footer={(rs) => (
        <TableRow>
          <TableCell colSpan={4}>{rs.length} orders</TableCell>
          <TableCell className="text-right tabular-nums">{rs.reduce((s, r) => s + r.pieces, 0)}</TableCell>
          <TableCell colSpan={3} />
          <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.total, 0))}</TableCell>
          <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + Math.max(0, r.balance), 0))}</TableCell>
        </TableRow>
      )}
      empty="No bulk orders yet."
    />
  );
}
