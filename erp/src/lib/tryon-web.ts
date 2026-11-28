import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * Website lock for the try-on (Settings > Try-on > Website).
 * - The shop QR carries ?s=<shopKey>; opening it marks the phone as "in the shop" for 12 hours (signed cookie).
 * - Everyone else is a website visitor: a few try-ons per phone in total and a daily cap for the whole website,
 *   kept apart from the shop's own daily limit.
 * - More from the website only with a WhatsApp code: the shop makes it in Settings and sends it; each code has a
 *   few try-ons and lasts 7 days.
 */

export const SHOP_COOKIE = "suxus_tryon_shop";
const SHOP_HOURS = 12;
const secret = () => process.env.ERP_SECRET || "suxus-dev-secret-change-me";
const sign = (s: string) => crypto.createHmac("sha256", secret()).update(s).digest("base64url").slice(0, 24);

export const newShopKey = () => crypto.randomBytes(6).toString("base64url");

/** Cookie value for a phone that opened the shop QR: tied to the current key, so "New shop QR" ends it at once. */
export function shopCookieFor(shopKey: string) {
  const exp = Date.now() + SHOP_HOURS * 3600 * 1000;
  return { value: `${exp}.${sign(`shop:${shopKey}:${exp}`)}`, maxAge: SHOP_HOURS * 3600 };
}
export function isShopCookie(value: string | undefined, shopKey: string) {
  if (!value || !shopKey) return false;
  const [exp, sig] = value.split(".");
  return Number(exp) > Date.now() && sig === sign(`shop:${shopKey}:${exp}`);
}
export const keyMatches = (given: string | null | undefined, shopKey: string) =>
  !!given && !!shopKey && given.length === shopKey.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(shopKey));

/* ───────────────────────── WhatsApp codes ───────────────────────── */

export type TryonCode = { code: string; tries: number; used: number; created: number; exp: number; note: string; by: string };
const CODES_KEY = "tryon_codes";
const CODE_DAYS = 7;

async function readCodes(): Promise<TryonCode[]> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, CODES_KEY));
  return (Array.isArray(row?.value) ? row.value : []) as TryonCode[];
}
async function writeCodes(list: TryonCode[]) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key: CODES_KEY, value: list }).onConflictDoUpdate({ target: schema.settings.key, set: { value: list } });
}

/** Codes still usable (not expired, tries left), newest first, plus the last few used up / expired for reference. */
export async function listCodes() {
  const now = Date.now();
  const all = (await readCodes()).sort((a, b) => b.created - a.created);
  return { active: all.filter((c) => c.exp > now && c.used < c.tries), done: all.filter((c) => c.exp <= now || c.used >= c.tries).slice(0, 10) };
}

/** A new 6-digit code (unique among the codes kept). Old codes are kept 30 days for the record, then dropped. */
export async function createCode(tries: number, note: string, by: string): Promise<TryonCode> {
  const now = Date.now();
  const list = (await readCodes()).filter((c) => c.created > now - 30 * 24 * 3600 * 1000);
  let code = "";
  do code = String(crypto.randomInt(100000, 1000000));
  while (list.some((c) => c.code === code));
  const c: TryonCode = { code, tries, used: 0, created: now, exp: now + CODE_DAYS * 24 * 3600 * 1000, note: note.slice(0, 80), by };
  await writeCodes([...list, c].slice(-300));
  return c;
}

export const cleanCode = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "").slice(0, 6) : "");

/** Try-ons left on a code (0 = unknown, expired or used up). */
export async function codeLeft(code: string): Promise<number> {
  if (!/^\d{6}$/.test(code)) return 0;
  const c = (await readCodes()).find((x) => x.code === code);
  return c && c.exp > Date.now() ? Math.max(0, c.tries - c.used) : 0;
}

/** One successful try-on made with the code. */
export async function useCode(code: string) {
  const list = await readCodes();
  const c = list.find((x) => x.code === code);
  if (!c) return;
  c.used += 1;
  await writeCodes(list);
}

/** Stop a code now (e.g. sent to the wrong number). */
export async function cancelCode(code: string) {
  const list = await readCodes();
  const c = list.find((x) => x.code === code);
  if (c) c.exp = Date.now();
  await writeCodes(list);
}
