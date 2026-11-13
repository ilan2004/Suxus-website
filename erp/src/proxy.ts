import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/setup"];

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
