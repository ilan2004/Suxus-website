"use server";

import { requireUser } from "@/lib/auth";
import { latestMeasurements } from "@/lib/order-fabric";
import type { ReqMeasure } from "@/lib/fabric-requirement";

/** For the order form: the customer's latest measurement per person and garment (to estimate fabric before cutting). */
export async function measurementsForRequirement(customerId: number): Promise<{ measures: ReqMeasure[]; selfId: number | null }> {
  await requireUser();
  if (!customerId) return { measures: [], selfId: null };
  return latestMeasurements(customerId);
}
