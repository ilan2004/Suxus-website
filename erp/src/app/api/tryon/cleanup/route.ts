import { NextResponse } from "next/server";
import { features } from "@/lib/db/features";
import { cleanupOld } from "@/lib/tryon";

export const dynamic = "force-dynamic";

/** Daily (Vercel cron): delete try-on photos and results older than 7 days. Safe to call any time. */
export async function GET() {
  if (!(await features()).tryon) return NextResponse.json({ ok: true, deleted: 0 });
  return NextResponse.json({ ok: true, deleted: await cleanupOld() });
}
