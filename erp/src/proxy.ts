import { NextResponse, type NextRequest } from "next/server";

// /j/<token>: a shared job slip PDF — the long random token is the only key; it reaches that one PDF and nothing else
const PUBLIC = ["/login", "/setup", "/api/health", "/j"];

/** Cheap gate: no session cookie → login. Signature is verified server-side in requireUser(). */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.has("suxus_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|manifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)"],
};
