"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { saveSetting, type AppSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, zodError, type Result } from "./util";

/** One band row: above the previous row's limit, up to `upTo` inches (null = no limit) */
const band = z.object({
  width: z.coerce.number<number>().positive(),
  upTo: z.coerce.number<number>().positive().nullable(),
  full: z.coerce.number<number>().positive().max(20),
  half: z.coerce.number<number>().positive().max(20),
});

const schemas = {
  lists: z.record(z.string(), z.array(z.string().trim().min(1))),
  shop: z.object({
    name: z.string().min(1),
    tagline: z.string(),
    services: z.string(),
    address1: z.string(),
    address2: z.string(),
    phone: z.string(),
    email: z.string(),
    gstin: z.string(),
    footer: z.string(),
    billTerms: z.string(),
    invoiceTerms: z.string(),
    normalDays: z.coerce.number<number>().int().min(0),
    expressDays: z.coerce.number<number>().int().min(0),
    lowStockMtr: z.coerce.number<number>().min(0),
  }),
  compositions: z.array(z.object({ name: z.string().trim().min(1), prefix: z.string().trim().min(1).max(6).toUpperCase() })),
  pieceRates: z.record(z.string(), z.coerce.number<number>().min(0)),
  slabs: z.array(z.object({ from: z.coerce.number<number>(), to: z.coerce.number<number>(), rate: z.coerce.number<number>().min(0).max(1) })),
  sizeChart: z.object({
    sizes: z.array(z.string()),
    rows: z.array(z.object({ label: z.string(), values: z.array(z.coerce.number<number>()) })),
  }),
  measureOrder: z.record(z.string(), z.array(z.string())),
  measureOptions: z.object({ autoAdvance: z.boolean() }),
  fabricRequirement: z.object({
    shirtChest: z.array(band).min(1, "Shirt chest table needs at least one row"),
    shirtLength: z.array(band).min(1, "Shirt length table needs at least one row"),
    pant: z.array(z.object({ width: z.coerce.number<number>().positive(), model: z.enum(["Regular", "Loose"]), metres: z.coerce.number<number>().positive().max(20) })),
  }),
  variants: z.record(z.string(), z.array(z.string().trim().min(1)).max(20)),
  tryon: z.object({
    enabled: z.boolean(),
    perDevice: z.union([z.literal(1), z.literal(2)]),
    shopPerDay: z.coerce.number<number>().int().min(0).max(10000),
    monthlyCapInr: z.coerce.number<number>().min(0).max(10_000_000),
    displayToken: z.string(),
    styles: z.boolean(),
  }),
  combo: z.object({ enabled: z.boolean(), preferSlow: z.boolean() }),
} satisfies Record<keyof AppSettings, z.ZodType>;

export async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<Result<null>> {
  const user = await requireUser({ can: "settings" });
  const parsed = schemas[key].safeParse(value);
  if (!parsed.success) return fail(zodError(parsed.error));
  await saveSetting(key, parsed.data as AppSettings[K]);
  await audit(await getDb(), user, "update", "settings", key);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function importExcelAction(form: FormData): Promise<Result<Record<string, string>>> {
  const user = await requireUser({ can: "settings" });
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return fail("Choose the .xlsx file");
  if (file.size > 15 * 1024 * 1024) return fail("File is too large (max 15 MB)");
  try {
    const { importWorkbook } = await import("@/lib/import-xlsx");
    const mode = form.get("mode") === "merge" ? "merge" : "first";
    const report = await importWorkbook(await file.arrayBuffer(), mode);
    await audit(await getDb(), user, "create", "import", null, `${file.name} (${mode})`);
    revalidatePath("/", "layout");
    return ok(report);
  } catch (e) {
    return fail(`Import failed: ${(e as Error).message}`);
  }
}
