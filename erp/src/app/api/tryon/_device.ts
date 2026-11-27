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
