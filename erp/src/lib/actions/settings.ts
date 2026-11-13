"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { saveSetting, type AppSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, zodError, type Result } from "./util";

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
} satisfies Record<keyof AppSettings, z.ZodType>;

export async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const parsed = schemas[key].safeParse(value);
  if (!parsed.success) return fail(zodError(parsed.error));
  await saveSetting(key, parsed.data as AppSettings[K]);
  await audit(await getDb(), user, "update", "settings", key);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function importExcelAction(form: FormData): Promise<Result<Record<string, string>>> {
  const user = await requireUser({ partner: true });
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return fail("Choose the .xlsx file");
  if (file.size > 15 * 1024 * 1024) return fail("File is too large (max 15 MB)");
  try {
    const { importWorkbook } = await import("@/lib/import-xlsx");
    const report = await importWorkbook(await file.arrayBuffer());
    await audit(await getDb(), user, "create", "import", null, file.name);
    revalidatePath("/", "layout");
    return ok(report);
  } catch (e) {
    return fail(`Import failed: ${(e as Error).message}`);
  }
}
