import type { ShopInfo } from "@/lib/defaults";
import { fmtDate, num } from "@/lib/utils";

export type BillLine = { description: string; qty: number; rate: number; amount: number; unit?: string };

/** 80 mm thermal receipt (TVS RP 3150 STAR). Same layout as the "Cash Bill" sheet. */
export function ThermalBill({
  shop,
  billNo,
  date,
  customer,
  phone,
  lines,
  discount,
  paid,
  deliveryDate,
  orderNo,
  cancelled,
  extraNote,
}: {
  shop: ShopInfo;
  billNo: string;
  date: string;
  customer?: string | null;
  phone?: string | null;
  lines: BillLine[];
  discount: number;
  paid?: number | null;
  deliveryDate?: string | null;
  orderNo?: string | null;
  cancelled?: boolean;
  extraNote?: string | null;
}) {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const net = subtotal - discount;
  const hr = <div className="my-1.5 border-t border-dashed border-black" />;
  return (
    <div className="thermal mx-auto w-[72mm] bg-white p-[2mm] font-mono text-[11.5px] leading-[1.35] text-black">
      <div className="text-center">
        <div className="text-[18px] font-bold tracking-[0.25em]">{shop.name}</div>
        <div className="text-[10px] tracking-[0.2em]">{shop.tagline}</div>
        <div className="text-[10px]">{shop.services}</div>
        <div className="mt-1 text-[10px]">{shop.address1}</div>
        <div className="text-[10px]">{shop.address2}</div>
        <div className="text-[10px]">Ph: {shop.phone}</div>
        {shop.gstin && <div className="text-[10px]">GSTIN: {shop.gstin}</div>}
      </div>
      {hr}
      {cancelled && <div className="text-center font-bold">*** CANCELLED ***</div>}
      <div className="flex justify-between">
        <span>Bill: {billNo}</span>
        <span>{fmtDate(date)}</span>
      </div>
      {customer && <div>Customer: {customer}</div>}
      {phone && <div>Phone: {phone}</div>}
      {hr}
      <div className="grid grid-cols-[1fr_9mm_11mm_15mm] gap-x-1 font-bold">
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amt</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_9mm_11mm_15mm] gap-x-1">
          <span className="break-words">{l.description}</span>
          <span className="text-right">{num(l.qty)}</span>
          <span className="text-right">{num(l.rate)}</span>
          <span className="text-right">{num(l.amount)}</span>
        </div>
      ))}
      {hr}
      <Line label="Sub Total" value={num(subtotal)} />
      {discount > 0 && <Line label="Discount" value={`-${num(discount)}`} />}
      <div className="flex justify-between text-[14px] font-bold">
        <span>NET AMOUNT</span>
        <span>₹{num(net)}</span>
      </div>
      {paid != null && (
        <>
          <Line label="Advance / Paid" value={num(paid)} />
          <div className="flex justify-between font-bold">
            <span>BALANCE</span>
            <span>₹{num(net - paid)}</span>
          </div>
        </>
      )}
      {(deliveryDate || orderNo) && (
        <>
          {hr}
          {deliveryDate && <div>Delivery Date: {fmtDate(deliveryDate)}</div>}
          {orderNo && <div>Order No: {orderNo}</div>}
        </>
      )}
      {extraNote && <div className="mt-1">{extraNote}</div>}
      {hr}
      <div className="text-center text-[10px] whitespace-pre-line">{shop.billTerms}</div>
      <div className="mt-1 text-center font-bold">{shop.footer}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
