import { NextResponse, type NextRequest } from "next/server";

// /j/<token>: a shared job slip PDF — the long random token is the only key; it reaches that one PDF and nothing else
// /tryon + /api/tryon: the customers' fabric try-on (no sign-in); /api/uploads: fabric photos (local development only)
// /api/public: read-only shop data for the website (fabrics in stock with sale rates)
const PUBLIC = ["/login", "/setup", "/api/health", "/j", "/tryon", "/api/tryon", "/api/uploads", "/api/public"];

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
