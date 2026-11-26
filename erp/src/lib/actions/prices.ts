"use server";

import { revalidatePath } from "next/cache";
import { asc, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { audit } from "@/lib/audit";
import type { PriceRow } from "@/lib/stitching-prices";
import { fail, ok, zodError, type Result } from "./util";

/** The price list (active and inactive). Empty before the database update. Readable by anyone signed in (forms fill from it). */
export async function loadPrices(): Promise<PriceRow[]> {
  await requireUser();
  if (!(await features()).prices) return [];
  const db = await getDb();
  return db
    .select({ garment: schema.stitchingPrices.garment, variant: schema.stitchingPrices.variant, customerRate: schema.stitchingPrices.customerRate, bulkRate: schema.stitchingPrices.bulkRate, active: schema.stitchingPrices.active })
    .from(schema.stitchingPrices)
    .orderBy(asc(schema.stitchingPrices.garment), asc(schema.stitchingPrices.variant));
}

const rate = z.union([z.null(), z.coerce.number<number>().min(0).max(1_000_000)]);
const Rows = z.array(z.object({ garment: z.string().trim().min(1), variant: z.string().trim(), customerRate: rate, bulkRate: rate, active: z.boolean() })).max(2000);

/** Settings → Stitching Prices: save the whole list. Partners only. Existing orders and bills are never touched. */
export async function saveStitchingPrices(rows: z.input<typeof Rows>): Promise<Result<{ changed: number }>> {
  const user = await requireUser({ can: "prices" });
  if (!(await features()).prices) return fail("Stitching prices are not available yet (database update pending)");
  const parsed = Rows.safeParse(rows);
  if (!parsed.success) return fail(zodError(parsed.error));
  const db = await getDb();
  const before = await loadPrices();
  const key = (r: { garment: string; variant: string }) => `${r.garment}|${r.variant}`;
  const old = new Map(before.map((r) => [key(r), r]));
  const changed = parsed.data.filter((r) => {
    const o = old.get(key(r));
    // a row never set and left empty is not stored
    if (!o) return r.customerRate != null || r.bulkRate != null || !r.active;
    return o.customerRate !== r.customerRate || o.bulkRate !== r.bulkRate || o.active !== r.active;
  });
  if (!changed.length) return ok({ changed: 0 });
  await db.transaction(async (tx) => {
    for (const r of changed) {
      await tx
        .insert(schema.stitchingPrices)
        .values({ ...r, updatedBy: user.name })
        .onConflictDoUpdate({
          target: [schema.stitchingPrices.garment, schema.stitchingPrices.variant],
          set: { customerRate: r.customerRate, bulkRate: r.bulkRate, active: r.active, updatedBy: user.name, updatedAt: sql`now()` },
        });
    }
    const fmt = (v: number | null | undefined) => (v == null ? "—" : `₹${v}`);
    await audit(
      tx,
      user,
      "update",
      "stitching-prices",
      null,
      changed
        .map((r) => {
          const o = old.get(key(r));
          return `${r.garment}${r.variant ? ` (${r.variant})` : ""}: ${fmt(o?.customerRate)} → ${fmt(r.customerRate)}${(o?.bulkRate ?? null) !== r.bulkRate ? `, bulk ${fmt(o?.bulkRate)} → ${fmt(r.bulkRate)}` : ""}${r.active ? "" : " (inactive)"}`;
        })
        .join("; ")
        .slice(0, 1500),
    );
  });
  revalidatePath("/settings/stitching-prices");
  return ok({ changed: changed.length });
}
