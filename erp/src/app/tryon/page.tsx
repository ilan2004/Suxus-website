import type { Metadata, Viewport } from "next";
import { getSetting } from "@/lib/settings";
import { variantsFor } from "@/lib/variants";
import { TryOnApp } from "./tryon-app";

export const metadata: Metadata = {
  title: { absolute: "Fabric try-on · SUXUS Heritage Tailor" },
  description: "See a shirt in our fabric on yourself",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#153D33", width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

/**
 * Public fabric try-on (no sign-in): a customer scans the QR at the counter, picks a fabric on their own phone, takes a
 * selfie and sees a shirt in that fabric on themselves.
 */
export default async function TryOnPage() {
  const [shop, variants] = await Promise.all([getSetting("shop"), getSetting("variants")]);
  return <TryOnApp phone={shop.phone} variants={variantsFor("Shirt", variants)} />;
}
