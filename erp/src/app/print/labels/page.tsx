import { inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { Barcode } from "./barcode";

export const metadata = { title: "Fabric labels" };

/** Font size steps so long names wrap to two lines (never "…") and the shade always fits on one. */
const nameSize = (s: string) => (s.length <= 26 ? 8 : s.length <= 40 ? 7.2 : s.length <= 56 ? 6.4 : 5.6);
const shadeSize = (s: string) => (s.length <= 30 ? 7 : s.length <= 40 ? 6 : 5.2);

/*
 * 60 × 40 mm labels, one per page. The box is 39.5 mm tall (a hair under the page) and only the
 * labels *between* others get a page break, so the last label never pushes out an empty page.
 */
const CSS = `
.labels { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 24px 0; }
.label {
  width: 60mm; height: 39.5mm; box-sizing: border-box; padding: 2mm; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #fff; color: #000; text-align: center; line-height: 1.15;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.label .shop { font-size: 11pt; font-weight: 800; letter-spacing: .28em; margin-right: -.28em; line-height: 1; }
.label .tag { font-size: 6pt; letter-spacing: .3em; margin-right: -.3em; color: #555; margin-top: .4mm; line-height: 1; }
.label .name { font-weight: 700; margin-top: 1.2mm; max-width: 100%; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.label .shade { white-space: nowrap; margin-top: .3mm; max-width: 100%; }
.label svg { display: block; height: 11mm; width: auto; max-width: 100%; margin: 1.2mm auto .8mm; }
.label .foot { display: flex; justify-content: space-between; align-items: baseline; width: 100%; font-size: 9pt; font-weight: 800; line-height: 1; }
@media print {
  @page { size: 60mm 40mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-shell { min-height: 0 !important; background: #fff !important; }
  .labels { display: block; padding: 0; }
  .label { box-shadow: none; break-after: page; page-break-after: always; break-inside: avoid; }
  .label:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default async function Labels({ searchParams }: { searchParams: Promise<{ ids?: string; copies?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map(Number).filter(Boolean);
  const copies = Math.min(50, Math.max(1, Number(sp.copies) || 1));
  const db = await getDb();
  const fabrics = ids.length ? await db.select().from(schema.fabrics).where(inArray(schema.fabrics.id, ids)) : [];
  const shop = await getSetting("shop");
  const labels = fabrics.flatMap((f) => Array.from({ length: copies }, () => f));
  return (
    <>
      <style>{CSS}</style>
      <AutoPrint auto={false} paper="label" />
      {labels.length ? (
        // Nothing may follow the last .label inside this container (it would print as an extra page).
        <div className="labels">
          {labels.map((f, i) => (
            <div key={i} className="label">
              <div className="shop">{shop.name}</div>
              {shop.tagline && <div className="tag">{shop.tagline}</div>}
              <div className="name" style={{ fontSize: `${nameSize(f.brand)}pt` }}>
                {f.brand}
              </div>
              {f.shade && (
                <div className="shade" style={{ fontSize: `${shadeSize(f.shade)}pt` }}>
                  {f.shade}
                </div>
              )}
              <Barcode value={f.barcode || f.code} />
              <div className="foot">
                <span>{f.code}</span>
                <span>₹{Number(f.saleRate).toLocaleString("en-IN")}/m</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-print p-6 text-center text-sm">No fabrics selected.</p>
      )}
    </>
  );
}
