"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fabricsCombo } from "@/lib/db/ext";
import { features } from "@/lib/db/features";
import { audit } from "@/lib/audit";
import { getSetting, saveSetting } from "@/lib/settings";
import { BUCKETS, SUITABLE } from "@/lib/combo";
import { fail, ok, zodError, type Result } from "./util";

const Controls = z.object({ enabled: z.boolean(), preferSlow: z.boolean() });

/** Settings → Combinations: on / off for customers, and "prefer slow-moving stock". Partners only. */
export async function saveComboControls(input: z.input<typeof Controls>): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  const parsed = Controls.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  await saveSetting("combo", { ...(await getSetting("combo")), ...parsed.data });
  await audit(await getDb(), user, "update", "settings", "combo", `Combinations for customers ${parsed.data.enabled ? "ON" : "OFF"} · prefer slow-moving stock ${parsed.data.preferSlow ? "ON" : "OFF"}`);
  revalidatePath("/settings/combos");
  return ok(null);
}

const FabricCombo = z.object({
  id: z.number().int().positive(),
  suitableFor: z.enum(SUITABLE),
  /** null = use the automatic bucket from the colour */
  colourBucket: z.enum(BUCKETS).nullable(),
});

/** The owner's corrections for one fabric. The automatic bucket never overwrites a choice made here. Partners only. */
export async function saveFabricCombo(input: z.input<typeof FabricCombo>): Promise<Result<null>> {
  const user = await requireUser({ can: "prices" });
  if (!(await features()).combo) return fail("Available after the next database update");
  const parsed = FabricCombo.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, suitableFor, colourBucket } = parsed.data;
  const db = await getDb();
  const done = await db.update(fabricsCombo).set({ suitableFor, colourBucket }).where(eq(fabricsCombo.id, id)).returning({ id: fabricsCombo.id });
  if (!done.length) return fail("Fabric not found");
  await audit(db, user, "update", "fabric", String(id), `Combinations: ${suitableFor} · colour ${colourBucket ?? "automatic"}`);
  revalidatePath("/settings/combos");
  revalidatePath(`/fabrics/${id}`);
  return ok(null);
}
