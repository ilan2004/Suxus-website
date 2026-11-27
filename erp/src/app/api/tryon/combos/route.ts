import { NextResponse } from "next/server";
import { features } from "@/lib/db/features";
import { getSetting } from "@/lib/settings";
import { combosFor } from "@/lib/combo-server";
import { isShopTester } from "../_device";

export const dynamic = "force-dynamic";

/**
 * Trouser fabrics from our stock that go with a shirt fabric (?fabricId=12&sleeve=full|half). Pure colour rules on
 * stored data: no AI call, no cost, no [tryon] log line, and it works with the try-on key switched off. Shown to
 * customers once switched on in Settings → Combinations; owner / partner always (testing).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fabricId = Number(url.searchParams.get("fabricId"));
    const sleeve = url.searchParams.get("sleeve") === "half" ? "half" : "full";
    if (!Number.isInteger(fabricId) || fabricId <= 0) return NextResponse.json({ ok: false, error: "fabric" }, { status: 400 });
    const feat = await features();
    const on = feat.combo && ((await getSetting("combo")).enabled || (await isShopTester()));
    if (!on) return NextResponse.json({ ok: true, on: false }, { headers: { "Cache-Control": "no-store" } });
    const r = await combosFor(fabricId, sleeve);
    if (!r) return NextResponse.json({ ok: false, error: "fabric" }, { status: 404 });
    return NextResponse.json({ ok: true, on: true, ...r }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[combo]", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
