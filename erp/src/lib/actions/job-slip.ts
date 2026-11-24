"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { jobSlipFileName, jobSlipPages, jobSlipToken, logJobSlip, parseItemCode } from "@/lib/job-slip";
import { fail, ok, type Result } from "./util";

/** The private link of an item's job slip (or the whole order's). Opening it records the view. */
export async function jobSlipLink(orderId: number, itemId: number | null): Promise<Result<{ url: string; fileName: string }>> {
  await requireUser();
  const pages = await jobSlipPages(orderId, itemId);
  if (!pages) return fail("Order item not found");
  return ok({ url: `/j/${await jobSlipToken(orderId, itemId)}`, fileName: jobSlipFileName(pages, !itemId) });
}

/** Share: records who shared it, and returns the link + file name for the phone's share sheet. */
export async function shareJobSlip(orderId: number, itemId: number | null): Promise<Result<{ url: string; fileName: string; text: string }>> {
  const user = await requireUser();
  const pages = await jobSlipPages(orderId, itemId);
  if (!pages) return fail("Order item not found");
  const token = await jobSlipToken(orderId, itemId);
  const p = pages[0];
  await logJobSlip({ orderId, itemId, action: "share", via: "app", staffName: user.name, detail: itemId ? `${p.item} — ${p.wearer}` : `all ${pages.length} pages` });
  return ok({
    url: `/j/${token}`,
    fileName: jobSlipFileName(pages, !itemId),
    text: itemId ? `${p.orderNo} · ${p.wearer} · ${p.item}${p.deliveryDate ? ` · delivery ${p.deliveryDate.split("-").reverse().join("-")}` : ""}` : `${p.orderNo} job slips (${pages.length})`,
  });
}

/** A scanned bundle label (JOB-<item id>) → that item's job slip link. */
export async function jobSlipByCode(code: string): Promise<Result<{ url: string; orderId: number }>> {
  await requireUser();
  const itemId = parseItemCode(code);
  if (!itemId) return fail("Not a bundle label");
  if (!(await features()).jobSlip) return fail("Job slips are not available yet — the database update for them has not run");
  const db = await getDb();
  const [it] = await db.select({ orderId: schema.orderItems.orderId }).from(schema.orderItems).where(eq(schema.orderItems.id, itemId));
  if (!it) return fail(`No order item ${itemId} — the label may belong to an item that was removed`);
  return ok({ url: `/j/${await jobSlipToken(it.orderId, itemId)}`, orderId: it.orderId });
}
