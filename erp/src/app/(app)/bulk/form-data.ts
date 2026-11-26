import "server-only";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { staffOptions } from "@/lib/queries";
import { features } from "@/lib/db/features";
import { loadPrices } from "@/lib/actions/prices";

export async function loadBulkFormData() {
  const db = await getDb();
  const [staff, lists, past, feat, variants, prices] = await Promise.all([
    staffOptions(),
    getSetting("lists"),
    db
      .selectDistinctOn([schema.bulkOrders.institution], {
        institution: schema.bulkOrders.institution,
        contactPerson: schema.bulkOrders.contactPerson,
        phone: schema.bulkOrders.phone,
        address: schema.bulkOrders.address,
        gstin: schema.bulkOrders.gstin,
      })
      .from(schema.bulkOrders)
      .orderBy(schema.bulkOrders.institution, desc(schema.bulkOrders.id)),
    features(),
    getSetting("variants"),
    loadPrices(),
  ]);
  return {
    staff: staff.map((s) => ({ id: s.id, name: s.name })),
    lists: { item: lists.item, status: lists.status, paymentMode: lists.paymentMode },
    institutions: past,
    // Stitching price list (bulk / institution rate first) and the variants it is matched by — null before that update
    prices: feat.prices ? { list: prices, variants } : null,
  };
}
