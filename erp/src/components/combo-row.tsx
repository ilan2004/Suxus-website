"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ComboCard } from "@/lib/combo-server";

/** "ഇതിന് ചേരുന്ന പാൻറ്റ്" — 2-3 trouser fabrics from our stock, with a fixed reason and an occasion tag. */
export const COMBO_WORDS = {
  title: ["ഇതിന് ചേരുന്ന പാൻറ്റ്", "Trousers that go with this"],
  short: ["സ്റ്റോക്കിൽ ഇപ്പോൾ ഇതാണ് ചേരുന്നത്.", "This is what matches from our stock right now."],
  none: ["ഇപ്പോൾ സ്റ്റോക്കിൽ ചേരുന്ന പാൻറ്റ് തുണി ഇല്ല.", "No matching trouser fabric in stock right now."],
  perMetre: ["/ മീ", "/ m"],
} as const;

const two = (n: number) => n.toFixed(2);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** ഷർട്ട് തുണി 1.60 മീ + പാൻറ്റ് തുണി 1.30 മീ + സ്റ്റിച്ചിങ് = ആകെ ഏകദേശം ₹2,140 (stitching left out when not priced). */
export function estimateText(e: NonNullable<ComboCard["estimate"]>, lang: "ml" | "en") {
  if (lang === "ml")
    return e.stitch != null
      ? `ഷർട്ട് തുണി ${two(e.shirtMtr)} മീ + പാൻറ്റ് തുണി ${two(e.pantMtr)} മീ + സ്റ്റിച്ചിങ് = ആകെ ഏകദേശം ${inr(e.total)}`
      : `ഷർട്ട് തുണി ${two(e.shirtMtr)} മീ + പാൻറ്റ് തുണി ${two(e.pantMtr)} മീ = തുണിക്ക് ആകെ ഏകദേശം ${inr(e.total)}`;
  return e.stitch != null
    ? `Shirt fabric ${two(e.shirtMtr)} m + trouser fabric ${two(e.pantMtr)} m + stitching = about ${inr(e.total)} in all`
    : `Shirt fabric ${two(e.shirtMtr)} m + trouser fabric ${two(e.pantMtr)} m = about ${inr(e.total)} for the fabric`;
}

export function ComboRow({
  items,
  short,
  lang,
  selected,
  onPick,
  hrefOf,
  showEstimate = true,
}: {
  items: ComboCard[];
  short: boolean;
  lang: "ml" | "en";
  /** the card whose set estimate is shown (default: the first) */
  selected?: number | null;
  /** try-on: tap opens the fabric's details on the page */
  onPick?: (c: ComboCard) => void;
  /** ERP: tap opens the fabric's own page */
  hrefOf?: (c: ComboCard) => string;
  showEstimate?: boolean;
}) {
  const pick = (w: readonly [string, string]) => (lang === "ml" ? w[0] : w[1]);
  const chosen = items.find((c) => c.id === selected) ?? items[0];
  return (
    <section className="grid gap-2" data-testid="combo-row">
      <p className={cn("text-base font-semibold", lang === "ml" && "font-ml")}>{pick(COMBO_WORDS.title)}</p>
      {items.length === 0 ? (
        <p className={cn("text-sm text-muted-foreground", lang === "ml" && "font-ml")} data-testid="combo-none">
          {pick(COMBO_WORDS.none)}
        </p>
      ) : (
        <>
          <div className={cn("grid gap-2", hrefOf && "max-w-xl", items.length === 1 ? "grid-cols-1 max-w-[12rem]" : items.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {items.map((c) => {
              const body = (
                <>
                  <span className="relative block aspect-square w-full overflow-hidden rounded-lg border" style={{ background: c.hex ?? "#ddd" }}>
                    {c.thumb && <img src={c.thumb} alt="" className="size-full object-cover" loading="lazy" />}
                    <span className={cn("absolute top-1 left-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white", "font-ml")}>{c.occasion.ml}</span>
                  </span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{c.code}</span>
                  <span className={cn("block truncate text-xs font-medium", lang === "ml" && "font-ml")}>{c.colour || c.bucketMl}</span>
                  <span className={cn("block text-[11px] leading-snug", lang === "ml" && "font-ml")}>{lang === "ml" ? c.reason.ml : c.reason.en}</span>
                </>
              );
              const cls = cn("grid min-w-0 content-start gap-1 rounded-xl border bg-card p-1.5 text-left", chosen?.id === c.id && onPick && "ring-2 ring-primary");
              return hrefOf ? (
                <a key={c.id} href={hrefOf(c)} className={cn(cls, "hover:bg-accent")} data-testid={`combo-${c.code}`}>
                  {body}
                </a>
              ) : (
                <button key={c.id} type="button" onClick={() => onPick?.(c)} className={cls} data-testid={`combo-${c.code}`}>
                  {body}
                </button>
              );
            })}
          </div>
          {short && (
            <p className={cn("text-xs text-muted-foreground", lang === "ml" && "font-ml")} data-testid="combo-short">
              {pick(COMBO_WORDS.short)}
            </p>
          )}
          {showEstimate && chosen?.estimate && (
            <p className={cn("rounded-lg bg-muted/60 px-3 py-2 text-xs", lang === "ml" && "font-ml")} data-testid="combo-estimate">
              <b className="font-mono">{chosen.code}</b> · {estimateText(chosen.estimate, lang)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Try-on: the trouser fabric's details, on the page (customers have no ERP fabric page). Never makes a try-on image. */
export function ComboDetail({ c, lang, onClose, closeWord }: { c: ComboCard; lang: "ml" | "en"; onClose: () => void; closeWord: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" data-testid="combo-detail">
      <div className="grid w-full max-w-md gap-3 rounded-2xl bg-background p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border" style={{ background: c.hex ?? "#ddd" }}>
          {c.photo && <img src={c.photo} alt="" className="size-full object-cover" />}
        </div>
        <div>
          <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
          <p className="text-lg font-semibold">{c.name}</p>
          <p className={cn("text-sm", lang === "ml" && "font-ml")}>
            {c.colour || c.bucketMl} · <span className="font-ml">{c.occasion.ml}</span>
            {c.rate > 0 && (
              <>
                {" "}
                · ₹{c.rate}
                {lang === "ml" ? " / മീ" : " / m"}
              </>
            )}
          </p>
        </div>
        <p className={cn("text-sm", lang === "ml" && "font-ml")}>{lang === "ml" ? c.reason.ml : c.reason.en}</p>
        {c.estimate && <p className={cn("rounded-lg bg-muted/60 px-3 py-2 text-xs", lang === "ml" && "font-ml")}>{estimateText(c.estimate, lang)}</p>}
        <button type="button" onClick={onClose} className="h-11 rounded-xl border bg-card font-medium">
          {closeWord}
        </button>
      </div>
    </div>
  );
}
