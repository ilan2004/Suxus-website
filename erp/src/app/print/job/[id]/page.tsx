import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getOrderFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { fieldsFor, measureText } from "@/lib/measurements";
import { formatPhone } from "@/lib/phone";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Job slip" };

/**
 * 80 mm job slip for the cutting table / tailor: what to stitch, by when, and the customer's latest measurements
 * per garment. No prices. Chest prints as recorded with the full chest beside it, e.g. "13.5 (full chest 54)".
 */
export default async function JobSlip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const [shop, { auto }] = await Promise.all([getSetting("shop"), searchParams]);
  const db = await getDb();
  const all = order.customerId
    ? await db.select().from(schema.measurements).where(eq(schema.measurements.customerId, order.customerId)).orderBy(desc(schema.measurements.date), desc(schema.measurements.id))
    : [];
  // Latest record per garment
  const latest = all.filter((m, i) => all.findIndex((x) => x.garmentType === m.garmentType) === i);
  const hr = <div className="my-1.5 border-t border-dashed border-black" />;
  return (
    <>
      <AutoPrint auto={auto !== "0"} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-lg print:shadow-none">
          <div className="mx-auto w-[72mm] bg-white p-[2mm] font-mono text-[11.5px] leading-[1.35] text-black">
            <div className="text-center">
              <div className="text-[13px] font-bold tracking-[0.25em]">{shop.name}</div>
              <div className="text-[12px] font-bold">JOB SLIP · ജോബ് സ്ലിപ്പ്</div>
            </div>
            {hr}
            <div className="flex justify-between text-[13px] font-bold">
              <span>{order.orderNo}</span>
              {order.urgency === "Express" && <span>EXPRESS</span>}
            </div>
            <div className="flex justify-between">
              <span>Booked {fmtDate(order.date)}</span>
              {order.trialDate && <span>Trial {fmtDate(order.trialDate)}</span>}
            </div>
            <div className="text-[13px] font-bold">Delivery: {order.deliveryDate ? fmtDate(order.deliveryDate) : "—"}</div>
            <div>Customer: {order.customerName ?? "—"}</div>
            {order.phone && <div>Phone: {formatPhone(order.phone)}</div>}
            {order.tailorName && <div>Tailor: {order.tailorName}</div>}
            {hr}
            <div className="font-bold">Items</div>
            {order.items.map((i) => (
              <div key={i.id}>
                {i.qty} × {i.item}
              </div>
            ))}
            {order.remarks && <div className="mt-1 whitespace-pre-line">Note: {order.remarks}</div>}
            {hr}
            <div className="font-bold">Measurements (inches)</div>
            {latest.length === 0 && <div>No measurements saved.</div>}
            {latest.map((m) => {
              const fields = fieldsFor(m.garmentType, m.values).filter((f) => m.values[f.key] != null);
              return (
                <div key={m.id} className="mt-1.5">
                  <div className="font-bold">
                    {m.garmentType}
                    <span className="font-normal">
                      {" "}
                      · {fmtDate(m.date)}
                      {m.size ? ` · Size ${m.size}` : ""}
                      {m.fit ? ` · ${m.fit}` : ""}
                    </span>
                  </div>
                  {fields.map((f) => (
                    <div key={f.key} className="flex justify-between gap-2">
                      <span className="shrink-0">{f.part ? `${f.key} ¼` : f.en}</span>
                      <span className="text-right font-bold">{measureText(f, m.values[f.key])}</span>
                    </div>
                  ))}
                  {m.remarks && <div className="italic">{m.remarks}</div>}
                </div>
              );
            })}
            {hr}
            <div className="text-center text-[10px]">Chest is measured on the folded garment, centre front to side — full chest = × 4</div>
          </div>
        </div>
      </div>
    </>
  );
}
