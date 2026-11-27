import { NextResponse } from "next/server";
import { tryonFabrics } from "@/lib/tryon";

export const dynamic = "force-dynamic";

/** Fabrics a customer can try (in stock, with a photo). Public fields only. */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, fabrics: await tryonFabrics() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[tryon] fabrics", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
