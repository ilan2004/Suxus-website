import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/db/features";
import { getSetting } from "@/lib/settings";
import { variantsFor } from "@/lib/variants";
import { sleeveOfVariant } from "@/lib/variants";
import { isStyle, variantOfSleeve } from "@/lib/tryon-style";
import { TryonError, generateTryon, normalisePhoto, usage } from "@/lib/tryon";
import { cleanCode, useCode } from "@/lib/tryon-web";
import { saveWebLead } from "@/lib/tryon-lead";
import { toIntlPhone } from "@/lib/phone";
import { deviceOf, isShopTester, shopVisit } from "../_device";

export const dynamic = "force-dynamic";
/** The model usually answers in 10–40 s; allow for a slow one. */
export const maxDuration = 120;

const MAX_UPLOAD = 8 * 1024 * 1024;

/** One try-on. Limits are checked here, on the server. Errors come back as a code the page turns into Malayalam. */
export async function POST(req: NextRequest) {
  if (!(await features()).tryon) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { device, ip } = await deviceOf();
  const tester = await isShopTester();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_photo" }, { status: 400 });
  }
  // shop QR (12-hour cookie) or a website visitor; a WhatsApp code gives a website visitor more
  const ctx = { shop: await shopVisit(), code: cleanCode(form.get("code")) };
  const before = await usage(device, ip, tester, ctx);
  // the controls in Settings > Try-on: off, monthly cap, whole shop per day, per person per day, website limits
  if (before.blocked || before.left <= 0) return NextResponse.json({ ok: false, error: before.blocked ?? "limit", ...before }, { status: before.blocked === "off" ? 503 : 429 });
  // a website visitor gives a name and phone first (no OTP); it becomes a Try-on enquiry
  const lead = before.via === "web" ? { name: String(form.get("leadName") ?? "").trim().slice(0, 80), phone: toIntlPhone(String(form.get("leadPhone") ?? "")) } : null;
  if (lead && (lead.name.length < 2 || !lead.phone)) return NextResponse.json({ ok: false, error: "contact", ...before }, { status: 400 });
  const file = form.get("photo");
  const fabricId = Number(form.get("fabricId"));
  let variant = String(form.get("variant") ?? "");
  // Styling choices: only when switched on for customers (Settings > Try-on) or for owner / partner testing.
  // They change the words of the ONE call — never the number of calls or the limits above.
  const c = await getSetting("tryon");
  const wanted = { sleeve: form.get("sleeve"), tuck: form.get("tuck"), pocket: form.get("pocket") };
  const style = (c.styles || tester) && (await features()).tryonStyle && isStyle(wanted) ? wanted : null;
  if (style) variant = variantOfSleeve(style.sleeve);
  // shirt + pant in the same ONE image (with the styling choices): a Suiting cloth and Regular / Loose model
  const pantId = Number(form.get("pantFabricId"));
  const pantVariant = String(form.get("pantVariant") ?? "");
  const pantVariants = variantsFor("Pant", await getSetting("variants"));
  const pant =
    style && (await features()).tryonPant && Number.isInteger(pantId) && pantId > 0 && pantVariants.includes(pantVariant)
      ? { fabricId: pantId, model: (/loose/i.test(pantVariant) ? "Loose" : "Regular") as "Regular" | "Loose", variant: pantVariant }
      : null;
  const allowed = variantsFor("Shirt", await getSetting("variants"));
  const sleeve = sleeveOfVariant(variant);
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_UPLOAD) return NextResponse.json({ ok: false, error: "bad_photo" }, { status: 400 });
  if (!Number.isInteger(fabricId) || !allowed.includes(variant) || !sleeve) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  try {
    const photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
    const feat = await features();
    const r = await generateTryon({ device, ip, fabricId, sleeve, variant, photo, origin: req.nextUrl.origin, style, pant, source: feat.tryonWeb ? { via: before.via, code: ctx.code } : null });
    if (before.via === "code") await useCode(ctx.code);
    if (lead?.phone) await saveWebLead({ name: lead.name, phone: lead.phone, device, resultId: r.resultId }).catch((e) => console.error("[tryon] lead", e));
    const after = await usage(device, ip, tester, ctx);
    return NextResponse.json({ ok: true, image: `/api/tryon/image/${r.resultId}`, ms: r.ms, ...after, blocked: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const code = e instanceof TryonError ? e.code : "api";
    // keep the visitor's number even when the picture failed
    if (lead?.phone) await saveWebLead({ name: lead.name, phone: lead.phone, device, resultId: null, fabricId, variant }).catch(() => {});
    const after = await usage(device, ip, tester, ctx).catch(() => before);
    return NextResponse.json({ ok: false, error: code, ...after }, { status: code === "bad_photo" ? 400 : 502 });
  }
}
