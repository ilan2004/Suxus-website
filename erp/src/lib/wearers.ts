/** Wearer = a person who is measured, under one customer (the account). Shared by server and client. */
export const RELATIONS = ["Self", "Son", "Daughter", "Wife", "Husband", "Father", "Mother", "Brother", "Sister", "Other"] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_ML: Record<string, string> = {
  Self: "സ്വന്തം",
  Son: "മകൻ",
  Daughter: "മകൾ",
  Wife: "ഭാര്യ",
  Husband: "ഭർത്താവ്",
  Father: "അച്ഛൻ",
  Mother: "അമ്മ",
  Brother: "സഹോദരൻ",
  Sister: "സഹോദരി",
  Other: "മറ്റുള്ളവർ",
};

export type WearerLite = { id: number; customerId: number; name: string; relation: string; school: string | null; note: string | null; isSelf: boolean };

/** "Anas (Son, Class 7)" · Self → "Self". */
export function wearerTitle(w: { name: string; relation: string; school?: string | null; isSelf: boolean }) {
  if (w.isSelf) return "Self";
  const extra = [w.relation !== "Other" ? w.relation : null, w.school].filter(Boolean).join(", ");
  return extra ? `${w.name} (${extra})` : w.name;
}

/** For the tailor / prints: Self is the customer themself, so print the customer's name. */
export function wearerName(w: { name: string; isSelf: boolean } | null | undefined, customerName: string | null | undefined) {
  if (!w) return customerName ?? "";
  return w.isSelf ? (customerName ?? "Self") : w.name;
}
