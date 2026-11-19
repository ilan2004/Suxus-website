"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Plus, Printer, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThermalBill } from "@/components/print/thermal-bill";
import { WhatsAppButtons } from "@/components/app/whatsapp-buttons";
import { cancelSale, deleteCancelledSale } from "@/lib/actions/sales";
import type { ShopInfo } from "@/lib/defaults";
import type { getSaleFull } from "@/lib/queries";
import { fmtDate, num, rupees } from "@/lib/utils";

type Sale = NonNullable<Awaited<ReturnType<typeof getSaleFull>>>;

export function SaleView({ sale, shop, autoPrint, canCancel }: { sale: Sale; shop: ShopInfo; autoPrint: boolean; canCancel: boolean }) {
  const router = useRouter();
  const printBill = () => window.open(`/print/sale/${sale.id}`, "_blank", "width=420,height=720");

  React.useEffect(() => {
    if (autoPrint) {
      printBill();
      router.replace(`/sales/${sale.id}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const message = [
    `*${shop.name} — ${shop.tagline}*`,
    `Bill ${sale.billNo} · ${fmtDate(sale.date)}`,
    ...sale.items.map((i) => `• ${i.description} — ${num(i.metres)} m × ₹${num(i.rate)} = ₹${num(i.amount)}`),
    sale.discount ? `Discount: ₹${num(sale.discount)}` : "",
    `*Total: ₹${num(sale.net)}* (${sale.paymentMode})`,
    sale.order ? `\nStitching order *${sale.order.orderNo}*` : "",
    sale.order?.deliveryDate ? `*Delivery date: ${fmtDate(sale.order.deliveryDate)}*${sale.order.urgency === "Express" ? " (Express)" : ""}` : "",
    "",
    shop.footer,
  ]
    .filter(Boolean)
    .join("\n");
  const photos = [...new Set(sale.items.map((i) => i.photos?.[0]).filter((p): p is string => !!p))].slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="grid content-start gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sales" aria-label="Back">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold">Bill {sale.billNo}</h1>
          {sale.cancelled ? <Badge variant="destructive">Cancelled</Badge> : <Badge variant="success">{sale.paymentMode}</Badge>}
          {sale.order && (
            <Link href={`/orders/${sale.order.id}`}>
              <Badge variant="gold">
                <Scissors /> {sale.order.orderNo}
              </Badge>
            </Link>
          )}
        </div>

        <div className="grid gap-x-8 gap-y-3 rounded-xl border bg-card p-5 sm:grid-cols-3">
          <Info label="Date" value={fmtDate(sale.date)} />
          <Info
            label="Customer"
            value={
              sale.customerId ? (
                <Link className="hover:underline" href={`/customers/${sale.customerId}`}>
                  {sale.customerName}
                </Link>
              ) : (
                sale.customerName || "Walk-in"
              )
            }
          />
          <Info label="Phone" value={sale.phone || "—"} />
          <Info label="Sold by" value={sale.soldByName || "—"} />
          {sale.createdBy && <Info label="Entered by" value={sale.createdBy} />}
          <Info label="Net amount" value={<span className="font-display text-xl font-semibold">{rupees(sale.net, true)}</span>} />
          <Info label="Remarks" value={sale.remarks || "—"} />
          <Info
            label="Fabrics"
            value={
              <span className="flex flex-wrap gap-x-3">
                {sale.items.map((i) =>
                  i.fabricId ? (
                    <Link key={i.id} href={`/fabrics/${i.fabricId}`} className="hover:underline">
                      {i.description} · {num(i.metres)} m
                    </Link>
                  ) : (
                    <span key={i.id}>
                      {i.description} · {num(i.metres)} m
                    </span>
                  ),
                )}
              </span>
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={printBill}>
            <Printer /> Print bill
          </Button>
          <WhatsAppButtons phone={sale.phone} name={sale.billNo} messages={[{ label: `Bill ${sale.billNo}`, text: message, photos }]} />
          {!sale.order && !sale.cancelled && (
            <Button variant="outline" asChild>
              <Link href={`/orders/new?sale=${sale.id}`}>
                <Scissors /> Create stitching order
              </Link>
            </Button>
          )}
          <Button variant="gold" asChild>
            <Link href="/sales/new">
              <Plus /> Next sale
            </Link>
          </Button>
          {canCancel && !sale.cancelled && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                const reason = prompt("Reason for cancelling this bill?");
                if (!reason) return;
                const r = await cancelSale(sale.id, reason);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Bill cancelled — stock returned");
                router.refresh();
              }}
            >
              <Ban /> Cancel bill
            </Button>
          )}
          {canCancel && sale.cancelled && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm(`Delete ${sale.billNo} permanently? Use this only for trial / wrong entries. This cannot be undone.`)) return;
                const r = await deleteCancelledSale(sale.id);
                if (!r.ok) return void toast.error(r.error);
                toast.success(`${sale.billNo} deleted`);
                router.push("/sales");
              }}
            >
              <Trash2 /> Delete permanently
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-neutral-100 p-4 dark:bg-neutral-800">
        <p className="mb-2 text-center text-xs text-muted-foreground">Bill preview · 80 mm</p>
        <div className="shadow-md">
          <ThermalBill
            shop={shop}
            billNo={sale.billNo}
            date={sale.date}
            customer={sale.customerName}
            phone={sale.phone}
            lines={sale.items.map((i) => ({ description: i.description, qty: i.metres, rate: i.rate, amount: i.amount }))}
            discount={sale.discount}
            orderNo={sale.order?.orderNo}
            cancelled={sale.cancelled}
            extraNote={`Paid by ${sale.paymentMode}`}
          />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
