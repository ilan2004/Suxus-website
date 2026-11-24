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
  code: string;
  phone: string | null;
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
      code: schema.staff.code,
      phone: schema.staff.phone,
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
    code: r.code,
    phone: r.phone,
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

/* ───────────── Merging duplicate staff records ───────────── */

type RefCount = { label: string; count: number };

/** postgres-js returns an array (with .count); PGlite returns { rows, affectedRows }. */
const rowsOf = <T,>(res: unknown): T[] => (Array.isArray(res) ? (res as T[]) : ((res as { rows?: T[] }).rows ?? []));
const changedOf = (res: unknown) => Number((res as { count?: number }).count ?? (res as { affectedRows?: number }).affectedRows ?? 0);

/** Every place a staff record is referenced: by id, and by name (text fields hold the name as it was written). */
async function staffRefs(db: Awaited<ReturnType<typeof getDb>>, src: { id: number; name: string; displayName: string | null }) {
  const s = schema;
  const names = [...new Set([src.name, src.displayName].filter((n): n is string => !!n))];
  const byId: { label: string; table: typeof s.sales | typeof s.orders | typeof s.orderItems | typeof s.bulkOrders | typeof s.payments | typeof s.tailorWages | typeof s.wagePayments | typeof s.incentivePayouts | typeof s.auditLog; col: string }[] = [
    { label: "Bills — Sold by", table: s.sales, col: "sold_by_id" },
    { label: "Orders — Tailor", table: s.orders, col: "tailor_id" },
    { label: "Order items — Tailor", table: s.orderItems, col: "tailor_id" },
    { label: "Orders — Brought by", table: s.orders, col: "brought_by_id" },
    { label: "Bulk orders — Brought by", table: s.bulkOrders, col: "brought_by_id" },
    { label: "Payments — Received by", table: s.payments, col: "received_by_id" },
    { label: "Tailor wages", table: s.tailorWages, col: "tailor_id" },
    { label: "Wage payouts", table: s.wagePayments, col: "tailor_id" },
    { label: "Incentive payouts", table: s.incentivePayouts, col: "staff_id" },
    { label: "Change log — user", table: s.auditLog, col: "staff_id" },
  ];
  const byName: { label: string; table: string; col: string; use: "name" | "display" }[] = [
    { label: "Setup Expenses — Paid by", table: "setup_expenses", col: "paid_by", use: "name" },
    { label: "Opening Stock — Owned by", table: "opening_stock", col: "owned_by", use: "name" },
    { label: "Cash Book — Partner", table: "cash_book", col: "partner", use: "name" },
    { label: "Fabric — Brought in by", table: "fabrics", col: "brought_in_by", use: "name" },
    { label: "Supplier payments — Paid by", table: "supplier_payments", col: "paid_by", use: "name" },
    { label: "Bills — Entered by", table: "sales", col: "created_by", use: "display" },
    { label: "Orders — Booked by", table: "orders", col: "created_by", use: "display" },
    { label: "Orders — Last edited by", table: "orders", col: "updated_by", use: "display" },
    { label: "Bulk orders — Entered by", table: "bulk_orders", col: "created_by", use: "display" },
    { label: "Payments — Entered by", table: "payments", col: "created_by", use: "display" },
    { label: "Supplier payments — Entered by", table: "supplier_payments", col: "created_by", use: "display" },
    { label: "Wage payouts — Entered by", table: "wage_payments", col: "created_by", use: "display" },
    { label: "Order stage changes — by", table: "order_status_changes", col: "changed_by", use: "display" },
    { label: "WhatsApp messages — Sent by", table: "customer_messages", col: "sent_by", use: "display" },
    { label: "Contact import — Reviewed by", table: "contact_imports", col: "reviewed_by", use: "display" },
    { label: "Change log — name", table: "audit_log", col: "staff_name", use: "display" },
  ];
  return { byId, byName, names };
}

async function countRefs(db: Awaited<ReturnType<typeof getDb>>, src: { id: number; name: string; displayName: string | null }): Promise<RefCount[]> {
  const { byId, byName, names } = await staffRefs(db, src);
  const out: RefCount[] = [];
  for (const r of byId) {
    const [row] = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${r.table} where ${sql.identifier(r.col)} = ${src.id}`));
    out.push({ label: r.label, count: Number(row?.n ?? 0) });
  }
  for (const r of byName) {
    const [row] = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from ${sql.identifier(r.table)} where ${sql.identifier(r.col)} in ${names}`));
    out.push({ label: r.label, count: Number(row?.n ?? 0) });
  }
  return out;
}

const MergeIds = z.object({ sourceId: z.number().int().positive(), targetId: z.number().int().positive() }).refine((v) => v.sourceId !== v.targetId, "Choose two different records");

async function loadPair(db: Awaited<ReturnType<typeof getDb>>, sourceId: number, targetId: number) {
  const [src] = await db.select().from(schema.staff).where(eq(schema.staff.id, sourceId));
  const [dst] = await db.select().from(schema.staff).where(eq(schema.staff.id, targetId));
  return { src, dst };
}

/** What a merge would move — shown before anything changes. */
export async function previewStaffMerge(input: z.input<typeof MergeIds>): Promise<Result<{ refs: RefCount[]; total: number; sourceHasLogin: boolean; targetHasLogin: boolean }>> {
  await requireUser({ can: "users" });
  const parsed = MergeIds.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const db = await getDb();
  const { src, dst } = await loadPair(db, parsed.data.sourceId, parsed.data.targetId);
  if (!src || !dst) return fail("Record not found");
  const refs = await countRefs(db, src);
  return ok({ refs, total: refs.reduce((s, r) => s + r.count, 0), sourceHasLogin: src.access !== "none" && !!src.pinHash, targetHasLogin: dst.access !== "none" && !!dst.pinHash });
}

/**
 * Step 1: copy the sign-in (role + the same PIN hash) to the record being kept. The old record keeps its
 * sign-in for now, so nobody is signed out; the next step happens after signing in as the kept record.
 */
export async function moveSignIn(input: z.input<typeof MergeIds>): Promise<Result<{ name: string }>> {
  const me = await requireUser({ can: "users" });
  const parsed = MergeIds.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const db = await getDb();
  const { src, dst } = await loadPair(db, parsed.data.sourceId, parsed.data.targetId);
  if (!src || !dst) return fail("Record not found");
  if (src.access === "none" || !src.pinHash) return fail(`${src.name} (${src.code}) has no sign-in to move.`);
  if (dst.access !== "none" && dst.pinHash) return fail(`${dst.name} (${dst.code}) already has a sign-in.`);
  await db
    .update(schema.staff)
    .set({
      access: src.access,
      pinHash: src.pinHash, // the same PIN works — the hash is copied, never the PIN
      displayName: dst.displayName ?? src.displayName,
      role: src.access === "owner" ? "Owner" : dst.role,
      status: "Active",
      failedPins: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.staff.id, dst.id));
  await audit(db, me, "update", "user", dst.id, `sign-in copied from ${src.code} ${src.name} to ${dst.code} ${dst.name} (merge step 1)`);
  revalidatePath("/settings");
  revalidatePath("/staff");
  return ok({ name: dst.name });
}

/**
 * Steps 2–3: move every reference from the duplicate to the kept record, then delete the duplicate — all in
 * one transaction (all or nothing). Refused while signed in as the duplicate, so nobody can lock themselves out.
 */
export async function mergeStaff(input: z.input<typeof MergeIds>): Promise<Result<{ moved: RefCount[]; total: number }>> {
  const me = await requireUser({ can: "users" });
  const parsed = MergeIds.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { sourceId, targetId } = parsed.data;
  if (me.id === sourceId) return fail("You are signed in as the record being removed. Sign out, sign in as the record you are keeping (same PIN), then run this step.");
  const db = await getDb();
  const { src, dst } = await loadPair(db, sourceId, targetId);
  if (!src || !dst) return fail("Record not found");
  const srcLogin = src.access !== "none" && !!src.pinHash;
  if (srcLogin && !(dst.access !== "none" && dst.pinHash)) return fail(`Do step 1 first: move the sign-in to ${dst.name} (${dst.code}).`);
  const { byId, byName, names } = await staffRefs(db, src);
  const dstDisplay = dst.displayName?.trim() || dst.name;
  const moved: RefCount[] = [];
  await db.transaction(async (tx) => {
    for (const r of byId) {
      const res = await tx.execute(sql`update ${r.table} set ${sql.identifier(r.col)} = ${dst.id} where ${sql.identifier(r.col)} = ${src.id}`);
      moved.push({ label: r.label, count: changedOf(res) });
    }
    for (const r of byName) {
      const res = await tx.execute(sql`update ${sql.identifier(r.table)} set ${sql.identifier(r.col)} = ${r.use === "name" ? dst.name : dstDisplay} where ${sql.identifier(r.col)} in ${names}`);
      moved.push({ label: r.label, count: changedOf(res) });
    }
    // Keep useful details the kept record lacks
    await tx
      .update(schema.staff)
      .set({ phone: dst.phone ?? src.phone, joinDate: dst.joinDate ?? src.joinDate, updatedAt: new Date() })
      .where(eq(schema.staff.id, dst.id));
    await tx.delete(schema.staff).where(eq(schema.staff.id, src.id));
  });
  const total = moved.reduce((s, r) => s + r.count, 0);
  await audit(db, me, "delete", "staff", src.id, `merged ${src.code} ${src.name} into ${dst.code} ${dst.name} — ${total} reference(s) moved`);
  revalidatePath("/", "layout");
  return ok({ moved: moved.filter((m) => m.count > 0), total });
}
