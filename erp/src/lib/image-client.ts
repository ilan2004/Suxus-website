/**
 * Browser-side photo processing: phone / gallery / DSLR photos (often 3–20 MB, HEIC) → WebP ≤ 1500 px + 300 px thumbnail.
 * Each photo is analysed for a SUXUS scale card: if found, the customer-facing photo has the card cropped out and the
 * original (with the card) is kept separately for measurement only.
 * Falls back to JPEG where the browser cannot encode WebP (older Safari).
 */
import { detectColour, type ColourSuggestion } from "./colour-detect";
import { analyseFabric, type FabricAnalysis } from "./fabric-analysis";

const MAX_SIDE = 1500;
const THUMB = 300;
const TARGET_BYTES = 300 * 1024;

let webpOk: boolean | null = null;
function canEncodeWebp() {
  if (webpOk == null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOk;
}

const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    /* try other ways below */
  }
  if (isHeic(file)) {
    // Browsers other than Safari cannot read HEIC — convert it first (library loaded only when needed).
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(out) ? out[0] : out;
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This photo format cannot be read. Please use JPG, PNG, HEIC or WebP."));
    img.src = URL.createObjectURL(file);
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the photo"))), type, quality));
}

async function encode(canvas: HTMLCanvasElement, type: string) {
  let out = await toBlob(canvas, type, 0.8);
  for (const q of [0.72, 0.64, 0.56]) {
    if (out.size <= TARGET_BYTES) break;
    out = await toBlob(canvas, type, q);
  }
  return out;
}

export type ProcessedPhoto = {
  /** Customer-facing photo: the scale card cropped out. */
  photo: Blob;
  thumb: Blob;
  /** Original WITH the card (only when a card was found) — measurement only, never shown. */
  original: Blob | null;
  ext: "webp" | "jpg";
  colour: ColourSuggestion | null;
  analysis: FabricAnalysis | null;
};

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (!/^image\//.test(file.type) && !isHeic(file)) throw new Error("Please choose a photo (JPG, PNG, HEIC or WebP).");
  const img = await decode(file);
  const w = img.width;
  const h = img.height;
  const webp = canEncodeWebp();
  const type = webp ? "image/webp" : "image/jpeg";

  // Whole photo at ≤ 1500 px (longest side, aspect kept) — analysed at this size
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const big = document.createElement("canvas");
  big.width = Math.round(w * scale);
  big.height = Math.round(h * scale);
  const bctx = big.getContext("2d", { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(img, 0, 0, big.width, big.height);
  if ("close" in img) img.close();

  let analysis: FabricAnalysis | null = null;
  try {
    analysis = analyseFabric(bctx.getImageData(0, 0, big.width, big.height));
  } catch (e) {
    console.warn("fabric analysis failed", e);
  }

  // Customer-facing version: the card cropped out (whole photo when there is no card)
  let shown = big;
  if (analysis?.card) {
    const c = analysis.crop;
    const cut = document.createElement("canvas");
    // same pixels as the ≤ 1500 px photo, never enlarged
    cut.width = c.w;
    cut.height = c.h;
    const cctx = cut.getContext("2d")!;
    cctx.imageSmoothingQuality = "high";
    cctx.drawImage(big, c.x, c.y, c.w, c.h, 0, 0, cut.width, cut.height);
    shown = cut;
  }
  const photo = await encode(shown, type);
  const original = analysis?.card ? await encode(big, type) : null;

  const side = Math.min(shown.width, shown.height);
  const t = document.createElement("canvas");
  t.width = t.height = THUMB;
  const tctx = t.getContext("2d")!;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(shown, (shown.width - side) / 2, (shown.height - side) / 2, side, side, 0, 0, THUMB, THUMB);
  const thumb = await toBlob(t, type, 0.75);
  let colour: ColourSuggestion | null = null;
  try {
    colour = detectColour(shown);
  } catch {
    /* suggestion is optional */
  }
  return { photo, thumb, original, ext: webp ? "webp" : "jpg", colour, analysis };
}

/** PUT with upload progress (fetch has no upload progress). */
export function putWithProgress(url: string, blob: Blob, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("No connection — check the internet and tap Retry"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — tap Retry"));
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}
