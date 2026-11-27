import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/db/features";
import { setOnDisplay } from "@/lib/tryon-tv";
import { deviceOf } from "../_device";

export const dynamic = "force-dynamic";

/** "Show on the shop TV" / "Remove from TV" — the customer's own choice, for an image THIS phone made. */
export async function POST(req: NextRequest) {
  if (!(await features()).tryonTv) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device } = await deviceOf();
  const body = (await req.json().catch(() => null)) as { image?: unknown; show?: unknown } | null;
  const resultId = typeof body?.image === "string" ? (body.image.split("/").pop() ?? "") : "";
  if (!/^[A-Za-z0-9_-]{30,40}$/.test(resultId) || typeof body?.show !== "boolean") return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const done = await setOnDisplay(device, resultId, body.show);
  return done ? NextResponse.json({ ok: true, show: body.show }) : NextResponse.json({ ok: false, error: "bad_request" }, { status: 404 });
}
