import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { TRYON_HEAD, TRYON_URL, tryonQrSvg } from "@/lib/tryon-qr";

export const metadata = { title: "Try-on QR (A4)" };

/** A4 counter poster: print at 100% (actual size). The QR is 140 mm square. */
export default async function TryonQrA4() {
  await requireUser({ can: "prices" });
  const [shop, qr] = await Promise.all([getSetting("shop"), tryonQrSvg()]);
  return (
    <>
      <AutoPrint auto={false} paper="A4" />
      <div className="mx-auto my-6 flex h-[273mm] w-[186mm] flex-col items-center justify-center gap-[7mm] bg-white text-center text-black shadow print:my-0 print:shadow-none" data-testid="a4">
        <p className="font-display text-[26pt] font-semibold tracking-[0.18em]">SUXUS HERITAGE TAILOR</p>
        <div>
          <p className="font-ml text-[24pt] leading-tight font-semibold">{TRYON_HEAD.ml}</p>
          <p className="mt-[2mm] text-[19pt]">{TRYON_HEAD.en}</p>
        </div>
        <div className="size-[140mm] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <p className="font-ml text-[14pt]">ഫോണിലെ ക്യാമറ കൊണ്ട് സ്കാൻ ചെയ്യുക · Scan with your phone camera</p>
          <p className="mt-[3mm] text-[18pt] font-semibold tabular-nums">{shop.phone}</p>
          <p className="mt-[1mm] text-[10pt] text-neutral-600">{TRYON_URL}</p>
        </div>
      </div>
    </>
  );
}
