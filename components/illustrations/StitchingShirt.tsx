"use client";

import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/* Hero animation: a tape measure unrolls (sizes 20–46), chalk marks the
   pattern, a needle sews the outline, then collar, placket, pocket, buttons
   and the SUXUS label are finished. Plays when it scrolls into view. */

const OUTLINE =
  "M150 60 C170 80 230 80 250 60 L292 74 L342 110 L374 192 L322 212 L300 172 L300 402 L100 402 L100 172 L78 212 L26 192 L58 110 L108 74 Z";
const COLLAR = "M150 60 L176 118 L200 96 L224 118 L250 60";
const PLACKET = "M200 96 V400";
const POCKET = "M232 168 h46 v52 l-23 9 l-23 -9 Z";
const CUFFS = "M38 166 L90 186 M362 166 L310 186";
const BUTTONS = [140, 190, 240, 290, 340];
const SIZES = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46];

const SEW_START = 1.4;
const SEW_TIME = 4.6;
const FINISH = SEW_START + SEW_TIME;

export function StitchingShirt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [run, setRun] = useState(0);

  return (
    <div className="stitch-panel" ref={ref}>
      {inView ? <Scene key={run} /> : <svg className="stitch-svg" viewBox="0 0 400 470" aria-hidden="true" />}
      <div className="stitch-foot">
        <span>Measured · Cut · Stitched in Pallikkal</span>
        <button type="button" onClick={() => setRun((r) => r + 1)} aria-label="Play the stitching animation again">
          ↻ Replay
        </button>
      </div>
    </div>
  );
}

function Scene() {
  const reduce = useReducedMotion();
  const progress = useMotionValue(reduce ? 1 : 0);
  const guide = useRef<SVGPathElement>(null);
  const needle = useRef<SVGGElement>(null);

  // Timing helper: everything is instant for people who prefer reduced motion.
  const t = (delay: number, duration: number) => (reduce ? { duration: 0 } : { delay, duration, ease: "easeInOut" as const });

  useEffect(() => {
    if (reduce) return;
    const controls = animate(progress, 1, { delay: SEW_START, duration: SEW_TIME, ease: [0.45, 0.05, 0.4, 1] });
    return () => controls.stop();
  }, [progress, reduce]);

  // Move the needle along the outline, pointing the way it travels and
  // dipping in and out of the cloth as it goes.
  useMotionValueEvent(progress, "change", (v) => {
    const path = guide.current;
    const g = needle.current;
    if (!path || !g) return;
    const len = path.getTotalLength();
    const at = v * len;
    const p = path.getPointAtLength(at);
    const q = path.getPointAtLength(Math.min(at + 1, len));
    const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const dip = 0.72 + 0.28 * Math.abs(Math.cos(at / 9));
    g.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle}) scale(${dip} 1)`);
    g.style.opacity = v > 0 && v < 1 ? "1" : "0";
  });

  return (
    <motion.svg
      className="stitch-svg"
      viewBox="0 0 400 470"
      role="img"
      aria-label="Animation: a shirt being measured, marked and stitched"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <mask id="sew" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="470">
          <motion.path d={OUTLINE} stroke="#fff" strokeWidth={10} style={{ pathLength: progress }} />
        </mask>
        <mask id="placket" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="470">
          <motion.path
            d={PLACKET}
            stroke="#fff"
            strokeWidth={10}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={t(FINISH + 0.6, 1)}
          />
        </mask>
        <clipPath id="tape-clip">
          <rect x="20" y="430" width="360" height="26" />
        </clipPath>
      </defs>

      {/* 1 — tape measure unrolls */}
      <g clipPath="url(#tape-clip)">
        <motion.g initial={{ x: -360 }} animate={{ x: 0 }} transition={t(0.1, 1)}>
          <rect x="20" y="430" width="360" height="26" fill="var(--gold)" />
          {SIZES.map((s, i) => {
            const x = 32 + i * 25.4;
            return (
              <g key={s}>
                <path d={`M${x} 430 v8`} stroke="var(--green)" strokeWidth={1} />
                <path d={`M${x + 12.7} 430 v5`} stroke="var(--green)" strokeWidth={1} />
                <text x={x} y={451} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--green)" stroke="none">
                  {s}
                </text>
              </g>
            );
          })}
        </motion.g>
      </g>

      {/* 2 — tailor's chalk marks the pattern */}
      <motion.path
        d={OUTLINE}
        stroke="var(--cream)"
        strokeOpacity={0.22}
        strokeWidth={1}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={t(0.5, 1)}
      />

      {/* cloth fills in once sewn */}
      <motion.path
        d={OUTLINE}
        fill="var(--cream)"
        initial={{ fillOpacity: 0 }}
        animate={{ fillOpacity: 0.07 }}
        transition={t(FINISH, 0.8)}
      />

      {/* 3 — the running stitch, revealed behind the needle */}
      <path ref={guide} d={OUTLINE} stroke="none" />
      <path d={OUTLINE} stroke="var(--gold)" strokeWidth={2.5} strokeDasharray="9 6" mask="url(#sew)" />

      {/* 4 — finishing */}
      <motion.path
        d={COLLAR}
        stroke="var(--gold)"
        strokeWidth={2}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={t(FINISH, 0.7)}
      />
      <path d={PLACKET} stroke="var(--gold)" strokeWidth={2} strokeDasharray="5 5" mask="url(#placket)" />
      <motion.path
        d={POCKET}
        stroke="var(--gold)"
        strokeWidth={2}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={t(FINISH + 1.2, 0.7)}
      />
      <motion.path
        d={CUFFS}
        stroke="var(--gold)"
        strokeWidth={2}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={t(FINISH + 1.4, 0.6)}
      />
      {BUTTONS.map((y, i) => (
        <motion.g
          key={y}
          initial={{ scale: reduce ? 1 : 0 }}
          animate={{ scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: FINISH + 1.7 + i * 0.12, type: "spring", stiffness: 500, damping: 16 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <circle cx={200} cy={y} r={7} fill="var(--green)" stroke="var(--gold)" strokeWidth={2} />
          <path d={`M197 ${y - 3} l6 6 M203 ${y - 3} l-6 6`} stroke="var(--gold)" strokeWidth={1.2} />
        </motion.g>
      ))}

      {/* 5 — the label goes in last */}
      <motion.g
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { delay: FINISH + 2.5, duration: 0.5 }}
      >
        <rect x="178" y="70" width="44" height="16" fill="var(--gold)" />
        <text x="200" y="81.5" textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1.2" fill="var(--green)">
          SUXUS
        </text>
      </motion.g>

      {/* the needle and its thread */}
      <g ref={needle} style={{ opacity: 0 }}>
        <path d="M-40 0 C-58 -10 -72 12 -96 2" stroke="var(--gold)" strokeWidth={1.5} />
        <path d="M3 0 L-40 -2.6 L-46 0 L-40 2.6 Z" fill="var(--cream)" />
        <ellipse cx={-38} cy={0} rx={3} ry={1} fill="var(--green)" />
      </g>
    </motion.svg>
  );
}
