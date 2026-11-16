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
