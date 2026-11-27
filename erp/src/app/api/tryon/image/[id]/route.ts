import { NextResponse, type NextRequest } from "next/server";
import { imageFor } from "@/lib/tryon";
import { deviceOf } from "../../_device";

export const dynamic = "force-dynamic";

/** A try-on image — only for the phone that made it (one customer never sees another's photo). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { device } = await deviceOf();
  const img = await imageFor((await params).id, device);
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="suxus-tryon.jpg"' } });
}
