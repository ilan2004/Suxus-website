import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "./db";
import { can, roleFromAccess, type Perm, type Role } from "./permissions";

export const SESSION_COOKIE = "suxus_session";
/** Stay signed in on this device until "Sign out" (400 days is the longest a browser keeps a cookie). */
const MAX_AGE = 60 * 60 * 24 * 400;

/** name = the short display name ("GK") shown at the top and written on records. v = session version. */
export type Session = { id: number; name: string; fullName: string; role: Role; v: number; exp: number };
type Token = { id: number; v: number; exp: number };

function secret() {
  const s = process.env.ERP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("ERP_SECRET is not set");
  return s || "suxus-dev-secret-change-me";
}

function sign(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function encodeToken(t: Token) {
  const data = Buffer.from(JSON.stringify(t)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decodeToken(token: string | undefined): Token | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const t = JSON.parse(Buffer.from(data, "base64url").toString()) as Partial<Token>;
    return typeof t.id === "number" && typeof t.exp === "number" && t.exp > Date.now() ? { id: t.id, v: t.v ?? 0, exp: t.exp } : null;
  } catch {
    return null;
  }
}

export const displayNameOf = (u: { name: string; displayName?: string | null }) => u.displayName?.trim() || u.name;

/**
 * The signed-in user, checked against the database on every request: a removed sign-in, a changed role
 * or a PIN reset (which bumps session_version) takes effect at once on every device.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const t = decodeToken(jar.get(SESSION_COOKIE)?.value);
  if (!t) return null;
  const db = await getDb();
  const [u] = await db
    .select({ id: schema.staff.id, name: schema.staff.name, displayName: schema.staff.displayName, access: schema.staff.access, status: schema.staff.status, v: schema.staff.sessionVersion })
    .from(schema.staff)
    .where(eq(schema.staff.id, t.id));
  const role = roleFromAccess(u?.access);
  if (!u || !role || u.status !== "Active" || u.v !== t.v) return null;
  return { id: u.id, name: displayNameOf(u), fullName: u.name, role, v: u.v, exp: t.exp };
});

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

export async function startSession(user: { id: number; sessionVersion: number }) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeToken({ id: user.id, v: user.sessionVersion, exp: Date.now() + MAX_AGE * 1000 }), {
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

/** New and reset PINs are exactly 6 digits (the sign-in keypad takes six). */
export const PIN_RE = /^\d{6}$/;
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;

export const hashPin = (pin: string) => bcrypt.hash(pin, 10);
export const checkPin = (pin: string, hash: string) => bcrypt.compare(pin, hash);

export async function loginUsers() {
  const db = await getDb();
  return db
    .select({ id: schema.staff.id, name: schema.staff.name, displayName: schema.staff.displayName, role: schema.staff.role, access: schema.staff.access })
    .from(schema.staff)
    .where(and(ne(schema.staff.access, "none"), eq(schema.staff.status, "Active")))
    .orderBy(schema.staff.code);
}

export async function hasAnyLoginUser() {
  const db = await getDb();
  const rows = await db.select({ id: schema.staff.id }).from(schema.staff).where(ne(schema.staff.access, "none")).limit(1);
  return rows.length > 0;
}
