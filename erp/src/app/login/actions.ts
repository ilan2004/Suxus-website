"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { LOCK_AFTER, LOCK_MINUTES, PIN_RE, checkPin, displayNameOf, endSession, hasAnyLoginUser, hashPin, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";

/**
 * Sign in with a 6-digit PIN. Wrong PINs are counted in the database (not the browser, not server memory):
 * after 5 in a row the login is locked for 15 minutes, on every device.
 */
export async function loginAction(staffId: number, pin: string): Promise<{ error?: string }> {
  const db = await getDb();
  const [user] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!user || user.access === "none" || !user.pinHash || user.status !== "Active") return { error: "This user cannot sign in." };

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil.getTime() > now) {
    const mins = Math.ceil((user.lockedUntil.getTime() - now) / 60_000);
    return { error: `Too many wrong PINs. Locked for ${mins} more minute${mins === 1 ? "" : "s"}. · ലോക്ക് ചെയ്തു` };
  }

  if (!(await checkPin(String(pin), user.pinHash))) {
    // Count atomically in the database so parallel attempts cannot slip past the limit
    const [row] = await db
      .update(schema.staff)
      .set({ failedPins: sql`${schema.staff.failedPins} + 1` })
      .where(eq(schema.staff.id, user.id))
      .returning({ failed: schema.staff.failedPins });
    if (row.failed >= LOCK_AFTER) {
      await db.update(schema.staff).set({ failedPins: 0, lockedUntil: new Date(now + LOCK_MINUTES * 60_000) }).where(eq(schema.staff.id, user.id));
      await audit(db, null, "login", "staff", user.id, `locked for ${LOCK_MINUTES} min after ${LOCK_AFTER} wrong PINs`);
      return { error: `Too many wrong PINs. Locked for ${LOCK_MINUTES} minutes. · ലോക്ക് ചെയ്തു` };
    }
    const left = LOCK_AFTER - row.failed;
    return { error: `Wrong PIN · തെറ്റായ പിൻ — ${left} ${left === 1 ? "try" : "tries"} left` };
  }
  if (user.failedPins || user.lockedUntil) await db.update(schema.staff).set({ failedPins: 0, lockedUntil: null }).where(eq(schema.staff.id, user.id));
  await startSession(user);
  await audit(db, { id: user.id, name: displayNameOf(user), fullName: user.name, role: "staff", v: 0, exp: 0 }, "login", "staff", user.id);
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/** First run only: creates the first login — the Owner. */
export async function setupAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (await hasAnyLoginUser()) return { error: "Setup is already complete. Please sign in." };
  const required = process.env.ERP_SETUP_CODE;
  if (required && String(form.get("code") ?? "").trim() !== required) return { error: "Wrong setup code (it is in Vercel → Environment Variables → ERP_SETUP_CODE)." };
  if (!required && process.env.NODE_ENV === "production") return { error: "Set ERP_SETUP_CODE in the hosting environment first." };
  const name = String(form.get("name") ?? "").trim();
  const pin = String(form.get("pin") ?? "");
  const pin2 = String(form.get("pin2") ?? "");
  if (name.length < 2) return { error: "Enter your name." };
  if (!PIN_RE.test(pin)) return { error: "PIN must be exactly 6 digits." };
  if (pin !== pin2) return { error: "PINs do not match." };

  const db = await getDb();
  const pinHash = await hashPin(pin);
  // Match an existing staff record ignoring capitals and extra spaces ("sahim kt" = "Sahim KT"), so the login
  // is added to that record instead of creating a second one
  const [existing] = await db
    .select()
    .from(schema.staff)
    .where(sql`lower(regexp_replace(trim(${schema.staff.name}), '[[:space:]]+', ' ', 'g')) = ${name.toLowerCase().replace(/\s+/g, " ")}`)
    .limit(1);
  let user;
  if (existing) {
    [user] = await db
      .update(schema.staff)
      .set({ access: "owner", role: "Owner", pinHash, status: "Active" })
      .where(eq(schema.staff.id, existing.id))
      .returning();
  } else {
    const n = await nextNumber(db, "staff");
    [user] = await db
      .insert(schema.staff)
      .values({ code: `S${String(n).padStart(2, "0")}`, name, role: "Owner", payType: "Partner (No Salary)", access: "owner", pinHash })
      .returning();
  }
  await startSession(user);
  redirect("/");
}
