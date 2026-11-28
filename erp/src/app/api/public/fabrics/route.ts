import { NextResponse } from "next/server";
import { tryonFabrics } from "@/lib/tryon";

export const dynamic = "force-dynamic";

const HEADERS = {
  // read by the shop website (suxus.shop) from the visitor's browser; public fields only, no cookies
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  // the website's visitors share one cached copy for 5 minutes, so they never load the database
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

/**
 * Fabrics for the shop website: active, in stock (balance > 0) and with a photo — the same list customers see on the
 * try-on page. Code, name, colour, pattern, Shirting / Suiting and the sale rate per metre. No cost, supplier or stock
 * figures.
 */
export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const abs = (u: string | null | undefined) => (!u ? null : /^https?:\/\//.test(u) ? u : origin + u);
    const fabrics = (await tryonFabrics()).map((f) => ({
      code: f.code,
      name: f.name,
      colour: f.colour,
      pattern: f.pattern,
      kind: f.forPant ? "Suiting" : "Shirting",
      rate: f.rate,
      thumb: abs(f.thumb),
      photo: abs(f.photo),
    }));
    return NextResponse.json({ ok: true, fabrics, tryon: origin + "/tryon" }, { headers: HEADERS });
  } catch (e) {
    console.error("[public] fabrics", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
