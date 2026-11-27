"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ok, type Result } from "./util";

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
