import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { LOCAL_DIR, storageMode, verifyLocalSig } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Local-development stand-in for Supabase Storage (disabled in production). */
function safePath(p: string | null) {
  if (!p || !/^fabrics\/\d{4}-\d{2}\/[a-f0-9-]+(-thumb)?\.(webp|jpg)$/.test(p)) return null;
  return path.join(LOCAL_DIR, p);
}

export async function GET(req: NextRequest) {
  if (storageMode() !== "local") return new NextResponse("Not found", { status: 404 });
  const p = req.nextUrl.searchParams.get("path");
  const file = safePath(p);
  if (!file) return new NextResponse("Bad path", { status: 400 });
  try {
    const buf = await fs.readFile(file);
    return new NextResponse(buf, { headers: { "Content-Type": p!.endsWith(".webp") ? "image/webp" : "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  if (storageMode() !== "local") return new NextResponse("Not found", { status: 404 });
  const p = req.nextUrl.searchParams.get("path");
  const file = safePath(p);
  if (!file || !verifyLocalSig(p!, req.nextUrl.searchParams.get("sig"))) return new NextResponse("Bad signature", { status: 403 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) return new NextResponse("Too large", { status: 413 });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  return NextResponse.json({ ok: true });
}
