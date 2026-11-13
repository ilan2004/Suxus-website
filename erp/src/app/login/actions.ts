"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { checkPin, endSession, hasAnyLoginUser, hashPin, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";

const attempts = new Map<number, { count: number; until: number }>();

export async function loginAction(staffId: number, pin: string): Promise<{ error?: string }> {
  const lock = attempts.get(staffId);
  if (lock && lock.until > Date.now()) return { error: "Too many wrong PINs. Wait a minute and try again." };

  const db = await getDb();
  const [user] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!user || user.access === "none" || !user.pinHash || user.status !== "Active") return { error: "This user cannot sign in." };

  if (!(await checkPin(pin, user.pinHash))) {
    const count = (lock?.count ?? 0) + 1;
    attempts.set(staffId, { count, until: count >= 5 ? Date.now() + 60_000 : 0 });
    return { error: "Wrong PIN · തെറ്റായ പിൻ" };
  }
  attempts.delete(staffId);
  await startSession(user);
  await audit(db, { id: user.id, name: user.name, role: "staff", exp: 0 }, "login", "staff", user.id);
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/** First run only: creates the first partner login. */
export async function setupAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (await hasAnyLoginUser()) return { error: "Setup is already complete. Please sign in." };
  const name = String(form.get("name") ?? "").trim();
  const pin = String(form.get("pin") ?? "");
  const pin2 = String(form.get("pin2") ?? "");
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN must be 4–6 digits." };
  if (pin !== pin2) return { error: "PINs do not match." };

  const db = await getDb();
  const pinHash = await hashPin(pin);
  const [existing] = await db.select().from(schema.staff).where(eq(schema.staff.name, name));
  let user;
  if (existing) {
    [user] = await db
      .update(schema.staff)
      .set({ access: "partner", pinHash, status: "Active" })
      .where(eq(schema.staff.id, existing.id))
      .returning();
  } else {
    const n = await nextNumber(db, "staff");
    [user] = await db
      .insert(schema.staff)
      .values({ code: `S${String(n).padStart(2, "0")}`, name, role: "Partner", payType: "Partner (No Salary)", access: "partner", pinHash })
      .returning();
  }
  await startSession(user);
  redirect("/");
}
