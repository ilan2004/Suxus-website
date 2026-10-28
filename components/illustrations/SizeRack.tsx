"use client";

import { useRef } from "react";
import { FULL, gsap, REDUCED, useGSAP } from "@/lib/gsap";
import { sketchPath } from "@/lib/sketch";

/* The size-fixing camp as a picture: hand-drawn sample shirts from size 20
   to 46 drop onto a rail and swing to rest, smallest to largest. */

const SIZES = [20, 24, 28, 32, 36, 40, 46];
const SHIRT =
  "M-16 0 C-10 6 10 6 16 0 L28 5 L40 18 L32 28 L26 22 L26 70 L-26 70 L-26 22 L-32 28 L-40 18 L-28 5 Z";
const rail = sketchPath("M20 30 H700", { roughness: 0.8 });
const shirt = sketchPath(SHIRT, { roughness: 0.9 });
const hanger = sketchPath("M-36 0 L0 -14 L36 0", { roughness: 0.6 });
const hook = sketchPath("M0 30 c0 -10 10 -10 10 -16 c0 -6 -8 -7 -11 -3", { roughness: 0.4 });

export function SizeRack() {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const svg = ref.current!;
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: "top 80%", once: true } });
        tl.from(svg.querySelectorAll(".rail path"), { drawSVG: 0, duration: 0.8, ease: "power2.out" });
        // Outer group drops onto the rail; inner group swings from its hook.
        svg.querySelectorAll<SVGGElement>(".hang").forEach((g, i) => {
          const at = 0.6 + i * 0.14;
          const swing = g.querySelector<SVGGElement>(".swing")!;
          tl.from(g, { y: -40, autoAlpha: 0, duration: 0.6, ease: "back.out(1.6)" }, at).fromTo(
            swing,
            { rotation: -16 },
            { rotation: 0, svgOrigin: `${g.dataset.x} 30`, duration: 1.8, ease: "elastic.out(1.1, 0.25)" },
            at,
          );
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
      className="size-rack sketch"
      viewBox="0 0 720 220"
      role="img"
      aria-label="Sample shirts on a rail in sizes 20 to 46"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="rail" strokeWidth={2.4}>
        {rail.map((p, k) => (
          <path key={k} d={p.d} />
        ))}
      </g>
      {SIZES.map((size, i) => {
        const x = 70 + i * 96;
        const s = 0.72 + (i / (SIZES.length - 1)) * 0.5;
        return (
          <g key={size} className="hang" data-x={x}>
            <g className="swing">
            <g transform={`translate(${x - 5} 0)`} strokeWidth={1.4}>
              {hook.map((p, k) => (
                <path key={k} d={p.d} />
              ))}
            </g>
            <g transform={`translate(${x} 44) scale(${s})`} strokeWidth={1.6 / s}>
              {hanger.map((p, k) => (
                <path key={k} d={p.d} />
              ))}
              <g transform="translate(0 4)">
                <path d={SHIRT} fill="var(--paper)" stroke="none" />
                {shirt.map((p, k) => (
                  <path key={k} d={p.d} />
                ))}
              </g>
              <path d="M0 10 V74" strokeDasharray="3 4" strokeWidth={1.3 / s} />
            </g>
            <g transform={`translate(${x} ${44 + 80 * s + 22})`}>
              <rect x={-17} y={-13} width={34} height={22} fill="var(--gold)" stroke="none" />
              <text y={3} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--green)" stroke="none">
                {size}
              </text>
            </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
