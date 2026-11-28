import "server-only";
import QRCode from "qrcode";

/** The address on every printed try-on QR code. */
export const TRYON_URL = "https://suxus-erp.vercel.app/tryon";

/** The address in the shop's QR codes (poster, label, shop TV): with the shop key once the website lock is on. */
export async function shopTryonUrl() {
  const { getSetting } = await import("./settings");
  const c = await getSetting("tryon");
  return c.webLock && c.shopKey ? `${TRYON_URL}?s=${c.shopKey}` : TRYON_URL;
}

/** The shop QR code as an SVG string (crisp at any print size). */
export async function tryonQrSvg() {
  return QRCode.toString(await shopTryonUrl(), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

export const TRYON_HEAD = { ml: "തുണി ഓർഡർ ചെയ്യും മുമ്പ് ഒന്ന് ട്രൈ ചെയ്യൂ", en: "Try your fabric before you order" };
