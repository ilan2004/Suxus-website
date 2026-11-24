import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "./db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * The customer's "Self" wearer — created the first time it is needed (customers added by import, contacts or the
 * customer form all get one this way, so no path can miss it).
 */
export async function selfWearerId(db: AnyDb, customerId: number): Promise<number> {
  const find = async () =>
    (await db.select({ id: schema.wearers.id }).from(schema.wearers).where(and(eq(schema.wearers.customerId, customerId), eq(schema.wearers.isSelf, true))))[0]?.id as number | undefined;
  const found = await find();
  if (found) return found;
  const [row] = await db
    .insert(schema.wearers)
    .values({ customerId, name: "Self", relation: "Self", isSelf: true })
    .onConflictDoNothing()
    .returning({ id: schema.wearers.id });
  return row?.id ?? (await find())!;
}

/** A wearer id is only accepted when it belongs to that customer; otherwise (or when empty) → the Self wearer. */
export async function wearerFor(db: AnyDb, customerId: number, wearerId: number | null | undefined): Promise<number> {
  if (wearerId) {
    const [w] = await db
      .select({ id: schema.wearers.id })
      .from(schema.wearers)
      .where(and(eq(schema.wearers.id, wearerId), eq(schema.wearers.customerId, customerId)));
    if (w) return w.id;
  }
  return selfWearerId(db, customerId);
}
