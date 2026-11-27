import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { toIntlPhone } from "@/lib/phone";
import { imageFor, todayStartIST } from "@/lib/tryon";
import { deviceOf } from "../_device";

export const dynamic = "force-dynamic";

/** "I want this": name + phone → an enquiry linked to the fabric, variant and the generated image of THIS phone. */
export async function POST(req: NextRequest) {
  if (!(await features()).tryonLeads) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device } = await deviceOf();
  const body = (await req.json().catch(() => null)) as { name?: unknown; phone?: unknown; image?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const phone = typeof body?.phone === "string" ? toIntlPhone(body.phone) : null;
  const resultId = typeof body?.image === "string" ? body.image.split("/").pop() ?? "" : "";
  if (name.length < 2) return NextResponse.json({ ok: false, error: "name" }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: "phone" }, { status: 400 });
  // the image must be one this phone made
  if (!(await imageFor(resultId, device))) return NextResponse.json({ ok: false, error: "image" }, { status: 400 });
  const db = await getDb();
  const [n] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.tryonEnquiries)
    .where(and(eq(schema.tryonEnquiries.device, device), gte(schema.tryonEnquiries.createdAt, todayStartIST())));
  if (n.n >= 6) return NextResponse.json({ ok: false, error: "limit" }, { status: 429 });
  const [gen] = await db
    .select({ id: schema.tryonGenerations.id, fabricId: schema.tryonGenerations.fabricId, variant: schema.tryonGenerations.variant })
    .from(schema.tryonGenerations)
    .where(eq(schema.tryonGenerations.resultId, resultId));
  // one enquiry per image: asking again updates the name / phone
  const [existing] = await db.select({ id: schema.tryonEnquiries.id }).from(schema.tryonEnquiries).where(and(eq(schema.tryonEnquiries.resultId, resultId), eq(schema.tryonEnquiries.device, device)));
  if (existing) await db.update(schema.tryonEnquiries).set({ name, phone }).where(eq(schema.tryonEnquiries.id, existing.id));
  else await db.insert(schema.tryonEnquiries).values({ name, phone, resultId, device, fabricId: gen?.fabricId ?? null, variant: gen?.variant ?? null, generationId: gen?.id ?? null });
  return NextResponse.json({ ok: true });
}
