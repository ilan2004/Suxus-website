"use client";

import { motion, MotionConfig, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/* Site-wide animation helpers (Motion). Respect the visitor's reduced-motion setting. */

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/* Fades and lifts content in as it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* A seam that is sewn across the page as you scroll down to it. */
export function Seam() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.55"] });
  const left = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  return (
    <div className="seam" ref={ref} aria-hidden="true">
      <motion.div className="seam-thread" style={{ scaleX: scrollYProgress }} />
      <motion.div className="seam-needle" style={{ left }}>
        <svg viewBox="0 0 60 12">
          <path d="M60 6 L14 3.4 L8 6 L14 8.6 Z" fill="currentColor" />
          <ellipse cx="16" cy="6" rx="3" ry="1" fill="var(--green)" />
        </svg>
      </motion.div>
    </div>
  );
}
