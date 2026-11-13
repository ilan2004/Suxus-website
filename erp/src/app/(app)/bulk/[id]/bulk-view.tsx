"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleDollarSign, FileText, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { PayDialog } from "@/components/forms/pay-dialog";
import { addBulkPayment, deleteBulkOrder, deleteBulkPayment, setBulkStatus } from "@/lib/actions/bulk";
import type { BulkFull } from "@/lib/queries";
import { cn, fmtDate, num, rupees, waLink } from "@/lib/utils";

export function BulkView({ order, statuses, modes, shopName, isPartner }: { order: BulkFull; statuses: string[]; modes: string[]; shopName: string; isPartner: boolean }) {
  const router = useRouter();
  const [pay, setPay] = React.useState(false);
  const pieces = order.items.reduce((s, i) => s + i.qty, 0);
  const taxable = order.subtotal - order.discount;
  const wa = waLink(order.phone, `Dear ${order.contactPerson ?? order.institution}, invoice ${order.orderNo} from ${shopName}: total ₹${num(order.total)}, paid ₹${num(order.paid)}, balance ₹${num(order.balance)}. Thank you.`);

  // group lines by item + description for a readable summary
  const groups = Object.values(
    order.items.reduce<Record<string, { label: string; qty: number; sizes: string[] }>>((acc, i) => {
      const k = `${i.item}|${i.description ?? ""}`;
      acc[k] ??= { label: [i.item, i.description].filter(Boolean).join(" — "), qty: 0, sizes: [] };
      acc[k].qty += i.qty;
      if (i.size) acc[k].sizes.push(`${i.size}×${i.qty}`);
      return acc;
    }, {}),
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bulk" aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold">{order.orderNo}</h1>
        <StatusBadge status={order.status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => window.open(`/print/invoice/${order.id}`, "_blank")}>
            <FileText /> A4 invoice
          </Button>
          {wa && (
            <Button variant="outline" asChild>
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="text-success" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/bulk/${order.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-5">
          <div className="grid gap-x-8 gap-y-3 rounded-xl border bg-card p-5 sm:grid-cols-3">
            <Info label="Institution" value={order.institution} />
            <Info label="Contact" value={[order.contactPerson, order.phone].filter(Boolean).join(" · ") || "—"} />
            <Info label="Fabric by" value={order.fabricBy || "—"} />
            <Info label="Order date" value={fmtDate(order.date)} />
            <Info label="Delivery" value={fmtDate(order.deliveryDate) || "—"} />
            <Info label="Brought by" value={order.broughtByName || "—"} />
            {order.address && <Info label="Address" value={order.address} />}
            {order.gstin && <Info label="GSTIN" value={order.gstin} />}
            {order.remarks && <Info label="Remarks" value={order.remarks} className="sm:col-span-3" />}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.label} className="rounded-xl border bg-card p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{g.label}</p>
                  <p className="font-display font-semibold">{g.qty} pcs</p>
                </div>
                {g.sizes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{g.sizes.join(" · ")}</p>}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i, n) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground">{n + 1}</TableCell>
                    <TableCell>
                      <span className="font-medium">{i.item}</span> {i.description && <span className="text-muted-foreground">— {i.description}</span>}
                    </TableCell>
                    <TableCell>{i.size}</TableCell>
                    <TableCell className="text-right">{i.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(i.rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(i.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Sub total</TableCell>
                  <TableCell className="text-right">{pieces}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{rupees(order.subtotal, true)}</TableCell>
                </TableRow>
                {order.discount > 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>Discount</TableCell>
                    <TableCell className="text-right tabular-nums">−{rupees(order.discount, true)}</TableCell>
                  </TableRow>
                )}
                {order.gstAmount > 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      GST {order.gstPct}% on {rupees(taxable, true)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(order.gstAmount, true)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{rupees(order.total, true)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="grid gap-3 rounded-xl border bg-card p-5">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-semibold tabular-nums">{rupees(order.total, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Received</span>
              <span className="tabular-nums text-success">{rupees(order.paid, true)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="font-medium">Balance due</span>
              <span className={cn("font-display text-2xl font-semibold tabular-nums", order.balance > 0 ? "text-destructive" : "text-success")}>{rupees(order.balance, true)}</span>
            </div>
            <Button onClick={() => setPay(true)} disabled={order.status === "Cancelled"}>
              <CircleDollarSign /> Receive payment
            </Button>
          </div>
          <div className="rounded-xl border bg-card">
            <p className="border-b px-4 py-3 text-sm font-medium">Payments</p>
            {order.payments.length ? (
              <ul className="divide-y">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="flex-1">
                      <p className="font-medium tabular-nums">{rupees(p.amount, true)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(p.date)} · {p.mode}
                        {p.note && ` · ${p.note}`}
                      </p>
                    </div>
                    {isPartner && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete payment"
                        onClick={async () => {
                          if (!confirm("Delete this payment?")) return;
                          await deleteBulkPayment(p.id);
                          router.refresh();
                        }}
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No payments yet</p>
            )}
          </div>
          <div className="grid gap-2 rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Set status</p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((s) => (
                <button
                  key={s}
                  disabled={s === order.status}
                  onClick={async () => {
                    if (s === "Cancelled" && !confirm("Cancel this order?")) return;
                    const r = await setBulkStatus(order.id, s);
                    if (!r.ok) return void toast.error(r.error);
                    router.refresh();
                  }}
                  className={cn("rounded-md border px-2 py-1 text-xs disabled:opacity-50", s === order.status && "border-primary bg-primary/10")}
                >
                  {s}
                </button>
              ))}
            </div>
            {isPartner && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-fit text-destructive"
                onClick={async () => {
                  if (!confirm(`Delete ${order.orderNo}? Its payments are removed from the cash book.`)) return;
                  await deleteBulkOrder(order.id);
                  router.push("/bulk");
                }}
              >
                <Trash2 /> Delete order
              </Button>
            )}
          </div>
        </aside>
      </div>
      <PayDialog
        open={pay}
        onOpenChange={setPay}
        title="Receive payment"
        description={order.institution}
        suggested={order.balance}
        modes={modes}
        onSubmit={(v) => addBulkPayment({ bulkOrderId: order.id, ...v })}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
