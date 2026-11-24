"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
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
  const db = await getDb();
  await db.update(schema.staff).set({ simpleMode: on }).where(eq(schema.staff.id, id));
  await audit(db, user, "update", "staff", id, `Simple measurement mode ${on ? "on" : "off"}`);
  revalidatePath("/", "layout");
  return ok(null);
}
