"use client";

import * as React from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, RotateCw, Star, X } from "lucide-react";
import { getPhotoUploadTargets } from "@/lib/actions/fabrics";
import { processPhoto, putWithProgress } from "@/lib/image-client";
import { cn } from "@/lib/utils";
import type { ColourSuggestion } from "@/lib/colour-detect";
import type { FabricAnalysis } from "@/lib/fabric-analysis";

export const MAX_PHOTOS = 4;

export type PhotoItem = {
  key: string;
  preview: string;
  url?: string;
  thumb?: string;
  /** Original WITH the scale card (measurement only, never shown). */
  original?: string | null;
  /** What the photo analysis found (scale card, repeat, colours) — only for photos added now. */
  analysis?: FabricAnalysis | null;
  status: "processing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  file?: File;
};

export const photosFrom = (urls: string[], thumbs: string[], originals: (string | null)[] = []): PhotoItem[] =>
  urls.map((url, i) => ({ key: url, url, thumb: thumbs[i] ?? url, original: originals[i] ?? null, preview: thumbs[i] ?? url, status: "done", progress: 1 }));

/** Up to 4 fabric photos: camera or gallery, resized + uploaded straight away, reorder, set main, remove, retry. */
export function PhotoPicker({
  value,
  onChange,
  disabled,
  onColour,
  onAnalysis,
  hint,
}: {
  value: PhotoItem[];
  onChange: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  disabled?: boolean;
  /** Called with the colour found in each newly added photo (free, worked out on the phone). */
  onColour?: (c: ColourSuggestion) => void;
  /** Called when a newly added photo has been analysed (key of the photo, result). */
  onAnalysis?: (key: string, a: FabricAnalysis | null) => void;
  /** Instruction shown above the camera / gallery buttons. */
  hint?: React.ReactNode;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState<number | null>(null);
  const update = React.useCallback((key: string, patch: Partial<PhotoItem>) => onChange((items) => items.map((i) => (i.key === key ? { ...i, ...patch } : i))), [onChange]);

  const upload = React.useCallback(
    async (item: PhotoItem) => {
      if (!item.file) return;
      try {
        update(item.key, { status: "processing", progress: 0, error: undefined });
        const { photo, thumb, original, ext, colour, analysis } = await processPhoto(item.file);
        if (colour) onColour?.(colour);
        // Show the customer-facing (card cropped out) version straight away
        update(item.key, { status: "uploading", progress: 0.05, preview: URL.createObjectURL(photo), analysis });
        onAnalysis?.(item.key, analysis);
        const t = await getPhotoUploadTargets(ext, !!original);
        if (!t.ok) throw new Error(t.error);
        await putWithProgress(t.data.photo.uploadUrl, photo, t.data.photo.contentType, (f) => update(item.key, { progress: 0.05 + f * (original ? 0.5 : 0.8) }));
        // The original (with the scale card) is for measuring only — if it fails to upload, keep the photo anyway
        let originalUrl: string | null = null;
        if (original && t.data.original)
          originalUrl = await putWithProgress(t.data.original.uploadUrl, original, t.data.original.contentType, (f) => update(item.key, { progress: 0.55 + f * 0.3 })).then(
            () => t.data.original!.publicUrl,
            () => null,
          );
        await putWithProgress(t.data.thumb.uploadUrl, thumb, t.data.thumb.contentType, (f) => update(item.key, { progress: 0.85 + f * 0.15 }));
        update(item.key, { status: "done", progress: 1, url: t.data.photo.publicUrl, thumb: t.data.thumb.publicUrl, original: originalUrl });
      } catch (e) {
        update(item.key, { status: "error", error: (e as Error).message });
      }
    },
    [update, onColour, onAnalysis],
  );

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - value.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const items: PhotoItem[] = picked.map((file) => ({ key: crypto.randomUUID(), preview: URL.createObjectURL(file), status: "processing", progress: 0, file }));
    onChange((cur) => [...cur, ...items]);
    items.forEach((i) => void upload(i));
  };

  const move = (from: number, to: number) =>
    onChange((items) => {
      if (to < 0 || to >= items.length) return items;
      const next = [...items];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });

  const full = value.length >= MAX_PHOTOS;
  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((p, i) => (
            <li
              key={p.key}
              draggable={!disabled}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag != null) move(drag, i);
                setDrag(null);
              }}
              className={cn("relative overflow-hidden rounded-xl border bg-muted", i === 0 && "ring-2 ring-gold")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className={cn("aspect-square w-full object-cover", p.status !== "done" && "opacity-60")} />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-gold-foreground">MAIN</span>}
              <button
                type="button"
                onClick={() => onChange((items) => items.filter((x) => x.key !== p.key))}
                className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-black/60 text-white"
                aria-label="Remove photo"
              >
                <X className="size-4" />
              </button>
              {(p.status === "processing" || p.status === "uploading") && (
                <div className="absolute inset-x-0 bottom-0 grid gap-1 bg-black/55 p-2 text-[11px] text-white">
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> {p.status === "processing" ? "Preparing…" : `Uploading ${Math.round(p.progress * 100)}%`}
                  </span>
                  <span className="h-1 overflow-hidden rounded bg-white/30">
                    <span className="block h-1 bg-white transition-all" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                  </span>
                </div>
              )}
              {p.status === "error" && (
                <div className="absolute inset-0 grid place-content-center gap-2 bg-black/60 p-2 text-center text-[11px] text-white">
                  <span>{p.error}</span>
                  <button type="button" onClick={() => void upload(p)} className="mx-auto inline-flex h-8 items-center gap-1 rounded-md bg-white px-3 text-xs font-medium text-black">
                    <RotateCw className="size-3.5" /> Retry
                  </button>
                </div>
              )}
              {p.status === "done" && value.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full bg-black/50 text-white disabled:opacity-30" aria-label="Move left">
                    <ChevronLeft className="size-4" />
                  </button>
                  {i !== 0 && (
                    <button type="button" onClick={() => move(i, 0)} className="inline-flex h-8 items-center gap-1 rounded-full bg-black/50 px-2.5 text-[11px] text-white" aria-label="Set as main photo">
                      <Star className="size-3.5" /> Main
                    </button>
                  )}
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === value.length - 1} className="grid size-8 place-items-center rounded-full bg-black/50 text-white disabled:opacity-30" aria-label="Move right">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!full && hint}
      {!full && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <Camera className="size-5" /> Take photo
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => galleryRef.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            <ImagePlus className="size-5" /> Choose from gallery
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {value.length}/{MAX_PHOTOS} photos · first one is the main photo · optional
      </p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
    </div>
  );
}
