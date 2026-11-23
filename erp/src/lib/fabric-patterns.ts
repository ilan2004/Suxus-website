/** Fabric pattern types (Fabric Stock → Pattern). Pattern size applies only to Check and Stripe. */
export const PATTERNS = ["Plain / Solid", "Check", "Stripe", "Print", "Dobby / Self design", "Other"] as const;
export type Pattern = (typeof PATTERNS)[number];
export const hasRepeat = (p: string | null | undefined) => p === "Check" || p === "Stripe";
