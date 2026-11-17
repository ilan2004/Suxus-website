"use client";

import { WhatsAppTemplateButton, orderMessageValues } from "@/components/app/whatsapp-template-button";
import * as React from "react";
import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { OrderRow } from "@/lib/queries";
import { cn, fmtDate, rupees, today } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All open" },
  { key: "today", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "ready", label: "Ready to deliver" },
  { key: "balance", label: "Balance due" },
] as const;

function due(o: OrderRow, t: string) {
  if (!o.deliveryDate || ["Delivered", "Cancelled"].includes(o.status)) return null;
  if (o.deliveryDate < t) return "overdue";
  if (o.deliveryDate === t) return "today";
  return null;
}

export function OrdersView({ rows, initialFilter }: { rows: OrderRow[]; initialFilter: string }) {
  const [filter, setFilter] = React.useState(initialFilter);
  const items = rows;
  const t = today();

  const filtered = items.filter((o) => {
    switch (filter) {
      case "today":
        return due(o, t) === "today";
      case "overdue":
        return due(o, t) === "overdue";
      case "ready":
        return o.status === "Ready";
      case "balance":
        return o.balance > 0 && o.status !== "Cancelled";
      case "all":
        return true;
      default:
        return true;
    }
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          <Link href="/orders/board" className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground">
            <KanbanSquare className="size-4" /> Board
          </Link>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-sm font-medium shadow-sm">
            <List className="size-4" /> List
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? null : items.filter((o) => (f.key === "ready" ? o.status === "Ready" : f.key === "balance" ? o.balance > 0 && o.status !== "Cancelled" : due(o, t) === f.key)).length;
            return (
              <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                {f.label}
                {count != null && count > 0 && (
                  <span className={cn("rounded px-1.5 text-[10px]", filter === f.key ? "bg-primary-foreground/20" : f.key === "overdue" ? "bg-destructive/15 text-destructive" : "bg-muted")}>{count}</span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <OrderList orders={filtered} />
    </div>
  );
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  const t = today();
  const columns: ColumnDef<OrderRow>[] = [
    { accessorKey: "orderNo", header: "Order", cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.orderNo}</span> },
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customerName}</div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    { accessorKey: "workType", header: "Work", cell: ({ row }) => <span className="text-xs">{row.original.workType}</span> },
    { accessorKey: "items", header: "Items", cell: ({ row }) => <span className="block max-w-56 truncate text-xs">{row.original.items}</span> },
    {
      accessorKey: "deliveryDate",
      header: "Delivery",
      cell: ({ row }) => {
        const d = due(row.original, t);
        return <span className={cn(d === "overdue" && "font-medium text-destructive", d === "today" && "font-medium text-warning")}>{fmtDate(row.original.deliveryDate)}</span>;
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "tailorName", header: "Tailor" },
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
        return <WhatsAppTemplateButton variant="icon" phone={o.phone} altPhone={o.altPhone} values={orderMessageValues({ ...o, name: o.customerName ?? "" })} customerId={o.customerId} orderId={o.id} to={o.customerName ?? o.orderNo} />;
      },
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={orders}
      rowHref={(r) => `/orders/${r.id}`}
      searchPlaceholder="Search order, customer, item, tailor…"
      footer={(rs) => (
        <TableRow>
          <TableCell colSpan={8}>{rs.length} orders</TableCell>
          <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.total, 0))}</TableCell>
          <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + Math.max(0, r.balance), 0))}</TableCell>
        </TableRow>
      )}
      empty="No orders match."
    />
  );
}
