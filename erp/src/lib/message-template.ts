/** WhatsApp message templates — placeholder filling and phone clean-up (shared by server and browser). */

export const TEMPLATE_CATEGORIES = ["Greeting", "Order", "Payment", "Offer"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const PLACEHOLDERS = [
  { key: "name", label: "Customer name" },
  { key: "order_no", label: "Order no." },
  { key: "item", label: "Items" },
  { key: "amount", label: "Order total" },
  { key: "date", label: "Delivery date" },
  { key: "balance", label: "Balance due" },
  { key: "shop", label: "Shop name" },
  { key: "phone", label: "Shop phone" },
] as const;
export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type PlaceholderValues = Partial<Record<PlaceholderKey, string | number | null | undefined>>;

/** WhatsApp shows long messages fine, but wa.me links get cut off by some phones beyond this. */
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Replaces {name}, {order_no} … with values. A placeholder with no value becomes blank (never "{amount}").
 * Unknown {words} are left as typed.
 */
export function fillTemplate(body: string, values: PlaceholderValues) {
  const known = new Set<string>(PLACEHOLDERS.map((p) => p.key));
  const out = body.replace(/\{([a-z_]+)\}/g, (m, key: string) => {
    if (!known.has(key)) return m;
    const v = values[key as PlaceholderKey];
    return v == null ? "" : String(v).trim();
  });
  // Tidy what blanks leave behind: double spaces, " ·" at line end, "  ," etc.
  return out
    .split("\n")
    .map((l) => l.replace(/₹(?!\s*\d)/g, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/\s*·\s*$/, "").replace(/^\s*·\s*/, "").trimEnd())
    .join("\n")
    .trim();
}

/** "+91 98461 86713" / "098461 86713" / "919846186713" → "9846186713". */
export function cleanIndianPhone(raw: string | null | undefined) {
  let d = (raw ?? "").split("/")[0].replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export const isValidIndianMobile = (d: string) => /^\d{10}$/.test(d);

export function waMeLink(tenDigits: string, text: string) {
  // encodeURIComponent keeps Malayalam, emoji and line breaks intact (UTF-8 percent-encoding).
  return `https://wa.me/91${tenDigits}?text=${encodeURIComponent(text)}`;
}

/** Indian digit grouping without the ₹ sign (templates write "₹{balance}" themselves). */
export function plainAmount(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

/** Placeholders that come from the record (an order) — a template that needs one is only offered when it has a value. */
const RECORD_KEYS: PlaceholderKey[] = ["order_no", "item", "amount", "date", "balance"];

/**
 * Can this template be sent for this record? Greeting and Offer templates always can.
 * Order / Payment templates need every order placeholder they use; {balance} must be more than 0.
 */
export function templateAvailability(t: { category: string; body: string }, values: PlaceholderValues): { ok: true } | { ok: false; reason: string } {
  if (t.category === "Greeting" || t.category === "Offer") return { ok: true };
  const used = new Set(Array.from(t.body.matchAll(/\{([a-z_]+)\}/g), (m) => m[1]));
  const empty = (k: PlaceholderKey) => {
    const v = values[k];
    if (v == null || String(v).trim() === "") return true;
    if (k === "balance" || k === "amount") return Number(String(v).replace(/[^\d.]/g, "")) <= 0;
    return false;
  };
  const missing = RECORD_KEYS.filter((k) => used.has(k) && empty(k));
  if (!missing.length) return { ok: true };
  if (empty("order_no") && (missing.includes("order_no") || missing.some((k) => k !== "balance"))) return { ok: false, reason: "No order for this customer" };
  if (missing.includes("balance")) return { ok: false, reason: "No balance due" };
  if (missing.includes("date")) return { ok: false, reason: "No delivery date on the order" };
  return { ok: false, reason: `No ${missing.join(", ")} for this record` };
}
