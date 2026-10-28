"use client";

import { useRef } from "react";
import { FULL, gsap, REDUCED, useGSAP } from "@/lib/gsap";
import { sketchCircle, sketchPath } from "@/lib/sketch";

/* Hero animation, one GSAP timeline: a tape measure unrolls (sizes 20–46),
   chalk sketches the pattern, a needle sews the outline, then collar,
   placket, pocket, buttons and the SUXUS label are finished. Lines are
   hand-drawn with Rough.js. Plays when it scrolls into view. */

const OUTLINE =
  "M150 60 C170 80 230 80 250 60 L292 74 L342 110 L374 192 L322 212 L300 172 L300 402 L100 402 L100 172 L78 212 L26 192 L58 110 L108 74 Z";
const COLLAR = "M150 60 L176 118 L200 96 L224 118 L250 60";
const PLACKET = "M200 96 V400";
const POCKET = "M232 168 h46 v52 l-23 9 l-23 -9 Z";
const CUFFS = "M38 166 L90 186 M362 166 L310 186";
const BUTTONS = [140, 190, 240, 290, 340];
const SIZES = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46];

const chalk = sketchPath(OUTLINE, { roughness: 1.8, bowing: 2 });
const seam = sketchPath(OUTLINE, { roughness: 0.7, disableMultiStroke: true });
const placket = sketchPath(PLACKET, { roughness: 0.6, disableMultiStroke: true });
const finishing = [COLLAR, POCKET, CUFFS].map((d) => sketchPath(d, { roughness: 1.2 }));

export function StitchingShirt() {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const svg = q(".stitch-svg")[0];
      const guide = root.current!.querySelector<SVGPathElement>(".guide")!;
      const needle = root.current!.querySelector<SVGGElement>(".needle")!;
      const len = guide.getTotalLength();

      // Place the needle on the seam, pointing the way it travels and dipping
      // in and out of the cloth as it goes.
      const sewing = { p: 0 };
      const placeNeedle = () => {
        const at = sewing.p * len;
        const a = guide.getPointAtLength(at);
        const b = guide.getPointAtLength(Math.min(at + 1, len));
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const dip = 0.72 + 0.28 * Math.abs(Math.cos(at / 9));
        needle.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${angle}) scale(${dip} 1)`);
      };
      const mm = gsap.matchMedia();

      mm.add(FULL, () => {
        const t = gsap.timeline({
          defaults: { ease: "power1.inOut" },
          scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
        });
        t.from(q(".tape"), { x: -360, duration: 1, ease: "power2.out" })
          .from(q(".chalk path"), { drawSVG: 0, duration: 1.1 }, 0.4)
          .addLabel("sew", 1.4)
          .set(q(".needle"), { autoAlpha: 1 }, "sew")
          .from(q(".sew-mask"), { drawSVG: 0, duration: 4.6, ease: "power1.inOut" }, "sew")
          .fromTo(sewing, { p: 0 }, { p: 1, duration: 4.6, ease: "power1.inOut", onUpdate: placeNeedle }, "sew")
          .to(q(".needle"), { autoAlpha: 0, duration: 0.3 })
          .addLabel("finish")
          .from(q(".cloth"), { fillOpacity: 0, duration: 0.8 }, "finish")
          .from(q(".fin-0 path"), { drawSVG: 0, duration: 0.7 }, "finish")
          .from(q(".placket-mask"), { drawSVG: 0, duration: 1 }, "finish+=0.6")
          .from(q(".fin-1 path"), { drawSVG: 0, duration: 0.7 }, "finish+=1.2")
          .from(q(".fin-2 path"), { drawSVG: 0, duration: 0.6 }, "finish+=1.4")
          .from(q(".button"), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(3)", stagger: 0.12 }, "finish+=1.7")
          .from(q(".label"), { y: -8, autoAlpha: 0, duration: 0.5, ease: "power2.out" }, "finish+=2.5");
        tl.current = t;
        gsap.set(svg, { visibility: "visible" });
      });

      mm.add(REDUCED, () => {
        gsap.set(svg, { visibility: "visible" });
      });
    },
    { scope: root },
  );

  return (
    <div className="stitch-panel" ref={root}>
      <svg
        className="stitch-svg sketch"
        viewBox="0 0 400 470"
        role="img"
        aria-label="Animation: a shirt being measured, marked and stitched"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <mask id="sew" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="470">
            <path className="sew-mask" d={OUTLINE} stroke="#fff" strokeWidth={12} />
          </mask>
          <mask id="placket" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="470">
            <path className="placket-mask" d={PLACKET} stroke="#fff" strokeWidth={12} />
          </mask>
          <clipPath id="tape-clip">
            <rect x="20" y="430" width="360" height="26" />
          </clipPath>
        </defs>

        {/* 1 — tape measure */}
        <g clipPath="url(#tape-clip)">
          <g className="tape">
            <rect x="20" y="430" width="360" height="26" fill="var(--gold)" />
            {SIZES.map((s, i) => {
              const x = 32 + i * 25.4;
              return (
                <g key={s}>
                  <path d={`M${x} 430 v8 M${x + 12.7} 430 v5`} stroke="var(--green)" strokeWidth={1} />
                  <text x={x} y={451} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--green)">
                    {s}
                  </text>
                </g>
              );
            })}
          </g>
        </g>

        {/* 2 — chalk sketch of the pattern */}
        <g className="chalk" stroke="var(--cream)" strokeOpacity={0.35} strokeWidth={1.2}>
          {chalk.map((p, k) => (
            <path key={k} d={p.d} />
          ))}
        </g>
        <path className="guide" d={OUTLINE} stroke="none" />
        <path className="cloth" d={OUTLINE} fill="var(--cream)" fillOpacity={0.07} />

        {/* 3 — the running stitch, revealed behind the needle */}
        <g mask="url(#sew)" stroke="var(--gold)" strokeWidth={2.4} strokeDasharray="9 6">
          {seam.map((p, k) => (
            <path key={k} d={p.d} />
          ))}
        </g>

        {/* 4 — finishing */}
        {finishing.map((list, n) => (
          <g key={n} className={`fin-${n}`} stroke="var(--gold)" strokeWidth={1.8}>
            {list.map((p, k) => (
              <path key={k} d={p.d} />
            ))}
          </g>
        ))}
        <g mask="url(#placket)" stroke="var(--gold)" strokeWidth={2} strokeDasharray="5 5">
          {placket.map((p, k) => (
            <path key={k} d={p.d} />
          ))}
        </g>
        {BUTTONS.map((y) => (
          <g key={y} className="button">
            <circle cx={200} cy={y} r={7} fill="var(--green)" />
            {sketchCircle(200, y, 7).map((p, k) => (
              <path key={k} d={p.d} stroke="var(--gold)" strokeWidth={1.6} />
            ))}
            <path d={`M197 ${y - 3} l6 6 M203 ${y - 3} l-6 6`} stroke="var(--gold)" strokeWidth={1.2} />
          </g>
        ))}

        {/* 5 — the label goes in last */}
        <g className="label">
          <rect x="178" y="70" width="44" height="16" fill="var(--gold)" />
          <text x="200" y="81.5" textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1.2" fill="var(--green)">
            SUXUS
          </text>
        </g>

        {/* the needle and its thread; its tip sits at (0, 0) */}
        <g className="needle" style={{ visibility: "hidden" }}>
          <path d="M-40 0 C-58 -10 -72 12 -96 2" stroke="var(--gold)" strokeWidth={1.5} />
          <path d="M3 0 L-40 -2.6 L-46 0 L-40 2.6 Z" fill="var(--cream)" />
          <ellipse cx={-38} cy={0} rx={3} ry={1} fill="var(--green)" />
        </g>
      </svg>
      <div className="stitch-foot">
        <span>Measured · Cut · Stitched in Pallikkal</span>
        <button
          type="button"
          onClick={() => tl.current?.restart()}
          aria-label="Play the stitching animation again"
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}
