import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

/* Rough.js turns clean SVG geometry into hand-drawn strokes, like a tailor's
   chalk or pencil sketch. Seeds come from the shape itself, so the server and
   browser draw exactly the same wobble. */

const gen = rough.generator();

const base: Options = { roughness: 1.1, bowing: 1.2, strokeWidth: 1, stroke: "currentColor" };

function seedOf(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  return h || 1;
}

export type Sketched = { d: string; fill?: boolean };

function paths(drawable: ReturnType<typeof gen.path>): Sketched[] {
  return gen.toPaths(drawable).map((p) => ({ d: p.d, fill: p.fill !== "none" && !!p.fill }));
}

export function sketchPath(d: string, o: Options = {}): Sketched[] {
  return paths(gen.path(d, { ...base, seed: seedOf(d), ...o }));
}

export function sketchCircle(cx: number, cy: number, r: number, o: Options = {}): Sketched[] {
  return paths(gen.circle(cx, cy, r * 2, { ...base, seed: seedOf(`${cx},${cy},${r}`), ...o }));
}
