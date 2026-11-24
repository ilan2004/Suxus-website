import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { fmtDate } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Garment labels" };

/** Name size steps so long names still fit on one or two lines. */
const nameSize = (s: string) => (s.length <= 10 ? 20 : s.length <= 16 ? 16 : s.length <= 24 ? 12.5 : 10);

/*
 * 60 × 40 mm garment labels — one per piece (2 shirts = 2 labels), so every garment carries the name of the
 * person it is for. Same page rules as the fabric labels: only labels *between* others break the page.
 */
const CSS = `
.labels { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 24px 0; }
.glabel {
  width: 60mm; height: 39.5mm; box-sizing: border-box; padding: 2mm 2.5mm; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-between;
  background: #fff; color: #000; line-height: 1.15; box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.glabel .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 7.5pt; font-weight: 700; }
.glabel .shop { letter-spacing: .25em; font-weight: 800; }
.glabel .who { font-weight: 900; text-transform: uppercase; text-align: center; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  border-top: 2px solid #000; border-bottom: 2px solid #000; padding: .6mm 0; }
.glabel .rel { text-align: center; font-size: 7pt; margin-top: .5mm; }
.glabel .item { text-align: center; font-size: 11pt; font-weight: 800; }
.glabel .foot { display: flex; justify-content: space-between; font-size: 7pt; }
@media print {
  @page { size: 60mm 40mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-shell { min-height: 0 !important; background: #fff !important; }
  .labels { display: block; padding: 0; }
  .glabel { box-shadow: none; break-after: page; page-break-after: always; break-inside: avoid; }
  .glabel:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default async function GarmentLabels({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const shop = await getSetting("shop");
  const pieces = order.items.flatMap((i) => Array.from({ length: Math.min(50, i.qty) }, () => i));
  const total = pieces.length;
  return (
    <>
      <style>{CSS}</style>
      <AutoPrint auto={false} paper="label" />
      {/* Nothing may follow the last label inside this container (it would print as an extra page). */}
      <div className="labels">
        {pieces.map((i, n) => {
          const who = i.wearerName ?? order.customerName ?? "—";
          const other = i.wearer && !i.wearer.isSelf;
          const rel = other ? [i.wearer!.relation !== "Other" ? i.wearer!.relation : null, i.wearer!.school].filter(Boolean).join(" · ") : "";
          return (
            <div key={n} className="glabel">
              <div className="top">
                <span className="shop">{shop.name}</span>
                <span>
                  {order.orderNo} · {n + 1}/{total}
                </span>
              </div>
              <div>
                <div className="who" style={{ fontSize: `${nameSize(who)}pt` }}>
                  {who}
                </div>
                {rel && <div className="rel">{rel}</div>}
              </div>
              <div className="item">{i.item}</div>
              <div className="foot">
                <span>{other ? `of ${order.customerName ?? ""}` : (order.phone ? formatPhone(order.phone) : "")}</span>
                <span>{order.deliveryDate ? `Del ${fmtDate(order.deliveryDate)}` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
