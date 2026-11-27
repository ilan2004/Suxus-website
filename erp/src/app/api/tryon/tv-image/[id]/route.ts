import { NextResponse, type NextRequest } from "next/server";
import { tvAllowed, tvImage } from "@/lib/tryon-tv";

export const dynamic = "force-dynamic";

/** A shown result's image for the TV — only while the customer has it on "Show on the shop TV". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await tvAllowed(req.nextUrl.searchParams.get("key")))) return new NextResponse("Forbidden", { status: 403 });
  const id = Number((await params).id);
  const img = Number.isInteger(id) ? await tvImage(id) : null;
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" } });
}
