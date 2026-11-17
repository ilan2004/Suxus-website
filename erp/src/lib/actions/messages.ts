"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { MAX_MESSAGE_LENGTH, TEMPLATE_CATEGORIES } from "@/lib/message-template";
import { PHONE_HELP, toIntlPhone } from "@/lib/phone";
import { fail, ok, optId, zodError, type Result } from "./util";

export type MessageTemplate = { id: number; name: string; category: string; body: string; sortOrder: number; useCount: number };

/** Templates for the WhatsApp picker (most used first) plus shop details for {shop} and {phone}. */
export async function listTemplatesForPicker(): Promise<Result<{ templates: MessageTemplate[]; shop: string; shopPhone: string }>> {
  await requireUser();
  const db = await getDb();
  const t = schema.messageTemplates;
  const [rows, shop] = await Promise.all([
    db
      .select({ id: t.id, name: t.name, category: t.category, body: t.body, sortOrder: t.sortOrder, useCount: t.useCount })
      .from(t)
      .orderBy(desc(t.useCount), asc(t.sortOrder), asc(t.id)),
    getSetting("shop"),
  ]);
  return ok({ templates: rows, shop: [shop.name, shop.tagline].filter(Boolean).join(" "), shopPhone: (shop.phone ?? "").split("|")[0].trim() });
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  await requireUser({ partner: true });
  const db = await getDb();
  const t = schema.messageTemplates;
  return db
    .select({ id: t.id, name: t.name, category: t.category, body: t.body, sortOrder: t.sortOrder, useCount: t.useCount })
    .from(t)
    .orderBy(asc(t.sortOrder), asc(t.id));
}

const TemplateInput = z.object({
  id: optId,
  name: z.string().trim().min(1, "Give the template a short name").max(60),
  category: z.enum(TEMPLATE_CATEGORIES),
  body: z.string().trim().min(1, "Write the message").max(MAX_MESSAGE_LENGTH, `Keep the message under ${MAX_MESSAGE_LENGTH} characters`),
});
export type TemplateInput = z.input<typeof TemplateInput>;

export async function saveTemplate(input: TemplateInput): Promise<Result<{ id: number }>> {
  const user = await requireUser({ partner: true });
  const parsed = TemplateInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  const t = schema.messageTemplates;
  let rowId: number;
  if (id) {
    await db.update(t).set({ ...d, updatedAt: new Date() }).where(eq(t.id, id));
    rowId = id;
  } else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${t.sortOrder}), 0)`.mapWith(Number) }).from(t);
    const [row] = await db.insert(t).values({ ...d, sortOrder: max + 1 }).returning({ id: t.id });
    rowId = row.id;
  }
  await audit(db, user, id ? "update" : "create", "message_template", rowId, d.name);
  revalidatePath("/settings");
  return ok({ id: rowId });
}

export async function duplicateTemplate(id: number): Promise<Result<{ id: number }>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const t = schema.messageTemplates;
  const [src] = await db.select().from(t).where(eq(t.id, id));
  if (!src) return fail("Template not found");
  // Put the copy right below the original
  await db.update(t).set({ sortOrder: sql`${t.sortOrder} + 1` }).where(sql`${t.sortOrder} > ${src.sortOrder}`);
  const [row] = await db.insert(t).values({ name: `${src.name} (copy)`.slice(0, 60), category: src.category, body: src.body, sortOrder: src.sortOrder + 1 }).returning({ id: t.id });
  await audit(db, user, "create", "message_template", row.id, `copy of ${src.name}`);
  revalidatePath("/settings");
  return ok({ id: row.id });
}

export async function deleteTemplate(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const [row] = await db.delete(schema.messageTemplates).where(eq(schema.messageTemplates.id, id)).returning();
  await audit(db, user, "delete", "message_template", id, row?.name);
  revalidatePath("/settings");
  return ok(null);
}

/** Saves the order after drag/arrow reordering: ids in their new order. */
export async function reorderTemplates(ids: number[]): Promise<Result<null>> {
  await requireUser({ partner: true });
  if (!ids.every((n) => Number.isInteger(n))) return fail("Bad order");
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(schema.messageTemplates).set({ sortOrder: i + 1 }).where(eq(schema.messageTemplates.id, id));
  });
  revalidatePath("/settings");
  return ok(null);
}

const LogInput = z.object({
  customerId: optId,
  orderId: optId,
  bulkOrderId: optId,
  templateId: optId,
  templateName: z.string().trim().max(80).optional().nullable(),
  phone: z.string(),
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH + 500),
});

/** Called right after wa.me opens — keeps a "Messages sent" history and bumps the template's use count. */
export async function logMessageSent(input: z.input<typeof LogInput>): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = LogInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const phone = toIntlPhone(d.phone);
  if (!phone) return fail(`Phone: ${PHONE_HELP}`);
  const db = await getDb();
  let customerId = d.customerId ?? null;
  if (!customerId && d.orderId) {
    const [o] = await db.select({ c: schema.orders.customerId }).from(schema.orders).where(eq(schema.orders.id, d.orderId));
    customerId = o?.c ?? null;
  }
  if (!customerId) {
    // Walk-in order with no customer record: attach to the customer with the same number (main or second), if any.
    const c = schema.customers;
    const [m] = await db
      .select({ id: c.id })
      .from(c)
      .where(or(eq(c.phone, phone), eq(c.altPhone, phone)))
      .limit(1);
    customerId = m?.id ?? null;
  }
  await db.insert(schema.customerMessages).values({ ...d, customerId, phone, templateName: d.templateName ?? null, sentBy: user.name });
  if (d.templateId) await db.update(schema.messageTemplates).set({ useCount: sql`${schema.messageTemplates.useCount} + 1` }).where(eq(schema.messageTemplates.id, d.templateId));
  if (customerId) revalidatePath(`/customers/${customerId}`);
  return ok(null);
}
