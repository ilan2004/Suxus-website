import { NextResponse } from "next/server";
import { features } from "@/lib/db/features";
import { getSetting } from "@/lib/settings";
import { cleanupOld, usage } from "@/lib/tryon";
import { cleanCode } from "@/lib/tryon-web";
import { deviceOf, isShopTester, shopVisit } from "../_device";

export const dynamic = "force-dynamic";

/** The shop's WhatsApp number for the website-limit screen: the first number in Settings > Shop > Phone. */
function shopWhatsApp(phone: string) {
  const d = (phone.split(/[|,/]/)[0] ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d.length === 12 && d.startsWith("91") ? d : null;
}

/** How many try-ons this phone has left today. ?s= = the shop QR key (marks the phone as in the shop); ?code= = a WhatsApp code. */
export async function GET(req: Request) {
  const feat = await features();
  if (!feat.tryon) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device, ip } = await deviceOf();
  // photos older than 7 days go whenever anyone opens the page (and daily by the cron)
  await cleanupOld().catch(() => {});
  const tester = await isShopTester();
  const q = new URL(req.url).searchParams;
  const shop = await shopVisit(q.get("s"));
  const u = await usage(device, ip, tester, { shop, code: cleanCode(q.get("code")) });
  // styling choices shown to customers once switched on in Settings > Try-on; owner / partner always (testing)
  const styles = (feat.tryonStyle && ((await getSetting("tryon")).styles || tester)) as boolean;
  const whatsapp = u.via !== "shop" || u.blocked?.startsWith("web") ? shopWhatsApp((await getSetting("shop")).phone) : null;
  return NextResponse.json({ ok: true, ...u, styles, whatsapp }, { headers: { "Cache-Control": "no-store" } });
}
