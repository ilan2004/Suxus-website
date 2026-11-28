import "server-only";
import { cookies, headers } from "next/headers";
import { DEVICE_COOKIE, cookieOptions, deviceFrom, ipHash } from "@/lib/tryon";

/** The device (signed cookie, set when new) and the hashed network address of a try-on request. */
export async function deviceOf() {
  const jar = await cookies();
  const d = deviceFrom(jar.get(DEVICE_COOKIE)?.value);
  if (d.fresh) jar.set(DEVICE_COOKIE, d.cookie, cookieOptions);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip");
  return { device: d.device, ip: ipHash(ip || null) };
}

/** Signed in to the ERP as Owner or Partner: shop testing, so the customers' daily limit does not apply (still logged). */
export async function isShopTester() {
  try {
    const { getSession } = await import("@/lib/auth");
    const s = await getSession();
    return s?.role === "owner" || s?.role === "partner";
  } catch {
    return false;
  }
}

/**
 * Website lock: is this phone in the shop? It is when it opened the shop QR (?s=<key>) in the last 12 hours.
 * Pass the ?s= value seen on the page to mark it now (the cookie is set here).
 */
export async function shopVisit(given?: string | null) {
  const { getSetting } = await import("@/lib/settings");
  const { SHOP_COOKIE, isShopCookie, keyMatches, shopCookieFor } = await import("@/lib/tryon-web");
  const { shopKey } = await getSetting("tryon");
  const jar = await cookies();
  if (keyMatches(given, shopKey)) {
    const c = shopCookieFor(shopKey);
    jar.set(SHOP_COOKIE, c.value, { ...cookieOptions, maxAge: c.maxAge });
    return true;
  }
  return isShopCookie(jar.get(SHOP_COOKIE)?.value, shopKey);
}
