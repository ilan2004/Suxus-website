/**
 * Fabric photo analysis — runs on the phone, no camera distance or scale assumed.
 *
 *  1. Scale card: the black 50 × 30 mm rectangle of a SUXUS scale card. Found as a dark, neutral, solid
 *     region shaped 5 : 3 (any rotation). Its long edge = 50 mm  →  millimetres per pixel.
 *  2. Crop: the largest part of the photo that leaves the whole card (label + margin) out.
 *  3. Pattern repeat: autocorrelation of the cloth area's brightness across and down; the strongest
 *     fundamental period, converted to mm with the card's scale (no card → no mm, never guessed).
 *  4. Colours: the three most common colours of the cloth area (k-means in CIE-Lab), away from the card.
 *
 * Pure functions on RGBA pixel data, so they can be tested without a browser.
 */

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
export type Rect = { x: number; y: number; w: number; h: number };

export type CardResult = {
  /** Long and short edge of the black rectangle, in pixels of the analysed image. */
  longPx: number;
  shortPx: number;
  angleDeg: number;
  cx: number;
  cy: number;
  /** Axis-aligned area to keep out of customer images (card label + margin). */
  exclude: Rect;
};

export type PatternResult = {
  periodPx: number;
  axis: "across" | "down" | "both";
  /** How many complete repeats fit across the measured direction of the cloth area. */
  repeatCount: number;
  /** 0–1: how clearly the cloth repeats (autocorrelation peak). */
  strength: number;
  /** Only with a scale card. */
  mm: number | null;
};

export type ColourResult = { hex: string; share: number };

export type FabricAnalysis = {
  width: number;
  height: number;
  card: CardResult | null;
  mmPerPx: number | null;
  /** Region to keep (whole image when no card). */
  crop: Rect;
  pattern: PatternResult | null;
  colours: ColourResult[];
};

const CARD_LONG_MM = 50;
const CARD_SHORT_MM = 30;
const CARD_ASPECT = CARD_LONG_MM / CARD_SHORT_MM; // 1.667
/** Kept out around the black rectangle: the label it is printed on (60 × 40 mm) plus a stiff backing card. */
const CARD_MARGIN_MM = 15;

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* ───────────── 1. Scale card ───────────── */

export function findScaleCard(px: Pixels): CardResult | null {
  const { width: W, height: H, data } = px;
  const N = W * H;
  // Dark and neutral (black ink, not navy or bottle-green cloth); threshold adapts a little to exposure
  const mask = new Uint8Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (lum(r, g, b) < 70 && mx - mn < 45) mask[i] = 1;
  }
  const label = new Int32Array(N);
  const stack = new Int32Array(N);
  let best: (CardResult & { score: number }) | null = null;
  let next = 0;
  for (let start = 0; start < N; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let sp = 0;
    stack[sp++] = start;
    label[start] = next;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, touches = false;
    while (sp) {
      const i = stack[--sp];
      const x = i % W, y = (i / W) | 0;
      n++;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touches = true;
      if (x > 0 && mask[i - 1] && !label[i - 1]) (label[i - 1] = next), (stack[sp++] = i - 1);
      if (x < W - 1 && mask[i + 1] && !label[i + 1]) (label[i + 1] = next), (stack[sp++] = i + 1);
      if (y > 0 && mask[i - W] && !label[i - W]) (label[i - W] = next), (stack[sp++] = i - W);
      if (y < H - 1 && mask[i + W] && !label[i + W]) (label[i + W] = next), (stack[sp++] = i + W);
    }
    // Size: at least ~0.15% of the photo (card far away), at most a quarter (not a dark cloth)
    if (touches || n < N * 0.0015 || n > N * 0.25) continue;
    const mx = sx / n, my = sy / n;
    const vx = sxx / n - mx * mx, vy = syy / n - my * my, cxy = sxy / n - mx * my;
    const tr = vx + vy, det = vx * vy - cxy * cxy;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    if (l2 <= 0) continue;
    // A filled rectangle of side L has variance L²/12 along that side
    const longPx = Math.sqrt(12 * l1), shortPx = Math.sqrt(12 * l2);
    const aspect = longPx / shortPx;
    const fill = n / (longPx * shortPx);
    if (aspect < 1.4 || aspect > 1.95 || fill < 0.82 || fill > 1.12) continue;
    const score = n * (1 - Math.abs(aspect - CARD_ASPECT) / CARD_ASPECT) * (1 - Math.abs(1 - fill));
    if (best && score <= best.score) continue;
    const angle = 0.5 * Math.atan2(2 * cxy, vx - vy);
    // Keep-out area: the rotated label + margin, as an axis-aligned box
    const mmPerPx = CARD_LONG_MM / longPx;
    const m = CARD_MARGIN_MM / mmPerPx;
    const hl = longPx / 2 + m, hs = shortPx / 2 + m;
    const c = Math.cos(angle), s = Math.sin(angle);
    const ex = Math.abs(hl * c) + Math.abs(hs * s), ey = Math.abs(hl * s) + Math.abs(hs * c);
    const exclude = clampRect({ x: mx - ex, y: my - ey, w: 2 * ex, h: 2 * ey }, W, H);
    void x0; void x1; void y0; void y1;
    best = { longPx, shortPx, angleDeg: (angle * 180) / Math.PI, cx: mx, cy: my, exclude, score };
  }
  if (!best) return null;
  const { score: _score, ...card } = best;
  void _score;
  return card;
}

function clampRect(r: Rect, W: number, H: number): Rect {
  const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
  const x2 = Math.min(W, Math.ceil(r.x + r.w)), y2 = Math.min(H, Math.ceil(r.y + r.h));
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/* ───────────── 2. Crop the card out ───────────── */

/** The largest of the four full-width / full-height strips that do not touch the keep-out area. */
export function cropAround(W: number, H: number, ex: Rect): Rect {
  const options: Rect[] = [
    { x: 0, y: 0, w: ex.x, h: H }, // left of the card
    { x: ex.x + ex.w, y: 0, w: W - (ex.x + ex.w), h: H }, // right
    { x: 0, y: 0, w: W, h: ex.y }, // above
    { x: 0, y: ex.y + ex.h, w: W, h: H - (ex.y + ex.h) }, // below
  ];
  return options.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
}

/* ───────────── 3. Pattern repeat ───────────── */

function grey(px: Pixels, r: Rect, maxSide = 512) {
  const s = Math.min(1, maxSide / Math.max(r.w, r.h));
  const w = Math.max(1, Math.round(r.w * s)), h = Math.max(1, Math.round(r.h * s));
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(px.height - 1, Math.floor(r.y + (y + 0.5) / s));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(px.width - 1, Math.floor(r.x + (x + 0.5) / s));
      const p = (sy * px.width + sx) * 4;
      g[y * w + x] = lum(px.data[p], px.data[p + 1], px.data[p + 2]);
    }
  }
  return { g, w, h, s };
}

/** Normalised autocorrelation of a profile; returns the fundamental period and its peak value. */
function period(profile: Float32Array, minLag: number) {
  const n = profile.length;
  let mean = 0;
  for (const v of profile) mean += v;
  mean /= n;
  const d = profile.map((v) => v - mean);
  let var0 = 0;
  for (const v of d) var0 += v * v;
  if (var0 < 1e-6 * n) return null;
  const maxLag = Math.floor(n / 2);
  const r = new Float32Array(maxLag + 2);
  for (let k = 0; k <= maxLag + 1 && k < n; k++) {
    let acc = 0;
    for (let i = 0; i + k < n; i++) acc += d[i] * d[i + k];
    r[k] = (acc / var0) * (n / (n - k)); // unbiased
  }
  const peaks: { k: number; v: number }[] = [];
  for (let k = Math.max(2, minLag); k <= maxLag; k++) if (r[k] > r[k - 1] && r[k] >= r[k + 1] && r[k] > 0.25) peaks.push({ k, v: r[k] });
  if (!peaks.length) return null;
  const top = Math.max(...peaks.map((p) => p.v));
  // Fundamental = the first peak nearly as strong as the strongest (later peaks are its multiples)
  const f = peaks.find((p) => p.v >= 0.8 * top)!;
  // Parabolic refinement for sub-pixel period
  const a = r[f.k - 1], b = r[f.k], c = r[f.k + 1];
  const den = a - 2 * b + c;
  const off = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return { lag: f.k + Math.max(-0.5, Math.min(0.5, off)), strength: Math.min(1, f.v) };
}

export function findRepeat(px: Pixels, region: Rect, mmPerPx: number | null): PatternResult | null {
  if (region.w < 32 || region.h < 32) return null;
  const { g, w, h, s } = grey(px, region);
  const across = new Float32Array(w), down = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) (across[x] += g[y * w + x]), (down[y] += g[y * w + x]);
  // Ignore lags shorter than ~1.5 mm (weave texture) when the scale is known
  const minLag = mmPerPx ? Math.max(2, Math.ceil(1.5 / (mmPerPx / s))) : 3;
  const pa = period(across, minLag), pd = period(down, minLag);
  if (!pa && !pd) return null;
  let periodLocal: number, axis: PatternResult["axis"], strength: number, length: number;
  if (pa && pd && Math.abs(pa.lag - pd.lag) / Math.max(pa.lag, pd.lag) < 0.15) {
    periodLocal = (pa.lag + pd.lag) / 2;
    axis = "both";
    strength = Math.min(pa.strength, pd.strength);
    length = (w + h) / 2;
  } else if (pa && (!pd || pa.strength >= pd.strength)) {
    periodLocal = pa.lag; axis = "across"; strength = pa.strength; length = w;
  } else {
    periodLocal = pd!.lag; axis = "down"; strength = pd!.strength; length = h;
  }
  const periodPx = periodLocal / s; // back in analysed-image pixels
  const mm = mmPerPx ? Math.round(periodPx * mmPerPx * 2) / 2 : null;
  return { periodPx: Math.round(periodPx * 100) / 100, axis, repeatCount: Math.round((length / periodLocal) * 10) / 10, strength: Math.round(strength * 100) / 100, mm };
}

/* ───────────── 4. Colours ───────────── */

type Lab = [number, number, number];
function toLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();

export function topColours(px: Pixels, region: Rect, k = 6): ColourResult[] {
  // Sample on a grid (~6000 points), leaving a 4% border so edges/shadows count less
  const pts: { lab: Lab; rgb: [number, number, number] }[] = [];
  const bx = region.w * 0.04, by = region.h * 0.04;
  const step = Math.max(1, Math.sqrt(((region.w - 2 * bx) * (region.h - 2 * by)) / 6000));
  for (let y = region.y + by; y < region.y + region.h - by; y += step)
    for (let x = region.x + bx; x < region.x + region.w - bx; x += step) {
      const p = (Math.floor(y) * px.width + Math.floor(x)) * 4;
      const rgb: [number, number, number] = [px.data[p], px.data[p + 1], px.data[p + 2]];
      pts.push({ lab: toLab(...rgb), rgb });
    }
  if (!pts.length) return [];
  // k-means (deterministic seeding spread through the sorted lightness range)
  const sorted = [...pts].sort((a, b) => a.lab[0] - b.lab[0]);
  let cents = Array.from({ length: Math.min(k, pts.length) }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)].lab);
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const d = (pts[i].lab[0] - cents[c][0]) ** 2 + (pts[i].lab[1] - cents[c][1]) ** 2 + (pts[i].lab[2] - cents[c][2]) ** 2;
        if (d < bd) (bd = d), (bi = c);
      }
      assign[i] = bi;
    }
    cents = cents.map((old, c) => {
      let n = 0;
      const s: Lab = [0, 0, 0];
      for (let i = 0; i < pts.length; i++) if (assign[i] === c) (n++, (s[0] += pts[i].lab[0]), (s[1] += pts[i].lab[1]), (s[2] += pts[i].lab[2]));
      return n ? ([s[0] / n, s[1] / n, s[2] / n] as Lab) : old;
    });
  }
  // Cluster colour = median RGB of its members (robust to stray pixels); merge near-identical clusters
  let clusters = cents
    .map((lab, c) => {
      const mem = pts.filter((_, i) => assign[i] === c);
      const med = (j: 0 | 1 | 2) => {
        const v = mem.map((m) => m.rgb[j]).sort((a, b) => a - b);
        return v[Math.floor(v.length / 2)] ?? 0;
      };
      return { lab, n: mem.length, rgb: [med(0), med(1), med(2)] as [number, number, number] };
    })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const merged: typeof clusters = [];
  for (const c of clusters) {
    const near = merged.find((m) => Math.hypot(m.lab[0] - c.lab[0], m.lab[1] - c.lab[1], m.lab[2] - c.lab[2]) < 10);
    if (near) near.n += c.n;
    else merged.push({ ...c });
  }
  clusters = merged.sort((a, b) => b.n - a.n);
  return clusters.slice(0, 3).map((c) => ({ hex: toHex(...c.rgb), share: Math.round((c.n / pts.length) * 100) / 100 }));
}

/* ───────────── All together ───────────── */

export function analyseFabric(px: Pixels): FabricAnalysis {
  const card = findScaleCard(px);
  const mmPerPx = card ? CARD_LONG_MM / card.longPx : null;
  const crop = card ? cropAround(px.width, px.height, card.exclude) : { x: 0, y: 0, w: px.width, h: px.height };
  return {
    width: px.width,
    height: px.height,
    card,
    mmPerPx: mmPerPx ? Math.round(mmPerPx * 10000) / 10000 : null,
    crop,
    pattern: findRepeat(px, crop, mmPerPx),
    colours: topColours(px, crop),
  };
}

export const CARD_SIZE_MM = { long: CARD_LONG_MM, short: CARD_SHORT_MM };
