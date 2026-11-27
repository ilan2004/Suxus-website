import "server-only";
import crypto from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getSetting, saveSetting } from "./settings";

/*
 * The shop TV (/tryon/display). A customer's image reaches it ONLY when that customer pressed "Show on the shop TV"
 * on their own phone (on_display) — default off, and "Remove from TV" takes it off again.
 */

/** How long ago a "show" may still be picked up by the TV. */
const FRESH_MINUTES = 10;

/* ───── Pairing a TV with a 6-digit code (no typing of long links with a remote) ───── */

export const TV_COOKIE = "suxus_tv";
const PAIR_KEY = "tryon_tv_pairings";
const PAIR_MINUTES = 15;
const secret = () => process.env.ERP_SECRET || "suxus-dev-secret-change-me";
type Pairing = { code: string; nonce: string; exp: number; approved: boolean };

/** The paired-TV cookie: tied to the current TV secret, so "Make a new link" un-pairs every TV at once. */
const tvCookieFor = (displayToken: string) => `v1.${crypto.createHmac("sha256", secret()).update(`tv:${displayToken}`).digest("base64url")}`;

async function readPairings(): Promise<Pairing[]> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, PAIR_KEY));
  const list = (Array.isArray(row?.value) ? row.value : []) as Pairing[];
  return list.filter((p) => p.exp > Date.now());
}
async function writePairings(list: Pairing[]) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key: PAIR_KEY, value: list }).onConflictDoUpdate({ target: schema.settings.key, set: { value: list } });
}

/** A TV opened /tryon/display without being paired: a fresh 6-digit code (15 minutes) and the secret it polls with. */
export async function startPairing() {
  const list = (await readPairings()).slice(-20);
  let code = "";
  do code = String(crypto.randomInt(100000, 1000000));
  while (list.some((p) => p.code === code));
  const p: Pairing = { code, nonce: crypto.randomBytes(24).toString("base64url"), exp: Date.now() + PAIR_MINUTES * 60_000, approved: false };
  await writePairings([...list, p]);
  return p;
}

/** Settings > Try-on > Pair a TV: the code shown on the TV. */
export async function approvePairing(code: string) {
  const list = await readPairings();
  const p = list.find((x) => x.code === code.replace(/\D/g, "") && !x.approved);
  if (!p) return false;
  p.approved = true;
  await writePairings(list);
  // the TV cookie is tied to the TV secret — make one if there is none yet
  const c = await getSetting("tryon");
  if (!c.displayToken) await saveSetting("tryon", { ...c, displayToken: newDisplayToken() });
  return true;
}

/** The TV asks whether its code was entered: once approved, it gets its cookie (and the code is used up). */
export async function claimPairing(nonce: string): Promise<"wait" | "expired" | { cookie: string }> {
  const list = await readPairings();
  const p = list.find((x) => x.nonce === nonce);
  if (!p) return "expired";
  if (!p.approved) return "wait";
  await writePairings(list.filter((x) => x !== p));
  return { cookie: tvCookieFor((await getSetting("tryon")).displayToken) };
}

/** The TV may read: a paired TV (cookie), a signed-in staff member, or the secret link set in Settings > Try-on. */
export async function tvAllowed(key: string | null | undefined) {
  const c = await getSetting("tryon");
  if (key && c.displayToken.length >= 32 && key.length === c.displayToken.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(c.displayToken))) return true;
  try {
    const { cookies } = await import("next/headers");
    const got = (await cookies()).get(TV_COOKIE)?.value;
    const want = c.displayToken ? tvCookieFor(c.displayToken) : null;
    if (got && want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return true;
  } catch {
    /* not in a request */
  }
  try {
    const { getSession } = await import("./auth");
    return !!(await getSession());
  } catch {
    return false;
  }
}

/** The customer's own choice for one of THEIR results. */
export async function setOnDisplay(device: string, resultId: string, show: boolean) {
  const db = await getDb();
  const rows = await db
    .update(schema.tryonGenerations)
    .set({ onDisplay: show, displayAt: show ? new Date() : null })
    .where(and(eq(schema.tryonGenerations.resultId, resultId), eq(schema.tryonGenerations.device, device), eq(schema.tryonGenerations.ok, true)))
    .returning({ id: schema.tryonGenerations.id });
  return rows.length > 0;
}

/** Recently shown results (newest first) — only ones the customer chose to show, whose image still exists. */
export async function tvFeed() {
  const db = await getDb();
  const g = schema.tryonGenerations;
  const rows = await db
    .select({ id: g.id, at: g.displayAt, variant: g.variant, code: schema.fabrics.code, brand: schema.fabrics.brand, shade: schema.fabrics.shade, rate: schema.fabrics.saleRate })
    .from(g)
    .leftJoin(schema.fabrics, eq(schema.fabrics.id, g.fabricId))
    .where(
      and(
        eq(g.onDisplay, true),
        gte(g.displayAt, new Date(Date.now() - FRESH_MINUTES * 60_000)),
        sql`exists (select 1 from ${schema.tryonImages} where ${schema.tryonImages.id} = ${g.resultId})`,
      ),
    )
    .orderBy(desc(g.displayAt))
    .limit(5);
  return rows.map((r) => ({ id: r.id, at: r.at ? new Date(r.at).getTime() : 0, code: r.code ?? "", name: [r.brand, r.shade].filter(Boolean).join(" · "), variant: r.variant, rate: r.rate ?? 0 }));
}

/** The image of a shown result — refused when the customer has not chosen (or has removed) it. */
export async function tvImage(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ mime: schema.tryonImages.mime, data: schema.tryonImages.data })
    .from(schema.tryonGenerations)
    .innerJoin(schema.tryonImages, eq(schema.tryonImages.id, schema.tryonGenerations.resultId))
    .where(and(eq(schema.tryonGenerations.id, id), eq(schema.tryonGenerations.onDisplay, true)));
  return row ?? null;
}

export const newDisplayToken = () => crypto.randomBytes(32).toString("base64url");
