"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import type { SaleRow } from "@/lib/queries";
import { cn, fmtDate, monthStart, num, rupees, today } from "@/lib/utils";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "all", label: "All" },
] as const;

export function SalesTable({ rows, initialRange = "month" }: { rows: SaleRow[]; initialRange?: (typeof RANGES)[number]["key"] }) {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["key"]>(initialRange);
  const t = today();
  const data = rows.filter((r) => (range === "today" ? r.date === t : range === "month" ? r.date >= monthStart(t) : true));

  const columns: ColumnDef<SaleRow>[] = [
    {
      accessorKey: "billNo",
      header: "Bill",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">
          {row.original.billNo}
          {row.original.cancelled && <Badge variant="destructive" className="ml-2">Cancelled</Badge>}
        </span>
      ),
    },
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customerName || <span className="text-muted-foreground">Walk-in</span>}</div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    { accessorKey: "items", header: "Fabric", cell: ({ row }) => <span className="block max-w-72 truncate text-xs">{row.original.items}</span> },
    { accessorKey: "metres", header: "Metres", meta: { align: "right" }, cell: ({ row }) => num(row.original.metres) },
    { accessorKey: "paymentMode", header: "Mode", cell: ({ row }) => <Badge variant="secondary">{row.original.paymentMode}</Badge> },
    {
      accessorKey: "orderNo",
      header: "Stitching",
      cell: ({ row }) =>
        row.original.stitchingHere ? (
          row.original.orderNo ? (
            <Badge variant="gold">{row.original.orderNo}</Badge>
          ) : (
            <a href={`/orders/new?sale=${row.original.id}`} data-no-row-click>
              <Badge variant="warning">Order pending →</Badge>
            </a>
          )
        ) : null,
    },
    { accessorKey: "soldBy", header: "Sold by" },
    {
      accessorKey: "net",
      header: "Net",
      meta: { align: "right" },
      cell: ({ row }) => <span className={cn("font-medium", row.original.cancelled && "line-through opacity-50")}>{rupees(row.original.net, true)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search bill, customer, fabric…"
      rowHref={(r) => `/sales/${r.id}`}
      toolbar={RANGES.map((r) => (
        <Button key={r.key} size="sm" variant={range === r.key ? "default" : "outline"} onClick={() => setRange(r.key)}>
          {r.label}
        </Button>
      ))}
      footer={(rs) => {
        const live = rs.filter((r) => !r.cancelled);
        return (
          <TableRow>
            <TableCell colSpan={4}>{live.length} bills</TableCell>
            <TableCell className="text-right tabular-nums">{num(live.reduce((s, r) => s + r.metres, 0))}</TableCell>
            <TableCell colSpan={3} />
            <TableCell className="text-right tabular-nums">{rupees(live.reduce((s, r) => s + r.net, 0))}</TableCell>
          </TableRow>
        );
      }}
      empty="No bills in this period."
    />
  );
}
