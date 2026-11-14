/**
 * Free, on-device colour suggestion for fabric photos.
 * Samples the centre of the photo, groups the pixels into a few colour clusters (k-means in CIE-Lab),
 * then names the main cluster (Colour family + a finer shade name) and guesses plain / check / print.
 */
type Lab = [number, number, number];

function srgbToLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const hexLab = (hex: string) => srgbToLab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const dE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Reference colours for the default "Colour family" list (names must match Settings → Dropdown lists). */
const FAMILY: Record<string, string[]> = {
  White: ["#F7F7F5", "#FFFFFF"],
  "Off-White / Cream": ["#F2EBDA", "#EFE6CF", "#F5F0E1"],
  Black: ["#1A1A1A", "#0D0D0F"],
  Grey: ["#8C8C8C", "#B5B5B5", "#5E5E60"],
  "Navy Blue": ["#1F2A44", "#232F5C"],
  "Sky Blue": ["#9CC9EA", "#B7DAF2", "#87BCE4"],
  Blue: ["#2F5FB3", "#3B6FD0", "#2A4F9A"],
  Green: ["#2E7D46", "#4A7A3A", "#1F5E35", "#6B8E3D"],
  "Sea Green": ["#3BA37A", "#2E8B6E", "#5FB79A"],
  Maroon: ["#6E1F2A", "#5A1A22"],
  Red: ["#C62E2E", "#B22222"],
  Pink: ["#F0A6BE", "#E07A9E", "#F5C2D2"],
  Orange: ["#E8812E", "#F09A3E"],
  Yellow: ["#F2D24B", "#E9C84A", "#F5E07A"],
  Brown: ["#6B4A2E", "#7A5536", "#5A3C24"],
  Beige: ["#D8C3A0", "#CDB38C", "#E0CFB0"],
  Purple: ["#6A3D8F", "#8E6BB8", "#B9A3D6"],
};

/** Finer shade names (written into "Shade / Colour" when it is empty). */
const SHADES: [string, string][] = [
  ["White", "#F8F8F6"], ["Off White", "#F1EEE4"], ["Cream", "#EFE5CC"], ["Ivory", "#F4EFDC"],
  ["Beige", "#D8C3A0"], ["Sand", "#C9B48A"], ["Khaki", "#B5A06E"], ["Light Grey", "#C4C4C4"], ["Ash Grey", "#9A9A9A"],
  ["Grey", "#7D7D7D"], ["Charcoal", "#3E3F42"], ["Black", "#151515"], ["Navy Blue", "#1F2A44"], ["Royal Blue", "#2D4FB8"],
  ["Blue", "#3366CC"], ["Sky Blue", "#9CC9EA"], ["Light Sky Blue", "#C3E0F5"], ["Powder Blue", "#B6CCE0"], ["Teal", "#1F7A7A"],
  ["Sea Green", "#3BA37A"], ["Mint Green", "#A8DCC0"], ["Light Green", "#9CCB86"], ["Green", "#2E7D46"], ["Bottle Green", "#1B4D33"],
  ["Olive Green", "#6B7A34"], ["Lemon Yellow", "#F3E36A"], ["Yellow", "#F2D24B"], ["Mustard", "#C99A2E"], ["Orange", "#E8812E"],
  ["Peach", "#F2B99A"], ["Rust", "#A9532E"], ["Red", "#C62E2E"], ["Maroon", "#6E1F2A"], ["Wine", "#5A1F35"], ["Pink", "#E888A8"],
  ["Baby Pink", "#F5C6D3"], ["Lavender", "#B9A3D6"], ["Purple", "#6A3D8F"], ["Brown", "#6B4A2E"], ["Coffee", "#4E3626"],
];

void FAMILY; // kept as documentation of the family reference colours
/** Each fine shade belongs to one Colour family, so the two suggestions always agree. */
const SHADE_FAMILY: Record<string, string> = {
  White: "White", "Off White": "Off-White / Cream", Cream: "Off-White / Cream", Ivory: "Off-White / Cream",
  Beige: "Beige", Sand: "Beige", Khaki: "Beige", "Light Grey": "Grey", "Ash Grey": "Grey", Grey: "Grey", Charcoal: "Grey",
  Black: "Black", "Navy Blue": "Navy Blue", "Royal Blue": "Blue", Blue: "Blue", "Sky Blue": "Sky Blue", "Light Sky Blue": "Sky Blue",
  "Powder Blue": "Sky Blue", Teal: "Sea Green", "Sea Green": "Sea Green", "Mint Green": "Sea Green", "Light Green": "Green",
  Green: "Green", "Bottle Green": "Green", "Olive Green": "Green", "Lemon Yellow": "Yellow", Yellow: "Yellow", Mustard: "Yellow",
  Orange: "Orange", Peach: "Orange", Rust: "Orange", Red: "Red", Maroon: "Maroon", Wine: "Maroon", Pink: "Pink", "Baby Pink": "Pink",
  Lavender: "Purple", Purple: "Purple", Brown: "Brown", Coffee: "Brown",
};
const SHADE_LAB = SHADES.map(([name, hex]) => [name, hexLab(hex)] as const);

export type ColourSuggestion = {
  family: string; // e.g. "Sea Green", or "Check / Stripe" / "Multicolour / Print" for patterned fabric
  baseFamily: string; // family of the main colour
  shade: string; // e.g. "Light Sky Blue" or "Sky Blue check"
  pattern: "Plain" | "Check / Stripe" | "Multicolour / Print";
  hex: string; // main colour, for the little swatch
};

export function detectColour(img: CanvasImageSource & { width: number; height: number }): ColourSuggestion {
  const S = 72;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  // centre 70 % of the photo — usually the cloth, not the table or hand around it
  const side = Math.min(img.width, img.height) * 0.7;
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
  const { data } = ctx.getImageData(0, 0, S, S);
  const px: Lab[] = [];
  const rgb: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    px.push(srgbToLab(data[i], data[i + 1], data[i + 2]));
    rgb.push([data[i], data[i + 1], data[i + 2]]);
  }

  // k-means, k = 4, deterministic start (spread across lightness)
  const K = 4;
  const sorted = [...px].sort((a, b) => a[0] - b[0]);
  let cent: Lab[] = Array.from({ length: K }, (_, k) => [...sorted[Math.floor(((k + 0.5) / K) * sorted.length)]] as Lab);
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 10; it++) {
    assign = px.map((p) => {
      let best = 0, bd = Infinity;
      cent.forEach((q, k) => {
        const d = dE(p, q);
        if (d < bd) (bd = d), (best = k);
      });
      return best;
    });
    cent = cent.map((q, k) => {
      const mine = px.filter((_, i) => assign[i] === k);
      if (!mine.length) return q;
      return [0, 1, 2].map((j) => mine.reduce((s, p) => s + p[j], 0) / mine.length) as Lab;
    });
  }
  const sizes = cent.map((_, k) => assign.filter((a) => a === k).length / px.length);
  // merge clusters that are visually the same colour (shading / folds)
  const order = cent.map((_, k) => k).sort((a, b) => sizes[b] - sizes[a]);
  const groups: { lab: Lab; share: number; members: number[] }[] = [];
  for (const k of order) {
    const g = groups.find((x) => dE(x.lab, cent[k]) < 18);
    if (g) {
      g.share += sizes[k];
      g.members.push(k);
    } else groups.push({ lab: cent[k], share: sizes[k], members: [k] });
  }
  groups.sort((a, b) => b.share - a.share);
  const main = groups[0];
  const others = groups.slice(1).filter((g) => g.share >= 0.14 && dE(g.lab, main.lab) >= 22);
  const pattern: ColourSuggestion["pattern"] = others.length === 0 ? "Plain" : others.length === 1 ? "Check / Stripe" : "Multicolour / Print";

  const nearest = <T extends readonly [string, Lab | readonly Lab[]]>(list: readonly T[], lab: Lab) => {
    let best = list[0][0], bd = Infinity;
    for (const [name, ref] of list) {
      const refs = (Array.isArray(ref[0]) ? ref : [ref]) as Lab[];
      for (const r of refs) {
        const d = dE(lab, r);
        if (d < bd) (bd = d), (best = name);
      }
    }
    return best;
  };
  // Near-neutral colours: decide white / grey / black by lightness (shop lighting shifts these the most)
  const [L, A, Bb] = main.lab;
  const chroma = Math.hypot(A, Bb);
  let shadeName: string;
  if (chroma < 7 && L >= 78) shadeName = "White";
  else if (chroma < 7 && L <= 22) shadeName = "Black";
  else if (chroma < 6) shadeName = L > 62 ? "Light Grey" : L > 40 ? "Grey" : "Charcoal";
  else shadeName = nearest(SHADE_LAB, main.lab);
  const baseFamily = SHADE_FAMILY[shadeName] ?? "Other";

  // average sRGB of the main group, for the swatch
  const idx = rgb.filter((_, i) => main.members.includes(assign[i]));
  const avg = [0, 1, 2].map((j) => Math.round(idx.reduce((s, p) => s + p[j], 0) / Math.max(1, idx.length)));
  const hex = "#" + avg.map((v) => v.toString(16).padStart(2, "0")).join("");

  return {
    family: pattern === "Plain" ? baseFamily : pattern,
    baseFamily,
    shade: pattern === "Plain" ? shadeName : `${shadeName} ${pattern === "Check / Stripe" ? "check" : "print"}`,
    pattern,
    hex,
  };
}
