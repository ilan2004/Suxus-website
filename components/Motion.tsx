"use client";

import { useRef, type ReactNode } from "react";
import { FULL, gsap, REDUCED, useGSAP } from "@/lib/gsap";

/* Site-wide animation helpers (GSAP + ScrollTrigger). Visitors who prefer
   reduced motion get the finished state straight away. */

/* Fades and lifts content in as it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current!;
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 24,
          duration: 0.8,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
        gsap.set(el, { visibility: "visible" });
      });
      mm.add(REDUCED, () => {
        gsap.set(el, { visibility: "visible" });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={`${className ?? ""} reveal`}>
      {children}
    </div>
  );
}

/* A seam that is sewn across the page as you scroll down to it. */
export function Seam() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        const scrollTrigger = { trigger: ref.current, start: "top bottom", end: "top 55%", scrub: 0.4 };
        gsap.fromTo(".seam-thread", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger });
        gsap.fromTo(".seam-needle", { left: "0%" }, { left: "100%", ease: "none", scrollTrigger });
      });
    },
    { scope: ref },
  );
  return (
    <div className="seam" ref={ref} aria-hidden="true">
      <div className="seam-thread" />
      <div className="seam-needle">
        <svg viewBox="0 0 60 12">
          <path d="M60 6 L14 3.4 L8 6 L14 8.6 Z" fill="currentColor" />
          <ellipse cx="16" cy="6" rx="3" ry="1" fill="var(--green)" />
        </svg>
      </div>
    </div>
  );
}
