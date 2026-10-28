"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin);

export const REDUCED = "(prefers-reduced-motion: reduce)";
export const FULL = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, useGSAP };
