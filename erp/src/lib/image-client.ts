/**
 * Browser-side photo processing: phone photos (3–5 MB, often HEIC) → WebP ≤ 1600 px (~300 KB) + 300 px square thumbnail.
 * Falls back to JPEG where the browser cannot encode WebP (older Safari).
 */
import { detectColour, type ColourSuggestion } from "./colour-detect";

const MAX_SIDE = 1600;
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

export async function processPhoto(file: File): Promise<{ photo: Blob; thumb: Blob; ext: "webp" | "jpg"; colour: ColourSuggestion | null }> {
  if (!/^image\//.test(file.type) && !isHeic(file)) throw new Error("Please choose a photo (JPG, PNG, HEIC or WebP).");
  const img = await decode(file);
  const w = img.width;
  const h = img.height;
  const webp = canEncodeWebp();
  const type = webp ? "image/webp" : "image/jpeg";

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const big = document.createElement("canvas");
  big.width = Math.round(w * scale);
  big.height = Math.round(h * scale);
  const bctx = big.getContext("2d")!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(img, 0, 0, big.width, big.height);
  let photo = await toBlob(big, type, 0.8);
  for (const q of [0.72, 0.64, 0.56]) {
    if (photo.size <= TARGET_BYTES) break;
    photo = await toBlob(big, type, q);
  }

  const side = Math.min(w, h);
  const t = document.createElement("canvas");
  t.width = t.height = THUMB;
  const tctx = t.getContext("2d")!;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, THUMB, THUMB);
  const thumb = await toBlob(t, type, 0.75);
  let colour: ColourSuggestion | null = null;
  try {
    colour = detectColour(big);
  } catch {
    /* suggestion is optional */
  }
  if ("close" in img) img.close();
  return { photo, thumb, ext: webp ? "webp" : "jpg", colour };
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
