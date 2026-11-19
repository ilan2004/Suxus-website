"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { PIN_RE, checkPin, hashPin, requireUser, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { fail, ok, zodError, type Result } from "./util";

const RoleEnum = z.enum(["owner", "partner", "staff"]);
const Pin = z.string().regex(PIN_RE, "PIN must be exactly 6 digits");

export type UserRow = {
  id: number;
  name: string;
  displayName: string | null;
  role: Role | null;
  job: string | null;
  status: string;
  lockedUntil: string | null;
  failedPins: number;
};

/** Everyone in Staff — those with a sign-in first. People without one can be given one ("Add user"). */
export async function listUsers(): Promise<UserRow[]> {
  await requireUser({ can: "users" });
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.staff.id,
      name: schema.staff.name,
      displayName: schema.staff.displayName,
      access: schema.staff.access,
      job: schema.staff.role,
      status: schema.staff.status,
      lockedUntil: schema.staff.lockedUntil,
      failedPins: schema.staff.failedPins,
    })
    .from(schema.staff)
    .orderBy(schema.staff.code);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    role: r.access === "owner" || r.access === "partner" || r.access === "staff" ? r.access : null,
    job: r.job,
    status: r.status,
    lockedUntil: r.lockedUntil && r.lockedUntil.getTime() > Date.now() ? r.lockedUntil.toISOString() : null,
    failedPins: r.failedPins,
  }));
}

/** At least one active Owner must always remain. */
async function wouldLeaveNoOwner(db: Awaited<ReturnType<typeof getDb>>, id: number) {
  const others = await db
    .select({ id: schema.staff.id })
    .from(schema.staff)
    .where(and(eq(schema.staff.access, "owner"), eq(schema.staff.status, "Active"), ne(schema.staff.id, id)));
  return others.length === 0;
}

const AddUser = z
  .object({
    name: z.string().trim().min(2, "Enter the name").max(80),
    displayName: z.string().trim().max(20).optional().nullable(),
    role: RoleEnum,
    pin: Pin,
    pin2: z.string(),
  })
  .refine((v) => v.pin === v.pin2, { message: "PINs do not match", path: ["pin2"] });

/**
 * Add a sign-in. If someone with this name is already in Staff (e.g. a tailor), the sign-in is added to
 * that record, so their orders and wages stay linked to one person. Only a bcrypt hash of the PIN is stored.
 */
export async function addUser(input: z.input<typeof AddUser>): Promise<Result<{ id: number }>> {
  const me = await requireUser({ can: "users" });
  const parsed = AddUser.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  const pinHash = await hashPin(d.pin);
  const displayName = d.displayName || null;
  const [existing] = await db
    .select()
    .from(schema.staff)
    .where(sql`lower(regexp_replace(trim(${schema.staff.name}), '[[:space:]]+', ' ', 'g')) = ${d.name.toLowerCase().replace(/\s+/g, " ")}`);
  let id: number;
  if (existing) {
    if (existing.access !== "none" && existing.pinHash) return fail(`${existing.name} already has a sign-in — use Reset PIN or change the role instead.`);
    await db
      .update(schema.staff)
      .set({ access: d.role, pinHash, displayName, status: "Active", failedPins: 0, lockedUntil: null, sessionVersion: sql`${schema.staff.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(schema.staff.id, existing.id));
    id = existing.id;
  } else {
    const n = await nextNumber(db, "staff");
    const [row] = await db
      .insert(schema.staff)
      .values({ code: `S${String(n).padStart(2, "0")}`, name: d.name, displayName, role: ROLE_LABEL[d.role], access: d.role, pinHash })
      .returning({ id: schema.staff.id });
    id = row.id;
  }
  await audit(db, me, "create", "user", id, `${d.name} (${ROLE_LABEL[d.role]})${existing ? " — sign-in added to existing staff record" : ""}`);
  revalidatePath("/settings");
  revalidatePath("/staff");
  return ok({ id });
}

const UpdateUser = z.object({ id: z.number().int().positive(), displayName: z.string().trim().max(20).optional().nullable(), role: RoleEnum });

export async function updateUser(input: z.input<typeof UpdateUser>): Promise<Result<null>> {
  const me = await requireUser({ can: "users" });
  const parsed = UpdateUser.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  const [u] = await db.select().from(schema.staff).where(eq(schema.staff.id, d.id));
  if (!u) return fail("User not found");
  if (u.access === "owner" && d.role !== "owner" && (await wouldLeaveNoOwner(db, u.id))) return fail("At least one Owner is needed — make someone else Owner first.");
  await db
    .update(schema.staff)
    .set({ displayName: d.displayName || null, access: d.role, updatedAt: new Date() })
    .where(eq(schema.staff.id, d.id));
  await audit(db, me, "update", "user", d.id, `${u.name}: ${u.access} → ${d.role}`);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return ok(null);
}

const ResetPin = z
  .object({ id: z.number().int().positive(), pin: Pin, pin2: z.string() })
  .refine((v) => v.pin === v.pin2, { message: "PINs do not match", path: ["pin2"] });

/** Owner sets a new PIN for someone. Signs that person out everywhere and clears any lock. */
export async function resetUserPin(input: z.input<typeof ResetPin>): Promise<Result<null>> {
  const me = await requireUser({ can: "users" });
  const parsed = ResetPin.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const db = await getDb();
  const [u] = await db
    .update(schema.staff)
    .set({ pinHash: await hashPin(parsed.data.pin), failedPins: 0, lockedUntil: null, sessionVersion: sql`${schema.staff.sessionVersion} + 1`, updatedAt: new Date() })
    .where(and(eq(schema.staff.id, parsed.data.id), ne(schema.staff.access, "none")))
    .returning({ id: schema.staff.id, name: schema.staff.name, v: schema.staff.sessionVersion });
  if (!u) return fail("User not found");
  if (u.id === me.id) await startSession({ id: u.id, sessionVersion: u.v }); // keep this device signed in
  await audit(db, me, "update", "user", u.id, `PIN reset for ${u.name}`);
  revalidatePath("/settings");
  return ok(null);
}

export async function unlockUser(id: number): Promise<Result<null>> {
  const me = await requireUser({ can: "users" });
  const db = await getDb();
  await db.update(schema.staff).set({ failedPins: 0, lockedUntil: null }).where(eq(schema.staff.id, id));
  await audit(db, me, "update", "user", id, "unlocked");
  revalidatePath("/settings");
  return ok(null);
}

/** Take away someone's sign-in (their staff record, orders and wages stay). */
export async function removeUserAccess(id: number): Promise<Result<null>> {
  const me = await requireUser({ can: "users" });
  const db = await getDb();
  const [u] = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
  if (!u) return fail("User not found");
  if (u.access === "owner" && (await wouldLeaveNoOwner(db, id))) return fail("At least one Owner is needed.");
  await db
    .update(schema.staff)
    .set({ access: "none", pinHash: null, failedPins: 0, lockedUntil: null, sessionVersion: sql`${schema.staff.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(schema.staff.id, id));
  await audit(db, me, "update", "user", id, `sign-in removed for ${u.name}`);
  revalidatePath("/settings");
  revalidatePath("/staff");
  return ok(null);
}

const ChangeMyPin = z
  .object({ current: z.string().min(1, "Enter your current PIN"), pin: Pin, pin2: z.string() })
  .refine((v) => v.pin === v.pin2, { message: "New PINs do not match", path: ["pin2"] })
  .refine((v) => v.pin !== v.current, { message: "The new PIN is the same as the old one", path: ["pin"] });

/** Anyone can change their own PIN (needs the current one). Other devices are signed out; this one stays in. */
export async function changeMyPin(input: z.input<typeof ChangeMyPin>): Promise<Result<null>> {
  const me = await requireUser();
  const parsed = ChangeMyPin.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const db = await getDb();
  const [u] = await db.select().from(schema.staff).where(eq(schema.staff.id, me.id));
  if (!u?.pinHash || !(await checkPin(parsed.data.current, u.pinHash))) return fail("Current PIN is wrong");
  const [row] = await db
    .update(schema.staff)
    .set({ pinHash: await hashPin(parsed.data.pin), sessionVersion: sql`${schema.staff.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(schema.staff.id, me.id))
    .returning({ v: schema.staff.sessionVersion });
  await startSession({ id: me.id, sessionVersion: row.v });
  await audit(db, me, "update", "user", me.id, "changed own PIN");
  return ok(null);
}
