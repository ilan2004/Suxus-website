/**
 * Who may see / do what. Used on the server (pages, actions, API routes) and in the menu.
 * Pages a role may not use are hidden from the menu AND answer "not found" on the server.
 */
export type Role = "owner" | "partner" | "staff";

export type Perm =
  | "money" // Setup Expenses, Capital Account, Opening Stock, Summary, supplier balance due + Pay, dashboard money figures
  | "costs" // cost prices: fabric cost / stock value, purchase rates and totals
  | "settings" // Settings, Import / Backup (Excel download), message templates
  | "users" // add users, set roles, reset other people's PINs
  | "staff" // Staff and Incentive pages
  | "delete"; // delete / cancel records

const ALL: Perm[] = ["money", "costs", "settings", "users", "staff", "delete"];

export const ROLE_PERMS: Record<Role, Perm[]> = {
  owner: ALL,
  partner: ALL,
  staff: [],
};

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", partner: "Partner", staff: "Staff" };

export function can(role: Role | null | undefined, perm: Perm) {
  return !!role && ROLE_PERMS[role].includes(perm);
}

/** Access level stored on the staff row → role. */
export function roleFromAccess(access: string | null | undefined): Role | null {
  return access === "owner" || access === "partner" || access === "staff" ? access : null;
}
