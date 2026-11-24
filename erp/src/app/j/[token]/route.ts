import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jobSlipFileName, jobSlipPages, logJobSlip, renderJobSlipPdf, resolveJobSlipToken } from "@/lib/job-slip";

export const dynamic = "force-dynamic";

/**
 * A shared job slip: /j/<long random token> → that one PDF. No login, no listing, no links into the ERP.
 * Generated on every request, so a corrected measurement shows straight away.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  const ref = await resolveJobSlipToken((await params).token);
  if (!ref) return notFound();
  const pages = await jobSlipPages(ref.orderId, ref.kind === "item" ? ref.itemId : null);
  if (!pages) return notFound();
  const pdf = await renderJobSlipPdf(pages);
  // Record who opened it: the signed-in user, or "shared link" for a tailor outside the app.
  // The app's own Share fetches the file with ?s=1 (that share is recorded separately).
  const session = await getSession().catch(() => null);
  if (!(session && req.nextUrl.searchParams.get("s") === "1")) {
    await logJobSlip({
      orderId: ref.orderId,
      itemId: ref.kind === "item" ? ref.itemId : null,
      action: "view",
      via: session ? "app" : "link",
      staffName: session?.name ?? null,
      detail: ref.kind === "item" ? `${pages[0].item} — ${pages[0].wearer}` : `all ${pages.length} pages`,
    });
  }
  const name = jobSlipFileName(pages, ref.kind === "order");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
