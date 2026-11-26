"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, MessageCircle, Pencil, Phone, Plus, Ruler, Scissors, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Empty } from "@/components/app/empty";
import { CustomerDialog } from "@/components/forms/customer-dialog";
import { MeasurementDialog, type MeasurementRow } from "@/components/forms/measurement-dialog";
import { PeopleMeasurements } from "./people-measurements";
import type { WearerLite } from "@/lib/wearers";
import { deleteCustomer } from "@/lib/actions/customers";
import { fmtDate, rupees } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import { WhatsAppTemplateButton, orderMessageValues } from "@/components/app/whatsapp-template-button";
import type { OrderRow } from "@/lib/queries";

type Customer = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  altPhone: string | null;
  place: string | null;
  type: string | null;
  firstVisit: string | null;
  remarks: string | null;
};
type SentMessage = { id: number; sentAt: string; templateName: string | null; text: string; phone: string; sentBy: string | null; orderNo: string | null };
type Bill = { id: number; billNo: string; date: string; net: number; paymentMode: string; cancelled: boolean; stitchingHere: boolean };

export function CustomerView({
  customer,
  orders,
  bills,
  measurements,
  wearers,
  messages,
  lists,
  canDelete,
}: {
  customer: Customer;
  orders: OrderRow[];
  bills: Bill[];
  measurements: MeasurementRow[];
  /** People measured under this customer (Self first). */
  wearers: WearerLite[];
  messages: SentMessage[];
  lists: { customerType: string[]; fit: string[] };
  canDelete: boolean;
}) {
  const router = useRouter();
  // ?tab=measurements (a person found in search opens straight on their measurements)
  const tab = useSearchParams().get("tab");
  const [editing, setEditing] = React.useState(false);
  const [mDialog, setMDialog] = React.useState<Partial<MeasurementRow> | null>(null);
  // Order details for {order_no} {item} {date} {balance}: the latest open order, else the latest order.
  const ctxOrder = orders.find((o) => !["Delivered", "Cancelled"].includes(o.status)) ?? orders.find((o) => o.status !== "Cancelled");
  const waValues = ctxOrder ? orderMessageValues({ ...ctxOrder, name: customer.name }) : { name: customer.name };
  const due = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.balance, 0);
  const business =
    orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.total, 0) +
    bills.filter((b) => !b.cancelled && !b.stitchingHere).reduce((s, b) => s + b.net, 0);
  const open = orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status)).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary font-display text-2xl font-semibold text-primary-foreground">
          {customer.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{customer.name}</h1>
            <span className="font-mono text-xs text-muted-foreground">{customer.code}</span>
            {customer.type && <Badge variant="secondary">{customer.type}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(customer.phone || customer.altPhone) && (
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                {[customer.phone, customer.altPhone].filter(Boolean).map((p, i) => (
                  <a key={p} href={`tel:${p}`} className="inline-flex items-center gap-1.5 hover:text-foreground" title={i ? "Second number" : undefined}>
                    <Phone className="size-3.5" /> {formatPhone(p)}
                  </a>
                ))}
                <WhatsAppTemplateButton variant="compact" phone={customer.phone} altPhone={customer.altPhone} values={waValues} customerId={customer.id} orderId={ctxOrder?.id} to={customer.name} />
              </span>
            )}
            {customer.place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {customer.place}
              </span>
            )}
            {customer.firstVisit && <span>Since {fmtDate(customer.firstVisit)}</span>}
          </div>
          {customer.remarks && <p className="mt-2 text-sm">{customer.remarks}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={async () => {
                if (!confirm(`Delete ${customer.name}?`)) return;
                const r = await deleteCustomer(customer.id);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Deleted");
                router.push("/customers");
              }}
            >
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total business" ml="ആകെ" value={rupees(business)} />
        <StatCard label="Balance due" ml="ബാക്കി" value={rupees(due)} tone={due > 0 ? "destructive" : "success"} />
        <StatCard label="Open orders" ml="നടക്കുന്ന ഓർഡർ" value={open} tone="gold" />
        <StatCard label="Visits" ml="ബില്ലുകൾ" value={orders.length + bills.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/sales/new?customer=${customer.id}`}>
            <ShoppingBag /> New fabric sale
          </Link>
        </Button>
        <Button asChild variant="gold">
          <Link href={`/orders/new?customer=${customer.id}`}>
            <Scissors /> New stitching order
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setMDialog({ customerId: customer.id })}>
          <Ruler /> Add measurements
        </Button>
      </div>

      <Tabs defaultValue={tab && ["orders", "bills", "measurements", "messages"].includes(tab) ? tab : "orders"}>
        <TabsList>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="bills">Bills ({bills.length})</TabsTrigger>
          <TabsTrigger value="measurements">Measurements ({measurements.length})</TabsTrigger>
          <TabsTrigger value="messages">Messages sent ({messages.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          {orders.length ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                      <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                      <TableCell>{fmtDate(o.date)}</TableCell>
                      <TableCell className="max-w-64 truncate">{o.items}</TableCell>
                      <TableCell>{fmtDate(o.deliveryDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(o.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.balance > 0 ? <span className="text-destructive">{rupees(o.balance)}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <WhatsAppTemplateButton variant="icon" phone={o.phone || customer.phone} altPhone={customer.altPhone} values={orderMessageValues({ ...o, name: customer.name })} customerId={customer.id} orderId={o.id} to={customer.name} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty icon={Scissors} title="No orders yet" />
          )}
        </TabsContent>
        <TabsContent value="bills">
          {bills.length ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/sales/${b.id}`)}>
                      <TableCell className="font-mono text-xs">
                        {b.billNo} {b.cancelled && <Badge variant="destructive">Cancelled</Badge>}
                      </TableCell>
                      <TableCell>{fmtDate(b.date)}</TableCell>
                      <TableCell>{b.paymentMode}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(b.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty icon={ShoppingBag} title="No fabric bills yet" />
          )}
        </TabsContent>
        <TabsContent value="measurements">
          <PeopleMeasurements customerId={customer.id} measurements={measurements} wearers={wearers} onMeasure={setMDialog} />
        </TabsContent>
        <TabsContent value="messages">
          {messages.length ? (
            <ul className="grid gap-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-xl border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{fmtDateTime(m.sentAt)}</span>
                    <Badge variant="secondary">{m.templateName ?? "Own message"}</Badge>
                    {m.orderNo && <span className="font-mono">{m.orderNo}</span>}
                    <span>to {formatPhone(m.phone)}</span>
                    {m.sentBy && <span>· by {m.sentBy}</span>}
                  </div>
                  <p className="mt-2 font-ml text-sm whitespace-pre-line">{m.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={MessageCircle} title="No messages sent yet">
              <p className="mt-1 text-sm text-muted-foreground">Use the WhatsApp button next to the phone number.</p>
            </Empty>
          )}
        </TabsContent>
      </Tabs>

      <CustomerDialog open={editing} onOpenChange={setEditing} initial={customer} types={lists.customerType} onSaved={() => router.refresh()} />
      <MeasurementDialog
        open={!!mDialog}
        onOpenChange={(o) => {
          if (!o) {
            setMDialog(null);
            router.refresh();
          }
        }}
        initial={mDialog ?? undefined}
        customerTypes={lists.customerType}
        fits={lists.fit}
        history={measurements}
      />
    </div>
  );
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
