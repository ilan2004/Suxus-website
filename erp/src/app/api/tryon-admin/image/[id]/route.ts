import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { enquiryImage } from "@/lib/tryon-admin";

export const dynamic = "force-dynamic";

/** A try-on enquiry's image — partners only (signed in). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser({ can: "prices" });
  const id = Number((await params).id);
  const img = Number.isInteger(id) ? await enquiryImage(id) : null;
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" } });
}
