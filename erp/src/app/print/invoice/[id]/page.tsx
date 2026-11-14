import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBulkFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { fmtDate, num } from "@/lib/utils";
import { rupeesInWords } from "@/lib/words";

export const metadata = { title: "Invoice" };

/** A4 invoice for institutions — same layout as the "Institution Bill" sheet. */
export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const o = await getBulkFull(Number((await params).id));
  if (!o) notFound();
  const shop = await getSetting("shop");
  const taxable = o.subtotal - o.discount;
  const rows = [...o.items, ...Array.from({ length: Math.max(0, 12 - o.items.length) }, () => null)];
  return (
    <>
      <AutoPrint auto={false} paper="A4" />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-[10.5pt] text-black shadow-lg print:min-h-0 print:w-auto print:p-0 print:shadow-none">
          <header className="flex items-start justify-between border-b-2 border-[#153D33] pb-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-topbar-light.svg" alt={shop.name} className="-ml-1 h-[17mm] w-auto" />
              <div className="mt-1 text-[9pt] tracking-[0.3em] text-[#8a6a2a]">{shop.tagline}</div>
              <div className="mt-1 text-[9pt]">{shop.services}</div>
            </div>
            <div className="text-right text-[9pt] leading-relaxed">
              <div>{shop.address1}</div>
              <div>{shop.address2}</div>
              <div>Ph: {shop.phone}</div>
              <div>{shop.email}</div>
              {shop.gstin && <div className="font-semibold">GSTIN: {shop.gstin}</div>}
            </div>
          </header>

          <h1 className="my-4 text-center text-[15pt] font-bold tracking-[0.3em]">{shop.gstin && o.gstPct > 0 ? "TAX INVOICE" : "INVOICE"}</h1>

          <div className="grid grid-cols-[1.4fr_1fr] gap-6 text-[10pt]">
            <div className="rounded border border-black/30 p-3">
              <div className="text-[8.5pt] text-black/60">Bill to</div>
              <div className="font-semibold">{o.institution}</div>
              {o.contactPerson && <div>Attn: {o.contactPerson}</div>}
              {o.address && <div>{o.address}</div>}
              {o.phone && <div>Ph: {o.phone}</div>}
              {o.gstin && <div>GSTIN: {o.gstin}</div>}
            </div>
            <div className="grid content-start gap-1 rounded border border-black/30 p-3">
              <Kv k="Invoice No" v={o.orderNo} />
              <Kv k="Date" v={fmtDate(o.date)} />
              {o.deliveryDate && <Kv k="Delivery" v={fmtDate(o.deliveryDate)} />}
            </div>
          </div>

          <table className="mt-5 w-full border-collapse text-[10pt]">
            <thead>
              <tr className="bg-[#153D33] text-white">
                <th className="border border-[#153D33] px-2 py-1.5 text-left">Sl</th>
                <th className="border border-[#153D33] px-2 py-1.5 text-left">Description</th>
                <th className="border border-[#153D33] px-2 py-1.5">Size</th>
                <th className="border border-[#153D33] px-2 py-1.5 text-right">Qty</th>
                <th className="border border-[#153D33] px-2 py-1.5 text-right">Rate</th>
                <th className="border border-[#153D33] px-2 py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i, n) => (
                <tr key={n} className="h-[7mm]">
                  <td className="border border-black/30 px-2">{i ? n + 1 : ""}</td>
                  <td className="border border-black/30 px-2">{i ? [i.item, i.description].filter(Boolean).join(" — ") : ""}</td>
                  <td className="border border-black/30 px-2 text-center">{i?.size}</td>
                  <td className="border border-black/30 px-2 text-right">{i?.qty}</td>
                  <td className="border border-black/30 px-2 text-right">{i ? num(i.rate) : ""}</td>
                  <td className="border border-black/30 px-2 text-right">{i ? num(i.amount) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 grid grid-cols-[1fr_70mm] gap-6">
            <div className="self-end text-[9.5pt]">
              <div className="text-black/60">Amount in words</div>
              <div className="font-semibold">{o.balance > 0 ? rupeesInWords(o.balance) : rupeesInWords(o.total)}</div>
              <div className="mt-1 text-[8.5pt] text-black/60">({o.balance > 0 ? "balance due" : "invoice total"})</div>
            </div>
            <table className="w-full text-[10pt]">
              <tbody>
                <Tr k="Sub Total" v={num(o.subtotal)} />
                {o.discount > 0 && <Tr k="Discount" v={`- ${num(o.discount)}`} />}
                <Tr k="Taxable Amount" v={num(taxable)} />
                {o.gstAmount > 0 && <Tr k={`GST @ ${o.gstPct}%`} v={num(o.gstAmount)} />}
                <Tr k="TOTAL" v={`₹ ${num(o.total)}`} bold />
                {o.paid > 0 && <Tr k="Advance / Received" v={num(o.paid)} />}
                <Tr k="BALANCE DUE" v={`₹ ${num(o.balance)}`} bold />
              </tbody>
            </table>
          </div>

          <div className="mt-14 flex items-end justify-between">
            <p className="max-w-[110mm] text-[8.5pt] text-black/70">Terms: {shop.invoiceTerms}</p>
            <div className="text-center">
              <div className="mb-10 text-[9.5pt]">for {shop.name}</div>
              <div className="border-t border-black px-8 pt-1 text-[9pt]">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-black/60">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
function Tr({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <tr className={bold ? "font-bold" : ""}>
      <td className="border border-black/30 px-2 py-1">{k}</td>
      <td className="border border-black/30 px-2 py-1 text-right">{v}</td>
    </tr>
  );
}
