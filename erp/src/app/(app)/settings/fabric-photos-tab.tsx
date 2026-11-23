import Link from "next/link";
import { Printer, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PhotoLogRow = {
  id: number;
  at: string;
  fabricId: number | null;
  code: string | null;
  brand: string | null;
  pattern: string | null;
  photoUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  cardFound: boolean;
  cardLongPx: number | null;
  cardShortPx: number | null;
  mmPerPx: number | null;
  periodPx: number | null;
  repeatAxis: string | null;
  repeatCount: number | null;
  repeatStrength: number | null;
  patternMm: number | null;
  colours: { hex: string; share: number }[];
};

/** Settings → Fabric photos: the scale card, and a log of every analysed photo to judge how reliable the measuring is. */
export function FabricPhotosTab({ log }: { log: PhotoLogRow[] }) {
  const found = log.filter((l) => l.cardFound).length;
  return (
    <div className="grid gap-4">
      <div className="flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Ruler className="size-4" /> Scale card · സ്കെയിൽ കാർഡ്
          </p>
          <p className="max-w-lg text-muted-foreground">
            A black 50 × 30 mm rectangle on the 60 × 40 mm label. Put one in a corner of every fabric photo — the app measures the check / stripe size from it and crops it out of the photo
            customers see.
          </p>
        </div>
        <Button asChild>
          <a href="/print/scale-card" target="_blank" rel="noreferrer">
            <Printer /> Print scale card
          </a>
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
          <p className="font-medium">
            Measurement log <span className="ml">അളവ് രേഖ</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Last {log.length} photo{log.length === 1 ? "" : "s"} · scale card found in {found}
          </p>
        </div>
        {log.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No photos analysed yet. Add a fabric photo with a scale card in it.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2">Photo</th>
                  <th className="p-2">Fabric</th>
                  <th className="p-2">Scale card (px)</th>
                  <th className="p-2 text-right">mm / px</th>
                  <th className="p-2">Repeat</th>
                  <th className="p-2 text-right">Pattern size</th>
                  <th className="p-2">Colours</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-b align-top last:border-0">
                    <td className="p-2">
                      {l.photoUrl ? (
                        <a href={l.photoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.photoUrl} alt="" loading="lazy" className="size-14 rounded border object-cover" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">
                      {l.fabricId ? (
                        <Link href={`/fabrics/${l.fabricId}`} className="font-mono text-xs font-medium hover:underline">
                          {l.code}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <span className="block text-xs text-muted-foreground">{[l.brand, l.pattern].filter(Boolean).join(" · ")}</span>
                      <span className="block text-[11px] text-muted-foreground">{new Date(l.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    </td>
                    <td className="p-2 tabular-nums">
                      {l.cardFound ? (
                        <>
                          {l.cardLongPx} × {l.cardShortPx}
                          <span className="block text-[11px] text-muted-foreground">
                            in {l.imageWidth} × {l.imageHeight}
                          </span>
                        </>
                      ) : (
                        <span className="text-warning">not found</span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">{l.mmPerPx ?? "—"}</td>
                    <td className="p-2 tabular-nums">
                      {l.periodPx != null ? (
                        <>
                          {l.repeatCount} repeats · {l.periodPx} px
                          <span className="block text-[11px] text-muted-foreground">
                            {l.repeatAxis} · clarity {l.repeatStrength}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">no repeat found</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-semibold tabular-nums">{l.patternMm != null ? `${l.patternMm} mm` : "—"}</td>
                    <td className="p-2">
                      <span className="flex flex-wrap gap-1.5">
                        {l.colours.map((c) => (
                          <span key={c.hex} className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <span className="size-4 rounded border" style={{ background: c.hex }} />
                            {c.hex} <span className="text-muted-foreground">{Math.round(c.share * 100)}%</span>
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
