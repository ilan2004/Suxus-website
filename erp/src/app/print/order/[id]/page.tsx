import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { ThermalBill, type BillLine } from "@/components/print/thermal-bill";
import { Barcode } from "@/app/print/labels/barcode";
import { AutoPrint } from "@/components/print/auto-print";

export const metadata = { title: "Print order" };

export default async function PrintOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const shop = await getSetting("shop");
  const { auto } = await searchParams;
  const lines: BillLine[] = [
    ...(order.sale?.items ?? []).map((i) => ({ description: i.description, qty: i.metres, rate: i.rate, amount: i.amount })),
    ...(order.sale && order.sale.discount ? [{ description: "Fabric discount", qty: 1, rate: -order.sale.discount, amount: -order.sale.discount }] : []),
    // Whose garment, when it is not the customer themself — the parent sees what they are paying for
    ...order.items.map((i) => ({ description: `${i.item}${i.variant ? ` (${i.variant})` : ""} stitching${i.wearer && !i.wearer.isSelf ? ` — ${i.wearer.name}` : ""}`, qty: i.qty, rate: i.rate, amount: i.amount })),
  ];
  return (
    <>
      <AutoPrint auto={auto !== "0"} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-lg print:shadow-none">
          <ThermalBill
            shop={shop}
            billNo={order.orderNo}
            date={order.date}
            customer={order.customerName}
            phone={order.phone}
            lines={lines}
            discount={order.discount}
            paid={order.paid}
            deliveryDate={order.deliveryDate}
            orderNo={order.sale ? `${order.orderNo} · Fabric ${order.sale.billNo}` : order.orderNo}
            cancelled={order.status === "Cancelled"}
          />
          {/* Order number as a barcode: the cutting master scans the customer's slip to open their measurements */}
          <div className="mx-auto w-[72mm] bg-white px-[6mm] pb-[3mm] text-center font-mono text-[10px] text-black [&_svg]:mx-auto [&_svg]:block [&_svg]:h-[9mm] [&_svg]:w-full">
            <Barcode value={order.orderNo} />
            <div>{order.orderNo}</div>
          </div>
        </div>
      </div>
    </>
  );
}
