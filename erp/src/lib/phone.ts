/**
 * Phone numbers are stored as full international numbers: "+919847123456", "+971501234567".
 *  - Spaces, dashes, brackets and dots are removed first.
 *  - Starts with "+": kept exactly as written (it already has its country code).
 *  - No "+", 10 digits starting 6/7/8/9: an Indian mobile → "+91" + the 10 digits.
 *  - Anything else: not readable (null). +91 is never assumed for other numbers.
 */
export function toIntlPhone(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/[\s\-(). ‎‏‪-‮]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
  if (/^[6-9]\d{9}$/.test(s)) return `+91${s}`;
  return null;
}

/** For saving free-typed fields (orders, bills): the international number when readable, else what was typed. */
export const intlOrAsTyped = (raw: string | null | undefined) => (raw ? (toIntlPhone(raw) ?? raw.trim()) || null : null);

/** "+919846186713" → "+91 98461 86713"; other countries are shown as stored. */
export function formatPhone(p: string | null | undefined) {
  if (!p) return "";
  const m = p.match(/^\+91([6-9]\d{4})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

/** Number for https://wa.me/<number> — the international number without "+". Null when it can't be read. */
export function waNumber(raw: string | null | undefined) {
  return toIntlPhone(raw)?.slice(1) ?? null;
}

export function waMeLink(raw: string, text?: string) {
  const n = waNumber(raw);
  if (!n) return null;
  // encodeURIComponent keeps Malayalam, emoji and line breaks intact.
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const PHONE_HELP = "10-digit Indian mobile, or the full number with + and country code (e.g. +971501234567)";
