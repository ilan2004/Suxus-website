"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_POCKET, POCKET_COUNTS, POCKET_HEM, POCKET_PATHS, POCKET_SHAPES, POCKET_SIZES, type Pocket, type PocketShape } from "@/lib/pocket";

/** A pocket bottom shape: black lines on white, sharp at any size (the same paths print on the job slip). */
export function PocketDrawing({ shape, className, title }: { shape: PocketShape; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("bg-white", className)} role="img" aria-label={title ?? shape}>
      <path d={POCKET_PATHS[shape]} fill="none" stroke="#000" strokeWidth={4} strokeLinejoin="round" />
      <path d={POCKET_HEM} fill="none" stroke="#000" strokeWidth={2} strokeDasharray="5 4" />
    </svg>
  );
}

/** Four large picture tiles (at least 80 × 80), Malayalam name under each; the chosen one is clearly outlined. */
export function PocketShapePicker({ value, onChange, big = false }: { value: PocketShape | null; onChange: (s: PocketShape) => void; big?: boolean }) {
  return (
    <div className={cn("grid gap-2", big ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")} role="radiogroup" aria-label="Pocket bottom shape">
      {POCKET_SHAPES.map((s) => {
        const on = value === s.v;
        return (
          <button
            key={s.v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${s.en} · ${s.ml}`}
            onClick={() => onChange(s.v)}
            data-testid={`pocket-shape-${s.v}`}
            className={cn(
              "relative flex min-h-[80px] min-w-[80px] flex-col items-center justify-center gap-1 rounded-2xl bg-white p-2 text-black transition-colors",
              on ? "border-[5px] border-primary shadow-lg" : "border-2 border-black/20 hover:border-black/50",
            )}
          >
            {on && (
              <span className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
                <Check className="size-5" strokeWidth={3} />
              </span>
            )}
            <PocketDrawing shape={s.v} className={big ? "size-28" : "size-16"} title={s.en} />
            <span className={cn("font-ml leading-tight font-bold", big ? "text-xl" : "text-sm")}>{s.ml}</span>
            <span className={cn("leading-tight text-black/60", big ? "text-sm" : "text-[11px]")}>{s.en}</span>
          </button>
        );
      })}
    </div>
  );
}

function Choice<T extends string>({ items, value, onChange, big, label }: { items: { v: T; ml: string; en: string }[]; value: T | null; onChange: (v: T) => void; big?: boolean; label: string }) {
  return (
    <div className={cn("grid gap-1.5", `grid-cols-${items.length}`)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {items.map((x) => (
        <button
          key={x.v}
          type="button"
          role="radio"
          aria-checked={value === x.v}
          onClick={() => onChange(x.v)}
          className={cn("rounded-xl border-2 px-2 leading-tight", big ? "min-h-16 py-2" : "min-h-11 py-1", value === x.v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
        >
          <span className={cn("block font-ml font-bold", big ? "text-lg" : "text-sm")}>{x.ml}</span>
          <span className={cn("block opacity-80", big ? "text-sm" : "text-[11px]")}>{x.en}</span>
        </button>
      ))}
    </div>
  );
}

const numText = (n: number | null) => (n == null ? "" : String(n));
const toNum = (t: string) => {
  const c = t.replace(",", ".").replace(/[^\d.]/g, "");
  return c === "" || c === "." ? null : Number(c);
};

/**
 * Pocket section of a SHIRT record. `value` null = not recorded (an older record): shown with a button to add it, so
 * nothing is filled in by guess.
 */
export function PocketFields({ value, onChange, big = false }: { value: Pocket | null; onChange: (p: Pocket | null) => void; big?: boolean }) {
  if (!value)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm" data-testid="pocket-empty">
        <span className="text-muted-foreground">
          Pocket not recorded on this record <span className="font-ml">· പോക്കറ്റ് രേഖപ്പെടുത്തിയിട്ടില്ല</span>
        </span>
        <button type="button" onClick={() => onChange({ ...DEFAULT_POCKET })} className="h-9 rounded-md border bg-card px-3 font-medium hover:bg-accent">
          Add pocket
        </button>
      </div>
    );
  const set = (patch: Partial<Pocket>) => onChange({ ...value, ...patch });
  const exact = value.width != null || value.depth != null;
  return (
    <div className="grid gap-3" data-testid="pocket-fields">
      <div className="grid gap-1">
        <p className="text-xs font-medium">
          <span className="font-ml">പോക്കറ്റ്</span> · Number of pockets
        </p>
        <Choice items={POCKET_COUNTS} value={value.count} onChange={(count) => set({ count })} big={big} label="Number of pockets" />
      </div>
      {value.count !== "none" && (
        <>
          <div className="grid gap-1">
            <p className="text-xs font-medium">
              <span className="font-ml">പോക്കറ്റിന്റെ അടിഭാഗം</span> · Pocket bottom shape
            </p>
            <PocketShapePicker value={value.shape} onChange={(shape) => set({ shape })} big={big} />
          </div>
          <div className="grid gap-1">
            <p className="text-xs font-medium">
              <span className="font-ml">പോക്കറ്റിന്റെ വലുപ്പം</span> · Pocket size
            </p>
            <div className={cn(exact && "opacity-40")}>
              <Choice items={POCKET_SIZES} value={exact ? null : value.size} onChange={(size) => set({ size, width: null, depth: null })} big={big} label="Pocket size" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">or exact size (inches) — overrides the choice above:</span>
              <label className="flex items-center gap-1">
                <span className="text-xs">Width</span>
                <input
                  aria-label="Pocket width (inches)"
                  type="text"
                  inputMode="decimal"
                  value={numText(value.width)}
                  onChange={(e) => set({ width: toNum(e.target.value) })}
                  className="h-9 w-20 rounded-md border border-input bg-card px-2 text-right tabular-nums"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs">Depth</span>
                <input
                  aria-label="Pocket depth (inches)"
                  type="text"
                  inputMode="decimal"
                  value={numText(value.depth)}
                  onChange={(e) => set({ depth: toNum(e.target.value) })}
                  className="h-9 w-20 rounded-md border border-input bg-card px-2 text-right tabular-nums"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-1">
            <p className="text-xs font-medium">
              <span className="font-ml">ഫ്ലാപ്പ്</span> · Pocket flap
            </p>
            <Choice
              items={[
                { v: "without", ml: "ഫ്ലാപ്പ് ഇല്ല", en: "Without flap" },
                { v: "with", ml: "ഫ്ലാപ്പ് ഉണ്ട്", en: "With flap" },
              ]}
              value={value.flap ? "with" : "without"}
              onChange={(v) => set({ flap: v === "with" })}
              big={big}
              label="Pocket flap"
            />
          </div>
        </>
      )}
    </div>
  );
}
