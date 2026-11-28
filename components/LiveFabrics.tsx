"use client";

import { useEffect, useState } from "react";
import { ERP_URL, TRYON_ON_SITE, TRYON_URL, waLink } from "@/lib/site";

type Fabric = {
  code: string;
  name: string;
  colour: string | null;
  pattern: string | null;
  kind: "Shirting" | "Suiting";
  rate: number;
  thumb: string | null;
  photo: string | null;
};

const FILTERS = [
  { v: "all", en: "All", ml: "എല്ലാം" },
  { v: "Shirting", en: "Shirting", ml: "ഷർട്ടിങ്" },
  { v: "Suiting", en: "Suiting", ml: "സ്യൂട്ടിങ് / പാന്റ്" },
] as const;

/* Fabrics in stock right now, read live from the shop's ERP (photo, code, name, rate per metre). The ERP shows
   only active fabrics with stock and a photo, and no cost or supplier details. */
export function LiveFabrics({ limit, filters = true, moreHref }: { limit?: number; filters?: boolean; moreHref?: string }) {
  const [list, setList] = useState<Fabric[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<(typeof FILTERS)[number]["v"]>("all");
  const [open, setOpen] = useState<Fabric | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${ERP_URL}/api/public/fabrics`)
      .then((r) => r.json())
      .then((j) => live && (j.ok ? setList(j.fabrics) : setFailed(true)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (failed || (list && list.length === 0)) {
    return (
      <p className="muted">
        See the full range in our showroom, or <a href={waLink("SUXUS | Heritage Tailor — please send me today's fabrics.")}>ask on WhatsApp</a> for today&apos;s
        fabrics.
      </p>
    );
  }

  const shown = (list ?? []).filter((f) => kind === "all" || f.kind === kind);
  const cut = limit ? shown.slice(0, limit) : shown;

  return (
    <div className="fabrics">
      {filters && list && (
        <div className="fab-filters" role="radiogroup" aria-label="Fabric type">
          {FILTERS.map((f) => {
            const n = f.v === "all" ? list.length : list.filter((x) => x.kind === f.v).length;
            return (
              <button key={f.v} type="button" role="radio" aria-checked={kind === f.v} onClick={() => setKind(f.v)}>
                {f.en} <span lang="ml">{f.ml}</span> <span className="n">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      <ul className="fab-grid" aria-busy={!list}>
        {!list &&
          Array.from({ length: limit ?? 8 }, (_, i) => (
            <li key={i} className="fab-card skeleton" aria-hidden="true">
              <span className="fab-img" />
              <span className="fab-line" />
              <span className="fab-line short" />
            </li>
          ))}
        {cut.map((f) => (
          <li key={f.code} className="fab-card">
            <button type="button" className="fab-open" onClick={() => setOpen(f)} aria-label={`${f.name} ${f.code} — details`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="fab-img" src={f.thumb ?? f.photo ?? ""} alt={`${f.name} fabric`} loading="lazy" />
              <span className="fab-kind">{f.kind}</span>
            </button>
            <div className="fab-body">
              <span className="fab-code">{f.code}</span>
              <h3>{f.name}</h3>
              <p className="fab-rate">{f.rate > 0 ? <>₹{f.rate.toLocaleString("en-IN")} <span>/ metre</span></> : <span>Ask for the rate</span>}</p>
              <a className="fab-order" href={`/order/?fabric=${encodeURIComponent(f.code)}`}>
                Order →
              </a>
            </div>
          </li>
        ))}
      </ul>

      {list && (
        <p className="muted small mt-s">
          Today&apos;s rate per metre, stitching extra. Please confirm in the shop — rates change through the year.
          {moreHref && limit && shown.length > limit && (
            <>
              {" "}
              <a className="arrow-link" href={moreHref}>
                See all {list.length} fabrics
              </a>
            </>
          )}
        </p>
      )}

      {open && (
        <div className="fab-modal" role="dialog" aria-modal="true" aria-label={open.name} onClick={() => setOpen(null)}>
          <div className="fab-sheet" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.photo ?? open.thumb ?? ""} alt={`${open.name} fabric`} />
            <div className="fab-sheet-body">
              <span className="fab-code">
                {open.code} · {open.kind}
                {open.pattern ? ` · ${open.pattern}` : ""}
              </span>
              <h3>{open.name}</h3>
              <p className="fab-rate">{open.rate > 0 ? <>₹{open.rate.toLocaleString("en-IN")} <span>/ metre</span></> : <span>Ask for the rate</span>}</p>
              <div className="actions">
                <a className="btn gold" href={`/order/?fabric=${encodeURIComponent(open.code)}`} data-testid="order-fabric">
                  Order this fabric
                </a>
                <a className="btn" href={waLink(`SUXUS | Heritage Tailor — I'm interested in fabric ${open.code} (${open.name}).`)} target="_blank" rel="noopener">
                  Ask on WhatsApp
                </a>
                {TRYON_ON_SITE && open.kind === "Shirting" && (
                  <a className="btn ghost" href={TRYON_URL} target="_blank" rel="noopener">
                    Try it on your photo
                  </a>
                )}
              </div>
              <button type="button" className="fab-close" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
