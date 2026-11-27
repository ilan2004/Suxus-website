import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/db/features";
import { tvAllowed, tvFeed } from "@/lib/tryon-tv";

export const dynamic = "force-dynamic";

/** For the shop TV: results customers chose to show (staff sign-in or the TV token). */
export async function GET(req: NextRequest) {
  if (!(await tvAllowed(req.nextUrl.searchParams.get("key")))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!(await features()).tryonTv) return NextResponse.json({ ok: true, items: [] });
  return NextResponse.json({ ok: true, items: await tvFeed() }, { headers: { "Cache-Control": "no-store" } });
}
