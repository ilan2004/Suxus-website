import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSaleFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { ThermalBill } from "@/components/print/thermal-bill";
import { AutoPrint } from "@/components/print/auto-print";

export const metadata = { title: "Print bill" };

export default async function PrintSale({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  await requireUser();
  const sale = await getSaleFull(Number((await params).id));
  if (!sale) notFound();
  const shop = await getSetting("shop");
  const { auto } = await searchParams;
  return (
    <>
      <AutoPrint auto={auto !== "0"} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-lg print:shadow-none">
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
    </>
  );
}
