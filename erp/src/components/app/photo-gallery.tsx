"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Main photo large + thumbnails; tap opens a full-screen viewer (swipe, pinch / double-tap zoom). */
export function PhotoGallery({ photos, thumbs, alt }: { photos: string[]; thumbs: string[]; alt: string }) {
  const [open, setOpen] = React.useState<number | null>(null);
  if (!photos.length)
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ImageOff className="size-4" /> No photo yet — tap Edit to add
        </span>
      </div>
    );
  return (
    <div className="grid gap-2">
      <button type="button" onClick={() => setOpen(0)} className="overflow-hidden rounded-xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0]} alt={alt} className="aspect-[4/3] w-full object-cover" />
      </button>
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <button key={p} type="button" onClick={() => setOpen(i)} className={cn("overflow-hidden rounded-lg border", i === 0 && "ring-2 ring-gold")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbs[i] ?? p} alt={`${alt} ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open != null && <Lightbox photos={photos} start={open} alt={alt} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ photos, start, alt, onClose }: { photos: string[]; start: number; alt: string; onClose: () => void }) {
  const track = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(start);
  const [zoom, setZoom] = React.useState(false);

  const goTo = React.useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [photos.length]);

  React.useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-label="Photo viewer">
      <div className="flex items-center justify-between p-3 text-sm text-white">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) {
            setIndex(i);
            setZoom(false);
          }
        }}
        className={cn("flex flex-1 snap-x snap-mandatory overflow-y-hidden", zoom ? "overflow-x-hidden" : "overflow-x-auto")}
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((p, i) => (
          <div key={p} className={cn("relative h-full w-full shrink-0 snap-center", zoom && i === index ? "overflow-auto" : "grid place-items-center")} style={{ touchAction: zoom ? "pan-x pan-y" : "pan-x pinch-zoom" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p}
              alt={`${alt} ${i + 1}`}
              onDoubleClick={() => setZoom((z) => !z)}
              onClick={(e) => e.detail === 2 && setZoom((z) => !z)}
              className={cn("select-none", zoom && i === index ? "max-w-none" : "max-h-full max-w-full object-contain")}
              style={zoom && i === index ? { width: "250%" } : undefined}
              draggable={false}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-6 p-4 text-xs text-white/70">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className="grid size-11 place-items-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Previous">
          <ChevronLeft className="size-5" />
        </button>
        <span>Swipe · double-tap or pinch to zoom</span>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === photos.length - 1} className="grid size-11 place-items-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Next">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
