"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { staffExt } from "@/lib/db/ext";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, fail, type Result } from "./util";

/**
 * Simple measurement mode (ലളിതമായ അളവ് രീതി) on / off. Anyone may switch it for themself;
 * the Owner (users permission) may switch it for anyone from Settings → Users.
 */
export async function setSimpleMode(on: boolean, staffId?: number): Promise<Result<null>> {
  const user = await requireUser();
  const id = staffId ?? user.id;
  if (id !== user.id && !can(user.role, "users")) return fail("Only the Owner can change this for someone else");
  if (!(await features()).simple) return fail("Simple measurement mode is not available yet (database update pending)");
  const db = await getDb();
  await db.update(staffExt).set({ simpleMode: on }).where(eq(staffExt.id, id));
  await audit(db, user, "update", "staff", id, `Simple measurement mode ${on ? "on" : "off"}`);
  revalidatePath("/", "layout");
  return ok(null);
}
