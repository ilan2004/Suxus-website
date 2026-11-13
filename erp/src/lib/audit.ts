import "server-only";
import type { DB, Tx } from "./db";
import { auditLog } from "./db/schema";
import type { Session } from "./auth";

export async function audit(
  db: DB | Tx,
  user: Session | null,
  action: "create" | "update" | "delete" | "login",
  entity: string,
  entityId: string | number | null,
  summary?: string,
) {
  await db.insert(auditLog).values({
    staffId: user?.id ?? null,
    staffName: user?.name ?? null,
    action,
    entity,
    entityId: entityId == null ? null : String(entityId),
    summary: summary ?? null,
  });
}
