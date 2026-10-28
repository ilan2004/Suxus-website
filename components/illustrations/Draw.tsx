"use client";

import { motion, type SVGMotionProps, type Variants } from "motion/react";
import { useId, type ReactNode } from "react";

/* Primitives for the SUXUS line-illustration set.
   <Illo> draws its children in, one stroke after another, when it scrolls into
   view. Give each <P>/<C> an `i` to set its place in the drawing order. */

export const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: i * 0.18, duration: 0.8, ease: "easeInOut" },
      opacity: { delay: i * 0.18, duration: 0.01 },
    },
  }),
};

export const pop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  show: (i: number = 0) => ({
    scale: 1,
    opacity: 1,
    transition: { delay: i * 0.18, type: "spring", stiffness: 420, damping: 18 },
  }),
};

type IlloProps = {
  label: string;
  children: ReactNode;
  className?: string;
  viewBox?: string;
};

export function Illo({ label, children, className = "illo", viewBox = "0 0 120 120" }: IlloProps) {
  return (
    <motion.svg
      className={className}
      viewBox={viewBox}
      role="img"
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
    >
      {children}
    </motion.svg>
  );
}

type PathProps = SVGMotionProps<SVGPathElement> & { i?: number };

export function P({ i = 0, ...rest }: PathProps) {
  return <motion.path variants={draw} custom={i} {...rest} />;
}

export function C({ i = 0, ...rest }: SVGMotionProps<SVGCircleElement> & { i?: number }) {
  return <motion.circle variants={draw} custom={i} {...rest} />;
}

export function Dot({ i = 0, ...rest }: SVGMotionProps<SVGCircleElement> & { i?: number }) {
  return (
    <motion.circle
      variants={pop}
      custom={i}
      fill="currentColor"
      stroke="none"
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      {...rest}
    />
  );
}

/* A running stitch: dashed thread revealed along its path, as if sewn. */
export function Stitch({ d, i = 0, dash = "5 4" }: { d: string; i?: number; dash?: string }) {
  const id = "st" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <motion.path d={d} variants={draw} custom={i} stroke="#fff" strokeWidth={8} />
      </mask>
      <path d={d} strokeDasharray={dash} mask={`url(#${id})`} />
    </>
  );
}
