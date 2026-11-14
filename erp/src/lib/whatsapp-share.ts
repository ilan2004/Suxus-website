/**
 * Sharing to WhatsApp from the browser.
 * - Text only: opens the customer's chat directly (wa.me/<number>?text=…).
 * - With photos: WhatsApp links cannot carry images, so the phone's share sheet is used
 *   (pick WhatsApp → the customer). The text is also copied, in case WhatsApp drops it.
 */
import { waLink } from "./utils";

export const canSharePhotos = () => typeof navigator !== "undefined" && !!navigator.canShare && !!navigator.share;

async function toFiles(urls: string[], baseName: string) {
  const files: File[] = [];
  for (const [i, u] of urls.entries()) {
    try {
      const res = await fetch(new URL(u, window.location.origin).toString());
      if (!res.ok) continue;
      const blob = await res.blob();
      const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("png") ? "png" : "jpg";
      files.push(new File([blob], `${baseName}-${i + 1}.${ext}`, { type: blob.type || "image/jpeg" }));
    } catch {
      /* skip a photo that cannot be fetched */
    }
  }
  return files;
}

export type ShareResult = "shared" | "cancelled" | "text-only";

export async function shareToWhatsApp(opts: { text: string; phone?: string | null; photos?: string[]; name?: string }): Promise<ShareResult> {
  const photos = (opts.photos ?? []).slice(0, 5);
  if (photos.length && canSharePhotos()) {
    const files = await toFiles(photos, opts.name ?? "suxus");
    if (files.length && navigator.canShare({ files })) {
      try {
        await navigator.clipboard?.writeText(opts.text).catch(() => undefined);
        await navigator.share({ files, text: opts.text });
        return "shared";
      } catch (e) {
        if ((e as Error).name === "AbortError") return "cancelled";
      }
    }
  }
  // Fallback: text (with photo links) straight to the customer's chat
  const links = photos.length ? `\n\nPhoto${photos.length > 1 ? "s" : ""}:\n${photos.map((p) => new URL(p, window.location.origin).toString()).join("\n")}` : "";
  const url = waLink(opts.phone, opts.text + links) ?? `https://wa.me/?text=${encodeURIComponent(opts.text + links)}`;
  window.open(url, "_blank");
  return "text-only";
}
