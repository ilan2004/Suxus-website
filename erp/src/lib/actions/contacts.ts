"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo } from "@/lib/numbering";
import { normalizeContactPhone } from "@/lib/contact-parse";
import { fail, ok, zodError, type Result } from "./util";

const Upload = z.object({
  source: z.string().max(200),
  contacts: z.array(z.object({ name: z.string().max(200), raw: z.string().max(100) })).max(1000),
});

/**
 * Adds a batch of parsed contacts to the saved list (the browser sends up to 1,000 at a time).
 * Numbers already in the list keep their Added / Skipped state — re-uploading the same file is harmless.
 */
export async function uploadContacts(input: z.input<typeof Upload>): Promise<Result<{ added: number; alreadyInList: number; unreadable: number }>> {
  const user = await requireUser();
  const parsed = Upload.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { source, contacts } = parsed.data;
  const db = await getDb();
  const t = schema.contactImports;

  const good = new Map<string, { name: string; phone: string; rawPhone: string }>();
  const bad: { name: string; rawPhone: string }[] = [];
  for (const c of contacts) {
    const name = c.name.trim().replace(/\s+/g, " ") || c.raw.trim();
    if (!name && !c.raw.trim()) continue;
    const phone = normalizeContactPhone(c.raw);
    if (phone) {
      if (!good.has(phone)) good.set(phone, { name, phone, rawPhone: c.raw.trim() });
    } else bad.push({ name, rawPhone: c.raw.trim() });
  }

  let added = 0;
  const rows = [...good.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const ins = await db
      .insert(t)
      .values(rows.slice(i, i + 500).map((r) => ({ ...r, source })))
      .onConflictDoNothing({ target: t.phone })
      .returning({ id: t.id });
    added += ins.length;
  }
  // Unreadable numbers: keep one row per name + number so they show under "Could not read"
  let unreadable = 0;
  if (bad.length) {
    const existing = await db.select({ name: t.name, rawPhone: t.rawPhone }).from(t).where(isNull(t.phone));
    const seen = new Set(existing.map((e) => `${e.name}|${e.rawPhone ?? ""}`));
    const fresh = bad.filter((b) => {
      const k = `${b.name}|${b.rawPhone}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (fresh.length) await db.insert(t).values(fresh.map((b) => ({ ...b, phone: null, status: "invalid", source })));
    unreadable = bad.length;
  }
  if (added) await audit(db, user, "create", "contact_import", null, `${source}: ${added} new contacts`);
  revalidatePath("/customers/import");
  return ok({ added, alreadyInList: rows.length - added, unreadable });
}

const Ids = z.array(z.number().int().positive()).min(1).max(5000);

/** Customers whose number (last 10 digits) is one of these phones → phone → customer id. */
async function customersByPhone(db: Awaited<ReturnType<typeof getDb>>, phones: string[]) {
  if (!phones.length) return new Map<string, number>();
  const c = schema.customers;
  const last10 = sql<string>`right(regexp_replace(coalesce(${c.phone}, ''), '[^0-9]', '', 'g'), 10)`;
  const rows = await db.select({ id: c.id, p: last10 }).from(c).where(inArray(last10, phones));
  return new Map(rows.map((r) => [r.p, r.id]));
}

/** "Add selected": one customer per contact (name + phone only). Numbers that are already customers are just marked Added. */
export async function addContactsAsCustomers(ids: number[]): Promise<Result<{ added: number; alreadyPresent: number }>> {
  const user = await requireUser();
  const parsed = Ids.safeParse(ids);
  if (!parsed.success) return fail("Select at least one contact");
  const db = await getDb();
  const t = schema.contactImports;
  const picked = await db.select().from(t).where(and(inArray(t.id, parsed.data), inArray(t.status, ["pending", "skipped"])));
  const existing = await customersByPhone(db, picked.map((p) => p.phone!).filter(Boolean));
  let added = 0;
  let alreadyPresent = 0;
  await db.transaction(async (tx) => {
    for (const p of picked) {
      if (!p.phone) continue;
      let customerId = existing.get(p.phone);
      if (customerId) alreadyPresent++;
      else {
        const code = await nextDocNo(tx, "C");
        const [row] = await tx.insert(schema.customers).values({ code, name: p.name, phone: p.phone }).returning({ id: schema.customers.id });
        customerId = row.id;
        existing.set(p.phone, customerId);
        added++;
      }
      await tx.update(t).set({ status: "added", customerId, reviewedBy: user.name, updatedAt: new Date() }).where(eq(t.id, p.id));
    }
    await audit(tx, user, "create", "customer", null, `contact import: ${added} added, ${alreadyPresent} already present`);
  });
  revalidatePath("/customers");
  revalidatePath("/customers/import");
  return ok({ added, alreadyPresent });
}

/** Skip / move back to "Not yet reviewed". Added contacts stay added (their customer exists). */
export async function setContactStatus(ids: number[], status: "skipped" | "pending"): Promise<Result<{ changed: number }>> {
  const user = await requireUser();
  const parsed = Ids.safeParse(ids);
  if (!parsed.success) return fail("Select at least one contact");
  const db = await getDb();
  const t = schema.contactImports;
  const from = status === "skipped" ? "pending" : "skipped";
  const rows = await db
    .update(t)
    .set({ status, reviewedBy: user.name, updatedAt: new Date() })
    .where(and(inArray(t.id, parsed.data), eq(t.status, from)))
    .returning({ id: t.id });
  revalidatePath("/customers/import");
  return ok({ changed: rows.length });
}

/** Forget the whole uploaded list (customers already created are kept). */
export async function clearContactList(): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.contactImports);
  await audit(db, user, "delete", "contact_import", null, "cleared list");
  revalidatePath("/customers/import");
  return ok(null);
}
