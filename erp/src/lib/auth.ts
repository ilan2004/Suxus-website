import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "./db";
import { can, roleFromAccess, type Perm, type Role } from "./permissions";

export const SESSION_COOKIE = "suxus_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export type Session = { id: number; name: string; role: Role; exp: number };

function secret() {
  const s = process.env.ERP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("ERP_SECRET is not set");
  return s || "suxus-dev-secret-change-me";
}

function sign(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(s: Session) {
  const data = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Use in pages and server actions. Redirects to /login when not signed in.
 * `can`: the permission needed — without it the page answers "not found" (it is hidden, not refused).
 */
export async function requireUser(opts?: { can?: Perm }): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (opts?.can && !can(s.role, opts.can)) notFound();
  return s;
}

export async function startSession(user: { id: number; name: string; access: string }) {
  const jar = await cookies();
  const session: Session = {
    id: user.id,
    name: user.name,
    role: roleFromAccess(user.access) ?? "staff",
    exp: Date.now() + MAX_AGE * 1000,
  };
  jar.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const hashPin = (pin: string) => bcrypt.hash(pin, 10);
export const checkPin = (pin: string, hash: string) => bcrypt.compare(pin, hash);

export async function loginUsers() {
  const db = await getDb();
  return db
    .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, access: schema.staff.access })
    .from(schema.staff)
    .where(and(ne(schema.staff.access, "none"), eq(schema.staff.status, "Active")))
    .orderBy(schema.staff.code);
}

export async function hasAnyLoginUser() {
  const db = await getDb();
  const rows = await db.select({ id: schema.staff.id }).from(schema.staff).where(ne(schema.staff.access, "none")).limit(1);
  return rows.length > 0;
}
