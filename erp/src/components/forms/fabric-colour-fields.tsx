"use client";

import * as React from "react";
import { Pencil, Pipette } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { PATTERNS, hasRepeat } from "@/lib/fabric-patterns";
import { toHex } from "@/lib/fabric-analysis";
import { cn } from "@/lib/utils";

export type PatternColourValue = {
  pattern?: string | null;
  patternMm?: number | null;
  patternMmSource?: "card" | "hand" | null;
  dominantHex?: string | null;
  secondaryHexes?: string[];
  colourSources?: ("auto" | "hand")[];
};

/** Pattern, pattern size (mm) and the three colour swatches — filled from the main photo, editable by hand. */
export function PatternColourFields({
  v,
  onChange,
  required,
  cardStatus,
  photo,
}: {
  v: PatternColourValue;
  onChange: (patch: PatternColourValue) => void;
  required: boolean;
  /** Main photo just analysed: was a scale card found? (null = no new photo) */
  cardStatus: "found" | "not-found" | null;
  /** Main photo (card already cropped out) — for picking a colour by hand. */
  photo: string | null;
}) {
  const [editMm, setEditMm] = React.useState(false);
  const [pick, setPick] = React.useState<number | null>(null);
  const hexes = [v.dominantHex ?? null, v.secondaryHexes?.[0] ?? null, v.secondaryHexes?.[1] ?? null];
  const sources = v.colourSources ?? [];
  const setHex = (i: number, hex: string) => {
    const next = [...hexes];
    next[i] = hex;
    const src = [0, 1, 2].map((j) => (j === i ? "hand" : (sources[j] ?? "auto"))) as ("auto" | "hand")[];
    onChange({ dominantHex: next[0], secondaryHexes: [next[1], next[2]].filter((x): x is string => !!x), colourSources: src });
  };

  return (
    <>
      <Field label="Pattern" ml="പാറ്റേൺ" required={required}>
        <ListSelect items={[...PATTERNS]} value={v.pattern ?? null} onChange={(p) => onChange({ pattern: p })} />
      </Field>
      {hasRepeat(v.pattern) ? (
        <Field label="Pattern size (mm)" ml="പാറ്റേണിന്റെ വലുപ്പം (mm)">
          {v.patternMm != null && v.patternMmSource === "card" && !editMm ? (
            <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
              <span className="flex-1">
                <b>{v.patternMm} mm</b> <span className="text-muted-foreground">(measured from scale card)</span>
              </span>
              <button type="button" onClick={() => setEditMm(true)} aria-label="Edit pattern size" className="grid size-7 place-items-center rounded hover:bg-muted">
                <Pencil className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={v.patternMm ?? ""}
                  onChange={(e) => onChange({ patternMm: e.target.value === "" ? null : Number(e.target.value), patternMmSource: e.target.value === "" ? null : "hand" })}
                  placeholder="mm"
                  className="w-28"
                />
                {v.patternMmSource === "hand" && v.patternMm != null && <span className="text-xs text-muted-foreground">(set by hand)</span>}
              </div>
              {cardStatus === "not-found" && v.patternMmSource !== "hand" && <span className="text-xs text-warning">scale card not found - size not measured</span>}
            </div>
          )}
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}

      <div className="grid gap-2 sm:col-span-2">
        <p className="text-sm font-medium">
          Colours <span className="ml">മുഖ്യനിറം · മറ്റ് നിറങ്ങൾ</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Main photo" className="size-14 rounded-lg border object-cover" />
          )}
          {hexes.map((hex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPick(i)}
              disabled={!photo && !hex}
              className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-left hover:border-primary/50 disabled:opacity-60"
              title="Tap to pick a different spot on the photo"
            >
              <span className={cn("size-8 shrink-0 rounded-md border", !hex && "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,#ddd_4px,#ddd_8px)]")} style={hex ? { background: hex } : undefined} />
              <span className="leading-tight">
                <span className="block text-[11px] text-muted-foreground">{i === 0 ? "Dominant · മുഖ്യനിറം" : `Secondary ${i}`}</span>
                <span className="block font-mono text-xs">{hex ?? "—"}</span>
                {sources[i] === "hand" && hex && <span className="block text-[10px] text-muted-foreground">(set by hand)</span>}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Sampled from the main photo, away from the scale card. Tap a swatch to pick another spot.</p>
      </div>

      {pick != null && <ColourPicker photo={photo} current={hexes[pick]} title={pick === 0 ? "Dominant colour" : `Secondary colour ${pick}`} onClose={() => setPick(null)} onPick={(hex) => (setHex(pick, hex), setPick(null))} />}
    </>
  );
}

/** Tap a spot on the photo to take its colour (5 × 5 px average), or type a hex value. */
function ColourPicker({ photo, current, title, onClose, onPick }: { photo: string | null; current: string | null; title: string; onClose: () => void; onPick: (hex: string) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hex, setHex] = React.useState(current ?? "");
  const [readable, setReadable] = React.useState(true);

  React.useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const s = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try {
        ctx.getImageData(0, 0, 1, 1);
      } catch {
        setReadable(false);
      }
    };
    img.onerror = () => setReadable(false);
    img.src = photo;
  }, [photo]);

  const sample = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * c.width), y = Math.round(((e.clientY - r.top) / r.height) * c.height);
    try {
      const d = c.getContext("2d")!.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
      let R = 0, G = 0, B = 0;
      for (let i = 0; i < d.length; i += 4) (R += d[i]), (G += d[i + 1]), (B += d[i + 2]);
      const n = d.length / 4;
      setHex(toHex(R / n, G / n, B / n));
    } catch {
      setReadable(false);
    }
  };
  const valid = /^#[0-9A-Fa-f]{6}$/.test(hex);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Tap the cloth where the colour is right. ശരിയായ നിറമുള്ള ഭാഗത്ത് തൊടുക.</DialogDescription>
        </DialogHeader>
        {photo && readable ? (
          <canvas ref={canvasRef} onClick={sample} className="max-h-[50dvh] w-full cursor-crosshair rounded-lg border object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">{photo ? "This photo cannot be sampled here — type the hex value below." : "Add a photo to pick a colour from it, or type the hex value."}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="size-9 shrink-0 rounded-md border" style={valid ? { background: hex } : undefined} />
          <Pipette className="size-4 text-muted-foreground" />
          <Input value={hex} onChange={(e) => setHex(e.target.value.trim().toUpperCase())} placeholder="#1F2A44" className="w-32 font-mono" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid} onClick={() => onPick(hex.toUpperCase())}>
            Use this colour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
