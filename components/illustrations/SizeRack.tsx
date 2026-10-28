"use client";

import { motion, useReducedMotion } from "motion/react";

/* The size-fixing camp as a picture: sample shirts from size 20 to 46 drop
   onto a rail and swing to rest, smallest to largest. */

const SIZES = [20, 24, 28, 32, 36, 40, 46];
const SHIRT =
  "M-16 0 C-10 6 10 6 16 0 L28 5 L40 18 L32 28 L26 22 L26 70 L-26 70 L-26 22 L-32 28 L-40 18 L-28 5 Z";

export function SizeRack() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      className="size-rack"
      viewBox="0 0 720 220"
      role="img"
      aria-label="Sample shirts on a rail in sizes 20 to 46"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <motion.path
        d="M20 30 H700"
        strokeWidth={2.5}
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: reduce ? 0 : 0.8 } } }}
      />
      {SIZES.map((size, i) => {
        const x = 70 + i * 96;
        const s = 0.72 + (i / (SIZES.length - 1)) * 0.5;
        return (
          <motion.g
            key={size}
            style={{ transformBox: "view-box", transformOrigin: `${x}px 30px` }}
            variants={{
              hidden: { opacity: 0, y: -40, rotate: -14 },
              show: {
                opacity: 1,
                y: 0,
                rotate: 0,
                transition: reduce
                  ? { duration: 0 }
                  : {
                      delay: 0.6 + i * 0.14,
                      y: { type: "spring", stiffness: 300, damping: 20 },
                      rotate: { type: "spring", stiffness: 120, damping: 5 },
                      opacity: { duration: 0.2 },
                    },
              },
            }}
          >
            <path d={`M${x} 30 c0 -10 10 -10 10 -16 c0 -6 -8 -7 -11 -3`} transform={`translate(-5 0)`} strokeWidth={1.5} />
            <g transform={`translate(${x} 44) scale(${s})`}>
              <path d="M-36 0 L0 -14 L36 0" strokeWidth={1.8 / s} />
              <path d={SHIRT} transform="translate(0 4)" fill="var(--paper)" strokeWidth={1.8 / s} />
              <path d="M0 10 V74" strokeDasharray="3 4" strokeWidth={1.4 / s} />
            </g>
            <g transform={`translate(${x} ${44 + 80 * s + 22})`}>
              <rect x={-17} y={-13} width={34} height={22} fill="var(--gold)" stroke="none" />
              <text y={3} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--green)" stroke="none">
                {size}
              </text>
            </g>
          </motion.g>
        );
      })}
    </motion.svg>
  );
}
