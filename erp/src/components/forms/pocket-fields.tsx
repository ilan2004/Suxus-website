"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_POCKET,
  DOUBLE_FLAP_PRESET,
  FLAP_BUTTON,
  FLAP_PATHS,
  POCKET_COUNTS,
  POCKET_HEM,
  POCKET_PATHS,
  POCKET_SHAPES,
  POCKET_SIZES,
  type Pocket,
  type PocketCount,
  type PocketShape,
} from "@/lib/pocket";

/** One pocket's lines: the body, then the flap (and its button) or the hem line. */
function PocketLines({ shape, flap, button }: { shape: PocketShape; flap?: boolean; button?: boolean }) {
  return (
    <>
      <path d={POCKET_PATHS[shape]} fill="#fff" stroke="#000" strokeWidth={4} strokeLinejoin="round" />
      {flap ? (
        <>
          <path d={FLAP_PATHS[shape]} fill="#fff" stroke="#000" strokeWidth={4} strokeLinejoin="round" />
          {button && <circle cx={FLAP_BUTTON.cx} cy={FLAP_BUTTON.cy} r={FLAP_BUTTON.r} fill="#fff" stroke="#000" strokeWidth={3} />}
        </>
      ) : (
        <path d={POCKET_HEM} fill="none" stroke="#000" strokeWidth={2} strokeDasharray="5 4" />
      )}
    </>
  );
}

/** A pocket: black lines on white, sharp at any size (the same paths print on the job slip). Two pockets side by side for "Two". */
export function PocketDrawing({ shape, flap, button, count = "one", className, title }: { shape: PocketShape; flap?: boolean; button?: boolean; count?: PocketCount; className?: string; title?: string }) {
  if (count === "two")
    return (
      <svg viewBox="0 0 210 100" className={cn("bg-white", className)} role="img" aria-label={title ?? `two ${shape} pockets`}>
        <PocketLines shape={shape} flap={flap} button={button} />
        <g transform="translate(110 0)">
          <PocketLines shape={shape} flap={flap} button={button} />
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 100 100" className={cn("bg-white", className)} role="img" aria-label={title ?? shape}>
      <PocketLines shape={shape} flap={flap} button={button} />
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

function Choice<T extends string>({ items, value, onChange, big, label }: { items: { v: T; ml: string; en: string; pic?: React.ReactNode }[]; value: T | null; onChange: (v: T) => void; big?: boolean; label: string }) {
  return (
    <div className={cn("grid gap-1.5", `grid-cols-${items.length}`)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {items.map((x) => (
        <button
          key={x.v}
          type="button"
          role="radio"
          aria-checked={value === x.v}
          onClick={() => onChange(x.v)}
          className={cn("flex flex-col items-center justify-center rounded-xl border-2 px-2 leading-tight", big ? "min-h-16 py-2" : "min-h-11 py-1", value === x.v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
        >
          {x.pic && <span className={cn("mb-1 overflow-hidden rounded-md border border-black/20 bg-white", big ? "h-14" : "h-10")}>{x.pic}</span>}
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
  const shape = value.shape ?? "flat";
  const isPreset = value.count === "two" && value.shape === "cut" && value.flap && !!value.button;
  const pic = (count: PocketCount, flap = value.flap, button = value.button) =>
    count === "none" ? <span className={cn("grid h-full place-items-center px-3 text-black/40", big ? "text-2xl" : "text-lg")}>—</span> : <PocketDrawing shape={shape} flap={flap} button={button} count={count} className="h-full w-auto" />;
  return (
    <div className="grid gap-3" data-testid="pocket-fields">
      {/* The common work-shirt style in one tap: two pockets, cut corners, flap with a button */}
      <button
        type="button"
        onClick={() => onChange({ ...DOUBLE_FLAP_PRESET, size: value.size, width: value.width, depth: value.depth })}
        aria-pressed={isPreset}
        data-testid="pocket-preset-double"
        className={cn("flex items-center gap-3 rounded-2xl bg-white p-2 text-left text-black", isPreset ? "border-[5px] border-primary shadow-lg" : "border-2 border-black/20 hover:border-black/50")}
      >
        <PocketDrawing shape="cut" flap button count="two" className={cn("w-auto shrink-0", big ? "h-20" : "h-14")} title="Double pocket with button flaps" />
        <span className="leading-tight">
          <span className={cn("block font-ml font-bold", big ? "text-xl" : "text-base")}>ഡബിൾ പോക്കറ്റ് · ഫ്ലാപ്പ് + ബട്ടൺ</span>
          <span className={cn("block text-black/60", big ? "text-sm" : "text-xs")}>Two pockets, cut corners, flap with button — one tap</span>
        </span>
        {isPreset && <Check className="ml-auto size-6 shrink-0 text-primary" strokeWidth={3} />}
      </button>
      <div className="grid gap-1">
        <p className="text-xs font-medium">
          <span className="font-ml">പോക്കറ്റ്</span> · Number of pockets
        </p>
        <Choice items={POCKET_COUNTS.map((c) => ({ ...c, pic: pic(c.v) }))} value={value.count} onChange={(count) => set({ count })} big={big} label="Number of pockets" />
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
                { v: "without", ml: "ഫ്ലാപ്പ് ഇല്ല", en: "Without flap", pic: pic("one", false, false) },
                { v: "with", ml: "ഫ്ലാപ്പ് ഉണ്ട്", en: "With flap", pic: pic("one", true, false) },
                { v: "button", ml: "ഫ്ലാപ്പ് + ബട്ടൺ", en: "Flap with button", pic: pic("one", true, true) },
              ]}
              value={!value.flap ? "without" : value.button ? "button" : "with"}
              onChange={(v) => set({ flap: v !== "without", button: v === "button" })}
              big={big}
              label="Pocket flap"
            />
          </div>
        </>
      )}
    </div>
  );
}
