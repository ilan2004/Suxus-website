import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { toIntlPhone } from "@/lib/phone";
import { ipHash, todayStartIST, tryonFabrics } from "@/lib/tryon";
import { PANT_KEYS, RANGE, SHIRT_KEYS, shirtKeysFor, toInches, type Unit } from "@/lib/web-order";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

/** Orders per network address per day (a family may order twice; a script cannot flood the list). */
const PER_IP_PER_DAY = 5;

const num = z.number().finite().positive();
const Shirt = z.object({
  garment: z.literal("Shirt"),
  fabricCode: z.string().trim().min(1).max(40),
  qty: z.number().int().min(1).max(10),
  sleeve: z.enum(["full", "half"]),
  pocket: z.enum(["none", "one", "two"]),
  m: z.partialRecord(z.enum(SHIRT_KEYS), num),
});
const Pant = z.object({
  garment: z.literal("Pant"),
  fabricCode: z.string().trim().min(1).max(40),
  qty: z.number().int().min(1).max(10),
  model: z.enum(["Regular", "Loose"]),
  m: z.partialRecord(z.enum(PANT_KEYS), num),
});
const Order = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(16),
  address: z.string().trim().min(10).max(400),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  note: z.string().trim().max(400).optional(),
  unit: z.enum(["in", "cm"]),
  items: z.array(z.discriminatedUnion("garment", [Shirt, Pant])).min(1).max(6),
  /** honeypot — a hidden field people never fill */
  website: z.string().max(0).optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** An order from suxus.shop/order. Checked here: fabrics in stock, every needed figure given and in range. */
export async function POST(req: Request) {
  if (!(await features()).webOrders) return json({ ok: false, error: "unavailable" }, 503);
  const parsed = Order.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "invalid", detail: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")) }, 400);
  const o = parsed.data;
  const phone = toIntlPhone(o.phone);
  if (!phone) return json({ ok: false, error: "phone" }, 400);
  const unit = o.unit as Unit;

  // fabrics: in stock now, shirting for a shirt and suiting for a pant
  const stock = new Map((await tryonFabrics()).map((f) => [f.code, f]));
  for (const [i, it] of o.items.entries()) {
    const f = stock.get(it.fabricCode);
    if (!f || (it.garment === "Pant") !== f.forPant) return json({ ok: false, error: "fabric", item: i }, 400);
    const need = it.garment === "Shirt" ? shirtKeysFor(it.sleeve) : [...PANT_KEYS];
    for (const k of need) {
      const v = (it.m as Record<string, number | undefined>)[k];
      if (v == null) return json({ ok: false, error: "missing", item: i, field: k }, 400);
      const [lo, hi] = RANGE[k];
      const inch = toInches(v, unit);
      if (inch < lo || inch > hi) return json({ ok: false, error: "range", item: i, field: k }, 400);
    }
  }

  const h = await headers();
  const ip = ipHash((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null);
  const db = await getDb();
  if (ip) {
    const [n] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.webOrders)
      .where(and(eq(schema.webOrders.ip, ip), gte(schema.webOrders.createdAt, todayStartIST())));
    if (n.n >= PER_IP_PER_DAY) return json({ ok: false, error: "limit" }, 429);
  }
  // keep only the figures that belong to the chosen sleeve
  const items = o.items.map((it) => (it.garment === "Shirt" ? { ...it, m: Object.fromEntries(shirtKeysFor(it.sleeve).map((k) => [k, it.m[k]])) } : it));
  const [row] = await db
    .insert(schema.webOrders)
    .values({ name: o.name, phone, address: o.address, pincode: o.pincode, note: o.note || null, unit, items, ip })
    .returning({ id: schema.webOrders.id });
  console.log(`[web-order] new #${row.id} items=${items.map((i) => `${i.garment}:${i.fabricCode}x${i.qty}`).join(",")}`);
  return json({ ok: true, id: row.id });
}
