import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AutoPrint } from "@/components/print/auto-print";
import { Barcode } from "@/app/print/labels/barcode";
import { jobSlipPages, logJobSlip } from "@/lib/job-slip";
import { fmtDate } from "@/lib/utils";
import { variantRequired } from "@/lib/variants";

export const metadata = { title: "Bundle label" };

/** Name size steps so a long name still fits (two lines at most, never cut with "…"). */
const nameSize = (s: string) => (s.length <= 9 ? 20 : s.length <= 13 ? 16 : s.length <= 18 ? 13 : s.length <= 26 ? 11 : 9);

/*
 * Bundle label on the TSC TE244 (203 dpi), 60 × 40 mm: identifies the bundle only — order number, whose garment,
 * what, when — and the CODE128 barcode of the order item (JOB-<id>), which opens the job slip PDF when scanned.
 * Same page rules as the fabric labels that already print correctly: 60 mm × 40 mm, no margin, and the box a
 * hair under 40 mm so nothing spills onto a second (blank) label.
 */
const CSS = `
.labels { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 24px 0; }
.blabel {
  width: 60mm; height: 39.5mm; box-sizing: border-box; padding: 1.8mm 2.2mm 1.4mm; overflow: hidden;
  display: flex; flex-direction: column; background: #fff; color: #000; line-height: 1.1;
  box-shadow: 0 1px 3px rgba(0,0,0,.2); font-family: Arial, Helvetica, sans-serif;
}
.blabel .top { display: flex; justify-content: space-between; align-items: baseline; }
.blabel .ord { font-size: 15pt; font-weight: 900; letter-spacing: .02em; }
.blabel .del { font-size: 8.5pt; font-weight: 800; text-align: right; }
.blabel .who { font-weight: 900; text-transform: uppercase; margin-top: .6mm; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.blabel .what { font-size: 9.5pt; font-weight: 800; margin-top: .3mm; white-space: nowrap; overflow: hidden; }
.blabel .code { margin-top: auto; }
.blabel svg { display: block; height: 8.5mm; width: 100%; }
.blabel .num { font-size: 6.5pt; font-weight: 700; text-align: center; margin-top: .3mm; }
@media print {
  @page { size: 60mm 40mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-shell { min-height: 0 !important; background: #fff !important; }
  .labels { display: block; padding: 0; }
  .blabel { box-shadow: none; break-after: page; page-break-after: always; break-inside: avoid; }
  .blabel:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default async function BundleLabel({ params, searchParams }: { params: Promise<{ itemId: string }>; searchParams: Promise<{ nolog?: string }> }) {
  const user = await requireUser();
  const itemId = Number((await params).itemId);
  if (!Number.isInteger(itemId)) notFound();
  const db = await getDb();
  const [it] = await db.select({ orderId: schema.orderItems.orderId }).from(schema.orderItems).where(eq(schema.orderItems.id, itemId));
  if (!it) notFound();
  const pages = await jobSlipPages(it.orderId, itemId);
  if (!pages) notFound();
  const p = pages[0];
  if ((await searchParams).nolog !== "1") await logJobSlip({ orderId: p.orderId, itemId, action: "label", via: "app", staffName: user.name, detail: `${p.item} — ${p.wearer}` });
  return (
    <>
      <style>{CSS}</style>
      <AutoPrint auto={false} paper="label" />
      {/* Nothing may follow the last label inside this container (it would print as an extra page). */}
      <div className="labels">
        <div className="blabel">
          <div className="top">
            <span className="ord">{p.orderNo}</span>
            <span className="del">
              Delivery
              <br />
              {p.deliveryDate ? fmtDate(p.deliveryDate) : "—"}
            </span>
          </div>
          <div className="who" style={{ fontSize: `${nameSize(p.wearer)}pt` }}>
            {p.wearer}
          </div>
          <div className="what">
            {p.item}
            {p.variant ? ` - ${p.variant}` : variantRequired(p.item) ? " - (variant not set)" : ""}
            {p.qty > 1 ? ` × ${p.qty}` : ""}
          </div>
          <div className="code">
            <Barcode value={p.code} />
            <div className="num">{p.code}</div>
          </div>
        </div>
      </div>
    </>
  );
}
