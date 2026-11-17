"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleDollarSign, Loader2, MoreHorizontal, Pencil, Plus, Printer, Ruler, ShoppingBag, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { StatusBadge } from "@/components/app/status-badge";
import { MeasurementCard, MeasurementDialog, type MeasurementRow } from "@/components/forms/measurement-dialog";
import { WhatsAppButtons } from "@/components/app/whatsapp-buttons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { addOrderPayment, deleteOrder, deletePayment, setOrderStatus } from "@/lib/actions/orders";
import type { OrderFull } from "@/lib/queries";
import type { ShopInfo } from "@/lib/defaults";
import { cn, fmtDate, num, rupees, today, waLink } from "@/lib/utils";

const FLOW = ["Booked", "Cut", "Stitching", "Ready", "Delivered"];

export function OrderView({
  order,
  shop,
  statuses,
  lastChange,
  paymentModes,
  measurements,
  fits,
  customerTypes,
  autoPrint,
  isPartner,
}: {
  order: OrderFull;
  shop: ShopInfo;
  statuses: string[];
  lastChange: { from: string | null; to: string; by: string | null; at: string } | null;
  paymentModes: string[];
  measurements: MeasurementRow[];
  fits: string[];
  customerTypes: string[];
  autoPrint: boolean;
  isPartner: boolean;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = React.useState<false | "pay" | "deliver">(false);
  const [mDialog, setMDialog] = React.useState<Partial<MeasurementRow> | null>(null);
  const [pending, start] = React.useTransition();
  const [justBooked] = React.useState(autoPrint);
  const [deleting, setDeleting] = React.useState(false);
  const printBill = () => window.open(`/print/order/${order.id}`, "_blank", "width=420,height=760");

  React.useEffect(() => {
    if (autoPrint) {
      printBill();
      router.replace(`/orders/${order.id}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = (s: string) =>
    start(async () => {
      if (s === "Delivered" && order.balance > 0) return setPayOpen("deliver");
      const r = await setOrderStatus(order.id, s);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Status: ${s}`);
      router.refresh();
    });

  const step = FLOW.indexOf(order.status);
  const readyMsg = `Hello ${order.customerName ?? ""}, your order ${order.orderNo} at ${shop.name} is ready for pickup.${order.balance > 0 ? ` Balance: ₹${num(order.balance)}.` : ""} — ${shop.name} ${shop.tagline}, ${shop.address1}`;
  const fabricLines = (order.sale?.items ?? []).map((i) => `• ${i.description} — ${num(i.metres)} m`);
  const orderMsg = [
    `*${shop.name} — ${shop.tagline}*`,
    `Order *${order.orderNo}* · ${fmtDate(order.date)}`,
    order.customerName ? `Customer: ${order.customerName}` : "",
    fabricLines.length ? `\nFabric${order.sale ? ` (bill ${order.sale.billNo})` : ""}:` : "",
    ...fabricLines,
    `\nStitching:`,
    ...order.items.map((i) => `• ${i.qty} × ${i.item}`),
    "",
    `Total: ₹${num(order.total)}`,
    order.paid > 0 ? `Advance paid: ₹${num(order.paid)}` : "",
    order.balance > 0 ? `*Balance: ₹${num(order.balance)}*` : "*Fully paid*",
    order.deliveryDate ? `\n*Delivery date: ${fmtDate(order.deliveryDate)}*${order.urgency === "Express" ? " (Express)" : ""}` : "",
    order.trialDate ? `Trial: ${fmtDate(order.trialDate)}` : "",
    "",
    `Please bring this message or the bill on delivery.`,
    `${shop.address1} · Ph ${shop.phone}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  const orderPhotos = [...new Set((order.sale?.items ?? []).map((i) => i.photos?.[0]).filter((p): p is string => !!p))].slice(0, 5);
  const overdue = order.deliveryDate && order.deliveryDate < today() && !["Delivered", "Cancelled"].includes(order.status);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders" aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold">{order.orderNo}</h1>
        <StatusBadge status={order.status} />
        {order.urgency === "Express" && (
          <Badge variant="warning">
            <Zap /> Express
          </Badge>
        )}
        {overdue && <Badge variant="destructive">Overdue</Badge>}
        {lastChange && (
          <span className="w-full text-xs text-muted-foreground sm:order-last" title="Last stage change">
            {lastChange.from ? `${lastChange.from} → ${lastChange.to}` : lastChange.to}, {fmtChange(lastChange.at)}
            {lastChange.by && ` · ${lastChange.by}`}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={printBill}>
            <Printer /> Print
          </Button>
          <WhatsAppButtons
            phone={order.phone}
            name={order.orderNo}
            messages={[
              { label: "Order details + delivery date", text: orderMsg, photos: orderPhotos },
              { label: "Ready for pickup", text: readyMsg },
            ]}
          />
          <Button variant="outline" asChild>
            <Link href={`/orders/${order.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          {isPartner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2 /> Delete order (trial / wrong entry)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {justBooked && order.phone && (
        <div className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/10 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm">
            <p className="font-medium">Order booked — send the details to {order.customerName ?? "the customer"} on WhatsApp</p>
            <p className="text-muted-foreground">
              Delivery date, balance{orderPhotos.length ? ` and ${orderPhotos.length} fabric photo${orderPhotos.length > 1 ? "s" : ""}` : ""}.
              <span className="ml"> കസ്റ്റമർക്ക് WhatsApp-ൽ അയക്കുക</span>
            </p>
          </div>
          <WhatsAppButtons
            phone={order.phone}
            name={order.orderNo}
            messages={[
              { label: "Order details + delivery date", text: orderMsg, photos: orderPhotos },
              { label: "Ready for pickup", text: readyMsg },
            ]}
          />
        </div>
      )}

      {/* Status stepper */}
      {order.status !== "Cancelled" && (
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <ol className="flex min-w-[560px] items-center">
            {FLOW.map((s, i) => {
              const done = i <= step;
              return (
                <li key={s} className="flex flex-1 items-center last:flex-none">
                  <button
                    disabled={pending}
                    onClick={() => changeStatus(s)}
                    className={cn("flex items-center gap-2 rounded-full px-2 py-1 text-sm transition-colors hover:bg-accent", i === step && "font-semibold")}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full border-2 text-xs",
                        done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    {s}
                  </button>
                  {i < FLOW.length - 1 && <span className={cn("mx-1 h-0.5 flex-1 rounded", i < step ? "bg-primary" : "bg-border")} />}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-5">
          <div className="grid gap-x-8 gap-y-3 rounded-xl border bg-card p-5 sm:grid-cols-3">
            <Info
              label="Customer"
              value={
                order.customerId ? (
                  <Link href={`/customers/${order.customerId}`} className="hover:underline">
                    {order.customerName}
                  </Link>
                ) : (
                  order.customerName
                )
              }
            />
            <Info label="Phone" value={order.phone || "—"} />
            <Info label="Work type" value={order.workType} />
            <Info label="Order date" value={fmtDate(order.date)} />
            <Info label="Trial" value={fmtDate(order.trialDate) || "—"} />
            <Info label="Delivery" value={<span className={cn(overdue && "text-destructive")}>{fmtDate(order.deliveryDate) || "—"}</span>} />
            <Info
              label="Tailor"
              value={
                order.tailorName ? (
                  isPartner ? (
                    <Link href={`/staff/${order.tailorId}`} className="hover:underline">
                      {order.tailorName}
                    </Link>
                  ) : (
                    order.tailorName
                  )
                ) : (
                  <span className="text-muted-foreground">Not assigned</span>
                )
              }
            />
            <Info label="Brought by" value={order.broughtByName ? (isPartner ? <Link href={`/staff/${order.broughtById}`} className="hover:underline">{order.broughtByName}</Link> : order.broughtByName) : "—"} />
            <Info label="Delivered on" value={fmtDate(order.deliveredOn) || "—"} />
            {order.remarks && <Info label="Remarks" value={order.remarks} className="sm:col-span-3" />}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.item}</TableCell>
                    <TableCell className="text-right">{i.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(i.rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(i.amount)}</TableCell>
                  </TableRow>
                ))}
                {order.sale && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Link href={`/sales/${order.sale.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <ShoppingBag className="size-4 text-[#8a6a2a] dark:text-gold" /> Fabric · {order.sale.billNo}
                        <span className="text-xs text-muted-foreground">
                          {order.sale.items.map((i) => `${i.description} ${num(i.metres)}m`).join(", ")}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(order.fabricAmount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                {order.discount > 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>Discount</TableCell>
                    <TableCell className="text-right tabular-nums">−{rupees(order.discount)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{rupees(order.total, true)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {!order.sale && order.workType === "Shop Fabric Stitching" && (
            <Button variant="outline" asChild className="w-fit">
              <Link href={`/sales/new?order=${order.id}${order.customerId ? `&customer=${order.customerId}` : ""}`}>
                <ShoppingBag /> Bill shop fabric for this order
              </Link>
            </Button>
          )}

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold">
                Measurements <span className="ml">അളവുകൾ</span>
              </h2>
              {order.customerId && (
                <Button variant="outline" size="sm" onClick={() => setMDialog({ customerId: order.customerId! })}>
                  <Plus /> Add
                </Button>
              )}
            </div>
            {measurements.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {measurements.map((m) => (
                  <MeasurementCard key={m.id} m={m} onEdit={() => setMDialog(m)} />
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <Ruler className="size-4" /> {order.customerId ? "No measurements saved for this customer." : "Link a customer to keep measurements."}
              </p>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <div className="grid gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-semibold tabular-nums">{rupees(order.total, true)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="tabular-nums text-success">{rupees(order.paid, true)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="font-medium">Balance · ബാക്കി</span>
              <span className={cn("font-display text-2xl font-semibold tabular-nums", order.balance > 0 ? "text-destructive" : "text-success")}>
                {rupees(order.balance, true)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPayOpen("pay")} disabled={order.status === "Cancelled"}>
                <CircleDollarSign /> Payment
              </Button>
              <Button
                onClick={() => (order.balance > 0 ? setPayOpen("deliver") : changeStatus("Delivered"))}
                disabled={order.status === "Delivered" || order.status === "Cancelled"}
              >
                <Check /> Deliver
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <p className="border-b px-4 py-3 text-sm font-medium">Payments · പേയ്‌മെന്റ്</p>
            {order.payments.length ? (
              <ul className="divide-y">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
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
                          const r = await deletePayment(p.id);
                          if (!r.ok) return void toast.error(r.error);
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
            <Label className="text-xs text-muted-foreground">Set status</Label>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((s) => (
                <button
                  key={s}
                  disabled={pending || s === order.status}
                  onClick={() => (s === "Cancelled" ? confirm("Cancel this order?") && changeStatus(s) : changeStatus(s))}
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
                onClick={() => setDeleting(true)}
              >
                <Trash2 /> Delete order
              </Button>
            )}
          </div>
        </aside>
      </div>

      <DeleteOrderDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        orderId={order.id}
        orderNo={order.orderNo}
        bill={order.sale ? { billNo: order.sale.billNo, net: order.sale.net } : null}
        paid={order.paid}
        onDone={() => router.push("/orders")}
      />
      <PaymentDialog
        mode={payOpen}
        onClose={() => setPayOpen(false)}
        orderId={order.id}
        balance={order.balance}
        paymentModes={paymentModes}
        onDone={() => router.refresh()}
      />
      <MeasurementDialog
        open={!!mDialog}
        onOpenChange={(o) => {
          if (!o) {
            setMDialog(null);
            router.refresh();
          }
        }}
        initial={mDialog ?? undefined}
        customerTypes={customerTypes}
        fits={fits}
        history={measurements}
      />
    </div>
  );
}

function PaymentDialog({
  mode,
  onClose,
  orderId,
  balance,
  paymentModes,
  onDone,
}: {
  mode: false | "pay" | "deliver";
  onClose: () => void;
  orderId: number;
  balance: number;
  paymentModes: string[];
  onDone: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [payMode, setPayMode] = React.useState(paymentModes[0] ?? "Cash");
  const [date, setDate] = React.useState(today());
  const [deliver, setDeliver] = React.useState(false);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (mode) {
      setAmount(balance > 0 ? String(balance) : "");
      setDeliver(mode === "deliver");
      setDate(today());
    }
  }, [mode, balance]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addOrderPayment({ orderId, date, amount: Number(amount), mode: payMode, markDelivered: deliver });
      if (!r.ok) return void toast.error(r.error);
      toast.success(deliver ? "Payment received · delivered" : "Payment received");
      onDone();
      onClose();
    });
  };

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "deliver" ? "Collect balance & deliver" : "Receive payment"}</DialogTitle>
          <DialogDescription>Balance due {rupees(balance, true)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Amount" ml="തുക">
            <Input type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-right text-lg font-semibold" autoFocus required />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {paymentModes
              .filter((m) => m !== "Credit (Due)")
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMode(m)}
                  className={cn("h-8 rounded-md border px-3 text-sm", payMode === m ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
                >
                  {m}
                </button>
              ))}
          </div>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Label>
            <Switch checked={deliver} onCheckedChange={setDeliver} /> Mark as delivered
          </Label>
          <DialogFooter>
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

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function DeleteOrderDialog({
  open,
  onClose,
  orderId,
  orderNo,
  bill,
  paid,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  orderId: number;
  orderNo: string;
  bill: { billNo: string; net: number } | null;
  paid: number;
  onDone: () => void;
}) {
  const [withBill, setWithBill] = React.useState(true);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {orderNo}?</DialogTitle>
          <DialogDescription>For trial or wrong entries. This cannot be undone. · ട്രയൽ / തെറ്റായ എൻട്രി മാത്രം</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          <li>• The order and its items are removed.</li>
          {paid > 0 && <li>• Payments ({rupees(paid, true)}) are removed from the cash book.</li>}
          <li>• If it is the latest order, the next one gets this number again.</li>
        </ul>
        {bill && (
          <Label className="items-start gap-3 rounded-lg border p-3">
            <Switch checked={withBill} onCheckedChange={setWithBill} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span>
                Also delete fabric bill <strong>{bill.billNo}</strong> ({rupees(bill.net, true)})
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {withBill ? "Fabric goes back to stock. Use this for trials." : "The bill stays as a normal fabric sale (customer took the fabric)."}
              </span>
            </span>
          </Label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteOrder(orderId, { withFabricBill: !!bill && withBill });
                if (!r.ok) return void toast.error(r.error);
                toast.success(`${orderNo} deleted${bill && withBill ? ` with ${bill.billNo}` : ""}`);
                onDone();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "17-Nov 4:20 pm" in shop time */
function fmtChange(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month} ${p.hour}:${p.minute} ${String(p.dayPeriod ?? "").toLowerCase()}`;
}
