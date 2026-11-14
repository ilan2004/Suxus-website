import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Photo storage.
 * - Production: Supabase Storage (public bucket "fabric-photos"). Needs SUPABASE_SERVICE_ROLE_KEY;
 *   the project URL is taken from SUPABASE_URL or worked out from DATABASE_URL (user postgres.<ref>).
 * - Local development (no key): files in ./.data/uploads, served by /api/uploads.
 * Browsers upload straight to storage with a short-lived signed URL, so big files never pass through Vercel.
 */
export const BUCKET = "fabric-photos";

export function supabaseUrl() {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/+$/, "");
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    const ref = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
    return ref ? `https://${ref}.supabase.co` : null;
  } catch {
    return null;
  }
}

export type StorageMode = "supabase" | "local" | "off";
export function storageMode(): StorageMode {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl()) return "supabase";
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") return "local";
  return "off";
}

const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
/** New-style secret keys (sb_secret_…) go only in the apikey header; legacy service_role JWTs also as Bearer. */
const headers = (): Record<string, string> => (key().startsWith("sb_secret_") ? { apikey: key() } : { Authorization: `Bearer ${key()}`, apikey: key() });
export const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const res = await fetch(`${supabaseUrl()}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 3 * 1024 * 1024, allowed_mime_types: ["image/webp", "image/jpeg"] }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already exists|Duplicate/i.test(text)) throw new Error(`Storage bucket: ${res.status} ${text.slice(0, 200)}`);
  }
  bucketReady = true;
}

export function publicBase() {
  const mode = storageMode();
  if (mode === "supabase") return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/`;
  if (mode === "local") return `/api/uploads?path=`;
  return null;
}

/** True when the URL points into our own photo storage (so clients cannot save arbitrary links). */
export function isOurPhotoUrl(url: string) {
  const base = publicBase();
  return !!base && url.startsWith(base) && /^[a-z0-9/_.-]+$/i.test(url.slice(base.length));
}

export type UploadTarget = { uploadUrl: string; publicUrl: string; contentType: string };

/** Signed upload URLs for one photo + its thumbnail. */
export async function createUploadTargets(ext: "webp" | "jpg"): Promise<{ photo: UploadTarget; thumb: UploadTarget }> {
  const mode = storageMode();
  if (mode === "off") throw new Error("Photo storage is not set up (SUPABASE_SERVICE_ROLE_KEY missing).");
  const month = new Date().toISOString().slice(0, 7);
  const id = crypto.randomUUID();
  const contentType = ext === "webp" ? "image/webp" : "image/jpeg";
  const paths = { photo: `fabrics/${month}/${id}.${ext}`, thumb: `fabrics/${month}/${id}-thumb.${ext}` };

  if (mode === "local") {
    const sign = (p: string) => crypto.createHmac("sha256", process.env.ERP_SECRET || "suxus-dev-secret-change-me").update(p).digest("hex").slice(0, 24);
    const t = (p: string) => ({ uploadUrl: `/api/uploads?path=${p}&sig=${sign(p)}`, publicUrl: `/api/uploads?path=${p}`, contentType });
    return { photo: t(paths.photo), thumb: t(paths.thumb) };
  }

  await ensureBucket();
  const sign = async (p: string): Promise<UploadTarget> => {
    const res = await fetch(`${supabaseUrl()}/storage/v1/object/upload/sign/${BUCKET}/${p}`, { method: "POST", headers: headers() });
    if (!res.ok) throw new Error(`Storage sign: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const { url } = (await res.json()) as { url: string };
    return { uploadUrl: `${supabaseUrl()}/storage/v1${url}`, publicUrl: `${publicBase()}${p}`, contentType };
  };
  return { photo: await sign(paths.photo), thumb: await sign(paths.thumb) };
}

/** Deletes stored files by their public URLs (ignores anything that isn't ours). */
export async function deletePhotos(urls: string[]) {
  const base = publicBase();
  if (!base) return;
  const paths = urls.filter(isOurPhotoUrl).map((u) => u.slice(base.length));
  if (!paths.length) return;
  if (storageMode() === "local") {
    await Promise.all(paths.map((p) => fs.rm(path.join(LOCAL_DIR, p), { force: true })));
    return;
  }
  await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => undefined);
}

export function verifyLocalSig(p: string, sig: string | null) {
  const expected = crypto.createHmac("sha256", process.env.ERP_SECRET || "suxus-dev-secret-change-me").update(p).digest("hex").slice(0, 24);
  return !!sig && sig === expected;
}
