import { NextResponse, type NextRequest } from "next/server";
import { TV_COOKIE, claimPairing } from "@/lib/tryon-tv";

export const dynamic = "force-dynamic";

/** The TV checks whether its 6-digit code has been entered in Settings; once it has, the TV gets its cookie. */
export async function GET(req: NextRequest) {
  const nonce = req.nextUrl.searchParams.get("n") ?? "";
  if (!/^[A-Za-z0-9_-]{30,40}$/.test(nonce)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await claimPairing(nonce);
  if (r === "wait") return NextResponse.json({ ok: true, paired: false }, { headers: { "Cache-Control": "no-store" } });
  if (r === "expired") return NextResponse.json({ ok: false, expired: true }, { status: 410 });
  const res = NextResponse.json({ ok: true, paired: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(TV_COOKIE, r.cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 400 });
  return res;
}
