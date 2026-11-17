"use client";

import { WhatsAppTemplateButton, orderMessageValues } from "@/components/app/whatsapp-template-button";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, KanbanSquare, List, User, Zap } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { setOrderStatus } from "@/lib/actions/orders";
import type { OrderRow } from "@/lib/queries";
import { cn, fmtDate, rupees, today } from "@/lib/utils";

const BOARD = ["Booked", "Cut", "Stitching", "Ready"];
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

export function OrdersView({
  rows,
  statuses,
  initialView,
  initialFilter,
}: {
  rows: OrderRow[];
  statuses: string[];
  initialView: "board" | "list";
  initialFilter: string;
}) {
  const router = useRouter();
  const [view, setView] = React.useState(initialView);
  const [filter, setFilter] = React.useState(initialFilter);
  const [items, setItems] = React.useState(rows);
  React.useEffect(() => setItems(rows), [rows]);
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
        return view === "board" ? true : true;
      default:
        return true;
    }
  });

  const move = async (id: number, status: string) => {
    const prev = items;
    setItems((is) => is.map((o) => (o.id === id ? { ...o, status } : o)));
    const r = await setOrderStatus(id, status);
    if (!r.ok) {
      setItems(prev);
      toast.error(r.error);
    } else {
      toast.success(`Moved to ${status}`);
      router.refresh();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          <button onClick={() => setView("board")} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm", view === "board" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            <KanbanSquare className="size-4" /> Board
          </button>
          <button onClick={() => setView("list")} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm", view === "list" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            <List className="size-4" /> List
          </button>
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

      {view === "board" ? (
        <Board orders={filtered} t={t} onMove={move} statuses={statuses} />
      ) : (
        <OrderList orders={filtered} />
      )}
    </div>
  );
}

function Board({ orders, t, onMove, statuses }: { orders: OrderRow[]; t: string; onMove: (id: number, s: string) => void; statuses: string[] }) {
  const [over, setOver] = React.useState<string | null>(null);
  const recentDelivered = orders.filter((o) => o.status === "Delivered").slice(0, 8);
  const cols = [...BOARD, "Delivered"];
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1000px] grid-cols-5 gap-3">
        {cols.map((col) => {
          const list = col === "Delivered" ? recentDelivered : orders.filter((o) => o.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (id) onMove(id, col);
              }}
              className={cn("flex min-h-64 flex-col rounded-xl border bg-muted/40 p-2 transition-colors", over === col && "border-primary bg-primary/5")}
            >
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <StatusBadge status={col} />
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <div className="grid gap-2">
                {list.map((o) => {
                  const d = due(o, t);
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(o.id))}
                      className={cn(
                        "group cursor-grab rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing",
                        d === "overdue" && "border-l-4 border-l-destructive",
                        d === "today" && "border-l-4 border-l-warning",
                      )}
                    >
                      <Link href={`/orders/${o.id}`} className="block">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{o.orderNo}</span>
                          {o.urgency === "Express" && (
                            <Badge variant="warning">
                              <Zap /> Express
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{o.customerName ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.items}</p>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className={cn("inline-flex items-center gap-1", d === "overdue" ? "font-medium text-destructive" : d === "today" ? "font-medium text-warning" : "text-muted-foreground")}>
                            <CalendarClock className="size-3" />
                            {d === "today" ? "Today" : fmtDate(o.deliveryDate)}
                          </span>
                          {o.balance > 0 ? <span className="font-medium text-destructive">{rupees(o.balance)} due</span> : <span className="text-success">Paid</span>}
                        </div>
                        {o.tailorName && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="size-3" /> {o.tailorName}
                          </p>
                        )}
                      </Link>
                      {/* Touch devices: quick move */}
                      <select
                        aria-label="Move to"
                        value={o.status}
                        onChange={(e) => onMove(o.id, e.target.value)}
                        className="mt-2 w-full rounded border bg-muted/50 px-1 py-0.5 text-xs lg:hidden"
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop here</p>}
              </div>
            </div>
          );
        })}
      </div>
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
