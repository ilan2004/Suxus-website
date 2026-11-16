import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,23,456 */
export const rupees = (n: number | null | undefined, decimals = false) => {
  const v = Number(n ?? 0);
  return (v < 0 ? "−₹" : "₹") + (decimals ? inr : inr0).format(Math.abs(v));
};
export const num = (n: number | null | undefined) => inr.format(Number(n ?? 0));

/** Today in India as YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 08-09-2026 (the format the shop already uses). */
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** 11-Nov-2026 */
export function fmtDateMon(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1] ?? m;
  return `${d}-${mon}-${y}`;
}

/** "today", "yesterday", "5 days ago", "3 months ago" — counted in whole days from `ref` (IST today). */
export function daysAgo(iso: string | null | undefined, ref = today()) {
  if (!iso) return "";
  const days = Math.round((Date.parse(ref.slice(0, 10) + "T00:00:00Z") - Date.parse(iso.slice(0, 10) + "T00:00:00Z")) / 86400000);
  if (days <= 0) return days === 0 ? "today" : "upcoming";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.round(days / 365.25)} years ago`;
}

export function monthStart(iso = today()) {
  return iso.slice(0, 8) + "01";
}

/** WhatsApp link with Indian number normalisation (10 digits → +91). */
export function waLink(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function monthEnd(iso = today()) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** ?from=&to= from the URL, defaulting to the current month. */
export function resolvePeriod(sp: { from?: string; to?: string }) {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const t = today();
  return { from: ok(sp.from) ? sp.from! : monthStart(t), to: ok(sp.to) ? sp.to! : monthEnd(t) };
}
