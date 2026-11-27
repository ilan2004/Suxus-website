import { NextResponse } from "next/server";
import { features } from "@/lib/db/features";
import { cleanupOld, usage } from "@/lib/tryon";
import { deviceOf, isShopTester } from "../_device";

export const dynamic = "force-dynamic";

/** How many try-ons this phone has left today. */
export async function GET() {
  if (!(await features()).tryon) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device, ip } = await deviceOf();
  // photos older than 7 days go whenever anyone opens the page (and daily by the cron)
  await cleanupOld().catch(() => {});
  const u = await usage(device, ip, await isShopTester());
  return NextResponse.json({ ok: true, ...u }, { headers: { "Cache-Control": "no-store" } });
}
