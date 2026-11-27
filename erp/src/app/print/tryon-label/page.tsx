import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { tryonQrSvg } from "@/lib/tryon-qr";

export const metadata = { title: "Try-on QR label" };

/* 60 × 40 mm on the TSC label printer — same page rules as the fabric and bundle labels (the box a hair under 40 mm). */
const CSS = `
.labels { display: flex; justify-content: center; padding: 24px 0; }
.tlabel { width: 60mm; height: 39.5mm; box-sizing: border-box; padding: 1.5mm 2mm; display: flex; gap: 1.8mm; align-items: center;
  background: #fff; color: #000; box-shadow: 0 1px 3px rgba(0,0,0,.2); font-family: Arial, Helvetica, sans-serif; overflow: hidden; }
.tlabel .qr { width: 35mm; height: 35mm; flex: none; }
.tlabel .qr svg { width: 100%; height: 100%; display: block; }
.tlabel .t { display: flex; flex-direction: column; gap: 1mm; line-height: 1.1; min-width: 0; }
.tlabel .b { font-size: 10pt; font-weight: 900; letter-spacing: .06em; }
.tlabel .m { font-size: 8.5pt; font-weight: 700; }
.tlabel .e { font-size: 7pt; font-weight: 700; }
.tlabel .p { font-size: 6pt; font-weight: 700; }
@media print {
  @page { size: 60mm 40mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-shell { min-height: 0 !important; background: #fff !important; }
  .labels { display: block; padding: 0; }
  .tlabel { box-shadow: none; }
}
`;

export default async function TryonQrLabel() {
  await requireUser({ can: "prices" });
  const [shop, qr] = await Promise.all([getSetting("shop"), tryonQrSvg()]);
  return (
    <>
      <style>{CSS}</style>
      <AutoPrint auto={false} paper="label" />
      <div className="labels">
        <div className="tlabel" data-testid="label">
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="t">
            <span className="b">SUXUS</span>
            <span className="m font-ml">തുണി ട്രൈ ചെയ്യൂ</span>
            <span className="e">Try your fabric — scan me</span>
            <span className="p">{shop.phone.split("|")[0].trim()}</span>
          </div>
        </div>
      </div>
    </>
  );
}
