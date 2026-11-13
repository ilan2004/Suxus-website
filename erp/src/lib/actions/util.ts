import "server-only";
import { z } from "zod";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string): Result<never> => ({ ok: false, error });

export function zodError(e: z.ZodError) {
  const i = e.issues[0];
  return `${i.path.join(".") || "Form"}: ${i.message}`;
}

export const optText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null))
  .transform((v) => v || null);
export const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
export const money = z.coerce.number<number>().min(0).default(0);
export const optId = z.coerce.number<number>().int().positive().optional().nullable();
