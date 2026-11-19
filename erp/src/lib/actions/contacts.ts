"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo } from "@/lib/numbering";
import { normalizeContactPhone } from "@/lib/contact-parse";
import { fail, ok, zodError, type Result } from "./util";

const Upload = z.object({
  source: z.string().max(200),
  contacts: z.array(z.object({ name: z.string().max(200), raw: z.string().max(100), raw2: z.string().max(100).optional() })).max(1000),
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

  const good = new Map<string, { name: string; phone: string; phone2: string | null; rawPhone: string }>();
  const bad: { name: string; rawPhone: string }[] = [];
  for (const c of contacts) {
    const name = c.name.trim().replace(/\s+/g, " ") || c.raw.trim();
    if (!name && !c.raw.trim()) continue;
    let phone = normalizeContactPhone(c.raw);
    let phone2 = normalizeContactPhone(c.raw2);
    if (!phone && phone2) [phone, phone2] = [phone2, null]; // first number unreadable, second fine → use the second
    if (phone2 === phone) phone2 = null;
    if (phone) {
      if (!good.has(phone)) good.set(phone, { name, phone, phone2, rawPhone: [c.raw.trim(), c.raw2?.trim()].filter(Boolean).join(" / ") });
    } else bad.push({ name, rawPhone: [c.raw.trim(), c.raw2?.trim()].filter(Boolean).join(" / ") });
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

/** Customers whose main or second number is one of these (international) numbers → number → customer id. */
async function customersByPhone(db: Awaited<ReturnType<typeof getDb>>, phones: string[]) {
  const map = new Map<string, number>();
  if (!phones.length) return map;
  const c = schema.customers;
  const rows = await db.select({ id: c.id, phone: c.phone, alt: c.altPhone }).from(c).where(or(inArray(c.phone, phones), inArray(c.altPhone, phones)));
  for (const r of rows) for (const p of [r.phone, r.alt]) if (p && !map.has(p)) map.set(p, r.id);
  return map;
}

/** "Add selected": one customer per contact (name + phone only). Numbers that are already customers are just marked Added. */
export async function addContactsAsCustomers(ids: number[]): Promise<Result<{ added: number; alreadyPresent: number }>> {
  const user = await requireUser();
  const parsed = Ids.safeParse(ids);
  if (!parsed.success) return fail("Select at least one contact");
  const db = await getDb();
  const t = schema.contactImports;
  const picked = await db.select().from(t).where(and(inArray(t.id, parsed.data), inArray(t.status, ["pending", "skipped"])));
  const existing = await customersByPhone(db, picked.flatMap((p) => [p.phone, p.phone2]).filter((x): x is string => !!x));
  let added = 0;
  let alreadyPresent = 0;
  await db.transaction(async (tx) => {
    for (const p of picked) {
      if (!p.phone) continue;
      let customerId = existing.get(p.phone) ?? (p.phone2 ? existing.get(p.phone2) : undefined);
      if (customerId) alreadyPresent++;
      else {
        const code = await nextDocNo(tx, "C");
        const [row] = await tx.insert(schema.customers).values({ code, name: p.name, phone: p.phone, altPhone: p.phone2 }).returning({ id: schema.customers.id });
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
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  await db.delete(schema.contactImports);
  await audit(db, user, "delete", "contact_import", null, "cleared list");
  revalidatePath("/customers/import");
  return ok(null);
}
