import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { fabricsWithStock } from "./queries";
import { LOCAL_DIR } from "./storage";

/*
 * AI fabric try-on (public page /tryon). Everything that touches the Gemini key, the customer's photo or the limits
 * runs here, on the server. The key is read from GEMINI_API_KEY and never leaves the server.
 */

/** Gemini image model (Nano Banana 2.1 — Google's current recommended image-editing model). Override with GEMINI_IMAGE_MODEL. */
export const TRYON_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";
/** Paid-tier prices for gemini-nano-banana-2.1 (ai.google.dev pricing page, checked 27 Nov 2026): output image 1K = $0.0336; input $1.50 / 1M tokens. */
const PRICE = { outputImage1k: 0.0336, inputPerMTok: 1.5, inputTokensPerImageEstimate: 1120 };
export const USD_TO_INR = 88;

export const LIMITS = {
  /** successful try-ons per device per day (shown to the customer) */
  perDevice: 2,
  /** attempts (incl. failures) per device per day — stops a broken phone looping on the API */
  attemptsPerDevice: 6,
  /** successful try-ons per network address per day (a shared wifi, or someone clearing cookies) */
  perIp: 20,
};
export const KEEP_DAYS = 7;

/* ───────────────────────── Device and limits ───────────────────────── */

export const DEVICE_COOKIE = "suxus_tryon";
const secret = () => process.env.ERP_SECRET || "suxus-dev-secret-change-me";
const hmac = (s: string) => crypto.createHmac("sha256", secret()).update(s).digest("base64url");

/** The device id from its signed cookie (or a new one). Only an HMAC of it is stored. */
export function deviceFrom(cookie: string | undefined): { cookie: string; device: string; fresh: boolean } {
  if (cookie) {
    const [id, sig] = cookie.split(".");
    if (id && sig && sig === hmac(`d:${id}`).slice(0, 22)) return { cookie, device: hmac(`dev:${id}`), fresh: false };
  }
  const id = crypto.randomBytes(18).toString("base64url");
  return { cookie: `${id}.${hmac(`d:${id}`).slice(0, 22)}`, device: hmac(`dev:${id}`), fresh: true };
}
export const ipHash = (ip: string | null) => (ip ? hmac(`ip:${ip}`) : null);
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

/** Midnight today in India. */
export function todayStartIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000);
}

export async function usage(device: string, ip: string | null) {
  const db = await getDb();
  const since = todayStartIST();
  const [d] = await db
    .select({ ok: sql<number>`count(*) filter (where ${schema.tryonGenerations.ok})`.mapWith(Number), all: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.tryonGenerations)
    .where(and(eq(schema.tryonGenerations.device, device), gte(schema.tryonGenerations.createdAt, since)));
  const [i] = ip
    ? await db
        .select({ ok: sql<number>`count(*) filter (where ${schema.tryonGenerations.ok})`.mapWith(Number) })
        .from(schema.tryonGenerations)
        .where(and(eq(schema.tryonGenerations.ip, ip), gte(schema.tryonGenerations.createdAt, since)))
    : [{ ok: 0 }];
  const left = Math.max(0, LIMITS.perDevice - d.ok);
  const blocked = left === 0 || d.all >= LIMITS.attemptsPerDevice || i.ok >= LIMITS.perIp;
  return { left: blocked ? 0 : left, limit: LIMITS.perDevice };
}

/** Customer photos and generated images older than 7 days are deleted (the log keeps no image). */
export async function cleanupOld() {
  const db = await getDb();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000);
  const gone = await db.delete(schema.tryonImages).where(lt(schema.tryonImages.createdAt, cutoff)).returning({ id: schema.tryonImages.id });
  return gone.length;
}

/* ───────────────────────── Fabrics ───────────────────────── */

export type TryonFabric = {
  id: number;
  code: string;
  name: string;
  colour: string | null;
  colourFamily: string | null;
  pattern: string | null;
  patternMm: number | null;
  hex: string | null;
  rate: number;
  thumb: string;
  photo: string;
};

/** Fabrics a customer can try: active, in stock (balance > 0) and with a photo. Public fields only — no cost, no supplier. */
export async function tryonFabrics(): Promise<TryonFabric[]> {
  const rows = await fabricsWithStock();
  return rows
    .filter((f) => f.active && (f.balanceMtr ?? 0) > 0 && f.photoUrls.length > 0)
    .map((f) => ({
      id: f.id,
      code: f.code,
      name: [f.brand, f.shade].filter(Boolean).join(" · "),
      colour: f.shade || f.colourFamily || null,
      colourFamily: f.colourFamily,
      pattern: f.pattern,
      patternMm: f.patternMm,
      hex: f.dominantHex,
      rate: f.saleRate,
      thumb: f.thumbUrls[0] || f.photoUrls[0],
      photo: f.photoUrls[0],
    }));
}

/** The fabric photo WITHOUT the scale card (photoUrls holds the cropped versions; the originals are photoOriginalUrls). */
async function fabricPhotoBytes(url: string, origin: string): Promise<Buffer> {
  const local = url.match(/^\/api\/uploads\?path=(fabrics\/\d{4}-\d{2}\/[a-f0-9-]+(?:-thumb|-orig)?\.(?:webp|jpg))$/);
  if (local) return fs.readFile(path.join(LOCAL_DIR, local[1]));
  const abs = url.startsWith("http") ? url : new URL(url, origin).toString();
  const r = await fetch(abs, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new TryonError("fabric_photo", `fabric photo ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ───────────────────────── The instruction ───────────────────────── */

/** Named colours for the instruction ("#781E28 — a maroon"). */
const NAMED: [string, string][] = [
  ["white", "#F7F7F5"], ["off-white", "#EDE8DC"], ["cream", "#EFE3C8"], ["beige", "#D8C3A0"], ["khaki", "#B8A47A"], ["sand", "#C9B48E"],
  ["light grey", "#C8C8C8"], ["grey", "#8E8E8E"], ["charcoal grey", "#45474B"], ["black", "#1C1C1C"],
  ["sky blue", "#8EC5E8"], ["light blue", "#B9D7EE"], ["powder blue", "#A9C4DC"], ["blue", "#2F5DAA"], ["royal blue", "#2849A8"], ["navy blue", "#1E2A4A"], ["denim blue", "#3E5F8A"], ["teal", "#1F6F73"], ["turquoise", "#3BB5B0"],
  ["mint green", "#A8DCC0"], ["sea green", "#2E8B6E"], ["green", "#3E8A44"], ["olive green", "#6B6B3A"], ["bottle green", "#1F4B35"],
  ["yellow", "#E9CF4A"], ["mustard", "#C99A2E"], ["orange", "#E07B2E"], ["peach", "#F2B99A"], ["rust", "#A8502A"],
  ["pink", "#E8A3B8"], ["red", "#C0302E"], ["maroon", "#781E28"], ["wine", "#5E1A2E"], ["purple", "#6A3D8F"], ["lavender", "#B9A7D8"],
  ["brown", "#6E4A2E"], ["coffee brown", "#4A3426"], ["tan", "#B07D4F"],
];
function lab(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x > 0.04045 ? ((x + 0.055) / 1.055) ** 2.4 : x / 12.92;
  });
  const X = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
  const Y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const Z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export function colourName(hex: string) {
  const a = lab(hex);
  let best = NAMED[0][0];
  let d = Infinity;
  for (const [name, h] of NAMED) {
    const b = lab(h);
    const e = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (e < d) [d, best] = [e, name];
  }
  return best;
}

/** Width of a shirt front in mm (adult), for "roughly N repeats across the shirt front". */
const SHIRT_FRONT_MM = 500;

/** The instruction, filled in from the fabric's own stored fields (pattern, repeat in mm, dominant colour). */
export function tryonPrompt(f: { pattern: string | null; patternMm: number | null; hex: string | null; colour: string | null }, sleeve: "full" | "half") {
  const lines: string[] = [];
  lines.push(
    `The first image is the customer. The second image is a close-up photo of the shirting fabric.`,
    `Replace only the upper garment with a ${sleeve} sleeve formal shirt made from the fabric in the second image.`,
  );
  if (f.hex) {
    const named = colourName(f.hex);
    const shopName = f.colour && f.colour.toLowerCase() !== named ? ` (the shop calls it "${f.colour}")` : "";
    lines.push(
      `The fabric's dominant colour is ${f.hex.toUpperCase()} - a ${named}${shopName}. That colour must cover most of the shirt's surface and be as deep and saturated as the reference. Do NOT produce a pale, washed-out or white-dominant version.`,
    );
  } else {
    lines.push(`Match the fabric's colour exactly - as deep and saturated as the reference. Do NOT produce a pale, washed-out or white-dominant version.`);
  }
  const p = (f.pattern ?? "").toLowerCase();
  if (p.startsWith("plain")) lines.push(`The fabric is plain (solid) - no checks, stripes or print.`);
  else if ((p === "check" || p === "stripe") && f.patternMm && f.patternMm > 0) {
    const repeats = Math.max(1, Math.round(SHIRT_FRONT_MM / f.patternMm));
    const what = p === "check" ? "check" : "stripe";
    lines.push(
      `The pattern is a ${what} with a repeat of about ${Math.round(f.patternMm * 10) / 10} mm, so there should be roughly ${repeats} repeats across the shirt front. ${
        p === "check" ? "Keep the checks small and dense, not oversized." : "Keep the stripes fine and closely spaced, not oversized."
      }`,
    );
  } else if (f.pattern) lines.push(`The pattern is ${f.pattern.toLowerCase()}. Keep it exactly the scale it is in the reference - small and true to size, not enlarged.`);
  lines.push(
    `Keep the person's face, hair, skin tone, body shape, pose, expression and the background completely unchanged. Do not alter their face shape, weight or age.`,
    `Keep the exact same camera framing and crop. Do not zoom out, do not extend the image, do not show more of the body.`,
    `Natural drape, realistic folds, lighting matching the original photo.`,
  );
  return lines.join("\n");
}

/* ───────────────────────── Generation ───────────────────────── */

export class TryonError extends Error {
  constructor(
    public code: "config" | "timeout" | "busy" | "blocked" | "api" | "fabric_photo" | "bad_photo",
    message: string,
  ) {
    super(message);
  }
}

/** Finds the last image block anywhere in the response (output_image, or steps[].content[]). */
function findImage(o: unknown): { data: string; mime: string } | null {
  let found: { data: string; mime: string } | null = null;
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const r = v as Record<string, unknown>;
    if (r.type === "image" && typeof r.data === "string" && r.data.length > 100) found = { data: r.data, mime: typeof r.mime_type === "string" ? r.mime_type : "image/jpeg" };
    for (const k of Object.keys(r)) if (k !== "data") walk(r[k]);
  };
  walk(o);
  const oi = (o as { output_image?: { data?: string; mime_type?: string } })?.output_image;
  if (oi?.data) found = { data: oi.data, mime: oi.mime_type ?? "image/jpeg" };
  return found;
}

/** Cost from the response's token counts when present; otherwise the list price (1K output image + two input images). */
function costOf(res: unknown) {
  const u = (res as { usage?: Record<string, unknown> })?.usage;
  const num = (k: string) => (u && typeof u[k] === "number" ? (u[k] as number) : null);
  const inTok = num("total_input_tokens") ?? num("input_tokens") ?? num("prompt_token_count");
  const input = ((inTok ?? PRICE.inputTokensPerImageEstimate * 2 + 400) / 1e6) * PRICE.inputPerMTok;
  return Math.round((PRICE.outputImage1k + input) * 10000) / 10000;
}

async function callGemini(prompt: string, person: Buffer, fabric: Buffer) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new TryonError("config", "GEMINI_API_KEY is not set");
  let r: Response;
  try {
    r = await fetch(API, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json", "Api-Revision": API_REVISION },
      body: JSON.stringify({
        model: TRYON_MODEL,
        input: [
          { type: "text", text: prompt },
          { type: "image", mime_type: "image/jpeg", data: person.toString("base64") },
          { type: "image", mime_type: "image/jpeg", data: fabric.toString("base64") },
        ],
        // portrait output
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "3:4", image_size: "1K" },
      }),
      signal: AbortSignal.timeout(100_000),
    });
  } catch (e) {
    const name = (e as Error).name;
    throw new TryonError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "api", (e as Error).message);
  }
  const text = await r.text();
  if (r.status === 429 || r.status === 503) throw new TryonError("busy", `${r.status} ${text.slice(0, 300)}`);
  // a key / billing / permission problem is ours, not the customer's photo
  if (r.status === 401 || r.status === 403 || /api key|API_KEY|billing|PERMISSION_DENIED/i.test(text)) throw new TryonError("config", `${r.status} ${text.slice(0, 300)}`);
  if (!r.ok) throw new TryonError(r.status === 400 ? "blocked" : "api", `${r.status} ${text.slice(0, 300)}`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TryonError("api", "response is not JSON");
  }
  const img = findImage(json);
  // No image back = the model declined (safety) or answered in text only
  if (!img) throw new TryonError("blocked", `no image in response: ${text.slice(0, 300)}`);
  return { image: Buffer.from(img.data, "base64"), cost: costOf(json), usageText: JSON.stringify((json as { usage?: unknown }).usage ?? null).slice(0, 400) };
}

/** Portrait JPEG, "SUXUS Heritage Tailor" discreetly in the bottom-right corner. */
async function watermark(img: Buffer) {
  const { default: sharp } = await import("sharp");
  const base = sharp(img).rotate();
  const meta = await base.metadata();
  const w = meta.width ?? 768;
  const h = meta.height ?? 1024;
  const mark = await sharp(await fs.readFile(path.join(process.cwd(), "assets", "tryon-watermark.png")))
    .resize({ width: Math.round(w * 0.36) })
    .png()
    .toBuffer();
  const mm = await sharp(mark).metadata();
  const pad = Math.round(w * 0.025);
  return base
    .composite([{ input: mark, left: w - (mm.width ?? 0) - pad, top: h - (mm.height ?? 0) - pad }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** The customer's photo: upright, at most 1280 px, JPEG. */
export async function normalisePhoto(buf: Buffer) {
  const { default: sharp } = await import("sharp");
  try {
    return await sharp(buf).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  } catch {
    throw new TryonError("bad_photo", "not a readable image");
  }
}

const newId = () => crypto.randomBytes(24).toString("base64url");

/**
 * One try-on: store the photo, build the instruction from the fabric's data, call the model, watermark, store the
 * result, log it (success or failure, model, cost, time).
 */
export async function generateTryon(o: { device: string; ip: string | null; fabricId: number; sleeve: "full" | "half"; variant: string; photo: Buffer; origin: string }) {
  const db = await getDb();
  const fabric = (await tryonFabrics()).find((f) => f.id === o.fabricId);
  const started = Date.now();
  const photoId = newId();
  await db.insert(schema.tryonImages).values({ id: photoId, device: o.device, kind: "photo", mime: "image/jpeg", data: o.photo });
  const log = (v: { ok: boolean; error?: string; cost?: number; resultId?: string }) =>
    db.insert(schema.tryonGenerations).values({
      device: o.device,
      ip: o.ip,
      fabricId: fabric?.id ?? null,
      garment: "Shirt",
      variant: o.variant,
      ok: v.ok,
      error: v.error ?? null,
      model: TRYON_MODEL,
      costUsd: v.cost ?? 0,
      ms: Date.now() - started,
      photoId,
      resultId: v.resultId ?? null,
    });
  try {
    if (!fabric) throw new TryonError("fabric_photo", "fabric not available");
    const { default: sharp } = await import("sharp");
    const fabricJpeg = await sharp(await fabricPhotoBytes(fabric.photo, o.origin))
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const prompt = tryonPrompt(fabric, o.sleeve);
    const { image, cost, usageText } = await callGemini(prompt, o.photo, fabricJpeg);
    const result = await watermark(image);
    const resultId = newId();
    await db.insert(schema.tryonImages).values({ id: resultId, device: o.device, kind: "result", mime: "image/jpeg", data: result });
    await log({ ok: true, cost, resultId });
    // One line per success for the Vercel logs (cost and time per generation)
    console.log(`[tryon] ok model=${TRYON_MODEL} fabric=${fabric.code} variant=${o.variant} ms=${Date.now() - started} costUsd=${cost} usage=${usageText}`);
    return { resultId, cost, ms: Date.now() - started, prompt };
  } catch (e) {
    const err = e instanceof TryonError ? e : new TryonError("api", (e as Error).message);
    console.error(`[tryon] ${err.code}: ${err.message}`);
    await log({ ok: false, error: `${err.code}: ${err.message}`.slice(0, 500) });
    throw err;
  }
}

/** An image, only for the device that made it. */
export async function imageFor(id: string, device: string) {
  if (!/^[A-Za-z0-9_-]{30,40}$/.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ mime: schema.tryonImages.mime, data: schema.tryonImages.data })
    .from(schema.tryonImages)
    .where(and(eq(schema.tryonImages.id, id), eq(schema.tryonImages.device, device)));
  return row ?? null;
}

/** Recent generations (for tests / Settings later). */
export async function recentGenerations(n = 20) {
  const db = await getDb();
  return db.select().from(schema.tryonGenerations).orderBy(desc(schema.tryonGenerations.id)).limit(n);
}
