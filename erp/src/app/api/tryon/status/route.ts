import { NextResponse } from "next/server";
import { features } from "@/lib/db/features";
import { getSetting } from "@/lib/settings";
import { cleanupOld, usage } from "@/lib/tryon";
import { deviceOf, isShopTester } from "../_device";

export const dynamic = "force-dynamic";

/** How many try-ons this phone has left today. */
export async function GET() {
  const feat = await features();
  if (!feat.tryon) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device, ip } = await deviceOf();
  // photos older than 7 days go whenever anyone opens the page (and daily by the cron)
  await cleanupOld().catch(() => {});
  const tester = await isShopTester();
  const u = await usage(device, ip, tester);
  // styling choices shown to customers once switched on in Settings > Try-on; owner / partner always (testing)
  const styles = (feat.tryonStyle && ((await getSetting("tryon")).styles || tester)) as boolean;
  return NextResponse.json({ ok: true, ...u, styles }, { headers: { "Cache-Control": "no-store" } });
}
