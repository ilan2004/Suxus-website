import { getTableName, sql, type Column } from "drizzle-orm";

/** Fully-qualified column ("table"."column") — needed inside correlated subqueries. */
export const c = (col: Column) => sql.raw(`"${getTableName(col.table)}"."${col.name}"`);
