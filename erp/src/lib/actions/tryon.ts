"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { getSetting, saveSetting } from "@/lib/settings";
import { approvePairing, newDisplayToken } from "@/lib/tryon-tv";
import { cancelCode, createCode, newShopKey, type TryonCode } from "@/lib/tryon-web";
import { fail, ok, zodError, type Result } from "./util";

/** Try-on enquiries: tick / untick "contacted" (who and when are kept). Partners only. */
export async function setEnquiryContacted(id: number, contacted: boolean): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  const db = await getDb();
  await db
    .update(schema.tryonEnquiries)
    .set({ contacted, contactedBy: contacted ? user.name : null, contactedAt: contacted ? new Date() : null })
    .where(eq(schema.tryonEnquiries.id, id));
  await audit(db, user, "update", "tryon-enquiry", id, contacted ? "contacted" : "not contacted");
  revalidatePath("/settings/tryon/enquiries");
  return ok(null);
}

const Controls = z.object({
  enabled: z.boolean(),
  perDevice: z.union([z.literal(1), z.literal(2)]),
  shopPerDay: z.coerce.number<number>().int().min(0).max(10000),
  monthlyCapInr: z.coerce.number<number>().min(0).max(10_000_000),
  styles: z.boolean(),
  webLock: z.boolean(),
  webPerDevice: z.union([z.literal(1), z.literal(2)]),
  webPerDay: z.coerce.number<number>().int().min(0).max(10000),
});

/** Settings > Try-on: master switch and limits. Read on every request, so they apply at once. Partners only. */
export async function saveTryonControls(input: z.input<typeof Controls>): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  const parsed = Controls.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const before = await getSetting("tryon");
  const d = parsed.data;
  // the shop QR key is made the first time the website lock is switched on
  const shopKey = before.shopKey || (d.webLock ? newShopKey() : "");
  await saveSetting("tryon", { ...before, ...d, shopKey });
  await audit(
    await getDb(),
    user,
    "update",
    "settings",
    "tryon",
    `Try-on ${d.enabled ? "ON" : "OFF"} · ${d.perDevice}/person/day · ${d.shopPerDay}/shop/day · cap ₹${d.monthlyCapInr}/month · styles for customers ${d.styles ? "ON" : "OFF"} · website lock ${d.webLock ? `ON (${d.webPerDevice}/phone, ${d.webPerDay}/day)` : "OFF"}`,
  );
  revalidatePath("/settings/tryon");
  return ok(null);
}

/** A new secret for the shop TV link (the old link stops working). Partners only. */
export async function newTvLink(): Promise<Result<{ token: string }>> {
  const user = await requireUser({ can: "prices" });
  const token = newDisplayToken();
  await saveSetting("tryon", { ...(await getSetting("tryon")), displayToken: token });
  await audit(await getDb(), user, "update", "settings", "tryon", "new shop TV link");
  revalidatePath("/settings/tryon");
  return ok({ token });
}

/** Settings > Try-on > Pair a TV: the 6-digit code shown on the TV. Partners only. */
export async function pairTv(code: string): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return fail("Type the 6 numbers shown on the TV");
  if (!(await approvePairing(code.replace(/\s/g, "")))) return fail("That code is not on any TV right now (codes last 15 minutes) — check the number on the TV");
  await audit(await getDb(), user, "update", "settings", "tryon", "shop TV paired");
  revalidatePath("/settings/tryon");
  return ok(null);
}

/** A new shop QR key: every printed shop QR stops counting as "in the shop" (reprint them). Partners only. */
export async function newShopQr(): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  await saveSetting("tryon", { ...(await getSetting("tryon")), shopKey: newShopKey() });
  await audit(await getDb(), user, "update", "settings", "tryon", "new shop QR (old printed QRs now count as website)");
  revalidatePath("/settings/tryon");
  return ok(null);
}

/** Settings > Try-on: a WhatsApp code for a website visitor (6 digits, 1–3 try-ons, 7 days). Partners only. */
export async function newTryonCode(tries: number, note: string): Promise<Result<TryonCode>> {
  const user = await requireUser({ can: "prices" });
  if (![1, 2, 3].includes(tries)) return fail("Choose 1, 2 or 3 try-ons");
  const c = await createCode(tries, note.trim(), user.name);
  await audit(await getDb(), user, "create", "tryon-code", c.code, `${tries} try-on${tries > 1 ? "s" : ""}${c.note ? ` · ${c.note}` : ""}`);
  revalidatePath("/settings/tryon");
  return ok(c);
}

/** Stop a WhatsApp code now. Partners only. */
export async function stopTryonCode(code: string): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  await cancelCode(code);
  await audit(await getDb(), user, "update", "tryon-code", code, "stopped");
  revalidatePath("/settings/tryon");
  return ok(null);
}
