import { requireUser } from "@/lib/auth";
import { AutoPrint } from "@/components/print/auto-print";

export const metadata = { title: "Scale card" };

/*
 * SUXUS scale card for fabric photos — 60 × 40 mm label stock (TSC TE244, 203 dpi), zero margins.
 * The black rectangle must print at EXACTLY 50 × 30 mm: fabric photos are measured from its 50 mm edge.
 * Sizes are CSS millimetres, which print at true size when the print dialog's scale is 100 % ("Actual size").
 */
const CSS = `
.cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 16px 0; }
.scale-card { width: 60mm; height: 39.5mm; box-sizing: border-box; background: #fff; color: #000; position: relative; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.scale-card .rect { position: absolute; left: 5mm; top: 2.5mm; width: 50mm; height: 30mm; background: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.scale-card .txt { position: absolute; left: 0; right: 0; top: 33.6mm; text-align: center; font: 800 9pt/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: .12em; }
@media print {
  @page { size: 60mm 40mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-shell { min-height: 0 !important; background: #fff !important; }
  .cards { display: block; padding: 0; }
  .scale-card { box-shadow: none; break-after: page; page-break-after: always; }
  .scale-card:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default async function ScaleCard({ searchParams }: { searchParams: Promise<{ copies?: string }> }) {
  await requireUser({ can: "settings" });
  const copies = Math.min(20, Math.max(1, Number((await searchParams).copies) || 1));
  return (
    <>
      <style>{CSS}</style>
      <AutoPrint auto={false} paper="label" />
      <div className="no-print mx-auto max-w-xl px-4 pt-4 text-sm leading-relaxed">
        <p className="font-semibold">SUXUS scale card · സ്കെയിൽ കാർഡ്</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>
            In the print dialog choose the <b>60 × 40 mm</b> label, <b>Scale 100 % / “Actual size”</b> (never “Fit to page”) and <b>Margins: None</b>.
          </li>
          <li>
            Print <b>one</b> and measure the black rectangle with a ruler. It must be <b>exactly 50 mm wide</b> (and 30 mm tall). If it is not, do not use it — check
            the scale setting and print again.
          </li>
          <li>Then print a few, stick each one onto stiff card (cut to the label’s size) so it stays flat, and keep them where fabric photos are taken.</li>
          <li>For each photo: lay the cloth flat and place a card in one corner, the black rectangle flat and fully in the picture.</li>
        </ol>
        <p className="mt-2 text-muted-foreground">
          {copies} card{copies === 1 ? "" : "s"} below · more:{" "}
          {[1, 4, 8].map((n) => (
            <a key={n} href={`?copies=${n}`} className="mr-2 underline">
              {n}
            </a>
          ))}
        </p>
      </div>
      {/* Nothing may follow the last card inside .cards (it would print as an extra blank label). */}
      <div className="cards">
        {Array.from({ length: copies }, (_, i) => (
          <div key={i} className="scale-card">
            <div className="rect" />
            <div className="txt">SUXUS 50mm</div>
          </div>
        ))}
      </div>
    </>
  );
}
