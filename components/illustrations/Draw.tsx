"use client";

import { useId, useRef, type ReactNode } from "react";
import { FULL, gsap, REDUCED, useGSAP } from "@/lib/gsap";
import { sketchCircle, sketchPath, type Sketched } from "@/lib/sketch";

/* Primitives for the SUXUS hand-drawn illustration set.
   Shapes are sketched with Rough.js; <Illo> then draws them in with GSAP
   (DrawSVG + ScrollTrigger) when they scroll into view. Each primitive's `i`
   sets its place in the drawing order. */

const STEP = 0.18;

function Strokes({ list, i, kind = "draw" }: { list: Sketched[]; i: number; kind?: string }) {
  return (
    <g data-i={i} className={kind}>
      {list.map((p, k) =>
        p.fill ? <path key={k} d={p.d} fill="currentColor" stroke="none" /> : <path key={k} d={p.d} />,
      )}
    </g>
  );
}

type IlloProps = {
  label: string;
  children: ReactNode;
  className?: string;
  viewBox?: string;
};

export function Illo({ label, children, className = "illo", viewBox = "0 0 120 120" }: IlloProps) {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const svg = ref.current!;
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: "top 88%", once: true } });
        svg.querySelectorAll<SVGGElement>("[data-i]").forEach((g) => {
          const at = Number(g.dataset.i) * STEP;
          if (g.classList.contains("dot")) {
            tl.from(g, { scale: 0, transformOrigin: "50% 50%", duration: 0.45, ease: "back.out(3)" }, at);
          } else {
            tl.from(g.querySelectorAll("path"), { drawSVG: 0, duration: 0.75, ease: "power1.inOut" }, at);
          }
        });
        gsap.set(svg, { visibility: "visible" });
      });
      mm.add(REDUCED, () => {
        gsap.set(svg, { visibility: "visible" });
      });
    },
    { scope: ref },
  );

  return (
    <svg
      ref={ref}
      className={`${className} sketch`}
      viewBox={viewBox}
      role="img"
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function P({ d, i = 0 }: { d: string; i?: number }) {
  return <Strokes list={sketchPath(d)} i={i} />;
}

export function C({ cx, cy, r, i = 0 }: { cx: number; cy: number; r: number; i?: number }) {
  return <Strokes list={sketchCircle(cx, cy, r)} i={i} />;
}

export function Dot({ cx, cy, r, i = 0 }: { cx: number; cy: number; r: number; i?: number }) {
  return <Strokes list={sketchCircle(cx, cy, r, { fill: "currentColor", fillStyle: "solid" })} i={i} kind="dot" />;
}

/* A running stitch: a sketched dashed thread, revealed along its path as if sewn. */
export function Stitch({ d, i = 0, dash = "5 4" }: { d: string; i?: number; dash?: string }) {
  const id = "st" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160">
        <g data-i={i} className="draw">
          <path d={d} stroke="#fff" strokeWidth={8} />
        </g>
      </mask>
      <g mask={`url(#${id})`} strokeDasharray={dash}>
        {sketchPath(d, { roughness: 0.6, disableMultiStroke: true }).map((p, k) => (
          <path key={k} d={p.d} />
        ))}
      </g>
    </>
  );
}
